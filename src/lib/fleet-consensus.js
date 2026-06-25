'use strict';
/**
 * fleet-consensus.js — Fleet state authority and split-brain detection.
 *
 * Every manifest response includes an authority_epoch and manifest_generation.
 * Screens report these back via their heartbeat (next poll response). The
 * consensus engine compares reported epochs/versions across the fleet to detect:
 *
 *   SPLIT_BRAIN        — screens running different manifest versions simultaneously
 *   AUTHORITY_LOSS     — no screen has seen the current epoch (backend just restarted)
 *   STALE_SCREEN       — screen has not polled within STALE_THRESHOLD_MS
 *   DEGRADED           — minority of screens are stale or behind
 *   HEALTHY            — all active screens on current epoch and manifest version
 *
 * Automatic freeze triggers:
 *   SPLIT_BRAIN     → sets rollout_frozen = true; rejects ring promotions
 *   AUTHORITY_LOSS  → rejects ring promotions until quorum re-establishes
 *
 * Usage:
 *   const fc = require('./fleet-consensus');
 *   fc.recordHeartbeat(screen_id, { authority_epoch, manifest_version, manifest_hash,
 *                                    rollout_version, applied_at, previous_manifest_hash });
 *   const status = fc.getStatus();
 *   const snapshot = fc.getSnapshot();
 *
 * The manifest route calls:
 *   fc.incrementManifestGeneration()  — when manifest content changes
 *   fc.getEpoch()                     — to include in manifest response
 *   fc.getManifestGeneration()        — to include in manifest response
 */

const governanceDb = require('./governance-db');
const clock        = require('./governed-clock');

const STALE_THRESHOLD_MS   = 120_000;   // 2 minutes — screen is stale if silent longer
const SPLIT_BRAIN_THRESHOLD = 2;        // more than this many distinct manifest versions = split-brain
const QUORUM_PCT            = 0.6;      // 60% of screens must be current for HEALTHY

// ─── Consensus state labels ───────────────────────────────────────────────────
const CONSENSUS_STATES = Object.freeze({
  HEALTHY:        'HEALTHY',
  DEGRADED:       'DEGRADED',
  SPLIT_BRAIN:    'SPLIT_BRAIN',
  AUTHORITY_LOSS: 'AUTHORITY_LOSS',
  STALE_SCREEN:   'STALE_SCREEN',
});

// ─── Module-level state (singleton per process) ───────────────────────────────

let _epoch              = 1;
let _manifestGeneration = 1;
let _rolloutFrozen      = false;
let _freezeReason       = null;
let _freezeEpoch        = 0;
let _pool               = null;
let _dbFailurePolicy    = process.env.DB_FREEZE_FAILURE_POLICY ?? 'FAIL_CLOSED'; // FAIL_CLOSED | FAIL_OPEN | STALE_OK
const _screens          = new Map(); // screenId → HeartbeatRecord

const MAX_SCREENS = 1000;  // resource governance: evict stale screens on overflow

/**
 * @typedef {object} HeartbeatRecord
 * @property {string}  screen_id
 * @property {number}  authority_epoch
 * @property {number}  manifest_version
 * @property {string|null}  manifest_hash
 * @property {string|null}  rollout_version
 * @property {string|null}  previous_manifest_hash
 * @property {number}  applied_at              — screen-reported timestamp (ms)
 * @property {number}  received_at             — backend wall-clock time
 * @property {boolean} stale                   — computed by getStatus()
 */

// ─── DB pool configuration ────────────────────────────────────────────────────

function setPool(pool) {
  _pool = pool;
}

// ─── DB initialisation ────────────────────────────────────────────────────────

