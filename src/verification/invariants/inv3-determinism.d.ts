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
export {};
//# sourceMappingURL=inv3-determinism.d.ts.map