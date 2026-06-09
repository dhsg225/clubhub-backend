/**
 * Contract vector: LEVEL_2 — Scheduled override resolution
 *
 * Tests:
 *   V2-1: No scheduled overrides → null
 *   V2-2: Single scheduled override → resolved playlist with source=2
 *   V2-3: Override with unknown content_id → system fallback
 */

import { resolveLevel2 } from '../../src/pre/levels/level2-scheduled';
import {
  LEVEL_2_SCHEDULED,
  SYSTEM_FALLBACK_CONTENT_ID,
} from '../../src/pre/constants';
import type { OverrideRecord } from '../../src/pre/types';
import { buildInput, AT, CONTENT_B, assert, assertEqual, summary } from './_fixture';

console.log('=== LEVEL_2 Scheduled Override — Contract Vectors ===\n');

function makeScheduledOverride(partial: Partial<OverrideRecord> & { id: string; content_id: string; target_type: OverrideRecord['target_type']; target_id: string }): OverrideRecord {
  return {
    starts_at:      AT - 60_000,
    expires_at:     AT + 3_600_000, // expires 1 hour from now
    is_operational: false,
    priority:       100,
    reason:         null,
    issued_by:      null,
    ...partial,
  };
}

const baseInput = buildInput();

// ─── V2-1: No overrides ───────────────────────────────────────────────────────
console.log('V2-1: No scheduled overrides → null');
{
  const result = resolveLevel2(baseInput, []);
  assert(result === null, 'resolveLevel2(empty) returns null');
}

// ─── V2-2: Single scheduled override ─────────────────────────────────────────
console.log('\nV2-2: Scheduled override → resolved with source=LEVEL_2');
{
  const override = makeScheduledOverride({
    id:          'sov-001',
    content_id:  CONTENT_B.id,
    target_type: 'venue',
    target_id:   'venue-001',
  });
  const result = resolveLevel2(baseInput, [override]);

  assert(result !== null, 'result not null');
  assertEqual(result!.playlist.length, 1, 'playlist has 1 item');
  assertEqual(result!.playlist[0]!.content_id, CONTENT_B.id, 'content_id matches');
  assertEqual(result!.playlist[0]!.source, LEVEL_2_SCHEDULED, 'source = LEVEL_2');
  assertEqual(result!.playlist[0]!.sponsored, false, 'not sponsored');
  assertEqual(result!.terminatingLevel, LEVEL_2_SCHEDULED, 'terminatingLevel = LEVEL_2');
  assertEqual(result!.traceEntry.outcome, 'RESOLVED', 'outcome RESOLVED');
  assert((result!.traceEntry as any).override_id === 'sov-001', 'override_id in trace');
  assertEqual((result!.traceEntry as any).target_type, 'venue', 'target_type in trace');
}

// ─── V2-3: Unknown content_id → system fallback ───────────────────────────────
console.log('\nV2-3: Unknown content_id → system fallback');
{
  const override = makeScheduledOverride({
    id:          'sov-unknown',
    content_id:  'content-gone',
    target_type: 'area',
    target_id:   'area-001',
  });
  const result = resolveLevel2(baseInput, [override]);

  assert(result !== null, 'result not null');
  assertEqual(result!.playlist[0]!.content_id, SYSTEM_FALLBACK_CONTENT_ID, 'system fallback');
}

summary('level2-scheduled.vec');
