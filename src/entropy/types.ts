/**
 * Entropy subsystem type definitions.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13, §14
 *
 * These types define the exact input/output contracts for entropy calculators
 * and composite scoring. All types are read-only to enforce the advisory-only
 * constraint (Forbidden Pattern FP-13).
 *
 * CRITICAL: No type in this file may have mutating methods (apply, execute,
 * mutate, patch). Entropy output is observation, not action.
 */

import type { SystemStateSnapshot } from '../pre/types';

// ─── Metric Result ─────────────────────────────────────────────────────────────

/**
 * Result returned by each metric calculator.
 * All values are read-only to enforce advisory-only semantics.
 */
export interface MetricResult {
  /** Metric identifier: 'M-01' through 'M-12' */
  readonly metric_id:            string;
  /** Normalized score: 0.0–1.0 (0 = clean, 1 = maximum degradation) */
  readonly value:                number;
  /** Pre-normalization raw measurement in the metric's native unit */
  readonly raw_value:            number;
  /** What raw_value measures (e.g., 'percent', 'count', 'days') */
  readonly unit:                 string;
  /** Normalized warn threshold (maps to raw advisory threshold) */
  readonly threshold_warn:       number;
  /** Normalized critical threshold (maps to raw review threshold) */
  readonly threshold_critical:   number;
  /** Human-readable explanation: what was measured and why it matters */
  readonly explanation:          string;
  /** Specific observable factors driving this score */
  readonly contributing_factors: readonly string[];
  /** UTC ms — the `at` parameter passed to the calculator */
  readonly computed_at:          number;
}

// ─── Entropy Labels ────────────────────────────────────────────────────────────

/**
 * Entropy label based on composite score.
 * Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13.4
 *
 * HEALTHY:  0–20   (normalized 0.00–0.20)  Monthly review
 * NOMINAL:  21–40  (normalized 0.20–0.40)  Bi-weekly review
 * DRIFTING: 41–60  (normalized 0.40–0.60)  Weekly review
 * DEGRADED: 61–80  (normalized 0.60–0.80)  Immediate review recommended
 * CRITICAL: 81–100 (normalized 0.80–1.00)  Same-day review
 */
export type EntropyLabel = 'HEALTHY' | 'NOMINAL' | 'DRIFTING' | 'DEGRADED' | 'CRITICAL';

// ─── Advisory Tier ─────────────────────────────────────────────────────────────

/**
 * Advisory tier for UX surface escalation.
 * Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §10.2
 *
 * Tier 0: No advisory (HEALTHY/NOMINAL, no critical metrics)
 * Tier 1: Passive/informational (NOMINAL with some metrics elevated)
 * Tier 2: Noticed (DRIFTING, or NOMINAL with review-level metrics)
 * Tier 3: Confirmed — friction gate (DEGRADED, or DRIFTING with multiple review metrics)
 * Tier 4: Critical (CRITICAL label, or any M-06 emergency drift > review threshold)
 */
export type AdvisoryTier = 0 | 1 | 2 | 3 | 4;

// ─── Entropy Score ─────────────────────────────────────────────────────────────

/**
 * Full entropy score for a single screen/state snapshot.
 */
export interface EntropyScore {
  /** Composite score: 0.0–1.0 weighted combination of all metric results */
  readonly composite:      number;
  /** All 12 metric results */
  readonly metrics:        readonly MetricResult[];
  /** Human-readable label based on composite score */
  readonly label:          EntropyLabel;
  /** Advisory tier for UX escalation */
  readonly advisory_tier:  AdvisoryTier;
  /** UTC ms when this score was computed */
  readonly computed_at:    number;
  /** Screen ID this score applies to (if per-screen) */
  readonly screen_id?:     string;
  /** Venue ID this score applies to (if per-venue) */
  readonly venue_id?:      string;
}

// ─── Venue and Fleet Aggregates ────────────────────────────────────────────────

/**
 * Aggregated entropy report for a single venue.
 */
export interface VenueEntropyReport {
  readonly venue_id:          string;
  /** Mean composite score across all screens */
  readonly composite:         number;
  readonly label:             EntropyLabel;
  readonly advisory_tier:     AdvisoryTier;
  /** Individual screen scores */
  readonly screen_scores:     readonly EntropyScore[];
  /** Screens sorted by composite score descending (worst first) */
  readonly worst_screens:     readonly EntropyScore[];
  readonly computed_at:       number;
}

/**
 * Aggregated entropy report across the entire fleet.
 */
export interface FleetEntropyReport {
  /** Mean composite score across all venues */
  readonly composite:         number;
  readonly label:             EntropyLabel;
  readonly advisory_tier:     AdvisoryTier;
  /** Individual venue reports */
  readonly venue_reports:     readonly VenueEntropyReport[];
  /** Venues sorted by composite score descending (worst first) */
  readonly hotspot_venues:    readonly VenueEntropyReport[];
  readonly computed_at:       number;
}

// ─── Calculator Type Alias ─────────────────────────────────────────────────────

/**
 * Type signature for all entropy metric calculators.
 * Pure function: same (state, at) always produces same MetricResult.
 * Never throws — returns error state if computation fails.
 */
export type MetricCalculator = (
  state: SystemStateSnapshot,
  at:    number
) => MetricResult;

// ─── Staleness Classes ─────────────────────────────────────────────────────────

/**
 * Override/schedule staleness classification.
 * Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §7.2
 */
export type StalenessClass = 'A' | 'B' | 'C' | 'D';

export interface StalenessClassification {
  readonly class:       StalenessClass;
  readonly entity_id:   string;
  readonly entity_type: 'override' | 'schedule' | 'sponsorship';
  readonly age_days:    number;
  readonly description: string;
}
