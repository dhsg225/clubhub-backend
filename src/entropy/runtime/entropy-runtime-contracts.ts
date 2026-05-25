/**
 * Contract assertions for the entropy runtime layer.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §11
 *
 * Entropy schedulers and jobs must never modify system state.
 */

import type { SystemStateSnapshot } from '../../pre/types';
import { canonicalizeJson } from '../../pre/algorithms/canonicalize-json';

// ─── Contract Violation ───────────────────────────────────────────────────────

export class EntropyRuntimeContractViolation extends Error {
  constructor(message: string) {
    super(`EntropyRuntimeContractViolation: ${message}`);
    this.name = 'EntropyRuntimeContractViolation';
  }
}

// ─── Read-only assertion ──────────────────────────────────────────────────────

/**
 * Assert entropy scheduler never modifies system state.
 * Takes canonical JSON snapshots before and after — any change is a violation.
 */
export function assertEntropyReadOnly(
  beforeState: SystemStateSnapshot,
  afterState: SystemStateSnapshot
): void {
  const before = canonicalizeJson(beforeState);
  const after  = canonicalizeJson(afterState);

  if (before !== after) {
    throw new EntropyRuntimeContractViolation(
      'Entropy computation modified SystemStateSnapshot. ' +
      'Entropy is read-only and advisory. No state mutations permitted.'
    );
  }
}

// ─── Advisory tier monotonicity ───────────────────────────────────────────────

/**
 * Assert advisory tier escalation is monotonic within a session.
 * Advisory tier should only increase (or stay equal) within a single session.
 * A decrease may indicate incorrect state or suppressed observations.
 *
 * Note: This is advisory — it logs a warning rather than throwing in production.
 * For contract testing it throws.
 */
export function assertAdvisoryTierMonotonic(
  previous: number,
  current: number,
  venueId: string
): void {
  if (current < previous) {
    throw new EntropyRuntimeContractViolation(
      `Advisory tier decreased for venue "${venueId}": ${previous} → ${current}. ` +
      'Advisory tier escalation must be monotonic within a session. ' +
      'De-escalation requires explicit operator acknowledgment.'
    );
  }
}
