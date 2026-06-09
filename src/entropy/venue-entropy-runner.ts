/**
 * Venue-level entropy aggregator.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §14, §16.3
 *
 * Aggregates per-screen entropy scores into a venue-level report.
 * The venue composite is the mean of all screen composites.
 * Worst-offending screens are sorted descending by composite.
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws.
 */

import type { SystemStateSnapshot } from '../pre/types';
import type { VenueEntropyReport, EntropyScore } from './types';
import { computeScreenEntropy } from './entropy-runner';
import { assignEntropyLabel } from './entropy-labeling';
import { computeAdvisoryTier } from './advisory-tier';

/** Number of worst screens to include in the report */
const WORST_SCREENS_LIMIT = 5;

/**
 * Compute venue-level entropy report from an array of per-screen states.
 *
 * @param screens  Array of SystemStateSnapshot — one per screen in the venue
 * @param at       UTC ms evaluation timestamp
 * @returns VenueEntropyReport
 */
export function computeVenueEntropy(
  screens: SystemStateSnapshot[],
  at:      number
): VenueEntropyReport {
  if (screens.length === 0) {
    // Empty venue: return zero-entropy report
    const emptyLabel = assignEntropyLabel(0);
    return {
      venue_id:      'unknown',
      composite:     0,
      label:         emptyLabel,
      advisory_tier: 0,
      screen_scores: [],
      worst_screens: [],
      computed_at:   at,
    };
  }

  const venueId = screens[0]?.venue.id ?? 'unknown';

  // Compute per-screen entropy scores
  const screenScores: EntropyScore[] = screens.map(s => computeScreenEntropy(s, at));

  // Venue composite = mean of screen composites
  const sumComposite = screenScores.reduce((sum, s) => sum + s.composite, 0);
  const composite    = sumComposite / screenScores.length;

  const label        = assignEntropyLabel(composite);

  // Collect all metrics across screens for advisory tier computation
  // Use the flat list of all metric results from all screens
  const allMetrics   = screenScores.flatMap(s => s.metrics);
  const advisoryTier = computeAdvisoryTier(label, allMetrics);

  // Worst screens = top N by composite, descending
  const sortedScores = [...screenScores].sort((a, b) => b.composite - a.composite);
  const worstScreens = sortedScores.slice(0, WORST_SCREENS_LIMIT);

  return {
    venue_id:      venueId,
    composite,
    label,
    advisory_tier: advisoryTier,
    screen_scores: screenScores,
    worst_screens: worstScreens,
    computed_at:   at,
  };
}
