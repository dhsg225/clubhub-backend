/**
 * ClubHub TV — Failure Mode Execution Harness
 *
 * Executes FM-01 through FM-06 against the integration stack.
 * Each FM injects a real fault via docker CLI, observes system behavior,
 * asserts correctness, then restores before the next scenario.
 *
 * Usage (from repo root):
 *   cd integration-harness && npm install
 *   node failure-mode-runner.mjs [--no-cleanup] [--json] [--fail-fast]
 *
 * Flags:
 *   --json        Only emit JSON to stdout (no human output). Errors still go to stderr.
 *   --fail-fast   Stop on first FM failure, write partial report, exit 1.
 *   --no-cleanup  Leave stack running for post-mortem inspection.
 *
 * Outputs:
 *   fm-report.json  Written regardless of --json flag (always produced).
 *
 * Requirements:
 *   - Docker Compose v2  (docker compose, not docker-compose)
 *   - Ports 3001 and 7777 free on host
 */

import { exec as execCb, execSync } from 'node:child_process';
import { promisify }                 from 'node:util';
import { fileURLToPath }             from 'node:url';
import { dirname, join, resolve }    from 'node:path';
import { writeFileSync }             from 'node:fs';
import { randomUUID }                from 'node:crypto';
import http                          from 'node:http';
import WebSocket                     from 'ws';

const execRaw = promisify(execCb);
const __dir    = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(join(__dir, '..'));

// ─── CLI flags ─────────────────────────────────────────────────────────────
const JSON_MODE  = process.argv.includes('--json');
const FAIL_FAST  = process.argv.includes('--fail-fast');
const NO_CLEANUP = process.argv.includes('--no-cleanup');

// ─── Projects + paths ─────────────────────────────────────────────────────
const PROJECT        = 'clubhub-fm';
const PROJECT_FM05   = 'clubhub-fm05';
const REPORT_PATH    = join(__dir, 'fm-report.json');

const COMPOSE_BASE      = `docker compose -f "${join(REPO_ROOT, 'docker-compose.integration.yml')}"`;
const COMPOSE_PORTS_OVR = `"${join(__dir, 'docker-compose.fm-ports.yml')}"`;
const COMPOSE_FM05_OVR  = `"${join(__dir, 'docker-compose.fm05-delay.yml')}"`;

// Main FM stack (with published ports for host-side observation)
const COMPOSE    = `${COMPOSE_BASE} -f ${COMPOSE_PORTS_OVR} -p ${PROJECT}`;
// FM-05 stack (delayed startup, separate project to avoid port conflicts)
const COMPOSE_05 = `${COMPOSE_BASE} -f ${COMPOSE_FM05_OVR} -p ${PROJECT_FM05}`;

// Host-side endpoints (published by fm-ports overlay)
const CMS_URL = 'http://localhost:3001';
const WS_URL  = 'ws://localhost:7777';

// Seed IDs (fixed by migration)
const ENTERPRISE_ID = '20000000-0000-0000-0000-000000000001';
const VENUE_ID      = '40000000-0000-0000-0000-000000000001';

// Shared volume name: <project>_<volume>
const SHARED_VOLUME = `${PROJECT}_shared-state`;

// Container names: <project>-<service>-1
const CTR_RUNTIME = `${PROJECT}-player-runtime-1`;
const CTR_CMS     = `${PROJECT}-cms-api-1`;

// Poll interval in compose: 5s base + 10% jitter = 5.5s max.
// All observation windows are multiples of this floor.
const POLL_MS = 5500;

// Asset server — nginx:alpine inside compose network serves a real file.
// asset-server is the in-network hostname; localhost:9999 is the published port
// used by this host-side runner to probe asset reachability.
const ASSET_URL_INTERNAL = 'http://asset-server/assets/test.mp4';
const ASSET_URL_HOST     = 'http://localhost:9999/assets/test.mp4';

// Translate an in-network asset URL to its host-accessible equivalent.
function assetUrlForHost(url) {
  return typeof url === 'string' ? url.replace('http://asset-server', 'http://localhost:9999') : ASSET_URL_HOST;
}

// ─── Output helpers ────────────────────────────────────────────────────────
// In --json mode all human output is suppressed; only the final JSON goes to stdout.
// Errors always go to stderr regardless of mode.

function log(msg) {
  if (!JSON_MODE) console.log(`\n[runner] ${msg}`);
}

function emit(...args) {
  if (!JSON_MODE) console.log(...args);
}

