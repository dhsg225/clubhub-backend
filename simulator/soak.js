'use strict';

// ClubHub TV — Long-Running Soak Environment
//
// Runs N persistent appliance simulators with continuous fault injection,
// OTA simulation, media failure testing, and long-run metrics.
//
// Usage:
//   node simulator/soak.js
//   SCREEN_COUNT=5 SOAK_DURATION=3600 node simulator/soak.js
//
// Env vars:
//   BACKEND_URL        Backend to test (default: http://localhost:4000)
//   SCREEN_COUNT       Number of simulated screens (default: 5)
//   SCREEN_PREFIX      Screen ID prefix (default: soak-screen)
//   SOAK_DURATION      Seconds to run, 0 = infinite (default: 0)
//   STATUS_PORT        Management API port (default: 3200)
//   REPORT_DIR         Where to write reports (default: soak-reports)
//   FAULT_INTERVAL_MS  How often fault injector runs (default: 60000)
//   METRICS_INTERVAL_MS How often to flush metrics snapshot (default: 30000)
//   ENABLE_OTA         Simulate OTA updates (default: true)
//   ENABLE_MEDIA_FAULTS Simulate media failures (default: true)

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { NetworkShim } = require('./network-shim');

// ── Config ────────────────────────────────────────────────────────────────────
const BACKEND           = process.env.BACKEND_URL          || 'http://localhost:4000';
const SCREEN_COUNT      = parseInt(process.env.SCREEN_COUNT     || '5',    10);
const SCREEN_PREFIX     = process.env.SCREEN_PREFIX        || 'soak-screen';
const SOAK_DURATION_S   = parseInt(process.env.SOAK_DURATION    || '0',    10);
const STATUS_PORT       = parseInt(process.env.STATUS_PORT      || '3200', 10);
const REPORT_DIR        = process.env.REPORT_DIR           || 'soak-reports';
const FAULT_INTERVAL_MS = parseInt(process.env.FAULT_INTERVAL_MS  || '60000', 10);
const METRICS_INTERVAL  = parseInt(process.env.METRICS_INTERVAL_MS || '30000', 10);
const ENABLE_OTA        = process.env.ENABLE_OTA         !== 'false';
const ENABLE_MEDIA      = process.env.ENABLE_MEDIA_FAULTS !== 'false';
const VENUE_ID          = process.env.VENUE_ID || 'venue-1';

const POLL_INTERVAL_MS  = 15_000;
const WATCHDOG_THRESH   = 3;

fs.mkdirSync(REPORT_DIR, { recursive: true });

// ── Logging ───────────────────────────────────────────────────────────────────
const soakStartTs = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

function log(obj) {
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
}

// ── Sleep helper ──────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Global network shim (shared, fault injector modifies this) ────────────────
const globalShim = new NetworkShim({ name: 'global', defaultTimeoutMs: 5_000 });

// ── Media fault config ────────────────────────────────────────────────────────
const mediaFaults = {
  missingRate:   0,
  corruptRate:   0,
  oversizedRate: 0,
  slowRate:      0,
  partialRate:   0,
  storageExhausted: false,
};

// ── OTA version registry ──────────────────────────────────────────────────────
const VERSIONS = ['1.0.0', '1.1.0', '1.2.0'];
const otaRollout = {
  targetVersion:  '1.0.0',
  rolloutPct:     100,
  active:         false,
  failedScreens:  new Set(),
  completedAt:    null,
};

// ── Long-run metrics ──────────────────────────────────────────────────────────
const processMetrics = {
  snapshots:        [],   // { ts, rss_mb, heap_mb, event_loop_lag_ms }
  eventLoopLagMs:   0,
  faultsInjected:   [],   // { ts, type, params, affected }
  otaEvents:        [],   // { ts, screen_id, from, to, success, reason }
  mediaEvents:      [],   // { ts, screen_id, fault, url }
};

// Event loop lag measurement (100 ms tick, measure overshoot)
let _lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const lag = Math.max(0, now - _lastTick - 100);
  processMetrics.eventLoopLagMs = lag;
  _lastTick = now;
}, 100);

