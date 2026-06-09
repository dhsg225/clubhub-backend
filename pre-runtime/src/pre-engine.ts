import {
  PREInput,
  PREOutput,
  PREResult,
  PREFailure,
  PREFailureCode,
  ResolutionStep,
  Override,
  PRETraceEvent,
} from './types';
import { canonicalJSON } from './canonical-json';
import { sha256, hashObject } from './hash';
import { GovernedClock } from './governed-clock';
import { TraceStore } from './trace-store';

/**
 * PRE Resolution Engine.
 *
 * resolve() is the public entry point. It:
 *   1. Reads GovernedClock.now() as computed_at (caller must set clock before calling)
 *   2. Delegates to the pure _resolve() function
 *   3. Emits a trace event as a side effect (after pure function returns)
 *
 * _resolve() is a PURE FUNCTION:
 *   - No I/O
 *   - No side effects
 *   - No wall-clock access
 *   - Same inputs → same output, always
 *
 * Follows exactly the 8 steps defined in MINIMAL-PRE-RUNNER-SPEC-v1.md.
 */

const SUPPORTED_RULE_VERSIONS = ['1.0.0'];
const EMERGENCY_CONTENT_REF = 'EMERGENCY_CONTENT';

// ─── PUBLIC ENTRY POINT ──────────────────────────────────────────────────────

export function resolve(input: PREInput): PREResult {
  const computedAt = GovernedClock.now(); // governed, not wall clock
  const result = _resolve(input, computedAt);

  // Step 7: Emit trace event (side effect, executed after pure function returns)
  const traceEvent = buildTraceEvent(input, result, computedAt);
  TraceStore.appendPRE(traceEvent);

  return result;
}

// ─── PURE RESOLUTION FUNCTION ────────────────────────────────────────────────

