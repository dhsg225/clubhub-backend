/**
 * Offline corpus cache — three-snapshot rotation.
 *
 * Snapshot files on disk:
 *   corpus.current.json  — actively serving corpus
 *   corpus.previous.json — one version back (recovery fallback)
 *   corpus.factory.json  — commissioning baseline (never overwritten after first write)
 *
 * Apply sequence (transactional):
 *   1. Write new corpus to corpus.next.json (staging)
 *   2. Verify corpus.next.json checksum
 *   3. Rotate: current → previous  (overwrites previous)
 *   4. Rename: next → current      (atomic)
 *
 * Load sequence (fallback chain):
 *   Try current → verify → OK
 *   Try previous → verify → OK (logs WARN, observability hook fires)
 *   Try factory  → verify → OK (logs ERROR, observability hook fires)
 *   Return null  → player has no corpus at all
 *
 * Constitutional rule: corpus checksum verified on every read and write.
 * Never serve a corpus whose checksum does not match.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fnv1a32, canonicalizeJson } from '@clubhub/fnv-checksum';
import type { CorpusCache } from './types.js';

const CURRENT_FILE  = 'corpus.current.json';
const PREVIOUS_FILE = 'corpus.previous.json';
const FACTORY_FILE  = 'corpus.factory.json';
const STAGING_FILE  = 'corpus.next.json';

export type CorpusLoadSource = 'current' | 'previous' | 'factory';

export interface CorpusLoadResult {
  readonly corpus: CorpusCache;
  readonly source: CorpusLoadSource;
}

export class CorpusCacheManager {
  private readonly cacheDir: string;
  private current: CorpusCache | null = null;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  /**
   * Load cached corpus from disk using fallback chain.
   * Returns null only when all three snapshots are missing or corrupt.
   * Observability: logs source so fleet dashboard can detect degraded load.
   */
  load(): CorpusLoadResult | null {
    const result = this.tryLoad(CURRENT_FILE, 'current')
      ?? this.tryLoad(PREVIOUS_FILE, 'previous')
      ?? this.tryLoad(FACTORY_FILE, 'factory');

    if (!result) {
      console.error('[corpus-cache] CRITICAL: no valid corpus snapshot found (current/previous/factory all absent or corrupt)');
      return null;
    }

    if (result.source !== 'current') {
      console.error(`[corpus-cache] DEGRADED LOAD: serving from ${result.source} snapshot — current snapshot is corrupt or absent`);
    }

    this.current = result.corpus;
    return result;
  }

  /**
   * Atomically apply a new corpus using staging → verify → rotate → promote.
   *
   * Failure model:
   *   - If staging write fails:    no disk state changed, old corpus intact.
   *   - If staging verify fails:   staging file deleted, old corpus intact.
   *   - If rotate fails mid-way:   worst case: previous is overwritten but
   *                                 current is intact. Factory untouched.
   *   - If promote (rename) fails: staging file left on disk (safe — ignored
   *                                 on next load). Old corpus intact.
   *
   * Power loss during rename: on Linux, rename(2) is atomic within a filesystem.
   * SD card write of the rename journal entry may be lost, but the file either
   * fully exists at its new path or does not. No partial state.
   */
  apply(corpus: CorpusCache): void {
    if (!this.verifyChecksum(corpus)) {
      throw new Error(
        `[corpus-cache] Refusing to apply corpus with invalid checksum: ${corpus.checksum}`
      );
    }

    const stagingPath  = path.join(this.cacheDir, STAGING_FILE);
    const currentPath  = path.join(this.cacheDir, CURRENT_FILE);
    const previousPath = path.join(this.cacheDir, PREVIOUS_FILE);

    // Step 1: Write to staging
    const stagingContent = JSON.stringify(corpus, null, 2);
    fs.writeFileSync(stagingPath, stagingContent, 'utf-8');

    // Step 2: Verify staging (defense-in-depth against corrupted write)
    const writtenBack = JSON.parse(fs.readFileSync(stagingPath, 'utf-8')) as CorpusCache;
    if (!this.verifyChecksum(writtenBack)) {
      try { fs.unlinkSync(stagingPath); } catch { /* best effort */ }
      throw new Error('[corpus-cache] Staging file integrity check failed — aborting apply, old corpus intact');
    }

    // Step 3: Rotate current → previous (if current exists)
    if (fs.existsSync(currentPath)) {
      fs.renameSync(currentPath, previousPath);
    }

    // Step 4: Promote staging → current (atomic rename)
    fs.renameSync(stagingPath, currentPath);

    this.current = corpus;
    console.log(
      `[corpus-cache] Applied version=${corpus.corpus_version_id} checksum=${corpus.checksum}`
    );
  }

  /**
   * Write the factory baseline. Called once at commissioning.
   * Refuses to overwrite an existing factory snapshot — factory is permanent.
   */
  writeFactory(corpus: CorpusCache): void {
    const factoryPath = path.join(this.cacheDir, FACTORY_FILE);
    if (fs.existsSync(factoryPath)) {
      console.warn('[corpus-cache] Factory snapshot already exists — not overwriting');
      return;
    }
    if (!this.verifyChecksum(corpus)) {
      throw new Error('[corpus-cache] Cannot write factory snapshot: checksum mismatch');
    }
    fs.writeFileSync(factoryPath, JSON.stringify(corpus, null, 2), 'utf-8');
    console.log(`[corpus-cache] Factory snapshot written version=${corpus.corpus_version_id}`);
  }

  getCurrent(): CorpusCache | null {
    return this.current;
  }

  /** Load and return the previous snapshot without applying it. Returns null if absent. */
  getPrevious(): CorpusCache | null {
    const result = this.tryLoad(PREVIOUS_FILE, 'previous');
    return result?.corpus ?? null;
  }

  /** Returns true if corpus is within the 72h autonomy window. */
  isWithinAutonomyWindow(autonomyWindowMs: number): boolean {
    if (!this.current) return false;
    const age = Date.now() - this.current.fetched_at;
    return age < autonomyWindowMs;
  }

  /** Returns age in ms of the current corpus. -1 if no corpus loaded. */
  getCurrentAgeMs(): number {
    if (!this.current) return -1;
    return Date.now() - this.current.fetched_at;
  }

  /** Returns which snapshots exist on disk (for health reporting). */
  snapshotStatus(): { current: boolean; previous: boolean; factory: boolean } {
    return {
      current:  fs.existsSync(path.join(this.cacheDir, CURRENT_FILE)),
      previous: fs.existsSync(path.join(this.cacheDir, PREVIOUS_FILE)),
      factory:  fs.existsSync(path.join(this.cacheDir, FACTORY_FILE)),
    };
  }

  private tryLoad(filename: string, source: CorpusLoadSource): CorpusLoadResult | null {
    const filePath = path.join(this.cacheDir, filename);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as CorpusCache;
      if (!this.verifyChecksum(parsed)) {
        console.error(`[corpus-cache] Checksum mismatch on ${filename} — rejecting`);
        return null;
      }
      return { corpus: parsed, source };
    } catch {
      return null;
    }
  }

  private verifyChecksum(corpus: CorpusCache): boolean {
    const { checksum, corpus_data } = corpus;
    const computed = fnv1a32(canonicalizeJson(corpus_data)).toString(16).padStart(8, '0');
    return checksum === computed;
  }
}
