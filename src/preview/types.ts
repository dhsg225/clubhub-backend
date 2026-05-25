/**
 * Preview subsystem type definitions.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §3, §4
 *
 * Four preview surfaces (P-1 through P-4) provide deterministic, read-only
 * introspection into PRE resolution state.
 *
 * CRITICAL: All timestamps use request.at — never Date.now().
 * CRITICAL: replay_compatible is always true (compile-time constant).
 */

import type { PRE_Output, PRE_Input, SystemStateSnapshot } from '../pre/types';
import type { EntropyScore } from '../entropy/types';

// ─── Preview Surfaces ──────────────────────────────────────────────────────────

/** The four preview surfaces */
export type PreviewSurface = 'P1_CURRENT' | 'P2_FUTURE' | 'P3_DIFF' | 'P4_ENTROPY';

// ─── Preview Request / Response ────────────────────────────────────────────────

export interface PreviewRequest {
  screen_id:             string;
  /** Explicit timestamp — never Date.now() */
  at:                    number;
  system_state:          SystemStateSnapshot;
  include_entropy?:      boolean;
  include_reason_trace?: boolean;
  surface:               PreviewSurface;
}

export interface PreviewResponse {
  screen_id:          string;
  /** = request.at (no wall-clock) */
  generated_at:       number;
  surface:            PreviewSurface;
  playlist:           PRE_Output['playlist'];
  playlist_checksum:  string;
  resolution_level:   number;
  content_mix:        PRE_Output['content_mix'];
  is_fallback:        boolean;
  confidence_score:   number;
  reason_trace:       PRE_Output['reason_trace'] | null;
  entropy_snapshot:   EntropyScore | null;
  advisory_tier:      number | null;
  explanation:        ResolutionExplanation | null;
  /** Always true — preview uses same PRE path as production */
  replay_compatible:  true;
  /** fnv1a32(canonicalizeJson(response minus preview_checksum)) */
  preview_checksum:   string;
}

// ─── Resolution Explanation ────────────────────────────────────────────────────

export interface ResolutionExplanation {
  terminating_level:       number;
  terminating_level_name:  string;
  /** Deterministic template fill — never freeform */
  summary:                 string;
  level_explanations:      LevelExplanation[];
  skipped_levels:          SkippedLevel[];
  /** e.g. "days_of_week=[1] (Monday) active at 14:00 CDT" */
  active_constraints:      string[];
}

export interface LevelExplanation {
  level:       number;
  level_name:  string;
  /** null = not reached */
  outcome:     'RESOLVED' | 'SKIP' | 'FALLBACK' | null;
  reason:      string | null;
  detail:      Record<string, unknown> | null;
}

export interface SkippedLevel {
  level:        number;
  level_name:   string;
  skip_reason:  string;
}

// ─── Preview Diff ──────────────────────────────────────────────────────────────

export interface PreviewDiff {
  from_at:                    number;
  to_at:                      number;
  screen_id:                  string;
  has_changes:                boolean;
  resolution_level_changed:   boolean;
  is_fallback_changed:        boolean;
  playlist_changed:           boolean;
  content_mix_changed:        boolean;
  advisory_tier_changed:      boolean;
  reason_trace_changed:       boolean;
  field_diffs:                PreviewFieldDiff[];
  diff_checksum:              string;
}

export interface PreviewFieldDiff {
  path:  string;
  from:  unknown;
  to:    unknown;
}

// ─── Telemetry Events ──────────────────────────────────────────────────────────

export type PreviewEvent =
  | { type: 'preview_requested';           screen_id: string; surface: PreviewSurface; at: number }
  | { type: 'future_preview_requested';    screen_id: string; target_at: number; requested_at: number }
  | { type: 'preview_diff_generated';      screen_id: string; from_at: number; to_at: number; has_changes: boolean }
  | { type: 'reason_trace_rendered';       screen_id: string; terminating_level: number; at: number }
  | { type: 'entropy_snapshot_generated';  screen_id: string; composite: number; advisory_tier: number; at: number }
  | { type: 'preview_fallback_detected';   screen_id: string; resolution_level: number; at: number };
