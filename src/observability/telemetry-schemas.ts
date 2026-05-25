/**
 * Structured telemetry log schemas — all observable event types.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13
 *
 * All log lines emitted by constitutional infrastructure must conform to
 * one of these schemas. No ad-hoc log.info('some string') is permitted
 * in verification, entropy, or chaos modules.
 *
 * Log severity levels (ascending):
 *   INFO → ADVISORY → WARNING → ERROR → CONSTITUTIONAL_BREACH → CATASTROPHIC
 */

export type LogSeverity =
  | 'INFO'
  | 'ADVISORY'
  | 'WARNING'
  | 'ERROR'
  | 'CONSTITUTIONAL_BREACH'
  | 'CATASTROPHIC';

// ─── Base Fields (required on all log lines) ──────────────────────────────────

export interface BaseLogLine {
  ts:           number;       // UTC ms (not ISO string — canonical form)
  severity:     LogSeverity;
  event_type:   string;       // e.g., 'invariant.violation', 'replay.pass'
  request_id:   string | null;
  replay_id:    string | null;
}

// ─── Invariant Events ─────────────────────────────────────────────────────────

export interface InvariantViolationLog extends BaseLogLine {
  event_type:    'invariant.violation';
  invariant_id:  string;       // e.g., 'INV-7'
  screen_id:     string | null;
  at:            number | null;
  message:       string;
  detail:        Record<string, unknown> | null;
}

export interface InvariantPassLog extends BaseLogLine {
  event_type:   'invariant.pass';
  invariant_id: string;
  screen_id:    string | null;
}

// ─── Replay Events ────────────────────────────────────────────────────────────

export interface ReplayPassLog extends BaseLogLine {
  event_type:         'replay.pass';
  packet_id:          string;
  corpus_class:       string;
  execution_ms:       number;
  actual_output_hash: string;
}

export interface ReplayFailLog extends BaseLogLine {
  event_type:          'replay.fail';
  packet_id:           string;
  corpus_class:        string;
  status:              string;
  divergence_class:    number | null;
  actual_output_hash:  string | null;
  expected_output_hash: string;
  message:             string;
  execution_ms:        number;
}

export interface ReplayRunCompleteLog extends BaseLogLine {
  event_type:            'replay.run.complete';
  run_id:                string;
  total_packets:         number;
  passed:                number;
  failed:                number;
  integrity_failures:    number;
  overall_result:        'PASS' | 'FAIL' | 'INTEGRITY_FAILURE';
  duration_ms:           number;
}

// ─── Entropy Events ───────────────────────────────────────────────────────────

export interface EntropyBatchLog extends BaseLogLine {
  event_type:     'entropy.batch.complete';
  venue_id:       string;
  entropy_score:  number;
  score_label:    string;
  computed_at:    number;
  duration_ms:    number;
}

export interface EntropyMetricLog extends BaseLogLine {
  event_type:    'entropy.metric';
  venue_id:      string;
  metric_id:     string;   // e.g., 'M-01'
  value:         number;
  status:        'healthy' | 'advisory' | 'review';
}

// ─── Forbidden State Events ───────────────────────────────────────────────────

export interface ForbiddenStateLog extends BaseLogLine {
  event_type:      'forbidden_state.detected';
  forbidden_id:    string;   // e.g., 'FORBIDDEN-1'
  description:     string;
  affected_count:  number;
  advisory_action: string;
}

// ─── Parity Events ────────────────────────────────────────────────────────────

export interface ParityDivergenceLog extends BaseLogLine {
  event_type:       'parity.divergence';
  screen_id:        string;
  at:               number;
  divergence_class: number;
  legacy_hash:      string;
  pre_hash:         string;
}

export interface CanaryGateLog extends BaseLogLine {
  event_type:   'canary.gate.evaluated';
  passes:       boolean;
  reason:       string;
  score_24h:    number;
  score_7d:     number;
  total_24h:    number;
}

// ─── Emergency Events ─────────────────────────────────────────────────────────

export interface EmergencyActivationLog extends BaseLogLine {
  event_type:     'emergency.activated';
  emergency_id:   string;
  venue_id:       string;
  is_global:      boolean;
  has_reason:     boolean;
}

// ─── Constitutional Breach Events ─────────────────────────────────────────────

