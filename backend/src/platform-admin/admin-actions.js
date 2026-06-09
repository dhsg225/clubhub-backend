'use strict';
/**
 * AdminActions — governed admin action catalog.
 * All actions route through ExecutionRouter.
 */

const ADMIN_ACTIONS = Object.freeze({
  FREEZE_PLATFORM:      'FREEZE_PLATFORM',
  UNFREEZE_PLATFORM:    'UNFREEZE_PLATFORM',
  ROTATE_OPERATOR_KEYS: 'ROTATE_OPERATOR_KEYS',
  EXPORT_REPLAY:        'EXPORT_REPLAY',
  EXPORT_TOPOLOGY:      'EXPORT_TOPOLOGY',
  RUN_CONVERGENCE_SCAN: 'RUN_CONVERGENCE_SCAN',
  RUN_CERTIFICATION:    'RUN_CERTIFICATION',
  EXPORT_INCIDENT:      'EXPORT_INCIDENT',
  RUN_DIAGNOSTICS:      'RUN_DIAGNOSTICS',
});

class AdminActions {
  constructor({ executionRouter, convergenceEngine, lifecycle, replayOrchestrator, certRunners, adminAudit }) {
    this._router      = executionRouter;
    this._convergence = convergenceEngine   ?? null;
    this._lifecycle   = lifecycle           ?? null;
    this._replay      = replayOrchestrator  ?? null;
    this._certRunners = certRunners         ?? {};
    this._audit       = adminAudit;
  }

  async freezePlatform(operatorId, reason, lineage_ts) {
    this._audit.record(ADMIN_ACTIONS.FREEZE_PLATFORM, operatorId, { reason });
    return this._router.route('OPERATOR', 'FREEZE', { reason }, { lineage_ts, correlation_id: `admin_freeze_${lineage_ts}` });
  }

  async unfreezePlatform(operatorId, reason, lineage_ts) {
    this._audit.record(ADMIN_ACTIONS.UNFREEZE_PLATFORM, operatorId, { reason });
    return this._router.route('OPERATOR', 'UNFREEZE', { reason }, { lineage_ts, correlation_id: `admin_unfreeze_${lineage_ts}` });
  }

  runConvergenceScan(operatorId) {
    this._audit.record(ADMIN_ACTIONS.RUN_CONVERGENCE_SCAN, operatorId, {});
    if (!this._convergence) return { ok: false, reason: 'convergence_engine_not_configured' };
    return this._convergence.runFullScan();
  }

  async runCertification(operatorId, phase) {
    this._audit.record(ADMIN_ACTIONS.RUN_CERTIFICATION, operatorId, { phase });
    const runner = this._certRunners[phase.toLowerCase()];
    if (!runner) return { ok: false, reason: `no runner for phase '${phase}'` };
    return runner();
  }

  getAuditLog() { return this._audit.getEntries(); }
}

module.exports = { AdminActions, ADMIN_ACTIONS };
