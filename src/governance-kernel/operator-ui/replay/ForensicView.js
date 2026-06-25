'use strict';

/**
 * ForensicView — forensic overlay model for post-incident analysis.
 *
 * FORENSIC mode: the clock is NOT frozen. Historical events are viewed
 * alongside current live state. The analyst sees "what happened then" vs "what is now".
 *
 * From REPLAY_CONTRACT.md §9:
 *   - Clock is NOT frozen in forensic mode
 *   - Events are read without time manipulation
 *   - Analyst sees original event data alongside current live state
 *   - FORENSIC mode is a convention, not an enforcement (v1)
 *
 * ForensicView manages the overlay model:
 *   - incident causal chain reconstruction
 *   - operator action timeline for a given incident
 *   - before/after state comparison
 *   - lineage anomaly surface
 *
 * UI_AUTHORITY_BOUNDARY: Pure data model. No kernel imports.
 */

class ForensicView {
  constructor(opts = {}) {
    this._timeline = opts.timeline || null; // ReplayTimeline instance
    this._incidentId = opts.incidentId || null;
    this._currentLiveState = null;         // injected from GovernedStateStore
  }

  // ─── Live state injection ─────────────────────────────────────────────────

  setCurrentLiveState(storeState) {
    this._currentLiveState = storeState;
  }

  // ─── Incident forensic analysis ───────────────────────────────────────────

  /**
   * Build a forensic report for a specific incident.
   * Returns: timeline of events causally related to the incident,
   * annotated with before/after state changes.
   */
  buildIncidentReport(incidentId, allEvents) {
    if (!allEvents || !Array.isArray(allEvents)) return null;

    // Collect all events related to this incident
    const incidentEvents = allEvents.filter(e =>
      e.incident_id === incidentId ||
      e.correlation_id === incidentId ||
      (e.causal_chain && e.causal_chain.includes(incidentId))
    );

    // Find the incident creation event
    const creation = incidentEvents.find(e =>
      (e.event_type || '').includes('incident.created') && e.incident_id === incidentId
    );

    // Build causal chain (events that caused or are caused by this incident)
    const causalChain = this._buildCausalChain(incidentId, allEvents);

    // Find freeze events that coincide with or follow the incident
    const incidentTs = creation?.lineage_ts;
    const relatedFreezes = allEvents.filter(e =>
      (e.event_type || '').includes('freeze') &&
      e.lineage_ts >= (incidentTs || '') &&
      e.lineage_ts <= (this._getResolutionTs(incidentId, allEvents) || '9999')
    );

    // Operator actions during the incident
    const operatorActions = allEvents.filter(e =>
      e.operator_id &&
      e.lineage_ts >= (incidentTs || '') &&
      e.lineage_ts <= (this._getResolutionTs(incidentId, allEvents) || '9999')
    );

    // Lineage anomalies (from verifyLineage — if available in events)
    const anomalies = allEvents
      .filter(e => e.anomaly_type && e.incident_id === incidentId)
      .map(e => ({ anomaly_type: e.anomaly_type, lineage_ts: e.lineage_ts, detail: e.detail }));

    return {
      incident_id: incidentId,
      creation_ts: incidentTs ?? null,
      resolution_ts: this._getResolutionTs(incidentId, allEvents),
      incident_events: incidentEvents,
      causal_chain: causalChain,
      related_freezes: relatedFreezes,
      operator_actions: operatorActions,
      lineage_anomalies: anomalies,
      total_duration_ms: this._getDurationMs(incidentTs, this._getResolutionTs(incidentId, allEvents)),
      current_live_state: this._currentLiveState
        ? this._extractCurrentIncidentState(incidentId)
        : null,
    };
  }

  /**
   * Compare state at two points in time.
   * Returns diff of freeze, epoch, config between "then" and "now".
   */
  buildBeforeAfterComparison(historicalTs, currentLiveState) {
    if (!this._timeline) return null;

    this._timeline.seekTo(historicalTs);
    const historicalEvents = this._timeline.getConsumedEvents();

    const then = this._reconstructStateAtCursor(historicalEvents);
    const now = this._summarizeLiveState(currentLiveState);

    return {
      historical_ts: historicalTs,
      current_ts: new Date().toISOString(),
      then,
      now,
      diffs: this._computeDiffs(then, now),
    };
  }

  // ─── Causal chain ─────────────────────────────────────────────────────────

  _buildCausalChain(incidentId, allEvents) {
    // Walk caused_by links
    const chain = [];
    const visited = new Set();
    let currentId = incidentId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const event = allEvents.find(e => e.incident_id === currentId || e.event_id === currentId);
      if (!event) break;
      chain.unshift({ id: currentId, event_type: event.event_type, lineage_ts: event.lineage_ts });
      currentId = event.caused_by ?? null;
    }

    return chain;
  }

  _getResolutionTs(incidentId, allEvents) {
    const resolved = allEvents.find(e =>
      e.incident_id === incidentId &&
      (e.event_type || '').includes('incident.transitioned') &&
      (e.to_state === 'RESOLVED' || e.to_state === 'POSTMORTEM_REQUIRED')
    );
    return resolved?.lineage_ts ?? null;
  }

  _getDurationMs(startTs, endTs) {
    if (!startTs || !endTs) return null;
    return new Date(endTs).getTime() - new Date(startTs).getTime();
  }

  _extractCurrentIncidentState(incidentId) {
    if (!this._currentLiveState?.incidents?.value?.items) return null;
    return this._currentLiveState.incidents.value.items[incidentId] ?? null;
  }

  _reconstructStateAtCursor(events) {
    const freeze = { frozen: false };
    let epoch = 0;
    let configHash = null;

    for (const e of events) {
      const type = e.event_type || '';
      if (type.includes('freeze_confirmed')) { freeze.frozen = true; freeze.reason = e.reason; }
      if (type.includes('unfreeze')) { freeze.frozen = false; }
      if (type.includes('epoch_advanced')) { epoch = e.epoch; }
      if (type.includes('config.updated')) { configHash = e.config_hash; }
    }
    return { freeze, epoch, config_hash: configHash };
  }

  _summarizeLiveState(liveState) {
    if (!liveState) return null;
    return {
      freeze: { frozen: liveState.freeze?.value?.frozen ?? null },
      epoch: liveState.epoch?.value?.value ?? null,
      config_hash: liveState.config?.value?.config_hash ?? null,
    };
  }

  _computeDiffs(then, now) {
    const diffs = [];
    if (then.freeze?.frozen !== now.freeze?.frozen) {
      diffs.push({ field: 'freeze.frozen', then: then.freeze?.frozen, now: now.freeze?.frozen });
    }
    if (then.epoch !== now.epoch) {
      diffs.push({ field: 'epoch', then: then.epoch, now: now.epoch });
    }
    if (then.config_hash !== now.config_hash) {
      diffs.push({ field: 'config_hash', then: then.config_hash, now: now.config_hash });
    }
    return diffs;
  }
}

module.exports = { ForensicView };