async function initFromDb(pool) {
  const p = pool || _pool;
  if (!p) throw new Error('fleet-consensus: initFromDb requires a pool');

  // Direct query — no error swallowing. Throws on DB failure. The server must not
  // start without the authoritative epoch; callers should let this propagate.
  const r = await p.query(
    "SELECT key, int_value, text_value FROM governance_state WHERE key = ANY($1)",
    [['authority_epoch', 'manifest_generation', 'rollout_frozen', 'freeze_reason']]
  );
  const kv = {};
  for (const row of r.rows) kv[row.key] = row;

  _epoch              = kv.authority_epoch     ? Number(kv.authority_epoch.int_value)   : 1;
  _manifestGeneration = kv.manifest_generation ? Number(kv.manifest_generation.int_value) : 1;
  _rolloutFrozen      = kv.rollout_frozen      ? kv.rollout_frozen.text_value === '1'   : false;
  _freezeReason       = kv.freeze_reason       ? kv.freeze_reason.text_value             : null;

  // Restore durable heartbeats so consensus is not empty after a restart.
  // Non-fatal: if the table doesn't exist yet (pre-migration), consensus starts cold.
  try {
    const hb = await p.query(
      'SELECT screen_id, authority_epoch, manifest_version, manifest_hash, ' +
      'rollout_version, previous_manifest_hash, applied_at, received_at ' +
      'FROM screen_heartbeats'
    );
    for (const row of hb.rows) {
      _screens.set(row.screen_id, {
        screen_id:              row.screen_id,
        authority_epoch:        row.authority_epoch,
        manifest_version:       row.manifest_version,
        manifest_hash:          row.manifest_hash,
        rollout_version:        row.rollout_version,
        previous_manifest_hash: row.previous_manifest_hash,
        applied_at:             row.applied_at  != null ? Number(row.applied_at)  : null,
        received_at:            row.received_at != null ? Number(row.received_at) : clock.now(),
        stale:                  false,
      });
    }
  } catch { /* heartbeat table not yet migrated — consensus starts without history */ }
}

// ─── Authoritative DB read ────────────────────────────────────────────────────

/**
 * Read rollout_frozen from DB with no error swallowing.
 *
 * Throws on DB unavailability, connection failure, or query timeout.
 * Callers must catch and treat any thrown error as "freeze state unknown"
 * and block the promotion (fail-closed).
 *
 * Value semantics:
 *   key absent        → false  (freeze was never set)
 *   text_value = '0'  → false  (explicitly not frozen)
 *   text_value = '1'  → true   (frozen)
 *   any other value   → true   (fail-closed: unknown value treated as frozen)
 *
 * No pool → throws. In-memory state is not a safe fallback for this check.
 */
async function isRolloutFrozenFromDb(pool) {
  const p = pool || _pool;
  if (!p) throw new Error('fleet-consensus: freeze check requires pool — cannot confirm freeze state');
  // Direct query — intentionally no try/catch. Throws on DB failure so callers
  // can fail closed rather than silently treating unknown state as "not frozen".
  const r = await p.query(
    "SELECT text_value FROM governance_state WHERE key = 'rollout_frozen'"
  );
  if (!r.rows.length) return false; // key absent — freeze was never set
  return r.rows[0].text_value !== '0'; // only explicit '0' is not-frozen
}

// ─── Epoch and generation management ─────────────────────────────────────────

/**
 * Increment authority_epoch.
 *
 * ACTIVE/ACTIVE SAFE: uses atomic DB increment and reads back the authoritative
 * new value. Memory is updated to match DB — no fire-and-forget divergence.
 *
 * Semantics: Call once per backend startup. In a cluster, each instance
 * independently marks a new authority event; the DB counter is the single
 * authoritative source. The returned epoch is the value all screens will see
 * in the next manifest response from THIS instance.
 *
 * DB FAILURE: throws. Callers must handle this — manifests must not be served
 * from a locally invented epoch.
 *
 * @returns {Promise<number>} new authoritative epoch
 */
async function incrementEpoch() {
  if (!_pool) throw new Error('fleet-consensus: cannot increment epoch without pool');
  const newEpoch = await governanceDb.incrementInt(_pool, 'authority_epoch', 'system');
  _epoch = newEpoch;
  return _epoch;
}

/** Return current authority_epoch (in-memory; synchronous). */
function getEpoch() {
  return _epoch;
}

/**
 * Increment manifest generation.
 *
 * ACTIVE/ACTIVE SAFE: uses atomic DB increment and reads back the authoritative
 * new value. Because computeManifest() already serializes per-screen with
 * SELECT FOR UPDATE, concurrent calls for the same screen are impossible.
 * Concurrent calls for different screens each get a distinct DB increment,
 * which is correct behaviour (each screen content change is a distinct event).
 *
 * DB FAILURE: throws. Callers must handle this — manifest changes must not be
 * tracked from a locally invented generation counter.
 *
 * @returns {Promise<number>} new authoritative manifest generation
 */
