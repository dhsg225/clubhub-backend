import { emit, base, increment, METRICS } from '@clubhub/telemetry-sdk';

export class HeartbeatEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;

  start(intervalMs: number, screenId: string, venueId: string): void {
    this.interval = setInterval(() => {
      emit({
        ...base('INFO', 'player.heartbeat'),
        screen_id: screenId,
        venue_id: venueId,
        ts: Date.now(),
      } as Parameters<typeof emit>[0]);
      increment(METRICS.PRE_INVOCATIONS_TOTAL, { type: 'heartbeat' });
    }, intervalMs);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
  }
}
