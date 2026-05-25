/**
 * Runtime layer type definitions.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13
 *
 * The runtime layer wraps PRE.resolve() with telemetry, shadow execution,
 * and replay audit persistence. PRE itself remains pure.
 */

import type { PRE_Output } from '../pre/types';
import type { CanaryStage, ShadowComparisonResult } from '../shadow/types';

// ─── Runtime Configuration ───────────────────────────────────────────────────

export interface RuntimeConfig {
  shadow_mode_enabled: boolean;
  replay_audit_enabled: boolean;
  canary_stage: CanaryStage;
  entropy_enabled: boolean;
}

// ─── Runtime Request ─────────────────────────────────────────────────────────

export interface RuntimeRequest {
  correlation_id: string;
  screen_id: string;
  /** UTC ms — DO NOT call Date.now() in PRE; pass this through */
  at: number;
  /** Wall clock time of request (timing only — not in replay hash) */
  requested_at: number;
  config: RuntimeConfig;
}

// ─── Runtime Response ────────────────────────────────────────────────────────

export interface RuntimeResponse {
  correlation_id: string;
  screen_id: string;
  at: number;
  pre_output: PRE_Output;
  invariants_passed: boolean;
  /** NOT in replay hash */
  timing_ms: number;
  shadow_result?: ShadowComparisonResult;
  replay_artifact_id?: string;
}
