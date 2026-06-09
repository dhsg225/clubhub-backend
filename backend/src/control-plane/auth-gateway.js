'use strict';
/**
 * auth-gateway.js — authentication and authorization for all control plane requests.
 * Stateless token validation. Operator roles enforced.
 */

const OPERATOR_ROLES = Object.freeze({
  ADMIN:    'ADMIN',
  OPERATOR: 'OPERATOR',
  VIEWER:   'VIEWER',
});

const ROLE_PERMISSIONS = Object.freeze({
  ADMIN:    ['FREEZE','UNFREEZE','PROMOTE_WAVE','ROLLBACK_DEPLOYMENT','COMPLETE_DEPLOYMENT',
             'CREATE_INCIDENT','TRANSITION_INCIDENT','ARCHIVE_INCIDENT','UPDATE_CONFIG',
             'APPEND_AUDIT','INCREMENT_EPOCH','APPROVE_AI_OPERATOR'],
  OPERATOR: ['PROMOTE_WAVE','ROLLBACK_DEPLOYMENT','COMPLETE_DEPLOYMENT',
             'CREATE_INCIDENT','TRANSITION_INCIDENT','APPEND_AUDIT','APPROVE_AI_OPERATOR'],
  VIEWER:   [],
});

class AuthGateway {
  constructor({ operatorTokens = new Map() } = {}) {
    // operatorTokens: Map<token, { operator_id, role, tenant_id }>
    this._tokens = operatorTokens;
  }

  registerOperator(token, operatorId, role, tenantId = null) {
    if (!Object.values(OPERATOR_ROLES).includes(role)) throw new Error(`AuthGateway: unknown role '${role}'`);
    this._tokens.set(token, { operator_id: operatorId, role, tenant_id: tenantId });
  }

  authenticate(token) {
    const identity = this._tokens.get(token);
    if (!identity) return null;
    return { ...identity };
  }

  authorize(identity, actionType) {
    if (!identity) return false;
    const perms = ROLE_PERMISSIONS[identity.role] ?? [];
    return perms.includes(actionType);
  }

  validateRequest(token, actionType) {
    const identity = this.authenticate(token);
    if (!identity) return { ok: false, reason: 'UNAUTHENTICATED' };
    if (!this.authorize(identity, actionType)) return { ok: false, reason: 'UNAUTHORIZED', identity };
    return { ok: true, identity };
  }
}

module.exports = { AuthGateway, OPERATOR_ROLES, ROLE_PERMISSIONS };
