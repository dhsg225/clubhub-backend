/**
 * screen-init — one-shot enrollment service
 *
 * Runs once before player-runtime starts.
 * Enrolls a new screen with CMS API, writes screen_id + venue_id to /shared/
 * so both player-runtime and integration-test use the same identity.
 *
 * Exit 0 = enrolled successfully, files written
 * Exit 1 = enrollment failed (player-runtime and test will not start)
 */

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const CMS_API_URL   = process.env['CMS_API_URL']   ?? 'http://cms-api:3001';
const ENTERPRISE_ID = process.env['ENTERPRISE_ID'] ?? '20000000-0000-0000-0000-000000000001';
const VENUE_ID      = process.env['VENUE_ID']      ?? '40000000-0000-0000-0000-000000000001';
const SHARED_DIR    = process.env['SHARED_DIR']    ?? '/shared';

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
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
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

async function waitForCmsApi(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await request('GET', `${CMS_API_URL}/health/live`);
      if (res.status === 200) return;
    } catch { /* not up yet */ }
    await sleep(2000);
  }
  throw new Error(`CMS API not ready after ${timeoutMs}ms`);
}

async function main() {
  console.log('[screen-init] Starting enrollment');
  console.log(`[screen-init] CMS_API_URL=${CMS_API_URL} VENUE_ID=${VENUE_ID}`);

  await waitForCmsApi();
  console.log('[screen-init] CMS API healthy');

  // Auth token
  const authRes = await request('POST', `${CMS_API_URL}/dev/auth/token`, {
    sub: 'screen-init',
    role: 'VENUE_OPERATOR',
    enterprise_id: ENTERPRISE_ID,
  });
  if (authRes.status !== 200) throw new Error(`Auth failed: HTTP ${authRes.status} ${JSON.stringify(authRes.body)}`);
  const authHeader = { Authorization: `Bearer ${authRes.body.token}` };
  console.log('[screen-init] Auth token obtained');

  // Enrollment token
  const tokenRes = await request(
    'POST',
    `${CMS_API_URL}/api/v2/venues/${VENUE_ID}/enrollment-tokens`,
    { screen_name: 'integration-pi-sim' },
    authHeader,
  );
  if (tokenRes.status !== 200 && tokenRes.status !== 201) {
    throw new Error(`Enrollment token failed: HTTP ${tokenRes.status} ${JSON.stringify(tokenRes.body)}`);
  }
  const enrollmentToken = tokenRes.body?.enrollment_token ?? tokenRes.body?.token;
  if (!enrollmentToken) throw new Error(`No enrollment token in response: ${JSON.stringify(tokenRes.body)}`);
  console.log('[screen-init] Enrollment token obtained');

  // Enroll
  const enrollRes = await request('POST', `${CMS_API_URL}/api/v2/enroll`, {
    enrollment_token: enrollmentToken,
    hardware_id: `docker-pi-sim-${Date.now()}`,
    firmware_version: '1.0.0-integration',
  });
  if (enrollRes.status !== 200 && enrollRes.status !== 201) {
    throw new Error(`Enroll failed: HTTP ${enrollRes.status} ${JSON.stringify(enrollRes.body)}`);
  }
  const { screen_id, venue_id } = enrollRes.body ?? {};
  if (!screen_id) throw new Error(`No screen_id in enroll response: ${JSON.stringify(enrollRes.body)}`);

  // Write to shared volume
  fs.mkdirSync(SHARED_DIR, { recursive: true });
  fs.writeFileSync(`${SHARED_DIR}/screen_id`, screen_id, 'utf8');
  fs.writeFileSync(`${SHARED_DIR}/venue_id`, venue_id ?? VENUE_ID, 'utf8');

  console.log(`[screen-init] ENROLLED — screen_id=${screen_id} venue_id=${venue_id ?? VENUE_ID}`);
  console.log(`[screen-init] Written to ${SHARED_DIR}/screen_id`);
}

main().catch((err) => {
  console.error(`[screen-init] FATAL: ${err.message}`);
  process.exit(1);
});
