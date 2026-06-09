/**
 * Chaos subsystem compile-time constants.
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 * Forbidden Pattern: FP-07 — no hardcoded threshold values outside this file.
 *
 * All chaos thresholds, timeout values, and scenario parameters MUST be
 * defined here. No numeric literals in chaos scenario or runner files.
 */

// ─── Poll Storm Parameters ────────────────────────────────────────────────────

/** Number of rapid PRE calls in a poll storm simulation */
export const CHAOS_POLL_STORM_COUNT              = 10;

/** Millisecond offset between each poll call in a storm (simulated) */
export const CHAOS_POLL_STORM_INTERVAL_MS        = 1;

// ─── Fault Injection Offsets ──────────────────────────────────────────────────

/** Event bus lag: 30 minutes in milliseconds */
export const CHAOS_EVENT_BUS_LAG_MS             = 30 * 60 * 1000;  // 1_800_000

/** Clock skew: 2 hours in milliseconds */
export const CHAOS_CLOCK_SKEW_MS                = 2 * 60 * 60 * 1000;  // 7_200_000

// ─── Scenario IDs ─────────────────────────────────────────────────────────────

export const CHAOS_001_BACKEND_RESTART          = 'CHAOS-001' as const;
export const CHAOS_002_DB_RESTART               = 'CHAOS-002' as const;
export const CHAOS_003_CACHE_LOSS               = 'CHAOS-003' as const;
export const CHAOS_004_EVENT_BUS_LAG            = 'CHAOS-004' as const;
export const CHAOS_005_CLOCK_SKEW               = 'CHAOS-005' as const;
export const CHAOS_006_POLL_STORM               = 'CHAOS-006' as const;
export const CHAOS_007_EMERGENCY_POLL_STORM     = 'CHAOS-007' as const;

// ─── Expected Resolution Levels ───────────────────────────────────────────────

/** CHAOS-002 and CHAOS-003 (stale/empty) must resolve at LEVEL_5 */
export const CHAOS_EXPECTED_FALLBACK_LEVEL      = 5;

/** CHAOS-004 (event bus lag) must resolve at LEVEL_1 (override still valid) */
export const CHAOS_EXPECTED_OVERRIDE_LEVEL      = 1;

/** CHAOS-007 emergency precedence must resolve at LEVEL_0 */
export const CHAOS_EXPECTED_EMERGENCY_LEVEL     = 0;

// ─── Performance Thresholds ────────────────────────────────────────────────────

/** Maximum execution time per chaos scenario (generous bound for CI) */
export const CHAOS_MAX_EXECUTION_MS             = 2_000;

/** Total chaos run max duration in CI */
export const CHAOS_TOTAL_MAX_MS                 = 30_000;

// ─── Telemetry Event Types ────────────────────────────────────────────────────

export const CHAOS_EVENT_STARTED                = 'chaos_scenario_started' as const;
export const CHAOS_EVENT_COMPLETED              = 'chaos_scenario_completed' as const;
export const CHAOS_EVENT_INVARIANT_FAILED       = 'chaos_invariant_failed' as const;
export const CHAOS_EVENT_DEGRADED_RESOLUTION    = 'degraded_resolution_detected' as const;
export const CHAOS_EVENT_STALE_WINDOW           = 'stale_data_window_detected' as const;
export const CHAOS_EVENT_REPLAY_DIVERGENCE      = 'replay_divergence_detected' as const;
export const CHAOS_EVENT_FALLBACK_USED          = 'fallback_resolution_used' as const;

// ─── Emergency Content IDs ────────────────────────────────────────────────────
// Reexported from pre/constants for use in chaos assertions

export { SYSTEM_FALLBACK_CONTENT_ID, SYSTEM_EMERGENCY_FALLBACK_ID } from '../pre/constants';

// ─── Chaos Report Constants ───────────────────────────────────────────────────

export const CHAOS_REPORT_DIR                   = 'chaos-output' as const;
export const CHAOS_REPORT_FILENAME              = 'chaos-report.json' as const;