// ── Screen state ──────────────────────────────────────────────────────────────
class SoakScreen {
  constructor(id) {
    this.id            = id;
    this.shim          = globalShim;  // screens share global shim
    this.playerVersion = '1.0.0';
    this.status        = 'booting';
    this.cachedManifest = null;
    this.lastChecksum  = null;
    this.lastSuccessAt = 0;
    this.startedAt     = Date.now();
    this.rebootCount   = 0;
    this.recoveryCount = 0;
    this.totalPolls    = 0;
    this.successPolls  = 0;
    this.failureStreak = 0;
    this.latencies     = [];
    this.checksumHistory = [];
    this.mediaFailures = 0;
    this.otaAttempts   = 0;
    this.otaSuccesses  = 0;
    this.divergenceCount = 0;
    this.staleEvents   = 0;
    this._alive        = true;
    this._rebooting    = false;
  }

  // ── Registration ────────────────────────────────────────────────────────────
  async register() {
    try {
      await this.shim.fetch(`${BACKEND}/screens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.id, venue_id: VENUE_ID, name: `Soak: ${this.id}` }),
        _timeoutMs: 5_000,
      });
    } catch { /* ignore — will auto-register on first manifest poll */ }
  }

  // ── Media simulation ─────────────────────────────────────────────────────────
  async _simulateMedia(manifest) {
    if (!ENABLE_MEDIA) return;

    for (const item of (manifest.items || [])) {
      const url = item.data?.image_url || item.data?.media_url;
      if (!url) continue;

      let faultType = null;
      const r = Math.random();

      if (mediaFaults.storageExhausted) {
        faultType = 'storage_exhausted';
      } else if (r < mediaFaults.missingRate) {
        faultType = 'missing_404';
      } else if (r < mediaFaults.missingRate + mediaFaults.corruptRate) {
        faultType = 'corrupt';
      } else if (r < mediaFaults.missingRate + mediaFaults.corruptRate + mediaFaults.oversizedRate) {
        faultType = 'oversized';
      } else if (r < mediaFaults.missingRate + mediaFaults.corruptRate + mediaFaults.oversizedRate + mediaFaults.slowRate) {
        faultType = 'slow_download';
      } else if (r < mediaFaults.missingRate + mediaFaults.corruptRate + mediaFaults.oversizedRate + mediaFaults.slowRate + mediaFaults.partialRate) {
        faultType = 'partial_download';
      }

      if (faultType) {
        this.mediaFailures++;
        processMetrics.mediaEvents.push({ ts: Date.now(), screen_id: this.id, fault: faultType, url });
        log({ event: 'media.fault', screen_id: this.id, fault: faultType, url });
      }
    }
  }

  // ── OTA update simulation ────────────────────────────────────────────────────
  async _checkOTA() {
    if (!ENABLE_OTA || !otaRollout.active) return;
    if (this.playerVersion === otaRollout.targetVersion) return;
    if (otaRollout.failedScreens.has(this.id)) return;

    // Check if this screen is in the rollout cohort
    const hash = simpleHash(this.id);
    if ((hash % 100) >= otaRollout.rolloutPct) return;

    this.otaAttempts++;
    log({ event: 'ota.start', screen_id: this.id, from: this.playerVersion, to: otaRollout.targetVersion });

    // Simulate update: 10% fail, 5% interrupted
    const r = Math.random();
    const fromVersion = this.playerVersion;

    if (r < 0.05) {
      // Interrupted (simulated reboot mid-update)
      log({ event: 'ota.interrupted', screen_id: this.id, reason: 'reboot_mid_update' });
      processMetrics.otaEvents.push({ ts: Date.now(), screen_id: this.id, from: fromVersion, to: otaRollout.targetVersion, success: false, reason: 'interrupted' });
      this._scheduleReboot('ota_interrupt');
      return;
    } else if (r < 0.15) {
      // Compatibility check failed
      otaRollout.failedScreens.add(this.id);
      log({ event: 'ota.rollback', screen_id: this.id, reason: 'compat_check_failed', staying_at: this.playerVersion });
      processMetrics.otaEvents.push({ ts: Date.now(), screen_id: this.id, from: fromVersion, to: otaRollout.targetVersion, success: false, reason: 'compat_failed' });
      return;
    } else {
      // Success
      await sleep(500 + Math.random() * 1500); // simulate download time
      this.playerVersion = otaRollout.targetVersion;
      this.otaSuccesses++;
      log({ event: 'ota.success', screen_id: this.id, version: this.playerVersion });
      processMetrics.otaEvents.push({ ts: Date.now(), screen_id: this.id, from: fromVersion, to: this.playerVersion, success: true });
      this._scheduleReboot('ota_complete');
    }
  }

  // ── Poll ──────────────────────────────────────────────────────────────────────
  async poll() {
    if (this._rebooting) return;
    this.totalPolls++;
    const t0 = Date.now();

    try {
      const res = await this.shim.fetch(`${BACKEND}/manifest?screen_id=${this.id}`, { _timeoutMs: 5_000 });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Guard against captive portal / non-JSON
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        throw new Error(`malformed_response: expected JSON got ${contentType}`);
      }

      const manifest = await res.json();

      // Validate structure
      if (!manifest || typeof manifest.checksum !== 'string' || !Array.isArray(manifest.items)) {
        throw new Error('malformed_manifest');
      }

      const latency = Date.now() - t0;
      this.latencies.push(latency);
      if (this.latencies.length > 200) this.latencies.shift();

      const changed = manifest.checksum !== this.lastChecksum;
      if (changed && this.lastChecksum !== null) {
        this.checksumHistory.push({ ts: Date.now(), checksum: manifest.checksum });
        if (this.checksumHistory.length > 100) this.checksumHistory.shift();
      }

      this.lastChecksum  = manifest.checksum;
      this.lastSuccessAt = Date.now();
      this.successPolls++;

      if (this.failureStreak > 0) {
        this.recoveryCount++;
        this.failureStreak = 0;
        log({ event: 'poll.recovered', screen_id: this.id, version: this.playerVersion });
      }

      this.status = manifest.items.length === 0 ? 'empty' : 'online';
      this.cachedManifest = manifest;

      // Stale manifest check
      const ageMs = Date.now() - new Date(manifest.computed_at || Date.now()).getTime();
      if (ageMs > 120_000) {
        this.staleEvents++;
        log({ event: 'manifest.stale', screen_id: this.id, age_s: Math.floor(ageMs / 1000) });
      }

      // Clock drift simulation: compare server ts to our "drifted" time
      if (globalShim.conditions.clockOffsetMs) {
        const serverTs  = new Date(manifest.computed_at).getTime();
        const localTs   = Date.now() + (globalShim.conditions.clockOffsetMs || 0);
        const drift = Math.abs(localTs - serverTs);
        if (drift > 5000) {
          log({ event: 'clock.drift_detected', screen_id: this.id, drift_ms: drift });
        }
      }

      await this._simulateMedia(manifest);
      await this._checkOTA();

    } catch (err) {
      this.failureStreak++;
      this.status = this.cachedManifest ? 'degraded' : 'offline';
      log({ event: 'poll.failure', screen_id: this.id, error: err.message, streak: this.failureStreak });

      if (this.failureStreak >= WATCHDOG_THRESH) {
        this._scheduleReboot('watchdog');
      }
    }
  }

  // ── Reboot ───────────────────────────────────────────────────────────────────
  _scheduleReboot(reason) {
    if (this._rebooting) return;
    this._rebooting = true;
    this.rebootCount++;
    this.status = 'rebooting';
    this.failureStreak = 0;
    const delay = 2_000 + Math.random() * 3_000;
    log({ event: 'reboot.start', screen_id: this.id, reason, delay_ms: Math.round(delay) });
    setTimeout(() => {
      this._rebooting = false;
      this.lastChecksum = null;
      this.status = 'booting';
      log({ event: 'reboot.complete', screen_id: this.id });
    }, delay);
  }

  // ── Run loop ─────────────────────────────────────────────────────────────────
  async run() {
    await this.register();
    log({ event: 'boot', screen_id: this.id, player_version: this.playerVersion });
    this.status = 'online';

    // Jitter startup
    await sleep(Math.floor(Math.random() * POLL_INTERVAL_MS));

    while (this._alive) {
      await this.poll();
      await sleep(POLL_INTERVAL_MS);
    }
  }

  stop() { this._alive = false; }

  // ── Status snapshot ───────────────────────────────────────────────────────────
  toStatus() {
    const lats = this.latencies;
    const sorted = [...lats].sort((a, b) => a - b);
    return {
      screen_id:        this.id,
      status:           this.status,
      player_version:   this.playerVersion,
      last_checksum:    this.lastChecksum,
      last_success_ago_s: this.lastSuccessAt ? Math.round((Date.now() - this.lastSuccessAt) / 1000) : null,
      uptime_s:         Math.round((Date.now() - this.startedAt) / 1000),
      reboot_count:     this.rebootCount,
      recovery_count:   this.recoveryCount,
      total_polls:      this.totalPolls,
      poll_success_rate: this.totalPolls ? ((this.successPolls / this.totalPolls) * 100).toFixed(1) : null,
      avg_latency_ms:   lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : null,
      p95_latency_ms:   sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : null,
      media_failures:   this.mediaFailures,
      stale_events:     this.staleEvents,
      ota_version:      this.playerVersion,
      ota_attempts:     this.otaAttempts,
      cache_items:      this.cachedManifest?.items?.length ?? null,
    };
  }
}

// ── Fleet ─────────────────────────────────────────────────────────────────────
const screens = new Map();
for (let i = 1; i <= SCREEN_COUNT; i++) {
  const id = `${SCREEN_PREFIX}-${String(i).padStart(2, '0')}`;
  screens.set(id, new SoakScreen(id));
}

// Start all screen loops concurrently
for (const screen of screens.values()) {
  screen.run().catch(e => log({ event: 'screen.fatal', screen_id: screen.id, error: e.message }));
}

log({ event: 'soak.start', screen_count: SCREEN_COUNT, backend: BACKEND, duration_s: SOAK_DURATION_S || 'infinite', fault_interval_ms: FAULT_INTERVAL_MS });

// ── Fault Injector ─────────────────────────────────────────────────────────────
const FAULT_SEQUENCE = [
  { type: 'nominal',       params: {},                   durationMs: 60_000, label: 'Nominal conditions' },
  { type: 'slow',          params: { latencyMs: 1500 },  durationMs: 45_000, label: 'Slow backend (1.5s latency)' },
  { type: 'jitter',        params: { baseMs: 200, jitterMs: 800 }, durationMs: 45_000, label: 'Network jitter' },
  { type: 'packet_loss',   params: { rate: 0.15 },       durationMs: 30_000, label: 'Packet loss 15%' },
  { type: 'nominal',       params: {},                   durationMs: 30_000, label: 'Recovery window' },
  { type: 'offline',       params: {},                   durationMs: 30_000, label: 'Backend offline (30s)' },
  { type: 'nominal',       params: {},                   durationMs: 45_000, label: 'Recovery window' },
  { type: 'dns_fail',      params: { rate: 0.5 },        durationMs: 20_000, label: 'DNS failures 50%' },
  { type: 'captive_portal',params: { rate: 0.3 },        durationMs: 20_000, label: 'Captive portal 30%' },
  { type: 'nominal',       params: {},                   durationMs: 60_000, label: 'Long nominal window' },
  { type: 'slow',          params: { latencyMs: 4000 },  durationMs: 30_000, label: 'Very slow backend (4s)' },
  { type: 'packet_loss',   params: { rate: 0.4 },        durationMs: 20_000, label: 'Heavy packet loss 40%' },
  { type: 'nominal',       params: {},                   durationMs: 60_000, label: 'Recovery + baseline' },
];

let _faultIdx = 0;

async function runFaultInjector() {
  while (true) {
    const fault = FAULT_SEQUENCE[_faultIdx % FAULT_SEQUENCE.length];
    _faultIdx++;

    log({ event: 'fault.injecting', type: fault.type, label: fault.label, duration_ms: fault.durationMs });
    globalShim.setCondition(fault.type, fault.params);

    // Clock drift: randomly add offset during slow/offline faults
    if (['slow', 'offline'].includes(fault.type)) {
      globalShim.conditions.clockOffsetMs = (Math.random() - 0.5) * 10_000; // ±5s
    } else {
      globalShim.conditions.clockOffsetMs = 0;
    }

    processMetrics.faultsInjected.push({
      ts: Date.now(), type: fault.type, label: fault.label,
      params: fault.params, affected: SCREEN_COUNT,
    });

    await sleep(fault.durationMs);

    globalShim.setCondition('nominal');
    globalShim.conditions.clockOffsetMs = 0;
    log({ event: 'fault.cleared', type: fault.type });

    // OTA rollout: trigger periodically
    if (ENABLE_OTA && _faultIdx % 5 === 0 && !otaRollout.active) {
      const currentVersionIdx = VERSIONS.indexOf(otaRollout.targetVersion);
      if (currentVersionIdx < VERSIONS.length - 1) {
        otaRollout.targetVersion = VERSIONS[currentVersionIdx + 1];
        otaRollout.rolloutPct    = 30;   // staged: start at 30%
        otaRollout.active        = true;
        otaRollout.failedScreens.clear();
        log({ event: 'ota.rollout_started', version: otaRollout.targetVersion, pct: otaRollout.rolloutPct });

        // Expand rollout after 3 cycles
        setTimeout(() => {
          otaRollout.rolloutPct = 70;
          log({ event: 'ota.rollout_expanded', version: otaRollout.targetVersion, pct: 70 });
        }, FAULT_INTERVAL_MS * 3);

        setTimeout(() => {
          otaRollout.rolloutPct = 100;
          otaRollout.active     = false;
          otaRollout.completedAt = Date.now();
          log({ event: 'ota.rollout_complete', version: otaRollout.targetVersion });
        }, FAULT_INTERVAL_MS * 6);
      }
    }

    // Media fault injection: cycle through modes
    if (ENABLE_MEDIA && _faultIdx % 7 === 0) {
      const mode = Math.floor(Math.random() * 5);
      Object.assign(mediaFaults, { missingRate: 0, corruptRate: 0, oversizedRate: 0, slowRate: 0, partialRate: 0, storageExhausted: false });
      if (mode === 0) mediaFaults.missingRate   = 0.2;
      if (mode === 1) mediaFaults.corruptRate   = 0.15;
      if (mode === 2) mediaFaults.slowRate      = 0.3;
      if (mode === 3) mediaFaults.partialRate   = 0.1;
      if (mode === 4) mediaFaults.oversizedRate = 0.2;
      log({ event: 'media.fault_mode', mode, config: { ...mediaFaults } });
      setTimeout(() => {
        Object.assign(mediaFaults, { missingRate: 0, corruptRate: 0, oversizedRate: 0, slowRate: 0, partialRate: 0 });
        log({ event: 'media.fault_cleared' });
      }, 30_000);
    }

    await sleep(5_000); // brief quiet period between faults
  }
}

runFaultInjector().catch(e => log({ event: 'fault_injector.error', error: e.message }));

// ── Metrics snapshots ─────────────────────────────────────────────────────────
const metricsFile = path.join(REPORT_DIR, `metrics-${soakStartTs}.jsonl`);

setInterval(() => {
  const mem = process.memoryUsage();
  const snap = {
    ts:            Date.now(),
    rss_mb:        Math.round(mem.rss / 1024 / 1024),
    heap_used_mb:  Math.round(mem.heapUsed / 1024 / 1024),
    heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    event_loop_lag_ms: processMetrics.eventLoopLagMs,
    network_condition: globalShim.summary(),
    screens: [...screens.values()].map(s => ({
      id: s.id,
      status: s.status,
      poll_success_rate: s.totalPolls ? (s.successPolls / s.totalPolls * 100).toFixed(1) : null,
      reboots: s.rebootCount,
      stale_events: s.staleEvents,
      media_failures: s.mediaFailures,
      ota_version: s.playerVersion,
    })),
  };
  processMetrics.snapshots.push(snap);
  if (processMetrics.snapshots.length > 2000) processMetrics.snapshots.shift();

  try {
    fs.appendFileSync(metricsFile, JSON.stringify(snap) + '\n');
  } catch { /* ignore write errors */ }
}, METRICS_INTERVAL);

// ── Management HTTP API ───────────────────────────────────────────────────────
function jsonRes(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req) {
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => { d += c; });
    req.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const { url, method } = req;

  if (method === 'GET' && url === '/status') {
    const ss = [...screens.values()];
    const mem = process.memoryUsage();
    return jsonRes(res, 200, {
      soak_running_s:   Math.round((Date.now() - soakStartMs) / 1000),
      screen_count:     ss.length,
      network_condition: globalShim.summary(),
      ota:              { active: otaRollout.active, version: otaRollout.targetVersion, pct: otaRollout.rolloutPct },
      process: {
        rss_mb:        Math.round(mem.rss / 1024 / 1024),
        heap_used_mb:  Math.round(mem.heapUsed / 1024 / 1024),
        event_loop_lag_ms: processMetrics.eventLoopLagMs,
      },
      fault_cycles:     _faultIdx,
      faults_injected:  processMetrics.faultsInjected.length,
      ota_events:       processMetrics.otaEvents.length,
      media_events:     processMetrics.mediaEvents.length,
      screens:          ss.map(s => s.toStatus()),
    });
  }

  if (method === 'GET' && url === '/health') {
    return jsonRes(res, 200, { ok: true, uptime_s: Math.round((Date.now() - soakStartMs) / 1000) });
  }

  if (method === 'POST' && url === '/fault') {
    const body = await readBody(req);
    globalShim.setCondition(body.type || 'nominal', body.params || {});
    log({ event: 'fault.manual', type: body.type, params: body.params });
    return jsonRes(res, 200, { ok: true, condition: globalShim.summary() });
  }

  if (method === 'POST' && url === '/fault/clear') {
    globalShim.clear();
    return jsonRes(res, 200, { ok: true, condition: 'nominal' });
  }

  if (method === 'POST' && url === '/ota') {
    const body = await readBody(req);
    otaRollout.targetVersion = body.version || '1.1.0';
    otaRollout.rolloutPct    = body.pct || 100;
    otaRollout.active        = true;
    otaRollout.failedScreens.clear();
    log({ event: 'ota.manual_trigger', ...body });
    return jsonRes(res, 200, { ok: true, rollout: otaRollout });
  }

  if (method === 'POST' && url === '/reboot-all') {
    for (const s of screens.values()) s._scheduleReboot('manual');
    return jsonRes(res, 200, { ok: true, count: screens.size });
  }

  if (method === 'POST' && url.startsWith('/reboot/')) {
    const id = decodeURIComponent(url.slice('/reboot/'.length));
    const s  = screens.get(id);
    if (!s) return jsonRes(res, 404, { error: 'not found' });
    s._scheduleReboot('manual');
    return jsonRes(res, 200, { ok: true, screen_id: id });
  }

  if (method === 'GET' && url === '/report') {
    return jsonRes(res, 200, buildReport());
  }

  jsonRes(res, 404, { error: 'not found' });
});

const soakStartMs = Date.now();
server.listen(STATUS_PORT, '0.0.0.0', () => {
  log({ event: 'soak.api_ready', port: STATUS_PORT });
});

// ── Report builder ────────────────────────────────────────────────────────────
function buildReport() {
  const durationS = Math.round((Date.now() - soakStartMs) / 1000);
  const ss = [...screens.values()];
  const snaps = processMetrics.snapshots;

  // Uptime % = avg poll success rate across all screens
  const uptimePct = ss.length
    ? ss.reduce((a, s) => a + (s.totalPolls ? (s.successPolls / s.totalPolls) * 100 : 100), 0) / ss.length
    : 100;

  // Memory growth: first vs last snapshot
  const memGrowthMb = snaps.length >= 2
    ? snaps[snaps.length - 1].heap_used_mb - snaps[0].heap_used_mb
    : 0;

  // p95 event loop lag across all snapshots
  const lagSamples = snaps.map(s => s.event_loop_lag_ms).sort((a, b) => a - b);
  const p95Lag = lagSamples.length ? lagSamples[Math.floor(lagSamples.length * 0.95)] : 0;

  // Total divergence = screens with checksumHistory having gaps
  const totalDivergence = ss.reduce((a, s) => a + s.divergenceCount, 0);
  const totalStale      = ss.reduce((a, s) => a + s.staleEvents, 0);
  const totalReboots    = ss.reduce((a, s) => a + s.rebootCount, 0);
  const totalRecoveries = ss.reduce((a, s) => a + s.recoveryCount, 0);
  const totalMediaFails = ss.reduce((a, s) => a + s.mediaFailures, 0);
  const totalOtaEvents  = processMetrics.otaEvents.length;
  const otaSuccesses    = processMetrics.otaEvents.filter(e => e.success).length;

  // Stability score (0–100): weighted combination
  const uptimeScore     = Math.min(100, uptimePct);
  const rebootScore     = Math.max(0, 100 - (totalReboots / Math.max(1, ss.length)) * 5);
  const staleScore      = Math.max(0, 100 - totalStale * 2);
  const memScore        = Math.max(0, 100 - Math.max(0, memGrowthMb) * 2);
  const lagScore        = Math.max(0, 100 - p95Lag / 10);
  const stabilityScore  = (uptimeScore * 0.4 + rebootScore * 0.25 + staleScore * 0.15 + memScore * 0.1 + lagScore * 0.1).toFixed(1);

  // Recommendations
  const recommendations = [];
  if (uptimePct < 95) recommendations.push('Poll success rate below 95% — investigate network stability or backend reliability');
  if (memGrowthMb > 20) recommendations.push(`Memory grew ${memGrowthMb}MB — check for leaks in manifest engine or schedule queries`);
  if (p95Lag > 100) recommendations.push(`p95 event loop lag ${p95Lag}ms — backend may be CPU-bound under load`);
  if (totalStale > 5) recommendations.push(`${totalStale} stale manifest events — check scheduling gaps or content coverage`);
  if (totalDivergence > 0) recommendations.push(`${totalDivergence} checksum divergence incidents — screens may be showing different content`);
  if (otaEvents.length && (otaSuccesses / totalOtaEvents) < 0.8) recommendations.push('OTA success rate below 80% — review update compatibility checks');
  if (recommendations.length === 0) recommendations.push('All metrics nominal. Ready for production deployment.');

  return {
    generated_at:      new Date().toISOString(),
    soak_duration_s:   durationS,
    stability_score:   parseFloat(stabilityScore),
    summary: {
      uptime_pct:           parseFloat(uptimePct.toFixed(2)),
      total_reboots:        totalReboots,
      total_recoveries:     totalRecoveries,
      avg_recovery_per_screen: (totalRecoveries / Math.max(1, ss.length)).toFixed(1),
      stale_screen_incidents: totalStale,
      divergence_count:     totalDivergence,
      media_failures:       totalMediaFails,
      memory_growth_mb:     memGrowthMb,
      p95_event_loop_lag_ms: p95Lag,
      faults_injected:      processMetrics.faultsInjected.length,
      ota_events:           totalOtaEvents,
      ota_success_rate_pct: totalOtaEvents ? parseFloat((otaSuccesses / totalOtaEvents * 100).toFixed(1)) : null,
    },
    screens: ss.map(s => s.toStatus()),
    fault_history: processMetrics.faultsInjected.slice(-20),
    ota_history:   processMetrics.otaEvents.slice(-20),
    recommendations,
  };
}

// ── Duration timer ────────────────────────────────────────────────────────────
if (SOAK_DURATION_S > 0) {
  setTimeout(() => shutdown('duration_complete'), SOAK_DURATION_S * 1000);
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(reason) {
  log({ event: 'soak.stopping', reason });
  for (const s of screens.values()) s.stop();

  const report = buildReport();
  const reportFile = path.join(REPORT_DIR, `report-${soakStartTs}.json`);
  try {
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    log({ event: 'soak.report_written', file: reportFile, stability_score: report.stability_score });
  } catch (e) {
    log({ event: 'soak.report_error', error: e.message });
  }

  server.close();
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Helpers ───────────────────────────────────────────────────────────────────
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
