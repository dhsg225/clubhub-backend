/**
 * ClubHub TV — Backend Pipeline Integration Test
 *
 * Validates: CMS API → content/campaign → corpus → resolve → player-runtime WebSocket
 * Hard assertions: corpus asset_count>0, resolve playlist non-empty,
 *                  PLAYLIST_UPDATE received within 60s with asset_path and duration_ms on every item.
 *
 * SCREEN_ID is not generated here. It is read from /shared/screen_id, written by
 * screen-init before this container starts. This ensures player-runtime and this
 * test operate on the same enrolled screen identity.
 *
 * Exit 0 = GREEN (all assertions pass)
 * Exit 1 = RED  (any assertion fails or timeout)
 */

import WebSocket from 'ws';
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';

// ─── Config ────────────────────────────────────────────────────────────────
const CMS_API_URL   = process.env['CMS_API_URL']   ?? 'http://cms-api:3001';
const WS_URL        = process.env['WS_URL']        ?? 'ws://player-runtime:7777';
const ENTERPRISE_ID = process.env['ENTERPRISE_ID'] ?? '20000000-0000-0000-0000-000000000001';
const VENUE_ID      = process.env['VENUE_ID']      ?? '40000000-0000-0000-0000-000000000001';
const SHARED_DIR    = process.env['SHARED_DIR']    ?? '/shared';

// ─── Helpers ───────────────────────────────────────────────────────────────
function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForService(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await request('GET', url);
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await sleep(2000);
  }
  throw new Error(`Service not ready after ${timeoutMs}ms: ${url}`);
}

// ─── Test state ────────────────────────────────────────────────────────────
const results = [];
let authHeader = null;

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
}

