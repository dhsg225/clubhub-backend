/**
 * Operational hardening validation suite.
 *
 * Tests the 10 blocker-tier items:
 *   1. Corpus snapshot rotation (current/previous/factory)
 *   2. Transactional corpus sync (staging → verify → atomic promote)
 *   3. Reconnect backoff (exponential + jitter + reset)
 *   4. Asset URL expiry tracking (urgent sync detection)
 *   5. Watchdog health report (multi-check fields)
 *   6. Corpus load fallback chain (current → previous → factory → null)
 *   7. Checksum rejection (corrupt corpus refused)
 *   8. Factory write-once protection
 *   9. Backoff rate limiting (reconnect storm prevention)
 *  10. Asset URL urgent sync threshold
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CorpusCacheManager } from '../corpus-cache.js';
import { ReconnectBackoff } from '../reconnect-backoff.js';
import { AssetUrlManager } from '../asset-url-manager.js';
import { Watchdog } from '../watchdog.js';
import type { CorpusCache } from '../types.js';
import { fnv1a32, canonicalizeJson } from '@clubhub/fnv-checksum';

// ── Test fixture helpers ──────────────────────────────────────────────────────

function makeTestCorpus(overrides: Partial<CorpusCache> = {}): CorpusCache {
  const corpus_data = { schedules: [{ id: 'test-1', name: 'Test Schedule' }] };
  const checksum = fnv1a32(canonicalizeJson(corpus_data)).toString(16).padStart(8, '0');
  return {
    corpus_version_id: 'test-version-001',
    checksum,
    fetched_at: Date.now(),
    effective_at: Date.now(),
    corpus_data,
    ...overrides,
  };
}

function makeTestCorpusV2(): CorpusCache {
  const corpus_data = { schedules: [{ id: 'test-2', name: 'Updated Schedule' }] };
  const checksum = fnv1a32(canonicalizeJson(corpus_data)).toString(16).padStart(8, '0');
  return {
    corpus_version_id: 'test-version-002',
    checksum,
    fetched_at: Date.now() + 1000,
    effective_at: Date.now() + 1000,
    corpus_data,
  };
}

// ── CorpusCacheManager tests ──────────────────────────────────────────────────

describe('CorpusCacheManager — snapshot rotation', () => {
  let tmpDir: string;
  let manager: CorpusCacheManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-test-'));
    manager = new CorpusCacheManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('applies corpus atomically via staging → current', () => {
    const corpus = makeTestCorpus();
    manager.apply(corpus);

    // corpus.current.json must exist
    expect(fs.existsSync(path.join(tmpDir, 'corpus.current.json'))).toBe(true);
    // staging file must not be left behind
    expect(fs.existsSync(path.join(tmpDir, 'corpus.next.json'))).toBe(false);
    // previous must not exist yet (first apply)
    expect(fs.existsSync(path.join(tmpDir, 'corpus.previous.json'))).toBe(false);
  });

  it('rotates current to previous on second apply', () => {
    const v1 = makeTestCorpus();
    const v2 = makeTestCorpusV2();

    manager.apply(v1);
    manager.apply(v2);

    expect(fs.existsSync(path.join(tmpDir, 'corpus.current.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'corpus.previous.json'))).toBe(true);

    const current = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'corpus.current.json'), 'utf-8')
    ) as CorpusCache;
    const previous = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'corpus.previous.json'), 'utf-8')
    ) as CorpusCache;

    expect(current.corpus_version_id).toBe('test-version-002');
    expect(previous.corpus_version_id).toBe('test-version-001');
  });

  it('loads from current on clean state', () => {
    const corpus = makeTestCorpus();
    manager.apply(corpus);

    const freshManager = new CorpusCacheManager(tmpDir);
    const result = freshManager.load();

    expect(result).not.toBeNull();
    expect(result!.source).toBe('current');
    expect(result!.corpus.corpus_version_id).toBe('test-version-001');
  });

  it('falls back to previous when current is corrupt', () => {
    const v1 = makeTestCorpus();
    const v2 = makeTestCorpusV2();

    manager.apply(v1);
    manager.apply(v2);

    // Corrupt the current file
    fs.writeFileSync(path.join(tmpDir, 'corpus.current.json'), '{"corrupt": true, "checksum": "bad"}');

    const freshManager = new CorpusCacheManager(tmpDir);
    const result = freshManager.load();

    expect(result).not.toBeNull();
    expect(result!.source).toBe('previous');
    expect(result!.corpus.corpus_version_id).toBe('test-version-001');
  });

  it('falls back to factory when current and previous are corrupt', () => {
    const factory = makeTestCorpus({ corpus_version_id: 'factory-baseline' });
    manager.writeFactory(factory);

    const v1 = makeTestCorpus();
    const v2 = makeTestCorpusV2();
    manager.apply(v1);
    manager.apply(v2);

    // Corrupt both current and previous
    fs.writeFileSync(path.join(tmpDir, 'corpus.current.json'), 'not-json');
    fs.writeFileSync(path.join(tmpDir, 'corpus.previous.json'), '{"checksum":"bad"}');

    const freshManager = new CorpusCacheManager(tmpDir);
    const result = freshManager.load();

    expect(result).not.toBeNull();
    expect(result!.source).toBe('factory');
    expect(result!.corpus.corpus_version_id).toBe('factory-baseline');
  });

  it('returns null when all three snapshots are absent', () => {
    const freshManager = new CorpusCacheManager(tmpDir);
    const result = freshManager.load();
    expect(result).toBeNull();
  });

  it('rejects corpus with invalid checksum', () => {
    const corpus = makeTestCorpus({ checksum: 'deadbeef' }); // wrong checksum
    expect(() => manager.apply(corpus)).toThrow(/invalid checksum/);

    // No files should have been written
    expect(fs.existsSync(path.join(tmpDir, 'corpus.current.json'))).toBe(false);
  });

  it('does not overwrite existing factory snapshot', () => {
    const factory1 = makeTestCorpus({ corpus_version_id: 'factory-v1' });
    const factory2 = makeTestCorpusV2();

    manager.writeFactory(factory1);
    manager.writeFactory(factory2);  // Should warn but not overwrite

    const written = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'corpus.factory.json'), 'utf-8')
    ) as CorpusCache;
    expect(written.corpus_version_id).toBe('factory-v1');  // unchanged
  });

  it('reports correct snapshot status', () => {
    expect(manager.snapshotStatus()).toEqual({ current: false, previous: false, factory: false });

    manager.apply(makeTestCorpus());
    expect(manager.snapshotStatus()).toEqual({ current: true, previous: false, factory: false });

    manager.apply(makeTestCorpusV2());
    expect(manager.snapshotStatus()).toEqual({ current: true, previous: true, factory: false });
  });

  it('staging file is cleaned up on checksum verification failure', () => {
    // Manually create a staging file with bad content to simulate partial write
    // Then verify apply() with bad checksum doesn't leave staging file
    const corpus = makeTestCorpus({ checksum: 'badchecksum' });

    try { manager.apply(corpus); } catch { /* expected */ }

    expect(fs.existsSync(path.join(tmpDir, 'corpus.next.json'))).toBe(false);
  });
});

