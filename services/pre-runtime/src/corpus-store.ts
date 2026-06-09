/**
 * Local corpus store for Pi player.
 *
 * Constitutional:
 * - Never applies corpus without checksum verification
 * - Atomic apply: write temp → verify → rename (never partial corpus)
 * - Keeps last-known-good corpus as fallback
 */
import { validateCorpusPackage } from '@clubhub/corpus-schema';
import type { CorpusPackage } from '@clubhub/corpus-schema';
import { emit, base } from '@clubhub/telemetry-sdk';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class CorpusStore {
  private currentCorpus: CorpusPackage | null = null;
  private readonly corpusPath: string;
  private readonly tempPath: string;

  constructor(private readonly dataDir: string) {
    this.corpusPath = path.join(dataDir, 'corpus.json');
    this.tempPath = path.join(dataDir, 'corpus.json.tmp');
  }

  async load(): Promise<CorpusPackage | null> {
    try {
      const raw = await fs.readFile(this.corpusPath, 'utf-8');
      const pkg = JSON.parse(raw) as CorpusPackage;
      const { valid, errors } = validateCorpusPackage(pkg);
      if (!valid) {
        emit({ ...base('ERROR', 'corpus_store.load_invalid'), errors } as Parameters<typeof emit>[0]);
        return null;
      }
      this.currentCorpus = pkg;
      return pkg;
    } catch {
      return null; // no corpus yet
    }
  }

  async apply(pkg: CorpusPackage): Promise<boolean> {
    // Validate before writing
    const { valid, errors } = validateCorpusPackage(pkg);
    if (!valid) {
      emit({ ...base('ERROR', 'corpus_store.apply_rejected'), errors } as Parameters<typeof emit>[0]);
      return false;
    }

    try {
      // Atomic: write to temp, verify, rename
      await fs.writeFile(this.tempPath, JSON.stringify(pkg, null, 0));
      const verifyRaw = await fs.readFile(this.tempPath, 'utf-8');
      const verified = JSON.parse(verifyRaw) as CorpusPackage;
      const { valid: verifyOk } = validateCorpusPackage(verified);
      if (!verifyOk) {
        emit({ ...base('ERROR', 'corpus_store.verify_failed'), version: pkg.version } as Parameters<typeof emit>[0]);
        return false;
      }
      await fs.rename(this.tempPath, this.corpusPath);
      this.currentCorpus = pkg;
      emit({ ...base('INFO', 'corpus_store.applied'), version: pkg.version, checksum: pkg.checksum } as Parameters<typeof emit>[0]);
      return true;
    } catch (err: unknown) {
      emit({ ...base('ERROR', 'corpus_store.apply_error'), error: String(err) } as Parameters<typeof emit>[0]);
      return false;
    }
  }

  getCurrent(): CorpusPackage | null {
    return this.currentCorpus;
  }
}
