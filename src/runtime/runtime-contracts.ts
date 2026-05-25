/**
 * Contract assertions for runtime layer.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13
 *
 * These enforce that the runtime wrapper never mutates PRE outputs.
 */

import type { PRE_Output } from '../pre/types';

// ─── Contract Violation ───────────────────────────────────────────────────────

export class RuntimeContractViolation extends Error {
  constructor(message: string) {
    super(`RuntimeContractViolation: ${message}`);
    this.name = 'RuntimeContractViolation';
  }
}

// ─── timing_ms isolation ─────────────────────────────────────────────────────

/**
 * Assert that timing_ms is not present in the serialized replay hash.
 *
 * The PRE_Output structure does not have a timing_ms field — this assertion
 * verifies that no one has injected it onto the output object.
 */
export function assertTimingNotInReplayHash(output: PRE_Output): void {
  const raw = output as unknown as Record<string, unknown>;
  if ('timing_ms' in raw) {
    throw new RuntimeContractViolation(
      'timing_ms must NOT be present in PRE_Output. ' +
      'Timing metadata belongs in RuntimeResponse only, never in the replay-hashable output.'
    );
  }
  // Verify playlist_checksum does not encode any time-dependent values beyond resolved_at
  // (this is structural — we check that playlist_checksum is a hex string of the right form)
  if (typeof output.playlist_checksum !== 'string' || !/^[0-9a-f]{8}$/i.test(output.playlist_checksum)) {
    throw new RuntimeContractViolation(
      `playlist_checksum has unexpected form: "${output.playlist_checksum}". ` +
      'Expected 8-character lowercase hex string from fnv1a32.'
    );
  }
}

// ─── Output shape assertion ───────────────────────────────────────────────────

/**
 * Assert that PRE output fields match expected schema (basic structural check).
 */
export function assertOutputShape(output: PRE_Output): void {
  if (typeof output.screen_id !== 'string' || output.screen_id.length === 0) {
    throw new RuntimeContractViolation('PRE_Output.screen_id must be a non-empty string');
  }
  if (typeof output.resolved_at !== 'number' || output.resolved_at <= 0) {
    throw new RuntimeContractViolation('PRE_Output.resolved_at must be a positive number (UTC ms)');
  }
  if (typeof output.resolution_level !== 'number') {
    throw new RuntimeContractViolation('PRE_Output.resolution_level must be a number');
  }
  if (typeof output.is_fallback !== 'boolean') {
    throw new RuntimeContractViolation('PRE_Output.is_fallback must be a boolean');
  }
  if (!Array.isArray(output.playlist)) {
    throw new RuntimeContractViolation('PRE_Output.playlist must be an array');
  }
  if (typeof output.playlist_checksum !== 'string') {
    throw new RuntimeContractViolation('PRE_Output.playlist_checksum must be a string');
  }
  if (output.output_schema_version !== '1.0.0') {
    throw new RuntimeContractViolation(
      `PRE_Output.output_schema_version must be '1.0.0', got '${output.output_schema_version}'`
    );
  }
}
