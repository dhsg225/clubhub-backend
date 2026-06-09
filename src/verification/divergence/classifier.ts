/**
 * Divergence classifier — assigns DivergenceClass (0–4) to a set of field diffs.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §6
 * Constitutional reference: REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md Appendix C
 *
 * Classification rules (evaluated in precedence order, highest class wins):
 *
 * Class 4 (CATASTROPHIC): Any diff in emergency-related or safety-critical fields.
 * Class 3 (CONSTITUTIONAL): Any diff in behavioral fields that determine playback.
 * Class 2 (WARNING): Unexpected diffs in non-behavioral fields.
 * Class 1 (TOLERATED): Diffs in fields constitutionally allowed to vary.
 * Class 0 (COSMETIC): Diffs in debug/informational-only fields.
 *
 * RULE: Divergence cannot self-approve. Classification 0 or 1 requires explicit
 * field membership in the COSMETIC_FIELDS or TOLERATED_FIELDS sets.
 * Unknown fields default to Class 3 (CONSTITUTIONAL).
 */

import type { FieldDiff, DivergenceClass, DivergenceReport } from './types';
import { DIVERGENCE_CLASS_LABELS, DIVERGENCE_CLASS_BLOCKS_DEPLOY } from './types';

// ─── Field Classification Sets ────────────────────────────────────────────────

/**
 * CATASTROPHIC fields: emergency-related or safety-critical.
 * Any diff here is Class 4.
 */
const CATASTROPHIC_FIELDS = new Set([
  'resolution_level',     // If emergency forces L0, resolution_level must be 0
  'is_fallback',          // Emergency state cannot produce is_fallback=true incorrectly
  // Playlist content during emergency is Class 4 (handled specially in classifier)
]);

/**
 * CONSTITUTIONAL fields: determine playback behavior.
 * Any diff here is Class 3.
 */
const CONSTITUTIONAL_FIELDS = new Set([
  'screen_id',
  'resolved_at',
  'playlist_checksum',
  'version',
  'content_mix.campaign_pct',
  'content_mix.sponsor_pct',
  'content_mix.override_pct',
  'content_mix.fallback_pct',
  'content_mix.system_pct',
  'output_schema_version',
  // Playlist item fields — any playlist diff is constitutional
  // (matched by path prefix below)
]);

/**
 * TOLERATED fields: constitutionally allowed to vary within bounds.
 * Only explicitly listed fields may be Class 1.
 * Note: confidence_score is tolerated within ±0.01 only (checked separately).
 */
const TOLERATED_FIELDS = new Set([
  'confidence_score',     // ±0.01 tolerance for timing-dependent computation
  'reason_trace.level_6_device_truth.last_seen_ms_ago',  // timing-sensitive
]);

/**
 * COSMETIC fields: debug/informational only; do not affect playback.
 * Only explicitly listed fields may be Class 0.
 */
const COSMETIC_FIELDS = new Set<string>([
  // No fields are currently classified as cosmetic in PRE_Output.
  // reason_trace human-readable string fields could be Class 0 if/when
  // they are separated from the structured trace fields by spec amendment.
]);

// ─── Classifier ───────────────────────────────────────────────────────────────

/**
 * Classify a set of field diffs and produce a DivergenceReport.
 *
 * The overall class is the maximum class of any individual field diff.
 * If any field is Class 4, the whole divergence is Class 4.
 */
export function classifyDivergence(
  packetId:     string,
  fieldDiffs:   FieldDiff[],
  expectedHash: string,
  actualHash:   string,
  input:        { system_state: { emergency: { is_active: boolean } | null } }
): DivergenceReport {
  if (fieldDiffs.length === 0) {
    // No diffs — should only be called when hashes differ, so this is unexpected
    return {
      packet_id: packetId,
      divergence_class: 3,
      class_label: DIVERGENCE_CLASS_LABELS[3] as string,
      blocks_deploy: true,
      expected_hash: expectedHash,
      actual_hash: actualHash,
      field_diffs: [],
      primary_field: null,
      classification_reason:
        'Hash mismatch with no field diffs detected. ' +
        'This indicates a canonical serialization inconsistency — Class 3 by default.',
    };
  }

  let maxClass: DivergenceClass = 0;
  let primaryField: string | null = null;

  const classifiedDiffs = fieldDiffs.map(diff => {
    const cls = classifyFieldDiff(diff, input.system_state.emergency?.is_active ?? false);
    if (cls > maxClass) {
      maxClass = cls;
      primaryField = diff.path;
    }
    return { diff, class: cls };
  });

  const classLabel = DIVERGENCE_CLASS_LABELS[maxClass] as string;
  const blocksDeployValue = DIVERGENCE_CLASS_BLOCKS_DEPLOY[maxClass] as boolean;

  // Generate human-readable reason
  const reason = buildClassificationReason(maxClass, classifiedDiffs, primaryField);

  return {
    packet_id: packetId,
    divergence_class: maxClass,
    class_label: classLabel,
    blocks_deploy: blocksDeployValue,
    expected_hash: expectedHash,
    actual_hash: actualHash,
    field_diffs: fieldDiffs,
    primary_field: primaryField,
    classification_reason: reason,
  };
}

