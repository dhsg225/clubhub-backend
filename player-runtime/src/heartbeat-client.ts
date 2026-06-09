/**
 * Heartbeat client — reports player health to cloud CMS.
 *
 * Payload includes operational health fields for fleet dashboard.
 * Fields added beyond the original design:
 *   - consecutive_sync_failures: backoff indicator
 *   - disk_free_mb: early warning before cache write failures
 *   - memory_rss_mb: leak detection
 *   - temperature_celsius: thermal management
 *   - corpus_load_source: flags degraded corpus loads
 *   - asset_url_expires_in_min: URL expiry early warning
 *
 * Failure model: heartbeat failure is NOT fatal. Player continues operating.
 * Cloud dashboard shows device as "offline" after 2 missed heartbeats (90s).
 * Fleet health route aggregates these payloads for operator visibility.
 */
import type { PlayerState } from './types.js';

export interface HeartbeatPayload {
  readonly screen_id: string;
  readonly at: number;
  readonly corpus_version_id: string | null;
  readonly constitutional_state: string;
  readonly replay_cache_size_bytes: number;
  readonly last_corpus_sync_at: number | null;
  // Operational health fields
  readonly consecutive_sync_failures: number;
  readonly disk_free_mb: number;
  readonly memory_rss_mb: number;
  readonly temperature_celsius: number | null;
  readonly corpus_load_source: string | null;
  readonly asset_url_expires_in_min: number;
  readonly corpus_age_ms: number | null;
  readonly chromium_alive: boolean | null;
  readonly ntp_synced: boolean | null;
  readonly system_time_utc: number;
  readonly last_resolution_level: number | null;
  // Asset readiness fields (G-09–G-11, ADR-002)
  readonly assets_required_count: number;
  readonly assets_verified_count: number;
  readonly content_readiness_state: string;
}

export class HeartbeatClient {
  private readonly cmsApiUrl: string;
  private readonly screenId: string;

  constructor(cmsApiUrl: string, screenId: string) {
    this.cmsApiUrl = cmsApiUrl;
    this.screenId = screenId;
  }

  async send(state: PlayerState, replayCacheSizeBytes: number): Promise<boolean> {
    const corpusAgeMs = state.corpus_cache
      ? Date.now() - state.corpus_cache.fetched_at
      : null;

    const payload: HeartbeatPayload = {
      screen_id:                  this.screenId,
      at:                         Date.now(),
      corpus_version_id:          state.corpus_cache?.corpus_version_id ?? null,
      constitutional_state:       state.constitutional_state,
      replay_cache_size_bytes:    replayCacheSizeBytes,
      last_corpus_sync_at:        state.last_corpus_sync_at,
      consecutive_sync_failures:  state.consecutive_sync_failures,
      disk_free_mb:               state.disk_free_mb,
      memory_rss_mb:              state.memory_rss_mb,
      temperature_celsius:        state.temperature_celsius,
      corpus_load_source:         state.corpus_load_source,
      asset_url_expires_in_min:   state.asset_url_expires_in_min,
      corpus_age_ms:              corpusAgeMs,
      chromium_alive:             state.chromium_alive,
      ntp_synced:                 state.ntp_synced,
      system_time_utc:            state.system_time_utc,
      last_resolution_level:      state.last_resolution_level,
      assets_required_count:      state.assets_required_count,
      assets_verified_count:      state.assets_verified_count,
      content_readiness_state:    state.content_readiness_state,
    };

    try {
      const response = await fetch(
        `${this.cmsApiUrl}/screens/${this.screenId}/heartbeat`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}
