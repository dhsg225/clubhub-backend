'use strict';
/**
 * deterministic-replay/index.js
 *
 * Verifies replay determinism: same events → same content-addressed hash
 * across multiple independent replay runs.
 *
 * Run: node index.js
 * No database required.
 */

const crypto = require('crypto');

// stableStringify: lexicographic key sort for deterministic serialization
function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

// Fixed event sequence (as loaded from audit ledger)
// NOTE: received_at values are deliberately inconsistent across "runs" to prove they
// are NOT included in the content hash.
const EVENTS = [
  { lineage_ts: 1000, event_id: 'ev-001', event_type: 'governance.freeze.frozen',           payload: { reason: 'OTA rollback', epoch: 7 },  received_at: '2026-05-10T10:00:00Z' },
  { lineage_ts: 1042, event_id: 'ev-002', event_type: 'governance.incident.created',        payload: { severity: 'CRITICAL', type: 'DEPLOY' }, received_at: '2026-05-10T10:00:42Z' },
  { lineage_ts: 1087, event_id: 'ev-003', event_type: 'governance.authority.epoch_changed', payload: { epoch: 8 },                           received_at: '2026-05-10T10:01:27Z' },
  { lineage_ts: 1103, event_id: 'ev-004', event_type: 'governance.config.updated',          payload: { keys: ['ring_count'], version: 3 },    received_at: '2026-05-10T10:01:43Z' },
  { lineage_ts: 1220, event_id: 'ev-005', event_type: 'governance.freeze.unfrozen',         payload: { reason: 'incident resolved', epoch: 8 }, received_at: '2026-05-10T10:02:00Z' },
];

function replayEvents(events, runNumber) {
  // Sort by lineage_ts (deterministic) — NOT by received_at
  const sorted = [...events].sort((a, b) => a.lineage_ts - b.lineage_ts);

  console.log('[replay] Run %d — processing %d events', runNumber, sorted.length);

  // Build deterministic output: exclude received_at
  const deterministicOutput = sorted.map(ev => ({
    lineage_ts: ev.lineage_ts,
    event_id:   ev.event_id,
    event_type: ev.event_type,
    payload:    ev.payload,
    // received_at intentionally excluded from deterministic hash
  }));

  const hash = crypto
    .createHash('sha256')
    .update(stableStringify(deterministicOutput))
    .digest('hex')
    .slice(0, 16);

  console.log('[replay] Run %d — content hash: %s', runNumber, hash);
  return hash;
}

function main() {
  const RUN_COUNT = 3;
  const hashes = [];

  // Simulate events arriving with different received_at on each "run"
  // to prove received_at does not affect the hash
  for (let run = 1; run <= RUN_COUNT; run++) {
    const eventsWithDifferentReceivedAt = EVENTS.map(ev => ({
      ...ev,
      received_at: new Date(Date.now() + run * 1000).toISOString(), // different each run
    }));
    hashes.push(replayEvents(eventsWithDifferentReceivedAt, run));
  }

  const allIdentical = hashes.every(h => h === hashes[0]);
  if (allIdentical) {
    console.log('[verify] All %d runs produced identical content hash ✓', RUN_COUNT);
  } else {
    console.error('[verify] FAIL: runs produced different hashes!', hashes);
    process.exit(1);
  }

  // Verify that including received_at would break determinism
  const hashWithReceivedAt = crypto
    .createHash('sha256')
    .update(stableStringify(EVENTS.map(ev => ({
      lineage_ts:  ev.lineage_ts,
      event_id:    ev.event_id,
      event_type:  ev.event_type,
      payload:     ev.payload,
      received_at: ev.received_at, // included — breaks determinism
    }))))
    .digest('hex')
    .slice(0, 16);

  if (hashWithReceivedAt !== hashes[0]) {
    console.log('[verify] received_at excluded from hash: confirmed ✓');
  }

  console.log('[done] Deterministic replay example complete');
}

main();
