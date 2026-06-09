"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENTROPY_WEIGHTS = exports.FORBIDDEN_STATE_MONITOR_INTERVAL_MS = exports.REPLAY_PACKET_SCHEMA_VERSION = exports.PRE_OUTPUT_SCHEMA_VERSION = exports.CORPUS_SCHEMA_VERSION = exports.EMERGENCY_P99_TARGET_MS = exports.MANIFEST_P95_TARGET_MS = exports.PRE_P95_TARGET_MS = exports.SYSTEM_FALLBACK_DURATION_MS = exports.SYSTEM_EMERGENCY_FALLBACK_ID = exports.SYSTEM_FALLBACK_CONTENT_ID = exports.SOV_MAX_EFFECTIVE = exports.SOV_WARNING_THRESHOLD = exports.DEFAULT_PLAYLIST_ITEM_WEIGHT = exports.CONFIDENCE_STALE = exports.CONFIDENCE_NO_DELIVERY_LOG = exports.CONFIDENCE_CHECKSUM_MISMATCH = exports.CONFIDENCE_FULL = exports.CONFIDENCE_MAX_AGE_MS = exports.LEVEL_6_DEVICE_TRUTH = exports.LEVEL_5_STRUCTURAL = exports.LEVEL_4_SPONSORSHIP = exports.LEVEL_3_CAMPAIGN = exports.LEVEL_2_SCHEDULED = exports.LEVEL_1_OPERATIONAL = exports.LEVEL_0_EMERGENCY = exports.FNV1A_MOD = exports.FNV1A_PRIME = exports.FNV1A_OFFSET_BASIS = void 0;
// ─── FNV-1a 32-bit Algorithm Constants ────────────────────────────────────────
// Constitutionally fixed. DO NOT CHANGE without constitutional amendment.
exports.FNV1A_OFFSET_BASIS = 2_166_136_261;
exports.FNV1A_PRIME = 16_777_619;
exports.FNV1A_MOD = 2 ** 32; // 4_294_967_296
// ─── Resolution Level Constants ───────────────────────────────────────────────
exports.LEVEL_0_EMERGENCY = 0;
exports.LEVEL_1_OPERATIONAL = 1;
exports.LEVEL_2_SCHEDULED = 2;
exports.LEVEL_3_CAMPAIGN = 3;
exports.LEVEL_4_SPONSORSHIP = 4;
exports.LEVEL_5_STRUCTURAL = 5;
exports.LEVEL_6_DEVICE_TRUTH = 6;
// ─── Confidence Score Thresholds (LEVEL_6 annotation) ─────────────────────────
// Per PRE-REFERENCE-IMPLEMENTATION-v1.md §6.6
/** Maximum age for a delivery log to contribute to confidence (30 minutes) */
exports.CONFIDENCE_MAX_AGE_MS = 30 * 60 * 1000; // 1_800_000
/** Confidence score when last_seen within CONFIDENCE_MAX_AGE_MS and checksum matches */
exports.CONFIDENCE_FULL = 0.97;
/** Confidence score when last_seen within CONFIDENCE_MAX_AGE_MS but checksum differs */
exports.CONFIDENCE_CHECKSUM_MISMATCH = 0.60;
/** Confidence score when no delivery log exists */
exports.CONFIDENCE_NO_DELIVERY_LOG = 0.50;
/** Confidence score when last_seen older than CONFIDENCE_MAX_AGE_MS */
exports.CONFIDENCE_STALE = 0.30;
// ─── SOV (Share-of-Voice) Thresholds ──────────────────────────────────────────
// Per PRE-REFERENCE-IMPLEMENTATION-v1.md §5.4
/** Default weight for single playlist items at non-campaign resolution levels (LEVEL_0, LEVEL_1, LEVEL_2, LEVEL_5) */
exports.DEFAULT_PLAYLIST_ITEM_WEIGHT = 100;
/** SOV warning threshold: if total SOV exceeds this fraction, emit sov_warning_active */
exports.SOV_WARNING_THRESHOLD = 0.30;
/** Maximum effective SOV used in weight computation — prevents division by zero or negative base weight */
exports.SOV_MAX_EFFECTIVE = 0.9999;
// ─── Fallback Content Identifiers ─────────────────────────────────────────────
// Per PRE-REFERENCE-IMPLEMENTATION-v1.md §9.1
// These identifiers are constitutionally fixed.
exports.SYSTEM_FALLBACK_CONTENT_ID = 'system:fallback:v1';
exports.SYSTEM_EMERGENCY_FALLBACK_ID = 'system:emergency-fallback:v1';
/** Duration for system fallback content items */
exports.SYSTEM_FALLBACK_DURATION_MS = 30_000;
// ─── Performance Bounds ────────────────────────────────────────────────────────
// Per ENGINEERING-CONSTITUTION-v1.md §25.3
/** PRE.resolve() p95 target latency */
exports.PRE_P95_TARGET_MS = 200;
/** Manifest endpoint p95 target latency */
exports.MANIFEST_P95_TARGET_MS = 500;
/** Emergency activation p99 target latency */
exports.EMERGENCY_P99_TARGET_MS = 5_000;
// ─── Corpus Schema Version ────────────────────────────────────────────────────
exports.CORPUS_SCHEMA_VERSION = '1.0.0';
exports.PRE_OUTPUT_SCHEMA_VERSION = '1.0.0';
exports.REPLAY_PACKET_SCHEMA_VERSION = '1.0.0';
// ─── Production Monitor Intervals ─────────────────────────────────────────────
/** FORBIDDEN state monitor polling interval */
exports.FORBIDDEN_STATE_MONITOR_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
// ─── Entropy Metric Weights (Entropy Score composite) ─────────────────────────
// Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13
exports.ENTROPY_WEIGHTS = {
    M01_OVERRIDE_DIVERGENCE: 0.25,
    M03_CAMPAIGN_COVERAGE: 0.20,
    M04_PRIORITY_RANGE: 0.15,
    M06_SOV_WARNING_DURATION: 0.15,
    M08_EMERGENCY_RATE: 0.10,
    M11_OVERRIDE_AS_SCHEDULE: 0.10,
    M12_SCREEN_STALENESS: 0.05,
};
// Sum must equal 1.0 — verified at module load
const WEIGHT_SUM = Object.values(exports.ENTROPY_WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(WEIGHT_SUM - 1.0) > 0.0001) {
    throw new Error(`CONSTITUTIONAL_BREACH: ENTROPY_WEIGHTS sum to ${WEIGHT_SUM}, must equal 1.0. ` +
        `Check OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §13.`);
}
//# sourceMappingURL=constants.js.map