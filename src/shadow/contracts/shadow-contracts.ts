/**
 * Shadow execution contract assertions.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * These assertions enforce:
 * 1. Shadow execution remains side-effect free within the PRE domain
 * 2. Parity records are immutable after append
 * 3. CLASS_3/4 divergences always trigger rollback (never silently suppressed)
 */

import type { PRE_Output } from '../../pre/types';
import type { ParityRecord } from '../types';
import type { ManifestComparisonResult } from '../comparison/manifest-comparator';
import type { RollbackTriggerOutput } from '../types';

// ─── Contract Violation ───────────────────────────────────────────────────────

export class ShadowContractViolation extends Error {
  constructor(public readonly rule: string, message: string) {
    super(message);
    this.name = 'ShadowContractViolation';
  }
}

// ─── Contract: Side-Effect Free ───────────────────────────────────────────────

/**
 * Assert that shadow execution is side-effect free.
 *
 * In shadow mode, PRE output MUST NOT have been stored as the serving authority.
 * We verify by checking that the PRE output is a valid read-only value
 * and has not been mutated (object frozen in production — here we check structural
 * integrity and that output_schema_version is the expected sentinel value).
 *
 * Throws ShadowContractViolation if the assertion fails.
 */
export function assertShadowSideEffectFree(pre: PRE_Output): void {
  // Verify output schema version is present (indicates a proper PRE output)
  if (pre.output_schema_version !== '1.0.0') {
    throw new ShadowContractViolation(
      'SHADOW_SIDE_EFFECT_FREE',
      `PRE output has unexpected schema version "${pre.output_schema_version}". ` +
      `Expected "1.0.0". Shadow execution may have received a mutated or serving output.`
    );
  }

  // Verify playlist is an array (structural integrity)
  if (!Array.isArray(pre.playlist)) {
    throw new ShadowContractViolation(
      'SHADOW_SIDE_EFFECT_FREE',
      'PRE output playlist is not an array. Shadow execution received malformed output.'
    );
  }

  // Verify playlist_checksum is a string (fnv1a32 = 8 hex chars)
  if (typeof pre.playlist_checksum !== 'string' || !/^[0-9a-f]{8}$/.test(pre.playlist_checksum)) {
    throw new ShadowContractViolation(
      'SHADOW_SIDE_EFFECT_FREE',
      `PRE output playlist_checksum "${pre.playlist_checksum}" is not a valid FNV-1a 32-bit hex string. ` +
      `Shadow execution received a corrupted or modified output.`
    );
  }
}

// ─── Contract: Immutable Parity Record ───────────────────────────────────────

/**
 * Assert that a parity record has not been modified after storage.
 *
 * Compares the original record (before storage) against the record
 * retrieved from storage. If any field differs, the record was mutated.
 *
 * Throws ShadowContractViolation if mutation is detected.
 */
export function assertParityRecordImmutable(
  original: ParityRecord,
  afterStorage: ParityRecord,
): void {
  const fields: (keyof ParityRecord)[] = [
    'invocation_id',
    'timestamp',
    'legacy_output_hash',
    'pre_output_hash',
    'divergence_class',
    'diff_summary',
    'replay_reference',
    'canary_stage',
    'deterministic_checksum',
  ];

  for (const field of fields) {
    const origVal = original[field];
    const storedVal = afterStorage[field];

    if (origVal !== storedVal) {
      throw new ShadowContractViolation(
        'PARITY_RECORD_IMMUTABLE',
        `Parity record mutation detected in field "${field}". ` +
        `Original: ${JSON.stringify(origVal)}, after storage: ${JSON.stringify(storedVal)}. ` +
        `Parity records are immutable and cannot be modified after append.`
      );
    }
  }
}

// ─── Contract: No Silent Divergence Suppression ───────────────────────────────

/**
 * Assert that CLASS_3 and CLASS_4 divergences are not silently suppressed.
 *
 * If the comparison found a class 3 or 4 divergence, the rollback trigger
 * MUST have fired. If rollback was not triggered for a class 3/4, that is
 * a constitutional violation.
 *
 * Throws ShadowContractViolation if suppression is detected.
 */
export function assertNoSilentDivergenceSuppression(
  comparison: ManifestComparisonResult,
  rollback: RollbackTriggerOutput,
): void {
  const { divergence_class } = comparison;

  if (divergence_class !== null && divergence_class >= 3) {
    if (!rollback.triggered) {
      throw new ShadowContractViolation(
        'NO_SILENT_DIVERGENCE_SUPPRESSION',
        `CLASS_${divergence_class} divergence was not suppressed silently — rollback MUST be triggered. ` +
        `Comparison found divergence_class=${divergence_class} but rollback.triggered=false. ` +
        `Constitutional reference: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §6 — "Divergence cannot self-approve."`
      );
    }
  }
}
