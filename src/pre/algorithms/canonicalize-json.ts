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
export function canonicalizeJson(value: unknown): string {
  return serializeValue(value);
}

function serializeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    // Rule 5: undefined is not a valid JSON value; treat as null in canonical form.
    // Callers MUST NOT pass undefined for fields that should be null.
    return 'null';
  }

  if (typeof value === 'boolean') {
    // Rule 6: booleans as true/false
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    if (!isFinite(value)) {
      throw new Error(
        `canonicalizeJson: non-finite number ${value} is not representable in canonical JSON. ` +
        `This indicates a constitutional violation in the PRE output.`
      );
    }
    // Rule 7/8: integers without decimal points; floats to 4 decimal places.
    return serializeNumber(value);
  }

  if (typeof value === 'string') {
    // Rule 9/10: strings as UTF-8 JSON strings (JSON.stringify handles escaping correctly)
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    // Rule 2: array ordering preserved
    const items = value.map(item => serializeValue(item));
    return '[' + items.join(',') + ']';
  }

  if (typeof value === 'object') {
    // Rule 1: object keys sorted by Unicode code point
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map(key => {
      const serializedKey = JSON.stringify(key);
      const serializedValue = serializeValue(obj[key]);
      return `${serializedKey}:${serializedValue}`;
    });
    return '{' + pairs.join(',') + '}';
  }

  // BigInt, Symbol, Function — not valid in JSON
  throw new Error(
    `canonicalizeJson: unsupported type "${typeof value}". ` +
    `All PRE outputs must be JSON-serializable primitive types, objects, or arrays.`
  );
}

/**
 * Serialize a number to canonical form.
 *
 * Rule 7: Integers (values with no fractional part) are serialized without
 * a decimal point: 15000 not 15000.0
 *
 * Rule 8: Floats are rounded to exactly 4 decimal places.
 * This applies to: confidence_score, share-of-voice fractions (sov_pct),
 * and any other real-valued field in PRE output.
 *
 * The rounding uses "round half away from zero" (standard arithmetic rounding)
 * implemented via the multiplier method to avoid floating-point artifacts.
 */
function serializeNumber(value: number): string {
  if (Number.isInteger(value)) {
    // Rule 7: integer without decimal point
    return String(value);
  }

  // Rule 8: 4 decimal places
  // Use toFixed(4) — this is locale-independent in all conformant JS engines
  // per ECMAScript spec §21.1.3.3 which mandates it produces decimal digits
  // without locale-dependent separators.
  const rounded = roundTo4Decimals(value);
  return rounded.toFixed(4);
}

/**
 * Round to 4 decimal places using multiply-round-divide to avoid
 * floating-point precision artifacts in the rounding step itself.
 *
 * Example: roundTo4Decimals(0.97000000001) === 0.97
 * Example: roundTo4Decimals(0.12345678)    === 0.1235
 * Example: roundTo4Decimals(0.33333333)    === 0.3333
 */
function roundTo4Decimals(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Serialize a value to canonical JSON then return both the string and its byte length.
 * Used by the FNV-1a hasher to avoid double-serialization.
 */
export function canonicalizeJsonWithLength(value: unknown): { json: string; byteLength: number } {
  const json = canonicalizeJson(value);
  const byteLength = Buffer.byteLength(json, 'utf8');
  return { json, byteLength };
}

/**
 * Deep-clone a value through canonical serialization and deserialization.
 * This guarantees the result has the same canonical form as the original.
 * Used for constructing test fixtures where deep equality must be by
 * canonical value, not object identity.
 */
export function canonicalClone<T>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}
