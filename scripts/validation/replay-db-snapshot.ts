#!/usr/bin/env tsx
/**
 * G.1 — Real DB Replay Validation: Database-Backed Snapshot Stability
 *
 * Connects to a real PostgreSQL database, builds a SystemStateSnapshot
 * for the seed screen, then runs PRE.resolve() 100 times with the same
 * input. Any output variance is a constitutional failure.
 *
 * This validates the full DB → snapshot → PRE integration path.
 *
 * Prerequisites:
 *   - PostgreSQL running (default: localhost:5433 dev Docker)
 *   - Migrations run: pnpm db:migrate
 *   - Seed data loaded: pnpm db:seed
 *
 * Usage:
 *   DB_PORT=5433 DB_PASSWORD=devpassword tsx scripts/validation/replay-db-snapshot.ts
 *
 * Exit: 0 = PASS, 1 = FAIL
 */

import { join } from 'node:path';
import { initPool, closePool } from '../../services/cms-api/src/db/pool';
import { buildSystemStateSnapshot } from '../../services/cms-api/src/db/snapshot-builder';
import { resolve } from '../../src/pre/index';
import type { PRE_Input, PRE_Output } from '../../src/pre/types';

const SEED_SCREEN_ID = '60000000-0000-0000-0000-000000000001';
const SEED_VENUE_ID  = '40000000-0000-0000-0000-000000000001';
const RUNS = 100;

// Fixed evaluation timestamp — deterministic across all runs
// 2026-05-26 Tuesday 14:00:00 UTC (within Mon-Fri schedule window)
const EVAL_AT_MS = 1748264400000;

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('G.1 — Database-Backed Snapshot Stability');
  console.log(`Screen: ${SEED_SCREEN_ID}`);
  console.log(`Eval timestamp: ${EVAL_AT_MS} (${new Date(EVAL_AT_MS).toISOString()})`);
  console.log(`Runs: ${RUNS}`);
  console.log('='.repeat(70));

  // Initialize pool with dev defaults
  process.env['DB_HOST'] = process.env['DB_HOST'] ?? 'localhost';
  process.env['DB_PORT'] = process.env['DB_PORT'] ?? '5433';
  process.env['DB_NAME'] = process.env['DB_NAME'] ?? 'clubhub';
  process.env['DB_USER'] = process.env['DB_USER'] ?? 'clubhub_app';
  process.env['DB_PASSWORD'] = process.env['DB_PASSWORD'] ?? 'devpassword';

  initPool();

  try {
    // ─── Step 1: Build snapshot once ─────────────────────────────────────────
    console.log('\nBuilding SystemStateSnapshot from database...');
    const snapshot = await buildSystemStateSnapshot(SEED_SCREEN_ID, EVAL_AT_MS);
    console.log('  Screen status:', snapshot.screen.status);
    console.log('  Venue:', snapshot.venue.name, `(tz: ${snapshot.venue.timezone})`);
    console.log('  Organization:', snapshot.organization.name);
    console.log('  Emergency:', snapshot.emergency ? 'ACTIVE' : 'none');
    console.log('  Overrides:', snapshot.overrides.length);
    console.log('  Schedules:', snapshot.schedules.length);
    console.log('  Campaigns:', snapshot.campaigns.length);
    console.log('  Content items:', snapshot.content_items.length);
    console.log('  Sponsorships:', snapshot.sponsorships.length);

    const input: PRE_Input = {
      screen_id: SEED_SCREEN_ID,
      at: EVAL_AT_MS,
      system_state: snapshot,
    };

    // ─── Step 2: Run PRE 100 times, collect checksums ─────────────────────────
    console.log(`\nRunning PRE.resolve() × ${RUNS}...`);

    const checksums = new Set<string>();
    const resolutionLevels = new Set<number>();
    const isFallbackValues = new Set<boolean>();
    const errors: string[] = [];

    for (let i = 0; i < RUNS; i++) {
      let output: PRE_Output;
      try {
        output = resolve(input);
      } catch (err) {
        errors.push(`Run ${i}: ${String(err)}`);
        continue;
      }
      checksums.add(output.playlist_checksum);
      resolutionLevels.add(output.resolution_level);
      isFallbackValues.add(output.is_fallback);
    }

    // ─── Step 3: Verify stability ─────────────────────────────────────────────
    console.log('\n' + '─'.repeat(70));

    if (errors.length > 0) {
      console.error(`FAIL: ${errors.length} resolve() errors:`);
      for (const e of errors.slice(0, 5)) console.error(`  ${e}`);
      process.exit(1);
    }

    const stableChecksum = [...checksums][0]!;
    const stableLevel = [...resolutionLevels][0]!;
    const stableFallback = [...isFallbackValues][0]!;

    console.log(`  playlist_checksum variants: ${checksums.size} (expected: 1)`);
    console.log(`  resolution_level variants:  ${resolutionLevels.size} (expected: 1)`);
    console.log(`  is_fallback variants:       ${isFallbackValues.size} (expected: 1)`);
    console.log(`  Stable checksum:            ${stableChecksum}`);
    console.log(`  Stable resolution_level:    ${stableLevel}`);
    console.log(`  Stable is_fallback:         ${stableFallback}`);

    const failures: string[] = [];
    if (checksums.size > 1)       failures.push(`NONDETERMINISM: ${checksums.size} distinct playlist_checksum values`);
    if (resolutionLevels.size > 1) failures.push(`NONDETERMINISM: ${resolutionLevels.size} distinct resolution_level values`);
    if (isFallbackValues.size > 1) failures.push(`NONDETERMINISM: ${isFallbackValues.size} distinct is_fallback values`);

    // ─── Step 4: Verify PRE wrote zero DB rows during reads ───────────────────
    // (PRE is pure — the pool should have no pending uncommitted transactions)
    // We can check audit table count before/after to confirm PRE made no writes
    const pool = (await import('../../services/cms-api/src/db/pool')).getPool();
    const before = await pool.query('SELECT COUNT(*) FROM replay_audit_records');
    // Run resolve one more time
    resolve(input);
    const after = await pool.query('SELECT COUNT(*) FROM replay_audit_records');
    const beforeCount = Number((before.rows[0] as Record<string, unknown>)['count']);
    const afterCount  = Number((after.rows[0] as Record<string, unknown>)['count']);

    if (afterCount !== beforeCount) {
      failures.push(
        `PRE_IMPURITY: replay_audit_records count changed from ${beforeCount} to ${afterCount} — PRE is NOT read-only!`,
      );
    } else {
      console.log(`  PRE write-isolation: VERIFIED (audit count stable at ${beforeCount})`);
    }

    if (failures.length > 0) {
      console.error('\nFAILURES:');
      for (const f of failures) console.error(`  [FAIL] ${f}`);
      console.log('\nCONSTITUTIONAL VERDICT: FAIL');
      process.exit(1);
    }

    console.log('\nCONSTITUTIONAL VERDICT: PASS');
    console.log(`  DB snapshot → PRE stable across ${RUNS} runs`);
    console.log(`  PRE confirmed read-only (no writes to audit table)`);
    console.log(`  Deterministic checksum: ${stableChecksum}`);

  } finally {
    await closePool();
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
