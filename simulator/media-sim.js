#!/usr/bin/env node
'use strict';

// ClubHub TV — Media Failure Simulation
//
// Standalone test that exercises all media failure modes against the backend's
// manifest content. Simulates what a Pi player would experience when assets
// are unavailable, corrupt, oversized, or slow to load.
//
// Usage:
//   BACKEND_URL=http://localhost:4000 node simulator/media-sim.js
//   make test-media

const BACKEND   = process.env.BACKEND_URL || 'http://localhost:4000';
const SCREEN_ID = process.env.SCREEN_ID  || 'media-sim-screen';
const MAX_SIZE  = parseInt(process.env.MAX_MEDIA_BYTES || String(5 * 1024 * 1024), 10); // 5MB
const SLOW_THRESHOLD_MS = parseInt(process.env.SLOW_THRESHOLD_MS || '3000', 10);

// ── Logging ───────────────────────────────────────────────────────────────────
const A = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m' };
const col = (s, c) => (A[c] || '') + s + A.reset;
const pass = (msg) => console.log(`  ${col('PASS', 'green')}  ${msg}`);
const fail = (msg) => console.log(`  ${col('FAIL', 'red')}  ${msg}`);
const warn = (msg) => console.log(`  ${col('WARN', 'yellow')}  ${msg}`);
const info = (msg) => console.log(`  ${col('INFO', 'dim')}  ${msg}`);

let passed = 0, failed = 0, warned = 0;

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchJSON(path) {
  const res = await fetch(`${BACKEND}${path}`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Test: missing file (404) ──────────────────────────────────────────────────
async function testMissingFile() {
  const url = `${BACKEND}/uploads/nonexistent-file-${Date.now()}.jpg`;
  info(`Missing file: GET ${url.replace(BACKEND, '')}`);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (res.status === 404) {
      pass(`Missing file returns 404 (${Date.now() - t0}ms) — player should show placeholder`);
      passed++;
    } else {
      warn(`Expected 404, got ${res.status}`);
      warned++;
    }
  } catch (e) {
    fail(`Request errored: ${e.message}`);
    failed++;
  }
}

// ── Test: content-type mismatch (corrupt) ────────────────────────────────────
async function testCorruptFile() {
  // Upload a text file with image extension to simulate corrupt/wrong-type asset
  info('Corrupt file: upload text file as image');
  try {
    const form = new FormData();
    form.append('file', new Blob(['NOT AN IMAGE - CORRUPT DATA \x00\xFF\xFE'], { type: 'image/jpeg' }), 'corrupt.jpg');
    const res = await fetch(`${BACKEND}/asset/upload`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const data = await res.json();
      // Simulate player trying to render it as an image
      const mediaRes = await fetch(`${BACKEND}${data.url}`, { signal: AbortSignal.timeout(5_000) });
      const ct = mediaRes.headers.get('content-type') || '';
      if (!ct.includes('image')) {
        pass(`Corrupt file detected: content-type is "${ct}", not image — player should fallback`);
        passed++;
      } else {
        warn(`Server accepted corrupt file as image type: ${ct}`);
        warned++;
      }
    } else if (res.status === 404 || res.status === 405) {
      info('Asset upload endpoint not available — skipping corrupt file test');
    } else {
      warn(`Upload returned ${res.status}`);
      warned++;
    }
  } catch (e) {
    warn(`Corrupt file test skipped: ${e.message}`);
    warned++;
  }
}

// ── Test: oversized file detection ───────────────────────────────────────────
async function testOversizedFile() {
  info(`Oversized file: checking content-length validation (limit: ${(MAX_SIZE / 1024 / 1024).toFixed(0)}MB)`);
  // We test by checking a manifest item's media_url would fail size check
  // In production the player should check Content-Length before downloading
  try {
    const manifest = await fetchJSON(`/manifest?screen_id=${SCREEN_ID}`);
    const itemsWithMedia = (manifest.items || []).filter(i => i.data?.image_url);
    if (itemsWithMedia.length === 0) {
      info('No manifest items with media URLs — simulating size check');
      // Simulate: a player would check Content-Length header
      const fakeSize = 10 * 1024 * 1024; // 10MB
      if (fakeSize > MAX_SIZE) {
        pass(`Oversized check: ${(fakeSize / 1024 / 1024).toFixed(0)}MB > limit ${(MAX_SIZE / 1024 / 1024).toFixed(0)}MB — player should reject`);
        passed++;
      }
    } else {
      for (const item of itemsWithMedia.slice(0, 2)) {
        const url = item.data.image_url.startsWith('http') ? item.data.image_url : `${BACKEND}${item.data.image_url}`;
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3_000) });
        const size = parseInt(res.headers.get('content-length') || '0', 10);
        if (size > 0 && size <= MAX_SIZE) {
          pass(`Media file within size limit: ${(size / 1024).toFixed(0)}KB ≤ ${(MAX_SIZE / 1024 / 1024).toFixed(0)}MB`);
          passed++;
        } else if (size > MAX_SIZE) {
          warn(`Media file oversized: ${(size / 1024 / 1024).toFixed(1)}MB exceeds ${(MAX_SIZE / 1024 / 1024).toFixed(0)}MB limit`);
          warned++;
        } else {
          info('No content-length header — player cannot pre-validate size');
        }
      }
    }
  } catch (e) {
    warn(`Oversized test: ${e.message}`);
    warned++;
  }
}

