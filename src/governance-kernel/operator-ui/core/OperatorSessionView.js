'use strict';

/**
 * OperatorSessionView — client-side session state model for operator UI.
 *
 * Manages session display state: role, expiry, JTI tracking, revocation status.
 * Does NOT issue or verify tokens — that is the server's responsibility.
 *
 * UI_AUTHORITY_BOUNDARY: This module is client-side only.
 * Token verification uses the API gateway, not the kernel directly.
 */

const ROLES = Object.freeze({ ADMIN: 'ADMIN', OPERATOR: 'OPERATOR', VIEWER: 'VIEWER' });

// Role capability matrix — mirrors OperatorAuthority role model
const ROLE_CAPABILITIES = Object.freeze({
  ADMIN: new Set([
    'freeze', 'unfreeze', 'incrementEpoch', 'revokeToken', 'revokeOperator',
    'proposalConfirm', 'transitionStrong', 'archiveIncidents', 'certify',
    'createIncident', 'transition', 'proposalSubmit', 'viewAll', 'replay',
  ]),
  OPERATOR: new Set([
    'createIncident', 'transition', 'proposalSubmit', 'viewAll', 'replay',
  ]),
  VIEWER: new Set(['viewAll', 'replay']),
});

class OperatorSessionView {
  constructor(opts = {}) {
    this._clockNow = opts.clockNow || (() => Date.now()); // injectable
    this._onRevoked = opts.onRevoked || null;
    this._onExpired = opts.onExpired || null;
    this._pollIntervalMs = opts.pollIntervalMs || 30_000;
    this._revocationFetcher = opts.revocationFetcher || null; // async (jti) => { revoked: bool }

    this._session = null;
    this._revoked = false;
    this._pollTimer = null;
  }

  // ─── Session loading ──────────────────────────────────────────────────────

  /**
   * Load a decoded session payload from server-side token verification.
   * Called after successful authentication — the server has already
   * verified the token signature and checked isRevoked().
   */
  loadSession(payload) {
    // payload: { oid, role, iat, exp, jti, v, authority_epoch? }
    if (!payload || !payload.oid || !payload.role || !payload.jti) {
      throw new Error('Invalid session payload: oid, role, jti required');
    }
    if (!ROLES[payload.role]) {
      throw new Error(`Unknown role: ${payload.role}`);
    }

    this._session = {
      oid: payload.oid,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
      jti: payload.jti,
      jti_display: payload.jti.slice(-8),
      authority_epoch: payload.authority_epoch ?? null,
      loaded_at: this._clockNow(),
    };
    this._revoked = false;

    if (this._pollTimer) clearInterval(this._pollTimer);
    if (this._revocationFetcher) {
      this._pollTimer = setInterval(() => this._checkRevocation(), this._pollIntervalMs);
    }

    return this;
  }

  clearSession() {
    this._session = null;
    this._revoked = false;
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  }

  // ─── State queries ────────────────────────────────────────────────────────

  isAuthenticated() {
    return !!this._session && !this._revoked && !this._isExpired();
  }

  isRevoked() { return this._revoked; }

  getRole() { return this._session?.role ?? null; }
  getOid() { return this._session?.oid ?? null; }
  getJti() { return this._session?.jti ?? null; }
  getJtiDisplay() { return this._session?.jti_display ?? null; }

  can(action) {
    if (!this._session || this._revoked || this._isExpired()) return false;
    return ROLE_CAPABILITIES[this._session.role]?.has(action) ?? false;
  }

  canFreeze() { return this.can('freeze'); }
  canUnfreeze() { return this.can('unfreeze'); }
  canTransitionStrong() { return this.can('transitionStrong'); }
  canCreateIncident() { return this.can('createIncident'); }
  canViewAll() { return this.can('viewAll'); }

  getExpiryMs() {
    if (!this._session?.exp) return null;
    return (this._session.exp * 1000) - this._clockNow();
  }

  isNearExpiry(thresholdMs = 5 * 60 * 1000) {
    const remaining = this.getExpiryMs();
    return remaining !== null && remaining < thresholdMs;
  }

  /**
   * Returns session display summary for UI panels.
   */
  getSummary() {
    if (!this._session) return { authenticated: false };
    const expiryMs = this.getExpiryMs();
    return {
      authenticated: this.isAuthenticated(),
      oid: this._session.oid,
      role: this._session.role,
      jti_display: this._session.jti_display,
      authority_epoch: this._session.authority_epoch,
      expiry_ms: expiryMs,
      near_expiry: this.isNearExpiry(),
      expired: this._isExpired(),
      revoked: this._revoked,
      warnings: this._getWarnings(expiryMs),
    };
  }

  /**
   * Returns authority confidence for the current session.
   * If epoch is stale relative to provided current epoch, warns operator.
   */
  getAuthorityConfidence(currentKernelEpoch) {
    if (!this._session) return 'UNKNOWN';
    if (this._revoked) return 'REVOKED';
    if (this._isExpired()) return 'EXPIRED';
    if (this._session.authority_epoch !== null &&
        currentKernelEpoch !== null &&
        this._session.authority_epoch < currentKernelEpoch) {
      return 'STALE_EPOCH';
    }
    return 'VALID';
  }

  // ─── Revocation check ─────────────────────────────────────────────────────

  async _checkRevocation() {
    if (!this._session || !this._revocationFetcher) return;
    try {
      const result = await this._revocationFetcher(this._session.jti);
      if (result?.revoked) {
        this._revoked = true;
        if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
        if (this._onRevoked) this._onRevoked({ jti: this._session.jti, oid: this._session.oid });
      }
    } catch (_) {
      // Transport error — do not clear session (fail open for revocation check transport)
      // Known gap: mid-session revocation propagation — see CONSISTENCY_MODEL.md
    }
  }

  _isExpired() {
    if (!this._session?.exp) return false;
    return this._clockNow() > this._session.exp * 1000;
  }

  _getWarnings(expiryMs) {
    const warnings = [];
    if (this._revoked) warnings.push({ level: 'error', message: 'Token revoked — re-authenticate immediately' });
    if (this._isExpired()) warnings.push({ level: 'error', message: 'Session expired — re-authenticate' });
    else if (this.isNearExpiry()) {
      const mins = Math.ceil(expiryMs / 60000);
      warnings.push({ level: 'warning', message: `Session expires in ${mins} minute${mins !== 1 ? 's' : ''} — save work and re-authenticate` });
    }
    return warnings;
  }
}

module.exports = { OperatorSessionView, ROLES, ROLE_CAPABILITIES };
