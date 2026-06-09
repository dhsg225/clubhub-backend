"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.smoothWeightedRoundRobin = smoothWeightedRoundRobin;
exports.gcd = gcd;
exports.gcdOfAll = gcdOfAll;
exports.weightedPlaylistResolver = weightedPlaylistResolver;
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
function smoothWeightedRoundRobin(weightedItems) {
    if (weightedItems.length === 0) {
        throw new Error('smoothWeightedRoundRobin: empty weighted_items. ' +
            'PRE must provide at least one content item before calling SWRR.');
    }
    for (let i = 0; i < weightedItems.length; i++) {
        const w = weightedItems[i].weight;
        if (!Number.isInteger(w) || w <= 0) {
            throw new Error(`smoothWeightedRoundRobin: item at index ${i} has invalid weight ${w}. ` +
                `All SWRR weights must be positive integers. ` +
                `This indicates a violation of INV-3 (Determinism) in the calling level.`);
        }
    }
    const n = weightedItems.length;
    const total = weightedItems.reduce((sum, wi) => sum + wi.weight, 0);
    const output = [];
    // Current weight array — tracks running balance for each item
    const currentWeight = new Array(n).fill(0);
    for (let position = 0; position < total; position++) {
        // Step 1: Increment each item's current weight by its effective weight
        for (let i = 0; i < n; i++) {
            currentWeight[i] += weightedItems[i].weight;
        }
        // Step 2: Select item with highest current_weight
        // Tie-break: lower array index (deterministic)
        let best = 0;
        for (let i = 1; i < n; i++) {
            if (currentWeight[i] > currentWeight[best]) {
                best = i;
            }
        }
        // Step 3: Decrement selected item's weight by total
        currentWeight[best] -= total;
        // Step 4: Append selected item to output
        output.push(weightedItems[best].item);
    }
    return output;
}
/**
 * Compute the greatest common divisor of two positive integers.
 * Used by weightedPlaylistResolver for weight normalization.
 *
 * Per PRE-REFERENCE-IMPLEMENTATION-v1.md §16.4.
 */
function gcd(a, b) {
    while (b !== 0) {
        const temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}
/**
 * Compute the GCD of an array of positive integers.
 */
function gcdOfAll(values) {
    if (values.length === 0) {
        throw new Error('gcdOfAll: empty array');
    }
    return values.reduce((acc, v) => gcd(acc, v), values[0]);
}
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
function weightedPlaylistResolver(items) {
    if (items.length === 0) {
        throw new Error('weightedPlaylistResolver: empty items array. ' +
            'PRE must have at least one content item at LEVEL_5.');
    }
    const weights = items.map(item => item.weight ?? 100);
    const g = gcdOfAll(weights);
    const normalizedWeights = weights.map(w => Math.round(w / g));
    const weightedItems = items.map((item, i) => ({
        item,
        weight: normalizedWeights[i],
    }));
    return smoothWeightedRoundRobin(weightedItems);
}
//# sourceMappingURL=swrr.js.map