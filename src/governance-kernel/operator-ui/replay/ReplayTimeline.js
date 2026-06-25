'use strict';

/**
 * ReplayTimeline — replay cursor management and event sequencing for operator UI.
 *
 * Manages the replay timeline for operator forensic analysis:
 *   - cursor position (lineage_ts)
 *   - forward / backward stepping
 *   - event filtering by type, correlation_id, operator_id
 *   - timeline annotation (incident, freeze, epoch events)
 *   - deterministic replay order enforcement
 *
 * REPLAY_CONTRACT.md compliance:
 *   - Events sorted ascending by lineage_ts before replay
 *   - lineage_ts precision: ms (sub-ms ordering not guaranteed)
 *   - ORPHANED_EVENT anomalies expected and suppressed in REPLAY mode
 *   - Side effects (DB writes, token issuance) MUST NOT occur during replay
 *
 * UI_AUTHORITY_BOUNDARY: This is a pure client-side replay controller.
 * It does not call kernel methods. It manages event array traversal only.
 */

class ReplayTimeline {
  constructor(opts = {}) {
    this._events = [];
    this._cursor = -1;         // index into _events
    this._annotations = [];
    this._filters = opts.filters || {};
    this._onStep = opts.onStep || null;
    this._playing = false;
    this._playIntervalMs = opts.playIntervalMs || 500;
    this._playTimer = null;

    // Mode tracking
    this._mode = opts.mode || 'REPLAY'; // REPLAY | FORENSIC | SIMULATION
  }

  // ─── Load events ──────────────────────────────────────────────────────────

  /**
   * Load events into timeline. Sorts by lineage_ts (ascending).
   * Events without lineage_ts are placed at end.
   */
  load(events) {
    if (!Array.isArray(events)) throw new Error('events must be an array');

    this._events = [...events].sort((a, b) => {
      if (!a.lineage_ts) return 1;
      if (!b.lineage_ts) return -1;
      return a.lineage_ts < b.lineage_ts ? -1 : a.lineage_ts > b.lineage_ts ? 1 : 0;
    });

    this._cursor = -1;
    this._annotations = this._buildAnnotations(this._events);
    return this._events.length;
  }

  // ─── Cursor control ───────────────────────────────────────────────────────

  /** Advance cursor by one event. Returns the event, or null if at end. */
  stepForward() {
    if (this._cursor >= this._events.length - 1) return null;
    this._cursor++;
    const event = this._events[this._cursor];
    if (this._onStep) this._onStep({ cursor: this._cursor, event, direction: 'forward' });
    return event;
  }

  /** Retreat cursor by one event. Returns the event, or null if at start. */
  stepBackward() {
    if (this._cursor <= 0) {
      this._cursor = -1;
      return null;
    }
    this._cursor--;
    const event = this._events[this._cursor];
    if (this._onStep) this._onStep({ cursor: this._cursor, event, direction: 'backward' });
    return event;
  }

  /** Jump cursor to specific lineage_ts. Returns index or -1 if not found. */
  seekTo(lineageTs) {
    const idx = this._events.findIndex(e => e.lineage_ts === lineageTs);
    if (idx === -1) {
      // Find closest preceding event
      const preceding = this._events.reduce((best, e, i) => {
        if (e.lineage_ts <= lineageTs) return i;
        return best;
      }, -1);
      this._cursor = preceding;
    } else {
      this._cursor = idx;
    }
    const event = this._cursor >= 0 ? this._events[this._cursor] : null;
    if (this._onStep) this._onStep({ cursor: this._cursor, event, direction: 'seek' });
    return this._cursor;
  }

  seekToStart() {
    this._cursor = -1;
    if (this._onStep) this._onStep({ cursor: -1, event: null, direction: 'seek_start' });
  }

  seekToEnd() {
    this._cursor = this._events.length - 1;
    const event = this._cursor >= 0 ? this._events[this._cursor] : null;
    if (this._onStep) this._onStep({ cursor: this._cursor, event, direction: 'seek_end' });
  }

  // ─── Autoplay ─────────────────────────────────────────────────────────────

  play() {
    if (this._playing) return;
    this._playing = true;
    this._schedulePlay();
  }

  pause() {
    this._playing = false;
    if (this._playTimer) {
      clearTimeout(this._playTimer);
      this._playTimer = null;
    }
  }

  isPlaying() { return this._playing; }

  _schedulePlay() {
    if (!this._playing) return;
    this._playTimer = setTimeout(() => {
      const event = this.stepForward();
      if (!event) {
        this._playing = false; // reached end
      } else {
        this._schedulePlay();
      }
    }, this._playIntervalMs);
  }

  // ─── State queries ────────────────────────────────────────────────────────

  getCurrentEvent() {
    return this._cursor >= 0 ? this._events[this._cursor] : null;
  }

  getCurrentTs() {
    const event = this.getCurrentEvent();
    return event?.lineage_ts ?? null;
  }

  getCursor() { return this._cursor; }
  getLength() { return this._events.length; }

  getProgress() {
    if (this._events.length === 0) return 0;
    return (this._cursor + 1) / this._events.length;
  }

  /** Returns events from start to cursor (inclusive) — the "seen" subset. */
  getConsumedEvents() {
    if (this._cursor < 0) return [];
    return this._events.slice(0, this._cursor + 1);
  }

  /** Returns timeline summary: milestones (freeze, incident, epoch) for UI navigation. */
  getAnnotations() {
    return this._annotations;
  }

  getMode() { return this._mode; }

  // ─── Filtering ────────────────────────────────────────────────────────────

  /**
   * Returns a filtered view of events without modifying internal state.
   * Use for rendering a subset (e.g. only freeze events).
   */
  getFilteredEvents(filters = {}) {
    return this._events.filter(e => {
      if (filters.event_type && e.event_type !== filters.event_type) return false;
      if (filters.event_type_prefix && !e.event_type?.startsWith(filters.event_type_prefix)) return false;
      if (filters.correlation_id && e.correlation_id !== filters.correlation_id) return false;
      if (filters.operator_id && e.operator_id !== filters.operator_id) return false;
      if (filters.incident_id && e.incident_id !== filters.incident_id) return false;
      if (filters.from_ts && e.lineage_ts < filters.from_ts) return false;
      if (filters.to_ts && e.lineage_ts > filters.to_ts) return false;
      return true;
    });
  }

  // ─── Annotation builder ───────────────────────────────────────────────────

  _buildAnnotations(events) {
    const annotations = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const type = e.event_type || '';

      if (type.includes('freeze')) {
        annotations.push({ index: i, kind: 'FREEZE', lineage_ts: e.lineage_ts, label: `Freeze: ${e.reason || ''}` });
      } else if (type.includes('epoch_advanced')) {
        annotations.push({ index: i, kind: 'EPOCH', lineage_ts: e.lineage_ts, label: `Epoch → ${e.epoch}` });
      } else if (type.includes('incident.created')) {
        annotations.push({ index: i, kind: 'INCIDENT', lineage_ts: e.lineage_ts, label: `Incident: ${e.incident_type || e.incident_id}` });
      } else if (type.includes('incident.transitioned')) {
        annotations.push({ index: i, kind: 'INCIDENT_TRANSITION', lineage_ts: e.lineage_ts, label: `→ ${e.to_state}` });
      } else if (type.includes('config.updated')) {
        annotations.push({ index: i, kind: 'CONFIG', lineage_ts: e.lineage_ts, label: `Config updated (v${e.version})` });
      }
    }
    return annotations;
  }
}

module.exports = { ReplayTimeline };
