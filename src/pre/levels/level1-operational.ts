/**
 * LEVEL_1 — Operational override resolution.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.2
 */

import type { PRE_Input, OverrideRecord, ContentItemRecord } from '../types';
import {
  LEVEL_1_OPERATIONAL,
  SYSTEM_FALLBACK_CONTENT_ID,
  SYSTEM_FALLBACK_DURATION_MS,
  DEFAULT_PLAYLIST_ITEM_WEIGHT,
} from '../constants';
import type { LevelResult } from './types';

export function resolveLevel1(
  input: PRE_Input,
  overrides: OverrideRecord[]
): LevelResult | null {
  if (overrides.length === 0) {
    return null;
  }

  const override = overrides[0]!;

  const contentItem: ContentItemRecord | undefined = input.system_state.content_items.find(
    (c) => c.id === override.content_id
  );

  const contentId = contentItem ? override.content_id : SYSTEM_FALLBACK_CONTENT_ID;
  const durationMs = contentItem ? contentItem.duration_ms : SYSTEM_FALLBACK_DURATION_MS;
  const reasonText = override.reason || 'no-reason';

  return {
    playlist: [
      {
        content_id:  contentId,
        duration_ms: durationMs,
        weight:      DEFAULT_PLAYLIST_ITEM_WEIGHT,
        source:      LEVEL_1_OPERATIONAL,
        sponsored:   false,
      },
    ],
    terminatingLevel: LEVEL_1_OPERATIONAL,
    traceEntry: {
      outcome:     'RESOLVED',
      reason:      `L1:OPERATIONAL_OVERRIDE:id=${override.id},target=${override.target_id},reason=${reasonText}`,
      override_id: override.id,
      content_id:  contentId,
    },
  };
}
