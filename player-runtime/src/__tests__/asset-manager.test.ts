/**
 * BL-043: Asset manager unit tests.
 *
 * Tests:
 * (a) asset already cached → no HTTP call
 * (b) download succeeds → path substituted
 * (c) download fails → original URL preserved, no crash
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { AssetManager } from '../asset-manager.js';

function makeTmpDir(): string {
  const dir = path.join(os.tmpdir(), `asset-mgr-test-${crypto.randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex');
}

describe('AssetManager', () => {
  let server: http.Server;
  let baseUrl: string;
  let assetDir: string;

  before(async () => {
    assetDir = makeTmpDir();

    // Start a tiny HTTP server to serve test files
    server = http.createServer((req, res) => {
      if (req.url === '/test-image.jpg') {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end('fake-jpeg-data');
      } else if (req.url === '/fail-image.png') {
        res.writeHead(500);
        res.end('Internal Server Error');
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(() => {
    server.close();
    fs.rmSync(assetDir, { recursive: true, force: true });
  });

  it('(a) skips download when asset is already cached', async () => {
    const mgr = new AssetManager(assetDir);
    const url = `${baseUrl}/test-image.jpg`;
    const hash = hashUrl(url);
    const localPath = path.join(assetDir, `${hash}.jpg`);

    // Pre-cache the file
    fs.writeFileSync(localPath, 'pre-cached');

    const { items, stats } = await mgr.syncAssets([
      { content_id: 'c1', data: { title: 'Hello', media_url: url } },
    ]);

    assert.equal(stats.required, 1);
    assert.equal(stats.verified, 1);
    assert.equal(stats.downloaded, 0, 'Should not download — file exists');
    assert.equal(items[0]!.data!['media_url'], localPath, 'Should substitute local path');
    assert.equal(items[0]!.data!['title'], 'Hello', 'Non-media fields preserved');
  });

  it('(b) downloads asset and substitutes path on success', async () => {
    const freshDir = makeTmpDir();
    const mgr = new AssetManager(freshDir);
    const url = `${baseUrl}/test-image.jpg`;
    const hash = hashUrl(url);

    const { items, stats } = await mgr.syncAssets([
      { content_id: 'c2', data: { media_url: url } },
    ]);

    assert.equal(stats.required, 1);
    assert.equal(stats.verified, 1);
    assert.equal(stats.downloaded, 1);
    assert.equal(stats.failed, 0);

    const expectedPath = path.join(freshDir, `${hash}.jpg`);
    assert.equal(items[0]!.data!['media_url'], expectedPath);
    assert.ok(fs.existsSync(expectedPath), 'File should exist on disk');
    assert.equal(fs.readFileSync(expectedPath, 'utf-8'), 'fake-jpeg-data');

    fs.rmSync(freshDir, { recursive: true, force: true });
  });

  it('(c) preserves original URL on download failure — no crash', async () => {
    const freshDir = makeTmpDir();
    const mgr = new AssetManager(freshDir);
    const failUrl = `${baseUrl}/fail-image.png`;

    const { items, stats } = await mgr.syncAssets([
      { content_id: 'c3', data: { title: 'Test', media_url: failUrl } },
    ]);

    assert.equal(stats.required, 1);
    assert.equal(stats.verified, 0);
    assert.equal(stats.failed, 1);
    assert.equal(items[0]!.data!['media_url'], failUrl, 'Original URL preserved on failure');
    assert.equal(items[0]!.data!['title'], 'Test', 'Other fields unchanged');

    fs.rmSync(freshDir, { recursive: true, force: true });
  });

  it('passes through items without media_url unchanged', async () => {
    const mgr = new AssetManager(assetDir);

    const { items, stats } = await mgr.syncAssets([
      { content_id: 'c4', data: { title: 'No media' } },
      { content_id: 'c5' },
    ]);

    assert.equal(stats.required, 0);
    assert.equal(stats.verified, 0);
    assert.equal(items.length, 2);
    assert.equal(items[0]!.data!['title'], 'No media');
  });

  it('syncZones processes all zones', async () => {
    const freshDir = makeTmpDir();
    const mgr = new AssetManager(freshDir);
    const url = `${baseUrl}/test-image.jpg`;

    const { zones, stats } = await mgr.syncZones({
      main: [{ content_id: 'z1', data: { media_url: url } }],
      ticker: [{ content_id: 'z2', data: { text: 'hello' } }],
    });

    assert.equal(stats.required, 1);
    assert.equal(stats.verified, 1);
    assert.equal(Object.keys(zones).length, 2);
    assert.ok(typeof zones['main']![0]!.data!['media_url'] === 'string');
    assert.notEqual(zones['main']![0]!.data!['media_url'], url, 'Should be local path, not URL');

    fs.rmSync(freshDir, { recursive: true, force: true });
  });
});
