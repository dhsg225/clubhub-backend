'use strict';
/**
 * cluster-consensus.js — Cluster state authority and split-brain detection.
 *
 * Every artifact response includes an authority_epoch and artifact_generation.
 * Nodes report these back via their heartbeat (next poll response). The
 * consensus engine compares reported epochs/versions across the cluster to detect:
 *
 *   SPLIT_BRAIN        — nodes running different artifact versions simultaneously
 *   AUTHORITY_LOSS     — no node has seen the current epoch (backend just restarted)
 *   STALE_NODE         — node has not polled within STALE_THRESHOLD_MS
 *   DEGRADED           — minority of nodes are stale or behind
 *   HEALTHY            — all active nodes on current epoch and artifact version
 *
 * Automatic freeze triggers:
 *   SPLIT_BRAIN     → sets rollout_frozen = true; rejects ring promotions
 *   AUTHORITY_LOSS  → rejects ring promotions until quorum re-establishes
 *
 * Usage:
 *   const cc = require('./cluster-consensus');
 *   cc.recordHeartbeat(node_id, { authority_epoch, artifact_version, artifact_hash,
 *                                  rollout_version, applied_at, previous_artifact_hash });
 *   const status = cc.getStatus();
 *   const snapshot = cc.getSnapshot();
 *
 * The artifact route calls:
 *   cc.incrementArtifactGeneration()  — when artifact content changes
 *   cc.getEpoch()                     — to include in artifact response
 *   cc.getArtifactGeneration()        — to include in artifact response
 */

const governanceDb = require('./governance-db');
const clock        = require('./clock');

const STALE_THRESHOLD_MS   = 120_000;   // 2 minutes — node is stale if silent longer
const SPLIT_BRAIN_THRESHOLD = 2;        // more than this many distinct artifact versions = split-brain
const QUORUM_PCT            = 0.6;      // 60% of nodes must be current for HEALTHY

// ─── Consensus state labels ───────────────────────────────────────────────────
const CONSENSUS_STATES = Object.freeze({
  HEALTHY:        'HEALTHY',
  DEGRADED:       'DEGRADED',
  SPLIT_BRAIN:    'SPLIT_BRAIN',
  AUTHORITY_LOSS: 'AUTHORITY_LOSS',
  STALE_NODE:     'STALE_NODE',
  // Keep old name for backward compat
  STALE_SCREEN:   'STALE_NODE',
});

// ─── Module-level state (singleton per process) ───────────────────────────────

let _epoch              = 1;
let _artifactGeneration = 1;
let _rolloutFrozen      = false;
let _freezeReason       = null;
let _freezeEpoch        = 0;
let _pool               = null;
let _dbFailurePolicy    = process.env.DB_FREEZE_FAILURE_POLICY ?? 'FAIL_CLOSED'; // FAIL_CLOSED | FAIL_OPEN | STALE_OK

const MAX_NODES   = 1000;  // resource governance: evict stale nodes on overflow
const MAX_SCREENS = MAX_NODES;  // backward compat alias

const _nodes = new Map(); // nodeId → HeartbeatRecord

/**
 * @typedef {object} HeartbeatRecord
 * @property {string}  node_id
 * @property {number}  authority_epoch
 * @property {number}  artifact_version
 * @property {string|null}  artifact_hash
 * @property {string|null}  rollout_version
 * @property {string|null}  previous_artifact_hash
 * @property {number}  applied_at              — node-reported timestamp (ms)
 * @property {number}  received_at             — backend wall-clock time
 * @property {boolean} stale                   — computed by getStatus()
 */

// ─── DB pool configuration ────────────────────────────────────────────────────

function setPool(pool) {
  _pool = pool;
}

// ─── DB initialisation ────────────────────────────────────────────────────────

