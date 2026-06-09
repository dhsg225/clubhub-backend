'use strict';
/**
 * event-lineage.js — Governed event causality tracking.
 *
 * Every operationally meaningful event emitted by governed modules should carry:
 *   correlation_id       — ties events belonging to the same logical operation
 *   caused_by            — event_id or action_id of the parent event
 *   authority_epoch      — fleet consensus epoch at time of emission
 *   manifest_generation  — fleet consensus generation at time of emission
 *   incident_id          — active incident (optional)
 *   policy_decision_id   — policy decision that caused this event (optional)
 *   recovery_id          — active recovery operation (optional)
 *
 * The lineage verifier detects:
 *   - ORPHANED_EVENT          — caused_by references an event that does not exist
 *   - BROKEN_CAUSAL_CHAIN     — causal chain contains a gap (skipped parent)
 *   - CROSS_INCIDENT_CONTAMINATION — event references an incident_id that differs from its parent
 *   - MISSING_AUTHORITY_CONTEXT   — governed event emitted without authority_epoch
 *   - DUPLICATE_CORRELATION       — two unrelated events share the same correlation_id
 *
 * Usage:
 *   const { withLineage, verifyLineage, exportLineage } = require('./event-lineage');
 *
 *   // Add lineage fields to an outgoing event:
 *   emit(EVENTS.OTA.RING_PROMOTED, req, withLineage({
 *     update_id: ...,
 *   }, {
 *     correlation_id:      req.requestId,
 *     caused_by:           policy_decision.policy_id,
 *     authority_epoch:     fleetConsensus.getEpoch(),
 *     manifest_generation: fleetConsensus.getManifestGeneration(),
 *     policy_decision_id:  policy_decision.policy_id,
 *   }));
 */

const fs   = require('node:fs');
const path = require('node:path');
const clock = require('./governed-clock');

// ── Lineage anomaly types ──────────────────────────────────────────────────────

const LINEAGE_ANOMALY = Object.freeze({
  ORPHANED_EVENT:              'ORPHANED_EVENT',
  BROKEN_CAUSAL_CHAIN:         'BROKEN_CAUSAL_CHAIN',
  CROSS_INCIDENT_CONTAMINATION: 'CROSS_INCIDENT_CONTAMINATION',
  MISSING_AUTHORITY_CONTEXT:   'MISSING_AUTHORITY_CONTEXT',
  DUPLICATE_CORRELATION:       'DUPLICATE_CORRELATION',
});

const LINEAGE_MODES = Object.freeze({
  STRICT: 'STRICT',   // throw on any anomaly
  REPORT: 'REPORT',   // return result (default, current behaviour)
  REPLAY: 'REPLAY',   // skip ORPHANED_EVENT (parents may not be in replay window)
});

// ── Lineage registry ──────────────────────────────────────────────────────────

// Module-level registry of lineage-annotated events.
// Only events enriched via withLineage() are tracked here.
const _events    = [];
const MAX_EVENTS = 2000;

// ── withLineage ───────────────────────────────────────────────────────────────

/**
 * Merge lineage context into an event payload.
 * Does not mutate the original fields object.
 *
 * @param {object} eventFields   — event-specific payload
 * @param {object} lineageCtx
 *   correlation_id      {string}         — logical operation ID (e.g. req.requestId)
 *   caused_by           {string|null}    — parent event/action ID
 *   authority_epoch     {number}         — current fleet authority epoch
 *   manifest_generation {number}         — current manifest generation
 *   incident_id         {string|null}    — active incident (optional)
 *   policy_decision_id  {string|null}    — policy decision that triggered this (optional)
 *   recovery_id         {string|null}    — active recovery operation (optional)
 * @returns {object} merged payload with lineage fields
 */
function withLineage(eventFields, lineageCtx = {}) {
  const enriched = {
    ...eventFields,
    correlation_id:      lineageCtx.correlation_id      ?? null,
    caused_by:           lineageCtx.caused_by            ?? null,
    authority_epoch:     lineageCtx.authority_epoch      ?? null,
    manifest_generation: lineageCtx.manifest_generation  ?? null,
    incident_id:         lineageCtx.incident_id          ?? null,
    policy_decision_id:  lineageCtx.policy_decision_id   ?? null,
    recovery_id:         lineageCtx.recovery_id          ?? null,
    lineage_ts:          clock.nowIso(),
  };

  // Register in module-level registry for post-hoc verification
  _events.push(enriched);
  if (_events.length > MAX_EVENTS) _events.shift();

  return enriched;
}

// ── verifyLineage ─────────────────────────────────────────────────────────────

/**
 * Verify causal integrity across a set of lineage-annotated events.
 *
 * @param {object[]} [events]  — defaults to the internal registry
 * @returns {{ valid: boolean, anomalies: object[], orphaned: string[], summary: object }}
 */
