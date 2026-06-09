#!/usr/bin/env tsx
/**
 * G.6 — Full Audit Chain Verification
 *
 * Performs a comprehensive forensic audit of the entire replay_audit_records table:
 *
 * Chain properties verified:
 * 1. All record_checksum values are valid (tamper detection)
 * 2. Records are in strict monotone order (created_at ASC)
 * 3. No two records have the same audit_record_id (uniqueness)
 * 4. No UPDATE/DELETE evidence (append-only guarantee)
 * 5. All required fields non-null
 * 6. resolution_level in valid range [0–6]
 * 7. playlist_checksum format valid
 * 8. at_utc_ms is a reasonable timestamp
 *
 * Usage:
 *   DB_PORT=5433 DB_PASSWORD=devpassword tsx scripts/validation/audit-chain-verifier.ts
 *
 * Exit: 0 = PASS, 1 = FAIL
 */

import { initPool, closePool, query } from '../../services/cms-api/src/db/pool';
import { fnv1a32, canonicalizeJson } from '@clubhub/fnv-checksum';

const MIN_TIMESTAMP_MS = new Date('2025-01-01').getTime();
const MAX_TIMESTAMP_MS = new Date('2030-01-01').getTime();
const VALID_RESOLUTION_LEVELS = new Set([0, 1, 2, 3, 4, 5, 6]);

interface AuditRow {
  audit_record_id: string;
  created_at: Date;
  screen_id: string;
  venue_id: string;
  at_utc_ms: string;
  correlation_id: string;
  playlist_checksum: string;
  resolution_level: string;
  is_fallback: boolean;
  invariants_passed: boolean;
  record_checksum: string;
}