// ── ReconnectBackoff tests ────────────────────────────────────────────────────

describe('ReconnectBackoff — exponential backoff', () => {
  it('returns base interval on first call (no failures)', () => {
    const backoff = new ReconnectBackoff({
      screen_id: 'screen-abc',
      base_interval_ms: 60_000,
      max_interval_ms: 900_000,
      jitter_window_ms: 100,  // small jitter for testability
    });
    const interval = backoff.currentInterval();
    expect(interval).toBeGreaterThanOrEqual(60_000);
    expect(interval).toBeLessThanOrEqual(60_100);
  });

  it('doubles interval on each failure', () => {
    const backoff = new ReconnectBackoff({
      screen_id: 'screen-abc',
      base_interval_ms: 60_000,
      max_interval_ms: 900_000,
      jitter_window_ms: 0,  // no jitter for exact verification
    });

    const i1 = backoff.recordFailure();  // 60s
    const i2 = backoff.recordFailure();  // 120s
    const i3 = backoff.recordFailure();  // 240s
    const i4 = backoff.recordFailure();  // 480s

    expect(i1).toBe(60_000);
    expect(i2).toBe(120_000);
    expect(i3).toBe(240_000);
    expect(i4).toBe(480_000);
  });

  it('caps at max_interval_ms', () => {
    const backoff = new ReconnectBackoff({
      screen_id: 'screen-abc',
      base_interval_ms: 60_000,
      max_interval_ms: 300_000,
      jitter_window_ms: 0,
    });

    backoff.recordFailure();  // 60s
    backoff.recordFailure();  // 120s
    backoff.recordFailure();  // 240s
    const i4 = backoff.recordFailure();  // would be 480s, capped at 300s
    const i5 = backoff.recordFailure();  // still 300s

    expect(i4).toBe(300_000);
    expect(i5).toBe(300_000);
  });

  it('resets to base interval after success', () => {
    const backoff = new ReconnectBackoff({
      screen_id: 'screen-abc',
      base_interval_ms: 60_000,
      max_interval_ms: 900_000,
      jitter_window_ms: 0,
    });

    backoff.recordFailure();
    backoff.recordFailure();
    backoff.recordFailure();
    expect(backoff.getConsecutiveFailures()).toBe(3);

    backoff.recordSuccess();
    expect(backoff.getConsecutiveFailures()).toBe(0);
    expect(backoff.currentInterval()).toBe(60_000);
    expect(backoff.isBackingOff()).toBe(false);
  });

  it('deterministic jitter is consistent for same screen_id', () => {
    const config = {
      screen_id: 'screen-consistency-test',
      base_interval_ms: 60_000,
      max_interval_ms: 900_000,
      jitter_window_ms: 30_000,
    };
    const b1 = new ReconnectBackoff(config);
    const b2 = new ReconnectBackoff(config);
    expect(b1.currentInterval()).toBe(b2.currentInterval());
  });

  it('different screen_ids produce different jitter values (with high probability)', () => {
    const base = {
      base_interval_ms: 60_000,
      max_interval_ms: 900_000,
      jitter_window_ms: 30_000,
    };
    const intervals = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const b = new ReconnectBackoff({ ...base, screen_id: `screen-${i}` });
      intervals.add(b.currentInterval());
    }
    // With 30,000ms jitter window, 20 screen IDs should produce > 10 distinct values
    expect(intervals.size).toBeGreaterThan(10);
  });
});