function assert(name, condition, detail = '') {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

// ─── Test steps ────────────────────────────────────────────────────────────

async function stepWaitForCmsApi() {
  console.log('\n[1] Waiting for CMS API health...');
  await waitForService(`${CMS_API_URL}/health/live`, 90000);
  pass('CMS_API_HEALTH', `${CMS_API_URL}/health/live responded 200`);
}

async function stepGetAuthToken() {
  console.log('\n[2] Obtaining dev auth token...');
  const res = await request('POST', `${CMS_API_URL}/dev/auth/token`, {
    sub: 'integration-test',
    role: 'VENUE_OPERATOR',
    enterprise_id: ENTERPRISE_ID,
  });
  assert('AUTH_TOKEN_STATUS', res.status === 200, `HTTP ${res.status}`);
  if (res.status !== 200) throw new Error('Cannot continue without auth token');
  const token = res.body?.token;
  assert('AUTH_TOKEN_PRESENT', !!token, token ? 'token received' : 'token missing');
  if (!token) throw new Error('Cannot continue without auth token');
  authHeader = { Authorization: `Bearer ${token}` };
  pass('AUTH_TOKEN_SET', 'Bearer header configured');
}

async function stepEnrollScreen() {
  console.log('\n[3] Enrolling screen with CMS API...');

  // Enrollment token
  const tokenRes = await request(
    'POST',
    `${CMS_API_URL}/api/v2/venues/${VENUE_ID}/enrollment-tokens`,
    { screen_name: 'integration-pi-sim' },
    authHeader,
  );
  assert('ENROLL_TOKEN_STATUS', tokenRes.status === 200 || tokenRes.status === 201,
    `HTTP ${tokenRes.status}`);
  const enrollmentToken = tokenRes.body?.enrollment_token ?? tokenRes.body?.token;
  assert('ENROLL_TOKEN_PRESENT', !!enrollmentToken, enrollmentToken ? 'token received' : 'token missing');
  if (!enrollmentToken) throw new Error(`No enrollment token in response: ${JSON.stringify(tokenRes.body)}`);

  // Enroll
  const enrollRes = await request('POST', `${CMS_API_URL}/api/v2/enroll`, {
    enrollment_token: enrollmentToken,
    hardware_id: `docker-pi-sim-${Date.now()}`,
    firmware_version: '1.0.0-integration',
  });
  assert('ENROLL_STATUS', enrollRes.status === 200 || enrollRes.status === 201,
    `HTTP ${enrollRes.status}`);
  const { screen_id, venue_id } = enrollRes.body ?? {};
  assert('SCREEN_ID_PRESENT', !!screen_id, screen_id ?? 'null');
  assert('SCREEN_ID_FORMAT', /^[0-9a-f-]{36}$/.test(screen_id ?? ''), screen_id ?? 'null');
  if (!screen_id) throw new Error(`No screen_id in enroll response: ${JSON.stringify(enrollRes.body)}`);

  // Write to shared volume so player-runtime can read it
  fs.mkdirSync(SHARED_DIR, { recursive: true });
  fs.writeFileSync(`${SHARED_DIR}/screen_id`, screen_id, 'utf8');
  fs.writeFileSync(`${SHARED_DIR}/venue_id`, venue_id ?? VENUE_ID, 'utf8');

  pass('SCREEN_ID_WRITTEN', `screen_id=${screen_id}`);
  console.log(`  screen_id=${screen_id}`);
  return screen_id;
}

async function stepCreateContent(screenId) {
  console.log('\n[4] Creating content asset, campaign, schedule...');

  // Content asset
  const assetRes = await request(
    'POST',
    `${CMS_API_URL}/api/v2/enterprises/${ENTERPRISE_ID}/content-assets`,
    {
      filename: 'integration-test-asset.mp4',
      media_type: 'video/mp4',
      cdn_url: 'http://asset-server/assets/test.mp4',
      file_size_bytes: 18,
      checksum_sha256: 'a'.repeat(64),
      duration_ms: 15000,
    },
    authHeader,
  );
  assert('CONTENT_ASSET_STATUS', assetRes.status === 200 || assetRes.status === 201,
    `HTTP ${assetRes.status}`);
  const contentAssetId = assetRes.body?.content_asset_id ?? assetRes.body?.id;
  assert('CONTENT_ASSET_ID', !!contentAssetId, contentAssetId ?? 'null');
  if (!contentAssetId) throw new Error('Content asset creation failed');

  // Campaign
  const campaignRes = await request(
    'POST',
    `${CMS_API_URL}/api/v2/venues/${VENUE_ID}/campaigns`,
    { name: 'Integration Test Campaign', resolution_level: 3 },
    authHeader,
  );
  assert('CAMPAIGN_STATUS', campaignRes.status === 200 || campaignRes.status === 201,
    `HTTP ${campaignRes.status}`);
  const campaignId = campaignRes.body?.campaign_id ?? campaignRes.body?.id;
  assert('CAMPAIGN_ID', !!campaignId, campaignId ?? 'null');
  if (!campaignId) throw new Error('Campaign creation failed');

  // Campaign item
  const itemRes = await request(
    'POST',
    `${CMS_API_URL}/api/v2/campaigns/${campaignId}/items`,
    { content_asset_id: contentAssetId },
    authHeader,
  );
  assert('CAMPAIGN_ITEM_STATUS', itemRes.status === 200 || itemRes.status === 201,
    `HTTP ${itemRes.status}`);

  // All-day all-week schedule (avoids seed schedule Mon-Fri 09:00-17:00 time-dependency)
  const scheduleRes = await request(
    'POST',
    `${CMS_API_URL}/api/v2/campaigns/${campaignId}/schedules`,
    {
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      start_time_hhmm: 0,
      end_time_hhmm: 2359,
      valid_from_utc: new Date().toISOString(),
    },
    authHeader,
  );
  assert('SCHEDULE_STATUS', scheduleRes.status === 200 || scheduleRes.status === 201,
    `HTTP ${scheduleRes.status}`);

  // Approve campaign
  const approveRes = await request(
    'PATCH',
    `${CMS_API_URL}/api/v2/campaigns/${campaignId}/status`,
    { status: 'APPROVED' },
    authHeader,
  );
  assert('CAMPAIGN_APPROVE_STATUS', approveRes.status === 200,
    `HTTP ${approveRes.status}`);

  return { contentAssetId, campaignId };
}

async function stepPollCorpus(screenId) {
  console.log('\n[5] Polling corpus until asset_count > 0 (max 45s)...');
  const deadline = Date.now() + 45000;
  let lastBody = null;
  while (Date.now() < deadline) {
    try {
      const res = await request(
        'GET',
        `${CMS_API_URL}/api/v2/screens/${screenId}/corpus`,
        null,
        authHeader,
      );
      lastBody = res.body;
      if (res.status === 200 && res.body?.corpus_data?.asset_count > 0) {
        pass('CORPUS_POLL', `asset_count=${res.body.corpus_data.asset_count}`);
        return res.body;
      }
    } catch (e) {
      // retry
    }
    await sleep(3000);
  }
  fail('CORPUS_POLL', `timed out — last body: ${JSON.stringify(lastBody)}`);
  throw new Error('Corpus never became non-empty');
}

function stepAssertCorpus(corpus) {
  console.log('\n[6] Asserting corpus shape...');
  assert('CORPUS_ASSET_URLS', typeof corpus.asset_urls === 'object' &&
    Object.keys(corpus.asset_urls).length >= 1,
    `keys=${Object.keys(corpus.asset_urls ?? {}).length}`);
  assert('CORPUS_ASSET_COUNT', (corpus.corpus_data?.asset_count ?? 0) > 0,
    `asset_count=${corpus.corpus_data?.asset_count}`);
  assert('CORPUS_VERSION_ID', !!corpus.corpus_version_id,
    corpus.corpus_version_id ?? 'null');
}

async function stepResolve(screenId) {
  console.log('\n[7] Calling /resolve/:screen_id...');
  const res = await request(
    'GET',
    `${CMS_API_URL}/resolve/${screenId}`,
    null,
    authHeader,
  );
  assert('RESOLVE_HTTP_200', res.status === 200, `HTTP ${res.status}`);
  assert('RESOLVE_LEVEL_3', res.body?.resolution_level === 3,
    `resolution_level=${res.body?.resolution_level}`);
  assert('RESOLVE_PLAYLIST_NONEMPTY', Array.isArray(res.body?.playlist) &&
    res.body.playlist.length > 0,
    `playlist.length=${res.body?.playlist?.length ?? 0}`);
  assert('RESOLVE_NOT_FALLBACK', res.body?.is_fallback === false,
    `is_fallback=${res.body?.is_fallback}`);
}

async function stepWebSocket(corpus) {
  console.log('\n[8–10] Connecting to player-runtime WebSocket and waiting for PLAYLIST_UPDATE...');
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      fail('WEBSOCKET_PLAYLIST_UPDATE', 'no PLAYLIST_UPDATE received within 60s');
      reject(new Error('WebSocket timeout'));
    }, 60000);

    let ws;
    let attemptCount = 0;
    const maxAttempts = 10;

    function connect() {
      attemptCount++;
      console.log(`  connecting to ${WS_URL} (attempt ${attemptCount})...`);
      ws = new WebSocket(WS_URL);

      ws.on('open', () => {
        console.log('  WebSocket connected');
      });

      ws.on('message', async (data) => {
        let msg;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          return;
        }
        if (msg.type !== 'PLAYLIST_UPDATE') return;

        clearTimeout(timeout);
        pass('WEBSOCKET_PLAYLIST_UPDATE', `received checksum=${msg.checksum ?? 'unknown'}`);

        const items = Array.isArray(msg.items) ? msg.items : [];
        assert('WEBSOCKET_ITEMS_NONEMPTY', items.length > 0, `items.length=${items.length}`);

        let allAssetPath = true;
        let allDurationMs = true;
        for (const item of items) {
          if (!item.asset_path) allAssetPath = false;
          if (!(item.duration_ms > 0)) allDurationMs = false;
        }
        assert('WEBSOCKET_ALL_ASSET_PATH', allAssetPath,
          allAssetPath ? 'all items have asset_path' : 'some items missing asset_path');
        assert('WEBSOCKET_ALL_DURATION_MS', allDurationMs,
          allDurationMs ? 'all items have duration_ms>0' : 'some items have duration_ms=0 or missing');

        // Assert that the asset created by this test run is actually retrievable (HTTP 200).
        // asset_path in PLAYLIST_UPDATE is a Chromium-local URL (http://localhost:3001/assets/<id>)
        // served by the player-runtime UiServer — not reachable from this container.
        // Instead probe a corpus cdn_url that resolves inside the compose network (asset-server).
        const assetUrls = corpus?.asset_urls ?? {};
        const urlValues = Object.values(assetUrls).map((v) => v?.url).filter(Boolean);
        const probeUrl =
          urlValues.find((u) => u.includes('asset-server')) ?? urlValues[0];
        if (probeUrl) {
          try {
            const assetRes = await request('GET', probeUrl);
            assert('WEBSOCKET_ASSET_HTTP200', assetRes.status === 200,
              `GET ${probeUrl} → HTTP ${assetRes.status}`);
          } catch (err) {
            assert('WEBSOCKET_ASSET_HTTP200', false, `asset fetch failed: ${err.message}`);
          }
        } else {
          assert('WEBSOCKET_ASSET_HTTP200', false, 'no asset_url available in corpus to probe');
        }

        ws.close();
        resolve();
      });

      ws.on('error', (err) => {
        console.log(`  WebSocket error: ${err.message}`);
        ws.close();
        if (attemptCount < maxAttempts) {
          setTimeout(connect, 3000);
        } else {
          clearTimeout(timeout);
          fail('WEBSOCKET_CONNECT', `failed after ${maxAttempts} attempts: ${err.message}`);
          reject(err);
        }
      });

      ws.on('close', (code) => {
        if (code !== 1000 && attemptCount < maxAttempts) {
          // Unexpected close — retry
          setTimeout(connect, 3000);
        }
      });
    }

    connect();
  });
}

