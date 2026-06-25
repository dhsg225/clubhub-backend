'use strict';
/**
 * SimulationCluster — deterministic multi-node authority cluster.
 *
 * H1: Same seed → identical cluster behavior.
 * H2: No DB connections — MEMORY adapter only.
 * H4: Split-brain explicitly surfaced via detectDivergence().
 *
 * Each node maintains:
 *   - epoch, frozen state, config, incidents, ledger, operator tokens, plugins
 *
 * Cluster operations:
 *   broadcastFreeze(reason, sourceNodeId)     → partition-aware propagation
 *   broadcastUnfreeze(reason, sourceNodeId)   → partition-aware
 *   incrementEpoch(sourceNodeId)              → propagates to reachable nodes
 *   broadcastConfig(key, val, v, sourceNode)  → config update propagation
 *   detectDivergence()                        → explicit split-brain detection
 *   snapshot()                                → serializable full state
 */
const crypto = require('node:crypto');

// ——— SimulationNode ——————————————————————————————————————————————————————

class SimulationNode {
  constructor(id, clock) {
    this.id           = id;
    this._clock       = clock;
    this.clockOffset  = 0;         // FaultInjector sets this for skew
    this.epoch        = 0;
    this.frozen       = false;
    this.freeze_reason = null;
    this.config       = {};
    this.config_version = 0;
    this.incidents    = [];
    this.operator_tokens = new Map(); // token → { revoked, registered_at, opts }
    this.plugin_registry = new Map(); // id → { failed, registered_at }
    this.workflows    = new Map();    // id → { state, created_at }
    this.state        = 'ACTIVE';
    this.ledger       = { entries: [] };
    this.seen_event_ids = new Set();  // replay dedup
  }

  /** Node-local virtual time with clock skew applied. */
  now() { return this._clock.now() + this.clockOffset; }

  // — Freeze / Unfreeze —————————————————————————————————————

  applyFreeze(reason) {
    this.frozen       = true;
    this.freeze_reason = reason;
  }

  applyUnfreeze() {
    this.frozen        = false;
    this.freeze_reason = null;
  }

  // — Config ————————————————————————————————————————————————

  /** Returns false if version is stale (no-op). */
  updateConfig(key, value, version) {
    if (version <= this.config_version) return false;
    this.config[key]      = value;
    this.config_version   = version;
    return true;
  }

  // — Incidents —————————————————————————————————————————————

  addIncident(incident) {
    this.incidents.push({ ...incident, detected_at: this.now(), node_id: this.id });
  }

  resolveIncident(id) {
    const inc = this.incidents.find(i => i.id === id);
    if (inc) inc.resolved_at = this.now();
    return !!inc;
  }

  // — Ledger ————————————————————————————————————————————————

  /** Append a hash-chained ledger entry. Returns the full entry with hash. */
  appendLedgerEntry(entry) {
    const prevHash = this.ledger.entries.length > 0
      ? this.ledger.entries[this.ledger.entries.length - 1].hash
      : '0'.repeat(64);

    const full = {
      ...entry,
      prev_hash:   prevHash,
      step_index:  this.ledger.entries.length,
      ts:          this.now(),
    };
    const hash = crypto.createHash('sha256').update(JSON.stringify(full)).digest('hex');
    const stored = Object.freeze({ ...full, hash });
    this.ledger.entries.push(stored);
    return stored;
  }

  /** Verify full hash chain. Returns { valid, tampered_at, reason }. */
  verifyLedger() {
    let prevHash = '0'.repeat(64);
    for (let i = 0; i < this.ledger.entries.length; i++) {
      const entry = this.ledger.entries[i];
      if (entry.prev_hash !== prevHash) {
        return { valid: false, tampered_at: i, reason: 'prev_hash_mismatch' };
      }
      const { hash, ...rest } = entry;
      const computed = crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex');
      if (computed !== hash) {
        return { valid: false, tampered_at: i, reason: 'hash_mismatch' };
      }
      prevHash = hash;
    }
    return { valid: true, tampered_at: null, reason: null };
  }

  // — Operator Tokens ———————————————————————————————————————

