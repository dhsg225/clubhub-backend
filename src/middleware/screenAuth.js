'use strict';
/**
 * screenAuth.js
 *
 * Screen authentication middleware — PARTIAL ENFORCEMENT PHASE.
 *
 * Implements SECURITY_MODEL.md §2–3. Uses HMAC-SHA256 tokens (Node built-in crypto).
 * No external JWT package required.
 *
 * Token format: base64url(payload_json) + '.' + hmac_sha256_hex
 * Payload: { v: 1, sid: screen_id, iat: ms, exp: ms, jti: unique_id }
 *
 * Modes:
 *   SCREEN_AUTH_ENFORCE=false (default):
 *     - Logs unauthenticated polls as SECURITY.unauthorized_poll (WARN)
 *     - Passes all requests through (backward compatible)
 *   SCREEN_AUTH_ENFORCE=true:
 *     - Validates token on every poll
 *     - Returns 401 on missing/invalid/expired token
 *     - Replay window: signed_at (iat) must be within 24h + token must not be revoked
 *
 * Governed values from thresholds.json security section:
 *   security.session_token_expiry_ms    (86400000 — 24h)
 *   security.token_refresh_window_ms    (3600000  — 1h)
 *   security.max_failed_enrollments     (5)
 *   security.enrollment_token_expiry_ms (2592000000 — 30 days)
 */

const crypto = require('node:crypto');
const { pool } = require('../db');
const { emit, EVENTS } = require('../lib/events');

const ENFORCE = process.env.SCREEN_AUTH_ENFORCE === 'true';

// ── Governed thresholds via governed-config singleton ─────────────────────────
// Reads from the governed-config singleton when available; falls back to
// hardcoded defaults so startup order issues do not break auth middleware.

const SECURITY_DEFAULTS = Object.freeze({
  session_token_expiry_ms:    86_400_000,
  token_refresh_window_ms:     3_600_000,
  max_failed_enrollments:              5,
  enrollment_token_expiry_ms: 2_592_000_000,
});

function _getSecurity() {
  try {
    const governedConfig = require('../lib/governed-config');
    const inst = governedConfig.getInstance();
    const overrides = inst ? inst.get('security') : null;
    return overrides ? { ...SECURITY_DEFAULTS, ...overrides } : SECURITY_DEFAULTS;
  } catch {
    return SECURITY_DEFAULTS;
  }
}

// ── HMAC token primitives ─────────────────────────────────────────────────────

function _getSecretKey() {
  const key = process.env.SECRET_KEY;
  if (!key) {
    if (ENFORCE) throw new Error('SECRET_KEY env var required when SCREEN_AUTH_ENFORCE=true');
    return 'dev-insecure-key-not-for-production';
  }
  return key;
}

function _b64url(str) {
  return Buffer.from(str).toString('base64url');
}

function _fromB64url(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Issue a new HMAC-signed session token.
 */
function _signToken(payload) {
  const payloadStr = _b64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', _getSecretKey())
    .update(payloadStr)
    .digest('hex');
  return `${payloadStr}.${sig}`;
}

/**
 * Verify token signature and expiry.
 * Returns { valid, payload, reason }
 */
function _verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, payload: null, reason: 'no_token' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, payload: null, reason: 'malformed_token' };
  }

  const [payloadB64, sig] = parts;

  // Constant-time signature comparison
  const expected = crypto
    .createHmac('sha256', _getSecretKey())
    .update(payloadB64)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf   = Buffer.from(sig,      'hex');

  if (expectedBuf.length !== actualBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, payload: null, reason: 'invalid_signature' };
  }

  let payload;
  try {
    payload = JSON.parse(_fromB64url(payloadB64));
  } catch {
    return { valid: false, payload: null, reason: 'malformed_payload' };
  }

  if (!payload.sid || !payload.exp) {
    return { valid: false, payload: null, reason: 'missing_claims' };
  }

  if (Date.now() > payload.exp) {
    return { valid: false, payload, reason: 'token_expired' };
  }

  return { valid: true, payload, reason: 'ok' };
}

// ── Token validation (DB-backed in enforce mode) ──────────────────────────────

/**
 * Full validation: signature + expiry + DB revocation check.
 * In stub mode: extracts screen_id from simple "screen_id:nonce" format OR validates real tokens.
 */
async function validateToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, screen_id: null, reason: 'missing_or_malformed_header' };
  }

  const token = authHeader.slice(7);

  // Try real HMAC token first
  if (token.includes('.')) {
    const result = _verifyToken(token);
    if (!result.valid) {
      return { valid: false, screen_id: null, reason: result.reason };
    }

    const screen_id = result.payload.sid;

    if (ENFORCE) {
      // Check DB revocation
      try {
        const r = await pool.query(
          'SELECT token_revoked, token_status FROM screens WHERE id = $1',
          [screen_id]
        );
        if (!r.rows.length) {
          return { valid: false, screen_id, reason: 'screen_not_found' };
        }
        if (r.rows[0].token_revoked) {
          return { valid: false, screen_id, reason: 'token_revoked' };
        }
        if (r.rows[0].token_status !== 'ENROLLED') {
          return { valid: false, screen_id, reason: `screen_not_enrolled:${r.rows[0].token_status}` };
        }
      } catch (err) {
        // DB failure in auth check — fail closed in enforce mode
        return { valid: false, screen_id, reason: `db_error:${err.message}` };
      }
    }

    return { valid: true, screen_id, reason: 'ok' };
  }

  // Legacy stub mode: "screen_id:nonce" format — only valid when NOT enforcing
  if (!ENFORCE) {
    const parts    = token.split(':');
    const screen_id = parts[0] || null;
    return { valid: true, screen_id, reason: 'stub_mode' };
  }

  return { valid: false, screen_id: null, reason: 'invalid_token_format' };
}

