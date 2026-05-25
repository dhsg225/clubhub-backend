/**
 * Preview contract enforcement.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §3
 *
 * Enforces purity constraints at the preview subsystem boundary:
 *   - at must be a valid, finite, positive number
 *   - screen_id must be non-empty
 *   - system_state must be present
 *   - output must never contain mutation fields
 */

import type { PreviewRequest, PreviewResponse } from '../types';

export class PreviewContractViolation extends Error {
  constructor(
    public readonly rule: string,
    message: string
  ) {
    super(`PreviewContractViolation [${rule}]: ${message}`);
    this.name = 'PreviewContractViolation';
  }
}

/**
 * Assert that a preview request satisfies all purity constraints.
 * Throws PreviewContractViolation on any violation.
 */
export function assertPreviewPurity(request: PreviewRequest): void {
  if (typeof request.at !== 'number' || !isFinite(request.at) || request.at <= 0) {
    throw new PreviewContractViolation(
      'PURE_AT',
      `request.at must be a finite positive number, got: ${request.at}`
    );
  }
  if (isNaN(request.at)) {
    throw new PreviewContractViolation(
      'PURE_AT_NAN',
      `request.at must not be NaN`
    );
  }
  if (!request.screen_id || typeof request.screen_id !== 'string' || request.screen_id.trim() === '') {
    throw new PreviewContractViolation(
      'PURE_SCREEN_ID',
      `request.screen_id must be a non-empty string, got: ${JSON.stringify(request.screen_id)}`
    );
  }
  if (!request.system_state || typeof request.system_state !== 'object') {
    throw new PreviewContractViolation(
      'PURE_SYSTEM_STATE',
      `request.system_state must be a non-null object`
    );
  }
}

/**
 * Assert that a preview response contains no mutation fields.
 * Structural check — actual purity is guaranteed by PRE.resolve().
 */
export function assertNoPreviewWrites(output: PreviewResponse): void {
  const forbidden = ['mutated', 'written', 'side_effect', 'mutation'] as const;
  const keys = Object.keys(output);
  for (const key of keys) {
    for (const f of forbidden) {
      if (key === f) {
        throw new PreviewContractViolation(
          'NO_WRITES',
          `preview response must not contain field "${key}" — preview is read-only`
        );
      }
    }
  }
}
