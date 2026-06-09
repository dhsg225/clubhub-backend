/**
 * PRE compile-time constants.
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §25, PRE-REFERENCE-IMPLEMENTATION-v1.md
 * Forbidden Pattern: FP-07 — no hardcoded threshold values outside this file.
 *
 * ALL numeric thresholds, algorithm constants, and behavioral parameters
 * used by PRE MUST be defined here. No numeric literals in PRE logic files.
 *
 * Changes to these constants require:
 * 1. A constitutional amendment for algorithm constants (FNV-1a, SWRR)
 * 2. A PR with corpus gate passing for behavioral thresholds
 */

// ─── FNV-1a 32-bit Algorithm Constants ────────────────────────────────────────
// Constitutionally fixed. DO NOT CHANGE without constitutional amendment.

export const FNV1A_OFFSET_BASIS = 2_166_136_261;
export const FNV1A_PRIME        = 16_777_619;
export const FNV1A_MOD          = 2 ** 32; // 4_294_967_296

// ─── Resolution Level Constants ───────────────────────────────────────────────

export const LEVEL_0_EMERGENCY    = 0 as const;
export const LEVEL_1_OPERATIONAL  = 1 as const;
export const LEVEL_2_SCHEDULED    = 2 as const;
export const LEVEL_3_CAMPAIGN     = 3 as const;
export const LEVEL_4_SPONSORSHIP  = 4 as const;
export const LEVEL_5_STRUCTURAL   = 5 as const;
export const LEVEL_6_DEVICE_TRUTH = 6 as const;

// ─── Confidence Score Thresholds (LEVEL_6 annotation) ─────────────────────────
// Per PRE-REFERENCE-IMPLEMENTATION-v1.md §6.6

/** Maximum age for a delivery log to contribute to confidence (30 minutes) */
export const CONFIDENCE_MAX_AGE_MS              = 30 * 60 * 1000; // 1_800_000
/** Confidence score when last_seen within CONFIDENCE_MAX_AGE_MS and checksum matches */
export const CONFIDENCE_FULL                    = 0.97;
/** Confidence score when last_seen within CONFIDENCE_MAX_AGE_MS but checksum differs */
export const CONFIDENCE_CHECKSUM_MISMATCH       = 0.60;
/** Confidence score when no delivery log exists */
export const CONFIDENCE_NO_DELIVERY_LOG         = 0.50;
/** Confidence score when last_seen older than CONFIDENCE_MAX_AGE_MS */
export const CONFIDENCE_STALE                   = 0.30;

// ─── SOV (Share-of-Voice) Thresholds ──────────────────────────────────────────
// Per PRE-REFERENCE-IMPLEMENTATION-v1.md §5.4

/** Default weight for single playlist items at non-campaign resolution levels (LEVEL_0, LEVEL_1, LEVEL_2, LEVEL_5) */
export const DEFAULT_PLAYLIST_ITEM_WEIGHT       = 100;

/** SOV warning threshold: if total SOV exceeds this fraction, emit sov_warning_active */
export const SOV_WARNING_THRESHOLD              = 0.30;
/** Maximum effective SOV used in weight computation — prevents division by zero or negative base weight */
export const SOV_MAX_EFFECTIVE                  = 0.9999;

// ─── Fallback Content Identifiers ─────────────────────────────────────────────
// Per PRE-REFERENCE-IMPLEMENTATION-v1.md §9.1
// These identifiers are constitutionally fixed.

export const SYSTEM_FALLBACK_CONTENT_ID         = 'system:fallback:v1';
export const SYSTEM_EMERGENCY_FALLBACK_ID       = 'system:emergency-fallback:v1';

/** Duration for system fallback content items */
export const SYSTEM_FALLBACK_DURATION_MS        = 30_000;

// ─── Performance Bounds ────────────────────────────────────────────────────────
// Per ENGINEERING-CONSTITUTION-v1.md §25.3

/** PRE.resolve() p95 target latency */
export const PRE_P95_TARGET_MS                  = 200;
/** Manifest endpoint p95 target latency */
export const MANIFEST_P95_TARGET_MS             = 500;
/** Emergency activation p99 target latency */
export const EMERGENCY_P99_TARGET_MS            = 5_000;

// ─── Corpus Schema Version ────────────────────────────────────────────────────

export const CORPUS_SCHEMA_VERSION              = '1.0.0' as const;
export const PRE_OUTPUT_SCHEMA_VERSION          = '1.0.0' as const;
export const REPLAY_PACKET_SCHEMA_VERSION       = '1.0.0' as const;

// ─── Production Monitor Intervals ─────────────────────────────────────────────

/** FORBIDDEN state monitor polling interval */
export const FORBIDDEN_STATE_MONITOR_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// ─── Entropy Metric Weights (Entropy Score composite) ─────────────────────────
// Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13

export const ENTROPY_WEIGHTS = {
  M01_OVERRIDE_DIVERGENCE:  0.25,
  M03_CAMPAIGN_COVERAGE:    0.20,
  M04_PRIORITY_RANGE:       0.15,
  M06_SOV_WARNING_DURATION: 0.15,
  M08_EMERGENCY_RATE:       0.10,
  M11_OVERRIDE_AS_SCHEDULE: 0.10,
  M12_SCREEN_STALENESS:     0.05,
} as const;

// Sum must equal 1.0 — verified at module load
const WEIGHT_SUM = Object.values(ENTROPY_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(WEIGHT_SUM - 1.0) > 0.0001) {
  throw new Error(
    `CONSTITUTIONAL_BREACH: ENTROPY_WEIGHTS sum to ${WEIGHT_SUM}, must equal 1.0. ` +
    `Check OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13.`
  );
}
