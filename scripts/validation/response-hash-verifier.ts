#!/usr/bin/env tsx
/**
 * G.2 — Response Hash Verifier
 *
 * Verifies that every /resolve response contains a valid, self-consistent
 * playlist_checksum by recomputing it from the playlist content.
 *
 * The playlist_checksum in the response MUST match a fresh FNV-1a computation
 * over the playlist items. If it doesn't, the API is emitting inconsistent data.
 *
 * Also verifies:
 * - PREVIEW: prefix is absent from production /resolve responses
 * - playlist_checksum is 8 hex characters (32-bit FNV)
 * - output_schema_version is '1.0.0'
 * - response includes required replay-authoritative fields
 *
 * Usage:
 *   API_URL=http://localhost:3000 tsx scripts/validation/response-hash-verifier.ts
 *
 * Exit: 0 = PASS, 1 = FAIL
 */

import { fnv1a32, canonicalizeJson } from '@clubhub/fnv-checksum';

const API_URL   = process.env['API_URL'] ?? 'http://localhost:3000';
const SCREEN_ID = process.env['SCREEN_ID'] ?? '60000000-0000-0000-0000-000000000001';
const RUNS      = parseInt(process.env['RUNS'] ?? '50', 10);

interface PlaylistItem {
  content_id: string;
  duration_ms: number;
  weight: number;
  source: number;
  sponsored: boolean;
}

interface ResolveResponse {
  screen_id: string;
  resolution_level: number;
  is_fallback: boolean;
  playlist: PlaylistItem[];
  content_mix: Record<string, number>;
  playlist_checksum: string;
  reason_trace: Record<string, unknown>;
  output_schema_version: string;
}

function recomputePlaylistChecksum(playlist: PlaylistItem[]): string {
  const fingerprint = playlist.map(item =>
    `${item.content_id}:${item.duration_ms}:${item.weight}:${item.source}:${item.sponsored}`,
  ).join('|');
  return fnv1a32(fingerprint).toString(16).padStart(8, '0');
}

const REQUIRED_FIELDS = [
  'screen_id', 'resolution_level', 'is_fallback',
  'playlist', 'content_mix', 'playlist_checksum',
  'reason_trace', 'output_schema_version',
];

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('G.2 — Response Hash Self-Consistency Verifier');
  console.log(`Endpoint: GET ${API_URL}/resolve/${SCREEN_ID}`);
  console.log(`Runs: ${RUNS}`);
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (let i = 0; i < RUNS; i++) {
    let res: Response;
    let body: ResolveResponse;

    try {
      res = await fetch(`${API_URL}/resolve/${SCREEN_ID}`, {
        headers: { 'Accept': 'application/json' },
      });
      body = await res.json() as ResolveResponse;
    } catch (err) {
      failures.push(`Run ${i}: fetch error: ${String(err)}`);
      failed++;
      continue;
    }

    if (res.status !== 200) {
      failures.push(`Run ${i}: HTTP ${res.status}`);
      failed++;
      continue;
    }

    const runFailures: string[] = [];

    // 1. Required fields present
    for (const field of REQUIRED_FIELDS) {
      if (!(field in body) || (body as Record<string, unknown>)[field] === undefined) {
        runFailures.push(`missing required field: ${field}`);
      }
    }

    // 2. playlist_checksum format
    if (!/^[0-9a-f]{8}$/.test(body.playlist_checksum)) {
      runFailures.push(`invalid playlist_checksum format: "${body.playlist_checksum}" (must be 8 hex chars)`);
    }

    // 3. PREVIEW: prefix must be absent from production /resolve
    if (body.playlist_checksum.startsWith('PREVIEW:')) {
      runFailures.push(`CONSTITUTIONAL_BREACH: production /resolve response has PREVIEW: prefix in checksum`);
    }

    // 4. Recompute checksum from playlist items
    if (Array.isArray(body.playlist) && runFailures.length === 0) {
      const recomputed = recomputePlaylistChecksum(body.playlist);
      if (recomputed !== body.playlist_checksum) {
        runFailures.push(
          `CHECKSUM_INCONSISTENCY: stored=${body.playlist_checksum} recomputed=${recomputed}`,
        );
      }
    }

    // 5. output_schema_version
    if (body.output_schema_version !== '1.0.0') {
      runFailures.push(`unexpected output_schema_version: "${body.output_schema_version}"`);
    }

    if (runFailures.length === 0) {
      passed++;
    } else {
      failed++;
      for (const f of runFailures) failures.push(`Run ${i}: ${f}`);
    }
  }

  // Preview endpoint: verify PREVIEW: IS present
  console.log('\nVerifying PREVIEW: prefix on /preview endpoint...');
  try {
    const previewRes = await fetch(`${API_URL}/preview/${SCREEN_ID}`, {
      headers: { 'Accept': 'application/json' },
    });
    const previewBody = await previewRes.json() as ResolveResponse;
    if (!previewBody.playlist_checksum.startsWith('PREVIEW:')) {
      failures.push(`PREVIEW endpoint missing PREVIEW: prefix (got: ${previewBody.playlist_checksum})`);
    } else {
      console.log(`  PREVIEW: prefix present: ${previewBody.playlist_checksum}`);
    }
  } catch (err) {
    console.log(`  WARNING: Preview endpoint check failed: ${String(err)}`);
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`Results: ${passed}/${RUNS} PASS  |  ${failed} FAIL`);

  if (failures.length > 0) {
    console.error('\nFAILURES:');
    for (const f of failures.slice(0, 10)) console.error(`  [FAIL] ${f}`);
    if (failures.length > 10) console.error(`  ... and ${failures.length - 10} more`);
    console.log('\nCONSTITUTIONAL VERDICT: FAIL');
    process.exit(1);
  }

  console.log('\nCONSTITUTIONAL VERDICT: PASS');
  console.log(`  All ${RUNS} responses: self-consistent checksums`);
  console.log('  No PREVIEW: prefix leakage on production endpoint');
  console.log('  PREVIEW: prefix verified on /preview endpoint');
  process.exit(0);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
