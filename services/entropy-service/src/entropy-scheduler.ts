/**
 * Entropy scheduler.
 *
 * Constitutional:
 * - Venue scan: 60 min interval
 * - Fleet scan: 6h interval
 * - Deterministic ordering: sorted by venue_id (no Math.random())
 * - Advisory only: cannot modify PRE corpus
 */
import { emit, base, increment, METRICS } from '@clubhub/telemetry-sdk';

export interface EntropySchedulerConfig {
  readonly venueScanIntervalMs: number; // default: 3_600_000
  readonly fleetScanIntervalMs: number; // default: 21_600_000
}

export interface VenueEntropySnapshot {
  readonly venue_id: string;
  readonly corpus_version: string;
  readonly expected_checksum: string;
  readonly actual_checksum: string | null;
  readonly scanned_at: number;
}

export class EntropyScheduler {
  private venueTimer: ReturnType<typeof setInterval> | null = null;
  private fleetTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly config: EntropySchedulerConfig) {}

  start(
    getVenueIds: () => string[],
    scanVenue: (venueId: string) => Promise<VenueEntropySnapshot>,
  ): void {
    this.venueTimer = setInterval(async () => {
      // Constitutional: deterministic ordering by venue_id
      const venueIds = [...getVenueIds()].sort();
      const startMs = Date.now();
      for (const venueId of venueIds) {
        try {
          await scanVenue(venueId);
        } catch (err: unknown) {
          emit({ ...base('ERROR', 'entropy_scheduler.scan_error'), venue_id: venueId, error: String(err) } as Parameters<typeof emit>[0]);
        }
      }
      increment(METRICS.ENTROPY_JOB_DURATION_MS, { type: 'venue_scan' });
      emit({ ...base('INFO', 'entropy_scheduler.venue_scan_complete'), duration_ms: Date.now() - startMs, venue_count: venueIds.length } as Parameters<typeof emit>[0]);
    }, this.config.venueScanIntervalMs);

    this.fleetTimer = setInterval(() => {
      emit({ ...base('INFO', 'entropy_scheduler.fleet_scan_start') } as Parameters<typeof emit>[0]);
      // Fleet scan impl in Wave 5
    }, this.config.fleetScanIntervalMs);
  }

  stop(): void {
    if (this.venueTimer) clearInterval(this.venueTimer);
    if (this.fleetTimer) clearInterval(this.fleetTimer);
  }
}
