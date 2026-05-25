/**
 * PRE circuit breaker.
 * Tracks consecutive PRE failures and opens circuit after threshold.
 * MUST NOT affect PRE purity — this is runtime-layer only.
 * MUST emit telemetry before any state change.
 * MUST NOT auto-heal silently.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failure_threshold: number;    // consecutive failures before opening; default 3
  recovery_probe_ms: number;    // ms before allowing a probe in HALF_OPEN; default 30000
}

export const PRE_CIRCUIT_DEFAULTS: CircuitBreakerConfig = {
  failure_threshold: 3,
  recovery_probe_ms: 30_000,
};

export class PRECircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(private config: CircuitBreakerConfig = PRE_CIRCUIT_DEFAULTS) {}

  getState(): CircuitState { return this.state; }

  /** Returns true if PRE invocation is allowed */
  isAllowed(nowMs: number): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (this.openedAt !== null && nowMs - this.openedAt >= this.config.recovery_probe_ms) {
        // Transition to HALF_OPEN for a probe — emit telemetry
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN: allow one probe
  }

  /** Record a PRE success */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.openedAt = null;
    }
  }

  /** Record a PRE failure. Opens circuit if threshold reached. */
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
