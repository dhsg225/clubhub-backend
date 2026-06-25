'use strict';

/**
 * GovernedStateStore — read-only client state model for Governance Kernel operator UI.
 *
 * This store is a READ MODEL ONLY. It has no mutation methods.
 * All state changes originate from:
 *   1. Authoritative snapshots fetched via SnapshotClient
 *   2. Events received via GovernedEventStream (or replay stream)
 *
 * INVARIANTS (certified by UIConsistencyCertification):
 *   - No public method mutates state without a provenance-tagged event/snapshot
 *   - LINEARIZED operations never apply optimistic state
 *   - Replay mode prevents live event application
 *   - All state objects carry consistency_level and authority_source
 *
 * UI_AUTHORITY_BOUNDARY: This file must never import governance-kernel core/ or api/ modules.
 * It is a pure in-process state container, framework-agnostic.
 */

const RENDERING_MODES = Object.freeze({
  LIVE: 'LIVE',
  REPLAY: 'REPLAY',
  FORENSIC: 'FORENSIC',
  SIMULATION: 'SIMULATION',
  STALE: 'STALE',
  SPLIT_BRAIN: 'SPLIT_BRAIN',
  RECONNECTING: 'RECONNECTING',
  SNAPSHOT_LOADING: 'SNAPSHOT_LOADING',
});

const CONSISTENCY_LEVELS = Object.freeze({
  MEMORY_ONLY: 'MEMORY_ONLY',
  CACHE_COHERENT: 'CACHE_COHERENT',
  DB_AUTHORITATIVE: 'DB_AUTHORITATIVE',
  LINEARIZED: 'LINEARIZED',
});

const AUTHORITY_SOURCES = Object.freeze({
  SNAPSHOT: 'SNAPSHOT',
  EVENT: 'EVENT',
  REPLAY: 'REPLAY',
  // OPTIMISTIC is intentionally absent — it is not a valid authority source in this store
});

// Stale threshold for CACHE_COHERENT data (mirrors kernel constant)
const CACHE_COHERENT_STALE_THRESHOLD_MS = 120_000;

// Duplicate event deduplication window
const DEDUP_WINDOW = 500;

class GovernedStateStore {
  constructor(opts = {}) {
    this._clock = opts.clock || Date; // injectable for testing; wall-clock only (not governed)
    this._listeners = new Map();      // sliceName → Set<fn>
    this._globalListeners = new Set();

    this._renderingMode = RENDERING_MODES.SNAPSHOT_LOADING;
    this._replayCursor = null;

    // Deduplification ring buffer
    this._seenEventIds = [];

    // Stale event counter (consecutive stale events trigger refetch)
    this._consecutiveStaleEvents = 0;
    this._snapshotRefetchCallback = opts.onSnapshotRefetchRequired || null;

    // Core state slices — each carries metadata envelope
    this._state = {
      freeze: this._emptySlice(CONSISTENCY_LEVELS.CACHE_COHERENT),
      incidents: this._emptySlice(CONSISTENCY_LEVELS.MEMORY_ONLY),
      topology: this._emptySlice(CONSISTENCY_LEVELS.MEMORY_ONLY),
      config: this._emptySlice(CONSISTENCY_LEVELS.MEMORY_ONLY),
      auditLedger: this._emptySlice(CONSISTENCY_LEVELS.MEMORY_ONLY),
      operators: this._emptySlice(CONSISTENCY_LEVELS.MEMORY_ONLY),
      certification: this._emptySlice(CONSISTENCY_LEVELS.MEMORY_ONLY),
      plugins: this._emptySlice(CONSISTENCY_LEVELS.MEMORY_ONLY),
      lineage: this._emptySlice(CONSISTENCY_LEVELS.MEMORY_ONLY),
      epoch: this._emptySlice(CONSISTENCY_LEVELS.CACHE_COHERENT),
    };

    // Sequence tracking for gap detection
    this._lastSequenceId = -1;
  }

  // ─── Public read API ────────────────────────────────────────────────────────

  getSlice(name) {
    if (!this._state[name]) throw new Error(`Unknown state slice: ${name}`);
    return Object.freeze({ ...this._state[name] });
  }

  getAll() {
    const result = {};
    for (const [k, v] of Object.entries(this._state)) {
      result[k] = Object.freeze({ ...v });
    }
    return Object.freeze(result);
  }

  getRenderingMode() {
    return this._renderingMode;
  }

  isLive() { return this._renderingMode === RENDERING_MODES.LIVE; }
  isReplay() { return this._renderingMode === RENDERING_MODES.REPLAY; }
  isStale() { return this._renderingMode === RENDERING_MODES.STALE; }
  isSplitBrain() { return this._renderingMode === RENDERING_MODES.SPLIT_BRAIN; }

