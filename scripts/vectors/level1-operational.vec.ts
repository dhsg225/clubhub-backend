/**
 * Contract vector: LEVEL_1 — Operational override resolution
 *
 * Tests:
 *   V1-1: No overrides → returns null
 *   V1-2: Single screen-scoped override → resolved playlist
 *   V1-3: Multiple overrides → highest specificity wins (screen > venue)
 *   V1-4: Override with unknown content_id → system fallback content
 */

import { resolveLevel1 } from '../../src/pre/levels/level1-operational';
import {
  LEVEL_1_OPERATIONAL,
  SYSTEM_FALLBACK_CONTENT_ID,
  SYSTEM_FALLBACK_DURATION_MS,
} from '../../src/pre/constants';
import type { OverrideRecord } from '../../src/pre/types';
import { buildInput, AT, CONTENT_A, CONTENT_B, assert, assertEqual, summary } from './_fixture';

console.log('=== LEVEL_1 Operational Override — Contract Vectors ===\n');

function makeOverride(partial: Partial<OverrideRecord> & { id: string; content_id: string; target_type: OverrideRecord['target_type']; target_id: string }): OverrideRecord {
  return {
    starts_at:      AT - 60_000,
    expires_at:     null,
    is_operational: true,
    priority:       100,
    reason:         null,
    issued_by:      null,
    ...partial,
  };
}

const baseInput = buildInput();

// ─── V1-1: No overrides ───────────────────────────────────────────────────────
console.log('V1-1: No overrides → null');
{
  const result = resolveLevel1(baseInput, []);
  assert(result === null, 'resolveLevel1(empty overrides) returns null');
}

// ─── V1-2: Single screen-scoped override ─────────────────────────────────────
console.log('\nV1-2: Single screen override → resolved');
{
  const override = makeOverride({
    id:          'ov-001',
    content_id:  CONTENT_A.id,
    target_type: 'screen',
    target_id:   'screen-001',
  });
  const result = resolveLevel1(baseInput, [override]);

  assert(result !== null, 'result not null');
  assertEqual(result!.playlist.length, 1, 'playlist has 1 item');
  assertEqual(result!.playlist[0]!.content_id, CONTENT_A.id, 'content_id matches');
  assertEqual(result!.playlist[0]!.source, LEVEL_1_OPERATIONAL, 'source = LEVEL_1');
  assertEqual(result!.playlist[0]!.sponsored, false, 'not sponsored');
  assertEqual(result!.terminatingLevel, LEVEL_1_OPERATIONAL, 'terminatingLevel = LEVEL_1');
  assertEqual(result!.traceEntry.outcome, 'RESOLVED', 'outcome RESOLVED');
  assert((result!.traceEntry as any).override_id === 'ov-001', 'override_id in trace');
}

// ─── V1-3: Multiple overrides — first (highest specificity) wins ──────────────
console.log('\nV1-3: Multiple overrides → first (pre-sorted) wins');
{
  // Pre-sorted by caller (getActiveOverrides): screen first, venue second
  const screenOverride = makeOverride({
    id:          'ov-screen',
    content_id:  CONTENT_A.id,
    target_type: 'screen',
    target_id:   'screen-001',
  });
  const venueOverride = makeOverride({
    id:          'ov-venue',
    content_id:  CONTENT_B.id,
    target_type: 'venue',
    target_id:   'venue-001',
  });
  // Caller is responsible for sort; pass screen-first as per getActiveOverrides output
  const result = resolveLevel1(baseInput, [screenOverride, venueOverride]);

  assert(result !== null, 'result not null');
  assertEqual(result!.playlist[0]!.content_id, CONTENT_A.id, 'screen override wins over venue');
}

// ─── V1-4: Unknown content_id → system fallback ───────────────────────────────
console.log('\nV1-4: Unknown content_id → system fallback');
{
  const override = makeOverride({
    id:          'ov-unknown',
    content_id:  'content-does-not-exist',
    target_type: 'screen',
    target_id:   'screen-001',
  });
  const result = resolveLevel1(baseInput, [override]);

  assert(result !== null, 'result not null');
  assertEqual(result!.playlist[0]!.content_id, SYSTEM_FALLBACK_CONTENT_ID, 'falls back to system fallback');
  assertEqual(result!.playlist[0]!.duration_ms, SYSTEM_FALLBACK_DURATION_MS, 'fallback duration');
}

summary('level1-operational.vec');
