/**
 * SHA-256 packet integrity utilities.
 *
 * Constitutional authority: REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md §3.6
 *
 * SHA-256 is used for packet_hash (the whole-packet integrity seal), NOT for
 * behavioral checksums. FNV-1a 32-bit is used for behavioral checksums.
 *
 * Rationale: packet_hash requires collision resistance (integrity seal over
 * immutable corpus files). FNV-1a is used for fast behavioral fingerprinting
 * where collisions are operationally acceptable.
 *
 * This module uses Node.js built-in crypto — no external dependencies.
 */

import { createHash } from 'crypto';
import { canonicalizeJson } from './canonicalize-json';

/**
 * Compute SHA-256 hash of a UTF-8 string.
 * Returns lowercase hex string (64 characters).
 */
export function sha256String(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Compute SHA-256 hash of a Buffer.
 * Returns lowercase hex string (64 characters).
 */
export function sha256Bytes(input: Buffer | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Compute the packet_hash for a replay packet.
 *
 * Algorithm:
 * 1. Shallow-clone the packet object
 * 2. Delete the `packet_hash` field from the clone
 * 3. Canonicalize the clone with canonicalizeJson()
 * 4. Compute SHA-256 of the resulting UTF-8 string
 * 5. Return lowercase hex
 *
 * The `packet_hash` field is excluded from the computation — this avoids
 * a circular dependency (the hash cannot include itself).
 */
export function computePacketHash(packet: Record<string, unknown>): string {
  // Shallow clone to avoid mutating the input
  const clone = { ...packet };
  // Remove packet_hash field before hashing
  delete clone['packet_hash'];

  const canonical = canonicalizeJson(clone);
  return sha256String(canonical);
}

/**
 * Verify the packet_hash field of a replay packet.
 *
 * Returns true if the stored packet_hash matches the recomputed hash.
 * Returns false if there is a mismatch — caller MUST treat this as
 * INTEGRITY_FAILURE (not BEHAVIORAL_DIVERGENCE).
 */
export function verifyPacketHash(packet: Record<string, unknown>): boolean {
  const storedHash = packet['packet_hash'];
  if (typeof storedHash !== 'string') {
    return false;
  }
  const computed = computePacketHash(packet);
  return computed === storedHash;
}

/**
 * Compute the input_hash for a ReplayPacket.
 *
 * input_hash = fnv1a32(canonicalizeJson(input))
 *
 * This function is here as a SHA-256 module convenience re-export.
 * The actual computation delegates to canonicalizeJson + fnv1a32.
 * See packet-loader.ts for the full verification chain.
 */
export function computeInputHash(input: unknown): string {
  // Import at call time to avoid circular dependencies in the algorithms layer
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { fnv1a32 } = require('./fnv1a32') as typeof import('./fnv1a32');
  return fnv1a32(canonicalizeJson(input));
}

/**
 * Compute the output_hash for a ReplayPacket.
 *
 * output_hash = fnv1a32(canonicalizeJson(expected_output))
 */
export function computeOutputHash(output: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { fnv1a32 } = require('./fnv1a32') as typeof import('./fnv1a32');
  return fnv1a32(canonicalizeJson(output));
}

/**
 * Generate an integrity snapshot of all active corpus files.
 * Returns a record mapping relative file path to SHA-256 hash of file contents.
 *
 * Used by verify-corpus-integrity.ts to produce daily snapshot files.
 */
export function hashFileContents(fileContents: Buffer): string {
  return sha256Bytes(fileContents);
}
