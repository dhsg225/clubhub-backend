/**
 * INV-1: Purity
 *
 * PRE.resolve() must be a pure function: no side effects, no writes,
 * no network access, no randomness.
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.1
 * Forbidden patterns: FP-02 (side effects in PRE), FP-03 (mutation on poll path)
 *
 * Runtime enforcement strategy:
 * INV-1 cannot be fully verified by inspecting the output alone — purity is
 * a behavioral property of the execution context, not the result.
 *
 * This invariant uses two enforcement mechanisms:
 * 1. Static: The forbidden-pattern scanner (CI stage 05) detects write operations,
 *    network imports, Date.now(), Math.random() in src/pre/ at PR time.
 * 2. Dynamic: The in-memory-db wrapper (src/verification/replay/in-memory-db.ts)
 *    throws if PRE attempts any write during replay execution.
 *
 * This invariant assertion validates the static contract by checking that the
 * output does not contain fields that would only be present if PRE had performed
 * a write (e.g., a newly generated ID, a timestamp that wasn't in the input).
 */
export {};
//# sourceMappingURL=inv1-purity.d.ts.map