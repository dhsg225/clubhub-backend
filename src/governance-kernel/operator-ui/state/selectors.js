'use strict';

/**
 * selectors.js — Pure selector functions over GovernedStateStore slices.
 *
 * All selectors are pure functions: (storeState) => derivedValue.
 * They do NOT mutate state and do NOT call kernel APIs.
 *
 * Each selector annotates its output with the provenance of its source slice.
 */

// ─── Freeze selectors ─────────────────────────────────────────────────────────

/**
 * Returns freeze status with authority confidence metadata.
 * Never returns a definitive "not frozen" if consistency_level is MEMORY_ONLY
 * or CACHE_COHERENT — those are advisory only.
 */
function selectFreezeState(storeState) {
  const slice = storeState.freeze;
  if (!slice || !slice.value) {
    return {
      frozen: null,
      confidence: 'UNKNOWN',
      consistency_level: slice?.consistency_level ?? null,
      authority_epoch: slice?.authority_epoch ?? null,
      freeze_epoch: null,
      reason: null,
      is_stale: true,
    };
  }

  return {
    frozen: slice.value.frozen,
    confidence: _confidenceFromSlice(slice),
    consistency_level: slice.consistency_level,
    authority_epoch: slice.authority_epoch,
    freeze_epoch: slice.value.freeze_epoch ?? null,
    reason: slice.value.reason ?? null,
    confirmed_at: slice.value.confirmed_at ?? null,
    is_stale: slice.is_stale,
    // Advisory: if consistency is not LINEARIZED, warn caller
    is_authoritative: slice.consistency_level === 'LINEARIZED' || slice.consistency_level === 'DB_AUTHORITATIVE',
  };
}

/**
 * Returns true if freeze status can be trusted as authoritative.
 * Returns false if caller should use strong DB check.
 */
function selectIsFreezeAuthoritative(storeState) {
  const slice = storeState.freeze;
  return slice?.consistency_level === 'LINEARIZED' || slice?.consistency_level === 'DB_AUTHORITATIVE';
}

// ─── Epoch selectors ──────────────────────────────────────────────────────────

function selectEpoch(storeState) {
  const slice = storeState.epoch;
  return {
    epoch: slice?.value?.value ?? null,
    confidence: _confidenceFromSlice(slice),
    consistency_level: slice?.consistency_level ?? null,
    received_at: slice?.received_at ?? null,
    is_stale: slice?.is_stale ?? true,
  };
}

// ─── Incident selectors ───────────────────────────────────────────────────────

function selectActiveIncidents(storeState) {
  const slice = storeState.incidents;
  const items = slice?.value?.items ?? {};
  const active = Object.values(items).filter(i =>
    i.state !== 'RESOLVED' && i.state !== 'POSTMORTEM_REQUIRED'
  );
  return {
    incidents: active,
    count: active.length,
    confidence: _confidenceFromSlice(slice),
    consistency_level: slice?.consistency_level ?? null,
    is_stale: slice?.is_stale ?? true,
  };
}

function selectIncident(storeState, id) {
  const slice = storeState.incidents;
  const item = slice?.value?.items?.[id] ?? null;
  return {
    incident: item,
    found: !!item,
    confidence: _confidenceFromSlice(slice),
    consistency_level: slice?.consistency_level ?? null,
  };
}

// ─── Topology selectors ───────────────────────────────────────────────────────

function selectTopology(storeState) {
  const slice = storeState.topology;
  const value = slice?.value ?? {};
  return {
    nodes: value.nodes ?? [],
    node_count: (value.nodes ?? []).length,
    split_brain: value.split_brain ?? false,
    divergent_instances: value.divergent_instances ?? null,
    confidence: _confidenceFromSlice(slice),
    consistency_level: slice?.consistency_level ?? null,
    received_at: slice?.received_at ?? null,
    is_stale: slice?.is_stale ?? true,
  };
}

function selectSplitBrain(storeState) {
  const topo = selectTopology(storeState);
  return topo.split_brain;
}

