/**
 * Fleet-level entropy aggregator.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §16, §17
 *
 * Aggregates venue-level entropy reports into a fleet-level summary.
 * Identifies hotspot venues for operational triage.
 *
 * The fleet composite is the mean of venue composites.
 * Fleet advisory tier is based on the fleet composite and the worst
 * venue's metrics.
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws.
 */

import type { VenueEntropyReport, FleetEntropyReport } from './types';
import { assignEntropyLabel } from './entropy-labeling';
import { computeAdvisoryTier } from './advisory-tier';

/** Number of hotspot venues to include in the fleet report */
const HOTSPOT_VENUES_LIMIT = 5;

/**
 * Compute fleet-level entropy report from venue reports.
 *
 * @param venues  Array of VenueEntropyReport — one per venue
 * @param at      UTC ms evaluation timestamp
 * @returns FleetEntropyReport
 */
export function computeFleetEntropy(
  venues: VenueEntropyReport[],
  at:     number
): FleetEntropyReport {
  if (venues.length === 0) {
    return {
      composite:      0,
      label:          'HEALTHY',
      advisory_tier:  0,
      venue_reports:  [],
      hotspot_venues: [],
      computed_at:    at,
    };
  }

  // Fleet composite = mean of venue composites
  const sumComposite = venues.reduce((sum, v) => sum + v.composite, 0);
  const composite    = sumComposite / venues.length;

  const label        = assignEntropyLabel(composite);

  // Advisory tier: use worst venue's metrics for escalation
  const sortedVenues  = [...venues].sort((a, b) => b.composite - a.composite);
  const worstVenue    = sortedVenues[0];
  const worstMetrics  = worstVenue !== undefined
    ? worstVenue.screen_scores.flatMap(s => s.metrics)
    : [];

  const advisoryTier = computeAdvisoryTier(label, worstMetrics);

  // Hotspots = top N venues by composite, descending
  const hotspotVenues = sortedVenues.slice(0, HOTSPOT_VENUES_LIMIT);

  return {
    composite,
    label,
    advisory_tier:  advisoryTier,
    venue_reports:  venues,
    hotspot_venues: hotspotVenues,
    computed_at:    at,
  };
}
