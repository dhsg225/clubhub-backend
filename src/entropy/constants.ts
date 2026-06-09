/**
 * Entropy subsystem compile-time constants.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5, §13
 * Forbidden Pattern: FP-07 — no hardcoded threshold values outside this file.
 *
 * ALL thresholds used by entropy calculators MUST be defined here.
 * No numeric literals allowed in entropy logic files.
 *
 * Normalization formula (from §13.3):
 *   - advisory_threshold maps to normalized score 50
 *   - review_threshold maps to normalized score 80
 *   - above review threshold: asymptotic approach to 100 via e^(-excess/review_threshold)
 *   - inverted metrics: input is (max - raw_value) before normalization
 */

// ─── M-01: Override Divergence Rate ───────────────────────────────────────────
// Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-01
// Percentage of screens whose last resolution used override (levels 0, 1, or 2)

/** Override divergence advisory threshold: > 15% of screens on override */
export const M01_ADVISORY_THRESHOLD  = 15;   // percent
/** Override divergence review threshold: > 30% of screens on override */
export const M01_REVIEW_THRESHOLD    = 30;   // percent
/** Resolution levels classified as "override-driven" for M-01 */
export const M01_OVERRIDE_LEVELS     = [0, 1, 2] as const;

// ─── M-02: Schedule Fragmentation ─────────────────────────────────────────────
// Derived from §4.3 Shadow Scheduling, §5.1 M-05 Duplicate Content Pairs
// Counts schedule pairs with the same (content_id, target_type, target_id) overlap

/** Fragmentation advisory threshold: > 3 duplicate content pairs */
export const M02_ADVISORY_THRESHOLD  = 3;    // count of duplicate pairs
/** Fragmentation review threshold: > 8 duplicate content pairs */
export const M02_REVIEW_THRESHOLD    = 8;    // count of duplicate pairs

// ─── M-03: Campaign Coverage Rate ─────────────────────────────────────────────
// Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-03
// Percentage of active schedule rows with non-null campaign_id
// INVERTED: low coverage = high entropy (100 - coverage before normalization)

/** Campaign coverage advisory threshold: < 60% coverage (inverted: > 40%) */
export const M03_ADVISORY_THRESHOLD  = 40;   // inverted: 100 - 60
/** Campaign coverage review threshold: < 30% coverage (inverted: > 70%) */
export const M03_REVIEW_THRESHOLD    = 70;   // inverted: 100 - 30

// ─── M-04: Priority Spread ────────────────────────────────────────────────────
// Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-04
// MAX(priority) - MIN(priority) across active schedules

/** Priority spread advisory threshold: range > 100 */
export const M04_ADVISORY_THRESHOLD  = 100;  // priority units
/** Priority spread review threshold: range > 200 */
export const M04_REVIEW_THRESHOLD    = 200;  // priority units

// ─── M-05: Manual Intervention Frequency ──────────────────────────────────────
// Derived from §4.1 Override Divergence, §5.1 M-11 Override-as-Schedule Count
// Count of overrides with expires_at IS NULL older than 30 days

/** Override-as-schedule advisory threshold: > 3 permanent overrides > 30 days old */
export const M05_ADVISORY_THRESHOLD  = 3;    // count
/** Override-as-schedule review threshold: > 8 permanent overrides > 30 days old */
export const M05_REVIEW_THRESHOLD    = 8;    // count
/** Age threshold for permanent overrides to be considered "intervention" pattern (30 days) */
export const M05_PERMANENT_OVERRIDE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 2_592_000_000

// ─── M-06: Emergency Semantic Drift ───────────────────────────────────────────
// Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-08, §4.6, §6.4
// Count of emergency activations in rolling 30-day window

/** Emergency semantic drift advisory threshold: > 3 activations per 30 days */
export const M06_ADVISORY_THRESHOLD  = 3;    // count per 30 days
/** Emergency semantic drift review threshold: > 6 activations per 30 days */
export const M06_REVIEW_THRESHOLD    = 6;    // count per 30 days
/** Rolling window for emergency frequency measurement (30 days) */
export const M06_WINDOW_MS           = 30 * 24 * 60 * 60 * 1000; // 2_592_000_000
/** Emergency activations with reason field set count as legitimate (reduces score) */
export const M06_SHORT_DURATION_MS   = 4 * 60 * 60 * 1000; // 4 hours — heuristic for "operational misuse"