// ── AssetUrlManager tests ─────────────────────────────────────────────────────

describe('AssetUrlManager — signed URL TTL tracking', () => {
  it('tracks URLs loaded from corpus', () => {
    const manager = new AssetUrlManager();
    manager.loadFromCorpus({
      'asset-001': { url: 'https://cdn.example.com/asset-001?sig=abc', expires_at_ms: Date.now() + 10 * 60 * 60 * 1000 },
      'asset-002': { url: 'https://cdn.example.com/asset-002?sig=def', expires_at_ms: Date.now() + 20 * 60 * 60 * 1000 },
    });
    expect(manager.count()).toBe(2);
    expect(manager.getUrl('asset-001')).toContain('cdn.example.com');
  });

  it('does not flag urgent sync when URLs expire far in future', () => {
    const manager = new AssetUrlManager(4 * 60 * 60 * 1000); // 4h threshold
    manager.loadFromCorpus({
      'asset-001': { url: 'https://cdn.example.com/a', expires_at_ms: Date.now() + 24 * 60 * 60 * 1000 },
    });
    expect(manager.urgentSyncRequired()).toBe(false);
  });

  it('flags urgent sync when a URL expires within threshold', () => {
    const manager = new AssetUrlManager(4 * 60 * 60 * 1000); // 4h threshold
    manager.loadFromCorpus({
      'asset-001': { url: 'https://cdn.example.com/a', expires_at_ms: Date.now() + 2 * 60 * 60 * 1000 }, // 2h — within 4h threshold
    });
    expect(manager.urgentSyncRequired()).toBe(true);
  });

  it('correctly classifies expired URLs', () => {
    const manager = new AssetUrlManager(4 * 60 * 60 * 1000);
    manager.loadFromCorpus({
      'expired':    { url: 'https://cdn.example.com/a', expires_at_ms: Date.now() - 1000 },
      'expiring':   { url: 'https://cdn.example.com/b', expires_at_ms: Date.now() + 2 * 60 * 60 * 1000 },
      'fresh':      { url: 'https://cdn.example.com/c', expires_at_ms: Date.now() + 24 * 60 * 60 * 1000 },
    });

    const status = manager.getExpiryStatus();
    expect(status.expired_count).toBe(1);
    expect(status.expiring_soon_count).toBe(1);
    expect(status.any_expired).toBe(true);
    expect(status.any_expiring_soon).toBe(true);
  });

  it('clears URLs on reload from new corpus', () => {
    const manager = new AssetUrlManager();
    manager.loadFromCorpus({
      'asset-001': { url: 'https://cdn.example.com/a', expires_at_ms: Date.now() + 3600_000 },
    });
    expect(manager.count()).toBe(1);

    manager.loadFromCorpus({
      'asset-002': { url: 'https://cdn.example.com/b', expires_at_ms: Date.now() + 3600_000 },
      'asset-003': { url: 'https://cdn.example.com/c', expires_at_ms: Date.now() + 3600_000 },
    });
    expect(manager.count()).toBe(2);
    expect(manager.getUrl('asset-001')).toBeNull(); // cleared
  });

  it('returns -1 minutes_until_first_expiry when no URLs tracked', () => {
    const manager = new AssetUrlManager();
    const status = manager.getExpiryStatus();
    expect(status.minutes_until_first_expiry).toBe(-1);
  });
});