  registerToken(token, opts = {}) {
    this.operator_tokens.set(token, { ...opts, registered_at: this.now(), revoked: false });
  }

  revokeToken(token) {
    const t = this.operator_tokens.get(token);
    if (t) { t.revoked = true; t.revoked_at = this.now(); }
    return !!t;
  }

  validateToken(token) {
    const t = this.operator_tokens.get(token);
    return !!(t && !t.revoked);
  }

  // — Plugins ———————————————————————————————————————————————

  registerPlugin(id, plugin = {}) {
    this.plugin_registry.set(id, { ...plugin, id, registered_at: this.now(), failed: false });
  }

  failPlugin(id) {
    const p = this.plugin_registry.get(id);
    if (p) { p.failed = true; p.failed_at = this.now(); }
    return !!p;
  }

  // — Workflows —————————————————————————————————————————————

  startWorkflow(id, opts = {}) {
    if (this.workflows.has(id)) return { ok: false, reason: 'collision' };
    this.workflows.set(id, { id, state: 'RUNNING', created_at: this.now(), ...opts });
    return { ok: true };
  }

  completeWorkflow(id) {
    const wf = this.workflows.get(id);
    if (!wf) return false;
    wf.state       = 'COMPLETE';
    wf.completed_at = this.now();
    return true;
  }

  // — Snapshot ——————————————————————————————————————————————

  snapshot() {
    return Object.freeze({
      id:              this.id,
      epoch:           this.epoch,
      frozen:          this.frozen,
      freeze_reason:   this.freeze_reason,
      clock_offset_ms: this.clockOffset,
      config_version:  this.config_version,
      incident_count:  this.incidents.length,
      token_count:     this.operator_tokens.size,
      plugin_count:    this.plugin_registry.size,
      workflow_count:  this.workflows.size,
      ledger_length:   this.ledger.entries.length,
      state:           this.state,
      local_time_ms:   this.now(),
    });
  }
}

// ——— SimulationCluster ———————————————————————————————————————————————————

class SimulationCluster {
  constructor({ seed, nodeCount = 3, clock, eventBus }) {
    if (!clock)    throw new TypeError('SimulationCluster requires clock');
    if (!eventBus) throw new TypeError('SimulationCluster requires eventBus');

    this._seed            = seed;
    this._clock           = clock;
    this._bus             = eventBus;
    this._nodes           = new Map();
    this._epoch           = 0;
    this._authority_node  = null;
    this._frozen          = false;
    this.consensusDelayMs = 0; // FaultInjector patches this

    for (let i = 0; i < nodeCount; i++) {
      const id = `node_${i}`;
      this._nodes.set(id, new SimulationNode(id, clock));
    }
    // First node holds authority at bootstrap
    if (this._nodes.size > 0) {
      this._authority_node = 'node_0';
    }
  }

  // ——— Accessors ———————————————————————————————————————————————

  get nodes()          { return this._nodes; }
  get epoch()          { return this._epoch; }
  get authority_node() { return this._authority_node; }
  get seed()           { return this._seed; }

  getNode(id) { return this._nodes.get(id) ?? null; }

  nodeIds() { return [...this._nodes.keys()]; }

  // ——— Authority ———————————————————————————————————————————————

  /**
   * Increment global epoch and propagate to all reachable nodes.
   * Nodes behind a partition receive epoch via flush() after partition heals.
   */
  incrementEpoch(sourceNodeId) {
    sourceNodeId = sourceNodeId ?? this._authority_node;
    this._epoch++;

    for (const [id, node] of this._nodes) {
      if (this._bus.isPartitioned(sourceNodeId, id)) {
        // Queue delayed epoch if consensus delay active
        if (this.consensusDelayMs > 0) {
          this._bus.emitDelayed(
            'simulation.epoch.propagated',
            { epoch: this._epoch, target_node: id },
            this.consensusDelayMs,
            { source_node: sourceNodeId },
          );
        }
        continue; // withheld
      }
      node.epoch = this._epoch;
    }

    this._bus.emit('simulation.epoch.incremented', {
      epoch: this._epoch, sourceNodeId,
    }, { source_node: sourceNodeId });

    return this._epoch;
  }