// ─── Config selectors ─────────────────────────────────────────────────────────

function selectConfigSnapshot(storeState) {
  const slice = storeState.config;
  return {
    config: slice?.value ?? null,
    config_hash: slice?.value?.config_hash ?? null,
    version: slice?.value?.version ?? null,
    confidence: _confidenceFromSlice(slice),
    consistency_level: slice?.consistency_level ?? null,
    is_stale: slice?.is_stale ?? true,
  };
}

// ─── Certification selectors ──────────────────────────────────────────────────

function selectCertificationStatus(storeState) {
  const slice = storeState.certification;
  const value = slice?.value ?? null;
  return {
    level: value?.level ?? null,
    overall_rating: value?.overall_rating ?? null,
    pass_count: value?.pass_count ?? null,
    fail_count: value?.fail_count ?? null,
    conditional_count: value?.conditional_count ?? null,
    generated_at: value?.generated_at ?? null,
    confidence: _confidenceFromSlice(slice),
    is_stale: slice?.is_stale ?? true,
  };
}

// ─── Rendering mode selectors ─────────────────────────────────────────────────

function selectCanSubmitMutations(renderingMode) {
  // Mutations forbidden during replay, split-brain, simulation
  return renderingMode === 'LIVE';
}

function selectCanSubmitLinearized(renderingMode, freezeSlice) {
  // LINEARIZED operations also require non-frozen (or requires ADMIN confirmation)
  if (!selectCanSubmitMutations(renderingMode)) return false;
  return true; // freeze checks happen server-side via OperatorAuthority
}

function selectModeWarning(renderingMode) {
  const warnings = {
    REPLAY: { level: 'info', message: 'Viewing historical replay — mutations disabled' },
    FORENSIC: { level: 'info', message: 'Forensic view — historical overlay active' },
    SIMULATION: { level: 'info', message: 'Simulation mode — no live state' },
    STALE: { level: 'warning', message: 'State may be stale — event stream interrupted' },
    SPLIT_BRAIN: { level: 'error', message: 'Split brain detected — mutations disabled until resolved' },
    RECONNECTING: { level: 'warning', message: 'Reconnecting to governance kernel...' },
    SNAPSHOT_LOADING: { level: 'info', message: 'Loading authoritative snapshot...' },
    LIVE: null,
  };
  return warnings[renderingMode] ?? null;
}

// ─── Audit ledger selectors ───────────────────────────────────────────────────

function selectAuditEntries(storeState, opts = {}) {
  const slice = storeState.auditLedger;
  const entries = slice?.value?.entries ?? [];
  let result = entries;
  if (opts.operator_id) result = result.filter(e => e.operator_id === opts.operator_id);
  if (opts.action) result = result.filter(e => e.action === opts.action);
  if (opts.limit) result = result.slice(-opts.limit);
  return {
    entries: result,
    total: entries.length,
    confidence: _confidenceFromSlice(slice),
    is_stale: slice?.is_stale ?? true,
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function _confidenceFromSlice(slice) {
  if (!slice || !slice.received_at) return 'UNKNOWN';
  if (slice.authority_source === 'REPLAY') return 'REPLAY';
  const ageMs = Date.now() - new Date(slice.received_at).getTime();
  if (slice.consistency_level === 'LINEARIZED' && ageMs < 5000) return 'HIGH';
  if (slice.consistency_level === 'DB_AUTHORITATIVE' && ageMs < 5000) return 'HIGH';
  if (slice.consistency_level === 'CACHE_COHERENT' && ageMs < 120000) return 'MEDIUM';
  return 'LOW';
}

module.exports = {
  selectFreezeState,
  selectIsFreezeAuthoritative,
  selectEpoch,
  selectActiveIncidents,
  selectIncident,
  selectTopology,
  selectSplitBrain,
  selectConfigSnapshot,
  selectCertificationStatus,
  selectCanSubmitMutations,
  selectCanSubmitLinearized,
  selectModeWarning,
  selectAuditEntries,
};