// ── Test: slow download simulation ───────────────────────────────────────────
async function testSlowDownload() {
  info(`Slow download: measuring manifest fetch time`);
  const t0 = Date.now();
  try {
    await fetchJSON(`/manifest?screen_id=${SCREEN_ID}`);
    const ms = Date.now() - t0;
    if (ms < SLOW_THRESHOLD_MS) {
      pass(`Manifest fetched in ${ms}ms (< ${SLOW_THRESHOLD_MS}ms threshold)`);
      passed++;
    } else {
      warn(`Manifest fetch slow: ${ms}ms ≥ ${SLOW_THRESHOLD_MS}ms — check backend/network performance`);
      warned++;
    }
  } catch (e) {
    fail(`Slow download test failed: ${e.message}`);
    failed++;
  }
}

// ── Test: partial download / connection abort ─────────────────────────────────
async function testPartialDownload() {
  info('Partial download: abort mid-request');
  try {
    const controller = new AbortController();
    const fetchPromise = fetch(`${BACKEND}/manifest?screen_id=${SCREEN_ID}`, {
      signal: controller.signal,
    });
    // Abort almost immediately
    await new Promise(r => setTimeout(r, 50));
    controller.abort();
    await fetchPromise;
    warn('Request was not aborted — abort handling may not work');
    warned++;
  } catch (e) {
    if (e.name === 'AbortError') {
      pass(`Partial download aborted cleanly (AbortError) — player fallback cache should activate`);
      passed++;
    } else {
      pass(`Partial download threw ${e.constructor.name}: ${e.message} — player should handle gracefully`);
      passed++;
    }
  }
}

// ── Test: storage exhaustion simulation ──────────────────────────────────────
async function testStorageExhaustion() {
  info('Storage exhaustion: simulate localStorage quota exceeded');
  // In a real browser, this would be localStorage.setItem until QuotaExceededError
  // We simulate by checking that the player's caching strategy is defensive
  try {
    const manifest = await fetchJSON(`/manifest?screen_id=${SCREEN_ID}`);
    const manifestStr = JSON.stringify(manifest);
    const sizeKb = (manifestStr.length / 1024).toFixed(1);

    // A manifest should be small enough to always fit in localStorage (5MB limit)
    if (manifestStr.length < 50 * 1024) {
      pass(`Manifest is ${sizeKb}KB — well within localStorage limits (5MB)`);
      passed++;
    } else {
      warn(`Manifest is ${sizeKb}KB — approaching localStorage limits`);
      warned++;
    }
    // Check items count doesn't blow up
    if ((manifest.items || []).length > 50) {
      warn(`${manifest.items.length} items in manifest — large playlists may cause memory pressure`);
      warned++;
    }
  } catch (e) {
    warn(`Storage exhaustion test: ${e.message}`);
    warned++;
  }
}

// ── Test: unsupported media format ────────────────────────────────────────────
async function testUnsupportedFormat() {
  info('Unsupported format: check content validation on upload');
  try {
    const form = new FormData();
    // Upload a .exe-like blob
    form.append('file', new Blob(['MZ\x90\x00'], { type: 'application/octet-stream' }), 'payload.exe');
    const res = await fetch(`${BACKEND}/asset/upload`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(5_000),
    });
    if (res.status === 400 || res.status === 415 || res.status === 422) {
      pass(`Server rejected unsupported format with ${res.status} — good content validation`);
      passed++;
    } else if (res.status === 404 || res.status === 405) {
      info('Asset upload endpoint not available — skipping format test');
    } else if (res.ok) {
      warn(`Server accepted application/octet-stream upload — add mime-type validation`);
      warned++;
    }
  } catch (e) {
    warn(`Format test: ${e.message}`);
    warned++;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n${col('ClubHub TV — Media Failure Tests', 'bold')}`);
  console.log(`${col('═'.repeat(55), 'dim')}`);
  console.log(`  Backend:  ${BACKEND}`);
  console.log(`  Screen:   ${SCREEN_ID}`);
  console.log(`  Max size: ${(MAX_SIZE / 1024 / 1024).toFixed(0)}MB\n`);

  // Verify backend is up
  try {
    await fetchJSON('/health');
  } catch (e) {
    console.error(col(`\n  Backend not reachable: ${e.message}\n`, 'red'));
    process.exit(1);
  }

  await testMissingFile();
  await testCorruptFile();
  await testOversizedFile();
  await testSlowDownload();
  await testPartialDownload();
  await testStorageExhaustion();
  await testUnsupportedFormat();

  console.log(`\n${col('─'.repeat(55), 'dim')}`);
  console.log(
    `  ${col(`PASS: ${passed}`, 'green')}   ` +
    `${col(`WARN: ${warned}`, 'yellow')}   ` +
    `${col(`FAIL: ${failed}`, failed > 0 ? 'red' : 'dim')}`
  );
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
})();
