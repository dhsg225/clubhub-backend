/**
 * INV-3: Determinism
 *
 * Identical inputs MUST produce identical outputs, bit for bit.
 * The playlist_checksum is the executable proof: same inputs → same checksum.
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.3
 *
 * Runtime enforcement:
 * The replay harness verifies determinism by comparing the actual_output_hash
 * (FNV-1a of canonicalizeJson(actual_output)) against the packet's stored
 * output_hash (from the original capture). These represent two invocations with
 * identical inputs — one at capture time, one now.
 *
 * This invariant assertion validates structural determinism properties:
 * - playlist_checksum must be a valid FNV-1a hex string
 * - playlist must use only content_ids present in the input system state
 * - No field in the output may be generated nondeterministically (e.g., UUID, timestamp)
 */

import { registerInvariant } from './index';
import { fnv1a32 } from '../../pre/algorithms/fnv1a32';
import { canonicalizeJson } from '../../pre/algorithms/canonicalize-json';

// FNV-1a 32-bit hex pattern: exactly 8 hex characters
const FNV1A_HEX_PATTERN = /^[0-9a-f]{8}$/;

registerInvariant({
  id: 'INV-3',
  description: 'Identical inputs produce identical outputs (determinism) — verified via playlist_checksum',
  severity: 'CONSTITUTIONAL_BREACH',
  assert(output, _input) {
    // 1. playlist_checksum must be a valid FNV-1a hex string
    if (
      typeof output.playlist_checksum !== 'string' ||
      !FNV1A_HEX_PATTERN.test(output.playlist_checksum)
    ) {
      return {
        invariantId: 'INV-3',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message:
          `output.playlist_checksum "${output.playlist_checksum}" is not a valid FNV-1a 32-bit hex string. ` +
          `Expected exactly 8 lowercase hex characters.`,
      };
    }

    // 2. Recompute checksum from the playlist and verify it matches
    // The checksum is computed from the canonical serialization of the playlist
    // using the FNV-1a algorithm — per PRE-REFERENCE-IMPLEMENTATION-v1.md §18.
    const recomputedChecksum = fnv1a32(canonicalizeJson(output.playlist));

    if (recomputedChecksum !== output.playlist_checksum) {
      return {
        invariantId: 'INV-3',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message:
          `Determinism violation: stored playlist_checksum "${output.playlist_checksum}" ` +
          `does not match recomputed checksum "${recomputedChecksum}". ` +
          `The playlist content differs from what the checksum was computed from. ` +
          `This indicates the PRE produced an internally inconsistent output.`,
        detail: {
          stored: output.playlist_checksum,
          recomputed: recomputedChecksum,
          playlist_length: output.playlist.length,
        },
      };
    }

    // 3. version must be a non-negative integer
    if (!Number.isInteger(output.version) || output.version < 0) {
      return {
        invariantId: 'INV-3',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message:
          `output.version is ${output.version}. Must be a non-negative integer. ` +
          `Non-integer versions indicate nondeterministic generation.`,
      };
    }

    return {
      invariantId: 'INV-3',
      passed: true,
      severity: 'CONSTITUTIONAL_BREACH',
      message: `Determinism contract holds: checksum="${output.playlist_checksum}", version=${output.version}`,
    };
  },
});
