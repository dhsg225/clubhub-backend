// ─── PRE INPUT / OUTPUT ───────────────────────────────────────────────────────

export interface Override {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  content_ref: string;
  expires_at: string | null; // GovernedClock ISO8601
  operator_id: string;
}

export interface ScheduleBlock {
  content_ref: string;
  starts_at: string; // GovernedClock ISO8601
  ends_at: string;   // GovernedClock ISO8601
}

export interface PREInput {
  resolution_id: string;
  scope_id: string;
  governed_timestamp: string; // GovernedClock ISO8601 — wall clock FORBIDDEN
  rule_version: string;
  override_stack: Override[];
  schedule_block: ScheduleBlock | null;
  emergency_active: boolean;
  emergency_scope: string | null; // scope_id or 'fleet'
  device_state: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  corpus_entry_id?: string; // present when replaying
}

export interface ResolutionStep {
  step: number;
  evaluated: string; // override id, 'schedule', or 'emergency'
  result: 'WIN' | 'SUPPRESSED' | 'EXPIRED' | 'OUT_OF_SCOPE';
  reason: string;
}

export interface PREOutput {
  resolution_id: string;
  scope_id: string;
  governed_timestamp: string;
  rule_version: string;
  effective_content: string;
  resolution_level: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  resolution_winner_id: string | null;
  resolution_path: ResolutionStep[];
  trace_id: string;
  computed_at: string; // GovernedClock ISO8601
  input_hash: string;  // SHA-256 of canonicalJSON(PREInput)
  output_hash: string; // SHA-256 of canonicalJSON(PREOutput excluding this field)
}

export type PREFailureCode =
  | 'INVALID_INPUT'
  | 'RULE_VERSION_MISMATCH'
  | 'NO_CONTENT_RESOLVED'
  | 'CLOCK_VIOLATION'
  | 'DETERMINISM_VIOLATION'
  | 'CORPUS_DIVERGENCE';

export interface PREFailure {
  resolution_id: string;
  scope_id: string;
  governed_timestamp: string;
  failure_code: PREFailureCode;
  message: string;
}

export type PREResult =
  | { ok: true; output: PREOutput }
  | { ok: false; failure: PREFailure };

// ─── TRACE ────────────────────────────────────────────────────────────────────

export interface PRETraceEvent {
  event_type: 'PRE_RESOLVED' | 'PRE_FAILED';
  trace_id: string;
  resolution_id: string;
  scope_id: string;
  governed_timestamp: string;
  rule_version: string;
  input_hash: string;
  output_hash?: string;
  resolution_level?: number;
  effective_content?: string;
  resolution_path_length?: number;
  failure_reason?: string;
  emitted_at: string; // GovernedClock ISO8601
  corpus_entry_id?: string;
}

// ─── STATE MACHINE ────────────────────────────────────────────────────────────

export interface TransitionRequest {
  toState: string;
  authority: 'OPERATOR' | 'BACKEND' | 'RECOVERY' | 'SCHEDULED';
  sourceId: string;
  reason: string;
  governedTimestamp: string; // GovernedClock ISO8601
}

export interface StateMutationEvent {
  machineId: string;
  fromState: string;
  toState: string;
  trigger: string;
  authority: string;
  transitionDurationMs: number;
  timestamp: string; // GovernedClock ISO8601
  traceId: string;
  replayContext?: {
    packetId: string;
    packetTimestamp: string;
  };
}

export interface StateSnapshot {
  machineId: string;
  state: string;
  context: Record<string, unknown>;
  capturedAt: string;
  transitionReason: string;
}

// ─── CORPUS ───────────────────────────────────────────────────────────────────

export interface CorpusEntry {
  corpus_entry_id: string;
  input: PREInput;
  output: PREOutput;
  trace_event: PRETraceEvent;
  prior_entry_hash: string | null; // null for first entry in chain
  entry_hash: string;              // SHA-256 of canonical(corpus_entry_id + input_hash + output_hash + prior_entry_hash)
}

// ─── VERIFICATION ─────────────────────────────────────────────────────────────

export type FailureClass =
  | 'CLASS_1_DETERMINISM_FAILURE'
  | 'CLASS_2_CORPUS_DIVERGENCE'
  | 'CLASS_3_RECONSTRUCTION_FAILURE'
  | 'CLASS_4_PARITY_VIOLATION'
  | 'CLASS_5_APPROXIMATION_UNDISCLOSED';

export type VerificationResultType = 'MATCH' | 'DIVERGENCE_DETECTED';

export interface FieldDiff {
  field: string;
  original: unknown;
  replayed: unknown;
}

export interface VerificationResult {
  result: VerificationResultType;
  corpus_entry_id: string;
  failure_class?: FailureClass;
  reason?: string;
  diff?: FieldDiff[];
}
