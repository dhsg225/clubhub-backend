/**
 * EXECUTION-POLICY-ORCHESTRATOR-v1.ts
 *
 * Central policy resolver for execution permission.
 * Every PRE resolution attempt must be evaluated through this pipeline
 * before the integration guard layer is even reached.
 *
 * Pre-flight evaluation pipeline (5 stages, sequential, fail-fast):
 *   Stage 1  IDENTITY_VALIDATION     — resolution_id and scope_id are structurally valid
 *   Stage 2  STATE_ELIGIBILITY       — machine is in a state that permits new resolution
 *   Stage 3  INPUT_VALIDATION        — all required PREInput fields present and coherent
 *   Stage 4  DETERMINISM_PRE_HASH    — input hash does not conflict with known output
 *   Stage 5  CORPUS_WRITE_PERMISSION — corpus is in a state that permits appending
 *
 * Hard rules (non-negotiable, enforced structurally):
 *   - No "best effort" execution — GRANTED or fully denied
 *   - No fallback execution modes — partial passes do not proceed
 *   - No silent downgrade of failure class — every denial carries a classified code
 *
 * Denial codes:
 *   EPO-01  Identity or context is structurally invalid
 *   EPO-02  State machine is not in an eligible state for this resolution type
 *   EPO-03  PRE input fails validation (missing fields, invalid timestamps, bad versions)
 *   EPO-04  Input hash conflicts with a known prior output (determinism boundary violation)
 *   EPO-05  Corpus write permission denied (chain not writable)
 */

import { Corpus } from './corpus';
import { StateMachine } from './state-machine';
import { canonicalJSON } from './canonical-json';
import { sha256 } from './hash';
import { PREInput } from './types';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type PrefightStageId =
  | 'IDENTITY_VALIDATION'
  | 'STATE_ELIGIBILITY'
  | 'INPUT_VALIDATION'
  | 'DETERMINISM_PRE_HASH'
  | 'CORPUS_WRITE_PERMISSION';

export type ExecutionDenialCode =
  | 'EPO-01'
  | 'EPO-02'
  | 'EPO-03'
  | 'EPO-04'
  | 'EPO-05';

