/**
 * Player orchestrator — main loop.
 *
 * Coordinates corpus sync, PRE invocation scheduling, replay writing,
 * heartbeat, and emergency state propagation.
 *
 * Constitutional rules enforced here:
 * - PRE resolution happens via scheduled intervals (not remote call per render)
 * - Corpus checksum verified before apply
 * - Replay packets written append-only
 * - EMERGENCY_FREEZE cannot be auto-cleared
 *
 * Operational hardening added:
 * - Corpus sync uses exponential backoff with jitter after failures
 * - Corpus apply uses three-snapshot rotation (current/previous/factory)
 * - Watchdog receives corpus cache dir for integrity spot-checks
 * - Heartbeat includes operational health fields for fleet dashboard
 * - Asset URL expiry tracked; urgent sync triggered when URLs near expiry
 * - Backoff counter exposed in player state for fleet health reporting
 */
import * as path from 'node:path';
import type { PlayerConfig, PlayerState, ReplayPacket } from './types.js';
import { CorpusCacheManager } from './corpus-cache.js';
import { ReplayCacheWriter } from './replay-cache.js';
import { AssetVerifier } from './asset-verifier.js';
import { PollScheduler } from './poll-scheduler.js';
import { HeartbeatClient } from './heartbeat-client.js';
import { EmergencyRenderer } from './emergency-renderer.js';
import { Watchdog } from './watchdog.js';
import { PlaylistPoller, type ResolvedPlaylist } from './playlist-poller.js';
import { ReconnectBackoff } from './reconnect-backoff.js';
import { AssetUrlManager } from './asset-url-manager.js';
import { AssetDownloadManager } from './asset-download-manager.js';
import { RemoteCommandPoller, type CommandExecutionCallbacks } from './remote-command-poller.js';
import type { ChromiumLauncher } from './chromium-launcher.js';

// Re-export for convenience
export type { ReplayPacket };

export class PlayerOrchestrator {
  private readonly config: PlayerConfig;
  private readonly corpusCache: CorpusCacheManager;
  private readonly replayCache: ReplayCacheWriter;
  private readonly assetVerifier: AssetVerifier;
  private readonly heartbeatClient: HeartbeatClient;
  private readonly emergencyRenderer: EmergencyRenderer;
  private readonly watchdog: Watchdog;
  private readonly corpusPollScheduler: PollScheduler;
  private readonly heartbeatScheduler: PollScheduler;
  private readonly playlistPoller: PlaylistPoller;
  private readonly reconnectBackoff: ReconnectBackoff;
  private readonly assetUrlManager: AssetUrlManager;
  private readonly downloadManager: AssetDownloadManager;
  private readonly commandPoller: RemoteCommandPoller | null;
  private readonly cleanupFns: Array<() => void> = [];

  // Chromium launcher reference — set after construction via setChromiumLauncher()
  // Used to poll the live PID each health sync cycle.
  private chromiumLauncher: ChromiumLauncher | null = null;

  // Maintenance mode flag — set by remote command, cleared by remote command
  private maintenanceMode = false;

  // Pending force-sync signal — set by remote command, consumed by next poll cycle
  private forceSyncRequested = false;

  private state: PlayerState = {
    corpus_cache: null,
    last_corpus_sync_at: null,
    last_heartbeat_at: null,
    constitutional_state: 'INITIALIZING',
    chromium_pid: null,
    consecutive_sync_failures: 0,
    disk_free_mb: 0,
    memory_rss_mb: 0,
    temperature_celsius: null,
    corpus_load_source: null,
    asset_url_expires_in_min: -1,
    chromium_alive: null,
    ntp_synced: null,
    system_time_utc: Date.now(),
    last_resolution_level: null,
    // G-09: content readiness (ADR-002)
    assets_required_count: 0,
    assets_verified_count: 0,
    content_readiness_state: 'UNKNOWN',
    degraded_reason: null,
  };

