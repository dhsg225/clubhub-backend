'use strict';
/**
 * GovernanceSDKClient
 *
 * Wraps injected governance kernel API instances.
 * All kernel access routes through this client — no caller ever touches core/ directly.
 *
 * NEVER imports governance-kernel/core/ directly.
 * NEVER constructs new Pool() — pool is always injected.
 * All mutations are tagged with their consistency level.
 */

const { ACTIONS }         = require('./actions');
const { validateAction }  = require('./validation');

class GovernanceSDKClient {
  constructor(deps) {
    this._authorityCoordinator = deps.authorityCoordinator ?? null;
    this._freezeController     = deps.freezeController     ?? null;
    this._incidentManager      = deps.incidentManager      ?? null;
    this._configAuthority      = deps.configAuthority      ?? null;
    this._operatorAuthority    = deps.operatorAuthority    ?? null;
    this._auditLedger          = deps.auditLedger          ?? null;
    this._deploymentRuntime    = deps.deploymentRuntime    ?? null;
    this._eventBus             = deps.eventBus             ?? null;
    this._pool                 = deps.pool                 ?? null;
    this._traceStore           = deps.traceStore           ?? null;  // optional trace hook
  }

  /**
   * execute(actionType, args, opts)
   *
   * Routes an SDK action to the appropriate kernel API method.
   * Tags result with consistency level for audit + replay.
   */
  async execute(actionType, args = {}, opts = {}) {
    validateAction(actionType, args);

    const actionDef = ACTIONS[actionType];
    const apiKey    = `_${actionDef.api}`;
    const api       = this[apiKey];

    if (!api) {
      throw new Error(`GovernanceSDKClient: kernel API '${actionDef.api}' not injected`);
    }

    // LINEARIZED operations require pool; pass as first arg
    const callArgs = actionDef.requiresPool
      ? [this._pool, args, opts]
      : [args, opts];

    const result = await api[actionDef.method](...callArgs);

    // Non-invasive traceStore hook — additive only
    if (this._traceStore) {
      await this._traceStore.appendTraceSafe({
        workflow_id:       opts?.workflow_id ?? 'sdk.direct',
        step_index:        opts?.step_index  ?? 0,
        event_type:        'sdk.execute',
        payload:           { actionType, consistency: actionDef.consistency },
        lineage_ts:        opts?.logical_ts  ?? 0,
        consistency_level: actionDef.consistency,
      });
    }

    return {
      actionType,
      consistency: actionDef.consistency,
      result,
    };
  }

  // ── Read-only operations ─────────────────────────────────────────────────
  async getEpoch()           { return this._authorityCoordinator.getEpoch(); }
  async isFrozen()           { return this._freezeController.isFrozen(); }
  async isFrozenStrong()     { return this._freezeController.isFrozenStrong(this._pool); }
  async getConfig(dotPath)   { return this._configAuthority.get(dotPath); }
  async getActiveIncidents() { return this._incidentManager.getActive(); }
  async getAuditEntries(n)   { return this._auditLedger.getRecent(n ?? 20); }
}

module.exports = { GovernanceSDKClient };
