/**
 * Divergence classification types.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §6
 * Constitutional reference: REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md Appendix C
 *
 * 5 divergence classes (0–4):
 * Class 0 — Cosmetic: Fields that do not affect playback behavior (e.g., debug strings)
 * Class 1 — Tolerated: Allowed differences within constitutional bounds
 * Class 2 — Warning: Unexpected but non-breaking; operator investigation required
 * Class 3 — Constitutional: Violates a constitutional rule; MUST block deploy
 * Class 4 — Catastrophic: Emergency or safety invariant violated; MUST alert immediately
 */

// ─── Divergence Class ─────────────────────────────────────────────────────────

export type DivergenceClass = 0 | 1 | 2 | 3 | 4;

export const DIVERGENCE_CLASS_LABELS: Record<DivergenceClass, string> = {
  0: 'COSMETIC',
  1: 'TOLERATED',
  2: 'WARNING',
  3: 'CONSTITUTIONAL',
  4: 'CATASTROPHIC',
};

/** Whether a divergence class blocks deployment */
export const DIVERGENCE_CLASS_BLOCKS_DEPLOY: Record<DivergenceClass, boolean> = {
  0: false,
  1: false,
  2: false,
  3: true,
  4: true,
};

// ─── Field Diff ───────────────────────────────────────────────────────────────

export interface FieldDiff {
  /** Dot-notation path to the differing field (e.g., "playlist[0].content_id") */
  path:     string;
  expected: unknown;
  actual:   unknown;
}

// ─── Divergence Report ────────────────────────────────────────────────────────

export interface DivergenceReport {
  packet_id:         string;
  divergence_class:  DivergenceClass;
  class_label:       string;
  blocks_deploy:     boolean;
  expected_hash:     string;
  actual_hash:       string;
  field_diffs:       FieldDiff[];
  /**
   * Primary field responsible for the classification.
   * If multiple fields differ, this is the field with the highest-severity difference.
   */
  primary_field:     string | null;
  /** Human-readable explanation of why this class was assigned */
  classification_reason: string;
}
