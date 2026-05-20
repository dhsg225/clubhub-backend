'use strict';
/**
 * incident-orchestrator.js
 *
 * Coordinates severe runtime incidents into governed operational states.
 * Incident states: DETECTED → TRIAGED → MITIGATING → FROZEN → RECOVERING → RESOLVED → POSTMORTEM_REQUIRED
 */

const fs   = require('node:fs');
const path = require('node:path');

// ── Incident states ───────────────────────────────────────────────────────────

const INCIDENT_STATES = Object.freeze({
  DETECTED:             'DETECTED',
  TRIAGED:              'TRIAGED',
  MITIGATING:           'MITIGATING',
  FROZEN:               'FROZEN',
  RECOVERING:           'RECOVERING',
  RESOLVED:             'RESOLVED',
  POSTMORTEM_REQUIRED:  'POSTMORTEM_REQUIRED',
});

// Legal transitions
const LEGAL_TRANSITIONS = {
  DETECTED:    ['TRIAGED', 'POSTMORTEM_REQUIRED'],
  TRIAGED:     ['MITIGATING', 'FROZEN', 'POSTMORTEM_REQUIRED'],
  MITIGATING:  ['FROZEN', 'RECOVERING', 'RESOLVED', 'POSTMORTEM_REQUIRED'],
  FROZEN:      ['RECOVERING', 'POSTMORTEM_REQUIRED'],
  RECOVERING:  ['RESOLVED', 'POSTMORTEM_REQUIRED'],
  RESOLVED:    ['POSTMORTEM_REQUIRED'],
  POSTMORTEM_REQUIRED: [],
};

const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// ── Sequential ID ─────────────────────────────────────────────────────────────

let _incidentSeq = 0;
function nextIncidentId() {
  _incidentSeq += 1;
  return 'inc-' + _incidentSeq.toString(16).padStart(6, '0');
}

// ── IncidentOrchestrator ──────────────────────────────────────────────────────

class IncidentOrchestrator {
  /**
   * @param {object} opts
   * @param {object}  opts.policyEngine     — policy-engine module (required)
   * @param {object}  [opts.operatorLedger] — operator-ledger module
   * @param {object}  [opts.fleetConsensus] — fleet-consensus module
   * @param {object}  [opts.pool]           — pg pool (reserved for future persistence)
   */
  constructor(opts = {}) {
    this._policyEngine    = opts.policyEngine    ?? null;
    this._operatorLedger  = opts.operatorLedger  ?? null;
    this._fleetConsensus  = opts.fleetConsensus  ?? null;
    this._pool            = opts.pool            ?? null;
    this._incidents       = new Map();
  }

  /**
   * Create a new incident record.
   * Automatically transitions to TRIAGED if severity >= HIGH.
   */
  createIncident(opts = {}) {
    const {
      type,
      severity = 'MEDIUM',
      description,
      causal_chain,
      related_policy_decision_id,
      root_cause,
    } = opts;

    if (!SEVERITY_LEVELS.includes(severity)) {
      throw new Error(`Invalid severity '${severity}'. Must be one of: ${SEVERITY_LEVELS.join(', ')}`);
    }

    // Evaluate creation via policy engine if available
    let policyEvalId = null;
    if (this._policyEngine) {
      try {
        const pd = this._policyEngine.evaluatePolicy('operator_override', {
          action:        'create_incident',
          justification: description ?? 'incident_auto_created',
          operatorId:    'system',
        });
        policyEvalId = pd.policy_id;
      } catch { /* non-fatal */ }
    }

    const incident_id = nextIncidentId();
    const now         = new Date().toISOString();

    const incident = {
      incident_id,
      type:                     type      ?? 'UNKNOWN',
      severity,
      description:              description ?? null,
      state:                    INCIDENT_STATES.DETECTED,
      created_at:               now,
      updated_at:               now,
      causal_chain:             causal_chain ?? [],
      related_policy_decision_id: related_policy_decision_id ?? null,
      root_cause:               root_cause ?? null,
      linked_freeze:            false,
      linked_recovery_id:       null,
      policy_evaluations:       policyEvalId ? [policyEvalId] : [],
      state_history:            [{
        from:         null,
        to:           INCIDENT_STATES.DETECTED,
        at:           now,
        operator_id:  'system',
        justification: 'incident_created',
      }],
      resolution_summary:   null,
      postmortem_required:  false,
    };

    this._incidents.set(incident_id, incident);

    // Auto-triage HIGH and CRITICAL incidents
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      this._applyTransition(incident, INCIDENT_STATES.TRIAGED, {
        operator_id:   'system',
        justification: `auto_triaged_severity_${severity}`,
      });
    }

