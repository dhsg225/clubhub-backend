'use strict';

/**
 * GovernedEventStream — governed polling-based event stream client.
 *
 * Transport model (v1):
 *   - Polling with configurable intervals per event category
 *   - Snapshot-first reconciliation on connect and reconnect
 *   - Gap detection → snapshot refetch trigger
 *   - Replay stream with cursor semantics
 *   - All events carry: authority_epoch, lineage_ts, deterministic_ts, consistency_level, sequence_id
 *
 * v1 does NOT use WebSocket push. See UI_RUNTIME_MODEL.md §7 for polling intervals.
 * WebSocket push is an advisory gap for v2.
 *
 * UI_AUTHORITY_BOUNDARY: This module is client-side transport only.
 * It must never import governance-kernel core/ or api/ modules.
 */

const DEFAULT_POLL_INTERVALS_MS = Object.freeze({
  freeze: 5_000,
  incidents: 10_000,
  topology: 15_000,
  auditLedger: 30_000,
  certification: 60_000,
  config: 30_000,
  epoch: 10_000,
  plugins: 30_000,
});

class GovernedEventStream {
  constructor(opts = {}) {
    if (!opts.fetcher) throw new Error('opts.fetcher required (HTTP adapter function)');

    this._fetcher = opts.fetcher;       // (path, opts?) => Promise<any>
    this._baseUrl = opts.baseUrl || '';
    this._pollIntervals = { ...DEFAULT_POLL_INTERVALS_MS, ...(opts.pollIntervals || {}) };
    this._onEvent = opts.onEvent || null;
    this._onGap = opts.onGap || null;
    this._onError = opts.onError || null;

    this._timers = {};
    this._running = false;
    this._replayMode = false;
    this._lastCursors = {}; // category → last sequence_id

    // Stats
    this._stats = {
      events_received: 0,
      gaps_detected: 0,
      reconnects: 0,
      errors: 0,
    };
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    this._running = true;
    for (const category of Object.keys(this._pollIntervals)) {
      this._schedulePoll(category);
    }
  }

  stop() {
    this._running = false;
    for (const timer of Object.values(this._timers)) {
      clearTimeout(timer);
    }
    this._timers = {};
  }

  // ─── Replay mode ──────────────────────────────────────────────────────────

  /**
   * Enter replay mode. Live polls are suspended.
   * Calls opts.onEvent with replay events as they're fetched.
   */
  async startReplay(opts = {}) {
    if (this._replayMode) throw new Error('Already in replay mode');
    this._replayMode = true;
    this.stop();

    try {
      const events = await this._fetcher(`${this._baseUrl}/governance/replay`, {
        method: 'POST',
        body: JSON.stringify({
          from_ts: opts.from_ts,
          to_ts: opts.to_ts,
          mode: opts.mode || 'REPLAY',
          event_types: opts.event_types || null,
        }),
      });

      if (!Array.isArray(events)) throw new Error('Replay response must be an array');

      // Events MUST be in ascending lineage_ts order (as required by REPLAY_CONTRACT.md)
      const sorted = [...events].sort((a, b) => {
        if (!a.lineage_ts || !b.lineage_ts) return 0;
        return a.lineage_ts < b.lineage_ts ? -1 : 1;
      });

      for (const event of sorted) {
        if (!this._replayMode) break; // cancelled
        if (this._onEvent) this._onEvent({ ...event, _replay: true });
      }

      return { events_replayed: sorted.length, mode: opts.mode || 'REPLAY' };
    } finally {
      this._replayMode = false;
    }
  }

  stopReplay() {
    this._replayMode = false;
  }

  // ─── Manual fetch ─────────────────────────────────────────────────────────

  async fetchCategory(category) {
    return this._poll(category);
  }

  getStats() {
    return { ...this._stats };
  }

  // ─── Internal polling ─────────────────────────────────────────────────────

  _schedulePoll(category) {
    if (!this._running || this._replayMode) return;
    const interval = this._pollIntervals[category];
    this._timers[category] = setTimeout(async () => {
      await this._poll(category);
      if (this._running && !this._replayMode) {
        this._schedulePoll(category);
      }
    }, interval);
  }

  async _poll(category) {
    if (!this._running && !this._replayMode) return;
    try {
      const cursor = this._lastCursors[category];
      const path = this._buildPollPath(category, cursor);
      const response = await this._fetcher(path);

      if (!response) return;

      const events = Array.isArray(response) ? response
        : response.events ? response.events
        : [response];

      for (const event of events) {
        this._stats.events_received++;

        // Gap detection
        if (event.sequence_id !== undefined && cursor !== undefined) {
          const expectedNext = cursor + 1;
          if (event.sequence_id > expectedNext) {
            this._stats.gaps_detected++;
            if (this._onGap) {
              this._onGap({
                category,
                expected_sequence_id: expectedNext,
                received_sequence_id: event.sequence_id,
              });
            }
            return; // abort this poll; let snapshot refetch handle it
          }
        }

        if (event.sequence_id !== undefined) {
          this._lastCursors[category] = event.sequence_id;
        }

        if (this._onEvent) this._onEvent(event);
      }
    } catch (err) {
      this._stats.errors++;
      if (this._onError) this._onError({ category, error: err });
    }
  }

  _buildPollPath(category, cursor) {
    const pathMap = {
      freeze: '/governance/freeze/events',
      incidents: '/governance/incidents/events',
      topology: '/governance/topology/events',
      auditLedger: '/governance/audit/events',
      certification: '/governance/certification/events',
      config: '/governance/config/events',
      epoch: '/governance/authority/events',
      plugins: '/governance/plugins/events',
    };
    const base = pathMap[category] || `/governance/${category}/events`;
    return cursor !== undefined
      ? `${this._baseUrl}${base}?after=${cursor}`
      : `${this._baseUrl}${base}`;
  }
}

module.exports = { GovernedEventStream, DEFAULT_POLL_INTERVALS_MS };
