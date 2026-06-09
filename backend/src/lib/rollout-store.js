'use strict';
/**
 * rollout-store.js
 *
 * DB persistence adapter for RolloutState.
 * Converts the in-memory OTA state machine into a durable, crash-safe component.
 *
 * Every state transition is persisted to the rollout_state table with
 * optimistic concurrency control (version column).
 *
 * Only one non-terminal rollout can exist at a time (enforced by DB index
 * idx_one_active_rollout and application-level check in create()).
 *
 * SEVERE drift blocks Ring 1 promotion (REALITY_GAP_VALIDATION.md §5.1).
 * Waivers read from soak-reports/gap-waivers.json.
 */

const fs   = require('node:fs');
const path = require('node:path');
const { RolloutState, STATES } = require('./rollout-state');
const { emit, EVENTS } = require('./events');
const fleetConsensus   = require('./fleet-consensus');
const { withLineage }  = require('./event-lineage');

const GAP_REGISTRY_PATH = path.resolve(process.cwd(), 'soak-reports/gap-registry.json');
const GAP_WAIVERS_PATH  = path.resolve(process.cwd(), 'soak-reports/gap-waivers.json');

// Ring states that require a drift check before promotion
const DRIFT_GATED_PROMOTIONS = new Set(['RING_1', 'RING_2', 'RING_3', 'COMPLETE']);

// ── Drift enforcement ─────────────────────────────────────────────────────────

function _loadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Returns { blocked: bool, reason: string|null }
 * Blocked when: SEVERE drift entry exists in gap registry AND has no valid waiver.
 */
function checkSevereDriftBlock() {
  const registry = _loadJson(GAP_REGISTRY_PATH);
  if (!registry || !Array.isArray(registry.entries) || registry.entries.length === 0) {
    // No observations — not a blocker (DRIFT-DB1: warn only)
    return { blocked: false, reason: null };
  }

  const severeEntries = registry.entries.filter(e => e.classification === 'SEVERE');
  if (severeEntries.length === 0) return { blocked: false, reason: null };

  const waivers = _loadJson(GAP_WAIVERS_PATH);
  const activeWaivers = Array.isArray(waivers?.waivers)
    ? waivers.waivers.filter(w => w.waived_until && new Date(w.waived_until) > new Date())
    : [];

  const unwaivedSevere = severeEntries.filter(entry => {
    return !activeWaivers.some(w =>
      w.metric === entry.metric && w.assumption_id === entry.assumption_id
    );
  });

  if (unwaivedSevere.length === 0) return { blocked: false, reason: null };

  const summary = unwaivedSevere
    .map(e => `${e.assumption_id}/${e.metric}(drift=${e.drift})`)
    .join(', ');
  return {
    blocked: true,
    reason: `DRIFT-DB2: ${unwaivedSevere.length} SEVERE drift gap(s) without active waiver block Ring promotion: ${summary}`,
  };
}

// ── Persistence ───────────────────────────────────────────────────────────────

class OptimisticConcurrencyError extends Error {
  constructor(updateId, expectedVersion) {
    super(`Rollout ${updateId} was modified concurrently (expected version ${expectedVersion})`);
    this.name = 'OptimisticConcurrencyError';
  }
}

class RolloutStore {
  /**
   * @param {object} pool  pg Pool
   * @param {object} rollout  RolloutState instance
   * @param {string} dbId  UUID of the row in rollout_state
   * @param {number} dbVersion  current DB version for optimistic concurrency
   */
  constructor(pool, rollout, dbId, dbVersion) {
    this._pool    = pool;
    this._rollout = rollout;
    this._dbId    = dbId;
    this._version = dbVersion;
  }

  // ── Factory: load active rollout from DB ────────────────────────────────────

