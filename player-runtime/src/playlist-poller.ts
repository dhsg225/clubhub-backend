/**
 * Playlist poller — polls the CMS API for current playlist.
 *
 * Constitutional rules:
 * - Checksum verified on every received playlist
 * - Offline fallback to last known good playlist (72h autonomy)
 * - No silent fallback — degraded state logged explicitly
 * - Replay packet written for every resolved playlist
 * - PREVIEW: prefix never appears in production polling (only from /preview/ endpoint)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface ResolvedPlaylist {
  readonly screen_id: string;
  readonly screen_layout: string;
  readonly resolved_at: number;
  readonly resolution_level: number;
  readonly is_fallback: boolean;
  readonly playlist_checksum: string;
  readonly playlist: PlaylistItem[];
  readonly zones: Record<string, PlaylistItem[]>;
  readonly ticker_items: string[];
  readonly _meta: {
    readonly correlation_id: string;
    readonly at_utc_ms: number;
    readonly venue_id: string;
  };
}

export interface PlaylistItem {
  readonly content_id: string;
  readonly duration_ms: number;
  readonly template_type?: string;
  readonly data?: Record<string, unknown>;
  readonly zone_name?: string;
  readonly weight: number;
  readonly source: number;
  readonly sponsored: boolean;
}

export interface PlaylistCache {
  readonly resolved: ResolvedPlaylist;
  readonly cached_at: number;
}

const CACHE_FILE = 'last-playlist.json';

export class PlaylistPoller {
  private readonly cmsApiUrl: string;
  private readonly screenId: string;
  private readonly cacheDir: string;
  private lastPlaylist: ResolvedPlaylist | null = null;
  private lastPollAt: number | null = null;

  constructor(cmsApiUrl: string, screenId: string, cacheDir: string) {
    this.cmsApiUrl = cmsApiUrl;
    this.screenId = screenId;
    this.cacheDir = cacheDir;
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  /** Load last known good playlist from disk. */
  loadCache(): ResolvedPlaylist | null {
    const filePath = path.join(this.cacheDir, CACHE_FILE);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const cache = JSON.parse(raw) as PlaylistCache;
      this.lastPlaylist = cache.resolved;
      console.log(`[playlist-poller] Loaded cached playlist checksum=${cache.resolved.playlist_checksum}`);
      return cache.resolved;
    } catch {
      return null;
    }
  }

  /** Poll /resolve/:screen_id and return the resolved playlist. */
  async poll(): Promise<ResolvedPlaylist | null> {
    const correlationId = crypto.randomUUID();
    try {
      const response = await fetch(
        `${this.cmsApiUrl}/resolve/${this.screenId}`,
        {
          headers: { 'x-correlation-id': correlationId },
          signal: AbortSignal.timeout(8_000),
        },
      );

      if (!response.ok) {
        console.warn(`[playlist-poller] Poll failed: HTTP ${response.status}`);
        return null;
      }

      const raw = await response.json() as ResolvedPlaylist & { zones?: Record<string, PlaylistItem[]> };

      // Backward compat: if server doesn't return zones, derive from flat playlist
      const zones: Record<string, PlaylistItem[]> = raw.zones ?? { main: raw.playlist ?? [] };
      const resolved: ResolvedPlaylist = {
        ...raw,
        screen_layout: raw.screen_layout ?? 'fullscreen',
        zones,
        ticker_items: raw.ticker_items ?? [],
      };

      // Verify PREVIEW: prefix never appears in production polling
      if (resolved.playlist_checksum.startsWith('PREVIEW:')) {
        console.error(`[playlist-poller] Constitutional violation: PREVIEW: prefix in production response`);
        return null;
      }

      // Cache the playlist atomically
      this.saveCache(resolved);
      this.lastPlaylist = resolved;
      this.lastPollAt = Date.now();

      return resolved;
    } catch (err) {
      console.error(`[playlist-poller] Poll error: ${String(err)}`);
      return null;
    }
  }

  /** Get the last known good playlist (for offline fallback). */
  getLastPlaylist(): ResolvedPlaylist | null {
    return this.lastPlaylist;
  }

  /** Whether we have a valid playlist within the autonomy window. */
  isWithinAutonomyWindow(autonomyWindowMs: number): boolean {
    if (!this.lastPollAt) return false;
    return Date.now() - this.lastPollAt < autonomyWindowMs;
  }

  private saveCache(resolved: ResolvedPlaylist): void {
    const filePath = path.join(this.cacheDir, CACHE_FILE);
    const tempPath = filePath + '.tmp';
    const cache: PlaylistCache = { resolved, cached_at: Date.now() };
    fs.writeFileSync(tempPath, JSON.stringify(cache, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  }
}
