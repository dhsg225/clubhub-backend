#!/usr/bin/env tsx
/**
 * G.2 — Real API Determinism Validation
 *
 * Fires 1000 requests to GET /resolve/:screen_id in parallel batches of 50.
 * Extracts replay-authoritative fields from each response.
 * ANY variance in those fields = constitutional failure.
 *
 * Fields excluded from comparison (legitimately variable):
 * - correlation_id (generated per request)
 * - at_utc_ms (response timestamp, not evaluation timestamp)
 *
 * Fields that MUST be byte-identical across all 1000 responses:
 * - playlist_checksum
 * - resolution_level
 * - is_fallback
 * - playlist (items, order, weights)
 * - content_mix
 *
 * Usage:
 *   API_URL=http://localhost:3000 tsx scripts/validation/api-determinism.ts
 *
 * Exit: 0 = PASS, 1 = FAIL
 */

import { createHash } from 'node:crypto';

const API_URL  = process.env['API_URL'] ?? 'http://localhost:3000';
const SCREEN_ID = process.env['SCREEN_ID'] ?? '60000000-0000-0000-0000-000000000001';
const TOTAL_REQUESTS  = parseInt(process.env['TOTAL_REQUESTS'] ?? '1000', 10);
const BATCH_SIZE      = parseInt(process.env['BATCH_SIZE'] ?? '50', 10);
const EVAL_AT_MS      = 1748264400000; // Fixed: 2026-05-26 Tuesday 14:00 UTC

interface ResolveResponse {
  screen_id: string;
  resolution_level: number;
  is_fallback: boolean;
  playlist: unknown[];
  content_mix: unknown;
  playlist_checksum: string;
  reason_trace: unknown;
  output_schema_version: string;
  correlation_id: string;  // excluded from comparison
  at_utc_ms: number;       // excluded from comparison
}

interface BatchResult {
  batchIndex: number;
  success: number;
  errors: string[];
  hashes: string[];
  checksums: string[];
  statusCodes: number[];
}

function replayAuthoritativeHash(r: ResolveResponse): string {
  const fields = {
    screen_id: r.screen_id,
    resolution_level: r.resolution_level,
    is_fallback: r.is_fallback,
    playlist: r.playlist,
    content_mix: r.content_mix,
    playlist_checksum: r.playlist_checksum,
    reason_trace: r.reason_trace,
    output_schema_version: r.output_schema_version,
  };
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex').slice(0, 16);
}

async function fetchResolve(): Promise<{ status: number; body: ResolveResponse }> {
  const res = await fetch(`${API_URL}/resolve/${SCREEN_ID}?at=${EVAL_AT_MS}`, {
    headers: {
      'Accept': 'application/json',
      'X-Correlation-Id': `det-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
  });
  const body = await res.json() as ResolveResponse;
  return { status: res.status, body };
}

async function runBatch(batchIndex: number, size: number): Promise<BatchResult> {
  const promises = Array.from({ length: size }, () => fetchResolve());
  const settled = await Promise.allSettled(promises);

  const result: BatchResult = {
    batchIndex,
    success: 0,
    errors: [],
    hashes: [],
    checksums: [],
    statusCodes: [],
  };

  for (const s of settled) {
    if (s.status === 'rejected') {
      result.errors.push(String(s.reason));
    } else {
      const { status, body } = s.value;
      result.statusCodes.push(status);
      if (status === 200) {
        result.success++;
        result.hashes.push(replayAuthoritativeHash(body));
        result.checksums.push(body.playlist_checksum);
      } else {
        result.errors.push(`HTTP ${status}: ${JSON.stringify(body).slice(0, 100)}`);
      }
    }
  }

  return result;
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('G.2 — Real API Determinism Validation');
  console.log(`Endpoint: GET ${API_URL}/resolve/${SCREEN_ID}`);
  console.log(`Total requests: ${TOTAL_REQUESTS} (batches of ${BATCH_SIZE})`);
  console.log(`Eval timestamp: ${EVAL_AT_MS}`);
  console.log('='.repeat(70));

  // Connectivity check
  try {
    const health = await fetch(`${API_URL}/health/live`);
    if (!health.ok) throw new Error(`Health check HTTP ${health.status}`);
    console.log('  API health: OK\n');
  } catch (err) {
    console.error(`  [FATAL] API not reachable at ${API_URL}: ${String(err)}`);
    console.error('  Start the API first: JWT_VERIFY=false pnpm --filter cms-api dev');
    process.exit(1);
  }

  const allHashes = new Set<string>();
  const allChecksums = new Set<string>();
  let totalSuccess = 0;
  let totalErrors = 0;
  const numBatches = Math.ceil(TOTAL_REQUESTS / BATCH_SIZE);

  for (let b = 0; b < numBatches; b++) {
    const size = Math.min(BATCH_SIZE, TOTAL_REQUESTS - b * BATCH_SIZE);
    process.stdout.write(`  Batch ${(b + 1).toString().padStart(3)}/${numBatches} (${size} req)... `);

    const result = await runBatch(b, size);
    totalSuccess += result.success;
    totalErrors += result.errors.length;
    for (const h of result.hashes) allHashes.add(h);
    for (const c of result.checksums) allChecksums.add(c);

    if (result.errors.length === 0) {
      console.log(`OK (${result.success}/${size})`);
    } else {
      console.log(`ERRORS: ${result.errors.length}/${size} failed`);
      for (const e of result.errors.slice(0, 3)) {
        console.log(`    ${e}`);
      }
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`Total requests:          ${TOTAL_REQUESTS}`);
  console.log(`Successful (HTTP 200):   ${totalSuccess}`);
  console.log(`Failed:                  ${totalErrors}`);
  console.log(`Distinct response hashes:  ${allHashes.size} (expected: 1)`);
  console.log(`Distinct playlist_checksum: ${allChecksums.size} (expected: 1)`);

  const failures: string[] = [];

  if (totalErrors > 0) {
    failures.push(`${totalErrors}/${TOTAL_REQUESTS} requests failed`);
  }
  if (allHashes.size > 1) {
    failures.push(`NONDETERMINISM: ${allHashes.size} distinct replay-authoritative response hashes`);
  }
  if (allChecksums.size > 1) {
    failures.push(`NONDETERMINISM: ${allChecksums.size} distinct playlist_checksum values`);
  }

  if (failures.length > 0) {
    console.error('\nFAILURES:');
    for (const f of failures) console.error(`  [FAIL] ${f}`);
    console.log('\nCONSTITUTIONAL VERDICT: FAIL — API response not deterministic');
    process.exit(1);
  }

  const stableChecksum = [...allChecksums][0]!;
  console.log(`\nStable playlist_checksum: ${stableChecksum}`);
  console.log('\nCONSTITUTIONAL VERDICT: PASS');
  console.log(`  ${TOTAL_REQUESTS} requests: byte-identical replay-authoritative payloads`);
  console.log('  Zero nondeterminism detected across concurrent + sequential requests');
  process.exit(0);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
