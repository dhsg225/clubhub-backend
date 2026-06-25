'use strict';
/**
 * governed-operators.js — OTA operator authority routes through kernel OperatorAuthority.
 *
 * All OTA routes requiring authentication use OperatorAuthority.requireAuth(role).
 * All operator actions append to AuditLedger with lineage.
 * JTI revocation is enforced by OperatorAuthority.verifyToken().
 *
 * OTA runtime MAY:
 *   - Wrap OperatorAuthority.requireAuth() middleware
 *   - Issue tokens for operator sessions (via OperatorAuthority.issueToken)
 *   - Revoke tokens (via OperatorAuthority.revokeToken)
 *   - Append operator actions to AuditLedger
 *
 * OTA runtime MAY NOT:
 *   - Implement its own token issuance or verification
 *   - Bypass role enforcement
 *   - Skip AuditLedger entries on operator actions
 */

const replayHooks = require('./replay-hooks');

class GovernedOperators {
  constructor() {
    this._operatorAuthority = null;
    this._auditLedger       = null;
    this._eventBus          = null;
    this._BUS_EVENTS        = null;
  }

  init(deps = {}) {
    this._operatorAuthority = deps.operatorAuthority;
    this._auditLedger       = deps.auditLedger;
    this._eventBus          = deps.eventBus ?? null;
    this._BUS_EVENTS        = deps.eventBus?.BUS_EVENTS ?? null;
  }

  _requireInit() {
    if (!this._operatorAuthority || !this._auditLedger) {
      throw new Error('GovernedOperators: not initialized — call init(deps) before use');
    }
  }

  // ── Middleware factory ────────────────────────────────────────────────────

  /**
   * Returns Express middleware for role-gated routes.
   * Delegates entirely to OperatorAuthority.requireAuth().
   * Sets req.operatorId and req.operatorRole on success.
   *
   * @param {string} minimumRole — 'ADMIN' | 'OPERATOR' | 'VIEWER'
   */
  requireAuth(minimumRole) {
    this._requireInit();
    return this._operatorAuthority.requireAuth(minimumRole);
  }

  // ── Audit action ──────────────────────────────────────────────────────────

  /**
   * Append an operator action to AuditLedger.
   * Call after successful operator mutations.
   *
   * @param {object} opts — { operator_id, action_type, justification, before_state_hash, after_state_hash }
   */
  appendAction(opts = {}) {
    this._requireInit();
    try {
      this._auditLedger.appendEntry({
        action_type:        opts.action_type   ?? 'operator_action',
        operator_id:        opts.operator_id   ?? null,
        justification:      opts.justification ?? '',
        before_state_hash:  opts.before_state_hash ?? null,
        after_state_hash:   opts.after_state_hash  ?? null,
      });
    } catch { /* non-fatal — ledger failure must not block operator action */ }

    if (this._eventBus) {
      try {
        this._eventBus.emit(
          this._BUS_EVENTS?.OPERATOR?.ACTION_LEDGERED ?? 'governance.operator.action_ledgered',
          {
            action_type: opts.action_type ?? 'operator_action',
            operator_id: opts.operator_id ?? null,
            lineage_ts:  new Date().toISOString(),
          }
        );
      } catch { /* non-fatal */ }
    }
  }

  // ── Linearized audit ──────────────────────────────────────────────────────

  /**
   * LINEARIZED append to AuditLedger via DB advisory lock.
   * Use for LINEARIZED operator actions (freeze, rollback, etc.).
   *
   * @param {object} pool — pg.Pool
   * @param {object} opts — same as appendAction
   */
  async appendActionLinearized(pool, opts = {}) {
    this._requireInit();
    replayHooks.assertNotReplay('operators.appendActionLinearized');

    await this._auditLedger.appendLinearized(pool, {
      action_type:        opts.action_type   ?? 'operator_action',
      operator_id:        opts.operator_id   ?? null,
      justification:      opts.justification ?? '',
      before_state_hash:  opts.before_state_hash ?? null,
      after_state_hash:   opts.after_state_hash  ?? null,
    });
  }

  // ── Token operations ──────────────────────────────────────────────────────

  /**
   * Issue operator token via OperatorAuthority.
   * @param {string} operatorId
   * @param {string} role — 'ADMIN' | 'OPERATOR' | 'VIEWER'
   * @param {object} opts — { expiryMs }
   */
  issueToken(operatorId, role, opts = {}) {
    this._requireInit();
    const token = this._operatorAuthority.issueToken(operatorId, role, opts);

    if (this._eventBus) {
      try {
        this._eventBus.emit(
          this._BUS_EVENTS?.OPERATOR?.TOKEN_ISSUED ?? 'governance.operator.token_issued',
          { operator_id: operatorId, role, lineage_ts: new Date().toISOString() }
        );
      } catch { /* non-fatal */ }
    }

    return token;
  }

  /**
   * Revoke a JTI via OperatorAuthority.
   * @param {string} jti
   * @param {object} opts — { reason }
   */
  async revokeToken(jti, opts = {}) {
    this._requireInit();
    replayHooks.assertNotReplay('operators.revokeToken');

    const result = await this._operatorAuthority.revokeToken(jti, opts);

    if (this._eventBus) {
      try {
        this._eventBus.emit(
          this._BUS_EVENTS?.OPERATOR?.TOKEN_REVOKED ?? 'governance.operator.token_revoked',
          { jti, reason: opts.reason ?? '', lineage_ts: new Date().toISOString() }
        );
      } catch { /* non-fatal */ }
    }

    return result;
  }

  /**
   * Verify a token without side effects. Safe in replay.
   */
  verifyToken(token) {
    this._requireInit();
    return this._operatorAuthority.verifyToken(token);
  }

  get ROLES() {
    return this._operatorAuthority?.ROLES ?? {};
  }
}

module.exports = { GovernedOperators };
