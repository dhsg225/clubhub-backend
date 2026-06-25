'use strict';
/**
 * HealthModel — canonical platform health snapshot and operational state model.
 * Detection only. No mutation.
 */

const HEALTH_STATUS = Object.freeze({
  HEALTHY:  'HEALTHY',
  DEGRADED: 'DEGRADED',
  CRITICAL: 'CRITICAL',
  UNKNOWN:  'UNKNOWN',
});

const HEALTH_DIMENSIONS = Object.freeze([
  'kernel',
  'sdk',
  'agent_runtime',
  'orchestration',
  'trace_store',
  'simulation',
  'operator_ui',
  'ota_runtime',
  'lifecycle',
  'replay',
  'topology',
]);

class HealthModel {
  constructor() {
    this._checks   = new Map();   // dimension → { status, detail, ts }
    this._listeners = [];
  }

  recordCheck(dimension, status, detail = null) {
    if (!HEALTH_DIMENSIONS.includes(dimension)) {
      throw new Error(`HealthModel: unknown dimension '${dimension}'`);
    }
    if (!Object.values(HEALTH_STATUS).includes(status)) {
      throw new Error(`HealthModel: unknown status '${status}'`);
    }
    this._checks.set(dimension, { dimension, status, detail, ts: Date.now() });
    for (const fn of this._listeners) fn(dimension, status);
  }

  onCheck(fn) { this._listeners.push(fn); }

  getCheck(dimension) { return this._checks.get(dimension) ?? { dimension, status: HEALTH_STATUS.UNKNOWN, detail: null, ts: null }; }

  overallStatus() {
    const statuses = HEALTH_DIMENSIONS.map(d => this.getCheck(d).status);
    if (statuses.some(s => s === HEALTH_STATUS.CRITICAL)) return HEALTH_STATUS.CRITICAL;
    if (statuses.some(s => s === HEALTH_STATUS.DEGRADED)) return HEALTH_STATUS.DEGRADED;
    if (statuses.every(s => s === HEALTH_STATUS.HEALTHY)) return HEALTH_STATUS.HEALTHY;
    return HEALTH_STATUS.UNKNOWN;
  }

  snapshot() {
    const checks = {};
    for (const d of HEALTH_DIMENSIONS) checks[d] = this.getCheck(d);
    return {
      overall: this.overallStatus(),
      dimensions: checks,
      snapshot_at: Date.now(),
    };
  }
}

module.exports = { HealthModel, HEALTH_STATUS, HEALTH_DIMENSIONS };