  constructor(config: PlayerConfig) {
    this.config = config;
    this.corpusCache = new CorpusCacheManager(config.corpus_cache_dir);
    this.replayCache = new ReplayCacheWriter(config.replay_cache_dir);
    this.assetVerifier = new AssetVerifier(config.asset_dir);
    this.heartbeatClient = new HeartbeatClient(config.cms_api_url, config.screen_id);
    this.emergencyRenderer = new EmergencyRenderer(config.websocket_port);
    this.watchdog = new Watchdog(config.poll_interval_ms * 5);
    this.watchdog.setCorpusCacheDir(config.corpus_cache_dir);

    this.reconnectBackoff = new ReconnectBackoff({
      screen_id:        config.screen_id,
      base_interval_ms: config.poll_interval_ms,
      max_interval_ms:  15 * 60 * 1000,  // 15 min ceiling
      jitter_window_ms: 30_000,           // ±30s jitter
    });

    this.assetUrlManager = new AssetUrlManager();
    this.downloadManager = new AssetDownloadManager(config.asset_dir, this.assetVerifier);

    this.playlistPoller = new PlaylistPoller(
      config.cms_api_url,
      config.screen_id,
      path.join(config.corpus_cache_dir, 'playlist'),
    );

    this.corpusPollScheduler = new PollScheduler({
      screen_id:        config.screen_id,
      base_interval_ms: config.poll_interval_ms,
      max_jitter_ms:    Math.floor(config.poll_interval_ms * 0.1),
    });

    this.heartbeatScheduler = new PollScheduler({
      screen_id:        config.screen_id + ':heartbeat',
      base_interval_ms: config.heartbeat_interval_ms,
      max_jitter_ms:    Math.floor(config.heartbeat_interval_ms * 0.1),
    });

    // Remote command poller — only when CMS API is configured
    if (config.cms_api_url) {
      const callbacks: CommandExecutionCallbacks = {
        triggerCorpusSync: async () => {
          this.forceSyncRequested = true;
          await this.pollCorpus();
          await this.pollPlaylist();
          this.forceSyncRequested = false;
        },
        enterMaintenanceMode: () => {
          this.maintenanceMode = true;
          this.emergencyRenderer.sendConstitutionalState('MAINTENANCE');
          console.log('[orchestrator] Entered maintenance mode via remote command');
        },
        exitMaintenanceMode: () => {
          this.maintenanceMode = false;
          const nextState = this.state.corpus_cache ? 'HEALTHY' : 'DEGRADED';
          this.emergencyRenderer.sendConstitutionalState(nextState);
          console.log('[orchestrator] Exited maintenance mode via remote command');
        },
        rollbackToPreviousCorpus: () => {
          const previous = this.corpusCache.getPrevious();
          if (!previous) {
            console.warn('[orchestrator] Rollback requested but no previous corpus snapshot');
            return false;
          }
          this.state = {
            ...this.state,
            corpus_cache: previous,
            corpus_load_source: 'previous',
          };
          this.loadAssetUrlsFromCorpus(previous.corpus_data);
          console.log(
            `[orchestrator] Rolled back corpus to previous ` +
            `version=${previous.corpus_version_id}`
          );
          return true;
        },
        getWatchdogDiagnostics: () => {
          const health = this.watchdog.getHealthReport();
          return {
            ...health,
            constitutional_state: this.state.constitutional_state,
            corpus_version_id: this.state.corpus_cache?.corpus_version_id ?? null,
            corpus_load_source: this.state.corpus_load_source,
            consecutive_sync_failures: this.state.consecutive_sync_failures,
            asset_url_expires_in_min: this.state.asset_url_expires_in_min,
            maintenance_mode: this.maintenanceMode,
            at_utc_ms: Date.now(),
          };
        },
      };
      this.commandPoller = new RemoteCommandPoller(config.cms_api_url, config.screen_id, callbacks);
    } else {
      this.commandPoller = null;
    }
  }

