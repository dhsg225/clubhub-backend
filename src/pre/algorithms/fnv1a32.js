"use strict";
/**
 * FNV-1a 32-bit checksum algorithm.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §18.1
 * Constitutional reference: REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md §3.6
 *
 * Constants are constitutionally fixed. Changes require constitutional amendment.
 * Algorithm: for each byte b: hash = (hash XOR b) × FNV1A_PRIME, mod 2^32
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FNV1A_TEST_VECTORS = void 0;
exports.fnv1a32 = fnv1a32;
exports.fnv1a32Bytes = fnv1a32Bytes;
exports.verifyFnv1a32Implementation = verifyFnv1a32Implementation;
const FNV1A_OFFSET_BASIS = 2_166_136_261;
const FNV1A_PRIME = 16_777_619;
const FNV1A_MOD = 2 ** 32; // 4_294_967_296
/**
 * Compute FNV-1a 32-bit hash of a UTF-8 string.
 * Returns a lowercase hex string (8 characters, zero-padded).
 *
 * This function is pure and deterministic. Given the same input string it
 * MUST always return the same output, regardless of platform, locale, or
 * execution environment.
 */
function fnv1a32(input) {
    let hash = FNV1A_OFFSET_BASIS;
    // Encode to UTF-8 bytes deterministically
    const bytes = encodeToUtf8Bytes(input);
    for (let i = 0; i < bytes.length; i++) {
        // XOR the byte into the hash
        hash = hash ^ bytes[i];
        // Multiply by prime, keep within 32-bit range
        // JavaScript bitwise ops are 32-bit signed; use floating-point multiply
        // then modulo to stay in unsigned 32-bit range.
        hash = (Math.imul(hash, FNV1A_PRIME) >>> 0);
    }
    // Return as zero-padded lowercase hex
    return (hash >>> 0).toString(16).padStart(8, '0');
}
/**
 * Encode a string to UTF-8 byte array without relying on TextEncoder
 * to ensure compatibility with all Node.js environments.
 *
 * Uses Buffer.from which is available in all Node.js versions >= 6
 * and encodes as UTF-8 by default.
 */
function encodeToUtf8Bytes(str) {
    return new Uint8Array(Buffer.from(str, 'utf8'));
}
/**
 * Compute FNV-1a 32-bit hash of a Buffer (raw bytes).
 * Used when the input has already been serialized to bytes.
 */
function fnv1a32Bytes(bytes) {
    let hash = FNV1A_OFFSET_BASIS;
    for (let i = 0; i < bytes.length; i++) {
        hash = hash ^ bytes[i];
        hash = (Math.imul(hash, FNV1A_PRIME) >>> 0);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
/**
 * Test vectors from PRE-REFERENCE-IMPLEMENTATION-v1.md Appendix B.
 * These vectors are constitutionally fixed — if they fail, the implementation
 * is non-conformant and MUST NOT be deployed.
 *
 * These are embedded here (not in a test file) so the implementation can
 * self-verify at module load time in test mode.
 */
exports.FNV1A_TEST_VECTORS = [
    // Vector 1: empty string
    { input: '', expected: '811c9dc5' },
    // Vector 2: single character 'a'
    { input: 'a', expected: 'e40c292c' },
    // Vector 3: "foobar"
    { input: 'foobar', expected: 'bf9cf968' },
];
/**
 * Verify this implementation against the constitutionally fixed test vectors.
 * Throws if any vector fails — used in CI invariant verification stage.
 */
function verifyFnv1a32Implementation() {
    for (const vector of exports.FNV1A_TEST_VECTORS) {
        const actual = fnv1a32(vector.input);
        if (actual !== vector.expected) {
            throw new Error(`FNV-1a 32-bit implementation non-conformant: ` +
                `input="${vector.input}" expected="${vector.expected}" got="${actual}". ` +
                `This is a CONSTITUTIONAL_BREACH — the checksum algorithm has diverged from the spec.`);
        }
    }
}
//# sourceMappingURL=fnv1a32.js.map