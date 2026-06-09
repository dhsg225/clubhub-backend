'use strict';
/**
 * incident-manager.js
 *
 * Coordinates severe runtime incidents into governed operational states.
 * Incident states: DETECTED → TRIAGED → MITIGATING → FROZEN → RECOVERING → RESOLVED → POSTMORTEM_REQUIRED
 *
 * ACTIVE/ACTIVE SAFE: transitionStrong() uses pg_advisory_xact_lock to
 * prevent two instances from concurrently transitioning the same incident.
 */

const crypto       = require('node:crypto');
const fs           = require('node:fs');
const path         = require('node:path');
const governanceDb = require('./governance-db');
const clock        = require('./clock');
const { withLineage }  = require('./lineage');
const { deriveDeterministicId } = require('./deterministic-id');

// ── Optimistic concurrency error ─────────────────────────────────────────────

class IncidentConcurrencyError extends Error {
  constructor(incident_id, expectedVersion) {
    super(`Incident '${incident_id}' was modified concurrently (expected version ${expectedVersion})`);
    this.name = 'IncidentConcurrencyError';
  }
}

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

const MAX_ACTIVE_INCIDENTS = 500; // resource governance: bounded active incident set

// TTL for resolved incidents before archival (ms)
const RESOLVED_INCIDENT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Content-addressed deterministic ID ───────────────────────────────────────

function _makeIncidentId(type, severity, causal_chain) {
  // DETERMINISTIC: do not include wall-clock timestamps in the hash input.
  // The same type+severity+causal_chain must always produce the same ID
  // across cluster instances and replay sessions.
  return deriveDeterministicId('inc', { type: type ?? '', severity: severity ?? '', causal_chain: causal_chain ?? [] });
}

// ── IncidentOrchestrator ──────────────────────────────────────────────────────

class IncidentOrchestrator {
  /**
   * @param {object} opts
   * @param {object}  opts.policyEngine     — policy-engine module (optional)
   * @param {object}  [opts.operatorLedger] — operator-ledger module
   * @param {object}  [opts.clusterConsensus] — cluster-consensus module
   * @param {object}  [opts.pool]           — pg pool (reserved for future persistence)
   */
  constructor(opts = {}) {
    this._policyEngine      = opts.policyEngine      ?? null;
    this._operatorLedger    = opts.operatorLedger    ?? null;
    this._clusterConsensus  = opts.clusterConsensus  ?? opts.fleetConsensus ?? null;
    this._pool              = opts.pool              ?? null;
    this._incidents         = new Map();
  }

  setPool(pool) {
    this._pool = pool;
  }

  // ── DB schema + init ────────────────────────────────────────────────────────