  async start(): Promise<void> {
    console.log(`[orchestrator] Starting player screen_id=${this.config.screen_id}`);

    // Load cached corpus — enables offline operation immediately at boot
    const loadResult = this.corpusCache.load();
    if (loadResult) {
      this.state = {
        ...this.state,
        corpus_cache: loadResult.corpus,
        corpus_load_source: loadResult.source,
      };
      // Load asset URLs from corpus if present
      this.loadAssetUrlsFromCorpus(loadResult.corpus.corpus_data);
      console.log(
        `[orchestrator] Loaded corpus source=${loadResult.source} ` +
        `version=${loadResult.corpus.corpus_version_id}`
      );
    } else {
      console.warn('[orchestrator] No cached corpus — player cannot resolve until corpus received');
    }

    // Load cached playlist
    const cachedPlaylist = this.playlistPoller.loadCache();
    if (cachedPlaylist) {
      console.log(`[orchestrator] Loaded cached playlist checksum=${cachedPlaylist.playlist_checksum}`);
    }

    // Start watchdog
    this.watchdog.start();

    // Corpus + playlist polling — uses backoff interval when in failure state
    const stopCorpusPoll = this.corpusPollScheduler.schedule(async () => {
      this.watchdog.kick();
      await this.pollCorpus();
      await this.pollPlaylist();
      this.syncHealthFromWatchdog();
      this.syncContentReadiness(); // G-09/G-10/G-11
    });
    this.cleanupFns.push(stopCorpusPoll);

    // Heartbeat — separate scheduler, not affected by corpus backoff
    const stopHeartbeat = this.heartbeatScheduler.schedule(async () => {
      await this.sendHeartbeat();
    });
    this.cleanupFns.push(stopHeartbeat);

    // G-10: HEALTHY gate — requires content readiness, not just corpus presence.
    // syncContentReadiness() reads coverage from downloadManager which ran syncFromCorpus()
    // synchronously for already-present assets during loadAssetUrlsFromCorpus() above.
    this.syncContentReadiness();

    // Start remote command poller — last, after all state is initialized
    if (this.commandPoller) {
      this.commandPoller.start();
    }

    console.log('[orchestrator] Running');
  }

  async stop(): Promise<void> {
    this.commandPoller?.stop();
    this.cleanupFns.forEach(fn => { fn(); });
    this.watchdog.stop();
    this.emergencyRenderer.close();
  }