async function incrementManifestGeneration() {
  if (!_pool) throw new Error('fleet-consensus: cannot increment manifest generation without pool');
  const newGen = await governanceDb.incrementInt(_pool, 'manifest_generation', 'system');
  _manifestGeneration = newGen;
  return _manifestGeneration;
}

/** Return current manifest generation (in-memory; synchronous). */
function getManifestGeneration() {
  return _manifestGeneration;
}

// ─── Heartbeat recording ──────────────────────────────────────────────────────

/**
 * Record a screen heartbeat (from manifest poll response).
 * Screens report back the epoch/version they last received.
 *
 * @param {string} screenId
 * @param {object} heartbeat
 *   authority_epoch      — epoch from last manifest response this screen received
 *   manifest_version     — manifest_generation from last response
 *   manifest_hash        — checksum of the manifest content
 *   rollout_version      — OTA target version (null if none)
 *   applied_at           — timestamp (ms) when screen applied the manifest
 *   previous_manifest_hash — hash of the manifest before the last change
 */
function recordHeartbeat(screenId, heartbeat) {
  if (!screenId) return;
  // Resource governance: evict the stalest screen when at capacity
  if (!_screens.has(screenId) && _screens.size >= MAX_SCREENS) {
    let staleKey = null;
    let oldestTs = Infinity;
    for (const [key, rec] of _screens) {
      if (rec.received_at < oldestTs) {
        oldestTs = rec.received_at;
        staleKey = key;
      }
    }
    if (staleKey) _screens.delete(staleKey);
  }
  const record = {
    screen_id:              screenId,
    authority_epoch:        heartbeat.authority_epoch        ?? null,
    manifest_version:       heartbeat.manifest_version       ?? null,
    manifest_hash:          heartbeat.manifest_hash          ?? null,
    rollout_version:        heartbeat.rollout_version        ?? null,
    previous_manifest_hash: heartbeat.previous_manifest_hash ?? null,
    applied_at:             heartbeat.applied_at             ?? null,
    received_at:            clock.now(),
    stale:                  false,  // will be computed in getStatus()
  };
  _screens.set(screenId, record);

  // Persist to Postgres — fire-and-forget so manifest responses are not blocked.
  // DB is the source of truth: loaded on startup so consensus survives restart.
  if (_pool) {
    _pool.query(
      `INSERT INTO screen_heartbeats
         (screen_id, authority_epoch, manifest_version, manifest_hash,
          rollout_version, previous_manifest_hash, applied_at, received_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (screen_id) DO UPDATE SET
         authority_epoch        = EXCLUDED.authority_epoch,
         manifest_version       = EXCLUDED.manifest_version,
         manifest_hash          = EXCLUDED.manifest_hash,
         rollout_version        = EXCLUDED.rollout_version,
         previous_manifest_hash = EXCLUDED.previous_manifest_hash,
         applied_at             = EXCLUDED.applied_at,
         received_at            = EXCLUDED.received_at,
         updated_at             = NOW()`,
      [
        screenId,
        record.authority_epoch,
        record.manifest_version,
        record.manifest_hash,
        record.rollout_version,
        record.previous_manifest_hash,
        record.applied_at,
        record.received_at,
      ]
    ).catch(err => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[fleet-consensus] heartbeat persist failed for', screenId, ':', err.message);
      }
    });
  }
}

// ─── Consensus evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate the current consensus status of the fleet.
 * Mutates stale flag on screen records as a side effect.
 *
 * @returns {{ status, current_epoch, current_manifest_generation, screen_count,
 *             active_count, stale_count, split_brain_details, rollout_frozen }}
 */
