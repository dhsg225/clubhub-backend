/**
 * Invariant execution types.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §4
 * PRE invariants: ENGINEERING-CONSTITUTION-v1.md §10, PRE-REFERENCE-IMPLEMENTATION-v1.md §3
 */
import type { PRE_Output, PRE_Input } from '../../pre/types';
export type InvariantSeverity = 'INFO' | 'ADVISORY' | 'WARNING' | 'ERROR' | 'CONSTITUTIONAL_BREACH' | 'CATASTROPHIC';
export interface InvariantResult {
    invariantId: string;
    passed: boolean;
    message: string;
    severity: InvariantSeverity;
    /** Additional context, e.g., which content_id failed which check */
    detail?: Record<string, unknown>;
}
export interface InvariantDefinition {
    id: string;
    description: string;
    severity: InvariantSeverity;
    /**
     * Assert the invariant.
     * Returns InvariantResult — MUST NOT throw.
     * If assertion logic itself throws, the registry catches and wraps it.
     */
    assert: (output: PRE_Output, input: PRE_Input) => InvariantResult;
}
/**
 * Thrown when a CONSTITUTIONAL_BREACH or CATASTROPHIC invariant fails.
 * This error MUST NOT be caught and suppressed anywhere in the codebase.
 * It terminates the current execution path and escalates immediately.
 *
 * Per EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §4.4:
 * "An InvariantViolationError in any of these contexts is a CONSTITUTIONAL_BREACH.
 *  It cannot be caught and suppressed."
 */
export declare class InvariantViolationError extends Error {
    readonly invariantId: string;
    readonly severity: InvariantSeverity;
    readonly result: InvariantResult;
    constructor(result: InvariantResult);
}
//# sourceMappingURL=types.d.ts.map