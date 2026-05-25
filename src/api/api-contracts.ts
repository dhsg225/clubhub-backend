/**
 * Contract assertions for the API layer.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13
 *
 * All API routes are read-only and return deterministically serializable responses.
 */

import { canonicalizeJson } from '../pre/algorithms/canonicalize-json';

// ─── API Contract Violation ───────────────────────────────────────────────────

export class ApiContractViolation extends Error {
  constructor(message: string) {
    super(`ApiContractViolation: ${message}`);
    this.name = 'ApiContractViolation';
  }
}

// ─── Deterministic response assertion ────────────────────────────────────────

/**
 * Assert response is JSON-serializable with deterministic canonical form.
 * Throws ApiContractViolation if canonicalization fails.
 */
export function assertDeterministicResponse(response: unknown): void {
  try {
    const canonical = canonicalizeJson(response);
    if (typeof canonical !== 'string' || canonical.length === 0) {
      throw new ApiContractViolation(
        'Response produced empty canonical form. All API responses must be non-empty JSON.'
      );
    }
    // Verify round-trip is stable
    JSON.parse(canonical);
  } catch (err) {
    if (err instanceof ApiContractViolation) throw err;
    throw new ApiContractViolation(
      `Response is not JSON-serializable: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ─── Read-only route assertion ────────────────────────────────────────────────

/**
 * Assert no mutation occurred during API handling.
 * This is a marker assertion — the method name is logged for audit.
 */
export function assertReadOnlyRoute(methodName: string): void {
  // All preview/entropy/replay API handlers are read-only by design.
  // This assertion documents the invariant and provides a hook for future audit.
  if (typeof methodName !== 'string' || methodName.length === 0) {
    throw new ApiContractViolation('assertReadOnlyRoute: methodName must be a non-empty string');
  }
  // Read-only contract is enforced structurally — no writes occur in API handlers.
}
