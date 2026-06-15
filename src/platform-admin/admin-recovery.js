'use strict';
/**
 * AdminRecovery — governed recovery operations.
 * All recovery is operator-initiated. No autonomous self-healing.
 */

const RECOVERY_TYPES = Object.freeze({
  LIFECYCLE_RESET:    'LIFECYCLE_RESET',
  TRACE_CHAIN_VERIFY: 'TRACE_CHAIN_VERIFY',
  CONVERGENCE_REPORT: 'CONVERGENCE_REPORT',
  TOPOLOGY_REBUILD:   'TOPOLOGY_REBUILD',
});

class AdminRecovery {
  constructor({ lifecycle, convergenceEngine, decisionTrace, adminAudit }) {
    this._lifecycle   = lifecycle         ?? null;
    this._convergence = convergenceEngine ?? null;
    this._dt          = decisionTrace     ?? null;
    this._audit       = adminAudit;
  }

  verifyTraceChain(operatorId) {
    this._audit.record(RECOVERY_TYPES.TRACE_CHAIN_VERIFY, operatorId, {});
    if (!this._dt) return { ok: false, reason: 'decision_trace_not_configured' };
    return this._dt.verifyChain();
  }

  runConvergenceReport(operatorId) {
    this._audit.record(RECOVERY_TYPES.CONVERGENCE_REPORT, operatorId, {});
    if (!this._convergence) return { ok: false, reason: 'convergence_engine_not_configured' };
    return this._convergence.runFullScan();
  }

  getLifecycleHistory(operatorId) {
    this._audit.record('GET_LIFECYCLE_HISTORY', operatorId, {});
    if (!this._lifecycle) return [];
    return this._lifecycle.getHistory();
  }
}

module.exports = { AdminRecovery, RECOVERY_TYPES };
