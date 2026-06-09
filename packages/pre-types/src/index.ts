/**
 * @clubhub/pre-types
 *
 * Shared type definitions for the Playback Resolution Engine.
 * Zero runtime dependencies — types only.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13
 *
 * FROZEN POST-LAUNCH: Field changes to PRE_Output corrupt replay audit history.
 * Any proposed change requires replay verification against full historical audit dataset.
 */

export type ResolutionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface PlaylistItem {
  readonly content_id: string;
  readonly duration_ms: number;
  readonly resolution_level: ResolutionLevel;
}

export interface PRE_Output {
  readonly resolution_level: ResolutionLevel;
  readonly playlist: readonly PlaylistItem[];
  readonly playlist_checksum: string;
  readonly is_fallback: boolean;
  readonly resolved_at: number; // wall clock — NOT in replay hash
}

export interface PRE_Input {
  readonly screen_id: string;
  readonly at: number; // UTC ms — deterministic time
  readonly system_state: SystemStateSnapshot;
}

export interface SystemStateSnapshot {
  readonly corpus_version: string;
  readonly venue_id: string;
  readonly screen_zone_id: string;
  readonly active_emergencies: readonly string[];
  readonly entropy_advisory: boolean;
}

export interface CorpusSnapshot {
  readonly version: string;
  readonly venue_id: string;
  readonly checksum: string;
  readonly created_at: number;
}