export interface ConstitutionalBreachLog extends BaseLogLine {
  event_type:  'constitutional.breach';
  breach_type: string;   // e.g., 'invariant_violation', 'forbidden_state', 'corpus_integrity'
  description: string;
  must_alert:  true;     // always true — all breaches trigger alerts
}

// ─── Extended Entropy Events ──────────────────────────────────────────────────
// Added: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §16 — per-screen and per-venue
// scoring, and advisory escalation tracking.

import type { EntropyLabel, AdvisoryTier } from '../entropy/types';

export interface EntropyMetricDetailLog extends BaseLogLine {
  event_type:    'entropy.metric.detail';
  metric_id:     string;      // e.g., 'M-01'
  value:         number;      // normalized [0.0, 1.0]
  raw_value:     number;      // pre-normalization measurement
  label:         string;      // 'healthy' | 'advisory' | 'review'
  screen_id?:    string;
  venue_id?:     string;
  computed_at:   number;      // UTC ms
}

export interface EntropyScoreDetailLog extends BaseLogLine {
  event_type:    'entropy.score.detail';
  composite:     number;      // normalized [0.0, 1.0]
  label:         EntropyLabel;
  advisory_tier: AdvisoryTier;
  screen_id?:    string;
  venue_id?:     string;
  computed_at:   number;      // UTC ms
}

export interface AdvisoryEscalationLog extends BaseLogLine {
  event_type:    'entropy.advisory.escalation';
  from_tier:     AdvisoryTier;
  to_tier:       AdvisoryTier;
  reason:        string;
  screen_id?:    string;
  venue_id?:     string;
  escalated_at:  number;      // UTC ms
}

// ─── PRE Runtime Events ───────────────────────────────────────────────────────

export interface PREInvocationLog extends BaseLogLine {
  event_type: 'pre.invocation';
  correlation_id: string;
  screen_id: string;
  at: number;
  resolution_level: number;
  is_fallback: boolean;
  playlist_checksum: string;
  /** timing only — not in replay hash */
  timing_ms: number;
}

export interface PREResolutionLog extends BaseLogLine {
  event_type: 'pre.resolution';
  correlation_id: string;
  screen_id: string;
  resolution_level: number;
  playlist_length: number;
  is_fallback: boolean;
  invariants_passed: boolean;
  playlist_checksum: string;
}

export interface ShadowComparisonLog extends BaseLogLine {
  event_type: 'shadow.comparison';
  invocation_id: string;
  screen_id: string;
  divergence_class: number | null;
  legacy_hash: string;
  pre_hash: string;
  rollback_required: boolean;
}

export interface RollbackTriggerLog extends BaseLogLine {
  event_type: 'rollback.trigger';
  invocation_id: string;
  screen_id: string;
  rollback_reason: string;
  rollback_severity: string;
  constitutional_reference: string | null;
}

export interface PreviewRequestLog extends BaseLogLine {
  event_type: 'preview.request';
  surface: 'current' | 'future' | 'diff' | 'entropy';
  screen_id: string;
  at: number;
  preview_checksum?: string;
}

export interface ReplayAuditWriteLog extends BaseLogLine {
  event_type: 'replay.audit.write';
  audit_record_id: string;
  screen_id: string;
  at: number;
  divergence_class: number | null;
}

export interface EntropyJobLog extends BaseLogLine {
  event_type: 'entropy.job';
  job_type: 'venue' | 'fleet';
  venue_id?: string;
  screen_count: number;
  composite_score: number;
  label: string;
  advisory_tier: number;
  duration_ms: number;
}

// ─── Union Type for all log lines ────────────────────────────────────────────

export type AnyLogLine =
  | InvariantViolationLog
  | InvariantPassLog
  | ReplayPassLog
  | ReplayFailLog
  | ReplayRunCompleteLog
  | EntropyBatchLog
  | EntropyMetricLog
  | EntropyMetricDetailLog
  | EntropyScoreDetailLog
  | AdvisoryEscalationLog
  | ForbiddenStateLog
  | ParityDivergenceLog
  | CanaryGateLog
  | EmergencyActivationLog
  | ConstitutionalBreachLog
  | PREInvocationLog
  | PREResolutionLog
  | ShadowComparisonLog
  | RollbackTriggerLog
  | PreviewRequestLog
  | ReplayAuditWriteLog
  | EntropyJobLog;
