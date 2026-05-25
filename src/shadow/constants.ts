/**
 * Shadow execution constants.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 */

export const SHADOW_GATE = {
  MIN_PARITY_24H: 0.999,
  MIN_PARITY_7D: 0.9999,
  MIN_INVOCATIONS_24H: 1000,
  CLASS_3_HARD_LIMIT: 0,          // zero class 3 divergences permitted
  CLASS_4_HARD_LIMIT: 0,          // zero class 4 divergences permitted
} as const;

export const ROLLBACK_CLASSES: readonly number[] = [3, 4];

/**
 * Fields compared for semantic equivalence.
 * From VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §5.3
 */
export const SEMANTIC_FIELDS = [
  'content_ids',
  'duration_ms_sequence',
  'is_fallback',
  'playlist_checksum',
] as const;
