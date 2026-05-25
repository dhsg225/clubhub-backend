/**
 * Entropy circuit breaker.
 * Tracks consecutive entropy scheduler failures.
 * When OPEN: entropy is advisory-reduced — no jobs run, advisory tier frozen at last value.
 * MUST emit telemetry before any state change.
 * MUST NOT auto-heal silently.
 */

import type { CircuitState, CircuitBreakerConfig } from './pre-circuit-breaker';

export const ENTROPY_CIRCUIT_DEFAULTS: CircuitBreakerConfig = {
  failure_threshold: 5,
  recovery_probe_ms: 30_000,
};

export class EntropyCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(private config: CircuitBreakerConfig = ENTROPY_CIRCUIT_DEFAULTS) {}

  getState(): CircuitState { return this.state; }

  /** Returns true if entropy job execution is allowed */
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

  /** Record an entropy job success */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.openedAt = null;
    }
  }

  /** Record an entropy job failure. Opens circuit if threshold reached. */
  recordFailure(nowMs: number): void {
    this.consecutiveFailures++;
    if (this.state !== 'OPEN' && this.consecutiveFailures >= this.config.failure_threshold) {
      this.state = 'OPEN';
      this.openedAt = nowMs;
    }
  }

  toJSON(): object {
    return { state: this.state, consecutive_failures: this.consecutiveFailures, opened_at: this.openedAt };
  }
}
