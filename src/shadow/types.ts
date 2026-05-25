/**
 * Shadow execution types for PRE canary promotion governance.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * "PRE promotion is parity-earned, never time-earned."
 * All promotion decisions require human approval — never automatic.
 */

import type { PRE_Output } from '../pre/types';

// ─── Canary Stage ─────────────────────────────────────────────────────────────

/** Canary stages — PRE authority promotion path */
export type CanaryStage =
  | 'SHADOW_ONLY'       // PRE runs but output is never served
  | 'INTERNAL_CANARY'   // Engineering screens only
  | 'SINGLE_VENUE'      // One production venue
  | 'MULTI_VENUE'       // Multiple venues (≤50% of fleet)
  | 'FLEET_WIDE'        // All venues, legacy still authoritative
  | 'AUTHORITATIVE';    // PRE is the production authority

/** Ordered stage progression (index = promotion rank) */
export const CANARY_STAGE_ORDER: CanaryStage[] = [
  'SHADOW_ONLY',
  'INTERNAL_CANARY',
  'SINGLE_VENUE',
  'MULTI_VENUE',
  'FLEET_WIDE',
  'AUTHORITATIVE',
];

// ─── Rollback ─────────────────────────────────────────────────────────────────

/** Rollback trigger reasons */
export type RollbackReason =
  | 'CLASS_3_DIVERGENCE'
  | 'CLASS_4_DIVERGENCE'
  | 'REPLAY_NONDETERMINISM'
  | 'INVARIANT_VIOLATION'
  | 'UNSTABLE_CHECKSUM'
  | 'ORDERING_INSTABILITY'
  | 'EMERGENCY_PRECEDENCE_FAILURE';

// ─── Legacy Output ────────────────────────────────────────────────────────────

/** Legacy resolver output (simplified — field subset that PRE compares against) */
export interface LegacyOutput {
  screen_id: string;
  playlist_checksum: string;
  content_ids: string[];           // ordered content IDs
  duration_ms_sequence: number[];  // ordered durations
  is_fallback: boolean;
  resolution_note: string | null;  // legacy human note, not compared
}

// ─── Shadow Invocation ────────────────────────────────────────────────────────

/** A single shadow execution comparison */
export interface ShadowInvocation {
  invocation_id: string;           // UUID v4
  screen_id: string;
  at: number;                      // UTC ms
  canary_stage: CanaryStage;
  legacy_output: LegacyOutput;
  pre_output: PRE_Output;
  executed_at: number;             // UTC ms
}

// ─── Comparison Result ────────────────────────────────────────────────────────

/** Result of comparing legacy vs PRE for one invocation */
export interface ShadowComparisonResult {
  invocation_id: string;
  screen_id: string;
  at: number;
  canary_stage: CanaryStage;
  legacy_hash: string;             // fnv1a32 of canonical legacy output
  pre_hash: string;                // fnv1a32 of PRE playlist_checksum + is_fallback
  divergence_class: number | null; // null = identical
  divergence_summary: string | null;
  affected_fields: string[];
  rollback_required: boolean;
  replay_artifact_id: string;      // points to parity record
  executed_at: number;
}

// ─── Parity Record ────────────────────────────────────────────────────────────

/** Immutable parity record (append-only storage) */
export interface ParityRecord {
  invocation_id: string;
  timestamp: number;               // UTC ms
  legacy_output_hash: string;
  pre_output_hash: string;
  divergence_class: number | null;
  diff_summary: string | null;
  replay_reference: string;        // invocation_id for replay
  canary_stage: CanaryStage;
  deterministic_checksum: string;  // fnv1a32(canonicalizeJson(this record minus this field))
}

// ─── Rollback Trigger ─────────────────────────────────────────────────────────

/** Rollback trigger output */
export interface RollbackTriggerOutput {
  triggered: boolean;
  reason: RollbackReason | null;
  triggering_invocation_id: string | null;
  triggering_divergence_class: number | null;
  affected_screen_id: string | null;
  severity: 'CRITICAL' | 'CONSTITUTIONAL' | null;
  constitutional_reference: string | null;
  replay_artifact_id: string | null;
}

// ─── Stage Transition ─────────────────────────────────────────────────────────

/** Canary stage transition result */
export interface StageTransitionResult {
  allowed: boolean;
  from_stage: CanaryStage;
  to_stage: CanaryStage;
  blocking_reason: string | null;
  parity_score_24h: number;
  parity_score_7d: number;
  total_invocations: number;
  requires_human_approval: boolean; // ALWAYS true — never automatic
}

// ─── Promotion Readiness ──────────────────────────────────────────────────────

/** Promotion readiness report */
export interface PromotionReadinessReport {
  current_stage: CanaryStage;
  next_stage: CanaryStage | null;
  is_ready: boolean;
  blocking_reasons: string[];
  parity_score_24h: number;
  parity_score_7d: number;
  total_invocations_24h: number;
  zero_class3_class4_violations: boolean;
  invariant_stability: boolean;
  entropy_stability: boolean;
  chaos_verification_stable: boolean;
  operator_visibility_intact: boolean;
  requires_human_approval: boolean; // ALWAYS true
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

/** Shadow telemetry event types */
export type ShadowTelemetryEventType =
  | 'shadow_execution_started'
  | 'shadow_execution_completed'
  | 'parity_record_written'
  | 'divergence_detected'
  | 'rollback_triggered'
  | 'canary_evaluated'
  | 'canary_blocked'
  | 'promotion_review_required';

export interface ShadowTelemetryEvent {
  event_type: ShadowTelemetryEventType;
  invocation_id: string;
  screen_id: string;
  at: number;
  canary_stage: CanaryStage;
  payload: Record<string, unknown>;
  emitted_at: number;             // UTC ms
}

// ─── Shadow Report ────────────────────────────────────────────────────────────

/** Shadow execution report (for shadow-reporter.ts) */
export interface ShadowReport {
  report_id: string;
  generated_at: number;
  canary_stage: CanaryStage;
  window_start_ms: number;
  window_end_ms: number;
  total_invocations: number;
  agreements: number;
  warnings: number;
  disagreements: number;
  parity_score: number;
  rollback_triggers: number;
  promotion_readiness: PromotionReadinessReport;
  report_checksum: string;        // fnv1a32 of canonical report minus this field
}