  /**
   * Load the currently active (non-terminal) rollout from DB.
   * Returns a RolloutStore instance or null if no active rollout.
   */
  static async loadActive(pool, thresholds = {}) {
    const r = await pool.query(
      `SELECT * FROM rollout_state WHERE state NOT IN ('COMPLETE', 'ROLLED_BACK') LIMIT 1`
    );
    if (!r.rows.length) return null;

    const row = r.rows[0];
    const rollout = new RolloutState({
      updateId:     row.update_id,
      targetVersion: row.target_version,
      thresholds,
      totalScreens: row.total_screens,
      freezeCheck:  () => fleetConsensus.isRolloutFrozen(),
    });

    // Restore internal state from DB row
    rollout.state         = row.state;
    rollout.previousState = row.previous_state;
    rollout.frozenFrom    = row.frozen_from;
    rollout.history       = row.history || [];
    rollout.adoptionLog   = row.adoption_log || {};
    rollout.startedAt     = new Date(row.started_at).getTime();
    rollout.ringEnteredAt = row.ring_entered_at ? new Date(row.ring_entered_at).getTime() : null;

    return new RolloutStore(pool, rollout, row.id, row.version);
  }

  /**
   * Create a new rollout in PENDING state.
   * Fails if an active rollout already exists.
   */
  static async create(pool, { updateId, targetVersion, totalScreens = 0 }, thresholds = {}) {
    // Check for existing active rollout at application layer (DB constraint also enforces)
    const existing = await pool.query(
      `SELECT update_id, state FROM rollout_state WHERE state NOT IN ('COMPLETE', 'ROLLED_BACK') LIMIT 1`
    );
    if (existing.rows.length) {
      throw new Error(
        `Cannot create rollout ${updateId}: active rollout ${existing.rows[0].update_id} is in state ${existing.rows[0].state}. Complete or rollback it first.`
      );
    }

    const r = await pool.query(
      `INSERT INTO rollout_state
         (update_id, target_version, state, total_screens, history, adoption_log)
       VALUES ($1, $2, 'PENDING', $3, '[]', '{}')
       RETURNING *`,
      [updateId, targetVersion, totalScreens]
    );

    const row = r.rows[0];
    const rollout = new RolloutState({ updateId, targetVersion, thresholds, totalScreens, freezeCheck: () => fleetConsensus.isRolloutFrozen() });
    rollout.state = 'PENDING';

    emit(EVENTS.OTA.ROLLOUT_STARTED, null, {
      update_id:      updateId,
      target_version: targetVersion,
      ring_sizes:     { ring1: thresholds.ota?.ring1_max_pct ?? 30, ring2: thresholds.ota?.ring2_max_pct ?? 70 },
    });

    return new RolloutStore(pool, rollout, row.id, row.version);
  }

  // ── State transitions (wrapped for persistence) ─────────────────────────────

  async transition(toState, reason = null) {
    const result = this._rollout.transition(toState, reason);
    if (!result.ok) return result;
    await this._persist();
    return result;
  }

