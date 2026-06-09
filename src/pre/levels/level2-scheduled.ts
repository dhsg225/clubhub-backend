/**
 * LEVEL_2 — Scheduled override resolution.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.3
 */

import type { PRE_Input, OverrideRecord, ContentItemRecord } from '../types';
import {
  LEVEL_2_SCHEDULED,
  SYSTEM_FALLBACK_CONTENT_ID,
  SYSTEM_FALLBACK_DURATION_MS,
} from '../constants';
import type { LevelResult } from './types';

export function resolveLevel2(
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
        weight:      1,
        source:      LEVEL_2_SCHEDULED,
        sponsored:   false,
      },
    ],
    terminatingLevel: LEVEL_2_SCHEDULED,
    traceEntry: {
      outcome:     'RESOLVED',
      reason:      `L2:SCHEDULED_OVERRIDE:id=${override.id},target=${override.target_id},reason=${reasonText}`,
      override_id: override.id,
      target_type: override.target_type,
      target_id:   override.target_id,
      content_id:  contentId,
    },
  };
}