function verifyLineage(events, { mode = LINEAGE_MODES.REPORT } = {}) {
  const evts = events ?? _events;
  if (!evts || evts.length === 0) {
    return { valid: true, anomalies: [], orphaned: [], summary: { total: 0, anomaly_count: 0 } };
  }

  const anomalies = [];

  // Index events by correlation_id and caused_by
  const correlationGroups = new Map(); // correlation_id → [events]
  const causeIndex        = new Set(); // all correlation_ids + caused_by values present

  for (const evt of evts) {
    if (evt.correlation_id) {
      if (!correlationGroups.has(evt.correlation_id)) {
        correlationGroups.set(evt.correlation_id, []);
      }
      correlationGroups.get(evt.correlation_id).push(evt);
      causeIndex.add(evt.correlation_id);
    }
  }

  const orphanedIds = [];

  for (const evt of evts) {
    // MISSING_AUTHORITY_CONTEXT: governed event has no authority_epoch
    if (evt.authority_epoch === null && evt.caused_by !== null) {
      anomalies.push({
        type:    LINEAGE_ANOMALY.MISSING_AUTHORITY_CONTEXT,
        event:   { correlation_id: evt.correlation_id, caused_by: evt.caused_by },
        message: 'Governed event emitted without authority_epoch',
      });
    }

    // ORPHANED_EVENT: caused_by references a correlation_id not in the event set
    if (evt.caused_by && !causeIndex.has(evt.caused_by)) {
      orphanedIds.push(evt.correlation_id ?? '(unknown)');
      anomalies.push({
        type:        LINEAGE_ANOMALY.ORPHANED_EVENT,
        event:       { correlation_id: evt.correlation_id, caused_by: evt.caused_by },
        missing_parent: evt.caused_by,
        message:     `Event references parent '${evt.caused_by}' which is not present in the lineage set`,
      });
    }

    // CROSS_INCIDENT_CONTAMINATION: event's incident_id differs from parent's incident_id
    if (evt.caused_by && evt.incident_id) {
      const parentGroups = correlationGroups.get(evt.caused_by);
      if (parentGroups) {
        for (const parent of parentGroups) {
          if (parent.incident_id && parent.incident_id !== evt.incident_id) {
            anomalies.push({
              type:            LINEAGE_ANOMALY.CROSS_INCIDENT_CONTAMINATION,
              event:           { correlation_id: evt.correlation_id, incident_id: evt.incident_id },
              parent:          { correlation_id: parent.correlation_id, incident_id: parent.incident_id },
              message:         `Event incident_id '${evt.incident_id}' differs from parent incident_id '${parent.incident_id}'`,
            });
          }
        }
      }
    }
  }

  // DUPLICATE_CORRELATION: two events in different causal branches share same correlation_id
  // (same correlation_id with different caused_by parents is a fork)
  for (const [corrId, group] of correlationGroups) {
    const parents = new Set(group.map(e => e.caused_by).filter(Boolean));
    if (parents.size > 1) {
      anomalies.push({
        type:           LINEAGE_ANOMALY.DUPLICATE_CORRELATION,
        correlation_id: corrId,
        parent_count:   parents.size,
        parents:        [...parents],
        message:        `correlation_id '${corrId}' appears with ${parents.size} distinct caused_by parents — forked lineage`,
      });
    }
  }

  const filteredAnomalies = mode === LINEAGE_MODES.REPLAY
    ? anomalies.filter(a => a.type !== LINEAGE_ANOMALY.ORPHANED_EVENT)
    : anomalies;

  if (mode === LINEAGE_MODES.STRICT && filteredAnomalies.length > 0) {
    throw new Error(
      `verifyLineage STRICT: ${filteredAnomalies.length} lineage anomaly(ies) — ` +
      `[${filteredAnomalies.map(a => a.type).join(', ')}]`
    );
  }
  const valid = filteredAnomalies.length === 0;
  return {
    valid,
    anomalies:  filteredAnomalies,
    orphaned:   orphanedIds,
    summary: {
      total:         evts.length,
      anomaly_count: filteredAnomalies.length,
      orphaned:      orphanedIds.length,
      by_type:       _countByType(filteredAnomalies),
    },
  };
}

function _countByType(anomalies) {
  const counts = {};
  for (const a of anomalies) {
    counts[a.type] = (counts[a.type] ?? 0) + 1;
  }
  return counts;
}

// ── exportLineage ─────────────────────────────────────────────────────────────

/**
 * Verify the internal event registry and write reports/event-lineage.json.
 *
 * @param {string} reportsDir
 * @returns {{ report_path: string, result: object }}
 */
function exportLineage(reportsDir) {
  const result = verifyLineage();
  const report = {
    generated_at: new Date().toISOString(),
    event_count:  _events.length,
    ...result,
    events:       _events.slice(-200),  // last 200 for inspection
  };

  try {
    fs.mkdirSync(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, 'event-lineage.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    return { report_path: reportPath, result };
  } catch (err) {
    return { report_path: null, result, error: err.message };
  }
}

// ── Reset (test infrastructure) ───────────────────────────────────────────────
function _reset() {
  _events.length = 0;
}

module.exports = {
  LINEAGE_ANOMALY,
  LINEAGE_MODES,
  withLineage,
  verifyLineage,
  exportLineage,
  _reset,  // test use only
};
