'use strict';

/**
 * reducers.js — Named reducer functions for GovernedStateStore event types.
 *
 * These are pure functions invoked by GovernedStateStore._reduceEvent().
 * They translate raw governance kernel events into store slice updates.
 *
 * Reducers must:
 *   - be pure (no side effects)
 *   - preserve all existing slice fields not affected by the event
 *   - declare the consistency_level appropriate for each event type
 *   - never invent authority_epoch or lineage_ts
 */

'use strict';

// ─── Freeze reducers ──────────────────────────────────────────────────────────

function reduceFreezeConfirmed(currentValue, event) {
  return {
    ...(currentValue || {}),
    frozen: true,
    reason: event.reason,
    freeze_epoch: event.freeze_epoch,
    confirmed_at: event.lineage_ts,
    operator_id: event.operator_id ?? null,
  };
}

function reduceFreezeLocal(currentValue, event) {
  return {
    ...(currentValue || {}),
    frozen: true,
    reason: event.reason,
    freeze_epoch: event.freeze_epoch ?? null,
    confirmed_at: event.lineage_ts,
    local_only: true,
  };
}

function reduceUnfreeze(currentValue, event) {
  return {
    ...(currentValue || {}),
    frozen: false,
    unfreeze_reason: event.reason,
    unfrozen_at: event.lineage_ts,
    operator_id: event.operator_id ?? null,
    local_only: false,
  };
}

// ─── Incident reducers ────────────────────────────────────────────────────────

function reduceIncidentCreated(currentItems, event) {
  return {
    ...currentItems,
    [event.incident_id]: {
      id: event.incident_id,
      type: event.incident_type,
      severity: event.severity,
      state: 'DETECTED',
      causal_chain: event.causal_chain ?? null,
      correlation_id: event.correlation_id ?? null,
      created_at: event.lineage_ts,
      transitions: [],
    },
  };
}

function reduceIncidentTransitioned(currentItems, event) {
  const existing = currentItems[event.incident_id];
  if (!existing) return currentItems;
  return {
    ...currentItems,
    [event.incident_id]: {
      ...existing,
      state: event.to_state,
      transitions: [
        ...(existing.transitions || []),
        { from: event.from_state, to: event.to_state, reason: event.reason, at: event.lineage_ts },
      ],
    },
  };
}

function reduceIncidentArchived(currentItems, event) {
  const updated = { ...currentItems };
  for (const id of (event.archived_ids || [])) {
    if (updated[id]) {
      updated[id] = { ...updated[id], archived: true, archived_at: event.lineage_ts };
    }
  }
  return updated;
}

// ─── Epoch / authority reducers ───────────────────────────────────────────────

function reduceEpochAdvanced(currentValue, event) {
  return { value: event.epoch };
}

// ─── Config reducers ──────────────────────────────────────────────────────────

function reduceConfigUpdated(currentValue, event) {
  return {
    ...(currentValue || {}),
    config_hash: event.config_hash,
    version: event.version,
    updated_at: event.lineage_ts,
    updated_by: event.operator_id ?? null,
  };
}

// ─── Cluster / topology reducers ──────────────────────────────────────────────

function reduceNodeHeartbeat(currentValue, event) {
  const nodes = { ...((currentValue || {}).nodes_map || {}) };
  nodes[event.node_id] = {
    id: event.node_id,
    last_seen: event.lineage_ts,
    freeze_epoch: event.freeze_epoch ?? null,
    status: event.status ?? 'HEALTHY',
    ...event.fields,
  };
  return { ...(currentValue || {}), nodes_map: nodes };
}

function reduceNodeEvicted(currentValue, event) {
  const nodes = { ...((currentValue || {}).nodes_map || {}) };
  delete nodes[event.node_id];
  return { ...(currentValue || {}), nodes_map: nodes };
}

// ─── Plugin reducers ──────────────────────────────────────────────────────────