  getAuthorityConfidence(sliceName) {
    const slice = this._state[sliceName];
    if (!slice || !slice.received_at) return 'UNKNOWN';
    if (slice.authority_source === AUTHORITY_SOURCES.REPLAY) return 'REPLAY';

    const ageMs = this._clock.now() - new Date(slice.received_at).getTime();

    if (slice.consistency_level === CONSISTENCY_LEVELS.LINEARIZED && ageMs < 5000) return 'HIGH';
    if (slice.consistency_level === CONSISTENCY_LEVELS.DB_AUTHORITATIVE && ageMs < 5000) return 'HIGH';
    if (slice.consistency_level === CONSISTENCY_LEVELS.CACHE_COHERENT && ageMs < CACHE_COHERENT_STALE_THRESHOLD_MS) return 'MEDIUM';
    if (this._renderingMode === RENDERING_MODES.SPLIT_BRAIN) return 'DIVERGED';
    return 'LOW';
  }

  // ─── Snapshot ingestion ──────────────────────────────────────────────────────

  /**
   * Load an authoritative snapshot from SnapshotClient.
   * Replaces all state slices with snapshot data.
   * Transitions rendering mode to LIVE after successful load.
   */
  loadSnapshot(snapshot) {
    if (typeof snapshot !== 'object' || !snapshot) throw new Error('snapshot must be an object');
    if (!snapshot.sequence_id && snapshot.sequence_id !== 0) throw new Error('snapshot.sequence_id required');

    const receivedAt = new Date(this._clock.now()).toISOString();
    const epoch = snapshot.authority_epoch;

    if (snapshot.freeze) {
      this._applyToSlice('freeze', snapshot.freeze, {
        authority_source: AUTHORITY_SOURCES.SNAPSHOT,
        consistency_level: CONSISTENCY_LEVELS.CACHE_COHERENT,
        authority_epoch: epoch,
        received_at: receivedAt,
        replayable: true,
        sequence_id: snapshot.sequence_id,
      });
    }

    if (snapshot.incidents) {
      this._applyToSlice('incidents', { items: snapshot.incidents }, {
        authority_source: AUTHORITY_SOURCES.SNAPSHOT,
        consistency_level: CONSISTENCY_LEVELS.MEMORY_ONLY,
        authority_epoch: epoch,
        received_at: receivedAt,
        replayable: true,
        sequence_id: snapshot.sequence_id,
      });
    }

    if (snapshot.topology) {
      this._applyToSlice('topology', snapshot.topology, {
        authority_source: AUTHORITY_SOURCES.SNAPSHOT,
        consistency_level: CONSISTENCY_LEVELS.MEMORY_ONLY,
        authority_epoch: epoch,
        received_at: receivedAt,
        replayable: true,
        sequence_id: snapshot.sequence_id,
      });
    }

    if (snapshot.config) {
      this._applyToSlice('config', snapshot.config, {
        authority_source: AUTHORITY_SOURCES.SNAPSHOT,
        consistency_level: CONSISTENCY_LEVELS.MEMORY_ONLY,
        authority_epoch: epoch,
        received_at: receivedAt,
        replayable: true,
        sequence_id: snapshot.sequence_id,
      });
    }

    if (snapshot.epoch !== undefined) {
      this._applyToSlice('epoch', { value: snapshot.epoch }, {
        authority_source: AUTHORITY_SOURCES.SNAPSHOT,
        consistency_level: CONSISTENCY_LEVELS.CACHE_COHERENT,
        authority_epoch: epoch,
        received_at: receivedAt,
        replayable: true,
        sequence_id: snapshot.sequence_id,
      });
    }

    this._lastSequenceId = snapshot.sequence_id;
    this._consecutiveStaleEvents = 0;
    this._setRenderingMode(RENDERING_MODES.LIVE);
    this._notifyGlobal({ type: 'SNAPSHOT_LOADED', sequence_id: snapshot.sequence_id });
  }

  // ─── Event application ───────────────────────────────────────────────────────

