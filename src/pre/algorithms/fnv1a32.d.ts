/**
 * FNV-1a 32-bit checksum algorithm.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §18.1
 * Constitutional reference: REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md §3.6
 *
 * Constants are constitutionally fixed. Changes require constitutional amendment.
 * Algorithm: for each byte b: hash = (hash XOR b) × FNV1A_PRIME, mod 2^32
 */
/**
 * Compute FNV-1a 32-bit hash of a UTF-8 string.
 * Returns a lowercase hex string (8 characters, zero-padded).
 *
 * This function is pure and deterministic. Given the same input string it
 * MUST always return the same output, regardless of platform, locale, or
 * execution environment.
 */
export declare function fnv1a32(input: string): string;
/**
 * Compute FNV-1a 32-bit hash of a Buffer (raw bytes).
 * Used when the input has already been serialized to bytes.
 */
export declare function fnv1a32Bytes(bytes: Buffer | Uint8Array): string;
/**
 * Test vectors from PRE-REFERENCE-IMPLEMENTATION-v1.md Appendix B.
 * These vectors are constitutionally fixed — if they fail, the implementation
 * is non-conformant and MUST NOT be deployed.
 *
 * These are embedded here (not in a test file) so the implementation can
 * self-verify at module load time in test mode.
 */
export declare const FNV1A_TEST_VECTORS: readonly [{
    readonly input: "";
    readonly expected: "811c9dc5";
}, {
    readonly input: "a";
    readonly expected: "e40c292c";
}, {
    readonly input: "foobar";
    readonly expected: "bf9cf968";
}];
/**
 * Verify this implementation against the constitutionally fixed test vectors.
 * Throws if any vector fails — used in CI invariant verification stage.
 */
export declare function verifyFnv1a32Implementation(): void;
//# sourceMappingURL=fnv1a32.d.ts.map