function getStatus() {
  const now = clock.now();
  const allScreens = [..._screens.values()];

  if (allScreens.length === 0) {
    return {
      status:                    CONSENSUS_STATES.AUTHORITY_LOSS,
      current_epoch:             _epoch,
      current_manifest_generation: _manifestGeneration,
      screen_count:              0,
      active_count:              0,
      stale_count:               0,
      split_brain_details:       null,
      rollout_frozen:            _rolloutFrozen,
      freeze_reason:             _freezeReason,
    };
  }

  // Mark stale
  let staleCount = 0;
  for (const rec of allScreens) {
    rec.stale = now - rec.received_at > STALE_THRESHOLD_MS;
    if (rec.stale) staleCount++;
  }

  const activeScreens = allScreens.filter(s => !s.stale);
  const activeCount   = activeScreens.length;

  // Authority loss: no active screen has seen the current epoch
  const onCurrentEpoch = activeScreens.filter(s => s.authority_epoch === _epoch);
  if (activeCount > 0 && onCurrentEpoch.length === 0) {
    _setFreeze('AUTHORITY_LOSS: no active screen has seen epoch ' + _epoch);
    return _buildStatus(CONSENSUS_STATES.AUTHORITY_LOSS, allScreens, staleCount, null);
  }

  // Split-brain detection: count distinct manifest versions among active screens
  const manifestVersions = new Set(activeScreens.map(s => s.manifest_hash).filter(Boolean));
  if (manifestVersions.size > SPLIT_BRAIN_THRESHOLD) {
    const details = { distinct_manifest_hashes: [...manifestVersions], affected_count: activeCount };
    _setFreeze('SPLIT_BRAIN: ' + manifestVersions.size + ' distinct manifest hashes across fleet');
    return _buildStatus(CONSENSUS_STATES.SPLIT_BRAIN, allScreens, staleCount, details);
  }

  // Degraded: fewer than quorum are on current manifest generation
  const onCurrentGeneration = activeScreens.filter(s => s.manifest_version === _manifestGeneration);
  if (activeCount > 0 && onCurrentGeneration.length / activeCount < QUORUM_PCT) {
    return _buildStatus(CONSENSUS_STATES.DEGRADED, allScreens, staleCount, null);
  }

  // Any stale screens = at minimum STALE_SCREEN (not HEALTHY)
  if (staleCount > 0) {
    return _buildStatus(CONSENSUS_STATES.STALE_SCREEN, allScreens, staleCount, null);
  }

  // All checks passed
  _clearFreeze();
  return _buildStatus(CONSENSUS_STATES.HEALTHY, allScreens, staleCount, null);
}

function _buildStatus(status, allScreens, staleCount, splitBrainDetails) {
  return {
    status,
    current_epoch:               _epoch,
    current_manifest_generation: _manifestGeneration,
    screen_count:                allScreens.length,
    active_count:                allScreens.filter(s => !s.stale).length,
    stale_count:                 staleCount,
    split_brain_details:         splitBrainDetails,
    rollout_frozen:              _rolloutFrozen,
    freeze_reason:               _freezeReason,
  };
}

function _setFreeze(reason) {
  if (!_rolloutFrozen) {
    _rolloutFrozen = true;
    _freezeReason  = reason;
    _freezeEpoch++;
    if (_pool) {
      governanceDb.setTextValue(_pool, 'rollout_frozen', '1', 'system').catch(() => {});
      governanceDb.setTextValue(_pool, 'freeze_reason', reason, 'system').catch(() => {});
      governanceDb.incrementInt(_pool, 'freeze_epoch', 'system').catch(() => {});
    }
  }
}

function _clearFreeze() {
  _rolloutFrozen = false;
  _freezeReason  = null;
  if (_pool) {
    governanceDb.setTextValue(_pool, 'rollout_frozen', '0', 'system').catch(() => {});
  }
}

/**
 * Strong freeze — awaits DB confirmation before updating in-memory state.
 * Write-path callers should use this to avoid epoch drift on DB failure.
 * DB failure policy: FAIL_CLOSED (default) | FAIL_OPEN | STALE_OK
 * Controlled via DB_FREEZE_FAILURE_POLICY env var or setDbFailurePolicy().
 */
