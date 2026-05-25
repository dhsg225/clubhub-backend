/**
 * Fleet entropy job — runs entropy for all venues deterministically.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §14
 */

import type { SystemStateSnapshot } from '../../pre/types';
import { VenueEntropyJob, VenueEntropyResult } from './venue-entropy-job';
import { emit as logEmit, base } from '../../observability/logger';
import { increment, METRICS } from '../../observability/metrics';
import type { EntropyJobLog } from '../../observability/telemetry-schemas';

// ─── Fleet Entropy Result ─────────────────────────────────────────────────────

export interface FleetEntropyResult {
  venue_count: number;
  results: VenueEntropyResult[];
  fleet_summary: {
    critical_count: number;
    degraded_count: number;
    healthy_count: number;
  };
  computed_at: number;
  duration_ms: number;
}

// ─── Fleet Entropy Job ────────────────────────────────────────────────────────

export class FleetEntropyJob {
  private readonly venueJob: VenueEntropyJob;

  constructor() {
    this.venueJob = new VenueEntropyJob();
  }

  /**
   * Run entropy for all venues. Sorted deterministically by venue_id.
   */
  run(states: Map<string, SystemStateSnapshot>): FleetEntropyResult {
    const startMs = Date.now();
    const computedAt = startMs;

    // Sort venue IDs deterministically
    const venueIds = [...states.keys()].sort();

    const results: VenueEntropyResult[] = [];
    for (const venueId of venueIds) {
      const state = states.get(venueId);
      if (state !== undefined) {
        results.push(this.venueJob.run(venueId, state));
      }
    }

    const critical_count = results.filter(r => r.report.label === 'CRITICAL').length;
    const degraded_count = results.filter(r => r.report.label === 'DEGRADED').length;
    const healthy_count  = results.filter(
      r => r.report.label === 'HEALTHY' || r.report.label === 'NOMINAL'
    ).length;

    const durationMs = Date.now() - startMs;

    // Compute a fleet-level composite (mean of venue composites)
    const compositeSum = results.reduce((sum, r) => sum + r.report.composite, 0);
    const composite = results.length > 0 ? compositeSum / results.length : 0;

    // Emit fleet job log
    const baseLog = base('INFO', 'entropy.job');
    const jobLog: EntropyJobLog = {
      ts: baseLog.ts,
      severity: baseLog.severity,
      event_type: 'entropy.job',
      request_id: baseLog.request_id,
      replay_id: baseLog.replay_id,
      job_type: 'fleet',
      screen_count: results.length,
      composite_score: composite,
      label: 'N/A',
      advisory_tier: 0,
      duration_ms: durationMs,
    };
    logEmit(jobLog);

    increment(METRICS.ENTROPY_JOB_DURATION_MS, { job_type: 'fleet' });

    return {
      venue_count: results.length,
      results,
      fleet_summary: {
        critical_count,
        degraded_count,
        healthy_count,
      },
      computed_at: computedAt,
      duration_ms: durationMs,
    };
  }
}
