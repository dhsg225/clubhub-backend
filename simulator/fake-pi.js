#!/usr/bin/env node
'use strict';

/**
 * ClubHub TV — Fake Pi Fleet Simulator
 */

const http = require('http');

// ── Configuration ────────────────────────────────────────────────────────────

const BACKEND        = process.env.BACKEND_URL     || 'http://localhost:4000';
const SCREEN_COUNT   = parseInt(process.env.SCREEN_COUNT  || '5',  10);
const SCREEN_PREFIX  = process.env.SCREEN_PREFIX   || 'sim-screen';
const REBOOT_PROB    = parseFloat(process.env.REBOOT_PROB || '0.005');
const STATUS_PORT    = parseInt(process.env.STATUS_PORT   || '3100', 10);
const VENUE_ID       = process.env.VENUE_ID        || 'venue-1';
const DETERMINISTIC  = process.env.DETERMINISTIC === 'true';
const SEED           = parseInt(process.env.SEED || '42', 10);

const POLL_INTERVAL_MS     = 15_000;
const FETCH_TIMEOUT_MS     =  5_000;
const REBOOT_DELAY_MIN_MS  =  2_000;
const REBOOT_DELAY_MAX_MS  =  5_000;
const STATS_INTERVAL_MS    = 60_000;

// ── Deterministic Random ─────────────────────────────────────────────────────

function createRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const random = DETERMINISTIC ? createRandom(SEED) : Math.random;

// ── Logging ──────────────────────────────────────────────────────────────────

function log(obj) {
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
}

// ── Fetch with timeout ───────────────────────────────────────────────────────

async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = FETCH_TIMEOUT_MS, ...rest } = options;
  return fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
}

// ── FakePi ───────────────────────────────────────────────────────────────────