  /**
   * Apply a live event from GovernedEventStream.
   * MUST NOT be called during replay rendering mode.
   */
  applyEvent(event) {
    if (this._renderingMode === RENDERING_MODES.REPLAY) {
      // Live events silently dropped during replay — not an error
      return;
    }

    if (!this._checkAndTrackEvent(event)) return; // duplicate

    // Gap detection
    if (event.sequence_id !== undefined) {
      if (this._lastSequenceId >= 0 && event.sequence_id !== this._lastSequenceId + 1) {
        // Gap detected — request snapshot refetch
        this._setRenderingMode(RENDERING_MODES.STALE);
        if (this._snapshotRefetchCallback) this._snapshotRefetchCallback('GAP_DETECTED');
        return;
      }
      this._lastSequenceId = event.sequence_id;
    }

    // Stale epoch detection
    const currentEpoch = this._state.epoch.value?.value ?? 0;
    if (event.authority_epoch !== undefined && event.authority_epoch < currentEpoch) {
      this._consecutiveStaleEvents++;
      if (this._consecutiveStaleEvents >= 3) {
        if (this._snapshotRefetchCallback) this._snapshotRefetchCallback('STALE_EPOCH');
      }
      return;
    }
    this._consecutiveStaleEvents = 0;

    const receivedAt = new Date(this._clock.now()).toISOString();
    this._reduceEvent(event, AUTHORITY_SOURCES.EVENT, receivedAt);
    this._notifyGlobal({ type: 'EVENT_APPLIED', event });
  }

  // ─── Replay mode ─────────────────────────────────────────────────────────────

  enterReplayMode(cursor) {
    if (this._renderingMode !== RENDERING_MODES.LIVE && this._renderingMode !== RENDERING_MODES.STALE) {
      throw new Error(`Cannot enter replay mode from ${this._renderingMode}`);
    }
    this._replayCursor = cursor;
    this._setRenderingMode(RENDERING_MODES.REPLAY);
    this._notifyGlobal({ type: 'REPLAY_STARTED', cursor });
  }

  /**
   * Apply a single replay event. Clock pin (`lineage_ts`) is respected.
   * received_at is NOT updated (per UI_RUNTIME_MODEL §5).
   */
  applyReplayEvent(event) {
    if (this._renderingMode !== RENDERING_MODES.REPLAY) {
      throw new Error('applyReplayEvent called outside replay mode');
    }
    if (!event.lineage_ts) throw new Error('replay event must have lineage_ts');

    this._replayCursor = event.lineage_ts;
    // Preserve existing received_at; do not update to wall-clock
    this._reduceEvent(event, AUTHORITY_SOURCES.REPLAY, null /* preserve received_at */);
    this._notifyGlobal({ type: 'REPLAY_EVENT', cursor: this._replayCursor, event });
  }

  exitReplayMode() {
    this._replayCursor = null;
    this._setRenderingMode(RENDERING_MODES.SNAPSHOT_LOADING);
    // Caller is responsible for fetching a fresh snapshot
    this._notifyGlobal({ type: 'REPLAY_EXITED' });
  }

  // ─── Split-brain handling ────────────────────────────────────────────────────

  detectSplitBrain(instanceStates) {
    // instanceStates: [{ instance_id, freeze_state, authority_epoch }]
    if (!Array.isArray(instanceStates) || instanceStates.length < 2) return;

    const epochs = new Set(instanceStates.map(s => s.authority_epoch));
    const freezeStates = new Set(instanceStates.map(s => s.freeze_state));

    if (epochs.size > 1 || freezeStates.size > 1) {
      this._applyToSlice('topology', {
        ...this._state.topology.value,
        split_brain: true,
        divergent_instances: instanceStates,
      }, {
        authority_source: AUTHORITY_SOURCES.EVENT,
        consistency_level: CONSISTENCY_LEVELS.CACHE_COHERENT,
        authority_epoch: Math.max(...instanceStates.map(s => s.authority_epoch || 0)),
        received_at: new Date(this._clock.now()).toISOString(),
        replayable: false,
      });
      this._setRenderingMode(RENDERING_MODES.SPLIT_BRAIN);
      this._notifyGlobal({ type: 'SPLIT_BRAIN_DETECTED', instances: instanceStates });
    }
  }

  clearSplitBrain() {
    if (this._renderingMode === RENDERING_MODES.SPLIT_BRAIN) {
      this._setRenderingMode(RENDERING_MODES.SNAPSHOT_LOADING);
      if (this._snapshotRefetchCallback) this._snapshotRefetchCallback('SPLIT_BRAIN_CLEARED');
    }
  }

  // ─── Subscription ────────────────────────────────────────────────────────────

