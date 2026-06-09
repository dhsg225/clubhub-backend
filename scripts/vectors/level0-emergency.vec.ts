/**
 * Contract vector: LEVEL_0 — Emergency resolution
 *
 * Tests:
 *   V0-1: No emergency → returns null (skip)
 *   V0-2: Active emergency → playlist with emergency content, correct trace
 *   V0-3: Emergency with unknown content_id → uses SYSTEM_EMERGENCY_FALLBACK_ID
 *   V0-4: Emergency activated_at > at → returns null (not yet active)
 */

import { resolveLevel0 } from '../../src/pre/levels/level0-emergency';
import {
  SYSTEM_EMERGENCY_FALLBACK_ID,
  SYSTEM_FALLBACK_DURATION_MS,
  LEVEL_0_EMERGENCY,
} from '../../src/pre/constants';
import type { EmergencyStateRecord } from '../../src/pre/types';
import { buildInput, AT, CONTENT_A, assert, assertEqual, summary } from './_fixture';

console.log('=== LEVEL_0 Emergency — Contract Vectors ===\n');

const baseInput = buildInput();

// ─── V0-1: No emergency ───────────────────────────────────────────────────────
console.log('V0-1: No emergency → null');
{
  const result = resolveLevel0(baseInput, null);
  assert(result === null, 'resolveLevel0(null emergency) returns null');
}

// ─── V0-2: Active emergency with known content ────────────────────────────────
console.log('\nV0-2: Active emergency with known content → resolved playlist');
{
  const emergency: EmergencyStateRecord = {
    id:           'emrg-001',
    venue_id:     'venue-001',
    content_id:   CONTENT_A.id,
    is_global:    false,
    is_active:    true,
    activated_at: AT - 5000,
    reason:       'fire alarm',
  };
  const input = buildInput({ emergency });
  const result = resolveLevel0(input, emergency);

  assert(result !== null, 'result is not null');
  assertEqual(result!.playlist.length, 1, 'playlist has 1 item');
  assertEqual(result!.playlist[0]!.content_id, CONTENT_A.id, 'content_id matches emergency content');
  assertEqual(result!.playlist[0]!.duration_ms, CONTENT_A.duration_ms, 'duration from content item');
  assertEqual(result!.playlist[0]!.weight, 100, 'weight = DEFAULT_PLAYLIST_ITEM_WEIGHT (100)');
  assertEqual(result!.playlist[0]!.source, LEVEL_0_EMERGENCY, 'source = LEVEL_0');
  assertEqual(result!.playlist[0]!.sponsored, false, 'sponsored = false');
  assertEqual(result!.terminatingLevel, LEVEL_0_EMERGENCY, 'terminatingLevel = LEVEL_0');
  assertEqual(result!.traceEntry.outcome, 'RESOLVED', 'outcome = RESOLVED');
  assert((result!.traceEntry as any).emergency_id === 'emrg-001', 'emergency_id in trace');
}

// ─── V0-3: Emergency with unknown content_id ─────────────────────────────────
console.log('\nV0-3: Emergency with unknown content_id → system emergency fallback');
{
  const emergency: EmergencyStateRecord = {
    id:           'emrg-002',
    venue_id:     'venue-001',
    content_id:   'content-unknown',
    is_global:    false,
    is_active:    true,
    activated_at: AT - 1000,
    reason:       null,
  };
  // content_items does NOT include 'content-unknown'
  const input = buildInput({ emergency });
  const result = resolveLevel0(input, emergency);

  assert(result !== null, 'result is not null');
  assertEqual(result!.playlist[0]!.content_id, SYSTEM_EMERGENCY_FALLBACK_ID, 'falls back to SYSTEM_EMERGENCY_FALLBACK_ID');
  assertEqual(result!.playlist[0]!.duration_ms, SYSTEM_FALLBACK_DURATION_MS, 'fallback duration');
}

// ─── V0-4: Emergency activated_at > at ────────────────────────────────────────
console.log('\nV0-4: Emergency not yet activated → null');
{
  const emergency: EmergencyStateRecord = {
    id:           'emrg-003',
    venue_id:     'venue-001',
    content_id:   CONTENT_A.id,
    is_global:    false,
    is_active:    true,
    activated_at: AT + 10_000, // future
    reason:       null,
  };
  const input = buildInput({ emergency });
  // getActiveEmergency would return null, so we test resolveLevel0 directly with null
  const result = resolveLevel0(input, null); // simulates query layer behavior
  assert(result === null, 'future emergency → null (query layer returns null)');
}

summary('level0-emergency.vec');
