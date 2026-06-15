'use strict';
const { ManifestBuilder, sha256 } = require('./manifest-builder');

const PACKAGE_TYPES = Object.freeze({
  WORKFLOW:   'WORKFLOW',
  INCIDENT:   'INCIDENT',
  DEPLOYMENT: 'DEPLOYMENT',
  AI_DECISION:'AI_DECISION',
  TOPOLOGY:   'TOPOLOGY',
});

class PackageBuilder {
  constructor({ traceStore, decisionTrace, topology, policyEngine, lifecycleCoordinator } = {}) {
    this._traceStore  = traceStore           ?? null;
    this._dt          = decisionTrace        ?? null;
    this._topology    = topology             ?? null;
    this._policy      = policyEngine         ?? null;
    this._lifecycle   = lifecycleCoordinator ?? null;
    this._manifest    = new ManifestBuilder();
    this._seq         = 0;
  }

  _packageId(type) { return `pkg_${type.toLowerCase()}_${++this._seq}`; }

  async buildWorkflowPackage(workflowId) {
    const traces = await this._traceStore?.getByWorkflow?.(workflowId) ?? [];
    const topology_snap = this._topology?.snapshot() ?? null;
    const contents  = { traces, topology_snap, workflow_id: workflowId };
    const packageId = this._packageId(PACKAGE_TYPES.WORKFLOW);
    const manifest  = this._manifest.build(packageId, PACKAGE_TYPES.WORKFLOW, contents, { workflow_id: workflowId });
    return { package_id: packageId, type: PACKAGE_TYPES.WORKFLOW, manifest, contents, package_hash: sha256(contents) };
  }

  buildAIDecisionPackage(agentId) {
    const entries       = this._dt?.getFinalized().filter(e => e.agent_id === agentId) ?? [];
    const chain_valid   = this._dt?.verifyChain?.()?.valid ?? null;
    const policies      = this._policy?.getPolicies() ?? [];
    const contents      = { entries, chain_valid, policies, agent_id: agentId };
    const packageId     = this._packageId(PACKAGE_TYPES.AI_DECISION);
    const manifest      = this._manifest.build(packageId, PACKAGE_TYPES.AI_DECISION, contents, { agent_id: agentId });
    return { package_id: packageId, type: PACKAGE_TYPES.AI_DECISION, manifest, contents, package_hash: sha256(contents) };
  }

  buildTopologyPackage() {
    const topology_snap = this._topology?.snapshot() ?? {};
    const lifecycle_snap= this._lifecycle?.snapshot() ?? {};
    const contents      = { topology_snap, lifecycle_snap };
    const packageId     = this._packageId(PACKAGE_TYPES.TOPOLOGY);
    const manifest      = this._manifest.build(packageId, PACKAGE_TYPES.TOPOLOGY, contents, {});
    return { package_id: packageId, type: PACKAGE_TYPES.TOPOLOGY, manifest, contents, package_hash: sha256(contents) };
  }
}

module.exports = { PackageBuilder, PACKAGE_TYPES };