// ─── M-07: Screen Configuration Divergence ────────────────────────────────────
// Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-12 Screen Configuration Staleness Index
// Percentage of screens with no configuration touch in > 90 days

/** Config staleness advisory threshold: > 20% of screens untouched > 90 days */
export const M07_ADVISORY_THRESHOLD  = 20;   // percent
/** Config staleness review threshold: > 40% of screens untouched > 90 days */
export const M07_REVIEW_THRESHOLD    = 40;   // percent
/** Configuration staleness age cutoff: screens with overrides older than this are "stale" */
export const M07_STALENESS_AGE_MS    = 90 * 24 * 60 * 60 * 1000; // 7_776_000_000

// ─── M-08: Sponsor Saturation ─────────────────────────────────────────────────
// Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-06 SOV Warning Duration
// Measures proximity of total SOV to warning threshold

/** SOV saturation advisory threshold: total SOV > 50% of SOV warning threshold distance */
export const M08_ADVISORY_SOV_RATIO  = 0.50; // fraction of SOV_WARNING_THRESHOLD proximity
/** SOV saturation review threshold: total SOV > 80% of SOV warning threshold distance */
export const M08_REVIEW_SOV_RATIO    = 0.80; // fraction of SOV_WARNING_THRESHOLD proximity
/** SOV warning threshold (mirrors src/pre/constants.ts SOV_WARNING_THRESHOLD) */
export const M08_SOV_WARNING_THRESHOLD = 0.30; // 30%

// ─── M-09: Device Staleness ───────────────────────────────────────────────────
// Derived from §7.2 Staleness Classification, LEVEL_6 confidence model
// Percentage of screens with last_seen_at older than staleness threshold

/** Device staleness advisory threshold: > 15% of screens stale */
export const M09_ADVISORY_THRESHOLD  = 15;   // percent
/** Device staleness review threshold: > 35% of screens stale */
export const M09_REVIEW_THRESHOLD    = 35;   // percent
/** Age after which a screen is considered stale for M-09 (matches CONFIDENCE_MAX_AGE_MS × 2) */
export const M09_STALE_AGE_MS        = 60 * 60 * 1000; // 1 hour = 3_600_000

// ─── M-10: Content Mix Instability ────────────────────────────────────────────
// Derived from §4.3 Shadow Scheduling, §5.1 M-05
// Variance in content_mix across screens sharing the same area_id

/** Content mix instability advisory threshold: stddev of campaign_pct > 0.20 */
export const M10_ADVISORY_THRESHOLD  = 0.20; // stddev of campaign fraction [0,1]
/** Content mix instability review threshold: stddev of campaign_pct > 0.40 */
export const M10_REVIEW_THRESHOLD    = 0.40; // stddev of campaign fraction [0,1]

// ─── M-11: Preview Resolution Divergence ──────────────────────────────────────
// Derived from §8.3 Preview Surface Data Freshness, §6.2
// Fraction of screens where last_delivery resolution_level differs from current best estimate

/** Preview divergence advisory threshold: > 15% of screens diverged */
export const M11_ADVISORY_THRESHOLD  = 15;   // percent
/** Preview divergence review threshold: > 30% of screens diverged */
export const M11_REVIEW_THRESHOLD    = 30;   // percent
/** Max age for last_delivery to be considered "recent" enough to compare */
export const M11_DELIVERY_RECENCY_MS = 30 * 60 * 1000; // 30 minutes = 1_800_000

// ─── M-12: Screen Staleness ───────────────────────────────────────────────────
// Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §5.1 M-12 (delivery log angle)
// Percentage of screens with stale or missing delivery log

