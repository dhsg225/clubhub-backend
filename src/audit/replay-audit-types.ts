/**
 * Replay audit record types.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Audit records are append-only and immutable after creation.
 * record_checksum covers all fields except itself — tamper detection.
 */

export interface ReplayAuditRecord {
  /** UUID v4 */
  audit_record_id: string;
  screen_id: string;
  /** UTC ms */
  at: number;
  correlation_id: string;
  /** fnv1a32 of canonical PRE output */
  pre_output_hash: string;
  playlist_checksum: string;
  resolution_level: number;
  is_fallback: boolean;
  /** From shadow comparison, if run */
  divergence_class: number | null;
  entropy_score_snapshot: number | null;
  shadow_parity_snapshot: number | null;
  invariants_passed: boolean;
  /** UTC ms (wall clock — not in replay hash) */
  audit_written_at: number;
  /** fnv1a32 of all fields except this one */
  record_checksum: string;
}
