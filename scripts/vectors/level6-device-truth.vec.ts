/**
 * Contract vector: LEVEL_6 — Device truth annotation
 *
 * Tests:
 *   V6-1: No delivery log → CONFIDENCE_NO_DELIVERY_LOG (0.50), last_seen_ms_ago=-1
 *   V6-2: Fresh delivery, checksum matches → CONFIDENCE_FULL (0.97)
 *   V6-3: Fresh delivery, checksum mismatch → CONFIDENCE_CHECKSUM_MISMATCH (0.60)
 *   V6-4: Stale delivery (>30min ago) → CONFIDENCE_STALE (0.30)
 */

import { annotateLevel6 } from '../../src/pre/levels/level6-device-truth';
import {
  CONFIDENCE_FULL,
  CONFIDENCE_CHECKSUM_MISMATCH,
  CONFIDENCE_NO_DELIVERY_LOG,
  CONFIDENCE_STALE,
  CONFIDENCE_MAX_AGE_MS,
  LEVEL_3_CAMPAIGN,
  LEVEL_6_DEVICE_TRUTH,
} from '../../src/pre/constants';
import type { ScreenDeliveryLogRecord, PlaylistItem } from '../../src/pre/types';
import { buildInput, AT, CONTENT_A, assert, assertEqual, summary } from './_fixture';

console.log('=== LEVEL_6 Device Truth Annotation — Contract Vectors ===\n');

const baseInput = buildInput();
const playlist: PlaylistItem[] = [
  { content_id: CONTENT_A.id, duration_ms: 15_000, weight: 1, source: LEVEL_3_CAMPAIGN, sponsored: false },
];
const CHECKSUM = 'abcd1234';
const DIFFERENT_CHECKSUM = '99999999';

function makeDelivery(partial: Partial<ScreenDeliveryLogRecord>): ScreenDeliveryLogRecord {
  return {
    id:               'dlv-001',
    screen_id:        'screen-001',
    delivered_at:     AT - 60_000, // 1 minute ago
    checksum:         CHECKSUM,
    resolution_level: LEVEL_6_DEVICE_TRUTH,
    ...partial,
  };
}

// ─── V6-1: No delivery log ────────────────────────────────────────────────────
console.log('V6-1: No delivery log → CONFIDENCE_NO_DELIVERY_LOG (0.50)');
{
  const result = annotateLevel6(baseInput, playlist, null, CHECKSUM);

  assertEqual(result.confidence_score, CONFIDENCE_NO_DELIVERY_LOG, 'confidence = 0.50');
  // corpus-verified: outcome is RESOLVED (Level 6 always annotates, never skips)
  assertEqual(result.trace.outcome, 'RESOLVED', 'outcome RESOLVED (L6 always annotates)');
  // corpus-verified: null (not -1) when no delivery log exists
  assertEqual(result.trace.last_seen_ms_ago as unknown, null, 'last_seen_ms_ago = null when no log');
  assertEqual(result.trace.checksum_match, false, 'checksum_match = false');
}

// ─── V6-2: Fresh delivery, checksum matches ────────────────────────────────────
console.log('\nV6-2: Fresh delivery, checksum match → CONFIDENCE_FULL (0.97)');
{
  const delivery = makeDelivery({ delivered_at: AT - 60_000, checksum: CHECKSUM });
  const result = annotateLevel6(baseInput, playlist, delivery, CHECKSUM);

  assertEqual(result.confidence_score, CONFIDENCE_FULL, 'confidence = 0.97');
  assertEqual(result.trace.outcome, 'RESOLVED', 'outcome RESOLVED');
  assertEqual(result.trace.checksum_match, true, 'checksum_match = true');
  assertEqual(result.trace.last_seen_ms_ago, 60_000, 'last_seen_ms_ago = 60000');
}

// ─── V6-3: Fresh delivery, checksum mismatch ──────────────────────────────────
console.log('\nV6-3: Fresh delivery, checksum mismatch → CONFIDENCE_CHECKSUM_MISMATCH (0.60)');
{
  const delivery = makeDelivery({ delivered_at: AT - 60_000, checksum: DIFFERENT_CHECKSUM });
  const result = annotateLevel6(baseInput, playlist, delivery, CHECKSUM);

  assertEqual(result.confidence_score, CONFIDENCE_CHECKSUM_MISMATCH, 'confidence = 0.60');
  assertEqual(result.trace.checksum_match, false, 'checksum_match = false');
}

// ─── V6-4: Stale delivery (>30min) → CONFIDENCE_STALE ────────────────────────
console.log('\nV6-4: Stale delivery → CONFIDENCE_STALE (0.30)');
{
  // Delivered more than 30 minutes ago
  const staleDeliveredAt = AT - (CONFIDENCE_MAX_AGE_MS + 1);
  const delivery = makeDelivery({ delivered_at: staleDeliveredAt, checksum: CHECKSUM });
  const result = annotateLevel6(baseInput, playlist, delivery, CHECKSUM);

  assertEqual(result.confidence_score, CONFIDENCE_STALE, 'confidence = 0.30');
  assert(result.trace.last_seen_ms_ago > CONFIDENCE_MAX_AGE_MS, 'age > 30min threshold');
  // Even though checksum matches, stale delivery overrides to CONFIDENCE_STALE
  assertEqual(result.trace.checksum_match, true, 'checksum_match = true (but stale)');
}

summary('level6-device-truth.vec');
