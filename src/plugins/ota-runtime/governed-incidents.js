'use strict';
/**
 * governed-incidents.js — OTA incident lifecycle routes through kernel IncidentManager.
 *
 * OTA runtime is a CONSUMER of incident authority.
 * OTA runtime is NOT the incident authority owner.
 *
 * Preserves:
 *   - MAX_ACTIVE_INCIDENTS enforcement (kernel-side)
 *   - Deterministic content-addressed incident IDs (kernel-side)
 *   - transitionStrong linearized semantics (kernel-side)
 *   - Archive behavior (kernel-side)
 *
 * OTA runtime MAY:
 *   - create incidents for deployment failures
 *   - transition incident states for OTA lifecycle events
 *   - archive resolved incidents
 *   - query active incidents
 *
 * OTA runtime MAY NOT:
 *   - assign incident IDs directly
 *   - bypass MAX_ACTIVE_INCIDENTS
 *   - transition to RESOLVED without kernel enforcement
 *   - mutate incident state in replay mode
 */

const replayHooks = require('./replay-hooks');

class GovernedIncidents {
  constructor() {
    this._incidentManager = null;
    this._auditLedger     = null;
    this._eventBus        = null;
    this._BUS_EVENTS      = null;
  }

  init(deps = {}) {
    this._incidentManager = deps.incidentManager;
    this._auditLedger     = deps.auditLedger;
    this._eventBus        = deps.eventBus ?? null;
    this._BUS_EVENTS      = deps.eventBus?.BUS_EVENTS ?? null;
  }

  _requireInit() {
    if (!this._incidentManager || !this._auditLedger) {
      throw new Error('GovernedIncidents: not initialized — call init(deps) before use');
    }
  }

  _ledgerEntry(opts) {
    try {
      this._auditLedger.appendEntry({
        action_type:   opts.action_type,
        operator_id:   opts.operator_id ?? null,
        justification: opts.justification ?? '',
        ...( opts.extra ?? {} ),
      });
    } catch { /* non-fatal */ }
  }

  _emit(eventType, fields) {
    if (!this._eventBus) return;
    try { this._eventBus.emit(eventType, fields); } catch { /* non-fatal */ }
  }

  // ── Create ────────────────────────────────────────────────────────────────

  /**
   * Create a new incident via kernel IncidentManager.
   * Incident ID is content-addressed — determined by kernel, not by caller.
   *
   * @param {string} type          — e.g. 'DEPLOYMENT_FAILURE'
   * @param {string} severity      — e.g. 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
   * @param {object} causalChain   — { caused_by, correlation_id, ... }
   * @param {object} opts          — { operator_id, justification }
   * @returns {object} incident
   */
  async create(type, severity, causalChain, opts = {}) {
    this._requireInit();
    replayHooks.assertNotReplay('incidents.create');

    const incident = await this._incidentManager.create(type, severity, causalChain);

    this._ledgerEntry({
      action_type:   'incident_created',
      operator_id:   opts.operator_id,
      justification: opts.justification ?? `Incident created: ${type}`,
      extra: { incident_id: incident?.id, type, severity },
    });

    this._emit(this._BUS_EVENTS?.INCIDENT?.DETECTED ?? 'governance.incident.detected', {
      incident_id:  incident?.id,
      type,
      severity,
      operator_id:  opts.operator_id ?? null,
      lineage_ts:   new Date().toISOString(),
    });

    return incident;
  }

  // ── Transition ────────────────────────────────────────────────────────────

  /**
   * CACHE_COHERENT transition. Use for non-critical state changes.
   * @param {string} id        — incident ID
   * @param {string} toState   — target state from IncidentManager.STATES
   * @param {string} reason
   * @param {object} opts      — { operator_id }
   */
  async transition(id, toState, reason, opts = {}) {
    this._requireInit();
    replayHooks.assertNotReplay('incidents.transition');

    const result = await this._incidentManager.transition(id, toState, reason);

    this._ledgerEntry({
      action_type:   'incident_transitioned',
      operator_id:   opts.operator_id,
      justification: reason,
      extra: { incident_id: id, to_state: toState },
    });

    this._emitIncidentEvent(toState, { incident_id: id, reason, operator_id: opts.operator_id });

    return result;
  }

  /**
   * LINEARIZED transition via DB advisory lock. Use for critical state changes.
   * @param {object} pool      — pg.Pool
   * @param {string} id
   * @param {string} toState
   * @param {string} reason
   * @param {object} opts      — { operator_id }
   */
  async transitionStrong(pool, id, toState, reason, opts = {}) {
    this._requireInit();
    replayHooks.assertNotReplay('incidents.transitionStrong');

    const result = await this._incidentManager.transitionStrong(pool, id, toState, reason);

    this._ledgerEntry({
      action_type:   'incident_transitioned_strong',
      operator_id:   opts.operator_id,
      justification: reason,
      extra: { incident_id: id, to_state: toState, linearized: true },
    });

    this._emitIncidentEvent(toState, { incident_id: id, reason, operator_id: opts.operator_id });

    return result;
  }

  // ── Archive ───────────────────────────────────────────────────────────────

  /**
   * Archive a specific incident.
   * @param {string} id
   * @param {object} opts — { operator_id, justification }
   */
  async archive(id, opts = {}) {
    this._requireInit();
    replayHooks.assertNotReplay('incidents.archive');

    const result = await this._incidentManager.archive(id);

    this._ledgerEntry({
      action_type:   'incident_archived',
      operator_id:   opts.operator_id,
      justification: opts.justification ?? `Incident ${id} archived`,
      extra: { incident_id: id },
    });

    this._emit(this._BUS_EVENTS?.INCIDENT?.ARCHIVED ?? 'governance.incident.archived', {
      incident_id: id,
      operator_id: opts.operator_id ?? null,
      lineage_ts:  new Date().toISOString(),
    });

    return result;
  }

  /**
   * Archive all resolved incidents (batch housekeeping).
   * @param {object} pool — pg.Pool
   * @param {object} opts — { operator_id }
   */
  async archiveResolved(pool, opts = {}) {
    this._requireInit();
    replayHooks.assertNotReplay('incidents.archiveResolved');

    return this._incidentManager.archiveResolved(pool);
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  get(id) {
    this._requireInit();
    return this._incidentManager.get(id);
  }

  getActive() {
    this._requireInit();
    return this._incidentManager.getActive();
  }

  get STATES() {
    return this._incidentManager?.STATES ?? {};
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _emitIncidentEvent(toState, fields) {
    const stateEventMap = {
      TRIAGED:    this._BUS_EVENTS?.INCIDENT?.TRIAGED    ?? 'governance.incident.triaged',
      MITIGATING: this._BUS_EVENTS?.INCIDENT?.MITIGATING ?? 'governance.incident.mitigating',
      RESOLVED:   this._BUS_EVENTS?.INCIDENT?.RESOLVED   ?? 'governance.incident.resolved',
    };
    const eventType = stateEventMap[toState];
    if (eventType) {
      this._emit(eventType, { ...fields, lineage_ts: new Date().toISOString() });
    }
  }
}

module.exports = { GovernedIncidents };