  subscribe(sliceNameOrGlobal, fn) {
    if (sliceNameOrGlobal === '*') {
      this._globalListeners.add(fn);
      return () => this._globalListeners.delete(fn);
    }
    if (!this._listeners.has(sliceNameOrGlobal)) {
      this._listeners.set(sliceNameOrGlobal, new Set());
    }
    this._listeners.get(sliceNameOrGlobal).add(fn);
    return () => this._listeners.get(sliceNameOrGlobal).delete(fn);
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  _emptySlice(consistencyLevel) {
    return {
      value: null,
      authority_source: null,
      consistency_level: consistencyLevel,
      lineage_ts: null,
      received_at: null,
      authority_epoch: null,
      replayable: null,
      replay_cursor: null,
      stale_threshold_ms: consistencyLevel === CONSISTENCY_LEVELS.CACHE_COHERENT ? CACHE_COHERENT_STALE_THRESHOLD_MS : null,
      is_stale: false,
      sequence_id: null,
    };
  }

  _applyToSlice(name, value, meta) {
    const existing = this._state[name];
    const now = this._clock.now();

    const stale = meta.stale_threshold_ms != null && meta.received_at
      ? (now - new Date(meta.received_at).getTime()) > meta.stale_threshold_ms
      : false;

    this._state[name] = {
      ...existing,
      value,
      authority_source: meta.authority_source ?? existing.authority_source,
      consistency_level: meta.consistency_level ?? existing.consistency_level,
      lineage_ts: meta.lineage_ts ?? existing.lineage_ts,
      received_at: meta.received_at ?? existing.received_at, // null means preserve
      authority_epoch: meta.authority_epoch ?? existing.authority_epoch,
      replayable: meta.replayable ?? existing.replayable,
      replay_cursor: meta.authority_source === AUTHORITY_SOURCES.REPLAY ? (meta.lineage_ts || this._replayCursor) : null,
      is_stale: stale,
      sequence_id: meta.sequence_id ?? existing.sequence_id,
    };

    const listeners = this._listeners.get(name);
    if (listeners) {
      for (const fn of listeners) fn(this._state[name]);
    }
  }

  _reduceEvent(event, authoritySource, receivedAt) {
    const meta = {
      authority_source: authoritySource,
      lineage_ts: event.lineage_ts,
      received_at: receivedAt, // null = preserve existing
      authority_epoch: event.authority_epoch,
      replayable: true,
    };

    const type = event.event_type || event.type;

    if (type && type.startsWith('governance.kernel.freeze')) {
      this._applyToSlice('freeze', {
        frozen: event.frozen ?? event.freeze_state ?? null,
        reason: event.reason,
        freeze_epoch: event.freeze_epoch,
        confirmed_at: event.lineage_ts,
      }, { ...meta, consistency_level: CONSISTENCY_LEVELS.LINEARIZED });
    }

    if (type && type.startsWith('governance.incident')) {
      const incidents = { ...(this._state.incidents.value || { items: {} }) };
      if (event.incident_id) {
        incidents.items = { ...(incidents.items || {}) };
        incidents.items[event.incident_id] = {
          ...(incidents.items[event.incident_id] || {}),
          ...event,
        };
      }
      this._applyToSlice('incidents', incidents, { ...meta, consistency_level: CONSISTENCY_LEVELS.MEMORY_ONLY });
    }

    if (type && type.startsWith('governance.cluster')) {
      this._applyToSlice('topology', {
        ...(this._state.topology.value || {}),
        ...event,
      }, { ...meta, consistency_level: CONSISTENCY_LEVELS.CACHE_COHERENT });
    }

    if (type && type.startsWith('governance.config')) {
      this._applyToSlice('config', {
        ...(this._state.config.value || {}),
        config_hash: event.config_hash,
        version: event.version,
        updated_at: event.lineage_ts,
      }, { ...meta, consistency_level: CONSISTENCY_LEVELS.MEMORY_ONLY });
    }

    if (type && type.startsWith('governance.authority')) {
      if (event.epoch !== undefined) {
        this._applyToSlice('epoch', { value: event.epoch }, {
          ...meta, consistency_level: CONSISTENCY_LEVELS.LINEARIZED,
        });
      }
    }
  }

  _checkAndTrackEvent(event) {
    if (!event.event_id) return true; // no ID — pass through
    if (this._seenEventIds.includes(event.event_id)) return false; // duplicate
    this._seenEventIds.push(event.event_id);
    if (this._seenEventIds.length > DEDUP_WINDOW) this._seenEventIds.shift();
    return true;
  }

  _setRenderingMode(mode) {
    if (this._renderingMode !== mode) {
      const prev = this._renderingMode;
      this._renderingMode = mode;
      this._notifyGlobal({ type: 'MODE_CHANGED', from: prev, to: mode });
    }
  }

  _notifyGlobal(event) {
    for (const fn of this._globalListeners) fn(event);
  }
}

module.exports = {
  GovernedStateStore,
  RENDERING_MODES,
  CONSISTENCY_LEVELS,
  AUTHORITY_SOURCES,
};
