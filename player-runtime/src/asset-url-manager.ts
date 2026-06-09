/**
 * Asset URL manager — tracks CDN signed URL expiry per asset.
 *
 * Problem: CloudFront signed URLs expire. During a long offline window (up to
 * 72h) the player must serve assets from local cache without hitting CDN.
 * When connectivity is restored, the player should prioritize corpus sync to
 * obtain fresh signed URLs before existing ones expire.
 *
 * Design:
 *   - Corpus payload includes asset_urls: Record<assetId, { url, expires_at }>
 *   - AssetUrlManager tracks expiry in memory (rebuilt from corpus on load)
 *   - urgentSyncRequired() returns true when any URL expires within threshold
 *   - During offline: serve assets from local disk cache, bypass CDN entirely
 *
 * URL expiry TTL policy:
 *   Corpus publisher must set signed URL expiry = autonomy_window + 2h buffer.
 *   For 72h autonomy: URLs expire at T+74h from last corpus sync.
 *   This manager enforces the contract and alerts when approaching expiry.
 *
 * Operational runbook:
 *   If urgentSyncRequired() fires: connectivity issue is blocking URL refresh.
 *   Check: player heartbeat alive? API reachable? DNS resolving?
 *   Fallback: player continues serving from local disk cache until URL refresh.
 *   After URL expiry: player must serve from local disk only (no CDN).
 */

export interface AssetUrlEntry {
  readonly asset_id: string;
  readonly url: string;
  readonly expires_at_ms: number;  // Unix ms
}

export interface UrlExpiryStatus {
  readonly any_expired: boolean;
  readonly any_expiring_soon: boolean;
  readonly minutes_until_first_expiry: number;
  readonly expired_count: number;
  readonly expiring_soon_count: number;
}

// Alert threshold: 4 hours before expiry = request urgent sync
const URGENT_THRESHOLD_MS = 4 * 60 * 60 * 1000;

export class AssetUrlManager {
  private urls: Map<string, AssetUrlEntry> = new Map();
  private readonly urgentThresholdMs: number;

  constructor(urgentThresholdMs: number = URGENT_THRESHOLD_MS) {
    this.urgentThresholdMs = urgentThresholdMs;
  }

  /** Load URL entries from corpus. Called when corpus is applied. */
  loadFromCorpus(assetUrls: Record<string, { url: string; expires_at_ms: number }>): void {
    this.urls.clear();
    for (const [asset_id, entry] of Object.entries(assetUrls)) {
      this.urls.set(asset_id, { asset_id, url: entry.url, expires_at_ms: entry.expires_at_ms });
    }
  }

  /** Get a URL for an asset. Returns null if not tracked. */
  getUrl(asset_id: string): string | null {
    return this.urls.get(asset_id)?.url ?? null;
  }

  /**
   * Returns true if any URL expires within the urgent threshold.
   * This signals the orchestrator to prioritize corpus sync over normal interval.
   */
  urgentSyncRequired(): boolean {
    const now = Date.now();
    for (const entry of this.urls.values()) {
      if (entry.expires_at_ms - now < this.urgentThresholdMs) return true;
    }
    return false;
  }

  /** Full expiry status for health reporting and heartbeat payload. */
  getExpiryStatus(): UrlExpiryStatus {
    const now = Date.now();
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let minExpiryMs = Infinity;

    for (const entry of this.urls.values()) {
      const msUntilExpiry = entry.expires_at_ms - now;
      if (msUntilExpiry < 0) {
        expiredCount++;
      } else if (msUntilExpiry < this.urgentThresholdMs) {
        expiringSoonCount++;
      }
      if (msUntilExpiry < minExpiryMs) minExpiryMs = msUntilExpiry;
    }

    return {
      any_expired: expiredCount > 0,
      any_expiring_soon: expiringSoonCount > 0,
      minutes_until_first_expiry: this.urls.size > 0
        ? Math.floor(Math.max(0, minExpiryMs) / 60_000)
        : -1,
      expired_count: expiredCount,
      expiring_soon_count: expiringSoonCount,
    };
  }

  /** Total tracked URLs (for heartbeat reporting). */
  count(): number {
    return this.urls.size;
  }
}
