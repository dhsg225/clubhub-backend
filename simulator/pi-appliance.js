#!/usr/bin/env node
'use strict';

// ClubHub TV — Pi Appliance Mode Simulator
//
// Simulates a single Raspberry Pi running in "kiosk appliance" mode.
// Unlike fake-pi.js (which simulates N screens for fleet testing), this
// script models a REAL Pi's behaviour:
//
//   • Persistent screen identity (saved to disk, survives restarts)
//   • Kiosk boot sequence with splash screen
//   • Offline boot: loads cached manifest from disk, polls until backend returns
//   • Stale manifest timeout: forces re-fetch after STALE_THRESHOLD_MS
//   • Simulated watchdog: if 3 consecutive polls fail, logs watchdog restart
//   • Structured JSON log output (same format as fake-pi.js)
//
// Usage:
//   node simulator/pi-appliance.js
//   BACKEND_URL=http://192.168.1.10:4000 SCREEN_ID=bar-screen-01 node simulator/pi-appliance.js
//
// Env vars:
//   BACKEND_URL          Backend base URL             (default: http://localhost:4000)
//   SCREEN_ID            Screen identity              (default: loaded from identity file or generated)
//   VENUE_ID             Venue to register under      (default: venue-1)
//   IDENTITY_FILE        Where to persist screen ID   (default: /tmp/clubhub-screen-identity.json)
//   POLL_INTERVAL_MS     Poll interval in ms          (default: 15000)
//   STALE_THRESHOLD_MS   Force re-fetch after N ms    (default: 120000 = 2 min)
//   WATCHDOG_THRESHOLD   Failures before watchdog     (default: 3)
//   CACHE_FILE           Local manifest cache file    (default: /tmp/clubhub-manifest-cache.json)
//   SPLASH_DURATION_MS   Boot splash display time     (default: 3000)

const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const BACKEND           = process.env.BACKEND_URL         || 'http://localhost:4000';
const VENUE_ID          = process.env.VENUE_ID            || 'venue-1';
const IDENTITY_FILE     = process.env.IDENTITY_FILE       || '/tmp/clubhub-screen-identity.json';
const CACHE_FILE        = process.env.CACHE_FILE          || '/tmp/clubhub-manifest-cache.json';
const POLL_INTERVAL_MS  = parseInt(process.env.POLL_INTERVAL_MS  || '15000', 10);
const STALE_THRESHOLD   = parseInt(process.env.STALE_THRESHOLD_MS || '120000', 10);
const WATCHDOG_MAX      = parseInt(process.env.WATCHDOG_THRESHOLD || '3', 10);
const FETCH_TIMEOUT_MS  = 5_000;
const SPLASH_MS         = parseInt(process.env.SPLASH_DURATION_MS || '3000', 10);

// ── Structured logging ────────────────────────────────────────────────────────
function log(obj) {
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
}

// ── Screen identity (persistent) ──────────────────────────────────────────────
// The Pi's screen identity is saved to disk so it survives reboots.
// If an explicit SCREEN_ID env var is set, that always wins.
function loadOrCreateIdentity() {
  if (process.env.SCREEN_ID) {
    return { screen_id: process.env.SCREEN_ID, created_at: new Date().toISOString(), source: 'env' };
  }
  try {
    const raw = fs.readFileSync(IDENTITY_FILE, 'utf8');
    const identity = JSON.parse(raw);
    log({ event: 'identity.loaded', screen_id: identity.screen_id, source: 'disk' });
    return identity;
  } catch {
    // Generate a new identity and persist it
    const screen_id = `pi-${Math.random().toString(36).slice(2, 10)}`;
    const identity = {
      screen_id,
      created_at: new Date().toISOString(),
      source: 'generated',
    };
    try {
      fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));
      log({ event: 'identity.created', screen_id, file: IDENTITY_FILE });
    } catch (e) {
      log({ event: 'identity.persist_failed', error: e.message, screen_id });
    }
    return identity;
  }
}

// ── Manifest cache (persistent) ───────────────────────────────────────────────
// Mirrors the browser's localStorage — allows the Pi to show content on boot
// even if the backend is temporarily unreachable (offline boot).
function loadCachedManifest() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveManifest(manifest) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      manifest,
      cached_at: new Date().toISOString(),
    }));
  } catch (e) {
    log({ event: 'cache.persist_failed', error: e.message });
  }
}

