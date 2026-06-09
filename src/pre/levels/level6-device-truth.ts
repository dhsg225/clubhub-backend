/**
 * LEVEL_6 — Device truth annotation.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §6.6
 * Always has outcome RESOLVED.
 */

import type { PRE_Input, ScreenDeliveryLogRecord, PlaylistItem, ReasonTraceDeviceTruthLevel } from '../types';
import {
  CONFIDENCE_FULL,
  CONFIDENCE_CHECKSUM_MISMATCH,
  CONFIDENCE_NO_DELIVERY_LOG,
  CONFIDENCE_STALE,
  CONFIDENCE_MAX_AGE_MS,
} from '../constants';

export interface Level6Result {
  confidence_score: number;
  trace:            ReasonTraceDeviceTruthLevel;
}

export function annotateLevel6(
  input: PRE_Input,
  playlist: PlaylistItem[],
  lastDelivery: ScreenDeliveryLogRecord | null,
  playlistChecksum: string
): Level6Result {
  void playlist;

  if (lastDelivery === null) {
    const score = CONFIDENCE_NO_DELIVERY_LOG;
    return {
      confidence_score: score,
      trace: {
        outcome:          'RESOLVED',
        reason:           `L6:CONFIDENCE:${score.toFixed(4)},no_delivery_log`,
        confidence_score: score,
        last_seen_ms_ago: null as unknown as number, // corpus uses null (not -1)
        checksum_match:   false,
      },
    };
  }

  const age = input.at - lastDelivery.delivered_at;
  const checksumMatch = lastDelivery.checksum === playlistChecksum;

  let score: number;
  let deliveryStatus: string;

  if (age > CONFIDENCE_MAX_AGE_MS) {
    score = CONFIDENCE_STALE;
    deliveryStatus = 'stale';
  } else if (!checksumMatch) {
    score = CONFIDENCE_CHECKSUM_MISMATCH;
    deliveryStatus = 'checksum_mismatch';
  } else {
    score = CONFIDENCE_FULL;
    deliveryStatus = 'fresh_match';
  }

  return {
    confidence_score: score,
    trace: {
      outcome:          'RESOLVED',
      reason:           `L6:CONFIDENCE:${score.toFixed(4)},${deliveryStatus}`,
      confidence_score: score,
      last_seen_ms_ago: age,
      checksum_match:   checksumMatch,
    },
  };
}
