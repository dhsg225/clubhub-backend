'use strict';
/**
 * governed-deployment.js — All OTA deployment transitions route through kernel APIs.
 *
 * Authority routing:
 *   promoteWave()          → AuthorityCoordinator.incrementEpoch() + AuditLedger
 *   freezeDeployment()     → FreezeController.freeze() + AuditLedger
 *   unfreezeDeployment()   → FreezeController.unfreeze() + AuditLedger
 *   rollbackDeployment()   → FreezeController.freeze() + AuditLedger + event
 *   completeDeployment()   → AuthorityCoordinator + AuditLedger + event
 *
 * OTA runtime MAY NOT:
 *   - increment epoch directly (only via AuthorityCoordinator)
 *   - freeze locally except documented emergency path
 *   - mutate deployment state without audit ledger entry
 *
 * FAIL_CLOSED emergency path:
 *   freezeLocal(reason) — MEMORY_ONLY, used only on DB-unreachable + critical failure.
 *   Must be followed by freezeDeployment() as soon as DB becomes available.
 *   Emergency path is documented and audited in-memory.
 */

const replayHooks = require('./replay-hooks');

class GovernedDeployment {
  constructor() {
    this._authorityCoordinator = null;
    this._freezeController     = null;
    this._auditLedger          = null;
    this._lineageEngine        = null;
    this._eventBus             = null;
    this._BUS_EVENTS           = null;
    this._emergencyFreezeLog   = [];
  }

  /**
   * Initialize with kernel API dependencies.
   * All dependencies are required except lineageEngine.
   */
  init(deps = {}) {
    this._authorityCoordinator = deps.authorityCoordinator;
    this._freezeController     = deps.freezeController;
    this._auditLedger          = deps.auditLedger;
    this._lineageEngine        = deps.lineageEngine ?? null;
    this._eventBus             = deps.eventBus ?? null;
    this._BUS_EVENTS           = deps.eventBus?.BUS_EVENTS ?? null;
  }

  _requireInit() {
    if (!this._authorityCoordinator || !this._freezeController || !this._auditLedger) {
      throw new Error('GovernedDeployment: not initialized — call init(deps) before use');
    }
  }

  _ledgerEntry(opts) {
    try {
      this._auditLedger.appendEntry({
        action_type:   opts.action_type,
        operator_id:   opts.operator_id ?? null,
        justification: opts.justification ?? '',
        before_state_hash: opts.before_state_hash ?? null,
        after_state_hash:  opts.after_state_hash  ?? null,
        ...( opts.extra ?? {} ),
      });
    } catch { /* ledger failure must not block operation */ }
  }

  _emit(eventType, fields) {
    if (!this._eventBus) return;
    try {
      this._eventBus.emit(eventType, fields);
    } catch { /* non-fatal */ }
  }

  // ── Wave promotion ────────────────────────────────────────────────────────

  /**
   * Promote a deployment wave.
   * Routes: AuthorityCoordinator.incrementEpoch() + AuditLedger
   *
   * @param {number} ring       — ring number (0-based)
   * @param {number} waveIndex  — wave within ring
   * @param {object} opts       — { operator_id, justification, artifact_id, node_count }
   * @returns {{ epoch, ring, waveIndex, ts }}
   */
  async promoteWave(ring, waveIndex, opts = {}) {
    this._requireInit();
    replayHooks.assertCanMutateDeployment(this._freezeController.isFrozen(), 'promoteWave');

    const epoch = await this._authorityCoordinator.incrementEpoch();

    this._ledgerEntry({
      action_type:  'deployment_wave_promoted',
      operator_id:  opts.operator_id,
      justification: opts.justification ?? `Ring ${ring} wave ${waveIndex} promotion`,
      extra: {
        ring,
        wave_index:  waveIndex,
        artifact_id: opts.artifact_id ?? null,
        node_count:  opts.node_count  ?? null,
        epoch,
      },
    });

    const ts = new Date().toISOString();
    this._emit(this._BUS_EVENTS?.DEPLOYMENT?.WAVE_PROMOTED ?? 'governance.deployment.wave_promoted', {
      ring,
      wave_index:  waveIndex,
      epoch,
      artifact_id: opts.artifact_id ?? null,
      node_count:  opts.node_count  ?? null,
      operator_id: opts.operator_id ?? null,
      lineage_ts:  ts,
    });

    return Object.freeze({ epoch, ring, wave_index: waveIndex, ts });
  }

  // ── Freeze ────────────────────────────────────────────────────────────────

  /**
   * LINEARIZED strong freeze. Requires pool for DB advisory lock.
   * @param {string} reason
   * @param {object} pool        — pg.Pool (passed through; not stored)
   * @param {object} opts        — { operator_id, justification }
   */
  async freezeDeployment(reason, pool, opts = {}) {
    this._requireInit();
    replayHooks.assertNotReplay('freezeDeployment');

    const result = await this._freezeController.freeze(reason, pool);

    this._ledgerEntry({
      action_type:  'deployment_frozen',
      operator_id:  opts.operator_id,
      justification: opts.justification ?? reason,
      extra: { reason, freeze_result: result },
    });

    this._emit(this._BUS_EVENTS?.AUTHORITY?.FREEZE_COMMITTED ?? 'governance.authority.freeze_committed', {
      reason,
      operator_id: opts.operator_id ?? null,
      lineage_ts:  new Date().toISOString(),
    });

    return result;
  }

