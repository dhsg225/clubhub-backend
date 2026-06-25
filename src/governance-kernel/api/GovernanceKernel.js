'use strict';
/**
 * GovernanceKernel — Central orchestrator for the governance platform.
 *
 * Lifecycle:
 *   kernel.init(pool)      — initialize DB schema, load state from DB
 *   kernel.recover(pool)   — recover from crash (increments epoch)
 *   kernel.snapshot()      — return governance state snapshot
 *   kernel.replay(events)  — replay events against frozen clock
 *   kernel.freeze(reason)  — freeze all deployments cluster-wide
 *   kernel.unfreeze(r)     — lift freeze
 *   kernel.certify()       — run certification suite
 *   kernel.shutdown()      — graceful shutdown
 *
 * Consistency levels:
 *   MEMORY_ONLY      — in-memory, lost on restart
 *   CACHE_COHERENT   — cached, may be slightly stale
 *   DB_AUTHORITATIVE — single authoritative DB read
 *   LINEARIZED       — advisory-lock serialized write
 *
 * Replay modes:
 *   LIVE       — normal operation
 *   REPLAY     — replaying from event log
 *   FORENSIC   — read-only forensic analysis
 *   SIMULATION — deterministic frozen-clock simulation
 *
 * HA ceiling: 2-node active/active, shared PostgreSQL primary
 */
const clusterConsensus  = require('../core/cluster-consensus');
const configMod         = require('../core/config-authority');
const incidentMgr       = require('../core/incident-manager');
const auditLedger       = require('../core/audit-ledger');
const sessionAuth       = require('../core/session-authority');
const governanceDb      = require('../core/governance-db');
const clock             = require('../core/clock');
const eventBus          = require('../event-bus');
const GovernanceCertificationRunner = require('../certification/GovernanceCertificationRunner');

const CONSISTENCY_LEVELS = Object.freeze({
  MEMORY_ONLY:      'MEMORY_ONLY',
  CACHE_COHERENT:   'CACHE_COHERENT',
  DB_AUTHORITATIVE: 'DB_AUTHORITATIVE',
  LINEARIZED:       'LINEARIZED',
});

const REPLAY_MODES = Object.freeze({
  LIVE:       'LIVE',
  REPLAY:     'REPLAY',
  FORENSIC:   'FORENSIC',
  SIMULATION: 'SIMULATION',
});

class GovernanceKernel {
  constructor(opts = {}) {
    this._pool            = null;
    this._mode            = REPLAY_MODES.LIVE;
    this._domain          = opts.domain ?? 'default';
    this._bootstrapConfig = opts.bootstrapConfig ?? {};
    this._govConfig       = null;
    this._initialized     = false;
  }

  async init(pool, opts = {}) {
    this._pool = pool;
    await governanceDb.initSchema(pool);

    const { GovernedConfig, setInstance: setGovConfig } = configMod;
    this._govConfig = new GovernedConfig(this._bootstrapConfig, null);
    setGovConfig(this._govConfig);
    this._govConfig.setPool(pool);
    try { await this._govConfig.initFromDb(pool); } catch { /* non-fatal */ }

    clusterConsensus.setPool(pool);
    await clusterConsensus.initFromDb(pool);

    auditLedger.setPool(pool);
    await auditLedger.initFromDb(pool);

    sessionAuth.setPool(pool);
    try { await sessionAuth.initFromDb(pool); } catch { /* non-fatal */ }

    try { await incidentMgr.initFromDb?.(pool); } catch { /* optional */ }

    this._initialized = true;
    eventBus.emit('governance.kernel.initialized', { domain: this._domain, mode: this._mode });
  }

  async recover(pool) {
    if (!this._initialized) await this.init(pool ?? this._pool);
    await clusterConsensus.incrementEpoch();
    eventBus.emit('governance.kernel.recovered', {
      domain: this._domain,
      epoch:  clusterConsensus.getEpoch(),
    });
  }

  snapshot() {
    return Object.freeze({
      domain:         this._domain,
      mode:           this._mode,
      initialized:    this._initialized,
      epoch:          clusterConsensus.getEpoch(),                  // CACHE_COHERENT
      frozen:         clusterConsensus.isDeploymentFrozen(),         // CACHE_COHERENT
      cluster_status: clusterConsensus.getStatus(),                  // MEMORY_ONLY
      config_version: this._govConfig?._version ?? 0,               // MEMORY_ONLY
      clock_frozen:   clock.isFrozen(),
      timestamp:      clock.nowIso(),
    });
  }

  async replay(events, opts = {}) {
    const prevMode = this._mode;
    this._mode = REPLAY_MODES.REPLAY;
    clock.freeze();
    try {
      for (const evt of events) {
        if (evt.lineage_ts) clock.setFixed(new Date(evt.lineage_ts).getTime());
        eventBus.emit('governance.kernel.replay_event', evt);
      }
    } finally {
      clock.unfreeze();
      this._mode = prevMode;
    }
  }

  async freeze(reason, pool) {
    return clusterConsensus.freezeStrong(reason, pool ?? this._pool);
  }

  async unfreeze(reason) {
    clusterConsensus.unfreezeDeployment(reason);
  }

  async certify(opts = {}) {
    const runner = new GovernanceCertificationRunner({ ...opts, reportDir: opts.reportDir });
    return runner.run();
  }

  async shutdown() {
    eventBus.emit('governance.kernel.shutdown', { domain: this._domain });
  }

  get CONSISTENCY_LEVELS() { return CONSISTENCY_LEVELS; }
  get REPLAY_MODES() { return REPLAY_MODES; }
}

module.exports = { GovernanceKernel, CONSISTENCY_LEVELS, REPLAY_MODES };
