'use strict';
/**
 * ControlPlaneServer — external API surface for the governed platform.
 * All requests: authenticated, lineage-tagged, rate-limited, traced.
 * NO direct kernel access. All mutations via ExecutionRouter → SDK → Kernel.
 */

const { validateRequest, buildResponse } = require('./api-contracts');
const { AuthGateway }      = require('./auth-gateway');
const { RateLimiter }      = require('./rate-limiter');
const { RequestLineage }   = require('./request-lineage');

class ControlPlaneServer {
  constructor({
    executionRouter,
    tenantRegistry,
    replayOrchestrator,
    topology,
    convergenceEngine,
    policyEngine,
    certRunners,
    authGateway,
    rateLimiter,
    eventBus,
  } = {}) {
    this._router      = executionRouter;
    this._auth        = authGateway   ?? new AuthGateway();
    this._limiter     = rateLimiter   ?? new RateLimiter();
    this._lineage     = new RequestLineage();
    this._eventBus    = eventBus      ?? null;
    this._handlers    = new Map();     // action_type → async handler
    this._initialized = false;
  }

  /**
   * Handle a control-plane request object:
   * { action_type, args, token, tenant_id, operator_id, correlation_id?, lineage_ts? }
   */
  async handle(rawRequest) {
    // 1. Tag with lineage
    const req = this._lineage.tag(rawRequest);

    // 2. Authenticate
    const authResult = this._auth.validateRequest(req.token, req.action_type);
    if (!authResult.ok) {
      return buildResponse(false, `auth: ${authResult.reason}`, { correlation_id: req.correlation_id });
    }

    // 3. Validate contract
    try { validateRequest(req); } catch (err) {
      return buildResponse(false, err.message, { correlation_id: req.correlation_id });
    }

    // 4. Rate limit
    const tenantId    = req.tenant_id    ?? 'default';
    const operatorId  = authResult.identity.operator_id;
    const limitResult = this._limiter.check(tenantId, operatorId, req.lineage_ts);
    if (!limitResult.ok) {
      return buildResponse(false, limitResult.reason, { correlation_id: req.correlation_id });
    }
    this._limiter.record(tenantId, operatorId, req.lineage_ts);

    // 5. Emit event
    if (this._eventBus) {
      this._eventBus.emit('platform.control_plane.request', {
        action_type:    req.action_type,
        correlation_id: req.correlation_id,
        tenant_id:      tenantId,
        operator_id:    operatorId,
      });
    }

    // 6. Route through execution router
    const result = await this._router.route('OPERATOR', req.action_type, req.args, {
      correlation_id: req.correlation_id,
      lineage_ts:     req.lineage_ts,
      tenant_id:      tenantId,
      operator_id:    operatorId,
    });

    return buildResponse(result.ok !== false, result, { correlation_id: req.correlation_id });
  }

  registerHandler(actionType, handler) {
    this._handlers.set(actionType, handler);
  }

  snapshot() {
    return {
      initialized:      this._initialized,
      registered_handlers: [...this._handlers.keys()],
    };
  }
}

module.exports = { ControlPlaneServer };