async function initFromDb(pool) {
  const p = pool || _pool;
  if (!p) return;

  try {
    const epoch  = await governanceDb.getIntValue(p, 'authority_epoch', 1);
    const gen    = await governanceDb.getIntValue(p, 'manifest_generation', 1);
    const frozen = await governanceDb.getTextValue(p, 'rollout_frozen', '0');
    const reason = await governanceDb.getTextValue(p, 'freeze_reason', null);

    _epoch              = epoch;
    _artifactGeneration = gen;
    _rolloutFrozen      = frozen === '1';
    _freezeReason       = reason;
  } catch { /* non-fatal — continue with in-memory defaults */ }
}

// ─── Authoritative DB read ────────────────────────────────────────────────────

async function isRolloutFrozenFromDb(pool) {
  const p = pool || _pool;
  if (!p) return _rolloutFrozen;
  const val = await governanceDb.getTextValue(p, 'rollout_frozen', '0');
  return val === '1';
}

// ─── Epoch and generation management ─────────────────────────────────────────

/**
 * Increment authority_epoch.
 *
 * ACTIVE/ACTIVE SAFE: uses atomic DB increment and reads back the authoritative
 * new value. Memory is updated to match DB — no fire-and-forget divergence.
 *
 * Semantics: Call once per backend startup. In a cluster, each instance
 * independently marks a new authority event; the DB counter is the single
 * authoritative source. The returned epoch is the value all nodes will see
 * in the next artifact response from THIS instance.
 *
 * DB FAILURE: falls back to in-memory increment (advisory, may diverge).
 *
 * @returns {Promise<number>} new authoritative epoch
 */
async function incrementEpoch() {
  if (_pool) {
    try {
      const newEpoch = await governanceDb.incrementInt(_pool, 'authority_epoch', 'system');
      _epoch = newEpoch;
      return _epoch;
    } catch { /* DB failure — fall through to in-memory increment */ }
  }
  _epoch++;
  return _epoch;
}

/** Return current authority_epoch (in-memory; synchronous). */
function getEpoch() {
  return _epoch;
}

/**
 * Increment artifact generation.
 *
 * ACTIVE/ACTIVE SAFE: uses atomic DB increment and reads back the authoritative
 * new value. Because computeArtifact() already serializes per-node with
 * SELECT FOR UPDATE, concurrent calls for the same node are impossible.
 * Concurrent calls for different nodes each get a distinct DB increment,
 * which is correct behaviour (each node content change is a distinct event).
 *
 * DB FAILURE: falls back to in-memory increment (advisory, may diverge).
 *
 * @returns {Promise<number>} new authoritative artifact generation
 */
async function incrementArtifactGeneration() {
  if (_pool) {
    try {
      const newGen = await governanceDb.incrementInt(_pool, 'manifest_generation', 'system');
      _artifactGeneration = newGen;
      return _artifactGeneration;
    } catch { /* DB failure — fall through to in-memory increment */ }
  }
  _artifactGeneration++;
  return _artifactGeneration;
}

/** Backward compat alias for incrementArtifactGeneration */
const incrementManifestGeneration = incrementArtifactGeneration;

/** Return current artifact generation (in-memory; synchronous). */
function getArtifactGeneration() {
  return _artifactGeneration;
}

/** Backward compat alias for getArtifactGeneration */
const getManifestGeneration = getArtifactGeneration;

// ─── Heartbeat recording ──────────────────────────────────────────────────────

/**
 * Record a node heartbeat (from artifact poll response).
 * Nodes report back the epoch/version they last received.
 *
 * @param {string} nodeId
 * @param {object} heartbeat
 *   authority_epoch         — epoch from last artifact response this node received
 *   artifact_version        — artifact_generation from last response
 *   artifact_hash           — checksum of the artifact content
 *   rollout_version         — OTA target version (null if none)
 *   applied_at              — timestamp (ms) when node applied the artifact
 *   previous_artifact_hash  — hash of the artifact before the last change
 */