  async promoteRing(metrics = {}) {
    // ── Freeze classification check (ACTIVE/ACTIVE SAFE) ─────────────────────
    // Use a strong DB read for freeze state — not the in-memory cache.
    // In active/active HA, the in-memory value on this instance may be stale
    // if another instance set the freeze. The DB read is the authoritative source.
    //
    // DB FAILURE: isRolloutFrozenFromDb throws. Unknown freeze state must not be
    // treated as "not frozen". If freeze state cannot be confirmed, block promotion.
    let isFrozen;
    try {
      isFrozen = this._pool
        ? await fleetConsensus.isRolloutFrozenFromDb(this._pool)
        : fleetConsensus.isRolloutFrozen();
    } catch (err) {
      return {
        promoted:     false,
        blocked:      true,
        freeze_class: 'FREEZE_CHECK_FAILED',
        reason:       `Promotion blocked: freeze state could not be confirmed — ${err.message}`,
      };
    }

    if (isFrozen) {
      const consensusStatus = fleetConsensus.getStatus();
      let freezeClass = 'MANUAL_OPERATOR_FREEZE';
      if (consensusStatus.status === 'SPLIT_BRAIN')    freezeClass = 'CONSENSUS_SPLIT_BRAIN';
      if (consensusStatus.status === 'AUTHORITY_LOSS') freezeClass = 'AUTHORITY_LOSS';

      emit(EVENTS.OTA.RING_FROZEN, null, withLineage({
        update_id:        this._rollout.updateId,
        ring:             this._rollout.state,
        freeze_class:     freezeClass,
        freeze_reason:    consensusStatus.freeze_reason ?? 'rollout_frozen',
        consensus_status: consensusStatus.status,
      }, {
        authority_epoch:     fleetConsensus.getEpoch(),
        manifest_generation: fleetConsensus.getManifestGeneration(),
      }));
      return {
        promoted:     false,
        blocked:      true,
        freeze_class: freezeClass,
        reason:       `Promotion blocked: ${freezeClass} — ${consensusStatus.freeze_reason ?? 'rollout frozen'}`,
      };
    }

    // ── Drift block check (DRIFT-DB2) ────────────────────────────────────────
    const nextState = this._nextTargetState();
    if (nextState && DRIFT_GATED_PROMOTIONS.has(nextState)) {
      const driftCheck = checkSevereDriftBlock();
      if (driftCheck.blocked) {
        emit(EVENTS.OTA.RING_FROZEN, null, withLineage({
          update_id:    this._rollout.updateId,
          ring:         this._rollout.state,
          freeze_class: 'POLICY_DENY',
          freeze_reason: driftCheck.reason,
          freeze_id:    'DRIFT-DB2',
        }, {
          authority_epoch:     fleetConsensus.getEpoch(),
          manifest_generation: fleetConsensus.getManifestGeneration(),
        }));
        return { promoted: false, blocked: true, freeze_class: 'POLICY_DENY', reason: driftCheck.reason };
      }
    }

    const result = this._rollout.promoteRing(metrics);
    if (result.promoted) {
      await this._persist();
      // Ring promotion changes OTA instruction delivery — increment manifest generation
      // so fleet consensus detects that screens need to re-evaluate their manifests.
      // Non-fatal if DB is temporarily unreachable: screens will re-evaluate on next poll.
      fleetConsensus.incrementManifestGeneration().catch(err => {
        console.warn('[rollout-store] manifest generation increment failed after ring promotion:', err.message);
      });
      emit(EVENTS.OTA.RING_PROMOTED, null, withLineage({
        update_id: this._rollout.updateId,
        new_state: this._rollout.state,
      }, {
        authority_epoch:     fleetConsensus.getEpoch(),
        manifest_generation: fleetConsensus.getManifestGeneration(),
      }));
    } else if (this._rollout.history.length > 0) {
      await this._persist();
    }
    return result;
  }

  async rollback(reason) {
    const result = this._rollout.rollback(reason);
    if (result.ok) await this._persist();
    return result;
  }

  async liftFreeze(reason = 'operator_lifted') {
    const result = this._rollout.liftFreeze(reason);
    if (result.ok) await this._persist();
    return result;
  }

  snapshot() {
    return {
      ...this._rollout.snapshot(),
      db_id:      this._dbId,
      db_version: this._version,
    };
  }

  get state() { return this._rollout.state; }
  get updateId() { return this._rollout.updateId; }

  // ── Persistence internals ───────────────────────────────────────────────────

  async _persist() {
    const r = this._rollout;
    const res = await this._pool.query(
      `UPDATE rollout_state SET
         state          = $1,
         previous_state = $2,
         frozen_from    = $3,
         ring_entered_at = $4,
         history        = $5,
         adoption_log   = $6,
         version        = version + 1,
         updated_at     = NOW()
       WHERE id = $7 AND version = $8
       RETURNING version`,
      [
        r.state,
        r.previousState ?? null,
        r.frozenFrom    ?? null,
        r.ringEnteredAt ? new Date(r.ringEnteredAt).toISOString() : null,
        JSON.stringify(r.history),
        JSON.stringify(r.adoptionLog),
        this._dbId,
        this._version,
      ]
    );

    if (!res.rows.length) {
      throw new OptimisticConcurrencyError(r.updateId, this._version);
    }

    this._version = res.rows[0].version;
  }

  _nextTargetState() {
    const seq = ['STAGING', 'RING_0', 'RING_1', 'RING_2', 'RING_3', 'COMPLETE'];
    const idx = seq.indexOf(this._rollout.state);
    return idx >= 0 && idx < seq.length - 1 ? seq[idx + 1] : null;
  }
}

module.exports = { RolloutStore, OptimisticConcurrencyError, checkSevereDriftBlock };
