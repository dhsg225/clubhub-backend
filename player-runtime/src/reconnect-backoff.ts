/**
 * Exponential reconnect backoff with deterministic jitter.
 *
 * Purpose: prevents thundering-herd reconnection storms when a venue ISP
 * comes back after an outage and all players reconnect simultaneously.
 *
 * Behavior:
 *   - Each consecutive failure doubles the wait (exponential)
 *   - Jitter is added deterministically from screen_id (no Math.random)
 *   - Backoff is capped at MAX_INTERVAL_MS (default 15 minutes)
 *   - On success: counter resets to 0, next interval returns to base
 *
 * Jitter design: deterministic from screen_id means fleet is spread across
 * the backoff window predictably — no two screens with different IDs have
 * identical intervals. This is sufficient for fleet reconnection distribution.
 *
 * Example intervals for base=60s, max=900s:
 *   Failure 1: 60s  + jitter
 *   Failure 2: 120s + jitter
 *   Failure 3: 240s + jitter
 *   Failure 4: 480s + jitter
 *   Failure 5: 900s + jitter (capped)
 *   Success:   reset → 60s + jitter
 */
import { fnv1a32 } from '@clubhub/fnv-checksum';

export interface BackoffConfig {
  readonly screen_id: string;
  readonly base_interval_ms: number;    // starting interval (e.g. 60_000)
  readonly max_interval_ms: number;     // ceiling (e.g. 900_000 = 15 min)
  readonly jitter_window_ms: number;    // max additional jitter (e.g. 30_000)
}

export class ReconnectBackoff {
  private readonly config: BackoffConfig;
  private readonly jitter_ms: number;
  private consecutiveFailures: number = 0;

  constructor(config: BackoffConfig) {
    this.config = config;
    // Deterministic jitter from screen_id hash — same as PollScheduler convention
    const hash = fnv1a32(config.screen_id + ':reconnect');
    this.jitter_ms = hash % config.jitter_window_ms;
  }

  /** Call on each failed sync attempt. Returns the interval to wait before retry. */
  recordFailure(): number {
    this.consecutiveFailures++;
    return this.currentInterval();
  }

  /** Call on successful sync. Resets backoff counter. */
  recordSuccess(): void {
    if (this.consecutiveFailures > 0) {
      console.log(
        `[reconnect-backoff] screen_id=${this.config.screen_id} ` +
        `recovered after ${this.consecutiveFailures} consecutive failure(s)`
      );
    }
    this.consecutiveFailures = 0;
  }

  /** Current interval to use for next attempt. */
  currentInterval(): number {
    if (this.consecutiveFailures === 0) {
      return this.config.base_interval_ms + this.jitter_ms;
    }
    const exponential = this.config.base_interval_ms * Math.pow(2, this.consecutiveFailures - 1);
    const capped = Math.min(exponential, this.config.max_interval_ms);
    return capped + this.jitter_ms;
  }

  /** True if currently in backoff (has had at least one failure). */
  isBackingOff(): boolean {
    return this.consecutiveFailures > 0;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }
}
