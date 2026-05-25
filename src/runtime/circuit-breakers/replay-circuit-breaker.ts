/**
 * Replay circuit breaker.
 * Failure threshold: 1 — any replay nondeterminism = immediate open.
 * When OPEN: replay is untrusted → CLASS_4 must be declared.
 * When opened: callers must emit ConstitutionalBreachLog with breach_type: 'replay_circuit_open'.
 */

import type { CircuitState, CircuitBreakerConfig } from './pre-circuit-breaker';

export const REPLAY_CIRCUIT_DEFAULTS: CircuitBreakerConfig = {
  failure_threshold: 1,   // any replay nondeterminism = immediate open
  recovery_probe_ms: 60_000,
};

export class ReplayCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(private config: CircuitBreakerConfig = REPLAY_CIRCUIT_DEFAULTS) {}

  getState(): CircuitState { return this.state; }

  /** Returns true if replay execution is trusted */
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

  /** Record a replay success */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.openedAt = null;
    }
  }

  /**
   * Record a replay failure.
   * With threshold=1, any failure opens the circuit immediately.
   * Caller MUST emit ConstitutionalBreachLog with breach_type: 'replay_circuit_open'.
   */
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