function recordHeartbeat(nodeId, heartbeat) {
  if (!nodeId) return;
  // Resource governance: evict the stalest node when at capacity
  if (!_nodes.has(nodeId) && _nodes.size >= MAX_NODES) {
    let staleKey = null;
    let oldestTs = Infinity;
    for (const [key, rec] of _nodes) {
      if (rec.received_at < oldestTs) {
        oldestTs = rec.received_at;
        staleKey = key;
      }
    }
    if (staleKey) _nodes.delete(staleKey);
  }
  _nodes.set(nodeId, {
    node_id:                nodeId,
    // Also expose as screen_id for backward compat
    screen_id:              nodeId,
    authority_epoch:        heartbeat.authority_epoch         ?? null,
    artifact_version:       heartbeat.artifact_version        ?? heartbeat.manifest_version ?? null,
    artifact_hash:          heartbeat.artifact_hash           ?? heartbeat.manifest_hash ?? null,
    rollout_version:        heartbeat.rollout_version         ?? null,
    previous_artifact_hash: heartbeat.previous_artifact_hash  ?? heartbeat.previous_manifest_hash ?? null,
    applied_at:             heartbeat.applied_at              ?? null,
    received_at:            clock.now(),
    stale:                  false,  // will be computed in getStatus()
  });
}

/** Alias for backward compat with screen-oriented callers */
const recordNodeHeartbeat = recordHeartbeat;

// ─── Consensus evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate the current consensus status of the cluster.
 * Mutates stale flag on node records as a side effect.
 *
 * @returns {{ status, current_epoch, current_artifact_generation, node_count,
 *             active_count, stale_count, split_brain_details, rollout_frozen }}
 */
function getStatus() {
  const now      = clock.now();
  const allNodes = [..._nodes.values()];

  if (allNodes.length === 0) {
    return {
      status:                      CONSENSUS_STATES.AUTHORITY_LOSS,
      current_epoch:               _epoch,
      current_artifact_generation: _artifactGeneration,
      // backward compat
      current_manifest_generation: _artifactGeneration,
      node_count:                  0,
      screen_count:                0,
      active_count:                0,
      stale_count:                 0,
      split_brain_details:         null,
      rollout_frozen:              _rolloutFrozen,
      freeze_reason:               _freezeReason,
    };
  }

  // Mark stale
  let staleCount = 0;
  for (const rec of allNodes) {
    rec.stale = now - rec.received_at > STALE_THRESHOLD_MS;
    if (rec.stale) staleCount++;
  }

  const activeNodes = allNodes.filter(n => !n.stale);
  const activeCount = activeNodes.length;

  // Authority loss: no active node has seen the current epoch
  const onCurrentEpoch = activeNodes.filter(n => n.authority_epoch === _epoch);
  if (activeCount > 0 && onCurrentEpoch.length === 0) {
    _setFreeze('AUTHORITY_LOSS: no active node has seen epoch ' + _epoch);
    return _buildStatus(CONSENSUS_STATES.AUTHORITY_LOSS, allNodes, staleCount, null);
  }

  // Split-brain detection: count distinct artifact versions among active nodes
  const artifactVersions = new Set(activeNodes.map(n => n.artifact_hash).filter(Boolean));
  if (artifactVersions.size > SPLIT_BRAIN_THRESHOLD) {
    const details = { distinct_artifact_hashes: [...artifactVersions], affected_count: activeCount };
    _setFreeze('SPLIT_BRAIN: ' + artifactVersions.size + ' distinct artifact hashes across cluster');
    return _buildStatus(CONSENSUS_STATES.SPLIT_BRAIN, allNodes, staleCount, details);
  }

  // Degraded: fewer than quorum are on current artifact generation
  const onCurrentGeneration = activeNodes.filter(n => n.artifact_version === _artifactGeneration);
  if (activeCount > 0 && onCurrentGeneration.length / activeCount < QUORUM_PCT) {
    return _buildStatus(CONSENSUS_STATES.DEGRADED, allNodes, staleCount, null);
  }

  // Any stale nodes = at minimum STALE_NODE (not HEALTHY)
  if (staleCount > 0) {
    return _buildStatus(CONSENSUS_STATES.STALE_NODE, allNodes, staleCount, null);
  }

  // All checks passed
  _clearFreeze();
  return _buildStatus(CONSENSUS_STATES.HEALTHY, allNodes, staleCount, null);
}

