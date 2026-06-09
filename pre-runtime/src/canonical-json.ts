/**
 * Canonical JSON serialization.
 *
 * Rules:
 * - Object keys sorted lexicographically at every nesting level
 * - No whitespace (no spaces, no newlines)
 * - null serialized as "null"
 * - Arrays preserve element order
 * - Numbers: exact representation (no floating-point rounding)
 *
 * This is the only permitted serialization method for hash inputs.
 * Using JSON.stringify directly is FORBIDDEN for anything that feeds a hash.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    if (!isFinite(value)) throw new Error(`canonicalJSON: non-finite number: ${value}`);
    return String(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value); // standard JSON string escaping
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJSON).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map(
      (k) => JSON.stringify(k) + ':' + canonicalJSON(obj[k])
    );
    return '{' + pairs.join(',') + '}';
  }
  throw new Error(`canonicalJSON: unsupported type: ${typeof value}`);
}