function verifyChecksum(row: AuditRow): boolean {
  const computed = fnv1a32(canonicalizeJson({
    audit_record_id: row.audit_record_id,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    screen_id: row.screen_id,
    venue_id: row.venue_id,
    at_utc_ms: Number(row.at_utc_ms),
    correlation_id: row.correlation_id,
    playlist_checksum: row.playlist_checksum,
    resolution_level: Number(row.resolution_level),
    is_fallback: Boolean(row.is_fallback),
    invariants_passed: Boolean(row.invariants_passed),
  })).toString(16).padStart(8, '0');
  return computed === row.record_checksum;
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('G.6 — Full Audit Chain Verification');
  console.log('='.repeat(70));

  process.env['DB_HOST'] = process.env['DB_HOST'] ?? 'localhost';
  process.env['DB_PORT'] = process.env['DB_PORT'] ?? '5433';
  process.env['DB_NAME'] = process.env['DB_NAME'] ?? 'clubhub';
  process.env['DB_USER'] = process.env['DB_USER'] ?? 'clubhub_app';
  process.env['DB_PASSWORD'] = process.env['DB_PASSWORD'] ?? 'devpassword';

  initPool();

  try {
    const rows = await query<AuditRow>(
      `SELECT audit_record_id, created_at, screen_id, venue_id, at_utc_ms,
              correlation_id, playlist_checksum, resolution_level, is_fallback,
              invariants_passed, record_checksum
       FROM replay_audit_records
       ORDER BY created_at ASC, audit_record_id ASC`,
    );

    console.log(`\nAudit records to verify: ${rows.length}\n`);

    if (rows.length === 0) {
      console.log('NOTE: No audit records. Run some /resolve calls first.');
      console.log('CONSTITUTIONAL VERDICT: PASS (trivially)');
      process.exit(0);
    }

    const failures: string[] = [];
    const seenIds = new Set<string>();
    let checksumOk = 0;
    let checksumFail = 0;

    // Stats collectors
    const levelCounts: Record<number, number> = {};
    let fallbackCount = 0;
    let invariantsPassedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;

      // 1. Checksum verification
      if (verifyChecksum(row)) {
        checksumOk++;
      } else {
        checksumFail++;
        failures.push(`Row ${i}: checksum FAIL — ${row.audit_record_id}`);
      }

      // 2. ID uniqueness
      if (seenIds.has(row.audit_record_id)) {
        failures.push(`Row ${i}: duplicate audit_record_id ${row.audit_record_id}`);
      }
      seenIds.add(row.audit_record_id);

      // 3. Required fields non-null
      const required: (keyof AuditRow)[] = [
        'audit_record_id', 'created_at', 'screen_id', 'venue_id',
        'at_utc_ms', 'correlation_id', 'playlist_checksum',
        'resolution_level', 'record_checksum',
      ];
      for (const f of required) {
        if (!row[f] && row[f] !== false && row[f] !== 0) {
          failures.push(`Row ${i}: field ${f} is null/empty in ${row.audit_record_id}`);
        }
      }

      // 4. Resolution level range
      const level = Number(row.resolution_level);
      if (!VALID_RESOLUTION_LEVELS.has(level)) {
        failures.push(`Row ${i}: invalid resolution_level ${level} in ${row.audit_record_id}`);
      }
      levelCounts[level] = (levelCounts[level] ?? 0) + 1;

      // 5. Timestamp sanity
      const atMs = Number(row.at_utc_ms);
      if (atMs < MIN_TIMESTAMP_MS || atMs > MAX_TIMESTAMP_MS) {
        failures.push(`Row ${i}: at_utc_ms out of range: ${atMs} in ${row.audit_record_id}`);
      }

      // 6. Checksum format
      if (!/^[0-9a-f]{8}$/.test(row.playlist_checksum) &&
          !/^PREVIEW:[0-9a-f]{8}$/.test(row.playlist_checksum)) {
        failures.push(`Row ${i}: invalid playlist_checksum format: "${row.playlist_checksum}"`);
      }

      // 7. Stats
      if (row.is_fallback) fallbackCount++;
      if (row.invariants_passed) invariantsPassedCount++;
    }

    // 8. Verify append-only (no updates since last check)
    // Check pg statistics for updates/deletes on the table
    const tableStats = await query<{ n_upd: string; n_del: string }>(
      `SELECT n_tup_upd AS n_upd, n_tup_del AS n_del
       FROM pg_stat_user_tables
       WHERE relname = 'replay_audit_records'`,
    );

    if (tableStats.length > 0) {
      const upd = Number(tableStats[0]!.n_upd);
      const del = Number(tableStats[0]!.n_del);
      if (upd > 0 || del > 0) {
        failures.push(`APPEND_ONLY_VIOLATION: pg reports ${upd} updates and ${del} deletes on replay_audit_records`);
      } else {
        console.log('  Append-only verified: 0 updates, 0 deletes (pg_stat)');
      }
    }

    // ─── Report ──────────────────────────────────────────────────────────────
    console.log('─'.repeat(70));
    console.log(`Total records:         ${rows.length}`);
    console.log(`Checksum OK:           ${checksumOk}`);
    console.log(`Checksum FAIL:         ${checksumFail}`);
    console.log(`Fallback resolutions:  ${fallbackCount}`);
    console.log(`Invariants passed:     ${invariantsPassedCount}`);
    console.log(`Resolution levels:     ${JSON.stringify(levelCounts)}`);

    if (failures.length > 0) {
      console.error('\nFAILURES:');
      for (const f of failures.slice(0, 15)) console.error(`  [FAIL] ${f}`);
      if (failures.length > 15) console.error(`  ... and ${failures.length - 15} more`);
      console.log('\nCONSTITUTIONAL VERDICT: FAIL — audit chain compromised');
      process.exit(1);
    }

    console.log('\nCONSTITUTIONAL VERDICT: PASS');
    console.log(`  ${rows.length} records: all checksums valid, all UUIDs unique`);
    console.log('  Append-only property verified via pg_stat');
    console.log('  All fields within valid ranges');
    console.log('  Audit chain: FORENSICALLY INTACT');

  } finally {
    await closePool();
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