// ─── Report ────────────────────────────────────────────────────────────────
function printReport() {
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const failed = total - passed;

  console.log('\n' + '═'.repeat(60));
  console.log(`  INTEGRATION TEST REPORT`);
  console.log('═'.repeat(60));
  console.log(`  Total:  ${total}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log('─'.repeat(60));

  if (failed > 0) {
    console.log('\n  FAILED ASSERTIONS:');
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`    ✗ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  const verdict = failed === 0 ? '  GREEN — all assertions pass' : '  RED   — ' + failed + ' assertion(s) failed';
  console.log(verdict);
  console.log('═'.repeat(60) + '\n');

  return failed === 0;
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('ClubHub TV — Backend Pipeline Integration Test');
  console.log(`CMS_API_URL: ${CMS_API_URL}`);
  console.log(`WS_URL:      ${WS_URL}`);
  console.log(`ENTERPRISE:  ${ENTERPRISE_ID}`);
  console.log(`VENUE:       ${VENUE_ID}`);
  console.log(`SHARED_DIR:  ${SHARED_DIR}`);

  try {
    await stepWaitForCmsApi();
    await stepGetAuthToken();
    const screenId = await stepEnrollScreen();
    await stepCreateContent(screenId);
    const corpus = await stepPollCorpus(screenId);
    stepAssertCorpus(corpus);
    await stepResolve(screenId);
    await stepWebSocket(corpus);
  } catch (err) {
    console.error(`\n  FATAL: ${err.message}`);
  }

  const green = printReport();
  process.exit(green ? 0 : 1);
}

main();
