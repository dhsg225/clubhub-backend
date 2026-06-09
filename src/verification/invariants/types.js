"use strict";
/**
 * Invariant execution types.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §4
 * PRE invariants: ENGINEERING-CONSTITUTION-v1.md §10, PRE-REFERENCE-IMPLEMENTATION-v1.md §3
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvariantViolationError = void 0;
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
class InvariantViolationError extends Error {
    invariantId;
    severity;
    result;
    constructor(result) {
        super(`INVARIANT VIOLATION [${result.severity}] ${result.invariantId}: ${result.message}`);
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
exports.InvariantViolationError = InvariantViolationError;
//# sourceMappingURL=types.js.map