function _buildStatus(status, allNodes, staleCount, splitBrainDetails) {
  return {
    status,
    current_epoch:               _epoch,
    current_artifact_generation: _artifactGeneration,
    // backward compat
    current_manifest_generation: _artifactGeneration,
    node_count:                  allNodes.length,
    screen_count:                allNodes.length,
    active_count:                allNodes.filter(n => !n.stale).length,
    stale_count:                 staleCount,
    split_brain_details:         splitBrainDetails,
    rollout_frozen:              _rolloutFrozen,
    freeze_reason:               _freezeReason,
  };
}

function setFreeze(reason) {
  _setFreeze(reason);
}

function _setFreeze(reason) {
  if (!_rolloutFrozen) {
    _rolloutFrozen = true;
    _freezeReason  = reason;
    _freezeEpoch++;
    if (_pool) {
      governanceDb.setTextValue(_pool, 'rollout_frozen', '1', 'system').catch(() => {});
      governanceDb.setTextValue(_pool, 'freeze_reason', reason, 'system').catch(() => {});
      governanceDb.incrementInt(_pool, 'freeze_epoch', 'system').catch(() => {});
    }
  }
}

function _clearFreeze() {
  _rolloutFrozen = false;
  _freezeReason  = null;
  if (_pool) {
    governanceDb.setTextValue(_pool, 'rollout_frozen', '0', 'system').catch(() => {});
  }
}

/**
 * Strong freeze — awaits DB confirmation before updating in-memory state.
 * Write-path callers should use this to avoid epoch drift on DB failure.
 * DB failure policy: FAIL_CLOSED (default) | FAIL_OPEN | STALE_OK
 * Controlled via DB_FREEZE_FAILURE_POLICY env var or setDbFailurePolicy().
 */
async function freezeStrong(reason, pool) {
  if (_rolloutFrozen) return; // already frozen — idempotent
  const p = pool || _pool;
  if (p) {
    try {
      await governanceDb.setTextValue(p, 'rollout_frozen', '1', 'system');
      await governanceDb.setTextValue(p, 'freeze_reason', reason, 'system');
      const newEpoch = await governanceDb.incrementInt(p, 'freeze_epoch', 'system');
      // Only update memory AFTER DB confirms
      _rolloutFrozen = true;
      _freezeReason  = reason;
      _freezeEpoch   = newEpoch;
    } catch (err) {
      // DB outage — apply configured failure policy
      if (_dbFailurePolicy === 'FAIL_CLOSED') {
        _rolloutFrozen = true; // safe: fail closed
        _freezeReason  = reason + ' (DB_FAILURE_FAIL_CLOSED)';
        _freezeEpoch++;
      } else if (_dbFailurePolicy === 'FAIL_OPEN') {
        // Do not freeze — let promotions proceed (dangerous)
      } else {
        // STALE_OK: update memory with advisory freeze
        _rolloutFrozen = true;
        _freezeReason  = reason + ' (DB_FAILURE_STALE)';
        _freezeEpoch++;
      }
    }
  } else {
    // No pool — in-memory only
    _rolloutFrozen = true;
    _freezeReason  = reason;
    _freezeEpoch++;
  }
}

