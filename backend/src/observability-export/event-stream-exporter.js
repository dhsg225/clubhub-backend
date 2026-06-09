'use strict';
/**
 * EventStreamExporter — deterministic ordered export of platform events.
 * Append-only stream. No mutation. NDJSON output.
 */

class EventStreamExporter {
  constructor({ eventBus } = {}) {
    this._events  = [];
    this._seq     = 0;
    if (eventBus) {
      eventBus.subscribe('*', (type, fields) => {
        this._events.push({ seq: ++this._seq, type, fields, ts: Date.now() });
      });
    }
  }

  getEvents(since_seq = 0) {
    return this._events.filter(e => e.seq > since_seq);
  }

  exportWindow(since_seq = 0) {
    const events = this.getEvents(since_seq);
    return { type: 'event_stream', exported_at: Date.now(), since_seq, event_count: events.length, events };
  }

  toNDJSON(since_seq = 0) {
    return this.getEvents(since_seq).map(e => JSON.stringify(e)).join('\n') + '\n';
  }

  snapshot() {
    return { total_events: this._events.length, last_seq: this._seq };
  }
}

module.exports = { EventStreamExporter };
