/**
 * Asset manager — pre-downloads media_url assets from data JSONB for 72h offline autonomy.
 *
 * BL-043 + hardening (FM-08, FM-09, H-CHR-01):
 *
 * - 5s download timeout (FM-08: flaky venue WiFi must not stall render loop)
 * - Streaming SHA-256 hash verification against media_hash from card data (FM-09)
 * - Boot-time integrity scan: purge .tmp fragments + zero-byte corruption
 * - Fallback image: if download fails and no cached copy, substitute local fallback
 * - Idempotent: existing files verified by size > 0 (+ hash if available)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

/** Pi-side download timeout — aggressive to keep render loop responsive. */
const DOWNLOAD_TIMEOUT_MS = 5_000;

/** Fallback image filename — must exist in ASSET_DIR for fallback to work. */
const FALLBACK_FILENAME = 'fallback-default.webp';

export interface AssetSyncStats {
  required: number;   // total media_url fields found in corpus
  verified: number;   // successfully cached on disk
  downloaded: number; // newly downloaded this cycle
  failed: number;     // failed downloads this cycle
}

interface DataItem {
  readonly content_id: string;
  readonly data?: Record<string, unknown>;
}

/**
 * Scan a data object for `media_url` string values.
 * Also extracts `media_hash` if present (SHA-256 of file bytes for integrity check).
 */
function findMediaUrls(data: Record<string, unknown> | undefined): { key: string; url: string; hash: string | null }[] {
  if (!data) return [];
  const results: { key: string; url: string; hash: string | null }[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === 'media_url' && typeof val === 'string' && val.startsWith('http')) {
      const hash = typeof data['media_hash'] === 'string' ? data['media_hash'] as string : null;
      results.push({ key, url: val, hash });
    }
  }
  return results;
}

/** SHA-256 hash of a URL string, used as the local filename. */
function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex');
}

/** Extract file extension from a URL (default: 'bin'). */
function extractExt(url: string): string {
  try {
    // Strip query params before extracting extension (Bunny Optimizer adds ?width=&format=)
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).slice(1).toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'svg'];
    return allowed.includes(ext) ? ext : 'bin';
  } catch {
    return 'bin';
  }
}

export class AssetManager {
  private readonly assetDir: string;
  private readonly fallbackPath: string;

  constructor(assetDir: string) {
    this.assetDir = assetDir;
    this.fallbackPath = path.join(assetDir, FALLBACK_FILENAME);
    fs.mkdirSync(assetDir, { recursive: true });
  }

