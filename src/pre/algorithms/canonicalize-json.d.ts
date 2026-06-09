/**
 * Deterministic JSON serializer — canonicalizeJson()
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §16.1
 * Constitutional reference: REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md §3.4
 *
 * Canonical serialization rules (11 rules, all enforced here):
 *
 * Rule 1: Object keys sorted lexicographically by Unicode code point, recursively.
 * Rule 2: Array ordering preserved as-is (NOT sorted).
 * Rule 3: Timestamps as UTC millisecond integers (numbers, not ISO strings).
 * Rule 4: Timezone fields as IANA strings (e.g., "America/New_York").
 * Rule 5: Null values retained explicitly — null !== absent.
 * Rule 6: Booleans as true/false (not 1/0 or "true"/"false").
 * Rule 7: Integers as JSON numbers without decimal points.
 * Rule 8: Floats rounded to 4 decimal places.
 * Rule 9: UUIDs as lowercase hyphenated v4 strings.
 * Rule 10: UTF-8 encoding throughout.
 * Rule 11: No trailing whitespace; no indentation.
 *
 * This function is constitutionally fixed. No locale-sensitive behavior permitted.
 * No calls to toLocaleString(), Intl, or any locale-dependent API.
 */
/**
 * Serialize a value to its canonical JSON string representation.
 *
 * This is the function used for:
 * - Computing input_hash and output_hash in replay packets
 * - Computing playlist checksums in the PRE
 * - Any other context where deterministic serialization is required
 *
 * Returns a compact JSON string (no indentation, no trailing whitespace).
 */
export declare function canonicalizeJson(value: unknown): string;
/**
 * Serialize a value to canonical JSON then return both the string and its byte length.
 * Used by the FNV-1a hasher to avoid double-serialization.
 */
export declare function canonicalizeJsonWithLength(value: unknown): {
    json: string;
    byteLength: number;
};
/**
 * Deep-clone a value through canonical serialization and deserialization.
 * This guarantees the result has the same canonical form as the original.
 * Used for constructing test fixtures where deep equality must be by
 * canonical value, not object identity.
 */
export declare function canonicalClone<T>(value: T): T;
//# sourceMappingURL=canonicalize-json.d.ts.map