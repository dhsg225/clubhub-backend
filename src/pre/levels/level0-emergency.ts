/**
 * LEVEL_0 — Emergency resolution.
 *
 * If an emergency is active, ALL screens receive the emergency content immediately.
 * This level terminates resolution — no further levels are evaluated for base content.
 * Sponsorship injection (LEVEL_4) and structural (LEVEL_5) are SKIPPED (null traces).
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.1
 */

import type { PRE_Input, EmergencyStateRecord, ContentItemRecord } from '../types';
import {
  LEVEL_0_EMERGENCY,
  SYSTEM_EMERGENCY_FALLBACK_ID,
  SYSTEM_FALLBACK_DURATION_MS,
  DEFAULT_PLAYLIST_ITEM_WEIGHT,
} from '../constants';
import type { LevelResult } from './types';

export function resolveLevel0(
  input: PRE_Input,
  emergency: EmergencyStateRecord | null
): LevelResult | null {
  if (emergency === null) {
    return null;
  }

  const contentItem: ContentItemRecord | undefined = input.system_state.content_items.find(
    (c) => c.id === emergency.content_id
  );

  const contentId = contentItem ? emergency.content_id : SYSTEM_EMERGENCY_FALLBACK_ID;
  const durationMs = contentItem ? contentItem.duration_ms : SYSTEM_FALLBACK_DURATION_MS;

  const scopeLabel = emergency.is_global ? 'global' : 'venue-scoped';
  const reasonText = emergency.reason || 'no-reason';

  return {
    playlist: [
      {
        content_id:  contentId,
        duration_ms: durationMs,
        weight:      DEFAULT_PLAYLIST_ITEM_WEIGHT,
        source:      LEVEL_0_EMERGENCY,
        sponsored:   false,
      },
    ],
    terminatingLevel: LEVEL_0_EMERGENCY,
    traceEntry: {
      outcome:      'RESOLVED',
      reason:       `L0:EMERGENCY:id=${emergency.id},${scopeLabel},reason=${reasonText}`,
      emergency_id: emergency.id,
      content_id:   contentId,
    },
  };
}
