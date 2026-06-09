/**
 * Contract vector: LEVEL_3 — Campaign/schedule resolution
 *
 * Tests:
 *   V3-1: No schedules → empty playlist, SKIP outcome
 *   V3-2: Single regular schedule → resolved playlist with SWRR
 *   V3-3: Deduplication — same content_id at two specificities → keep higher
 *   V3-4: Fallback-only schedules → FALLBACK outcome
 *   V3-5: Priority used as SWRR weight (weight = max(1, priority))
 */

import { resolveLevel3 } from '../../src/pre/levels/level3-campaign';
import { LEVEL_3_CAMPAIGN } from '../../src/pre/constants';
import type { ScheduleRecord } from '../../src/pre/types';
import { buildInput, AT, CONTENT_A, CONTENT_B, assert, assertEqual, summary } from './_fixture';

console.log('=== LEVEL_3 Campaign/Schedule — Contract Vectors ===\n');

function makeSchedule(partial: Partial<ScheduleRecord> & { id: string; content_id: string; target_type: ScheduleRecord['target_type']; target_id: string }): ScheduleRecord {
  return {
    campaign_id:         null,
    specificity:         1,
    starts_at:           AT - 3_600_000,
    expires_at:          null,
    days_of_week:        [],
    start_time_minutes:  null,
    end_time_minutes:    null,
    is_active:           true,
    is_fallback:         false,
    priority:            100,
    ...partial,
  };
}

const baseInput = buildInput();

// ─── V3-1: No schedules → empty playlist ─────────────────────────────────────
console.log('V3-1: No schedules → empty playlist, SKIP');
{
  const result = resolveLevel3(baseInput, []);
  assertEqual(result.playlist.length, 0, 'empty playlist');
  assertEqual(result.traceEntry.outcome, 'SKIP', 'outcome SKIP');
  assertEqual(result.terminatingLevel, LEVEL_3_CAMPAIGN, 'terminatingLevel = LEVEL_3');
}

// ─── V3-2: Single regular schedule → resolved ────────────────────────────────
console.log('\nV3-2: Single schedule → resolved playlist');
{
  const schedule = makeSchedule({
    id:          'sched-001',
    content_id:  CONTENT_A.id,
    target_type: 'venue',
    target_id:   'venue-001',
    priority:    100,
  });
  const result = resolveLevel3(baseInput, [schedule]);

  assert(result.playlist.length > 0, 'playlist not empty');
  assertEqual(result.playlist[0]!.content_id, CONTENT_A.id, 'content_id correct');
  assertEqual(result.playlist[0]!.source, LEVEL_3_CAMPAIGN, 'source = LEVEL_3');
  assertEqual(result.playlist[0]!.sponsored, false, 'not sponsored');
  assertEqual(result.traceEntry.outcome, 'RESOLVED', 'outcome RESOLVED');
  assertEqual((result.traceEntry as any).schedule_id, 'sched-001', 'schedule_id in trace');
  assertEqual((result.traceEntry as any).specificity, 1, 'specificity in trace');
}

// ─── V3-3: Deduplication — same content_id at two specificities ───────────────
console.log('\nV3-3: Deduplication — venue and screen schedules for same content → screen wins');
{
  const venueSchedule = makeSchedule({
    id:          'sched-venue',
    content_id:  CONTENT_A.id,
    target_type: 'venue',
    target_id:   'venue-001',
    specificity: 1,
    priority:    100,
  });
  const screenSchedule = makeSchedule({
    id:          'sched-screen',
    content_id:  CONTENT_A.id,
    target_type: 'screen',
    target_id:   'screen-001',
    specificity: 4,
    priority:    50, // lower priority, but higher specificity → should win
  });

  const result = resolveLevel3(baseInput, [venueSchedule, screenSchedule]);

  // After deduplication: only 1 item for CONTENT_A (screen wins over venue)
  const contentAItems = result.playlist.filter(p => p.content_id === CONTENT_A.id);
  assert(contentAItems.length > 0, 'content-a in playlist');
  // After dedup, the screen schedule wins (specificity=4 > venue specificity=1)
  assertEqual((result.traceEntry as any).specificity, 4, 'screen specificity=4 wins');
}

// ─── V3-4: Fallback-only schedules → FALLBACK outcome ────────────────────────
console.log('\nV3-4: Fallback-only schedules → FALLBACK outcome');
{
  const fallbackSchedule = makeSchedule({
    id:          'sched-fallback',
    content_id:  CONTENT_B.id,
    target_type: 'venue',
    target_id:   'venue-001',
    is_fallback: true,
  });
  const result = resolveLevel3(baseInput, [fallbackSchedule]);

  assert(result.playlist.length > 0, 'playlist not empty');
  assertEqual(result.traceEntry.outcome, 'FALLBACK', 'outcome FALLBACK');
}

// ─── V3-5: Priority as SWRR weight ───────────────────────────────────────────
console.log('\nV3-5: Priority-weighted SWRR — two schedules with different priorities');
{
  const heavy = makeSchedule({
    id:          'sched-heavy',
    content_id:  CONTENT_A.id,
    target_type: 'screen',
    target_id:   'screen-001',
    specificity: 4,
    priority:    3,
  });
  const light = makeSchedule({
    id:          'sched-light',
    content_id:  CONTENT_B.id,
    target_type: 'venue',
    target_id:   'venue-001',
    specificity: 1,
    priority:    1,
  });
  const result = resolveLevel3(baseInput, [heavy, light]);

  // SWRR with weights 3:1 → 4 total items, 3 of CONTENT_A and 1 of CONTENT_B
  const aCount = result.playlist.filter(p => p.content_id === CONTENT_A.id).length;
  const bCount = result.playlist.filter(p => p.content_id === CONTENT_B.id).length;
  assertEqual(aCount, 3, 'CONTENT_A appears 3 times (weight=3)');
  assertEqual(bCount, 1, 'CONTENT_B appears 1 time (weight=1)');
  assertEqual(result.playlist.length, 4, 'total 4 items (3+1)');
}

summary('level3-campaign.vec');