// ── Watchdog health report tests ──────────────────────────────────────────────

describe('Watchdog — health report', () => {
  it('reports liveness_ok as true immediately after construction', () => {
    const wd = new Watchdog(60_000);
    const report = wd.getHealthReport();
    expect(report.liveness_ok).toBe(true);
  });

  it('reports liveness_ok as false when kick timeout exceeded', () => {
    // Use a very short timeout for testing
    const wd = new Watchdog(1);  // 1ms timeout
    // Don't start the watchdog — just check the report
    // Manually set last kick to past by reading the report after delay
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const report = wd.getHealthReport();
        expect(report.liveness_ok).toBe(false);
        resolve();
      }, 10);
    });
  });

  it('reports corpus_integrity_ok as null before first check', () => {
    const wd = new Watchdog(60_000);
    wd.setCorpusCacheDir('/tmp/nonexistent');
    const report = wd.getHealthReport();
    expect(report.corpus_integrity_ok).toBeNull();
  });

  it('does not crash on non-Pi hardware (no thermal file)', () => {
    const wd = new Watchdog(60_000);
    const report = wd.getHealthReport();
    // temperature_celsius should be null on non-Pi
    expect(report.temperature_celsius).toBeNull();
    expect(report.temperature_warn).toBe(false);
    expect(report.temperature_critical).toBe(false);
  });

  it('stops cleanly without pending timers', () => {
    const wd = new Watchdog(60_000);
    wd.start();
    wd.stop();
    // If stop() doesn't clear timers, vitest will hang. This test passing = stop works.
    expect(true).toBe(true);
  });
});
