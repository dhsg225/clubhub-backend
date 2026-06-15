'use strict';
/**
 * replay-runtime/index.js
 *
 * Demonstrates entering + exiting replay mode with the governance kernel.
 *
 * Run: node index.js
 * Requires: DATABASE_URL env var
 */

const { Pool } = require('pg');

// Import replay hooks from the OTA plugin runtime (the governed replay interface)
const replayHooks = require('../../plugins/ota-runtime/replay-hooks');

// Simulated historical events (as if loaded from audit ledger)
const HISTORICAL_EVENTS = [
  { lineage_ts: 1087, received_at: '2026-05-10T10:01:27Z', event_type: 'governance.authority.epoch_changed', payload: { epoch: 9 } },
  { lineage_ts: 1000, received_at: '2026-05-10T10:00:00Z', event_type: 'governance.freeze.frozen',           payload: { reason: 'OTA rollback' } },
  { lineage_ts: 1042, received_at: '2026-05-10T10:00:42Z', event_type: 'governance.incident.created',        payload: { severity: 'CRITICAL' } },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('[boot] Kernel initialized');

  // ── 1. Enter replay mode ─────────────────────────────────────────────────
  const correlationId = 'example-replay-001';
  replayHooks.enterReplay(correlationId);
  console.log('[replay] Entering replay mode, correlation:', correlationId);
  console.log('[replay] Replay mode active:', replayHooks.isReplayMode());

  // ── 2. Process events in deterministic (lineage_ts) order ────────────────
  const sorted = [...HISTORICAL_EVENTS].sort((a, b) => a.lineage_ts - b.lineage_ts);
  console.log('[replay] Processing %d events in lineage_ts order...', sorted.length);
  for (const ev of sorted) {
    // NOTE: display deterministic_ts (lineage_ts), NOT received_at
    console.log('[replay]   ts=%d type=%s', ev.lineage_ts, ev.event_type);
  }

  // ── 3. Attempt a mutation — must be blocked ──────────────────────────────
  try {
    replayHooks.assertNotReplay('example.mutation');
    console.log('[replay] ERROR: mutation was not blocked!');
  } catch (err) {
    console.log('[replay] Mutation attempt blocked:', err.message);
  }

  // ── 4. Exit replay mode ──────────────────────────────────────────────────
  replayHooks.exitReplay();
  console.log('[replay] Exiting replay mode');
  console.log('[replay] Replay mode active:', replayHooks.isReplayMode());

  // ── 5. Confirm mutations re-enabled ──────────────────────────────────────
  try {
    replayHooks.assertNotReplay('example.mutation');
    console.log('[replay] Mutations re-enabled');
  } catch (err) {
    console.log('[replay] ERROR: mutations still blocked after exit:', err.message);
  }

  console.log('[done] Replay runtime example complete');
  await pool.end();
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
