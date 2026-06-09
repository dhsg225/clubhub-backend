"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deterministicSortByNumericKey = deterministicSortByNumericKey;
exports.deterministicSortByStringKey = deterministicSortByStringKey;
exports.deterministicSortByFields = deterministicSortByFields;
exports.deterministicSortStrings = deterministicSortStrings;
exports.deterministicSortPacketIds = deterministicSortPacketIds;
exports.assertTotalOrdering = assertTotalOrdering;
/**
 * Sort an array of objects by a numeric key, with `id` (string) as the
 * tiebreaker. Returns a new array (does not mutate the input).
 *
 * All objects MUST have an `id` field for the tiebreaker to apply.
 * Objects without `id` will not have a stable tiebreaker — use
 * deterministicSortByFields() with an explicit tiebreaker field instead.
 */
function deterministicSortByNumericKey(items, getKey) {
    return [...items].sort((a, b) => {
        const keyDiff = getKey(a) - getKey(b);
        if (keyDiff !== 0)
            return keyDiff;
        // Tiebreaker: lexicographic comparison of id
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}
/**
 * Sort an array of objects by a string key (lexicographic), with `id` as
 * the tiebreaker. Returns a new array.
 */
function deterministicSortByStringKey(items, getKey) {
    return [...items].sort((a, b) => {
        const keyA = getKey(a);
        const keyB = getKey(b);
        if (keyA < keyB)
            return -1;
        if (keyA > keyB)
            return 1;
        // Tiebreaker: id
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}
/**
 * Sort an array by multiple fields in priority order, with `id` as the final
 * tiebreaker. Fields are evaluated in the order provided; the first non-zero
 * comparison determines order.
 *
 * Each field comparator returns -1, 0, or 1.
 */
function deterministicSortByFields(items, comparators) {
    return [...items].sort((a, b) => {
        for (const comparator of comparators) {
            const result = comparator(a, b);
            if (result !== 0)
                return result;
        }
        // Final tiebreaker: id (always present, always unique)
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}
/**
 * Sort an array of plain strings lexicographically (Unicode code point order).
 * Returns a new array. Used for sorting object keys, fixture IDs, etc.
 *
 * This is the same ordering as Object.keys().sort() and is locale-independent
 * per ECMAScript spec (String comparison by code unit sequence).
 */
function deterministicSortStrings(strings) {
    return [...strings].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
/**
 * Sort corpus packet file names deterministically.
 * Packet IDs are in the form {CLASS}-{NNN}.json.
 * Sorting: by class name first (lexicographic), then by numeric NNN.
 *
 * Examples:
 *   CHAOS-001, CHAOS-002, EDGE-001, GOLD-001, GOLD-002
 */
function deterministicSortPacketIds(packetIds) {
    return [...packetIds].sort((a, b) => {
        const [classA = '', numA = '0'] = splitPacketId(a);
        const [classB = '', numB = '0'] = splitPacketId(b);
        if (classA < classB)
            return -1;
        if (classA > classB)
            return 1;
        return parseInt(numA, 10) - parseInt(numB, 10);
    });
}
function splitPacketId(id) {
    // Strip .json extension if present
    const bare = id.endsWith('.json') ? id.slice(0, -5) : id;
    const lastDash = bare.lastIndexOf('-');
    if (lastDash === -1)
        return [bare, '0'];
    return [bare.slice(0, lastDash), bare.slice(lastDash + 1)];
}
/**
 * Assert that an array has a total ordering under a given comparator —
 * i.e., no two distinct elements compare as equal.
 *
 * Used in CI to verify that sort operations used in PRE output construction
 * are total. A non-total sort is a potential INV-3 (Determinism) violation.
 *
 * Throws if any pair of distinct elements compares as equal.
 */
function assertTotalOrdering(items, comparator, label) {
    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            const result = comparator(items[i], items[j]);
            if (result === 0) {
                throw new Error(`assertTotalOrdering: non-total ordering detected for "${label}". ` +
                    `Elements at positions ${i} and ${j} compare as equal. ` +
                    `All sort operations in PRE must have a total ordering (INV-3).`);
            }
        }
    }
}
//# sourceMappingURL=stable-sort.js.map