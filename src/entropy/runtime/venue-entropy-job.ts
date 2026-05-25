/**
 * Venue entropy job — runs per-venue entropy computation with telemetry.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §14
 */

import type { SystemStateSnapshot } from '../../pre/types';
import type { VenueEntropyReport } from '../types';
import { computeVenueEntropy } from '../venue-entropy-runner';
import { emit as logEmit, base } from '../../observability/logger';
import { increment, METRICS } from '../../observability/metrics';
import type { EntropyJobLog } from '../../observability/telemetry-schemas';

// ─── Venue Entropy Result ─────────────────────────────────────────────────────

export interface VenueEntropyResult {
  venue_id: string;
  report: VenueEntropyReport;
  computed_at: number;
  duration_ms: number;
}

// ─── Venue Entropy Job ────────────────────────────────────────────────────────

export class VenueEntropyJob {
  /**
   * Run entropy computation for a venue. Emits telemetry.
   */
  run(venueId: string, state: SystemStateSnapshot): VenueEntropyResult {
    const startMs = Date.now();
    const computedAt = startMs;

    // Compute venue entropy from a single-screen state (or multi-screen if provided)
    const report = computeVenueEntropy([state], state.screen.last_seen_at ?? computedAt);

    const durationMs = Date.now() - startMs;

    // Emit EntropyJobLog
    const baseLog = base('INFO', 'entropy.job');
    const jobLog: EntropyJobLog = {
      ts: baseLog.ts,
      severity: baseLog.severity,
      event_type: 'entropy.job',
      request_id: baseLog.request_id,
      replay_id: baseLog.replay_id,
      job_type: 'venue',
      venue_id: venueId,
      screen_count: report.screen_scores.length,
      composite_score: report.composite,
      label: report.label,
      advisory_tier: report.advisory_tier,
      duration_ms: durationMs,
    };
    logEmit(jobLog);

    // Increment entropy job duration metric
    increment(METRICS.ENTROPY_JOB_DURATION_MS, { job_type: 'venue' });

    return {
      venue_id: venueId,
      report,
      computed_at: computedAt,
      duration_ms: durationMs,
    };
  }
}