  async initFromDb(pool) {
    const p = pool || this._pool;
    if (!p) return;

    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS incidents (
          incident_id        VARCHAR(64) PRIMARY KEY,
          state              VARCHAR(32) NOT NULL,
          severity           VARCHAR(16) NOT NULL,
          title              TEXT,
          description        TEXT,
          causal_chain       JSONB DEFAULT '[]',
          created_at         TIMESTAMPTZ DEFAULT NOW(),
          updated_at         TIMESTAMPTZ DEFAULT NOW(),
          resolved_at        TIMESTAMPTZ,
          postmortem_required BOOLEAN DEFAULT FALSE,
          metadata           JSONB DEFAULT '{}',
          version            INT NOT NULL DEFAULT 0
        )
      `);
      // Add version column to existing tables (idempotent)
      await p.query(`
        ALTER TABLE incidents ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0
      `).catch(() => { /* non-fatal — column may already exist */ });

      await p.query(`
        CREATE TABLE IF NOT EXISTS incidents_archive (
          incident_id        VARCHAR(64) PRIMARY KEY,
          archived_at        TIMESTAMPTZ DEFAULT NOW(),
          state              VARCHAR(32),
          severity           VARCHAR(16),
          description        TEXT,
          causal_chain       JSONB DEFAULT '[]',
          created_at         TIMESTAMPTZ,
          resolved_at        TIMESTAMPTZ,
          metadata           JSONB DEFAULT '{}'
        )
      `);

      // Load active incidents
      const r = await p.query(
        `SELECT * FROM incidents WHERE state NOT IN ('RESOLVED', 'POSTMORTEM_REQUIRED')`
      );
      for (const row of r.rows) {
        if (!this._incidents.has(row.incident_id)) {
          this._incidents.set(row.incident_id, {
            incident_id:               row.incident_id,
            type:                      row.metadata?.type ?? 'UNKNOWN',
            severity:                  row.severity,
            description:               row.description,
            state:                     row.state,
            created_at:                row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
            updated_at:                row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
            causal_chain:              row.causal_chain ?? [],
            related_policy_decision_id: row.metadata?.related_policy_decision_id ?? null,
            root_cause:                row.metadata?.root_cause ?? null,
            linked_freeze:             row.metadata?.linked_freeze ?? false,
            linked_recovery_id:        row.metadata?.linked_recovery_id ?? null,
            policy_evaluations:        row.metadata?.policy_evaluations ?? [],
            state_history:             row.metadata?.state_history ?? [],
            resolution_summary:        row.metadata?.resolution_summary ?? null,
            postmortem_required:       row.postmortem_required ?? false,
          });
        }
      }
    } catch { /* non-fatal */ }
  }

  async persistIncident(pool, incident) {
    const p = pool || this._pool;
    if (!p) return;
    try {
      await p.query(
        `INSERT INTO incidents
           (incident_id, state, severity, description, causal_chain, created_at, updated_at,
            postmortem_required, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (incident_id) DO UPDATE SET
           state               = $2,
           severity            = $3,
           description         = $4,
           causal_chain        = $5,
           updated_at          = $7,
           postmortem_required = $8,
           metadata            = $9`,
        [
          incident.incident_id,
          incident.state,
          incident.severity,
          incident.description,
          JSON.stringify(incident.causal_chain ?? []),
          incident.created_at,
          incident.updated_at,
          incident.postmortem_required ?? false,
          JSON.stringify({
            type:                       incident.type,
            related_policy_decision_id: incident.related_policy_decision_id,
            root_cause:                 incident.root_cause,
            linked_freeze:              incident.linked_freeze,
            linked_recovery_id:         incident.linked_recovery_id,
            policy_evaluations:         incident.policy_evaluations,
            state_history:              incident.state_history,
            resolution_summary:         incident.resolution_summary,
          }),
        ]
      );
    } catch { /* fire-and-forget: non-fatal */ }
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

    // Resource governance: evict oldest resolved incidents if at capacity
    if (this._incidents.size >= MAX_ACTIVE_INCIDENTS) {
      for (const [id, inc] of this._incidents) {
        if (inc.state === 'RESOLVED' || inc.state === 'POSTMORTEM_REQUIRED') {
          this._incidents.delete(id);
          if (this._incidents.size < MAX_ACTIVE_INCIDENTS) break;
        }
      }
    }

    const incident_id = _makeIncidentId(type, severity, causal_chain);
    const now         = clock.nowIso();

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

    // Fire-and-forget DB persist
    if (this._pool) {
      this.persistIncident(this._pool, incident).catch(() => {});
    }

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
    const legal = LEGAL_TRANSITIONS[incident.state];

    if (!legal) throw new Error(`Unknown incident state: ${incident.state}`);
    if (!legal.includes(toState)) {
      throw new Error(
        `Illegal transition ${incident.state} → ${toState} for incident ${incident.incident_id}. ` +
        `Legal targets: [${legal.join(', ')}]`
      );
    }

    const { operator_id, justification, evidence } = opts;
    const now = clock.nowIso();

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

    // Fire-and-forget DB persist
    if (this._pool) {
      this.persistIncident(this._pool, incident).catch(() => {});
    }

    return { ...incident };
  }

  /**
   * Transition an incident with cluster-wide serialization guarantee.
   *
   * ACTIVE/ACTIVE SAFE: acquires pg_advisory_xact_lock on the incident_id
   * so two instances cannot simultaneously transition the same incident.
   * Uses optimistic locking (version column) as a secondary safety net —
   * if another instance somehow bypassed the advisory lock, the version
   * check will catch the conflict.
   *
   * @param {object} pool         — pg Pool
   * @param {string} incident_id  — incident to transition
   * @param {string} toState      — target state
   * @param {object} [opts]       — same as transition()
   * @throws {IncidentConcurrencyError} if another instance concurrently modified the incident
   */
  async transitionStrong(pool, incident_id, toState, opts = {}) {
    const p = pool || this._pool;
    if (!p) {
      // No DB — fall back to in-memory transition (non-serialized)
      return this.transition(incident_id, toState, opts);
    }

    return governanceDb.withAdvisoryLock(p, `incident:${incident_id}`, async (client) => {
      // Re-read state from DB as the authoritative source
      const r = await client.query(
        'SELECT state, version FROM incidents WHERE incident_id = $1',
        [incident_id]
      );

      if (!r.rows.length) {
        // Not in DB yet — fall through to in-memory only (incident was just created)
        return this.transition(incident_id, toState, opts);
      }

      const dbState   = r.rows[0].state;
      const dbVersion = r.rows[0].version ?? 0;
      const legal     = LEGAL_TRANSITIONS[dbState];

      if (!legal) throw new Error(`Unknown incident state in DB: ${dbState}`);
      if (!legal.includes(toState)) {
        throw new Error(
          `Illegal transition ${dbState} → ${toState} for incident ${incident_id}. ` +
          `Legal targets: [${legal.join(', ')}]`
        );
      }

      // Optimistic version lock — catches any concurrent bypass
      const updated = await client.query(
        `UPDATE incidents SET state = $2, version = version + 1, updated_at = NOW()
         WHERE incident_id = $1 AND version = $3
         RETURNING version`,
        [incident_id, toState, dbVersion]
      );

      if (!updated.rows.length) {
        throw new IncidentConcurrencyError(incident_id, dbVersion);
      }

      // Sync in-memory state to match DB
      const incident = this._incidents.get(incident_id);
      if (incident) {
        incident.state      = toState;
        incident.updated_at = new Date().toISOString();
        if (toState === INCIDENT_STATES.FROZEN) incident.linked_freeze = true;
      }

      return this.getIncident(incident_id) ?? { incident_id, state: toState };
    });
  }

  async archiveResolvedIncidents(pool) {
    const p = pool || this._pool;
    if (!p) return 0;
    try {
      // Move resolved/postmortem incidents older than TTL to archive
      const r = await p.query(`
        WITH moved AS (
          DELETE FROM incidents
          WHERE state IN ('RESOLVED', 'POSTMORTEM_REQUIRED')
            AND updated_at < NOW() - INTERVAL '7 days'
          RETURNING *
        )
        INSERT INTO incidents_archive
          (incident_id, state, severity, description, causal_chain, created_at, resolved_at, metadata)
        SELECT incident_id, state, severity, description, causal_chain, created_at, updated_at, metadata
        FROM moved
        RETURNING incident_id
      `);
      // Evict archived incidents from in-memory map
      for (const row of r.rows) {
        this._incidents.delete(row.incident_id);
      }
      return r.rows.length;
    } catch {
      return 0;
    }
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

// ── Module-level singleton instance ──────────────────────────────────────────

const _defaultInstance = new IncidentOrchestrator();

async function initFromDb(pool) {
  return _defaultInstance.initFromDb(pool);
}

function createIncident(type, severity, causal_chain) {
  return _defaultInstance.createIncident({ type, severity, causal_chain });
}

function transition(id, toState, reason) {
  return _defaultInstance.transition(id, toState, { justification: reason });
}

async function transitionStrong(pool, id, toState, reason) {
  return _defaultInstance.transitionStrong(pool, id, toState, { justification: reason });
}

function getIncident(id) {
  return _defaultInstance.getIncident(id);
}

function getActiveIncidents() {
  return _defaultInstance.getActiveIncidents();
}

async function archiveIncident(id) {
  // Transition to RESOLVED if not already terminal
  const inc = _defaultInstance.getIncident(id);
  if (!inc) return null;
  if (inc.state !== 'RESOLVED' && inc.state !== 'POSTMORTEM_REQUIRED') {
    try { _defaultInstance.transition(id, 'RESOLVED', { justification: 'manual_archive' }); } catch { /* skip */ }
  }
  return inc;
}

async function archiveResolvedIncidents(pool) {
  return _defaultInstance.archiveResolvedIncidents(pool);
}

module.exports = {
  IncidentOrchestrator,
  INCIDENT_STATES,
  LEGAL_TRANSITIONS,
  IncidentConcurrencyError,
  MAX_ACTIVE_INCIDENTS,
  // Module-level API (default instance)
  initFromDb,
  createIncident,
  transition,
  transitionStrong,
  getIncident,
  getActiveIncidents,
  archiveIncident,
  archiveResolvedIncidents,
};
