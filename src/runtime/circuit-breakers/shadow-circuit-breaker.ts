/**
 * Shadow circuit breaker.
 * Tracks consecutive shadow runner failures.
 * When OPEN: shadow execution suspended — parity accumulation halted.
 * IMPORTANT: OPEN state must emit CircuitBreakerLog with subsystem: 'shadow'
 * and note that parity window has a gap.
 * MUST emit telemetry before any state change.
 * MUST NOT auto-heal silently.
 */

import type { CircuitState, CircuitBreakerConfig } from './pre-circuit-breaker';

export const SHADOW_CIRCUIT_DEFAULTS: CircuitBreakerConfig = {
  failure_threshold: 3,
  recovery_probe_ms: 30_000,
};

export class ShadowCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  /** Tracks parity gap start time — set when circuit opens */
  private parityGapStartedAt: number | null = null;

  constructor(private config: CircuitBreakerConfig = SHADOW_CIRCUIT_DEFAULTS) {}

  getState(): CircuitState { return this.state; }

  /** Returns true if shadow execution is allowed */
  isAllowed(nowMs: number): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (this.openedAt !== null && nowMs - this.openedAt >= this.config.recovery_probe_ms) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN: allow one probe
  }

  /** Record a shadow execution success */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.openedAt = null;
      this.parityGapStartedAt = null;
    }
  }

  /** Record a shadow execution failure. Opens circuit if threshold reached. */
  recordFailure(nowMs: number): void {
    this.consecutiveFailures++;
    if (this.state !== 'OPEN' && this.consecutiveFailures >= this.config.failure_threshold) {
      this.state = 'OPEN';
      this.openedAt = nowMs;
      this.parityGapStartedAt = nowMs;
    }
  }

  /** Returns the parity gap start time if a gap is active, null otherwise */
  getParityGapStartedAt(): number | null {
    return this.parityGapStartedAt;
  }

  toJSON(): object {
    return {
      state: this.state,
      consecutive_failures: this.consecutiveFailures,
      opened_at: this.openedAt,
      parity_gap_started_at: this.parityGapStartedAt,
    };
  }
}
