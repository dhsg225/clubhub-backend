'use strict';
const clusterConsensus = require('../core/cluster-consensus');
const lineage          = require('../core/lineage');

const DRIFT_TYPES = Object.freeze({
  SPLIT_BRAIN:       'SPLIT_BRAIN',
  STALE_NODES:       'STALE_NODES',
  LINEAGE_GAP:       'LINEAGE_GAP',
  REPLAY_DIVERGENCE: 'REPLAY_DIVERGENCE',
  AUTHORITY_DRIFT:   'AUTHORITY_DRIFT',
  RESOURCE_OVERFLOW: 'RESOURCE_OVERFLOW',
});

class DriftDetector {
  async detect() {
    const findings = [];
    const status   = clusterConsensus.getStatus();
    if (status.status === 'SPLIT_BRAIN' || status.status === 'AUTHORITY_LOSS') {
      findings.push({ type: DRIFT_TYPES.SPLIT_BRAIN, severity: 'CRITICAL', detail: { status: status.status } });
    }
    if (status.stale_count > 0) {
      findings.push({
        type:     DRIFT_TYPES.STALE_NODES,
        severity: status.stale_count > 3 ? 'HIGH' : 'MEDIUM',
        detail:   { stale_count: status.stale_count },
      });
    }
    try {
      const result = lineage.verifyLineage([], { mode: lineage.LINEAGE_MODES.REPORT });
      if (result?.anomalies?.length) {
        findings.push({ type: DRIFT_TYPES.LINEAGE_GAP, severity: 'HIGH', detail: { anomalies: result.anomalies } });
      }
    } catch { /* lineage buffer may be empty */ }
    return Object.freeze({
      detected_at:   new Date().toISOString(),
      finding_count: findings.length,
      findings,
      status:        findings.length === 0 ? 'CLEAN' : 'DRIFTED',
    });
  }
  get DRIFT_TYPES() { return DRIFT_TYPES; }
}
module.exports = DriftDetector;
