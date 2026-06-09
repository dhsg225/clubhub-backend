/**
 * Asset download manager — downloads and verifies media assets for local playback.
 *
 * Implements ADR-002 constitutional requirement:
 *   "Only items with verified local asset paths enter playlist enrichment."
 *
 * Lifecycle per corpus apply:
 *   1. syncFromCorpus() called — receives asset_id → CDN URL map from corpus
 *   2. Already-present assets verified synchronously (fast path — avoids re-download)
 *   3. Missing or invalid assets downloaded from CDN URL to asset_dir/{asset_id}
 *   4. AssetVerifier.verify() called after each download — failure discards file
 *   5. Verified assets registered: content_id → absolute filesystem path
 *
 * Enrichment contract:
 *   getLocalPath(content_id) returns a verified local path or null.
 *   Null means the asset is not ready for playback — do not include in playlist.
 *   This is the pre-enrichment gate: only non-null returns enter enrichment.
 *
 * Threading model:
 *   syncFromCorpus() returns immediately. Downloads run in background via void promise.
 *   The registry is updated as each asset is verified — enrichment always sees a
 *   consistent snapshot of what is currently available, which grows over time.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type { AssetVerifier } from './asset-verifier.js';

export interface AssetCoverageStats {
  readonly required_count: number;
  readonly verified_count: number;
  readonly download_in_progress: boolean;
}

export class AssetDownloadManager {
  private readonly assetDir: string;
  private readonly assetVerifier: AssetVerifier;
  // Registry: content_id → absolute filesystem path (verified assets only)
  private readonly registry: Map<string, string> = new Map();
  private requiredCount = 0;
  private downloadInProgress = false;

  constructor(assetDir: string, assetVerifier: AssetVerifier) {
    this.assetDir = assetDir;
    this.assetVerifier = assetVerifier;
    fs.mkdirSync(assetDir, { recursive: true });
  }

  /**
   * Reconcile local asset state against a new corpus version.
   *
   * Synchronous phase: checks each asset_id already on disk and adds verified
   * assets to the registry immediately — no network required.
   *
   * Background phase: downloads missing or invalid assets sequentially.
   * Does not block the corpus/playlist polling loop.
   *
   * Purges registry entries whose asset_ids are no longer in the corpus.
   */
  syncFromCorpus(
    assetUrls: Record<string, { url: string; expires_at_ms: number }>,
  ): void {
    const entries = Object.entries(assetUrls);
    this.requiredCount = entries.length;

    const toDownload: Array<{ asset_id: string; url: string }> = [];

    // Synchronous verification pass — fast path for already-present assets
    for (const [asset_id, { url }] of entries) {
      const result = this.assetVerifier.verify(asset_id);
      if (result.present && result.checksum_valid) {
        this.registry.set(asset_id, result.path);
      } else {
        this.registry.delete(asset_id);
        toDownload.push({ asset_id, url });
      }
    }

    // Remove registry entries no longer referenced by this corpus version
    const corpusIds = new Set(Object.keys(assetUrls));
    for (const id of this.registry.keys()) {
      if (!corpusIds.has(id)) this.registry.delete(id);
    }

    if (toDownload.length === 0) {
      console.log(
        `[asset-download] All ${this.requiredCount} assets verified locally`,
      );
      return;
    }

    console.log(
      `[asset-download] ${toDownload.length}/${this.requiredCount} assets queued for download`,
    );

    this.downloadInProgress = true;
    void this.downloadAll(toDownload).finally(() => {
      this.downloadInProgress = false;
      console.log(
        `[asset-download] Download pass complete — ` +
        `${this.registry.size}/${this.requiredCount} assets verified`,
      );
    });
  }

  /**
   * Returns the verified local filesystem path for a content_id, or null.
   *
   * This is the sole query method for the pre-enrichment gate.
   * A null return means the asset is not yet ready — exclude from enrichment.
   * A non-null return guarantees the file existed and passed verification at
   * the time it was added to the registry.
   */
  getLocalPath(contentId: string): string | null {
    return this.registry.get(contentId) ?? null;
  }

  getCoverageStats(): AssetCoverageStats {
    return {
      required_count: this.requiredCount,
      verified_count: this.registry.size,
      download_in_progress: this.downloadInProgress,
    };
  }

  private async downloadAll(
    queue: Array<{ asset_id: string; url: string }>,
  ): Promise<void> {
    for (const { asset_id, url } of queue) {
      try {
        await this.downloadOne(asset_id, url);

        // Verify after download — only register on pass
        const result = this.assetVerifier.verify(asset_id);
        if (result.present && result.checksum_valid) {
          this.registry.set(asset_id, result.path);
          console.log(`[asset-download] Verified asset_id=${asset_id}`);
        } else {
          console.error(
            `[asset-download] Verification failed after download ` +
            `asset_id=${asset_id} present=${result.present} valid=${result.checksum_valid}`,
          );
        }
      } catch (err) {
        console.error(
          `[asset-download] Download failed asset_id=${asset_id}: ${String(err)}`,
        );
      }
    }
  }

  /**
   * Download a single asset from url to asset_dir/{assetId}.
   * Writes to a .tmp file first; atomic rename on success.
   * Cleans up the temp file on any error.
   */
  private async downloadOne(assetId: string, url: string): Promise<void> {
    const destPath = path.join(this.assetDir, assetId);
    const tmpPath = `${destPath}.tmp`;

    // 5-minute timeout — sufficient for large video files on typical venue WAN
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for asset_id=${assetId}`);
    }
    if (!response.body) {
      throw new Error(`No response body for asset_id=${assetId}`);
    }

    const fileStream = fs.createWriteStream(tmpPath);
    try {
      // Readable.fromWeb bridges the Web ReadableStream API to Node stream pipeline
      await pipeline(
        Readable.fromWeb(
          response.body as Parameters<typeof Readable.fromWeb>[0],
        ),
        fileStream,
      );
    } catch (err) {
      fileStream.destroy();
      try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup error */ }
      throw err;
    }

    // Atomic promotion: tmp → dest
    fs.renameSync(tmpPath, destPath);
    console.log(`[asset-download] Downloaded asset_id=${assetId}`);
  }
}
