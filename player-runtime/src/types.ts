import type { PRE_Output, SystemStateSnapshot } from '@clubhub/pre-types';

export interface PlayerConfig {
  readonly screen_id: string;
  readonly venue_id: string;
  readonly poll_interval_ms: number;        // corpus sync poll interval
  readonly heartbeat_interval_ms: number;   // cloud heartbeat interval
  readonly corpus_cache_dir: string;        // local corpus cache path
  readonly replay_cache_dir: string;        // local replay packet cache path
  readonly asset_dir: string;               // local asset storage
  readonly chromium_url: string;            // player-ui URL
  readonly websocket_port: number;          // WebSocket server port for player-ui
  readonly cms_api_url: string;             // CMS API URL for corpus sync
  readonly autonomous_window_ms: number;    // must be >= 72 * 60 * 60 * 1000
}

export interface CorpusCache {
  readonly corpus_version_id: string;
  readonly checksum: string;
  readonly fetched_at: number;              // Unix ms
  readonly effective_at: number;            // Unix ms
  readonly corpus_data: unknown;            // serialized corpus
}

export interface ReplayPacket {
  readonly packet_id: string;              // correlation_id
  readonly screen_id: string;
  readonly at: number;                     // Unix ms of resolution
  readonly resolution_level: number;       // 0-6
  readonly playlist_checksum: string;
  readonly is_fallback: boolean;
  readonly record_checksum: string;        // fnv1a32 of packet minus this field
  readonly written_at: number;             // Unix ms
  readonly synced: boolean;                // has been uploaded to cloud
}

export type ContentReadinessState = 'READY' | 'DOWNLOADING' | 'DEFICIT' | 'UNKNOWN';
export type DegradedReason = 'NO_CORPUS' | 'NO_PLAYLIST' | 'ASSET_DEFICIT' | null;

export interface PlayerState {
  corpus_cache: CorpusCache | null;
  last_corpus_sync_at: number | null;
  last_heartbeat_at: number | null;
  constitutional_state: string;
  chromium_pid: number | null;
  consecutive_sync_failures: number;
  disk_free_mb: number;
  memory_rss_mb: number;
  temperature_celsius: number | null;
  corpus_load_source: 'current' | 'previous' | 'factory' | null;
  asset_url_expires_in_min: number;        // -1 = no URLs tracked
  // Remediation additions (2026-05-28)
  chromium_alive: boolean | null;          // null = not yet checked
  ntp_synced: boolean | null;              // null = check unavailable
  system_time_utc: number;                 // player's local clock ms
  last_resolution_level: number | null;    // last PRE resolution level 0-5
  // G-09: content readiness tracking (ADR-002)
  assets_required_count: number;           // corpus asset count
  assets_verified_count: number;           // locally verified asset count
  content_readiness_state: ContentReadinessState;
  degraded_reason: DegradedReason;         // set when constitutional_state = DEGRADED
}

// Re-export for convenience — suppress unused import warnings
export type { PRE_Output, SystemStateSnapshot };
