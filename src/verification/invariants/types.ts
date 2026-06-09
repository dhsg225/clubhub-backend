/**
 * Invariant execution types.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §4
 * PRE invariants: ENGINEERING-CONSTITUTION-v1.md §10, PRE-REFERENCE-IMPLEMENTATION-v1.md §3
 */

import type { PRE_Output, PRE_Input } from '../../pre/types';

// ─── Severity ─────────────────────────────────────────────────────────────────

export type InvariantSeverity =
  | 'INFO'
  | 'ADVISORY'
  | 'WARNING'
  | 'ERROR'
  | 'CONSTITUTIONAL_BREACH'
  | 'CATASTROPHIC';

// ─── Invariant Result ─────────────────────────────────────────────────────────

export interface InvariantResult {
  invariantId: string;    // e.g., 'INV-1'
  passed:      boolean;
  message:     string;
  severity:    InvariantSeverity;
  /** Additional context, e.g., which content_id failed which check */
  detail?:     Record<string, unknown>;
}

// ─── Invariant Registration ───────────────────────────────────────────────────

export interface InvariantDefinition {
  id:          string;     // e.g., 'INV-1'
  description: string;
  severity:    InvariantSeverity;
  /**
   * Assert the invariant.
   * Returns InvariantResult — MUST NOT throw.
   * If assertion logic itself throws, the registry catches and wraps it.
   */
  assert: (output: PRE_Output, input: PRE_Input) => InvariantResult;
}

// ─── Invariant Violation Error ────────────────────────────────────────────────

/**
 * Thrown when a CONSTITUTIONAL_BREACH or CATASTROPHIC invariant fails.
 * This error MUST NOT be caught and suppressed anywhere in the codebase.
 * It terminates the current execution path and escalates immediately.
 *
 * Per EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §4.4:
 * "An InvariantViolationError in any of these contexts is a CONSTITUTIONAL_BREACH.
 *  It cannot be caught and suppressed."
 */
export class InvariantViolationError extends Error {
  public readonly invariantId: string;
  public readonly severity: InvariantSeverity;
  public readonly result: InvariantResult;

  constructor(result: InvariantResult) {
    super(
      `INVARIANT VIOLATION [${result.severity}] ${result.invariantId}: ${result.message}`
    );
    this.name = 'InvariantViolationError';
    this.invariantId = result.invariantId;
    this.severity = result.severity;
    this.result = result;

    // Preserve stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvariantViolationError);
    }
  }
}
