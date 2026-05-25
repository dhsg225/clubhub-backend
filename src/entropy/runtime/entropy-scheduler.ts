/**
 * Entropy scheduler — orchestrates periodic entropy computation.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §14
 *
 * Pure orchestration — delegates all calculation to existing entropy runners.
 * NO auto-correction. NO automatic remediation. Advisory only.
 *
 * Schedule:
 * - Venue scans: every 60 minutes (configurable)
 * - Fleet scans: every 6 hours (configurable)
 */

import type { SystemStateSnapshot } from '../../pre/types';
import { VenueEntropyJob, VenueEntropyResult } from './venue-entropy-job';
import { FleetEntropyJob, FleetEntropyResult } from './fleet-entropy-job';
import { EntropyAlertRouter } from './entropy-alert-routing';

// ─── Scheduler Config ─────────────────────────────────────────────────────────

export interface EntropySchedulerConfig {
  /** Default: 60 * 60 * 1000 (60 minutes) */
  venue_scan_interval_ms: number;
  /** Default: 6 * 60 * 60 * 1000 (6 hours) */
  fleet_scan_interval_ms: number;
  enabled: boolean;
}

export const DEFAULT_ENTROPY_SCHEDULER_CONFIG: EntropySchedulerConfig = {
  venue_scan_interval_ms: 60 * 60 * 1000,
  fleet_scan_interval_ms: 6 * 60 * 60 * 1000,
  enabled: true,
};

// ─── Entropy Scheduler ────────────────────────────────────────────────────────

export class EntropyScheduler {
  private venueJobs: Map<string, ReturnType<typeof setInterval>> = new Map();
  private venueStates: Map<string, SystemStateSnapshot> = new Map();

  constructor(
    private config: EntropySchedulerConfig,
    private jobRunner: VenueEntropyJob,
    private alertRouter: EntropyAlertRouter,
  ) {}

  /**
   * Schedule a venue for periodic entropy computation. Idempotent.
   */
  scheduleVenue(venueId: string, state: SystemStateSnapshot): void {
    if (!this.config.enabled) return;

    // Store latest state for scheduled runs
    this.venueStates.set(venueId, state);

    // Idempotent: if already scheduled, skip
    if (this.venueJobs.has(venueId)) return;

    const handle = setInterval(() => {
      const latestState = this.venueStates.get(venueId);
      if (latestState !== undefined) {
        const result = this.jobRunner.run(venueId, latestState);
        this.alertRouter.route(venueId, result);
      }
    }, this.config.venue_scan_interval_ms);

    this.venueJobs.set(venueId, handle);
  }

  /**
   * Unschedule a venue.
   */
  unscheduleVenue(venueId: string): void {
    const handle = this.venueJobs.get(venueId);
    if (handle !== undefined) {
      clearInterval(handle);
      this.venueJobs.delete(venueId);
    }
    this.venueStates.delete(venueId);
  }

  /**
   * Run a single immediate venue scan (deterministic, no timer).
   */
  runVenueScan(venueId: string, state: SystemStateSnapshot): VenueEntropyResult {
    const result = this.jobRunner.run(venueId, state);
    this.alertRouter.route(venueId, result);
    return result;
  }

  /**
   * Run fleet scan across all registered venues.
   * Deterministic ordering — sorted by venue_id.
   */
  runFleetScan(states: Map<string, SystemStateSnapshot>): FleetEntropyResult {
    const fleetJob = new FleetEntropyJob();
    return fleetJob.run(states);
  }

  /**
   * Stop all scheduled jobs.
   */
  stop(): void {
    for (const [venueId, handle] of this.venueJobs.entries()) {
      clearInterval(handle);
      this.venueJobs.delete(venueId);
    }
    this.venueStates.clear();
  }
}
