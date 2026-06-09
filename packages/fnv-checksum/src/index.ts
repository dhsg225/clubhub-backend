/**
 * @clubhub/fnv-checksum
 *
 * FNV-1a 32-bit hash + canonical JSON serialization.
 * Pure function — zero dependencies.
 * Used for all constitutional checksums in the platform.
 *
 * CRITICAL: This implementation must be identical across all deployments.
 * Never change the algorithm without a full replay audit re-verification.
 */

/**
 * FNV-1a 32-bit hash.
 * Deterministic, collision-resistant for our use case.
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Canonical JSON serialization for deterministic hashing.
 * Keys are sorted recursively — order-independent.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj) ?? 'null';
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const sorted = Object.keys(obj as Record<string, unknown>)
    .sort()
    .map((k) => {
      const val = (obj as Record<string, unknown>)[k];
      return JSON.stringify(k) + ':' + canonicalizeJson(val);
    });
  return '{' + sorted.join(',') + '}';
}

/**
 * Compute a deterministic checksum for a record, excluding a specific field.
 * Used for audit record integrity: record_checksum = hashRecordExcluding(record, 'record_checksum')
 */
export function hashRecordExcluding(
  record: Record<string, unknown>,
  excludeField: string,
): string {
  const { [excludeField]: _excluded, ...rest } = record;
  return fnv1a32(canonicalizeJson(rest)).toString(16).padStart(8, '0');
}
