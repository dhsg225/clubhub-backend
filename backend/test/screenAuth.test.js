'use strict';
/**
 * Screen auth middleware unit tests — Node built-in test runner, no extra deps.
 *
 * Mocks db.js via require.cache injection so no PostgreSQL instance is needed.
 * Covers all critical paths: missing token, bad sig, revoked, enrolled, pass-through.
 */
const { test } = require('node:test');
const assert   = require('node:assert/strict');
const crypto   = require('node:crypto');

const SECRET_KEY = 'test-secret-32-bytes-exactly-abc!';
process.env.SECRET_KEY  = SECRET_KEY;
process.env.LOG_LEVEL   = 'ERROR'; // suppress noise

// ── Paths ─────────────────────────────────────────────────────────────────────
const dbPath       = require.resolve('../src/db.js');
const authPath     = require.resolve('../src/middleware/screenAuth.js');

// ── DB mock ───────────────────────────────────────────────────────────────────
let _mockRows = [{ token_revoked: false, token_status: 'ENROLLED' }];

function injectDbMock() {
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true, parent: null, children: [], paths: [],
    exports: { pool: { query: async () => ({ rows: _mockRows }) } },
  };
}

// ── Module loader — reloads screenAuth with fresh ENFORCE value ───────────────
function loadAuth(enforce) {
  process.env.SCREEN_AUTH_ENFORCE = enforce ? 'true' : 'false';
  delete require.cache[authPath];
  injectDbMock();
  return require('../src/middleware/screenAuth.js');
}

// ── Token helper ──────────────────────────────────────────────────────────────
function signToken(screen_id, expiresInMs = 86_400_000) {
  const now = Date.now();
  const payload = { v: 1, sid: screen_id, iat: now, exp: now + expiresInMs, jti: crypto.randomBytes(8).toString('hex') };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET_KEY).update(payloadB64).digest('hex');
  return `${payloadB64}.${sig}`;
}

// ── Mock res ──────────────────────────────────────────────────────────────────
function mockRes() {
  const res = {};
  res.status = (c) => { res._status = c; return res; };
  res.json   = (b) => { res._body   = b; };
  return res;
}

// ═══════════════════════════════════════════════════════════════════════════════
// validateToken
// ═══════════════════════════════════════════════════════════════════════════════

test('validateToken — no header → invalid', async () => {
  const { validateToken } = loadAuth(true);
  const r = await validateToken(undefined);
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.reason, 'missing_or_malformed_header');
});

test('validateToken — ENFORCE=true, stub-format token → invalid_token_format', async () => {
  const { validateToken } = loadAuth(true);
  const r = await validateToken('Bearer screen-id:nonce');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.reason, 'invalid_token_format');
});

test('validateToken — ENFORCE=true, bad signature → invalid', async () => {
  const { validateToken } = loadAuth(true);
  const r = await validateToken('Bearer aGVsbG8.badsig000000000000000000000000000000000000000000000000000000000000000');
  assert.strictEqual(r.valid, false);
});

test('validateToken — ENFORCE=true, valid token + enrolled screen → valid', async () => {
  const { validateToken } = loadAuth(true);
  _mockRows = [{ token_revoked: false, token_status: 'ENROLLED' }];
  const r = await validateToken(`Bearer ${signToken('screen-abc')}`);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.screen_id, 'screen-abc');
});

test('validateToken — ENFORCE=true, valid token + revoked screen → invalid', async () => {
  const { validateToken } = loadAuth(true);
  _mockRows = [{ token_revoked: true, token_status: 'REVOKED' }];
  const r = await validateToken(`Bearer ${signToken('screen-abc')}`);
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.reason, 'token_revoked');
});

test('validateToken — ENFORCE=false, stub token → valid (pass-through)', async () => {
  const { validateToken } = loadAuth(false);
  const r = await validateToken('Bearer myscreen:nonce');
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.screen_id, 'myscreen');
});

// ═══════════════════════════════════════════════════════════════════════════════
// requireScreenToken middleware
// ═══════════════════════════════════════════════════════════════════════════════

test('requireScreenToken — ENFORCE=true, no token → 401', async () => {
  const { requireScreenToken } = loadAuth(true);
  const req = { headers: {}, query: {}, ip: '127.0.0.1' };
  const res = mockRes();
  await requireScreenToken(req, res, () => { throw new Error('next() must not be called'); });
  assert.strictEqual(res._status, 401);
  assert.strictEqual(res._body?.error, 'UNAUTHORIZED');
});

test('requireScreenToken — ENFORCE=true, valid enrolled token → next() + screen_id set', async () => {
  const { requireScreenToken } = loadAuth(true);
  _mockRows = [{ token_revoked: false, token_status: 'ENROLLED' }];
  const req = { headers: { authorization: `Bearer ${signToken('screen-xyz')}` }, query: {}, ip: '127.0.0.1' };
  const res = mockRes();
  let nextCalled = false;
  await requireScreenToken(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.screen_id, 'screen-xyz');
});
