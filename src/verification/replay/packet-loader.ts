/**
 * Replay packet loader — deserializes and verifies replay packets.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §3.2
 * Constitutional reference: REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md §3.6
 *
 * Verification chain (all three hashes checked in order):
 * 1. packet_hash  (SHA-256 of entire packet minus packet_hash field)
 * 2. input_hash   (FNV-1a 32-bit of canonicalizeJson(input))
 * 3. output_hash  (FNV-1a 32-bit of canonicalizeJson(expected_output))
 *
 * If any hash fails: INTEGRITY_FAILURE (not BEHAVIORAL_DIVERGENCE).
 * These are distinct failure modes requiring different responses.
 */

import { readFileSync } from 'fs';
import { canonicalizeJson } from '../../pre/algorithms/canonicalize-json';
import { fnv1a32 } from '../../pre/algorithms/fnv1a32';
import { computePacketHash, verifyPacketHash } from '../../pre/algorithms/sha256';
import { REPLAY_PACKET_SCHEMA_VERSION } from '../../pre/constants';
import type { ReplayPacket, PacketLoadResult } from './types';

/**
 * Load and verify a replay packet from a file path.
 *
 * Steps:
 * 1. Read file bytes from disk
 * 2. Parse as JSON
 * 3. Validate schema (required fields, types)
 * 4. Verify packet_hash (SHA-256 seal)
 * 5. Verify input_hash  (FNV-1a seal)
 * 6. Verify output_hash (FNV-1a seal)
 * 7. Check schema version compatibility
 *
 * Returns PacketLoadResult with either a verified packet or an error code.
 * The caller MUST check result.error before using result.packet.
 */
export function loadPacket(filePath: string): PacketLoadResult {
  // Step 1: Read file
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    return {
      packet: null,
      error: 'FILE_NOT_FOUND',
      errorDetail: `Cannot read file "${filePath}": ${String(err)}`,
    };
  }

  // Step 2: Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      packet: null,
      error: 'JSON_PARSE_ERROR',
      errorDetail: `JSON parse failed for "${filePath}": ${String(err)}`,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      packet: null,
      error: 'SCHEMA_INVALID',
      errorDetail: `Packet root must be a JSON object`,
    };
  }

  const rawPacket = parsed as Record<string, unknown>;

  // Step 3: Minimal schema validation (required fields)
  const schemaError = validateRequiredFields(rawPacket);
  if (schemaError) {
    return {
      packet: null,
      error: 'SCHEMA_INVALID',
      errorDetail: schemaError,
    };
  }

  // Step 4: Schema version compatibility
  const packetVersion = rawPacket['packet_version'] as string;
  if (!isVersionCompatible(packetVersion)) {
    return {
      packet: null,
      error: 'SCHEMA_VERSION_UNSUPPORTED',
      errorDetail:
        `packet_version="${packetVersion}" is not compatible with harness schema ` +
        `version "${REPLAY_PACKET_SCHEMA_VERSION}". ` +
        `The harness must be updated to support this packet version, or the packet ` +
        `must be migrated to a supported version.`,
    };
  }

  // Step 5: Verify packet_hash (SHA-256 integrity seal over entire packet)
  if (!verifyPacketHash(rawPacket)) {
    const expected = computePacketHash(rawPacket);
    return {
      packet: null,
      error: 'HASH_MISMATCH_PACKET',
      errorDetail:
        `packet_hash verification failed for "${filePath}". ` +
        `Stored: "${rawPacket['packet_hash']}", Computed: "${expected}". ` +
        `The packet file has been corrupted or modified after capture. ` +
        `This is an INTEGRITY_FAILURE — investigate corpus corruption before proceeding.`,
    };
  }

  // Step 6: Verify input_hash (FNV-1a seal over input field)
  const storedInputHash = rawPacket['input_hash'] as string;
  const computedInputHash = fnv1a32(canonicalizeJson(rawPacket['input']));
  if (computedInputHash !== storedInputHash) {
    return {
      packet: null,
      error: 'HASH_MISMATCH_INPUT',
      errorDetail:
        `input_hash verification failed for "${filePath}". ` +
        `Stored: "${storedInputHash}", Computed: "${computedInputHash}". ` +
        `The input state has been corrupted or modified after capture.`,
    };
  }

  // Step 7: Verify output_hash (FNV-1a seal over expected_output field)
  const storedOutputHash = rawPacket['output_hash'] as string;
  const computedOutputHash = fnv1a32(canonicalizeJson(rawPacket['expected_output']));
  if (computedOutputHash !== storedOutputHash) {
    return {
      packet: null,
      error: 'HASH_MISMATCH_OUTPUT',
      errorDetail:
        `output_hash verification failed for "${filePath}". ` +
        `Stored: "${storedOutputHash}", Computed: "${computedOutputHash}". ` +
        `The expected output has been corrupted or modified after capture.`,
    };
  }

  // All verification passed — cast to ReplayPacket
  return {
    packet: rawPacket as unknown as ReplayPacket,
    error: null,
  };
}

// ─── Version Compatibility ────────────────────────────────────────────────────

/**
 * Determine whether a packet's schema version is compatible with this harness.
 *
 * Per REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md §3.7:
 * - Same major version = compatible (minor adds may be ignored)
 * - Different major version = incompatible; corpus migration required
 */
function isVersionCompatible(packetVersion: string): boolean {
  const harnessMajor = parseInt(REPLAY_PACKET_SCHEMA_VERSION.split('.')[0] ?? '1', 10);
  const packetMajor  = parseInt(packetVersion.split('.')[0] ?? '0', 10);
  return harnessMajor === packetMajor;
}

// ─── Required Field Validation ────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  'packet_id', 'packet_version', 'corpus_class',
  'captured_at', 'capture_source', 'captured_by',
  'pre_impl_version', 'constitution_version',
  'description', 'invariants_under_test', 'specification_refs',
  'input', 'expected_output',
  'input_hash', 'output_hash', 'packet_hash',
  'status',
] as const;

function validateRequiredFields(obj: Record<string, unknown>): string | null {
  const missing: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    return `Missing required fields: [${missing.join(', ')}]`;
  }

  if (typeof obj['packet_id'] !== 'string') {
    return `packet_id must be a string`;
  }
  if (typeof obj['packet_version'] !== 'string') {
    return `packet_version must be a string`;
  }
  if (!['active', 'archived'].includes(obj['status'] as string)) {
    return `status must be "active" or "archived"`;
  }
  if (!obj['input'] || typeof obj['input'] !== 'object') {
    return `input must be an object`;
  }
  if (!obj['expected_output'] || typeof obj['expected_output'] !== 'object') {
    return `expected_output must be an object`;
  }

  return null;
}