async function freezeStrong(reason) {
  if (_rolloutFrozen) return; // already frozen — idempotent
  const p = _pool;
  if (p) {
    try {
      await governanceDb.setTextValue(p, 'rollout_frozen', '1', 'system');
      await governanceDb.setTextValue(p, 'freeze_reason', reason, 'system');
      const newEpoch = await governanceDb.incrementInt(p, 'freeze_epoch', 'system');
      // Only update memory AFTER DB confirms
      _rolloutFrozen = true;
      _freezeReason  = reason;
      _freezeEpoch   = newEpoch;
    } catch (err) {
      // DB outage — apply configured failure policy
      if (_dbFailurePolicy === 'FAIL_CLOSED') {
        _rolloutFrozen = true; // safe: fail closed
        _freezeReason  = reason + ' (DB_FAILURE_FAIL_CLOSED)';
        _freezeEpoch++;
      } else if (_dbFailurePolicy === 'FAIL_OPEN') {
        // Do not freeze — let promotions proceed (dangerous)
      } else {
        // STALE_OK: update memory with advisory freeze
        _rolloutFrozen = true;
        _freezeReason  = reason + ' (DB_FAILURE_STALE)';
        _freezeEpoch++;
      }
    }
  } else {
    // No pool — in-memory only
    _rolloutFrozen = true;
    _freezeReason  = reason;
    _freezeEpoch++;
  }
}

/** Set the DB failure policy for freeze operations. */
function setDbFailurePolicy(policy) {
  _dbFailurePolicy = policy;
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * Return a point-in-time snapshot of all screen records plus consensus status.
 * Written to reports/consensus-health.json by fleet-divergence.js.
 */
function getSnapshot() {
  const status  = getStatus();
  const screens = [..._screens.values()].map(s => ({ ...s }));
  return {
    generated_at:   new Date().toISOString(),
    consensus:      status,
    screens,
  };
}

/**
 * Whether rollout promotions are currently frozen.
 * Callers (rollout-state.js) must check this before promoting rings.
 */
function isRolloutFrozen() {
  return _rolloutFrozen;
}

/**
 * Manually unfreeze rollout (operator action — requires explicit call).
 * @param {string} reason  Why the freeze is being cleared
 */
function unfreezeRollout(reason) {
  _rolloutFrozen = false;
  _freezeReason  = `Manually cleared: ${reason}`;
  _freezeEpoch++;
  if (_pool) {
    governanceDb.setTextValue(_pool, 'rollout_frozen', '0', 'system').catch(() => {});
    governanceDb.setTextValue(_pool, 'freeze_reason', _freezeReason, 'system').catch(() => {});
    governanceDb.incrementInt(_pool, 'freeze_epoch', 'system').catch(() => {});
  }
}

/**
 * DB-authoritative freeze state read.
 * Returns { frozen, reason, freeze_epoch } from the governance_kv store.
 * Use in active/active HA where in-memory state may be stale.
 *
 * @param {object} [pool]  — pg pool (uses module-level pool if not provided)
 * @returns {Promise<{ frozen: boolean, reason: string|null, freeze_epoch: number }>}
 */
async function getFreezeStateStrong(pool) {
  const p = pool || _pool;
  if (!p) return { frozen: _rolloutFrozen, reason: _freezeReason, freeze_epoch: _freezeEpoch };
  try {
    const frozen      = await governanceDb.getTextValue(p, 'rollout_frozen', '0');
    const reason      = await governanceDb.getTextValue(p, 'freeze_reason', null);
    const freezeEpoch = await governanceDb.getIntValue(p, 'freeze_epoch', 0);
    return { frozen: frozen === '1', reason, freeze_epoch: freezeEpoch };
  } catch {
    return { frozen: _rolloutFrozen, reason: _freezeReason, freeze_epoch: _freezeEpoch };
  }
}

// ─── Reset (test infrastructure) ─────────────────────────────────────────────
function _reset() {
  _epoch              = 1;
  _manifestGeneration = 1;
  _rolloutFrozen      = false;
  _freezeReason       = null;
  _freezeEpoch        = 0;
  _dbFailurePolicy    = process.env.DB_FREEZE_FAILURE_POLICY ?? 'FAIL_CLOSED';
  _screens.clear();
}

module.exports = {
  CONSENSUS_STATES,
  STALE_THRESHOLD_MS,
  MAX_SCREENS,
  setPool,
  initFromDb,
  isRolloutFrozenFromDb,
  incrementEpoch,
  getEpoch,
  incrementManifestGeneration,
  getManifestGeneration,
  recordHeartbeat,
  getStatus,
  getSnapshot,
  isRolloutFrozen,
  unfreezeRollout,
  getFreezeStateStrong,
  freezeStrong,
  setDbFailurePolicy,
  _reset,  // test use only
};
