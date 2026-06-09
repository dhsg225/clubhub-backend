'use strict';
/**
 * ExecutionRouter — canonical execution path for ALL mutations.
 * All mutations route through SDK. No bypass. No direct kernel access.
 *
 * Rule: EVERY mutation must:
 *   1. carry a correlation_id
 *   2. route through sdkClient.execute()
 *   3. emit a trace event
 *   4. be rejectable at this layer
 */

const EXECUTION_SOURCES = Object.freeze({
  WORKFLOW:      'WORKFLOW',
  AI_AGENT:      'AI_AGENT',
  OTA:           'OTA',
  OPERATOR:      'OPERATOR',
  REPLAY:        'REPLAY',
  PLATFORM:      'PLATFORM',
});

class ExecutionRouter {
  constructor({ sdkClient, eventBus, lifecycleCoordinator, traceStore } = {}) {
    this._sdkClient  = sdkClient           ?? null;
    this._eventBus   = eventBus            ?? null;
    this._lifecycle  = lifecycleCoordinator ?? null;
    this._traceStore = traceStore          ?? null;
    this._seq        = 0;
    this._blocked    = false;
  }

  _correlationId() { return `exec_${++this._seq}`; }

  block()   { this._blocked = true; }
  unblock() { this._blocked = false; }

  async route(source, actionType, args, opts = {}) {
    if (this._blocked) {
      return { ok: false, blocked: true, reason: 'execution_router_blocked' };
    }

    if (!Object.values(EXECUTION_SOURCES).includes(source)) {
      throw new Error(`ExecutionRouter: unknown source '${source}'`);
    }

    if (!this._sdkClient) {
      throw new Error('ExecutionRouter: sdkClient not configured');
    }

    const correlation_id = opts.correlation_id ?? this._correlationId();
    const lineage_ts     = opts.lineage_ts     ?? Date.now();

    if (this._eventBus) {
      this._eventBus.emit('platform.execution.routed', { source, actionType, correlation_id, lineage_ts });
    }

    const result = await this._sdkClient.execute(actionType, args, {
      ...opts,
      correlation_id,
      lineage_ts,
    });

    if (this._eventBus) {
      this._eventBus.emit('platform.execution.completed', { source, actionType, correlation_id });
    }

    return { ok: true, correlation_id, result };
  }

  snapshot() {
    return {
      blocked:     this._blocked,
      calls_routed: this._seq,
    };
  }
}

module.exports = { ExecutionRouter, EXECUTION_SOURCES };