  // ——— Freeze Propagation ——————————————————————————————————————

  /**
   * Broadcast freeze from sourceNodeId to all reachable nodes.
   * Returns { ok, results } where results[nodeId] = 'APPLIED' | 'WITHHELD'.
   */
  broadcastFreeze(reason, sourceNodeId) {
    sourceNodeId = sourceNodeId ?? this._authority_node;
    const results = {};

    for (const [id, node] of this._nodes) {
      if (id !== sourceNodeId && this._bus.isPartitioned(sourceNodeId, id)) {
        results[id] = 'WITHHELD';
        continue;
      }
      node.applyFreeze(reason);
      results[id] = 'APPLIED';
    }

    this._frozen = true;
    this._bus.emit('simulation.cluster.freeze_broadcast', {
      reason, sourceNodeId, results,
    }, { source_node: sourceNodeId });

    return { ok: true, results };
  }

  /**
   * Broadcast unfreeze from sourceNodeId to all reachable nodes.
   */
  broadcastUnfreeze(reason, sourceNodeId) {
    sourceNodeId = sourceNodeId ?? this._authority_node;
    const results = {};

    for (const [id, node] of this._nodes) {
      if (id !== sourceNodeId && this._bus.isPartitioned(sourceNodeId, id)) {
        results[id] = 'WITHHELD';
        continue;
      }
      node.applyUnfreeze();
      results[id] = 'APPLIED';
    }

    this._frozen = false;
    this._bus.emit('simulation.cluster.unfreeze_broadcast', {
      reason, sourceNodeId, results,
    }, { source_node: sourceNodeId });

    return { ok: true, results };
  }

  // ——— Config Propagation ——————————————————————————————————————

  broadcastConfig(key, value, version, sourceNodeId) {
    sourceNodeId = sourceNodeId ?? this._authority_node;
    const results = {};

    for (const [id, node] of this._nodes) {
      if (id !== sourceNodeId && this._bus.isPartitioned(sourceNodeId, id)) {
        results[id] = 'WITHHELD';
        continue;
      }
      results[id] = node.updateConfig(key, value, version) ? 'APPLIED' : 'STALE';
    }

    this._bus.emit('simulation.config.broadcast', {
      key, version, sourceNodeId, results,
    }, { source_node: sourceNodeId });

    return { ok: true, results };
  }

  // ——— Divergence Detection ————————————————————————————————————

  /**
   * Compare node states and surface split-brain explicitly.
   * H4 requirement: divergence must be explicitly returned.
   */
  detectDivergence() {
    const epochs   = new Map();
    const freezes  = new Map();
    const configs  = new Map();

    for (const [id, node] of this._nodes) {
      epochs.set(id,  node.epoch);
      freezes.set(id, node.frozen);
      configs.set(id, node.config_version);
    }

    const epoch_diverged  = new Set(epochs.values()).size  > 1;
    const freeze_diverged = new Set(freezes.values()).size > 1;
    const config_diverged = new Set(configs.values()).size > 1;
    const diverged        = epoch_diverged || freeze_diverged || config_diverged;

    const detail = {
      diverged,
      epoch_diverged,
      freeze_diverged,
      config_diverged,
      epochs:          Object.fromEntries(epochs),
      frozen_states:   Object.fromEntries(freezes),
      config_versions: Object.fromEntries(configs),
    };

    if (diverged) {
      this._bus.emit('simulation.cluster.divergence_detected', detail);
    }

    return detail;
  }

  // ——— Snapshot ————————————————————————————————————————————————

  snapshot() {
    return Object.freeze({
      seed:             this._seed,
      epoch:            this._epoch,
      authority_node:   this._authority_node,
      frozen:           this._frozen,
      consensus_delay_ms: this.consensusDelayMs,
      node_count:       this._nodes.size,
      clock_ms:         this._clock.now(),
      nodes:            Object.fromEntries(
        [...this._nodes.entries()].map(([id, n]) => [id, n.snapshot()])
      ),
    });
  }
}

module.exports = { SimulationCluster, SimulationNode };