/** Set the DB failure policy for freeze operations. */
function setDbFailurePolicy(policy) {
  _dbFailurePolicy = policy;
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * Return a point-in-time snapshot of all node records plus consensus status.
 */
function getSnapshot() {
  const status = getStatus();
  const nodes  = [..._nodes.values()].map(n => ({ ...n }));
  return {
    generated_at: new Date().toISOString(),
    consensus:    status,
    nodes,
    // backward compat
    screens:      nodes,
  };
}

/**
 * Whether rollout promotions are currently frozen.
 * Callers must check this before promoting rings.
 */
function isRolloutFrozen() {
  return _rolloutFrozen;
}

/** Alias: isDeploymentFrozen — generic name for the kernel API */
const isDeploymentFrozen = isRolloutFrozen;

/**
 * Manually unfreeze rollout (operator action — requires explicit call).
 * @param {string} reason  Why the freeze is being cleared
 */
function unfreezeRollout(reason) {
  _rolloutFrozen = false;
  _freezeReason  = `Manually cleared: ${reason}`;
  _freezeEpoch++;
  if (_pool) {
    governanceDb.setTextValue(_pool, 'rollout_frozen', '0', 'system').catch(() => {});
    governanceDb.setTextValue(_pool, 'freeze_reason', _freezeReason, 'system').catch(() => {});
    governanceDb.incrementInt(_pool, 'freeze_epoch', 'system').catch(() => {});
  }
}

/** Alias: unfreezeDeployment — generic name for the kernel API */
const unfreezeDeployment = unfreezeRollout;

/**
 * Get the current freeze epoch counter.
 * @returns {number}
 */
function getFreezeEpoch() {
  return _freezeEpoch;
}

/**
 * DB-authoritative freeze state read.
 * Returns { frozen, reason, freeze_epoch } from the governance_kv store.
 * Use in active/active HA where in-memory state may be stale.
 *
 * @param {object} [pool]  — pg pool (uses module-level pool if not provided)
 * @returns {Promise<{ frozen: boolean, reason: string|null, freeze_epoch: number }>}
 */
async function getFreezeStateStrong(pool) {
  const p = pool || _pool;
  if (!p) return { frozen: _rolloutFrozen, reason: _freezeReason, freeze_epoch: _freezeEpoch };
  try {
    const frozen      = await governanceDb.getTextValue(p, 'rollout_frozen', '0');
    const reason      = await governanceDb.getTextValue(p, 'freeze_reason', null);
    const freezeEpoch = await governanceDb.getIntValue(p, 'freeze_epoch', 0);
    return { frozen: frozen === '1', reason, freeze_epoch: freezeEpoch };
  } catch {
    return { frozen: _rolloutFrozen, reason: _freezeReason, freeze_epoch: _freezeEpoch };
  }
}

// ─── Reset (test infrastructure) ─────────────────────────────────────────────
function _reset() {
  _epoch              = 1;
  _artifactGeneration = 1;
  _rolloutFrozen      = false;
  _freezeReason       = null;
  _freezeEpoch        = 0;
  _dbFailurePolicy    = process.env.DB_FREEZE_FAILURE_POLICY ?? 'FAIL_CLOSED';
  _nodes.clear();
}

module.exports = {
  CONSENSUS_STATES,
  STALE_THRESHOLD_MS,
  MAX_NODES,
  MAX_SCREENS,   // backward compat alias
  setPool,
  initFromDb,
  isRolloutFrozenFromDb,
  incrementEpoch,
  getEpoch,
  incrementArtifactGeneration,
  incrementManifestGeneration,  // backward compat
  getArtifactGeneration,
  getManifestGeneration,        // backward compat
  recordHeartbeat,
  recordNodeHeartbeat,          // alias
  getStatus,
  getSnapshot,
  isRolloutFrozen,
  isDeploymentFrozen,           // alias
  unfreezeRollout,
  unfreezeDeployment,           // alias
  getFreezeEpoch,
  getFreezeStateStrong,
  freezeStrong,
  setFreeze,
  setDbFailurePolicy,
  _reset,  // test use only
};