  /**
   * Boot-time integrity scan — call once at player startup.
   *
   * Purges:
   * - .tmp fragments from interrupted downloads (FM-09)
   * - Zero-byte files from power-cut during ext4 metadata commit
   */
  bootIntegrityScan(): void {
    console.log('[asset-manager] Boot integrity scan starting...');
    let purged = 0;

    try {
      const files = fs.readdirSync(this.assetDir);

      for (const file of files) {
        // Never purge the fallback image
        if (file === FALLBACK_FILENAME) continue;

        const fullPath = path.join(this.assetDir, file);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue; // race: file removed between readdir and stat
        }

        // Purge orphaned .tmp files from interrupted downloads
        if (file.endsWith('.tmp')) {
          console.warn(`[asset-manager] Boot scan: purging orphaned tmp: ${file}`);
          fs.unlinkSync(fullPath);
          purged++;
          continue;
        }

        // Purge zero-byte files (power-cut corruption)
        if (stat.size === 0) {
          console.error(`[asset-manager] Boot scan: purging zero-byte file: ${file}`);
          fs.unlinkSync(fullPath);
          purged++;
          continue;
        }
      }

      console.log(`[asset-manager] Boot scan complete: ${purged} files purged, directory clean.`);
    } catch (err) {
      console.error(`[asset-manager] Boot scan error (non-fatal): ${String(err)}`);
    }
  }

  /**
   * Scan all items for media_url fields, download missing assets, substitute local paths.
   */
  async syncAssets<T extends DataItem>(items: T[]): Promise<{ items: T[]; stats: AssetSyncStats }> {
    const stats: AssetSyncStats = { required: 0, verified: 0, downloaded: 0, failed: 0 };
    const result: T[] = [];

    for (const item of items) {
      const mediaUrls = findMediaUrls(item.data);

      if (mediaUrls.length === 0) {
        result.push(item);
        continue;
      }

      const modifiedData = { ...item.data! };

      for (const { key, url, hash: expectedHash } of mediaUrls) {
        stats.required++;
        const urlHash = hashUrl(url);
        const ext = extractExt(url);
        const localFilename = `${urlHash}.${ext}`;
        const localPath = path.join(this.assetDir, localFilename);

        // Cache hit: file exists and is non-zero
        if (fs.existsSync(localPath)) {
          const stat = fs.statSync(localPath);
          if (stat.size > 0) {
            // If we have an expected hash, verify on first access
            if (expectedHash && !this.verifyFileHash(localPath, expectedHash)) {
              console.warn(`[asset-manager] Hash mismatch on cached file: ${localFilename} — re-downloading`);
              fs.unlinkSync(localPath);
              // Fall through to download
            } else {
              stats.verified++;
              modifiedData[key] = localPath;
              continue;
            }
          } else {
            // Zero-byte file — corrupted, purge and re-download
            fs.unlinkSync(localPath);
          }
        }

        // Download the asset
        try {
          const contentHash = await this.downloadFile(url, localPath);

          // Verify hash if expected (FM-09: corrupted hash rejection)
          if (expectedHash && contentHash !== expectedHash) {
            console.error(
              `[asset-manager] HASH_MISMATCH: expected=${expectedHash} got=${contentHash} — purging ${localFilename}`,
            );
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
            throw new Error(`HASH_MISMATCH`);
          }

          stats.verified++;
          stats.downloaded++;
          modifiedData[key] = localPath;
          console.log(`[asset-manager] Downloaded: ${url} → ${localFilename} (${contentHash.slice(0, 12)})`);
        } catch (err) {
          stats.failed++;
          // Substitute fallback image if available, otherwise preserve original URL
          const fallback = this.getFallbackPath();
          if (fallback) {
            modifiedData[key] = fallback;
            console.warn(`[asset-manager] Download failed, using fallback: ${url} — ${String(err)}`);
          } else {
            // No fallback image — preserve remote URL (will fail if offline)
            console.warn(`[asset-manager] Download failed, no fallback: ${url} — ${String(err)}`);
          }
        }
      }

      result.push({ ...item, data: modifiedData } as T);
    }

    if (stats.required > 0) {
      console.log(
        `[asset-manager] Sync complete: ${stats.verified}/${stats.required} cached, ` +
        `${stats.downloaded} new, ${stats.failed} failed`,
      );
    }

    return { items: result, stats };
  }

  /**
   * Sync assets across all zones in a resolved playlist.
   */
  async syncZones<T extends DataItem>(
    zones: Record<string, T[]>,
  ): Promise<{ zones: Record<string, T[]>; stats: AssetSyncStats }> {
    const combinedStats: AssetSyncStats = { required: 0, verified: 0, downloaded: 0, failed: 0 };
    const result: Record<string, T[]> = {};

    for (const [zoneName, items] of Object.entries(zones)) {
      const { items: synced, stats } = await this.syncAssets(items);
      result[zoneName] = synced;
      combinedStats.required += stats.required;
      combinedStats.verified += stats.verified;
      combinedStats.downloaded += stats.downloaded;
      combinedStats.failed += stats.failed;
    }

    return { zones: result, stats: combinedStats };
  }

  /**
   * Download a file with streaming SHA-256 hash calculation.
   * Returns the content hash of the downloaded file.
   */
  private async downloadFile(url: string, destPath: string): Promise<string> {
    const tempPath = destPath + '.tmp';

    const response = await fetch(url, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    // Stream to disk while computing SHA-256 hash simultaneously
    const hasher = crypto.createHash('sha256');
    const hashTransform = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hasher.update(chunk);
        callback(null, chunk);
      },
    });

    const writeStream = fs.createWriteStream(tempPath);
    await pipeline(
      Readable.fromWeb(response.body as any),
      hashTransform,
      writeStream,
    );

    const contentHash = hasher.digest('hex');

    // Atomic rename — safe on ext4 for same-filesystem moves
    fs.renameSync(tempPath, destPath);

    return contentHash;
  }

  /** Verify a file's SHA-256 hash matches expected. */
  private verifyFileHash(filePath: string, expectedHash: string): boolean {
    try {
      const data = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      return hash === expectedHash;
    } catch {
      return false;
    }
  }

  /** Get fallback image path if it exists on disk. */
  private getFallbackPath(): string | null {
    try {
      if (fs.existsSync(this.fallbackPath) && fs.statSync(this.fallbackPath).size > 0) {
        return this.fallbackPath;
      }
    } catch { /* ignore */ }
    return null;
  }
}
