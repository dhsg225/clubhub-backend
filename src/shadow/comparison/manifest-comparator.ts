/**
 * Manifest comparator — compares legacy resolver output vs PRE output.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §6, §7
 *
 * Comparison is exact (no fuzzy equality) on all semantic fields.
 * "Divergence cannot self-approve." — Unknown fields default to Class 3.
 */

import { fnv1a32 } from '../../pre/algorithms/fnv1a32';
import { canonicalizeJson } from '../../pre/algorithms/canonicalize-json';
import { classifyDivergence } from '../../verification/divergence/classifier';
import type { FieldDiff, DivergenceReport } from '../../verification/divergence/types';
import type { PRE_Output } from '../../pre/types';
import type { LegacyOutput } from '../types';

// ─── Result Interface ─────────────────────────────────────────────────────────

export interface ManifestComparisonResult {
  legacy_hash: string;
  pre_hash: string;
  identical: boolean;
  field_diffs: FieldDiff[];
  divergence_class: number | null; // null if identical
  divergence_report: DivergenceReport | null;
}

// ─── Comparator ───────────────────────────────────────────────────────────────

/**
 * Compare legacy output vs PRE output for a single invocation.
 *
 * Extracts semantic fields from PRE output and compares them field-by-field
 * against the legacy output. All comparisons are exact.
 *
 * @param invocationId - UUID v4 for the current invocation (used as packetId)
 * @param legacy - The legacy resolver output
 * @param pre - The PRE output
 */
export function compareLegacyVsPRE(
  invocationId: string,
  legacy: LegacyOutput,
  pre: PRE_Output,
): ManifestComparisonResult {
  // Extract semantic fields from PRE output
  const preContentIds = pre.playlist.map(p => p.content_id);
  const preDurationSeq = pre.playlist.map(p => p.duration_ms);

  // Compute hashes
  const legacy_hash = fnv1a32(canonicalizeJson({
    content_ids: legacy.content_ids,
    duration_ms_sequence: legacy.duration_ms_sequence,
    is_fallback: legacy.is_fallback,
    playlist_checksum: legacy.playlist_checksum,
  }));

  const pre_hash = fnv1a32(canonicalizeJson({
    content_ids: preContentIds,
    duration_ms_sequence: preDurationSeq,
    is_fallback: pre.is_fallback,
    playlist_checksum: pre.playlist_checksum,
  }));

  // Fast path: hashes match — identical
  if (legacy_hash === pre_hash) {
    return {
      legacy_hash,
      pre_hash,
      identical: true,
      field_diffs: [],
      divergence_class: null,
      divergence_report: null,
    };
  }

  // Compute field diffs on semantic fields
  const field_diffs: FieldDiff[] = buildSemanticFieldDiffs(
    legacy,
    preContentIds,
    preDurationSeq,
    pre,
  );

  // Emergency is active when PRE resolved at level 0
  const emergencyActive = pre.resolution_level === 0;
  const input = {
    system_state: {
      emergency: emergencyActive ? { is_active: true } : null,
    },
  };

  // Classify divergence
  const divergence_report = classifyDivergence(
    invocationId,
    field_diffs,
    legacy_hash,
    pre_hash,
    input,
  );

  return {
    legacy_hash,
    pre_hash,
    identical: false,
    field_diffs,
    divergence_class: divergence_report.divergence_class,
    divergence_report,
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Build FieldDiff[] for all differing semantic fields.
 * All comparisons are exact (no tolerance).
 */
function buildSemanticFieldDiffs(
  legacy: LegacyOutput,
  preContentIds: string[],
  preDurationSeq: number[],
  pre: PRE_Output,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  // content_ids — exact array equality (order matters)
  if (!arraysEqual(legacy.content_ids, preContentIds)) {
    diffs.push({
      path: 'content_ids',
      expected: legacy.content_ids,
      actual: preContentIds,
    });
  }

  // duration_ms_sequence — exact array equality
  if (!arraysEqual(legacy.duration_ms_sequence, preDurationSeq)) {
    diffs.push({
      path: 'duration_ms_sequence',
      expected: legacy.duration_ms_sequence,
      actual: preDurationSeq,
    });
  }

  // is_fallback — exact boolean equality
  if (legacy.is_fallback !== pre.is_fallback) {
    diffs.push({
      path: 'is_fallback',
      expected: legacy.is_fallback,
      actual: pre.is_fallback,
    });
  }

  // playlist_checksum — exact string equality
  if (legacy.playlist_checksum !== pre.playlist_checksum) {
    diffs.push({
      path: 'playlist_checksum',
      expected: legacy.playlist_checksum,
      actual: pre.playlist_checksum,
    });
  }

  return diffs;
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
