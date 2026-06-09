/**
 * Field-level diff algorithm for PRE output comparison.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §6.3
 *
 * Computes a list of all field-level differences between two PRE outputs.
 * Comparison is:
 * - Exact for all behavioral fields (content_id, duration_ms, resolution_level, etc.)
 * - Element-by-element for arrays (order matters — playlists are ordered)
 * - Structural for nested objects (reason_trace sub-fields)
 *
 * This function MUST NOT auto-ignore any field. Classification of which
 * differences are tolerated is done by the classifier, not the diff engine.
 * The diff engine reports ALL differences.
 *
 * "Divergence cannot self-approve." — EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §6.6
 */

import type { FieldDiff } from './types';
import type { PRE_Output } from '../../pre/types';

/**
 * Compute field-level diffs between expected and actual PRE outputs.
 * Returns an array of all differing fields (empty = no differences).
 *
 * Comparison is value-equality (deep equality) except floats, which are
 * compared to 4 decimal places (same precision as canonical serialization).
 */
export function diffOutputs(expected: PRE_Output, actual: PRE_Output): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  diffValues(expected, actual, '', diffs);
  return diffs;
}

function diffValues(
  expected: unknown,
  actual:   unknown,
  path:     string,
  diffs:    FieldDiff[]
): void {
  // Both null
  if (expected === null && actual === null) return;

  // Type mismatch (including null vs non-null)
  if (typeof expected !== typeof actual ||
      (expected === null) !== (actual === null)) {
    diffs.push({ path, expected, actual });
    return;
  }

  // Primitive types (string, boolean, number)
  if (typeof expected !== 'object' || expected === null) {
    if (!primitivesEqual(expected, actual)) {
      diffs.push({ path, expected, actual });
    }
    return;
  }

  // Arrays
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      diffs.push({ path, expected, actual });
      return;
    }
    diffArrays(expected, actual as unknown[], path, diffs);
    return;
  }

  // Objects
  diffObjects(
    expected as Record<string, unknown>,
    actual as Record<string, unknown>,
    path,
    diffs
  );
}

function primitivesEqual(expected: unknown, actual: unknown): boolean {
  // Float comparison: round to 4 decimal places (canonical precision)
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (!isFinite(expected) || !isFinite(actual)) {
      return expected === actual;
    }
    // Integer comparison is exact
    if (Number.isInteger(expected) && Number.isInteger(actual)) {
      return expected === actual;
    }
    // Float comparison: 4 decimal places
    return roundTo4(expected) === roundTo4(actual);
  }
  return expected === actual;
}

function roundTo4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

function diffArrays(
  expected: unknown[],
  actual:   unknown[],
  path:     string,
  diffs:    FieldDiff[]
): void {
  const maxLen = Math.max(expected.length, actual.length);

  for (let i = 0; i < maxLen; i++) {
    const itemPath = `${path}[${i}]`;

    if (i >= expected.length) {
      // Extra item in actual — not in expected
      diffs.push({ path: itemPath, expected: undefined, actual: actual[i] });
    } else if (i >= actual.length) {
      // Missing item in actual — present in expected
      diffs.push({ path: itemPath, expected: expected[i], actual: undefined });
    } else {
      diffValues(expected[i], actual[i], itemPath, diffs);
    }
  }
}

function diffObjects(
  expected: Record<string, unknown>,
  actual:   Record<string, unknown>,
  path:     string,
  diffs:    FieldDiff[]
): void {
  // Union of all keys from both objects
  const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);

  // Sort keys for deterministic diff output
  const sortedKeys = [...allKeys].sort();

  for (const key of sortedKeys) {
    const fieldPath = path ? `${path}.${key}` : key;
    const hasInExpected = key in expected;
    const hasInActual   = key in actual;

    if (!hasInExpected) {
      // Present in actual only
      diffs.push({ path: fieldPath, expected: undefined, actual: actual[key] });
    } else if (!hasInActual) {
      // Present in expected only
      diffs.push({ path: fieldPath, expected: expected[key], actual: undefined });
    } else {
      diffValues(expected[key], actual[key], fieldPath, diffs);
    }
  }
}