/** Delivery staleness advisory threshold: > 20% of screens without recent delivery log */
export const M12_ADVISORY_THRESHOLD  = 20;   // percent
/** Delivery staleness review threshold: > 40% of screens without recent delivery log */
export const M12_REVIEW_THRESHOLD    = 40;   // percent
/** Max age for last_delivery to count as "recent" (matches CONFIDENCE_MAX_AGE_MS) */
export const M12_DELIVERY_FRESH_MS   = 30 * 60 * 1000; // 30 minutes = 1_800_000

// ─── Normalization Constants ───────────────────────────────────────────────────
// Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13.3

/** Score value at advisory threshold */
export const NORM_ADVISORY_SCORE     = 50;
/** Score value at review threshold */
export const NORM_REVIEW_SCORE       = 80;
/** Asymptote ceiling */
export const NORM_MAX_SCORE          = 100;

// ─── Entropy Score Weights ─────────────────────────────────────────────────────
// Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13.2
// These 7 metrics are the canonical entropy score components

/** Weight: M-01 Override Divergence Rate */
export const ENTROPY_WEIGHT_M01      = 0.25;
/** Weight: M-03 Campaign Coverage Rate (inverted) */
export const ENTROPY_WEIGHT_M03      = 0.20;
/** Weight: M-04 Priority Range Width */
export const ENTROPY_WEIGHT_M04      = 0.15;
/** Weight: M-06 Emergency Semantic Drift */
export const ENTROPY_WEIGHT_M06      = 0.10;
/** Weight: M-08 Sponsor Saturation */
export const ENTROPY_WEIGHT_M08      = 0.10;
/** Weight: M-09 Device Staleness */
export const ENTROPY_WEIGHT_M09      = 0.10;
/** Weight: M-05 Manual Intervention Frequency */
export const ENTROPY_WEIGHT_M05      = 0.10;

// Weights for the remaining metrics (informational, not in canonical score)
export const ENTROPY_WEIGHT_M02      = 0.00;
export const ENTROPY_WEIGHT_M07      = 0.00;
export const ENTROPY_WEIGHT_M10      = 0.00;
export const ENTROPY_WEIGHT_M11      = 0.00;
export const ENTROPY_WEIGHT_M12      = 0.00;

// Verify canonical weight sum (must be 1.0)
const _CANONICAL_WEIGHT_SUM =
  ENTROPY_WEIGHT_M01 +
  ENTROPY_WEIGHT_M03 +
  ENTROPY_WEIGHT_M04 +
  ENTROPY_WEIGHT_M05 +
  ENTROPY_WEIGHT_M06 +
  ENTROPY_WEIGHT_M08 +
  ENTROPY_WEIGHT_M09;

if (Math.abs(_CANONICAL_WEIGHT_SUM - 1.0) > 0.0001) {
  throw new Error(
    `CONSTITUTIONAL_BREACH: Entropy canonical weights sum to ${_CANONICAL_WEIGHT_SUM}, must equal 1.0. ` +
    `Check OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13.2.`
  );
}

// ─── Entropy Label Thresholds ──────────────────────────────────────────────────
// Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13.4 (normalized to [0,1])

/** Normalized score boundaries for entropy labels */
export const LABEL_HEALTHY_MAX       = 0.20;   // 0–20 = Healthy (spec: 0–20)
export const LABEL_NOMINAL_MAX       = 0.40;   // 21–40 = Nominal
export const LABEL_DRIFTING_MAX      = 0.60;   // 41–60 = Drifting
export const LABEL_DEGRADED_MAX      = 0.80;   // 61–80 = Degraded
                                                 // 81–100 = Critical

// ─── Advisory Tier Thresholds ─────────────────────────────────────────────────

/** Normalized score boundary for advisory tier escalation */
export const ADVISORY_TIER_1_MAX     = 0.40;   // Tier 0–1: HEALTHY/NOMINAL
export const ADVISORY_TIER_2_MAX     = 0.60;   // Tier 2: DRIFTING
export const ADVISORY_TIER_3_MAX     = 0.80;   // Tier 3: DEGRADED
                                                 // Tier 4: CRITICAL (> 0.80)