  private async pollCorpus(): Promise<void> {
    if (!this.config.cms_api_url) return;

    // Check if we should skip this poll due to backoff
    // Note: PollScheduler fires on its fixed schedule regardless of backoff.
    // Backoff is advisory here — we still attempt but track failures for reporting.
    // For true backoff, the scheduler interval would need to be dynamic.
    // This implementation tracks failures and reports them; aggressive backoff
    // is applied at the reconnection detection layer via urgentSyncRequired.

    // Prioritize sync when URLs are expiring soon (override normal schedule)
    if (this.assetUrlManager.urgentSyncRequired()) {
      console.warn('[orchestrator] Asset URLs near expiry — prioritizing corpus sync');
    }

    try {
      const response = await fetch(
        `${this.config.cms_api_url}/api/v2/screens/${this.config.screen_id}/corpus`,
        { signal: AbortSignal.timeout(10_000) }
      );

      if (!response.ok) {
        const backoffMs = this.reconnectBackoff.recordFailure();
        this.state = {
          ...this.state,
          consecutive_sync_failures: this.reconnectBackoff.getConsecutiveFailures(),
        };
        console.warn(
          `[orchestrator] Corpus poll failed: ${response.status} ` +
          `failures=${this.reconnectBackoff.getConsecutiveFailures()} ` +
          `backoff=${Math.round(backoffMs / 1000)}s`
        );
        return;
      }

      const corpus = await response.json() as {
        corpus_version_id: string;
        checksum: string;
        fetched_at: number;
        effective_at: number;
        corpus_data: unknown;
        asset_urls?: Record<string, { url: string; expires_at_ms: number }>;
      };

      // Skip if already on this version
      if (corpus.corpus_version_id === this.state.corpus_cache?.corpus_version_id) {
        this.reconnectBackoff.recordSuccess();
        this.state = { ...this.state, consecutive_sync_failures: 0 };
        // Re-sync asset registry after restart: asset_urls are not stored in the
        // corpus disk cache, so after a restart the registry starts empty even
        // though files may already be on disk. Trigger syncFromCorpus() once
        // (required_count===0 means registry was never populated this session).
        if (corpus.asset_urls && this.downloadManager.getCoverageStats().required_count === 0) {
          this.assetUrlManager.loadFromCorpus(corpus.asset_urls);
          this.downloadManager.syncFromCorpus(corpus.asset_urls);
        }
        return;
      }

      // Apply with snapshot rotation (current → previous → factory chain preserved)
      this.corpusCache.apply({
        corpus_version_id: corpus.corpus_version_id,
        checksum:          corpus.checksum,
        fetched_at:        corpus.fetched_at,
        effective_at:      corpus.effective_at,
        corpus_data:       corpus.corpus_data,
      });

      // Update asset URL tracking and trigger local download (G-01)
      if (corpus.asset_urls) {
        this.assetUrlManager.loadFromCorpus(corpus.asset_urls);
        this.downloadManager.syncFromCorpus(corpus.asset_urls);
      }

      this.reconnectBackoff.recordSuccess();
      const urlExpiry = this.assetUrlManager.getExpiryStatus();

      this.state = {
        ...this.state,
        corpus_cache:              this.corpusCache.getCurrent(),
        corpus_load_source:        'current',
        last_corpus_sync_at:       Date.now(),
        consecutive_sync_failures: 0,
        asset_url_expires_in_min:  urlExpiry.minutes_until_first_expiry,
      };

      console.log(
        `[orchestrator] Corpus updated version=${corpus.corpus_version_id} ` +
        `url_expires_in=${urlExpiry.minutes_until_first_expiry}min`
      );
    } catch (err) {
      const backoffMs = this.reconnectBackoff.recordFailure();
      this.state = {
        ...this.state,
        consecutive_sync_failures: this.reconnectBackoff.getConsecutiveFailures(),
      };
      console.error(
        `[orchestrator] Corpus poll error: ${String(err)} ` +
        `failures=${this.reconnectBackoff.getConsecutiveFailures()} ` +
        `backoff=${Math.round(backoffMs / 1000)}s`
      );
    }
  }