  /**
   * MEMORY_ONLY emergency freeze (FAIL_CLOSED).
   * Use ONLY when DB is unreachable and a critical failure requires immediate freeze.
   * Must be followed by freezeDeployment() when DB recovers.
   * @param {string} reason
   * @param {object} opts — { operator_id, justification }
   */
  freezeLocal(reason, opts = {}) {
    this._requireInit();
    replayHooks.assertNotReplay('freezeLocal');

    this._freezeController.freezeLocal(reason);

    const record = Object.freeze({
      action_type:  'deployment_frozen_local',
      operator_id:  opts.operator_id ?? null,
      justification: opts.justification ?? reason,
      reason,
      ts:           new Date().toISOString(),
      note:         'MEMORY_ONLY: must confirm with freezeDeployment() when DB available',
    });
    this._emergencyFreezeLog.push(record);

    this._ledgerEntry({
      action_type:  'deployment_frozen_local',
      operator_id:  opts.operator_id,
      justification: opts.justification ?? reason,
      extra: { reason, emergency: true },
    });

    this._emit('governance.runtime.freeze_local', {
      reason,
      operator_id: opts.operator_id ?? null,
      lineage_ts:  record.ts,
      note:        record.note,
    });

    return record;
  }

  // ── Unfreeze ──────────────────────────────────────────────────────────────

  /**
   * MEMORY_ONLY unfreeze. Updates in-memory state + appends audit ledger.
   * @param {string} reason
   * @param {object} opts — { operator_id, justification }
   */
  unfreezeDeployment(reason, opts = {}) {
    this._requireInit();
    replayHooks.assertNotReplay('unfreezeDeployment');

    this._freezeController.unfreeze(reason);

    this._ledgerEntry({
      action_type:  'deployment_unfrozen',
      operator_id:  opts.operator_id,
      justification: opts.justification ?? reason,
      extra: { reason },
    });

    this._emit(this._BUS_EVENTS?.AUTHORITY?.UNFREEZE_REQUESTED ?? 'governance.authority.unfreeze_requested', {
      reason,
      operator_id: opts.operator_id ?? null,
      lineage_ts:  new Date().toISOString(),
    });
  }

  // ── Rollback ──────────────────────────────────────────────────────────────

  /**
   * Rollback deployment: freeze first, then emit rollback event.
   * @param {string} reason
   * @param {object} pool — pg.Pool
   * @param {object} opts — { operator_id, justification, artifact_id, target_artifact_id }
   */
  async rollbackDeployment(reason, pool, opts = {}) {
    this._requireInit();
    replayHooks.assertNotReplay('rollbackDeployment');

    await this._freezeController.freeze(reason, pool);

    this._ledgerEntry({
      action_type:  'deployment_rollback',
      operator_id:  opts.operator_id,
      justification: opts.justification ?? reason,
      extra: {
        reason,
        artifact_id:        opts.artifact_id        ?? null,
        target_artifact_id: opts.target_artifact_id ?? null,
      },
    });

    const ts = new Date().toISOString();
    this._emit(this._BUS_EVENTS?.DEPLOYMENT?.ROLLBACK ?? 'governance.deployment.rollback', {
      reason,
      operator_id:        opts.operator_id        ?? null,
      artifact_id:        opts.artifact_id        ?? null,
      target_artifact_id: opts.target_artifact_id ?? null,
      lineage_ts:         ts,
    });

    return Object.freeze({ rolled_back: true, reason, ts });
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  /**
   * Mark deployment as complete. Increments epoch.
   * @param {object} opts — { operator_id, justification, artifact_id }
   */
  async completeDeployment(opts = {}) {
    this._requireInit();
    replayHooks.assertCanMutateDeployment(this._freezeController.isFrozen(), 'completeDeployment');

    const epoch = await this._authorityCoordinator.incrementEpoch();

    this._ledgerEntry({
      action_type:  'deployment_complete',
      operator_id:  opts.operator_id,
      justification: opts.justification ?? 'Deployment completed',
      extra: { artifact_id: opts.artifact_id ?? null, epoch },
    });

    const ts = new Date().toISOString();
    this._emit(this._BUS_EVENTS?.DEPLOYMENT?.COMPLETE ?? 'governance.deployment.complete', {
      epoch,
      artifact_id: opts.artifact_id ?? null,
      operator_id: opts.operator_id ?? null,
      lineage_ts:  ts,
    });

    return Object.freeze({ epoch, artifact_id: opts.artifact_id ?? null, ts });
  }

  // ── Status ────────────────────────────────────────────────────────────────

  isFrozen() {
    return this._freezeController?.isFrozen() ?? false;
  }

  getEpoch() {
    return this._authorityCoordinator?.getEpoch() ?? 0;
  }

  async isFrozenStrong(pool) {
    return this._freezeController?.isFrozenStrong(pool) ?? null;
  }

  getEmergencyFreezeLog() {
    return [...this._emergencyFreezeLog];
  }
}

module.exports = { GovernedDeployment };
