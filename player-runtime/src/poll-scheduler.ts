/**
 * Deterministic polling scheduler.
 *
 * No Math.random() for timing. Uses fixed intervals with jitter derived
 * deterministically from screen_id to avoid thundering herd.
 */
import { fnv1a32 } from '@clubhub/fnv-checksum';

export interface PollSchedulerConfig {
  readonly screen_id: string;
  readonly base_interval_ms: number;
  readonly max_jitter_ms: number;          // max additional jitter
}

export class PollScheduler {
  private readonly config: PollSchedulerConfig;
  private readonly jitter_ms: number;

  constructor(config: PollSchedulerConfig) {
    this.config = config;
    // Derive deterministic jitter from screen_id (no Math.random)
    const hash = fnv1a32(config.screen_id);
    this.jitter_ms = hash % config.max_jitter_ms;
  }

  /** Returns the next poll interval in ms (deterministic per screen_id). */
  getInterval(): number {
    return this.config.base_interval_ms + this.jitter_ms;
  }

  /** Schedule a recurring poll. Returns cleanup function. */
  schedule(fn: () => Promise<void>): () => void {
    let timer: NodeJS.Timeout;
    let running = false;

    const tick = async (): Promise<void> => {
      if (running) return; // Skip if previous tick still running
      running = true;
      try {
        await fn();
      } finally {
        running = false;
        timer = setTimeout(tick, this.getInterval());
      }
    };

    timer = setTimeout(tick, this.getInterval());
    return () => { clearTimeout(timer); };
  }
}