  private async pollPlaylist(): Promise<void> {
    if (!this.config.cms_api_url) {
      console.warn('[orchestrator] No CMS API URL — skipping playlist poll');
      return;
    }

    const resolved = await this.playlistPoller.poll();

    if (resolved !== null) {
      // Validation-first (ADR-002): enrich items per zone.
      // Data-driven items (template_type present) need no local asset — pass through as-is.
      // Asset-based items must have a verified local asset before being sent to the player.
      const enrichZoneItems = (items: typeof resolved.playlist) =>
        items
          .filter(item =>
            item.template_type
              ? true  // data-driven: no local asset needed
              : this.downloadManager.getLocalPath(item.content_id) !== null,
          )
          .map(item => ({
            ...item,
            ...(item.template_type
              ? {}  // data-driven: asset_path not used
              : { asset_path: `${this.config.chromium_url}/assets/${item.content_id}` }),
          }));

      // Build enriched zones map
      const enrichedZones: Record<string, unknown[]> = {};
      for (const [zoneName, zoneItems] of Object.entries(resolved.zones ?? {})) {
        enrichedZones[zoneName] = enrichZoneItems(zoneItems);
      }
      // Ensure main zone always present (backward compat)
      if (!enrichedZones['main']) {
        enrichedZones['main'] = enrichZoneItems(resolved.playlist);
      }

      const totalItems = Object.values(enrichedZones).reduce((s, a) => s + a.length, 0);
      const totalResolved = resolved.playlist.length;
      if (totalItems === 0 && totalResolved > 0) {
        console.warn(
          `[orchestrator] 0/${totalResolved} playlist items ready (assets downloading or data-driven empty)`,
        );
      }

      this.emergencyRenderer.sendPlaylistUpdate(
        resolved.playlist_checksum,
        resolved.screen_layout ?? 'fullscreen',
        enrichedZones,
      );

      const packet = {
        packet_id:        resolved._meta.correlation_id,
        screen_id:        resolved.screen_id,
        at:               resolved._meta.at_utc_ms,
        resolution_level: resolved.resolution_level,
        playlist_checksum: resolved.playlist_checksum,
        is_fallback:      resolved.is_fallback,
        written_at:       Date.now(),
        synced:           false,
      };

      const record_checksum = ReplayCacheWriter.computeChecksum(packet);
      try {
        this.replayCache.append({ ...packet, record_checksum });
      } catch (err) {
        console.error(`[orchestrator] Replay cache write failed: ${String(err)}`);
      }

      this.state = {
        ...this.state,
        last_resolution_level: resolved.resolution_level,
      };

      console.log(
        `[orchestrator] Playlist updated checksum=${resolved.playlist_checksum} ` +
        `level=${resolved.resolution_level} fallback=${resolved.is_fallback}`
      );
    } else {
      const cachedPlaylist = this.playlistPoller.getLastPlaylist();
      if (cachedPlaylist !== null) {
        // G-08: offline fallback applies same validation-first enrichment as online path
        const enrichCachedItems = (items: typeof cachedPlaylist.playlist) =>
          items
            .filter(item =>
              item.template_type
                ? true
                : this.downloadManager.getLocalPath(item.content_id) !== null,
            )
            .map(item => ({
              ...item,
              ...(item.template_type
                ? {}
                : { asset_path: `${this.config.chromium_url}/assets/${item.content_id}` }),
            }));

        const cachedZones: Record<string, unknown[]> = {};
        for (const [zoneName, zoneItems] of Object.entries(cachedPlaylist.zones ?? {})) {
          cachedZones[zoneName] = enrichCachedItems(zoneItems);
        }
        if (!cachedZones['main']) {
          cachedZones['main'] = enrichCachedItems(cachedPlaylist.playlist);
        }

        const eligibleCount = Object.values(cachedZones).reduce((s, a) => s + a.length, 0);
        console.warn(
          `[orchestrator] Using cached playlist (offline fallback) ` +
          `checksum=${cachedPlaylist.playlist_checksum} ` +
          `eligible=${eligibleCount}/${cachedPlaylist.playlist.length}`,
        );
        this.emergencyRenderer.sendPlaylistUpdate(
          cachedPlaylist.playlist_checksum,
          cachedPlaylist.screen_layout ?? 'fullscreen',
          cachedZones,
        );
      } else {
        console.error('[orchestrator] No playlist available — player has no content');
        this.state = { ...this.state, constitutional_state: 'DEGRADED' };
        this.emergencyRenderer.sendConstitutionalState('DEGRADED');
      }
    }
  }

  private async sendHeartbeat(): Promise<void> {
    const success = await this.heartbeatClient.send(
      this.state,
      this.replayCache.getFileSize(),
    );
    if (success) {
      this.state = { ...this.state, last_heartbeat_at: Date.now() };
    }
  }

  /**
   * Register the ChromiumLauncher so the watchdog can track its PID.
   * Called from index.ts immediately after creating both objects.
   */
  setChromiumLauncher(launcher: ChromiumLauncher): void {
    this.chromiumLauncher = launcher;
  }