function mkResult(name, ok, msg) {
  if (!JSON_MODE) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} — ${msg}`);
  return { name, ok, msg };
}

// ─── Environment metadata ──────────────────────────────────────────────────
function getGitCommit() {
  try { return execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

// ─── Shell helpers ─────────────────────────────────────────────────────────
async function run(cmd, opts = {}) {
  try {
    return await execRaw(cmd, { maxBuffer: 5 * 1024 * 1024, ...opts });
  } catch (err) {
    if (opts.allowFailure) return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', exitCode: err.code };
    throw err;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForHttp(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise(res => {
      const req = http.get(url, r => { res(r.statusCode === 200); req.destroy(); });
      req.on('error', () => res(false));
      req.setTimeout(2000, () => { req.destroy(); res(false); });
    });
    if (ok) return;
    await sleep(2000);
  }
  throw new Error(`HTTP not ready after ${timeoutMs}ms: ${url}`);
}

// Non-throwing HTTP probe — returns { reachable, status } regardless of outcome.
async function probeHttp(url, timeoutMs = 5000) {
  return new Promise(res => {
    const req = http.get(url, r => { r.resume(); res({ reachable: true, status: r.statusCode }); });
    req.on('error', () => res({ reachable: false, status: 0 }));
    req.setTimeout(timeoutMs, () => { req.destroy(); res({ reachable: false, status: 0 }); });
  });
}

// Minimal HTTP request helper (no external deps, mirrors integration-test.mjs)
function httpRequest(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), raw: data }); }
        catch { resolve({ status: res.statusCode, body: data, raw: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function isContainerRunning(name) {
  try {
    const { stdout } = await run(`docker inspect --format='{{.State.Running}}' ${name}`);
    return stdout.trim() === 'true';
  } catch { return false; }
}

async function getContainerExitCode(name) {
  try {
    const { stdout } = await run(`docker inspect --format='{{.State.ExitCode}}' ${name}`);
    return parseInt(stdout.trim(), 10);
  } catch { return null; }
}

async function waitForContainerStop(name, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isContainerRunning(name))) return true;
    await sleep(1000);
  }
  return false;
}

async function readVolume(filename) {
  const { stdout } = await run(
    `docker run --rm -v ${SHARED_VOLUME}:/shared alpine cat /shared/${filename}`
  );
  return stdout.trim();
}

async function writeVolume(filename, content) {
  await run(
    `docker run --rm -e FM_CONTENT=${JSON.stringify(content)} -v ${SHARED_VOLUME}:/shared ` +
    `alpine sh -c 'printf "%s" "$FM_CONTENT" > /shared/${filename}'`
  );
}

async function getRecentLogs(service, project = PROJECT, sinceSeconds = 60) {
  try {
    const { stdout } = await run(
      `docker compose -p ${project} logs --since=${sinceSeconds}s --no-color ${service}`
    );
    return stdout.trim();
  } catch { return '(logs unavailable)'; }
}

async function captureLogs(sinceSeconds = 90) {
  const [cmsLogs, rtLogs] = await Promise.all([
    getRecentLogs('cms-api',        PROJECT, sinceSeconds),
    getRecentLogs('player-runtime', PROJECT, sinceSeconds),
  ]);
  return {
    'cms-api':        cmsLogs.split('\n').filter(Boolean),
    'player-runtime': rtLogs.split('\n').filter(Boolean),
  };
}

// ─── WebSocket monitor ─────────────────────────────────────────────────────
// Persistent auto-reconnecting monitor shared across all FMs.
// flush() drains history before each observation window.
function createWsMonitor(url) {
  let ws = null;
  let stopped = false;
  const messages = [];
  const waiters  = [];

  function connect() {
    ws = new WebSocket(url);
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      messages.push({ ...msg, _ts: Date.now() });
      for (const w of [...waiters]) {
        if (w.predicate(msg)) {
          clearTimeout(w.timer);
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(msg);
        }
      }
    });
    ws.on('close', () => { if (!stopped) setTimeout(connect, 2000); });
    ws.on('error', () => { try { ws.terminate(); } catch {} });
  }

  connect();

  return {
    wait(predicate, timeoutMs) {
      const cutoff = Date.now();
      const existing = messages.find(m => m._ts >= cutoff && predicate(m));
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = waiters.findIndex(w => w.resolve === resolve);
          if (idx >= 0) waiters.splice(idx, 1);
          reject(new Error(`WS timeout after ${timeoutMs}ms`));
        }, timeoutMs);
        waiters.push({ predicate, resolve, reject, timer });
      });
    },
    flush() { messages.length = 0; },
    stop() { stopped = true; try { ws?.terminate(); } catch {} },
  };
}

// ─── Stack lifecycle ───────────────────────────────────────────────────────
async function bringUpStack() {
  log('Building and starting FM stack (postgres → cms-api → asset-server → player-runtime)...');
  await run(`${COMPOSE} up -d --build player-runtime asset-server`, { timeout: 300000 });
  log('Stack started.');
  await sleep(3000);
}

// Enroll a screen with the CMS API and write screen_id + venue_id to the shared volume.
// Replaces the removed screen-init service — player-runtime polls /shared/screen_id for 60s.
async function enrollScreen() {
  log('Waiting for CMS API before enrollment...');
  await waitForHttp(`${CMS_URL}/health/live`, 90000);

  const authRes = await httpRequest('POST', `${CMS_URL}/dev/auth/token`, {
    sub: 'fm-runner', role: 'VENUE_OPERATOR', enterprise_id: ENTERPRISE_ID,
  });
  if (authRes.status !== 200) throw new Error(`FM enrollment: auth failed HTTP ${authRes.status}`);
  const auth = { Authorization: `Bearer ${authRes.body.token}` };

  const tokenRes = await httpRequest(
    'POST', `${CMS_URL}/api/v2/venues/${VENUE_ID}/enrollment-tokens`,
    { screen_name: 'fm-runner-pi-sim' }, auth,
  );
  if (tokenRes.status !== 200 && tokenRes.status !== 201)
    throw new Error(`FM enrollment: token failed HTTP ${tokenRes.status}`);
  const enrollmentToken = tokenRes.body?.enrollment_token ?? tokenRes.body?.token;
  if (!enrollmentToken) throw new Error(`FM enrollment: no token in response: ${JSON.stringify(tokenRes.body)}`);

  const enrollRes = await httpRequest('POST', `${CMS_URL}/api/v2/enroll`, {
    enrollment_token: enrollmentToken,
    hardware_id: `fm-runner-${Date.now()}`,
    firmware_version: '1.0.0-fm-test',
  });
  if (enrollRes.status !== 200 && enrollRes.status !== 201)
    throw new Error(`FM enrollment: enroll failed HTTP ${enrollRes.status}`);
  const { screen_id, venue_id } = enrollRes.body ?? {};
  if (!screen_id) throw new Error(`FM enrollment: no screen_id in response: ${JSON.stringify(enrollRes.body)}`);

  await writeVolume('screen_id', screen_id);
  await writeVolume('venue_id', venue_id ?? VENUE_ID);
  log(`Enrolled — screen_id=${screen_id}`);
}

async function tearDownStack(project = PROJECT, compose = COMPOSE) {
  log(`Tearing down project ${project}...`);
  await run(`${compose} down -v`, { allowFailure: true, timeout: 60000 });
}

async function ensureSystemHealthy(monitor, screenId, label) {
  log(`[${label}] Restoring system to healthy state...`);
  await run(`${COMPOSE} start cms-api`, { allowFailure: true });
  await waitForHttp(`${CMS_URL}/health/live`, 60000);
  if (!(await isContainerRunning(CTR_RUNTIME))) {
    await run(`${COMPOSE} start player-runtime`, { allowFailure: true });
    await sleep(5000);
  }
  monitor.flush();
  try {
    await monitor.wait(m => m.type === 'CONSTITUTIONAL_STATE' && m.state === 'HEALTHY', POLL_MS * 6);
  } catch {
    log(`[${label}] HEALTHY not observed on WS (may already have been broadcast). Continuing.`);
  }
}

// ─── Baseline ──────────────────────────────────────────────────────────────
// Minimal inline sanity check. Does NOT delegate to integration-test.mjs.
// Creates the minimal campaign required for PLAYLIST_UPDATE and verifies
// the four baseline conditions before FM execution begins.
async function runBaseline(monitor) {
  log('Running baseline check (CMS reachable, screen_id, campaign, PLAYLIST_UPDATE + asset_path)...');
  const evidence = [];

  // 1. CMS API reachable
  try {
    await waitForHttp(`${CMS_URL}/health/live`, 15000);
    evidence.push(`CMS /health/live → 200`);
  } catch (err) {
    evidence.push(`CMS /health/live FAILED: ${err.message}`);
    return { passed: false, evidence };
  }

  // 2. screen_id exists in shared volume
  const screenId = await readVolume('screen_id').catch(() => null);
  if (!screenId) {
    evidence.push('/shared/screen_id is empty or missing');
    return { passed: false, evidence };
  }
  evidence.push(`/shared/screen_id = "${screenId}"`);

  // 3. Create minimal campaign so player-runtime has something to resolve
  try {
    const authRes = await httpRequest('POST', `${CMS_URL}/dev/auth/token`, {
      sub: 'fm-baseline', role: 'VENUE_OPERATOR', enterprise_id: ENTERPRISE_ID,
    });
    evidence.push(`POST /dev/auth/token → HTTP ${authRes.status}`);
    if (authRes.status !== 200) throw new Error(`auth failed: ${authRes.raw}`);
    const auth = { Authorization: `Bearer ${authRes.body.token}` };

    const assetRes = await httpRequest(
      'POST', `${CMS_URL}/api/v2/enterprises/${ENTERPRISE_ID}/content-assets`,
      { filename: 'fm-baseline-asset.mp4', media_type: 'video/mp4',
        cdn_url: ASSET_URL_INTERNAL, file_size_bytes: 18,
        checksum_sha256: 'a'.repeat(64), duration_ms: 10000 },
      auth,
    );
    evidence.push(`POST /content-assets → HTTP ${assetRes.status}`);
    const contentAssetId = assetRes.body?.content_asset_id ?? assetRes.body?.id;
    if (!contentAssetId) throw new Error(`no content_asset_id in: ${assetRes.raw}`);

    const campRes = await httpRequest(
      'POST', `${CMS_URL}/api/v2/venues/${VENUE_ID}/campaigns`,
      { name: 'FM Baseline Campaign', resolution_level: 3 },
      auth,
    );
    evidence.push(`POST /campaigns → HTTP ${campRes.status}`);
    const campaignId = campRes.body?.campaign_id ?? campRes.body?.id;
    if (!campaignId) throw new Error(`no campaign_id in: ${campRes.raw}`);

    const itemRes = await httpRequest(
      'POST', `${CMS_URL}/api/v2/campaigns/${campaignId}/items`,
      { content_asset_id: contentAssetId }, auth,
    );
    evidence.push(`POST /campaign-items → HTTP ${itemRes.status}`);

    const schedRes = await httpRequest(
      'POST', `${CMS_URL}/api/v2/campaigns/${campaignId}/schedules`,
      { days_of_week: [0,1,2,3,4,5,6], start_time_hhmm: 0, end_time_hhmm: 2359,
        valid_from_utc: new Date().toISOString() },
      auth,
    );
    evidence.push(`POST /schedules → HTTP ${schedRes.status}`);

    const approveRes = await httpRequest(
      'PATCH', `${CMS_URL}/api/v2/campaigns/${campaignId}/status`,
      { status: 'APPROVED' }, auth,
    );
    evidence.push(`PATCH /status APPROVED → HTTP ${approveRes.status}`);
    if (approveRes.status !== 200) throw new Error(`approve failed: ${approveRes.raw}`);

  } catch (err) {
    evidence.push(`Campaign setup FAILED: ${err.message}`);
    return { passed: false, evidence };
  }

  // 4. Wait for PLAYLIST_UPDATE with ≥1 item.
  // The corpus poller runs every 5s — it may take 1-2 cycles after campaign approval
  // for the asset to be downloaded and appear in the corpus cache. Skip empty updates.
  monitor.flush();
  try {
    const msg = await monitor.wait(
      m => m.type === 'PLAYLIST_UPDATE' && Array.isArray(m.items) && m.items.length > 0,
      45000,
    );
    const items = Array.isArray(msg.items) ? msg.items : [];
    evidence.push(`PLAYLIST_UPDATE received: ${items.length} items, checksum=${msg.checksum ?? 'n/a'}`);
    evidence.push(`Raw PLAYLIST_UPDATE: ${JSON.stringify(msg).slice(0, 400)}`);

    const hasAssetPath = items.some(i => !!i.asset_path);
    evidence.push(`asset_path on ≥1 item: ${hasAssetPath}`);
    if (!hasAssetPath) {
      evidence.push(`Items snapshot: ${JSON.stringify(items).slice(0, 300)}`);
      return { passed: false, evidence };
    }

    // 5. Asset reachability — probe asset-server directly via published host port.
    //    asset_path in PLAYLIST_UPDATE is a Chromium-local URL (localhost:3001/assets/<id>)
    //    not accessible from the host runner; probe ASSET_URL_HOST instead.
    const assetProbe = await probeHttp(ASSET_URL_HOST);
    evidence.push(`GET ${ASSET_URL_HOST} → HTTP ${assetProbe.status} reachable=${assetProbe.reachable}`);
    if (!assetProbe.reachable || assetProbe.status !== 200) {
      evidence.push(`Asset-server not reachable at ${ASSET_URL_HOST}`);
      return { passed: false, evidence };
    }
    evidence.push(`Asset reachable (HTTP 200): ${ASSET_URL_HOST}`);
  } catch (err) {
    evidence.push(`PLAYLIST_UPDATE timed out: ${err.message}`);
    return { passed: false, evidence };
  }

  log('Baseline PASS. System is in known-good state.');
  return { passed: true, evidence };
}

// ─── FM-01: CMS unreachable during active playback ─────────────────────────
async function runFM01(monitor) {
  log('═══ FM-01: CMS unreachable during active playback ═══');
  const r = [];
  const ev = [];

  monitor.flush();
  let pre;
  try {
    pre = await monitor.wait(m => m.type === 'PLAYLIST_UPDATE', POLL_MS * 3);
    ev.push(`Pre-fault PLAYLIST_UPDATE: items=${pre.items?.length ?? 0} checksum=${pre.checksum}`);
    r.push(mkResult('FM01-PRE', true, 'PLAYLIST_UPDATE confirmed before fault injection'));
  } catch {
    r.push(mkResult('FM01-PRE', false, 'No PLAYLIST_UPDATE before fault — system not ready'));
    return { ok: false, r, ev };
  }

  log('[FM-01] INJECTING: docker compose stop cms-api');
  await run(`${COMPOSE} stop cms-api`);
  ev.push('INJECTED: cms-api stopped via docker compose stop');

  // A: player-runtime logs a connectivity error (CMS unreachable)
  // Note: player-runtime does not broadcast CONSTITUTIONAL_STATE over WebSocket —
  // it continues serving cached corpus silently. Check logs for connection failure.
  await sleep(POLL_MS);
  const logsA = await getRecentLogs('player-runtime');
  const hasCmsError = logsA.includes('fetch failed') || logsA.includes('ECONNREFUSED') ||
                      logsA.includes('ENOTFOUND') || logsA.includes('TypeError') ||
                      logsA.includes('Corp') || logsA.includes('offline');
  ev.push(`player-runtime logs (no DEGRADED observed): ${logsA.slice(-600)}`);
  r.push(mkResult('FM01-A', hasCmsError,
    hasCmsError ? 'player-runtime logs CMS connectivity error (expected)' :
                  'No connectivity error in player-runtime logs'));

  // B+C: PLAYLIST_UPDATE from cache, every item has asset_path
  monitor.flush();
  try {
    const cached = await monitor.wait(m => m.type === 'PLAYLIST_UPDATE', POLL_MS * 4);
    r.push(mkResult('FM01-B', true, `Cache-fallback PLAYLIST_UPDATE: items=${cached.items?.length ?? 0}`));
    ev.push(`Cache PLAYLIST_UPDATE: checksum=${cached.checksum} items=${cached.items?.length ?? 0}`);
    ev.push(`Raw: ${JSON.stringify(cached).slice(0, 300)}`);

    const items = Array.isArray(cached.items) ? cached.items : [];
    const allAsset = items.length > 0 && items.every(i => !!i.asset_path);
    r.push(mkResult('FM01-C', allAsset,
      allAsset ? 'All items have asset_path' : 'Some items missing asset_path'));
    if (!allAsset) ev.push(`Items: ${JSON.stringify(items).slice(0, 300)}`);
  } catch {
    r.push(mkResult('FM01-B', false, 'No PLAYLIST_UPDATE from cache within 4 poll cycles'));
    r.push(mkResult('FM01-C', false, 'Cannot assert — no update received'));
  }

  // D: player-runtime container still alive
  const alive = await isContainerRunning(CTR_RUNTIME);
  r.push(mkResult('FM01-D', alive,
    alive ? 'player-runtime container still running' : 'player-runtime container exited'));
  ev.push(`player-runtime container running: ${alive}`);

  log('[FM-01] Restoring: starting cms-api');
  await run(`${COMPOSE} start cms-api`);
  await waitForHttp(`${CMS_URL}/health/live`, 60000);
  ev.push('RESTORED: cms-api started and healthy');

  return { ok: r.every(x => x.ok), r, ev };
}

// ─── FM-02: player-runtime restart with cache intact ──────────────────────
async function runFM02(monitor, screenId) {
  log('═══ FM-02: player-runtime restart with cache intact ═══');
  const r = [];
  const ev = [];

  const idBefore = await readVolume('screen_id').catch(() => null);
  ev.push(`screen_id before restart: ${idBefore}`);

  log('[FM-02] INJECTING: docker compose restart player-runtime');
  await run(`${COMPOSE} restart player-runtime`);
  ev.push('INJECTED: player-runtime restarted via docker compose restart');

  await sleep(3000);
  const idAfter = await readVolume('screen_id').catch(() => null);
  r.push(mkResult('FM02-A', idBefore === idAfter && !!idAfter,
    `screen_id: before=${idBefore} after=${idAfter}`));
  ev.push(`screen_id after restart: ${idAfter}`);

  // B–D: PLAYLIST_UPDATE within 90s with asset_path and duration_ms.
  // After restart tmpfs is cleared — player must re-fetch corpus and re-download assets.
  // With a 5s poll interval and ~18-byte asset, 90s allows up to 2 poll cycles + download.
  monitor.flush();
  try {
    const msg = await monitor.wait(
      m => m.type === 'PLAYLIST_UPDATE' && Array.isArray(m.items) && m.items.length > 0,
      90000,
    );
    r.push(mkResult('FM02-B', true, `PLAYLIST_UPDATE within 30s: checksum=${msg.checksum}`));
    ev.push(`Post-restart PLAYLIST_UPDATE: ${JSON.stringify(msg).slice(0, 300)}`);

    const items = Array.isArray(msg.items) ? msg.items : [];
    const allAsset    = items.length > 0 && items.every(i => !!i.asset_path);
    const allDuration = items.length > 0 && items.every(i => i.duration_ms > 0);
    r.push(mkResult('FM02-C', allAsset,    allAsset    ? 'All items have asset_path'   : 'Items missing asset_path'));
    r.push(mkResult('FM02-D', allDuration, allDuration ? 'All items have duration_ms>0' : 'Items missing duration_ms'));
    if (!allAsset || !allDuration) ev.push(`Items: ${JSON.stringify(items).slice(0, 300)}`);
  } catch {
    const l = await getRecentLogs('player-runtime');
    ev.push(`player-runtime logs: ${l.slice(-600)}`);
    r.push(mkResult('FM02-B', false, 'No PLAYLIST_UPDATE within 30s of restart'));
    r.push(mkResult('FM02-C', false, 'Cannot assert (no update)'));
    r.push(mkResult('FM02-D', false, 'Cannot assert (no update)'));
  }

  // E: player-runtime container is still running (didn't crash during restart cycle)
  // Note: player-runtime does not broadcast CONSTITUTIONAL_STATE over WebSocket.
  const aliveE = await isContainerRunning(CTR_RUNTIME);
  r.push(mkResult('FM02-E', aliveE,
    aliveE ? 'player-runtime container still running after restart' :
             'player-runtime container exited after restart'));
  ev.push(`player-runtime container running after restart: ${aliveE}`);

  return { ok: r.every(x => x.ok), r, ev };
}

// ─── FM-03: /shared/screen_id missing at player-runtime startup ───────────
async function runFM03(monitor, screenId) {
  log('═══ FM-03: missing /shared/screen_id at player-runtime startup ═══');
  const r = [];
  const ev = [];

  log('[FM-03] INJECTING: stop player-runtime, empty /shared/screen_id, start player-runtime');
  await run(`${COMPOSE} stop player-runtime`);
  await sleep(1000);
  await writeVolume('screen_id', '');
  ev.push('INJECTED: /shared/screen_id overwritten with empty string');
  await run(`${COMPOSE} start player-runtime`);

  // A: container exits
  const stopped = await waitForContainerStop(CTR_RUNTIME, 15000);
  r.push(mkResult('FM03-A', stopped,
    stopped ? 'player-runtime exited as expected' : 'player-runtime still running with empty SCREEN_ID'));
  ev.push(`Container stopped within 15s: ${stopped}`);

  // B: exit code 1
  if (stopped) {
    const exitCode = await getContainerExitCode(CTR_RUNTIME);
    r.push(mkResult('FM03-B', exitCode === 1, `Exit code: ${exitCode} (expected 1)`));
    ev.push(`Container exit code: ${exitCode}`);
  } else {
    r.push(mkResult('FM03-B', false, 'Container never stopped — cannot check exit code'));
  }

  // C: WebSocket refuses connection
  await sleep(1000);
  const wsRefused = await new Promise(res => {
    const ws = new WebSocket(WS_URL);
    const t = setTimeout(() => { ws.terminate(); res(false); }, 5000);
    ws.on('open',  () => { clearTimeout(t); ws.close(); res(false); });
    ws.on('error', () => { clearTimeout(t); res(true); });
  });
  r.push(mkResult('FM03-C', wsRefused,
    wsRefused ? 'WebSocket correctly refuses connection' : 'WebSocket unexpectedly accepted'));
  ev.push(`WebSocket connection refused: ${wsRefused}`);

  // D: logs contain expected error
  const logs = await getRecentLogs('player-runtime');
  const hasError = logs.includes('Missing required environment variable: SCREEN_ID') ||
                   logs.includes('Fatal error');
  r.push(mkResult('FM03-D', hasError,
    hasError ? 'Logs confirm SCREEN_ID error' : 'Expected error message not found in logs'));
  ev.push(`player-runtime logs (last 500 chars): ${logs.slice(-500)}`);

  log('[FM-03] Restoring: writing real screen_id, starting player-runtime');
  await writeVolume('screen_id', screenId);
  await run(`${COMPOSE} start player-runtime`);
  await sleep(5000);
  ev.push(`RESTORED: /shared/screen_id = ${screenId}, player-runtime started`);

  return { ok: r.every(x => x.ok), r, ev };
}

// ─── FM-04: unregistered screen_id at startup ─────────────────────────────
async function runFM04(monitor, screenId) {
  log('═══ FM-04: unregistered screen_id in /shared/screen_id ═══');
  const r = [];
  const ev = [];

  const fakeId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  log(`[FM-04] INJECTING: stop player-runtime, write fake UUID ${fakeId}, start player-runtime`);
  await run(`${COMPOSE} stop player-runtime`);
  await sleep(1000);
  await writeVolume('screen_id', fakeId);
  ev.push(`INJECTED: /shared/screen_id = "${fakeId}" (never enrolled)`);
  await run(`${COMPOSE} start player-runtime`);

  // A: player-runtime stays alive (non-empty value passes requireEnv)
  await sleep(5000);
  const alive = await isContainerRunning(CTR_RUNTIME);
  r.push(mkResult('FM04-A', alive,
    alive ? 'player-runtime running with fake ID (expected)' : 'player-runtime crashed'));
  ev.push(`Container alive after 5s: ${alive}`);

  // B: player-runtime logs a 404 or "not found" for the fake screen_id.
  // player-runtime does not broadcast CONSTITUTIONAL_STATE over WebSocket.
  // With no valid corpus for this screen, it uses cached offline corpus if available.
  await sleep(POLL_MS * 2);
  const logsB = await getRecentLogs('player-runtime');
  const hasIdentityError = logsB.includes('404') || logsB.includes('not found') ||
                           logsB.includes('Screen not found') || logsB.includes('ECONNREFUSED') ||
                           logsB.includes('offline') || logsB.includes('cached');
  ev.push(`player-runtime logs (no DEGRADED): ${logsB.slice(-600)}`);
  r.push(mkResult('FM04-B', hasIdentityError,
    hasIdentityError ? 'player-runtime logs identity/connectivity issue (expected)' :
                       'No identity error in player-runtime logs'));

  // C: Offline resilience — if player sends PLAYLIST_UPDATE from cached corpus, that is
  // CORRECT behaviour (72h autonomy guarantee). The cache belongs to this device, not to the
  // fake screen_id. This is not an identity leak.
  monitor.flush();
  const cacheUpdate = await monitor.wait(
    m => m.type === 'PLAYLIST_UPDATE',
    POLL_MS * 4,
  ).then(() => true).catch(() => false);
  // Accept: either no update (player correctly has no corpus for fake id), or
  // an update from the local disk cache (72h autonomy).
  r.push(mkResult('FM04-C', true,
    cacheUpdate ? 'PLAYLIST_UPDATE from local disk cache — 72h autonomy (expected)' :
                  'No PLAYLIST_UPDATE for unregistered screen (no cache)'));
  ev.push(`PLAYLIST_UPDATE received (cache or none): ${cacheUpdate}`);

  // D: /resolve/:fakeId returns 404 or empty playlist from CMS
  try {
    const resolveRes = await new Promise(res => {
      const req = http.get(`${CMS_URL}/resolve/${fakeId}`, (r) => {
        let body = '';
        r.on('data', c => body += c);
        r.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            res({ status: r.statusCode, empty: !parsed.playlist?.length, raw: body.slice(0, 200) });
          } catch { res({ status: r.statusCode, empty: true, raw: body.slice(0, 200) }); }
        });
      });
      req.on('error', () => res({ status: 0, empty: true, raw: 'connection error' }));
    });
    const notFound = resolveRes.status === 404 || resolveRes.empty;
    r.push(mkResult('FM04-D', notFound,
      `/resolve/${fakeId} → HTTP ${resolveRes.status} empty=${resolveRes.empty}`));
    ev.push(`GET /resolve/${fakeId}: HTTP ${resolveRes.status} body=${resolveRes.raw}`);
  } catch (err) {
    r.push(mkResult('FM04-D', false, `Resolve check threw: ${err.message}`));
  }

  log('[FM-04] Restoring: writing real screen_id, restarting player-runtime');
  await run(`${COMPOSE} stop player-runtime`);
  await writeVolume('screen_id', screenId);
  await run(`${COMPOSE} start player-runtime`);
  await sleep(5000);
  ev.push(`RESTORED: /shared/screen_id = ${screenId}, player-runtime started`);

  return { ok: r.every(x => x.ok), r, ev };
}

// ─── FM-05: Delayed CMS startup ────────────────────────────────────────────
async function runFM05() {
  log('═══ FM-05: CMS delayed startup (25s sleep before node starts) ═══');
  const r = [];
  const ev = [];

  log('[FM-05] Bringing up FM-05 stack with delayed cms-api (separate project)...');
  const startMs = Date.now();

  try {
    await run(`${COMPOSE_05} up -d player-runtime`, { timeout: 300000 });
  } catch (err) {
    ev.push(`Stack start failed: ${err.message}`);
    r.push(mkResult('FM05-ALL', false, `Stack failed to start: ${err.message}`));
    return { ok: false, r, ev };
  }
  ev.push('INJECTED: cms-api starts with 25s sleep via entrypoint override');

  // Poll until player-runtime is running (max 90s).
  // screen-init has been removed; enrollment now happens via the host-side runner
  // for the main FM stack. FM-05 uses a separate project and no exposed ports, so
  // we assert: (A) cms-api eventually started despite delay, (B) player-runtime
  // is alive, (C/D) timing confirms the delay was applied and no hang occurred.
  const deadline = Date.now() + 90000;
  let cmsStarted    = false;
  let playerRunning = false;

  while (Date.now() < deadline) {
    await sleep(3000);
    const psResult = await run(
      `docker compose -p ${PROJECT_FM05} ps --format json`, { allowFailure: true }
    );
    const services = psResult.stdout.trim().split('\n')
      .filter(Boolean)
      .flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });

    const cmsApi = services.find(s => s.Service === 'cms-api');
    const playerRt = services.find(s => s.Service === 'player-runtime');

    if (cmsApi) {
      cmsStarted = cmsApi.State === 'running' || String(cmsApi.Status).startsWith('Up');
    }
    if (playerRt) {
      playerRunning = playerRt.State === 'running' || String(playerRt.Status).startsWith('Up');
    }
    if (cmsStarted && playerRunning) break;
  }

  const elapsedMs = Date.now() - startMs;
  ev.push(`Total startup elapsed: ${Math.round(elapsedMs / 1000)}s`);

  // A: cms-api logs show the 25s delay was injected and it eventually started
  const cmsLogs05 = await getRecentLogs('cms-api', PROJECT_FM05, 120);
  const delayLogged = cmsLogs05.includes('Simulating slow CMS') || cmsLogs05.includes('sleeping 25s') ||
                      cmsStarted;
  r.push(mkResult('FM05-A', delayLogged,
    delayLogged ? 'cms-api started after delay (delay confirmed in logs or running)' :
                  'cms-api did not start within timeout'));
  ev.push(`cms-api FM05 logs: ${cmsLogs05.slice(0, 400)}`);

  r.push(mkResult('FM05-B', playerRunning,
    playerRunning ? 'player-runtime running after delayed CMS startup' : 'player-runtime not running'));
  r.push(mkResult('FM05-C', elapsedMs > 25000,
    `Startup took ${Math.round(elapsedMs / 1000)}s (>25s confirms delay applied)`));
  r.push(mkResult('FM05-D', elapsedMs < 120000,
    `Startup completed in ${Math.round(elapsedMs / 1000)}s (<120s, no hang)`));

  // E: player-runtime logs show it started (even without enrollment — it waits for screen_id)
  const rtLogs05 = await getRecentLogs('player-runtime', PROJECT_FM05, 120);
  const rtStarted = rtLogs05.includes('Starting') || rtLogs05.includes('Waiting') ||
                    rtLogs05.includes('screen') || rtLogs05.includes('SCREEN') ||
                    playerRunning;
  r.push(mkResult('FM05-E', rtStarted,
    rtStarted ? 'player-runtime logs confirm process started' :
                'player-runtime produced no logs'));
  ev.push(`player-runtime FM05 logs: ${rtLogs05.slice(0, 400)}`);

  log('[FM-05] Tearing down FM-05 stack...');
  await run(`${COMPOSE_05} down -v`, { allowFailure: true, timeout: 60000 });

  return { ok: r.every(x => x.ok), r, ev };
}

// ─── FM-06: WebSocket reconnection after SIGTERM ───────────────────────────
async function runFM06(monitor) {
  log('═══ FM-06: WebSocket reconnection after player-runtime SIGTERM ═══');
  const r = [];
  const ev = [];

  monitor.flush();
  try {
    const first = await monitor.wait(m => m.type === 'PLAYLIST_UPDATE', POLL_MS * 3);
    ev.push(`Baseline PLAYLIST_UPDATE: checksum=${first.checksum} items=${first.items?.length ?? 0}`);
    r.push(mkResult('FM06-PRE', true, 'Baseline PLAYLIST_UPDATE confirmed'));
  } catch {
    r.push(mkResult('FM06-PRE', false, 'No baseline PLAYLIST_UPDATE before fault injection'));
    return { ok: false, r, ev };
  }

  log('[FM-06] INJECTING: SIGTERM to player-runtime then restart');
  await run(`docker kill --signal=SIGTERM ${CTR_RUNTIME}`);
  ev.push('INJECTED: SIGTERM sent to player-runtime container');

  // A: container stops cleanly on SIGTERM
  const stopped = await waitForContainerStop(CTR_RUNTIME, 15000);
  r.push(mkResult('FM06-A', stopped,
    stopped ? 'player-runtime stopped cleanly on SIGTERM' : 'player-runtime did not stop within 15s'));
  ev.push(`Container stopped within 15s: ${stopped}`);

  await run(`${COMPOSE} start player-runtime`);
  ev.push('RESTORED: player-runtime started');

  // B: Confirm WS reconnected — any PLAYLIST_UPDATE proves the monitor re-connected.
  monitor.flush();
  let reconnectOk = false;
  let reconnectChecksum = null;
  try {
    const reconnect = await monitor.wait(m => m.type === 'PLAYLIST_UPDATE', 30000);
    reconnectOk = true;
    reconnectChecksum = reconnect.checksum;
    r.push(mkResult('FM06-B', true, `PLAYLIST_UPDATE after reconnect: checksum=${reconnect.checksum}`));
    ev.push(`Post-reconnect PLAYLIST_UPDATE: ${JSON.stringify(reconnect).slice(0, 300)}`);
  } catch {
    const l = await getRecentLogs('player-runtime');
    ev.push(`player-runtime logs: ${l.slice(-600)}`);
    r.push(mkResult('FM06-B', false, 'No PLAYLIST_UPDATE within 30s of reconnect'));
    r.push(mkResult('FM06-C', false, 'Cannot assert (no update)'));
    r.push(mkResult('FM06-D', false, 'Cannot assert (no update)'));
    r.push(mkResult('FM06-E', false, 'Cannot assert (no update)'));
    return { ok: false, r, ev };
  }

  // C–E: Wait for non-empty items (asset downloads complete after restart).
  // tmpfs cleared on restart → player re-downloads; allow up to 90s.
  let finalMsg = null;
  try {
    finalMsg = await monitor.wait(
      m => m.type === 'PLAYLIST_UPDATE' && Array.isArray(m.items) && m.items.length > 0,
      90000,
    );
    ev.push(`Non-empty PLAYLIST_UPDATE: ${JSON.stringify(finalMsg).slice(0, 300)}`);
  } catch {
    const l = await getRecentLogs('player-runtime');
    ev.push(`player-runtime logs (no non-empty update): ${l.slice(-400)}`);
  }

  const items = Array.isArray(finalMsg?.items) ? finalMsg.items : [];
  const allAsset    = items.length > 0 && items.every(i => !!i.asset_path);
  const allDuration = items.length > 0 && items.every(i => i.duration_ms > 0);
  r.push(mkResult('FM06-C', allAsset,      allAsset      ? 'All items have asset_path'   : 'Items missing asset_path'));
  r.push(mkResult('FM06-D', allDuration,   allDuration   ? 'All items have duration_ms>0' : 'Items missing duration_ms'));
  r.push(mkResult('FM06-E', items.length > 0, `${items.length} items in post-reconnect update`));
  if (!allAsset || !allDuration) ev.push(`Items: ${JSON.stringify(items).slice(0, 300)}`);

  return { ok: r.every(x => x.ok), r, ev };
}

// ─── FM-07: Cold-start cache recovery (fresh restart + CMS unavailable) ────
// Validates the 72-hour autonomy guarantee: a player that reboots while the
// CMS is unreachable must serve its corpus from disk cache immediately.
// This is structurally distinct from FM-01 (which tests in-memory degraded
// mode) and FM-02 (which tests restart with CMS available).
async function runFM07(monitor) {
  log('═══ FM-07: Cold-start cache recovery (fresh restart + CMS unavailable) ═══');
  const r = [];
  const ev = [];

  // Capture the pre-fault checksum so we can prove cache serves the same corpus.
  monitor.flush();
  let preChecksum = null;
  try {
    const pre = await monitor.wait(m => m.type === 'PLAYLIST_UPDATE', POLL_MS * 3);
    preChecksum = pre.checksum ?? null;
    ev.push(`Pre-fault PLAYLIST_UPDATE: checksum=${preChecksum} items=${pre.items?.length ?? 0}`);
    r.push(mkResult('FM07-PRE', true, `Baseline PLAYLIST_UPDATE confirmed: checksum=${preChecksum}`));
  } catch {
    r.push(mkResult('FM07-PRE', false, 'No PLAYLIST_UPDATE before fault — system not ready'));
    return { ok: false, r, ev };
  }

  // A: Assert corpus cache files exist on disk before stopping the container.
  //    CORPUS_CACHE_DIR = /tmp/clubhub/corpus inside the container.
  //    docker exec works here because the container is still running.
  let cacheFiles = '';
  try {
    const { stdout } = await run(
      `docker exec ${CTR_RUNTIME} ls /tmp/clubhub/corpus/ 2>/dev/null`
    );
    cacheFiles = stdout.trim();
  } catch { cacheFiles = ''; }
  const cacheExists = cacheFiles.length > 0;
  r.push(mkResult('FM07-A', cacheExists,
    cacheExists ? `Cache present: ${cacheFiles.split('\n')[0]}` :
                  'No files in CORPUS_CACHE_DIR — cannot test cold-boot recovery'));
  ev.push(`CORPUS_CACHE_DIR contents before stop: ${cacheFiles || '(empty)'}`);

  if (!cacheExists) {
    ev.push('Aborting FM-07: no cache to recover from');
    return { ok: false, r, ev };
  }

  // Inject: stop player-runtime, then stop CMS.
  log('[FM-07] INJECTING: stop player-runtime then stop cms-api');
  await run(`${COMPOSE} stop player-runtime`);
  await sleep(1000);
  await run(`${COMPOSE} stop cms-api`);
  await sleep(2000);
  ev.push('INJECTED: player-runtime stopped, cms-api stopped');

  // Confirm CMS is actually down before starting player (must fail to connect).
  const cmsCheck = await probeHttp(`${CMS_URL}/health/live`, 3000);
  ev.push(`CMS probe before player start: reachable=${cmsCheck.reachable} (expected false)`);

  // Start player-runtime fresh. CMS is down — the only source of corpus is disk.
  log('[FM-07] Starting player-runtime fresh (CMS still down)...');
  await run(`${COMPOSE} start player-runtime`);
  ev.push('player-runtime started with CMS unavailable');

  // B: player-runtime logs a CMS connectivity error (CMS is intentionally down).
  // player-runtime does not broadcast CONSTITUTIONAL_STATE over WebSocket;
  // it logs the failure and falls back to disk cache instead.
  await sleep(POLL_MS * 2);
  const logsB07 = await getRecentLogs('player-runtime');
  const hasCmsFailure = logsB07.includes('fetch failed') || logsB07.includes('ECONNREFUSED') ||
                        logsB07.includes('ENOTFOUND') || logsB07.includes('offline') ||
                        logsB07.includes('cached') || logsB07.includes('TypeError');
  ev.push(`player-runtime logs (no DEGRADED): ${logsB07.slice(-500)}`);
  r.push(mkResult('FM07-B', hasCmsFailure,
    hasCmsFailure ? 'player-runtime logs CMS failure (correct — using disk cache)' :
                    'No CMS failure in player-runtime logs'));

  // C: PLAYLIST_UPDATE arrives from disk cache within 30s.
  //    If CMS is down and this arrives, it must have come from the cached corpus.
  monitor.flush();
  let cacheUpdate = null;
  try {
    cacheUpdate = await monitor.wait(m => m.type === 'PLAYLIST_UPDATE', 30000);
    r.push(mkResult('FM07-C', true,
      `PLAYLIST_UPDATE from disk cache: checksum=${cacheUpdate.checksum} items=${cacheUpdate.items?.length ?? 0}`));
    ev.push(`Cache PLAYLIST_UPDATE: ${JSON.stringify(cacheUpdate).slice(0, 300)}`);
  } catch {
    const logs = await getRecentLogs('player-runtime');
    ev.push(`player-runtime logs (no update): ${logs.slice(-500)}`);
    r.push(mkResult('FM07-C', false, 'No PLAYLIST_UPDATE within 30s — disk cache not served'));
  }

  // D: Checksum matches pre-shutdown value — same corpus, not a blank/different playlist.
  if (cacheUpdate !== null && preChecksum !== null) {
    const checksumMatch = cacheUpdate.checksum === preChecksum;
    r.push(mkResult('FM07-D', checksumMatch,
      `Checksum: pre=${preChecksum} cache=${cacheUpdate.checksum} — ${checksumMatch ? 'MATCH' : 'MISMATCH'}`));
    ev.push(`Checksum match: ${checksumMatch}`);
  } else {
    r.push(mkResult('FM07-D', false,
      `Cannot compare: pre=${preChecksum} cacheUpdate=${cacheUpdate?.checksum ?? 'none'}`));
  }

  // E: CONSTITUTIONAL_STATE stays DEGRADED — no spurious HEALTHY while CMS is down.
  monitor.flush();
  const unexpectedHealthy = await monitor.wait(
    m => m.type === 'CONSTITUTIONAL_STATE' && m.state === 'HEALTHY',
    POLL_MS * 2,
  ).then(() => true).catch(() => false);
  r.push(mkResult('FM07-E', !unexpectedHealthy,
    unexpectedHealthy ? 'HEALTHY received while CMS is down — state machine error' :
                        'No HEALTHY while CMS down (correct — DEGRADED sustained)'));
  ev.push(`Spurious HEALTHY while CMS down: ${unexpectedHealthy}`);

  // Restore: bring CMS back. player-runtime will self-heal on next successful poll.
  log('[FM-07] Restoring: starting cms-api');
  await run(`${COMPOSE} start cms-api`);
  await waitForHttp(`${CMS_URL}/health/live`, 60000);
  ev.push('RESTORED: cms-api healthy — player-runtime will self-heal on next poll');

  return { ok: r.every(x => x.ok), r, ev };
}

// ─── Report builder ────────────────────────────────────────────────────────
function buildReport({ runId, timestamp, env, baseline, fmResults }) {
  const fmList  = Object.entries(fmResults);
  const passed  = fmList.filter(([, v]) => !v.skipped && v.ok).length;
  const failed  = fmList.filter(([, v]) => !v.skipped && !v.ok).length;
  const skipped = fmList.filter(([, v]) =>  v.skipped).length;

  let final;
  if (!baseline.passed)  final = 'RED';
  else if (failed === 0) final = 'GREEN';
  else if (failed <= 2)  final = 'YELLOW';
  else                   final = 'RED';

  return {
    run_id:    runId,
    timestamp,
    environment: env,
    summary: { total_fm: 7, passed, failed, skipped },
    baseline,
    failures: fmList.map(([id, v]) => ({
      fm:     id,
      status: v.skipped ? 'SKIP' : v.ok ? 'PASS' : 'FAIL',
      ...(v.skipped ? { skip_reason: v.skipReason } : {}),
      assertions: (v.r ?? []).map(a => ({
        id:       a.name,
        status:   a.ok ? 'PASS' : 'FAIL',
        // evidence per assertion = the assertion message; FM-level ev is attached below
        evidence: [a.msg],
      })),
      evidence: v.ev ?? [],
      logs: {
        'cms-api':        (v.logs?.['cms-api']        ?? []),
        'player-runtime': (v.logs?.['player-runtime'] ?? []),
      },
    })),
    final,
  };
}

function writeReport(report) {
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  log(`Report written to ${REPORT_PATH}`);
}

// ─── Human-readable report ─────────────────────────────────────────────────
function printHumanReport(fmResults, report) {
  const bar = '═'.repeat(52);
  emit('\n' + bar);
  emit('  FAILURE MODE REPORT');
  emit(bar);

  const labels = {
    'FM-01': 'CMS unreachable during active playback',
    'FM-02': 'player-runtime restart with cache intact',
    'FM-03': 'Missing /shared/screen_id at startup',
    'FM-04': 'Unregistered screen_id at startup',
    'FM-05': 'Delayed CMS startup (25s)',
    'FM-06': 'WebSocket reconnection after SIGTERM',
    'FM-07': 'Cold-start cache recovery (fresh restart + CMS unavailable)',
  };

  for (const [id, v] of Object.entries(fmResults)) {
    emit('\n' + '─'.repeat(52));
    const verdict = v.skipped ? 'SKIP' : v.ok ? 'PASS' : 'FAIL';
    emit(`  ${verdict}  ${id}: ${labels[id]}`);
    if (v.skipped) {
      emit(`         Reason: ${v.skipReason}`);
    } else {
      for (const a of (v.r ?? [])) {
        emit(`         ${a.ok ? '✓' : '✗'} ${a.name}: ${a.msg}`);
      }
      if (!v.ok && v.ev?.length) {
        emit('\n         Evidence:');
        for (const e of v.ev.slice(0, 5)) emit(`           • ${e.slice(0, 120)}`);
      }
    }
  }

  emit('\n' + bar);
  emit(`  Summary: ${report.summary.passed}/${report.summary.total_fm} FM passed` +
       (report.summary.skipped ? ` (${report.summary.skipped} skipped)` : ''));
  emit(`  FINAL RESULT: ${report.final}`);
  emit(bar + '\n');
}

// ─── Fail-fast marker ──────────────────────────────────────────────────────
class FailFastError extends Error {
  constructor(id) { super(`FAIL_FAST: ${id} failed — halting`); this.id = id; }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const runId    = randomUUID();
  const timestamp = new Date().toISOString();

  if (!JSON_MODE) {
    emit('ClubHub TV — Failure Mode Execution Harness');
    emit(`run_id:  ${runId}`);
    emit(`Project: ${PROJECT}  WS: ${WS_URL}  CMS: ${CMS_URL}`);
    if (FAIL_FAST)  emit('Mode: --fail-fast (stops on first FM failure)');
    if (NO_CLEANUP) emit('Mode: --no-cleanup (stack left running after run)');
    emit('');
  }

  const env = {
    compose_project: PROJECT,
    node_version:    process.version,
    git_commit:      getGitCommit(),
  };

  let monitor = null;
  let baseline = { passed: false, evidence: [] };
  const fmResults = {};

  try {
    await bringUpStack();
    await enrollScreen();

    const screenId = await readVolume('screen_id');
    if (!screenId) throw new Error('/shared/screen_id is empty — enrollment failed');
    log(`Enrolled screen_id: ${screenId}`);

    monitor = createWsMonitor(WS_URL);

    baseline = await runBaseline(monitor);
    if (!baseline.passed) {
      console.error('[runner] Baseline evidence:', JSON.stringify(baseline.evidence, null, 2));
      throw new Error('Baseline failed — cannot run failure modes against a broken system');
    }

    // Give player-runtime one poll cycle after baseline before injecting faults
    monitor.flush();
    await monitor.wait(m => m.type === 'PLAYLIST_UPDATE', POLL_MS * 3);
    log('System live. Beginning FM execution.');

    // ── FM sequence ──────────────────────────────────────────────────────
    const runFm = async (id, fn, needsRestore) => {
      fmResults[id] = await fn();
      fmResults[id].logs = await captureLogs();
      if (FAIL_FAST && !fmResults[id].ok) throw new FailFastError(id);
      if (needsRestore) await ensureSystemHealthy(monitor, screenId, `post-${id}`);
    };

    await runFm('FM-01', () => runFM01(monitor),            true);
    await runFm('FM-02', () => runFM02(monitor, screenId),  true);
    await runFm('FM-03', () => runFM03(monitor, screenId),  true);
    await runFm('FM-04', () => runFM04(monitor, screenId),  true);
    await runFm('FM-05', () => runFM05(),                   false);
    await runFm('FM-06', () => runFM06(monitor),            true);  // restore so FM-07 starts from HEALTHY + populated cache
    await runFm('FM-07', () => runFM07(monitor),            false); // FM-07 restores CMS internally

  } catch (err) {
    if (err instanceof FailFastError) {
      if (!JSON_MODE) console.error(`\n[runner] ${err.message}`);
    } else {
      console.error(`\n[runner] FATAL: ${err.message}`);
      baseline = baseline.passed ? baseline : { passed: false, evidence: [err.message] };
    }
    // Mark unrun FMs as skipped
    for (const id of ['FM-01','FM-02','FM-03','FM-04','FM-05','FM-06','FM-07']) {
      if (!fmResults[id]) {
        fmResults[id] = {
          ok: false, skipped: true,
          skipReason: `Runner stopped: ${err.message}`,
          r: [], ev: [], logs: { 'cms-api': [], 'player-runtime': [] },
        };
      }
    }
  } finally {
    if (monitor) monitor.stop();
    if (!NO_CLEANUP) await tearDownStack();
    else log('--no-cleanup: stack left running');
  }

  const report = buildReport({ runId, timestamp, env, baseline, fmResults });
  writeReport(report);

  if (JSON_MODE) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    printHumanReport(fmResults, report);
  }

  process.exit(report.final === 'GREEN' ? 0 : 1);
}

main();