class FakePi {
  constructor(screenId, piRandom) {
    this.screenId = screenId;
    this.random = piRandom;

    // In-memory manifest cache (mirrors Pi localStorage)
    this.cachedManifest = null;

    // Tracking
    this.status        = 'booting';   // booting | live | empty | offline | rebooting
    this.pollCount     = 0;
    this.successCount  = 0;
    this.failureCount  = 0;
    this.versionChanges = 0;
    this.offlineStreak = 0;
    this.lastVersion   = null;
    this.lastChecksum  = null;
    this.startedAt     = Date.now();
    this.lastPollAt    = null;
    this.lastSuccessAt = null;

    // State flags
    this._forcedOffline    = false;
    this._pollInterval     = null;
    this._startupTimer     = null;
    this._offlineTimer     = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async start() {
    await this._register();

    log({
      screen: this.screenId,
      event:  'boot',
      status: 'booting',
      backend: BACKEND,
      venue:  VENUE_ID,
    });

    // Jitter first poll to prevent thundering herd (mirrors real Pi behavior)
    const jitter = Math.floor(this.random() * POLL_INTERVAL_MS);

    this._startupTimer = setTimeout(() => {
      this._poll();
      this._pollInterval = setInterval(() => this._poll(), POLL_INTERVAL_MS);
    }, jitter);
  }

  stop() {
    if (this._startupTimer)  clearTimeout(this._startupTimer);
    if (this._pollInterval)  clearInterval(this._pollInterval);
    if (this._offlineTimer)  clearTimeout(this._offlineTimer);
  }

  // ── Registration ──────────────────────────────────────────────────────────

  async _register() {
    try {
      const res = await fetchWithTimeout(`${BACKEND}/screens`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          id:       this.screenId,
          venue_id: VENUE_ID,
          name:     `Simulator: ${this.screenId}`,
        }),
      });
      if (res.ok || res.status === 409) return;
      log({ screen: this.screenId, event: 'register.warn', status: res.status });
    } catch (err) {
      log({ screen: this.screenId, event: 'register.failed', error: err.message });
    }
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────

  async _heartbeat() {
    try {
      await fetchWithTimeout(`${BACKEND}/screens/${this.screenId}/heartbeat`, {
        method: 'PATCH',
      });
    } catch {
      // ignore
    }
  }

  // ── Poll ──────────────────────────────────────────────────────────────────

  async _poll() {
    this.pollCount++;
    this.lastPollAt = Date.now();

    if (this._forcedOffline) {
      this.offlineStreak++;
      this.failureCount++;
      this.status = 'offline';
      log({
        screen:       this.screenId,
        event:        'poll.offline',
        reason:       'forced_offline',
        offline_streak: this.offlineStreak,
        cache_version:  this.cachedManifest?.version ?? null,
        cache_checksum: this.cachedManifest?.checksum ?? null,
        status:       'offline',
      });
      return;
    }

    // Random reboot injection
    if (this.random() < REBOOT_PROB) {
      this._simulateReboot();
      return;
    }

    const t0 = Date.now();

    try {
      const res = await fetchWithTimeout(`${BACKEND}/manifest?screen_id=${this.screenId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data       = await res.json();
      const durationMs = Date.now() - t0;

      const prevChecksum   = this.lastChecksum;
      const manifestChanged = prevChecksum !== null && prevChecksum !== data.checksum;

      if (!this.cachedManifest || manifestChanged) {
        this.cachedManifest = data;
        if (manifestChanged) this.versionChanges++;
      }

      this.lastVersion   = data.version;
      this.lastChecksum  = data.checksum;
      this.offlineStreak = 0;
      this.successCount++;
      this.lastSuccessAt = Date.now();
      this.status        = data.items.length === 0 ? 'empty' : 'live';

      log({
        screen:          this.screenId,
        event:           'poll.success',
        version:         data.version,
        checksum:        data.checksum,
        items:           data.items.length,
        fallback_items:  data.fallback_items?.length ?? 0,
        sources:         [...new Set(data.items.map(i => i.source))],
        manifest_changed: manifestChanged,
        prev_checksum:   prevChecksum,
        duration_ms:     durationMs,
        status:          this.status,
        poll_n:          this.pollCount,
      });

      await this._heartbeat();

    } catch (err) {
      this.failureCount++;
      this.offlineStreak++;
      this.status = 'offline';

      const durationMs = Date.now() - t0;

      log({
        screen:          this.screenId,
        event:           'poll.failure',
        error:           err.message,
        offline_streak:  this.offlineStreak,
        duration_ms:     durationMs,
        cache_version:   this.cachedManifest?.version  ?? null,
        cache_checksum:  this.cachedManifest?.checksum ?? null,
        cache_items:     this.cachedManifest?.items?.length ?? 0,
        playing_from_cache: !!this.cachedManifest,
        status:          'offline',
      });
    }
  }

  // ── Failure injection ─────────────────────────────────────────────────────

  goOffline(durationMs = 30_000) {
    if (this._offlineTimer) clearTimeout(this._offlineTimer);
    this._forcedOffline = true;

    log({
      screen:      this.screenId,
      event:       'offline.forced',
      duration_ms: durationMs,
      status:      'offline',
    });

    this._offlineTimer = setTimeout(() => {
      this._forcedOffline = false;
      this.status         = 'recovering';
      log({
        screen: this.screenId,
        event:  'offline.end',
        status: 'recovering',
      });
    }, durationMs);
  }

  _simulateReboot() {
    this.stop();
    this.status = 'rebooting';

    log({
      screen:           this.screenId,
      event:            'reboot.start',
      status:           'rebooting',
      prev_version:     this.lastVersion,
      prev_checksum:    this.lastChecksum,
      polls_before_reboot: this.pollCount,
    });

    this.lastVersion  = null;
    this.lastChecksum = null;

    const delay = REBOOT_DELAY_MIN_MS + this.random() * (REBOOT_DELAY_MAX_MS - REBOOT_DELAY_MIN_MS);

    setTimeout(() => {
      this.status = 'booting';
      log({ screen: this.screenId, event: 'reboot.complete', status: 'booting' });
      this.start();
    }, delay);
  }

  toStatus() {
    return {
      screen_id:        this.screenId,
      status:           this.status,
      forced_offline:   this._forcedOffline,
      poll_count:       this.pollCount,
      success_count:    this.successCount,
      failure_count:    this.failureCount,
      version_changes:  this.versionChanges,
      offline_streak:   this.offlineStreak,
      last_version:     this.lastVersion,
      last_checksum:    this.lastChecksum,
      last_poll_ago_s:  this.lastPollAt   ? Math.round((Date.now() - this.lastPollAt)   / 1000) : null,
      last_ok_ago_s:    this.lastSuccessAt ? Math.round((Date.now() - this.lastSuccessAt) / 1000) : null,
      uptime_s:         Math.round((Date.now() - this.startedAt) / 1000),
      has_cache:        !!this.cachedManifest,
      cache_items:      this.cachedManifest?.items?.length ?? 0,
    };
  }
}

// ── Fleet ────────────────────────────────────────────────────────────────────

const fleet = new Map();

for (let i = 1; i <= SCREEN_COUNT; i++) {
  const id = `${SCREEN_PREFIX}-${String(i).padStart(2, '0')}`;
  // Each screen gets its own seeded random sequence derived from global seed
  const piRandom = createRandom(SEED + i);
  const pi = new FakePi(id, piRandom);
  fleet.set(id, pi);
  pi.start();
}

log({
  event:         'fleet.start',
  screen_count:  SCREEN_COUNT,
  backend:       BACKEND,
  venue:         VENUE_ID,
  deterministic: DETERMINISTIC,
  seed:          SEED,
  poll_interval: `${POLL_INTERVAL_MS / 1000}s`,
  screens:       [...fleet.keys()],
});

// ── Periodic fleet stats ──────────────────────────────────────────────────────

setInterval(() => {
  const screens = [...fleet.values()];
  const byStatus = screens.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  log({
    event:     'fleet.stats',
    total:     screens.length,
    by_status: byStatus,
    screens:   screens.map(p => p.toStatus()),
  });
}, STATS_INTERVAL_MS);

// ── Management HTTP API ──────────────────────────────────────────────────────

function jsonResponse(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url    = req.url || '/';
  const method = req.method || 'GET';

  if (method === 'GET' && url === '/status') {
    const screens  = [...fleet.values()];
    const byStatus = screens.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});
    return jsonResponse(res, 200, {
      fleet_size: screens.length,
      by_status:  byStatus,
      screens:    screens.map(p => p.toStatus()),
    });
  }

  if (method === 'GET' && url === '/health') {
    return jsonResponse(res, 200, { ok: true, fleet_size: fleet.size });
  }

  if (method === 'POST' && url.startsWith('/offline/')) {
    const screenId = decodeURIComponent(url.slice('/offline/'.length));
    const pi       = fleet.get(screenId);
    if (!pi) return jsonResponse(res, 404, { error: 'Screen not found', screen_id: screenId });
    const body = await readBody(req);
    pi.goOffline(body.durationMs ?? 30_000);
    return jsonResponse(res, 200, { ok: true, screen_id: screenId, duration_ms: body.durationMs ?? 30_000 });
  }

  if (method === 'POST' && url.startsWith('/reboot/')) {
    const screenId = decodeURIComponent(url.slice('/reboot/'.length));
    const pi       = fleet.get(screenId);
    if (!pi) return jsonResponse(res, 404, { error: 'Screen not found', screen_id: screenId });
    pi._simulateReboot();
    return jsonResponse(res, 200, { ok: true, screen_id: screenId });
  }

  if (method === 'POST' && url === '/offline-all') {
    const body = await readBody(req);
    for (const pi of fleet.values()) pi.goOffline(body.durationMs ?? 30_000);
    return jsonResponse(res, 200, { ok: true, count: fleet.size, duration_ms: body.durationMs ?? 30_000 });
  }

  if (method === 'POST' && url === '/reboot-all') {
    for (const pi of fleet.values()) pi._simulateReboot();
    return jsonResponse(res, 200, { ok: true, count: fleet.size });
  }

  jsonResponse(res, 404, { error: 'Not found' });
});

server.listen(STATUS_PORT, '0.0.0.0', () => {
  log({
    event:       'management.api.ready',
    port:        STATUS_PORT,
    endpoints: [
      'GET  /status',
      'GET  /health',
      `POST /offline/:screenId`,
      `POST /reboot/:screenId`,
      'POST /offline-all',
      'POST /reboot-all',
    ],
  });
});

function shutdown(signal) {
  log({ event: 'fleet.shutdown', signal, fleet_size: fleet.size });
  for (const pi of fleet.values()) pi.stop();
  server.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