// ── Middleware ────────────────────────────────────────────────────────────────

async function requireScreenToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const result     = await validateToken(authHeader);

  if (result.valid) {
    req.screen_id = result.screen_id;
    return next();
  }

  if (!ENFORCE) {
    emit(EVENTS.SECURITY.UNAUTHORIZED_POLL, req, {
      screen_id: req.query?.screen_id ?? null,
      ip_hash:   _hashIp(req.ip ?? ''),
      reason:    `${result.reason} (stub_mode_pass)`,
    });
    return next();
  }

  emit(EVENTS.SECURITY.UNAUTHORIZED_POLL, req, {
    screen_id: req.query?.screen_id ?? null,
    ip_hash:   _hashIp(req.ip ?? ''),
    reason:    result.reason,
  });
  return res.status(401).json({
    error:   'UNAUTHORIZED',
    message: 'Valid screen session token required',
    code:    'SCREEN_AUTH_REQUIRED',
  });
}

async function requireEnrollmentToken(req, res, next) {
  const { screen_id, enrollment_token } = req.body || {};

  if (!ENFORCE) {
    emit(EVENTS.SECURITY.ENROLLMENT_ATTEMPT, req, {
      screen_id: screen_id ?? null,
      reason: 'stub_mode_pass',
    });
    return next();
  }

  if (!screen_id || !enrollment_token) {
    emit(EVENTS.SECURITY.ENROLLMENT_REJECTED, req, {
      screen_id: screen_id ?? null,
      reason: 'missing_screen_id_or_token',
    });
    return res.status(400).json({ error: 'screen_id and enrollment_token are required' });
  }

  // Validate OET against DB
  try {
    const tokenHash = _hashToken(enrollment_token);
    const r = await pool.query(
      `SELECT et.id, et.screen_id, et.status, et.expires_at,
              s.failed_enrollments, s.enrollment_locked_until
       FROM enrollment_tokens et
       JOIN screens s ON s.id = et.screen_id
       WHERE et.token_hash = $1 AND et.screen_id = $2`,
      [tokenHash, screen_id]
    );

    if (!r.rows.length) {
      emit(EVENTS.SECURITY.ENROLLMENT_REJECTED, req, { screen_id, reason: 'token_not_found' });
      return res.status(401).json({ error: 'Invalid enrollment token' });
    }

    const row = r.rows[0];

    // Check lock
    if (row.enrollment_locked_until && new Date(row.enrollment_locked_until) > new Date()) {
      emit(EVENTS.SECURITY.ENROLLMENT_REJECTED, req, { screen_id, reason: 'enrollment_locked' });
      return res.status(429).json({ error: 'Enrollment locked. Try again later.' });
    }

    // Check status
    if (row.status !== 'PENDING') {
      emit(EVENTS.SECURITY.ENROLLMENT_REJECTED, req, { screen_id, reason: `token_status:${row.status}` });
      return res.status(401).json({ error: 'Enrollment token already used or revoked' });
    }

    // Check expiry
    if (new Date(row.expires_at) < new Date()) {
      emit(EVENTS.SECURITY.ENROLLMENT_REJECTED, req, { screen_id, reason: 'token_expired' });
      return res.status(401).json({ error: 'Enrollment token expired' });
    }

    req.enrollmentTokenId = row.id;
    emit(EVENTS.SECURITY.ENROLLMENT_ATTEMPT, req, { screen_id });
    return next();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Token issuance ────────────────────────────────────────────────────────────

/**
 * Issue a real HMAC-signed session token for a screen.
 * Updates the screen's session_token_hash and token_expires_at in DB.
 */
async function issueSessionToken(screen_id) {
  const now = Date.now();
  const exp = now + _getSecurity().session_token_expiry_ms;
  const jti = crypto.randomBytes(8).toString('hex');

  const payload = { v: 1, sid: screen_id, iat: now, exp, jti };
  const token   = _signToken(payload);
  const hash    = _hashToken(token);

  await pool.query(
    `UPDATE screens
     SET session_token_hash = $1,
         token_expires_at   = $2,
         token_revoked      = FALSE,
         token_status       = 'ENROLLED',
         enrolled_at        = COALESCE(enrolled_at, NOW())
     WHERE id = $3`,
    [hash, new Date(exp).toISOString(), screen_id]
  );

  emit(EVENTS.SECURITY.TOKEN_ISSUED, null, {
    screen_id,
    expires_at: new Date(exp).toISOString(),
  });

  return token;
}

/**
 * Revoke a screen's session token in DB.
 */
async function revokeToken(screen_id, reason = 'operator_action') {
  await pool.query(
    'UPDATE screens SET token_revoked = TRUE, token_status = $1 WHERE id = $2',
    ['REVOKED', screen_id]
  );
  emit(EVENTS.SECURITY.TOKEN_REVOKED, null, { screen_id, reason });
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function _hashIp(ip) {
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = (Math.imul(31, h) + ip.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function _hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 64);
}

module.exports = {
  requireScreenToken,
  requireEnrollmentToken,
  issueSessionToken,
  revokeToken,
  validateToken,
  ENFORCE,
  get _security() { return _getSecurity(); },
};