export function _resolve(input: PREInput, computedAt: string): PREResult {
  // Step 1: Validate input
  const validationError = validateInput(input);
  if (validationError) {
    return failure(input, 'INVALID_INPUT', validationError);
  }

  // Check rule version
  if (!SUPPORTED_RULE_VERSIONS.includes(input.rule_version)) {
    return failure(
      input,
      'RULE_VERSION_MISMATCH',
      `Unsupported rule_version: ${input.rule_version}. Supported: ${SUPPORTED_RULE_VERSIONS.join(', ')}`
    );
  }

  // Step 2: Check emergency activation
  const emergencyApplies =
    input.emergency_active &&
    (input.emergency_scope === input.scope_id || input.emergency_scope === 'fleet');

  if (emergencyApplies) {
    const path: ResolutionStep[] = [
      { step: 1, evaluated: 'emergency', result: 'WIN', reason: 'EMERGENCY_ACTIVE' },
    ];
    return buildOutput(input, computedAt, EMERGENCY_CONTENT_REF, 6, 'EMERGENCY', path);
  }

  // Step 3: Walk override stack — highest level first, id ascending as tiebreak
  const sortedOverrides = [...input.override_stack].sort(
    (a, b) => b.level - a.level || a.id.localeCompare(b.id)
  );

  const resolution_path: ResolutionStep[] = [];
  let step = 1;
  let winningOverride: Override | null = null;

  for (const override of sortedOverrides) {
    // 3a: Check expiry
    if (override.expires_at !== null && override.expires_at <= input.governed_timestamp) {
      resolution_path.push({
        step: step++,
        evaluated: override.id,
        result: 'EXPIRED',
        reason: 'TTL_EXPIRED',
      });
      continue;
    }

    // 3b: Suppressed by a higher-priority winner already found
    if (winningOverride !== null && override.level < winningOverride.level) {
      resolution_path.push({
        step: step++,
        evaluated: override.id,
        result: 'SUPPRESSED',
        reason: 'LOWER_PRIORITY',
      });
      continue;
    }

    // 3c: This override wins
    winningOverride = override;
    resolution_path.push({
      step: step++,
      evaluated: override.id,
      result: 'WIN',
      reason: `OVERRIDE_LEVEL_${override.level}`,
    });
    break; // First win at highest level terminates search
  }

  // Step 4: Fall through to schedule if no override won
  if (winningOverride === null) {
    const sb = input.schedule_block;
    if (
      sb !== null &&
      sb.starts_at <= input.governed_timestamp &&
      sb.ends_at > input.governed_timestamp
    ) {
      resolution_path.push({
        step: step++,
        evaluated: 'schedule',
        result: 'WIN',
        reason: 'SCHEDULE_ACTIVE',
      });
      return buildOutput(input, computedAt, sb.content_ref, 0, null, resolution_path);
    }

    return failure(
      input,
      'NO_CONTENT_RESOLVED',
      'No active override and no active schedule block for this scope at this timestamp'
    );
  }

  // Steps 5–6: Build output from winning override
  return buildOutput(
    input,
    computedAt,
    winningOverride.content_ref,
    winningOverride.level,
    winningOverride.id,
    resolution_path
  );
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

function buildOutput(
  input: PREInput,
  computedAt: string,
  effective_content: string,
  resolution_level: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  resolution_winner_id: string | null,
  resolution_path: ResolutionStep[]
): PREResult {
  // Step 6: Compute input_hash — exclude corpus_entry_id (replay metadata, not operational state)
  // This ensures input_hash is identical in live and replay contexts.
  const { corpus_entry_id: _omit, ...hashableInput } = input;
  const input_hash = hashObject(hashableInput);

  // Assemble output WITHOUT output_hash
  const partial: Omit<PREOutput, 'output_hash'> = {
    resolution_id: input.resolution_id,
    scope_id: input.scope_id,
    governed_timestamp: input.governed_timestamp,
    rule_version: input.rule_version,
    effective_content,
    resolution_level,
    resolution_winner_id,
    resolution_path,
    trace_id: sha256(
      canonicalJSON({ resolution_id: input.resolution_id, computed_at: computedAt, input_hash })
    ),
    computed_at: computedAt,
    input_hash,
  };

  // Compute output_hash over everything except itself
  const output_hash = sha256(canonicalJSON(partial));
  const output: PREOutput = { ...partial, output_hash };

  return { ok: true, output };
}

function failure(input: PREInput, code: PREFailureCode, message: string): PREResult {
  return {
    ok: false,
    failure: {
      resolution_id: input.resolution_id,
      scope_id: input.scope_id,
      governed_timestamp: input.governed_timestamp,
      failure_code: code,
      message,
    },
  };
}

function validateInput(input: PREInput): string | null {
  if (!input.resolution_id?.trim()) return 'resolution_id is required';
  if (!input.scope_id?.trim()) return 'scope_id is required';
  if (!input.governed_timestamp?.trim()) return 'governed_timestamp is required';
  if (isNaN(Date.parse(input.governed_timestamp)))
    return 'governed_timestamp must be valid ISO8601';
  if (!input.rule_version?.trim()) return 'rule_version is required';
  if (!Array.isArray(input.override_stack)) return 'override_stack must be an array';
  if (typeof input.emergency_active !== 'boolean') return 'emergency_active must be boolean';
  if (!['ONLINE', 'OFFLINE', 'DEGRADED'].includes(input.device_state))
    return `device_state must be ONLINE | OFFLINE | DEGRADED, got: ${input.device_state}`;
  return null;
}

function buildTraceEvent(
  input: PREInput,
  result: PREResult,
  emittedAt: string
): PRETraceEvent {
  if (result.ok) {
    const o = result.output;
    return {
      event_type: 'PRE_RESOLVED',
      trace_id: o.trace_id,
      resolution_id: o.resolution_id,
      scope_id: o.scope_id,
      governed_timestamp: o.governed_timestamp,
      rule_version: o.rule_version,
      input_hash: o.input_hash,
      output_hash: o.output_hash,
      resolution_level: o.resolution_level,
      effective_content: o.effective_content,
      resolution_path_length: o.resolution_path.length,
      emitted_at: emittedAt,
      corpus_entry_id: input.corpus_entry_id,
    };
  } else {
    const f = result.failure;
    const { corpus_entry_id: _omit, ...hashableInput } = input;
    return {
      event_type: 'PRE_FAILED',
      trace_id: sha256(canonicalJSON({ resolution_id: f.resolution_id, emitted_at: emittedAt })),
      resolution_id: f.resolution_id,
      scope_id: f.scope_id,
      governed_timestamp: f.governed_timestamp,
      rule_version: input.rule_version,
      input_hash: hashObject(hashableInput),
      failure_reason: `${f.failure_code}: ${f.message}`,
      emitted_at: emittedAt,
      corpus_entry_id: input.corpus_entry_id,
    };
  }
}
