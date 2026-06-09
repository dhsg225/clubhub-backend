'use strict';
const sessionAuth = require('../core/session-authority');
const crypto      = require('node:crypto');

const ROLES       = Object.freeze({ ADMIN: 'ADMIN', OPERATOR: 'OPERATOR', VIEWER: 'VIEWER' });
const ROLE_LEVELS = { ADMIN: 3, OPERATOR: 2, VIEWER: 1 };

function _getSecret() {
  return process.env.OPERATOR_SECRET_KEY ?? 'dev-operator-secret-not-for-production';
}
function _b64url(str)     { return Buffer.from(str).toString('base64url'); }
function _fromB64url(str) { return Buffer.from(str, 'base64url').toString('utf8'); }

class OperatorAuthority {
  issueToken(operatorId, role, opts = {}) {
    if (!ROLES[role]) throw new Error(`Unknown role: ${role}`);
    const now = Date.now();
    const exp = now + (opts.expiryMs ?? 3_600_000);
    const jti = crypto.randomBytes(8).toString('hex');
    const payload    = { v: 1, oid: operatorId, role, iat: now, exp, jti };
    const payloadStr = _b64url(JSON.stringify(payload));
    const sig        = crypto.createHmac('sha256', _getSecret()).update(payloadStr).digest('hex');
    return `${payloadStr}.${sig}`;
  }

  verifyToken(token) {
    if (!token || typeof token !== 'string') return { valid: false, reason: 'no_token' };
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false, reason: 'malformed_token' };
    const [payloadB64, sig] = parts;
    const expected = crypto.createHmac('sha256', _getSecret()).update(payloadB64).digest('hex');
    const expBuf = Buffer.from(expected, 'hex');
    const actBuf = Buffer.from(sig, 'hex');
    if (expBuf.length !== actBuf.length || !crypto.timingSafeEqual(expBuf, actBuf)) {
      return { valid: false, reason: 'invalid_signature' };
    }
    let payload;
    try { payload = JSON.parse(_fromB64url(payloadB64)); } catch { return { valid: false, reason: 'malformed_payload' }; }
    if (!payload.oid || !payload.exp) return { valid: false, payload, reason: 'missing_claims' };
    if (Date.now() > payload.exp)     return { valid: false, payload, reason: 'token_expired' };
    if (sessionAuth.isRevoked(payload.jti)) return { valid: false, payload, reason: 'jti_revoked' };
    return { valid: true, payload, reason: 'ok' };
  }

  requireAuth(minimumRole) {
    minimumRole = minimumRole ?? ROLES.OPERATOR;
    const self = this;
    return function operatorAuthMiddleware(req, res, next) {
      const auth = req.headers['authorization'];
      if (!auth?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'UNAUTHORIZED', code: 'OPERATOR_AUTH_REQUIRED' });
      }
      const result = self.verifyToken(auth.slice(7));
      if (!result.valid) {
        return res.status(401).json({ error: 'UNAUTHORIZED', reason: result.reason });
      }
      const required = ROLE_LEVELS[minimumRole] ?? 2;
      const actual   = ROLE_LEVELS[result.payload.role] ?? 0;
      if (actual < required) {
        return res.status(403).json({ error: 'FORBIDDEN', required: minimumRole, actual: result.payload.role });
      }
      req.operatorId   = result.payload.oid;
      req.operatorRole = result.payload.role;
      next();
    };
  }

  async revokeToken(jti, opts)        { return sessionAuth.revokeToken(jti, opts); }
  async revokeOperator(id, opts)      { return sessionAuth.revokeOperator(id, opts); }
  async rotateSigningKey(opts)        { return sessionAuth.rotateSigningKey(opts); }
  getKeyVersion()                     { return sessionAuth.getCurrentKeyVersion?.() ?? 1; }

  get ROLES() { return ROLES; }
}
module.exports = { OperatorAuthority, ROLES };