    return { ...incident };
  }

  /**
   * Transition an incident to a new state.
   * @throws if transition is illegal or incident not found
   */
  transition(incident_id, toState, opts = {}) {
    const incident = this._incidents.get(incident_id);
    if (!incident) throw new Error(`Incident '${incident_id}' not found`);

    return this._applyTransition(incident, toState, opts);
  }

  _applyTransition(incident, toState, opts = {}) {
    const { fromState } = { fromState: incident.state };
    const legal = LEGAL_TRANSITIONS[incident.state];

    if (!legal) throw new Error(`Unknown incident state: ${incident.state}`);
    if (!legal.includes(toState)) {
      throw new Error(
        `Illegal transition ${incident.state} → ${toState} for incident ${incident.incident_id}. ` +
        `Legal targets: [${legal.join(', ')}]`
      );
    }

    const { operator_id, justification, evidence } = opts;
    const now = new Date().toISOString();

    incident.state_history.push({
      from:         incident.state,
      to:           toState,
      at:           now,
      operator_id:  operator_id  ?? null,
      justification: justification ?? null,
      evidence:     evidence      ?? null,
    });

    incident.state      = toState;
    incident.updated_at = now;

    if (toState === INCIDENT_STATES.FROZEN) {
      incident.linked_freeze = true;
    }

    // Append ledger entry if available
    if (this._operatorLedger && operator_id) {
      try {
        this._operatorLedger.appendEntry({
          operator_id,
          action_type:      'rollout_freeze',
          justification:    justification ?? `transition_to_${toState}`,
          related_incident: incident.incident_id,
        });
      } catch { /* non-fatal */ }
    }

    return { ...incident };
  }

  getIncident(incident_id) {
    const incident = this._incidents.get(incident_id);
    return incident ? { ...incident } : null;
  }

  /**
   * Resolve an incident.
   */
  resolveIncident(incident_id, opts = {}) {
    const incident = this._incidents.get(incident_id);
    if (!incident) throw new Error(`Incident '${incident_id}' not found`);

    const { operator_id, resolution_summary, postmortem_required } = opts;

    const toState = postmortem_required
      ? INCIDENT_STATES.POSTMORTEM_REQUIRED
      : INCIDENT_STATES.RESOLVED;

    const result = this._applyTransition(incident, toState, {
      operator_id,
      justification: resolution_summary ?? 'incident_resolved',
    });

    incident.resolution_summary  = resolution_summary ?? null;
    incident.postmortem_required = !!postmortem_required;

    return result;
  }

  getActiveIncidents() {
    const terminal = new Set([INCIDENT_STATES.RESOLVED, INCIDENT_STATES.POSTMORTEM_REQUIRED]);
    return [...this._incidents.values()]
      .filter(i => !terminal.has(i.state))
      .map(i => ({ ...i }));
  }

  getReport() {
    const incidents = [...this._incidents.values()].map(i => ({ ...i }));
    return {
      generated_at:    new Date().toISOString(),
      total:           incidents.length,
      active:          this.getActiveIncidents().length,
      by_severity:     Object.fromEntries(
        SEVERITY_LEVELS.map(s => [s, incidents.filter(i => i.severity === s).length])
      ),
      by_state:        Object.fromEntries(
        Object.keys(INCIDENT_STATES).map(st => [st, incidents.filter(i => i.state === st).length])
      ),
      incidents,
    };
  }

  saveReport(dir) {
    const targetDir = dir ?? path.join(process.cwd(), 'reports');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, 'live-incidents.json'),
      JSON.stringify(this.getReport(), null, 2)
    );
  }
}

module.exports = { IncidentOrchestrator, INCIDENT_STATES, LEGAL_TRANSITIONS };