function reducePluginRegistered(currentValue, event) {
  const plugins = { ...((currentValue || {}).plugins || {}) };
  plugins[event.plugin_name] = {
    name: event.plugin_name,
    version: event.version,
    registered_at: event.lineage_ts,
    bypass_governance: false,
    status: 'REGISTERED',
  };
  return { plugins };
}

function reducePluginRejected(currentValue, event) {
  const plugins = { ...((currentValue || {}).plugins || {}) };
  plugins[event.plugin_name] = {
    name: event.plugin_name,
    rejection_reason: event.rejection_reason,
    rejected_at: event.lineage_ts,
    status: 'REJECTED',
  };
  return { plugins };
}

// ─── Operator reducers ────────────────────────────────────────────────────────

function reduceTokenRevoked(currentValue, event) {
  const revoked = new Set((currentValue || {}).revoked_jtis || []);
  revoked.add(event.jti);
  return { ...currentValue, revoked_jtis: [...revoked] };
}

// ─── Dispatch table ───────────────────────────────────────────────────────────

/**
 * Maps event_type patterns to { slice, reducer, consistency_level }.
 * Used by GovernedStateStore._reduceEvent().
 */
const EVENT_REDUCERS = {
  'governance.kernel.freeze_confirmed': {
    slice: 'freeze',
    reducer: reduceFreezeConfirmed,
    consistency_level: 'LINEARIZED',
  },
  'governance.kernel.freeze_local': {
    slice: 'freeze',
    reducer: reduceFreezeLocal,
    consistency_level: 'MEMORY_ONLY',
  },
  'governance.kernel.unfreeze': {
    slice: 'freeze',
    reducer: reduceUnfreeze,
    consistency_level: 'MEMORY_ONLY',
  },
  'governance.incident.created': {
    slice: 'incidents',
    reducer: (currentSlice, event) => ({
      items: reduceIncidentCreated((currentSlice?.items || {}), event),
    }),
    consistency_level: 'MEMORY_ONLY',
  },
  'governance.incident.transitioned': {
    slice: 'incidents',
    reducer: (currentSlice, event) => ({
      items: reduceIncidentTransitioned((currentSlice?.items || {}), event),
    }),
    consistency_level: 'MEMORY_ONLY',
  },
  'governance.incident.archived': {
    slice: 'incidents',
    reducer: (currentSlice, event) => ({
      items: reduceIncidentArchived((currentSlice?.items || {}), event),
    }),
    consistency_level: 'MEMORY_ONLY',
  },
  'governance.authority.epoch_advanced': {
    slice: 'epoch',
    reducer: reduceEpochAdvanced,
    consistency_level: 'LINEARIZED',
  },
  'governance.config.updated': {
    slice: 'config',
    reducer: reduceConfigUpdated,
    consistency_level: 'MEMORY_ONLY',
  },
  'governance.cluster.heartbeat': {
    slice: 'topology',
    reducer: reduceNodeHeartbeat,
    consistency_level: 'CACHE_COHERENT',
  },
  'governance.cluster.node_evicted': {
    slice: 'topology',
    reducer: reduceNodeEvicted,
    consistency_level: 'CACHE_COHERENT',
  },
  'governance.plugin.registered': {
    slice: 'plugins',
    reducer: reducePluginRegistered,
    consistency_level: 'MEMORY_ONLY',
  },
  'governance.plugin.rejected': {
    slice: 'plugins',
    reducer: reducePluginRejected,
    consistency_level: 'MEMORY_ONLY',
  },
  'governance.operator.token_revoked': {
    slice: 'operators',
    reducer: reduceTokenRevoked,
    consistency_level: 'MEMORY_ONLY',
  },
};

module.exports = {
  EVENT_REDUCERS,
  reduceFreezeConfirmed,
  reduceFreezeLocal,
  reduceUnfreeze,
  reduceIncidentCreated,
  reduceIncidentTransitioned,
  reduceIncidentArchived,
  reduceEpochAdvanced,
  reduceConfigUpdated,
  reduceNodeHeartbeat,
  reduceNodeEvicted,
  reducePluginRegistered,
  reducePluginRejected,
  reduceTokenRevoked,
};
