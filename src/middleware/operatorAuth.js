'use strict';
/**
 * operatorAuth.js
 *
 * Operator (human admin) authentication middleware.
 * Uses HMAC-SHA256 signed tokens with role enforcement.
 *
 * Roles:
 *   ADMIN    — full access (all mutation routes)
 *   OPERATOR — operational access (promote, freeze, rollback)
 *   VIEWER   — read-only (status only)
 *
 * Token format: base64url(payload_json) + '.' + hmac_sha256_hex
 * Payload: { v: 1, oid: operator_id, role: string, iat: ms, exp: ms }
 *
 * Secret: OPERATOR_SECRET_KEY env var (falls back to dev key)
 */

const crypto           = require('node:crypto');
const operatorSessions = require('../lib/operator-sessions');

// ── Roles ─────────────────────────────────────────────────────────────────────

const ROLES = Object.freeze({
  ADMIN:    'ADMIN',
  OPERATOR: 'OPERATOR',
  VIEWER:   'VIEWER',
});

// ── Secret key ────────────────────────────────────────────────────────────────

function _getOperatorSecret() {
  return process.env.OPERATOR_SECRET_KEY || 'dev-operator-key-not-for-production';
}

// ── Token primitives ──────────────────────────────────────────────────────────

/**
 * Issue a signed operator token.
 * @param {string} operator_id
 * @param {string} role  — one of ROLES
 * @param {object} [opts]
 * @param {number} [opts.expiry_ms=3600000]  — token lifetime in ms (default 1 hour)
 * @returns {string} signed token
 */
function issueOperatorToken(operator_id, role, opts = {}) {
  if (!Object.values(ROLES).includes(role)) {
    throw new Error(`issueOperatorToken: invalid role '${role}'`);
  }
  const now     = Date.now(); // intentionally wall-clock for token interop
  const exp     = now + (opts.expiry_ms ?? 3_600_000);
  const jti     = crypto.randomBytes(8).toString('hex');
  const payload = { v: 1, oid: operator_id, role, iat: now, exp, jti };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', _getOperatorSecret())
    .update(payloadB64)
    .digest('hex');
  return `${payloadB64}.${sig}`;
}

/**
 * Verify a signed operator token.
 * @returns {{ valid: boolean, payload: object|null, reason: string }}
 */
function verifyOperatorToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, payload: null, reason: 'no_token' };
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, payload: null, reason: 'malformed' };
  }
  const [payloadB64, sig] = parts;

  const expected    = crypto.createHmac('sha256', _getOperatorSecret()).update(payloadB64).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf   = Buffer.from(sig.length % 2 === 0 ? sig : '00', 'hex');

  if (expectedBuf.length !== actualBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, payload: null, reason: 'invalid_signature' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, payload: null, reason: 'malformed_payload' };
  }

  if (Date.now() > payload.exp) { // intentionally wall-clock for token interop
    return { valid: false, payload, reason: 'token_expired' };
  }

  if (payload.jti && operatorSessions.isRevoked(payload.jti)) {
    return { valid: false, payload, reason: 'token_revoked' };
  }

  return { valid: true, payload, reason: 'ok' };
}

/**
 * Express middleware factory: require a valid operator token with one of the allowed roles.
 *
 * @param {string[]} [allowedRoles]  — defaults to [ADMIN, OPERATOR]
 * @returns {function} Express middleware
 */
function requireOperatorAuth(allowedRoles = [ROLES.ADMIN, ROLES.OPERATOR]) {
  return (req, res, next) => {
    const authHeader = req.headers['x-operator-token'] || req.headers['authorization'];
    const rawToken = authHeader
      ? (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader)
      : null;

    const result = verifyOperatorToken(rawToken);

    if (!result.valid) {
      return res.status(401).json({
        error:   'UNAUTHORIZED',
        message: 'Valid operator token required',
        code:    result.reason,
      });
    }

    if (!allowedRoles.includes(result.payload.role)) {
      return res.status(403).json({
        error:    'FORBIDDEN',
        message:  'Insufficient operator role',
        code:     'INSUFFICIENT_ROLE',
        required: allowedRoles,
        actual:   result.payload.role,
      });
    }

    req.operator_id   = result.payload.oid;
    req.operator_role = result.payload.role;
    next();
  };
}

module.exports = {
  ROLES,
  issueOperatorToken,
  verifyOperatorToken,
  requireOperatorAuth,
};
