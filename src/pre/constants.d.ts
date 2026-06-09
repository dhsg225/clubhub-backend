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
export declare const FNV1A_OFFSET_BASIS = 2166136261;
export declare const FNV1A_PRIME = 16777619;
export declare const FNV1A_MOD: number;
export declare const LEVEL_0_EMERGENCY: 0;
export declare const LEVEL_1_OPERATIONAL: 1;
export declare const LEVEL_2_SCHEDULED: 2;
export declare const LEVEL_3_CAMPAIGN: 3;
export declare const LEVEL_4_SPONSORSHIP: 4;
export declare const LEVEL_5_STRUCTURAL: 5;
export declare const LEVEL_6_DEVICE_TRUTH: 6;
/** Maximum age for a delivery log to contribute to confidence (30 minutes) */
export declare const CONFIDENCE_MAX_AGE_MS: number;
/** Confidence score when last_seen within CONFIDENCE_MAX_AGE_MS and checksum matches */
export declare const CONFIDENCE_FULL = 0.97;
/** Confidence score when last_seen within CONFIDENCE_MAX_AGE_MS but checksum differs */
export declare const CONFIDENCE_CHECKSUM_MISMATCH = 0.6;
/** Confidence score when no delivery log exists */
export declare const CONFIDENCE_NO_DELIVERY_LOG = 0.5;
/** Confidence score when last_seen older than CONFIDENCE_MAX_AGE_MS */
export declare const CONFIDENCE_STALE = 0.3;
/** Default weight for single playlist items at non-campaign resolution levels (LEVEL_0, LEVEL_1, LEVEL_2, LEVEL_5) */
export declare const DEFAULT_PLAYLIST_ITEM_WEIGHT = 100;
/** SOV warning threshold: if total SOV exceeds this fraction, emit sov_warning_active */
export declare const SOV_WARNING_THRESHOLD = 0.3;
/** Maximum effective SOV used in weight computation — prevents division by zero or negative base weight */
export declare const SOV_MAX_EFFECTIVE = 0.9999;
export declare const SYSTEM_FALLBACK_CONTENT_ID = "system:fallback:v1";
export declare const SYSTEM_EMERGENCY_FALLBACK_ID = "system:emergency-fallback:v1";
/** Duration for system fallback content items */
export declare const SYSTEM_FALLBACK_DURATION_MS = 30000;
/** PRE.resolve() p95 target latency */
export declare const PRE_P95_TARGET_MS = 200;
/** Manifest endpoint p95 target latency */
export declare const MANIFEST_P95_TARGET_MS = 500;
/** Emergency activation p99 target latency */
export declare const EMERGENCY_P99_TARGET_MS = 5000;
export declare const CORPUS_SCHEMA_VERSION: "1.0.0";
export declare const PRE_OUTPUT_SCHEMA_VERSION: "1.0.0";
export declare const REPLAY_PACKET_SCHEMA_VERSION: "1.0.0";
/** FORBIDDEN state monitor polling interval */
export declare const FORBIDDEN_STATE_MONITOR_INTERVAL_MS: number;
export declare const ENTROPY_WEIGHTS: {
    readonly M01_OVERRIDE_DIVERGENCE: 0.25;
    readonly M03_CAMPAIGN_COVERAGE: 0.2;
    readonly M04_PRIORITY_RANGE: 0.15;
    readonly M06_SOV_WARNING_DURATION: 0.15;
    readonly M08_EMERGENCY_RATE: 0.1;
    readonly M11_OVERRIDE_AS_SCHEDULE: 0.1;
    readonly M12_SCREEN_STALENESS: 0.05;
};
//# sourceMappingURL=constants.d.ts.map