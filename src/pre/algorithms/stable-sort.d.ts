/**
 * Deterministic stable sort utilities.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §14.1
 * Constitutional reference: REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md §11.2
 *
 * JavaScript's Array.prototype.sort() is stable in all V8 versions >= 7.0
 * (Node.js >= 11) and mandated stable by ECMAScript 2019+. However, when two
 * elements compare as equal, their relative order is implementation-defined.
 *
 * For PRE determinism (INV-3), any sort that affects output must have a
 * TOTAL ordering — no two elements may compare as equal. These utilities
 * enforce total ordering by appending a tiebreaker derived from a
 * constitutionally stable identifier (e.g., `id` field, `packet_id`).
 *
 * FORBIDDEN: Any sort that can produce different orderings for the same input
 * is a violation of INV-3 (Determinism) and FP-10 (nondeterministic ordering).
 */
/**
 * Sort an array of objects by a numeric key, with `id` (string) as the
 * tiebreaker. Returns a new array (does not mutate the input).
 *
 * All objects MUST have an `id` field for the tiebreaker to apply.
 * Objects without `id` will not have a stable tiebreaker — use
 * deterministicSortByFields() with an explicit tiebreaker field instead.
 */
export declare function deterministicSortByNumericKey<T extends {
    id: string;
}>(items: T[], getKey: (item: T) => number): T[];
/**
 * Sort an array of objects by a string key (lexicographic), with `id` as
 * the tiebreaker. Returns a new array.
 */
export declare function deterministicSortByStringKey<T extends {
    id: string;
}>(items: T[], getKey: (item: T) => string): T[];
/**
 * Sort an array by multiple fields in priority order, with `id` as the final
 * tiebreaker. Fields are evaluated in the order provided; the first non-zero
 * comparison determines order.
 *
 * Each field comparator returns -1, 0, or 1.
 */
export declare function deterministicSortByFields<T extends {
    id: string;
}>(items: T[], comparators: Array<(a: T, b: T) => number>): T[];
/**
 * Sort an array of plain strings lexicographically (Unicode code point order).
 * Returns a new array. Used for sorting object keys, fixture IDs, etc.
 *
 * This is the same ordering as Object.keys().sort() and is locale-independent
 * per ECMAScript spec (String comparison by code unit sequence).
 */
export declare function deterministicSortStrings(strings: string[]): string[];
/**
 * Sort corpus packet file names deterministically.
 * Packet IDs are in the form {CLASS}-{NNN}.json.
 * Sorting: by class name first (lexicographic), then by numeric NNN.
 *
 * Examples:
 *   CHAOS-001, CHAOS-002, EDGE-001, GOLD-001, GOLD-002
 */
export declare function deterministicSortPacketIds(packetIds: string[]): string[];
/**
 * Assert that an array has a total ordering under a given comparator —
 * i.e., no two distinct elements compare as equal.
 *
 * Used in CI to verify that sort operations used in PRE output construction
 * are total. A non-total sort is a potential INV-3 (Determinism) violation.
 *
 * Throws if any pair of distinct elements compares as equal.
 */
export declare function assertTotalOrdering<T>(items: T[], comparator: (a: T, b: T) => number, label: string): void;
//# sourceMappingURL=stable-sort.d.ts.map