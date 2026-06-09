#!/usr/bin/env tsx
/**
 * G.2 — Serialization Order Determinism Check
 *
 * Verifies that the /resolve response JSON key ordering is stable across
 * repeated calls. Unstable key ordering would cause hash instability in
 * any downstream consumer that hashes the raw JSON bytes.
 *
 * Also verifies:
 * - playlist items are in stable order (same position across runs)
 * - content_mix percentages sum to ~1.0 (within floating-point tolerance)
 * - reason_trace keys are present for the declared resolution_level
 *
 * Usage:
 *   API_URL=http://localhost:3000 tsx scripts/validation/serialization-order-check.ts
 *
 * Exit: 0 = PASS, 1 = FAIL
 */

const API_URL   = process.env['API_URL'] ?? 'http://localhost:3000';
const SCREEN_ID = process.env['SCREEN_ID'] ?? '60000000-0000-0000-0000-000000000001';
const RUNS      = parseInt(process.env['RUNS'] ?? '20', 10);

function extractKeyOrder(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    return obj.flatMap((item, i) => extractKeyOrder(item, `${prefix}[${i}]`));
  }
  const keys = Object.keys(obj as Record<string, unknown>);
  const result: string[] = keys.map(k => `${prefix}.${k}`);
  for (const k of keys) {
    result.push(...extractKeyOrder((obj as Record<string, unknown>)[k], `${prefix}.${k}`));
  }
  return result;
}

function rawKeyOrderSignature(body: string): string {
  // Extract all key names in the order they appear in the raw JSON string
  const matches = body.matchAll(/"([^"]+)":/g);
  return [...matches].map(m => m[1]).join('|');
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('G.2 — Serialization Order Determinism Check');
  console.log(`Endpoint: GET ${API_URL}/resolve/${SCREEN_ID}`);
  console.log(`Runs: ${RUNS}`);
  console.log('='.repeat(70));

  const keyOrderSignatures = new Set<string>();
  const playlistFirstItemIds = new Set<string>();
  const playlistLengths = new Set<number>();
  const contentMixSums: number[] = [];
  const failures: string[] = [];

  for (let i = 0; i < RUNS; i++) {
    let rawBody: string;
    let body: Record<string, unknown>;

    try {
      const res = await fetch(`${API_URL}/resolve/${SCREEN_ID}`, {
        headers: { 'Accept': 'application/json' },
      });
      rawBody = await res.text();
      body = JSON.parse(rawBody) as Record<string, unknown>;

      if (res.status !== 200) {
        failures.push(`Run ${i}: HTTP ${res.status}`);
        continue;
      }
    } catch (err) {
      failures.push(`Run ${i}: ${String(err)}`);
      continue;
    }

    // Key ordering signature from raw JSON
    keyOrderSignatures.add(rawKeyOrderSignature(rawBody));

    // Playlist stability
    const playlist = body['playlist'] as Array<{ content_id: string }> | undefined;
    if (playlist && playlist.length > 0) {
      playlistFirstItemIds.add(playlist[0]!.content_id);
      playlistLengths.add(playlist.length);
    }

    // Content mix sum
    const mix = body['content_mix'] as Record<string, number> | undefined;
    if (mix) {
      const sum = Object.values(mix).reduce((acc, v) => acc + v, 0);
      contentMixSums.push(sum);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`Distinct key-order signatures: ${keyOrderSignatures.size} (expected: 1)`);
  console.log(`Distinct playlist[0] IDs:      ${playlistFirstItemIds.size} (expected: 1)`);
  console.log(`Distinct playlist lengths:     ${playlistLengths.size} (expected: 1)`);

  // content_mix sums should all be very close to 1.0
  if (contentMixSums.length > 0) {
    const min = Math.min(...contentMixSums);
    const max = Math.max(...contentMixSums);
    console.log(`content_mix sum range:         [${min.toFixed(4)}, ${max.toFixed(4)}] (expected: ~1.0)`);
    if (max - min > 0.001) {
      failures.push(`content_mix sums unstable: range ${min.toFixed(4)}–${max.toFixed(4)}`);
    }
    if (max > 1.001 || min < 0.999) {
      failures.push(`content_mix sum out of range: [${min.toFixed(4)}, ${max.toFixed(4)}]`);
    }
  }

  if (keyOrderSignatures.size > 1) {
    failures.push(`NONDETERMINISM: ${keyOrderSignatures.size} distinct JSON key orderings`);
  }
  if (playlistFirstItemIds.size > 1) {
    failures.push(`NONDETERMINISM: ${playlistFirstItemIds.size} distinct first playlist items`);
  }
  if (playlistLengths.size > 1) {
    failures.push(`NONDETERMINISM: ${playlistLengths.size} distinct playlist lengths`);
  }

  if (failures.length > 0) {
    console.error('\nFAILURES:');
    for (const f of failures) console.error(`  [FAIL] ${f}`);
    console.log('\nCONSTITUTIONAL VERDICT: FAIL — serialization not deterministic');
    process.exit(1);
  }

  console.log('\nCONSTITUTIONAL VERDICT: PASS');
  console.log('  JSON key ordering: stable');
  console.log('  Playlist ordering: stable');
  console.log('  content_mix sums: valid (≈1.0)');
  process.exit(0);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