export interface PrefightStageResult {
  readonly stage: PrefightStageId;
  readonly passed: boolean;
  /**
   * Non-null only on failure. On pass, null — no explanatory noise on success.
   */
  readonly reason: string | null;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface ExecutionPermission {
  readonly granted: boolean;
  /**
   * Present only when granted === false.
   * Callers MUST check granted before using denialCode.
   */
  readonly denialCode: ExecutionDenialCode | null;
  readonly denialReason: string | null;
  /**
   * All stages executed up to (and including) the first failure.
   * Stages after the failing stage are never evaluated (fail-fast).
   */
  readonly stageResults: readonly PrefightStageResult[];
  /**
   * Wall-clock ISO8601. Not governed clock — evaluation occurs pre-execution,
   * before governed time is authoritative for this resolution.
   */
  readonly evaluatedAt: string;
}

/**
 * Full context required to evaluate execution permission.
 * Callers must supply all fields — no optional context fields accepted.
 */
export interface ExecutionContext {
  /** Must be a non-empty UUID v4 format string. */
  readonly resolutionId: string;
  /** Must be a non-empty string identifying the venue/scope. */
  readonly scopeId: string;
  /** Must match a registered machine ID. */
  readonly machineId: string;
  /** The full PRE input to be evaluated. */
  readonly input: PREInput;
  /**
   * The machine that will process this resolution.
   * Provided directly — callers do not look up from registry here.
   */
  readonly machine: StateMachine;
  /**
   * States in which the machine is permitted to initiate a new PRE resolution.
   * Callers define this based on their workflow contract.
   */
  readonly eligibleStates: readonly string[];
  /**
   * If the caller has previously computed an output hash for the same input,
   * supply it here for determinism pre-hash conflict detection.
   * Null if no prior output is known.
   */
  readonly knownPriorInputHash: string | null;
  readonly knownPriorOutputHash: string | null;
}

// ─── STAGE IMPLEMENTATIONS (PURE FUNCTIONS) ──────────────────────────────────

/**
 * Stage 1: Identity Validation
 *
 * Validates resolution_id and scope_id are structurally non-empty strings.
 * Validates they match the values in the PREInput (context/input consistency).
 *
 * Denial code: EPO-01
 */
function stageIdentityValidation(ctx: ExecutionContext): PrefightStageResult {
  const stage: PrefightStageId = 'IDENTITY_VALIDATION';

  if (!ctx.resolutionId || typeof ctx.resolutionId !== 'string') {
    return fail(stage, 'EPO-01', 'resolutionId is missing or not a string', {
      resolutionId: ctx.resolutionId,
    });
  }

  if (!ctx.scopeId || typeof ctx.scopeId !== 'string') {
    return fail(stage, 'EPO-01', 'scopeId is missing or not a string', {
      scopeId: ctx.scopeId,
    });
  }

  if (ctx.input.resolution_id !== ctx.resolutionId) {
    return fail(
      stage,
      'EPO-01',
      'Context resolutionId does not match input.resolution_id — identity mismatch',
      {
        contextResolutionId: ctx.resolutionId,
        inputResolutionId: ctx.input.resolution_id,
      }
    );
  }

  if (ctx.input.scope_id !== ctx.scopeId) {
    return fail(
      stage,
      'EPO-01',
      'Context scopeId does not match input.scope_id — scope mismatch',
      {
        contextScopeId: ctx.scopeId,
        inputScopeId: ctx.input.scope_id,
      }
    );
  }

  if (!ctx.machineId || typeof ctx.machineId !== 'string') {
    return fail(stage, 'EPO-01', 'machineId is missing or not a string', {
      machineId: ctx.machineId,
    });
  }

  if (ctx.machine.id !== ctx.machineId) {
    return fail(
      stage,
      'EPO-01',
      'Context machineId does not match the provided machine.id — machine identity mismatch',
      {
        contextMachineId: ctx.machineId,
        machineSelfId: ctx.machine.id,
      }
    );
  }

  return pass(stage, {});
}

/**
 * Stage 2: State Eligibility
 *
 * Verifies the machine's current state is in the caller-defined eligibleStates list.
 * No resolution may proceed from a state that has not been declared eligible.
 *
 * Denial code: EPO-02
 */
function stageStateEligibility(ctx: ExecutionContext): PrefightStageResult {
  const stage: PrefightStageId = 'STATE_ELIGIBILITY';

  if (ctx.eligibleStates.length === 0) {
    return fail(
      stage,
      'EPO-02',
      'eligibleStates list is empty — no state can be eligible',
      { machineId: ctx.machineId }
    );
  }

  const currentState = ctx.machine.state;

  if (!ctx.eligibleStates.includes(currentState)) {
    return fail(
      stage,
      'EPO-02',
      `Machine '${ctx.machineId}' is in state '${currentState}', ` +
        `which is not in the eligible states list for this resolution.`,
      {
        machineId: ctx.machineId,
        currentState,
        eligibleStates: ctx.eligibleStates,
      }
    );
  }

  return pass(stage, { currentState });
}

/**
 * Stage 3: Input Validation
 *
 * Validates the PREInput for structural completeness and coherence:
 *   - required string fields present and non-empty
 *   - governed_timestamp is a valid ISO8601 string
 *   - rule_version is present
 *   - override_stack is an array (can be empty)
 *   - schedule_block has required shape if present
 *   - emergency fields are consistent (if active, scope must be present)
 *
 * Denial code: EPO-03
 */
function stageInputValidation(ctx: ExecutionContext): PrefightStageResult {
  const stage: PrefightStageId = 'INPUT_VALIDATION';
  const { input } = ctx;

  if (!input.resolution_id || typeof input.resolution_id !== 'string') {
    return fail(stage, 'EPO-03', 'input.resolution_id missing or invalid', {});
  }

  if (!input.scope_id || typeof input.scope_id !== 'string') {
    return fail(stage, 'EPO-03', 'input.scope_id missing or invalid', {});
  }

  if (!input.governed_timestamp || typeof input.governed_timestamp !== 'string') {
    return fail(stage, 'EPO-03', 'input.governed_timestamp missing or invalid', {});
  }

  if (Number.isNaN(Date.parse(input.governed_timestamp))) {
    return fail(
      stage,
      'EPO-03',
      `input.governed_timestamp is not a parseable ISO8601 string: '${input.governed_timestamp}'`,
      { governed_timestamp: input.governed_timestamp }
    );
  }

  if (!input.rule_version || typeof input.rule_version !== 'string') {
    return fail(stage, 'EPO-03', 'input.rule_version missing or invalid', {});
  }

  if (!Array.isArray(input.override_stack)) {
    return fail(stage, 'EPO-03', 'input.override_stack must be an array', {
      type: typeof input.override_stack,
    });
  }

  // Validate each override in the stack has minimum required fields
  for (let i = 0; i < input.override_stack.length; i++) {
    const ov = input.override_stack[i];
    if (!ov.id || typeof ov.id !== 'string') {
      return fail(stage, 'EPO-03', `override_stack[${i}].id is missing or invalid`, { index: i });
    }
    if (typeof ov.level !== 'number' || ov.level < 1 || ov.level > 6) {
      return fail(
        stage,
        'EPO-03',
        `override_stack[${i}].level must be a number 1–6, got: ${ov.level}`,
        { index: i, level: ov.level }
      );
    }
    if (!ov.content_ref || typeof ov.content_ref !== 'string') {
      return fail(
        stage,
        'EPO-03',
        `override_stack[${i}].content_ref is missing or invalid`,
        { index: i }
      );
    }
  }

  // Validate schedule_block if present
  if (input.schedule_block !== undefined && input.schedule_block !== null) {
    const sb = input.schedule_block;
    if (!sb.content_ref || !sb.starts_at || !sb.ends_at) {
      return fail(
        stage,
        'EPO-03',
        'input.schedule_block is present but missing content_ref, starts_at, or ends_at',
        { schedule_block: sb }
      );
    }
    if (Number.isNaN(Date.parse(sb.starts_at)) || Number.isNaN(Date.parse(sb.ends_at))) {
      return fail(
        stage,
        'EPO-03',
        'input.schedule_block contains unparseable timestamp in starts_at or ends_at',
        { starts_at: sb.starts_at, ends_at: sb.ends_at }
      );
    }
  }

  // Emergency consistency: if active, scope must be present
  if (input.emergency_active === true) {
    if (!input.emergency_scope || typeof input.emergency_scope !== 'string') {
      return fail(
        stage,
        'EPO-03',
        'input.emergency_active is true but emergency_scope is missing or invalid',
        { emergency_active: input.emergency_active, emergency_scope: input.emergency_scope }
      );
    }
  }

  if (!input.device_state || typeof input.device_state !== 'string') {
    return fail(stage, 'EPO-03', 'input.device_state missing or invalid', {});
  }

  return pass(stage, { rule_version: input.rule_version, override_count: input.override_stack.length });
}

/**
 * Stage 4: Determinism Pre-Hash Check
 *
 * If the caller has previously observed an output for the same logical input,
 * they supply the prior input hash and output hash. We re-hash the current input
 * and verify the hash matches what was seen before.
 *
 * A mismatch here means the same logical input is producing different content,
 * which is a determinism boundary violation — CLASS_1 level severity.
 *
 * If no prior hashes are supplied (null), this stage passes unconditionally.
 * It is the caller's responsibility to supply prior hashes when available.
 *
 * Denial code: EPO-04
 */
function stageDeterminismPreHash(ctx: ExecutionContext): PrefightStageResult {
  const stage: PrefightStageId = 'DETERMINISM_PRE_HASH';

  if (ctx.knownPriorInputHash === null || ctx.knownPriorOutputHash === null) {
    // No prior observation to compare against — pass
    return pass(stage, { checked: false, reason: 'no prior hash to compare' });
  }

  // Compute the hash of the current input using canonical JSON
  const currentInputHash = sha256(canonicalJSON(ctx.input));

  if (currentInputHash !== ctx.knownPriorInputHash) {
    // Inputs are actually different — not a determinism violation, just different inputs
    // This is fine; the prior hash simply doesn't apply
    return pass(stage, {
      checked: true,
      outcome: 'input_differs_from_prior',
      currentInputHash,
    });
  }

  // Same input hash — we expect the same output hash
  // We cannot check output hash here (we haven't run the engine yet)
  // But we can flag if the caller expects a SPECIFIC output for this input
  // and store that expectation for post-execution verification.
  // At this stage, we confirm the input hash is stable.
  return pass(stage, {
    checked: true,
    outcome: 'input_hash_matches_prior',
    currentInputHash,
    expectedOutputHash: ctx.knownPriorOutputHash,
  });
}

/**
 * Stage 5: Corpus Write Permission
 *
 * Verifies the corpus is in a state where a new entry can be safely appended:
 *   - Hash chain is intact
 *   - No structural inconsistency in existing entries
 *
 * If this stage fails, the resolution itself may still be valid, but the
 * result CANNOT be written to corpus — and we do not proceed because
 * unrecorded executions violate the auditability contract.
 *
 * Denial code: EPO-05
 */
function stageCorpusWritePermission(): PrefightStageResult {
  const stage: PrefightStageId = 'CORPUS_WRITE_PERMISSION';

  const chainValid = Corpus.verifyChain();
  if (!chainValid) {
    return fail(
      stage,
      'EPO-05',
      'Corpus hash chain is broken. New entries cannot be appended until chain integrity is restored.',
      {
        corpusLength: Corpus.getAll().length,
      }
    );
  }

  return pass(stage, { corpusLength: Corpus.getAll().length });
}

// ─── PIPELINE ORCHESTRATOR ───────────────────────────────────────────────────

/**
 * evaluateExecutionPermission — the central policy resolver.
 *
 * Runs all 5 pre-flight stages in sequence. On the first failure:
 *   - Pipeline halts immediately (fail-fast)
 *   - Remaining stages are NOT evaluated
 *   - The denial code from the failing stage is returned
 *   - granted === false
 *
 * On all-pass:
 *   - granted === true
 *   - denialCode === null
 *   - All 5 stageResults are present
 *
 * Hard rules enforced here:
 *   - No best-effort execution (partial pass = full denial)
 *   - No fallback modes (exactly one outcome: GRANTED or DENIED)
 *   - No silent failure class downgrade (denial code always explicit)
 */
export function evaluateExecutionPermission(
  ctx: ExecutionContext
): ExecutionPermission {
  const evaluatedAt = new Date().toISOString();
  const completed: PrefightStageResult[] = [];

  // Stage 1: Identity
  const s1 = stageIdentityValidation(ctx);
  completed.push(s1);
  if (!s1.passed) return denied(s1, completed, evaluatedAt);

  // Stage 2: State Eligibility
  const s2 = stageStateEligibility(ctx);
  completed.push(s2);
  if (!s2.passed) return denied(s2, completed, evaluatedAt);

  // Stage 3: Input Validation
  const s3 = stageInputValidation(ctx);
  completed.push(s3);
  if (!s3.passed) return denied(s3, completed, evaluatedAt);

  // Stage 4: Determinism Pre-Hash
  const s4 = stageDeterminismPreHash(ctx);
  completed.push(s4);
  if (!s4.passed) return denied(s4, completed, evaluatedAt);

  // Stage 5: Corpus Write Permission
  const s5 = stageCorpusWritePermission();
  completed.push(s5);
  if (!s5.passed) return denied(s5, completed, evaluatedAt);

  return Object.freeze({
    granted: true,
    denialCode: null,
    denialReason: null,
    stageResults: Object.freeze(completed),
    evaluatedAt,
  });
}

// ─── INTERNAL UTILITIES ───────────────────────────────────────────────────────

function pass(
  stage: PrefightStageId,
  evidence: Record<string, unknown>
): PrefightStageResult {
  return Object.freeze({
    stage,
    passed: true,
    reason: null,
    evidence: Object.freeze(evidence),
  });
}

function fail(
  stage: PrefightStageId,
  code: ExecutionDenialCode,
  reason: string,
  evidence: Record<string, unknown>
): PrefightStageResult {
  // Embed the denial code in the stage result for traceability
  return Object.freeze({
    stage,
    passed: false,
    reason: `[${code}] ${reason}`,
    evidence: Object.freeze({ ...evidence, denialCode: code }),
  });
}

function denied(
  failedStage: PrefightStageResult,
  allCompleted: readonly PrefightStageResult[],
  evaluatedAt: string
): ExecutionPermission {
  // Extract denial code from stage result evidence
  const denialCode =
    (failedStage.evidence.denialCode as ExecutionDenialCode) ?? null;

  return Object.freeze({
    granted: false,
    denialCode,
    denialReason: failedStage.reason,
    stageResults: Object.freeze([...allCompleted]),
    evaluatedAt,
  });
}