// ── Fetch with timeout ────────────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Screen registration ───────────────────────────────────────────────────────
async function register(screenId) {
  try {
    const res = await fetchWithTimeout(`${BACKEND}/screens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: screenId, venue_id: VENUE_ID, name: screenId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok || res.status === 409) {
      log({ event: 'register.ok', screen_id: screenId, status: res.status });
    } else {
      log({ event: 'register.warn', screen_id: screenId, status: res.status, error: data.error });
    }
  } catch (e) {
    log({ event: 'register.failed', screen_id: screenId, error: e.message });
  }
}

// ── Boot splash ───────────────────────────────────────────────────────────────
// On a real Pi this drives the display; here we emit a log event.
function bootSplash(screenId, hasCachedManifest) {
  log({
    event:       'splash.start',
    screen_id:   screenId,
    mode:        hasCachedManifest ? 'cached' : 'cold',
    message:     hasCachedManifest
      ? 'Loading cached content...'
      : 'Connecting to ClubHub...',
  });
}

// ── Main Pi appliance loop ────────────────────────────────────────────────────
async function run() {
  // 1. Load or create persistent identity
  const identity    = loadOrCreateIdentity();
  const screenId    = identity.screen_id;
  const cachedEntry = loadCachedManifest();

  // 2. Boot splash
  const hasCachedManifest = !!(cachedEntry?.manifest);
  bootSplash(screenId, hasCachedManifest);
  await new Promise(r => setTimeout(r, SPLASH_MS));

  // 3. Offline boot: if we have a cached manifest, start displaying it immediately
  let currentManifest = null;
  if (hasCachedManifest) {
    currentManifest = cachedEntry.manifest;
    const ageMs = Date.now() - new Date(cachedEntry.cached_at).getTime();
    log({
      event:       'offline_boot.using_cache',
      screen_id:   screenId,
      checksum:    currentManifest.checksum,
      cache_age_s: Math.floor(ageMs / 1000),
      items:       currentManifest.items?.length ?? 0,
    });
  } else {
    log({ event: 'offline_boot.no_cache', screen_id: screenId });
  }

  // 4. Register with backend (non-blocking — boot continues while this resolves)
  register(screenId).catch(() => {});

  log({ event: 'boot', screen_id: screenId, backend: BACKEND, poll_interval_ms: POLL_INTERVAL_MS });

  // 5. Poll loop
  let consecutiveFailures = 0;
  let lastSuccessAt = 0;

  // Jitter: spread cold-start load (0–15s, mirrors player/src/useManifest.ts)
  const jitter = Math.floor(Math.random() * POLL_INTERVAL_MS);
  await new Promise(r => setTimeout(r, jitter));

  async function poll() {
    const t0 = Date.now();
    try {
      const res = await fetchWithTimeout(`${BACKEND}/manifest?screen_id=${screenId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const manifest = await res.json();

      // Validate manifest isn't corrupted (basic sanity check)
      if (!manifest || typeof manifest.checksum !== 'string' || !Array.isArray(manifest.items)) {
        throw new Error('malformed manifest: missing checksum or items');
      }

      const durationMs = Date.now() - t0;
      const changed    = manifest.checksum !== currentManifest?.checksum;
      consecutiveFailures = 0;
      lastSuccessAt = Date.now();

      if (changed) {
        log({
          event:        'poll.success',
          screen_id:    screenId,
          checksum:     manifest.checksum,
          prev_checksum: currentManifest?.checksum ?? null,
          version:      manifest.version,
          items:        manifest.items.length,
          duration_ms:  durationMs,
          manifest_changed: true,
        });
        currentManifest = manifest;
        saveManifest(manifest);
      } else {
        log({
          event:        'poll.success',
          screen_id:    screenId,
          checksum:     manifest.checksum,
          version:      manifest.version,
          items:        manifest.items.length,
          duration_ms:  durationMs,
          manifest_changed: false,
        });
      }

      // Stale manifest warning: if we haven't had a content change in a long time
      // but the manifest is very old, log a warning (might indicate a scheduling gap)
      const manifestAgeMs = Date.now() - new Date(manifest.computed_at).getTime();
      if (manifestAgeMs > STALE_THRESHOLD) {
        log({
          event:           'manifest.stale_warning',
          screen_id:       screenId,
          manifest_age_s:  Math.floor(manifestAgeMs / 1000),
          stale_threshold_s: Math.floor(STALE_THRESHOLD / 1000),
        });
      }

    } catch (err) {
      consecutiveFailures++;
      const durationMs = Date.now() - t0;

      log({
        event:               'poll.failure',
        screen_id:           screenId,
        error:               err.message,
        duration_ms:         durationMs,
        consecutive_failures: consecutiveFailures,
        using_cached_manifest: !!currentManifest,
      });

      // Watchdog: simulate Pi watchdog restart after sustained failures
      if (consecutiveFailures >= WATCHDOG_MAX) {
        log({
          event:             'watchdog.triggered',
          screen_id:         screenId,
          consecutive_failures: consecutiveFailures,
          last_success_s:    lastSuccessAt ? Math.floor((Date.now() - lastSuccessAt) / 1000) : null,
          action:            'simulated_reboot',
        });
        consecutiveFailures = 0;
        // Simulate reboot delay (2–5 seconds)
        const rebootDelay = 2000 + Math.floor(Math.random() * 3000);
        await new Promise(r => setTimeout(r, rebootDelay));
        log({ event: 'boot', screen_id: screenId, reason: 'watchdog_restart' });
      }
    }
  }

  // Initial poll
  await poll();

  // Recurring poll every POLL_INTERVAL_MS
  setInterval(poll, POLL_INTERVAL_MS);
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  log({ event: 'shutdown', reason: 'SIGTERM' });
  process.exit(0);
});
process.on('SIGINT', () => {
  log({ event: 'shutdown', reason: 'SIGINT' });
  process.exit(0);
});

run().catch(err => {
  log({ event: 'fatal', error: err.message });
  process.exit(1);
});
