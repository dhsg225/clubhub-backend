/**
 * LEVEL_5 — Structural / system fallback.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.5
 * Always has outcome RESOLVED (normalizes playlist or applies system fallback).
 */

import type { PlaylistItem, ReasonTraceLevel } from '../types';
import {
  LEVEL_5_STRUCTURAL,
  SYSTEM_FALLBACK_CONTENT_ID,
  SYSTEM_FALLBACK_DURATION_MS,
  DEFAULT_PLAYLIST_ITEM_WEIGHT,
} from '../constants';

const SOURCE_NAMES: Record<number, string> = {
  0: 'emergency',
  1: 'override',
  2: 'scheduled_override',
  3: 'campaign',
  4: 'sponsorship',
  5: 'system',
};

export interface Level5Result {
  playlist:   PlaylistItem[];
  isFallback: boolean;
  trace:      ReasonTraceLevel;
}

export function resolveLevel5(playlist: PlaylistItem[], fallbackReason?: string): Level5Result {
  if (playlist.length > 0) {
    // Determine dominant source for trace
    const sourceName = SOURCE_NAMES[playlist[0]!.source] ?? 'unknown';
    return {
      playlist,
      isFallback: false,
      trace: {
        outcome: 'RESOLVED',
        reason:  `L5:NORMALIZED:${playlist.length}_item,source=${sourceName}`,
      },
    };
  }

  return {
    playlist: [
      {
        content_id:  SYSTEM_FALLBACK_CONTENT_ID,
        duration_ms: SYSTEM_FALLBACK_DURATION_MS,
        weight:      DEFAULT_PLAYLIST_ITEM_WEIGHT,
        source:      LEVEL_5_STRUCTURAL,
        sponsored:   false,
      },
    ],
    isFallback: true,
    trace: {
      outcome: 'RESOLVED',
      reason:  fallbackReason ?? 'L5:SYSTEM_FALLBACK:no_content_sources_active',
    },
  };
}
