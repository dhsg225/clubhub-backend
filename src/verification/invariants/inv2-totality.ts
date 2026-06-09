/**
 * INV-2: Totality
 *
 * PRE.resolve() must return a valid PRE_Output for ALL inputs.
 * It must never throw, never return null/undefined, and never produce
 * an empty playlist. When no content source is available, PRE returns
 * the System Fallback item (SYSTEM_FALLBACK_CONTENT_ID).
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.2
 * PRE-REFERENCE-IMPLEMENTATION-v1.md §9.1 (System Fallback)
 */

import { registerInvariant } from './index';
import { SYSTEM_FALLBACK_CONTENT_ID } from '../../pre/constants';

registerInvariant({
  id: 'INV-2',
  description: 'PRE returns a valid non-empty PRE_Output for all inputs (totality)',
  severity: 'CONSTITUTIONAL_BREACH',
  assert(output, _input) {
    // 1. Output must be a non-null object
    if (output === null || output === undefined) {
      return {
        invariantId: 'INV-2',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message: 'PRE returned null or undefined. Totality requires a valid output for all inputs.',
      };
    }

    // 2. playlist must be an array
    if (!Array.isArray(output.playlist)) {
      return {
        invariantId: 'INV-2',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message: `output.playlist is not an array (got ${typeof output.playlist}). ` +
          'PRE must always return an array.',
      };
    }

    // 3. playlist must be non-empty
    if (output.playlist.length === 0) {
      return {
        invariantId: 'INV-2',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message:
          'output.playlist is empty. PRE must always produce at least one item. ' +
          `When no content source is available, PRE returns "${SYSTEM_FALLBACK_CONTENT_ID}".`,
      };
    }

    // 4. All playlist items must have required fields
    for (let i = 0; i < output.playlist.length; i++) {
      const item = output.playlist[i];
      if (!item || typeof item.content_id !== 'string' || item.content_id.length === 0) {
        return {
          invariantId: 'INV-2',
          passed: false,
          severity: 'CONSTITUTIONAL_BREACH',
          message: `playlist[${i}].content_id is missing or empty. All playlist items must have a non-empty content_id.`,
        };
      }
      if (typeof item.duration_ms !== 'number' || item.duration_ms <= 0) {
        return {
          invariantId: 'INV-2',
          passed: false,
          severity: 'CONSTITUTIONAL_BREACH',
          message: `playlist[${i}].duration_ms is ${item.duration_ms}. Must be a positive number.`,
          detail: { item },
        };
      }
    }

    // 5. resolution_level must be an integer 0–6
    if (
      !Number.isInteger(output.resolution_level) ||
      output.resolution_level < 0 ||
      output.resolution_level > 6
    ) {
      return {
        invariantId: 'INV-2',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message: `output.resolution_level is ${output.resolution_level}. Must be integer 0–6.`,
      };
    }

    // 6. is_fallback must be boolean
    if (typeof output.is_fallback !== 'boolean') {
      return {
        invariantId: 'INV-2',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message: `output.is_fallback is ${typeof output.is_fallback}. Must be boolean.`,
      };
    }

    return {
      invariantId: 'INV-2',
      passed: true,
      severity: 'CONSTITUTIONAL_BREACH',
      message: `Output is valid: non-null, non-empty playlist (${output.playlist.length} items), resolution_level=${output.resolution_level}`,
    };
  },
});
