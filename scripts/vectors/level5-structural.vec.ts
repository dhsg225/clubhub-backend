/**
 * Contract vector: LEVEL_5 — Structural / system fallback
 *
 * Tests:
 *   V5-1: Non-empty playlist → pass-through, isFallback=false
 *   V5-2: Empty playlist → system fallback inserted, isFallback=true
 */

import { resolveLevel5 } from '../../src/pre/levels/level5-structural';
import {
  SYSTEM_FALLBACK_CONTENT_ID,
  SYSTEM_FALLBACK_DURATION_MS,
  LEVEL_5_STRUCTURAL,
  LEVEL_3_CAMPAIGN,
} from '../../src/pre/constants';
import type { PlaylistItem } from '../../src/pre/types';
import { CONTENT_A, assert, assertEqual, summary } from './_fixture';

console.log('=== LEVEL_5 Structural / Fallback — Contract Vectors ===\n');

const nonEmptyPlaylist: PlaylistItem[] = [
  { content_id: CONTENT_A.id, duration_ms: 15_000, weight: 1, source: LEVEL_3_CAMPAIGN, sponsored: false },
];

// ─── V5-1: Non-empty playlist → pass-through ─────────────────────────────────
console.log('V5-1: Non-empty playlist → unchanged, isFallback=false');
{
  const result = resolveLevel5(nonEmptyPlaylist);

  assertEqual(result.isFallback, false, 'isFallback = false');
  assertEqual(result.playlist, nonEmptyPlaylist, 'playlist unchanged');
}

// ─── V5-2: Empty playlist → system fallback ───────────────────────────────────
console.log('\nV5-2: Empty playlist → system fallback, isFallback=true');
{
  const result = resolveLevel5([]);

  assertEqual(result.isFallback, true, 'isFallback = true');
  assertEqual(result.playlist.length, 1, 'exactly 1 fallback item');
  assertEqual(result.playlist[0]!.content_id, SYSTEM_FALLBACK_CONTENT_ID, 'system fallback content_id');
  assertEqual(result.playlist[0]!.duration_ms, SYSTEM_FALLBACK_DURATION_MS, 'fallback duration = 30000ms');
  assertEqual(result.playlist[0]!.source, LEVEL_5_STRUCTURAL, 'source = LEVEL_5');
  assertEqual(result.playlist[0]!.weight, 100, 'weight = DEFAULT_PLAYLIST_ITEM_WEIGHT (100)');
  assertEqual(result.playlist[0]!.sponsored, false, 'not sponsored');
}

summary('level5-structural.vec');
