import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CorpusStore } from '../corpus-store.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CorpusPackage } from '@clubhub/corpus-schema';
import { computeCorpusChecksum } from '@clubhub/corpus-schema';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'corpus-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeValidPackage(): CorpusPackage {
  const corpus = {
    venue_id: 'venue-001',
    campaigns: [],
    schedules: [],
    overrides: [],
    emergency_slots: [],
    compliance_slots: [],
  };
  return {
    version: 'v1.0.0',
    venue_id: 'venue-001',
    created_at: Date.now(),
    corpus,
    checksum: computeCorpusChecksum(corpus),
  };
}

describe('CorpusStore', () => {
  it('returns null when no corpus exists', async () => {
    const store = new CorpusStore(tmpDir);
    const result = await store.load();
    expect(result).toBeNull();
  });

  it('applies and retrieves a valid corpus package', async () => {
    const store = new CorpusStore(tmpDir);
    const pkg = makeValidPackage();
    const ok = await store.apply(pkg);
    expect(ok).toBe(true);
    expect(store.getCurrent()?.version).toBe('v1.0.0');
  });

  it('rejects a corpus package with invalid checksum', async () => {
    const store = new CorpusStore(tmpDir);
    const pkg = makeValidPackage();
    const tampered = { ...pkg, checksum: '00000000' }; // bad checksum
    const ok = await store.apply(tampered);
    expect(ok).toBe(false);
  });
});