function classifyFieldDiff(
  diff: FieldDiff,
  emergencyActive: boolean
): DivergenceClass {
  const path = diff.path;

  // Class 4 (CATASTROPHIC): emergency fields, or ANY field during active emergency
  if (emergencyActive) {
    // During an active emergency, ANY diff in playlist or resolution_level is Class 4
    if (path === 'resolution_level' || path.startsWith('playlist')) {
      return 4;
    }
  }

  if (CATASTROPHIC_FIELDS.has(path)) {
    return 4;
  }

  // Class 3 (CONSTITUTIONAL): any playlist diff, or listed constitutional fields
  if (path.startsWith('playlist')) {
    return 3;
  }

  if (CONSTITUTIONAL_FIELDS.has(path)) {
    return 3;
  }

  // Class 3 for all reason_trace.level_{0..3} fields (core resolution trace)
  if (/^reason_trace\.level_[0-3]/.test(path)) {
    return 3;
  }

  // Class 1 (TOLERATED): explicitly listed tolerated fields
  if (TOLERATED_FIELDS.has(path)) {
    // confidence_score: only tolerated within ±0.01
    if (path === 'confidence_score') {
      const expected = typeof diff.expected === 'number' ? diff.expected : NaN;
      const actual = typeof diff.actual === 'number' ? diff.actual : NaN;
      if (Math.abs(expected - actual) <= 0.01) {
        return 1;
      }
      return 3; // Exceeds tolerance — constitutional
    }
    return 1;
  }

  // Class 0 (COSMETIC): explicitly listed cosmetic fields
  if (COSMETIC_FIELDS.has(path)) {
    return 0;
  }

  // DEFAULT: Unknown/unlisted fields are Class 3 (constitutional).
  // "Divergence cannot self-approve." — only explicit listing permits class 0 or 1.
  return 3;
}

function buildClassificationReason(
  maxClass: DivergenceClass,
  diffs: Array<{ diff: FieldDiff; class: DivergenceClass }>,
  primaryField: string | null
): string {
  const classLabel = DIVERGENCE_CLASS_LABELS[maxClass];
  const count = diffs.length;
  const blocking = DIVERGENCE_CLASS_BLOCKS_DEPLOY[maxClass];

  const fieldSummary = primaryField
    ? `Primary field: ${primaryField}.`
    : 'Multiple fields differ.';

  const deployNote = blocking
    ? 'BLOCKS DEPLOY — must not merge until resolved or formally retired.'
    : 'Does not block deploy, but requires operator awareness.';

  switch (maxClass) {
    case 4:
      return (
        `CATASTROPHIC divergence (${count} field(s)). ${fieldSummary} ` +
        `Emergency or safety-critical invariant affected. ${deployNote}`
      );
    case 3:
      return (
        `CONSTITUTIONAL divergence (${count} field(s)). ${fieldSummary} ` +
        `Behavioral output differs from corpus specification. ${deployNote}`
      );
    case 2:
      return (
        `WARNING divergence (${count} field(s)). ${fieldSummary} ` +
        `Unexpected diff in non-behavioral field. Investigation required. ${deployNote}`
      );
    case 1:
      return (
        `TOLERATED divergence (${count} field(s)). ${fieldSummary} ` +
        `Within constitutionally permitted variance bounds. ${deployNote}`
      );
    case 0:
      return (
        `COSMETIC divergence (${count} field(s)). ${fieldSummary} ` +
        `Informational/debug fields only. ${deployNote}`
      );
    default: {
      const _exhaustive: never = maxClass;
      void _exhaustive;
      return `Class ${classLabel} divergence (${count} field(s)).`;
    }
  }
}