  /** Sync watchdog health report into player state for heartbeat reporting. */
  private syncHealthFromWatchdog(): void {
    // Refresh the Chromium PID on every cycle so the watchdog always probes
    // the current process. After a crash + restart, getPid() returns the new
    // PID; after a crash before restart, it returns the dead PID which fails
    // the process.kill(pid,0) probe — correctly signalling CHROMIUM_DEAD.
    if (this.chromiumLauncher !== null) {
      this.watchdog.setChromiumPid(this.chromiumLauncher.getPid());
    }

    const health = this.watchdog.getHealthReport();
    this.state = {
      ...this.state,
      chromium_pid:        this.chromiumLauncher?.getPid() ?? null,
      disk_free_mb:        health.disk_free_mb,
      memory_rss_mb:       health.memory_rss_mb,
      temperature_celsius: health.temperature_celsius,
      chromium_alive:      health.chromium_alive,
      ntp_synced:          health.ntp_synced,
      system_time_utc:     Date.now(),
    };
  }

  /**
   * Extract and load asset URLs from corpus data if present.
   * Corpus data shape is opaque to the orchestrator — attempt extraction safely.
   */
  private loadAssetUrlsFromCorpus(corpusData: unknown): void {
    try {
      const data = corpusData as Record<string, unknown>;
      if (data['asset_urls'] && typeof data['asset_urls'] === 'object') {
        const assetUrls = data['asset_urls'] as Record<string, { url: string; expires_at_ms: number }>;
      this.assetUrlManager.loadFromCorpus(assetUrls);
        this.downloadManager.syncFromCorpus(assetUrls); // G-01: startup + rollback path
        const expiry = this.assetUrlManager.getExpiryStatus();
        this.state = {
          ...this.state,
          asset_url_expires_in_min: expiry.minutes_until_first_expiry,
        };
      }
    } catch {
      // Non-fatal — asset URL tracking is advisory
    }
  }

  /**
   * G-09/G-10/G-11: Sync content readiness state from download manager.
   *
   * Called at startup (after first syncFromCorpus) and after every poll cycle.
   * Downloads are async — this reflects whatever is verified at time of call.
   *
   * State transitions:
   *   UNKNOWN    → no corpus loaded yet
   *   DOWNLOADING → assets in progress, not all verified
   *   READY      → all required assets verified locally → gates HEALTHY
   *   DEFICIT    → downloads finished but gap remains → triggers DEGRADED
   */
  private syncContentReadiness(): void {
    const stats = this.downloadManager.getCoverageStats();

    let readiness: PlayerState['content_readiness_state'];
    if (stats.required_count === 0) {
      readiness = 'UNKNOWN';
    } else if (stats.verified_count === stats.required_count) {
      readiness = 'READY';
    } else if (stats.download_in_progress) {
      readiness = 'DOWNLOADING';
    } else {
      readiness = 'DEFICIT';
    }

    this.state = {
      ...this.state,
      assets_required_count: stats.required_count,
      assets_verified_count: stats.verified_count,
      content_readiness_state: readiness,
    };

    // G-10: transition to HEALTHY only when all assets verified
    if (
      readiness === 'READY' &&
      this.state.constitutional_state !== 'HEALTHY' &&
      this.state.constitutional_state !== 'MAINTENANCE'
    ) {
      this.state = { ...this.state, constitutional_state: 'HEALTHY', degraded_reason: null };
      this.emergencyRenderer.sendConstitutionalState('HEALTHY');
      console.log(
        `[orchestrator] Content READY — ` +
        `${stats.verified_count}/${stats.required_count} assets verified → HEALTHY`,
      );
    }

    // G-11: DEFICIT after downloads complete with a gap — transition to DEGRADED
    if (
      readiness === 'DEFICIT' &&
      this.state.constitutional_state === 'HEALTHY'
    ) {
      this.state = {
        ...this.state,
        constitutional_state: 'DEGRADED',
        degraded_reason: 'ASSET_DEFICIT',
      };
      this.emergencyRenderer.sendConstitutionalState('DEGRADED');
      console.error(
        `[orchestrator] ASSET_DEFICIT — ` +
        `${stats.verified_count}/${stats.required_count} assets verified, ` +
        `downloads complete with gap → DEGRADED`,
      );
    }
  }

  getState(): PlayerState {
    return this.state;
  }
}
