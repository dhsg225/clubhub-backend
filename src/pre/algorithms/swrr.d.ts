/**
 * Smooth Weighted Round Robin (SWRR) — deterministic content interleaving.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §16.2
 * Invariant: INV-3 (Determinism) — identical inputs MUST produce identical output
 *
 * This is the Nginx SWRR algorithm. It is constitutionally fixed.
 * Changes require constitutional amendment.
 *
 * Correctness property: For any completion, item i appears exactly weight_i times.
 * The maximum gap between any two appearances of the same item is bounded.
 *
 * Tie-breaking: When two items have equal current_weight, the item with the
 * lower array index is selected. Array input order MUST be deterministic
 * at the call site.
 */
export interface WeightedItem<T> {
    item: T;
    /** Integer weight > 0. Non-integer weights are a CONSTITUTIONAL_BREACH (INV-3). */
    weight: number;
}
/**
 * Produce a maximally smooth interleaving of weighted items.
 *
 * Returns an ordered array of items where item i appears exactly weight_i times,
 * with appearances as evenly distributed as possible.
 *
 * The returned array length equals sum(weights).
 *
 * Preconditions:
 * - All weights must be positive integers (> 0)
 * - The weighted_items array must not be empty
 * - Input order must be deterministic at the call site
 *
 * Throws on precondition violations — invalid weights indicate a constitutional
 * violation in the calling level's weight computation.
 */
export declare function smoothWeightedRoundRobin<T>(weightedItems: ReadonlyArray<WeightedItem<T>>): T[];
/**
 * Compute the greatest common divisor of two positive integers.
 * Used by weightedPlaylistResolver for weight normalization.
 *
 * Per PRE-REFERENCE-IMPLEMENTATION-v1.md §16.4.
 */
export declare function gcd(a: number, b: number): number;
/**
 * Compute the GCD of an array of positive integers.
 */
export declare function gcdOfAll(values: number[]): number;
/**
 * Resolve a playlist using SWRR with weight normalization.
 *
 * Per PRE-REFERENCE-IMPLEMENTATION-v1.md §16.3:
 * 1. Default weight is 100 if absent
 * 2. Normalize weights by dividing by GCD (reduces total interleave size)
 * 3. Apply SWRR to produce the final ordered playlist
 *
 * This is the function called by LEVEL_5 structural resolution to
 * produce the final playlist ordering.
 */
export declare function weightedPlaylistResolver<T extends {
    weight?: number;
}>(items: T[]): T[];
//# sourceMappingURL=swrr.d.ts.map