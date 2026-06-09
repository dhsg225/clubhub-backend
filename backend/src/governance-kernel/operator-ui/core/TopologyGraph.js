'use strict';

/**
 * TopologyGraph — computes topology graph model from cluster status data.
 *
 * Derives node states, split-brain status, freeze epoch divergence,
 * config drift, and authority confidence scores from raw cluster status.
 *
 * Input: cluster status snapshot from AuthorityCoordinator.getClusterStatus()
 * Output: graph model for operator visualization
 *
 * UI_AUTHORITY_BOUNDARY: Pure computation model. No kernel imports.
 */

const STALE_THRESHOLD_MS = 30_000;       // HEALTHY → STALE boundary
const EVICT_THRESHOLD_MS = 120_000;      // STALE → unknown/evict-eligible
const DB_ADVISORY_STALE_MS = 60_000;     // DB advisory lock freshness
const DB_ADVISORY_WARN_MS = 300_000;     // DB advisory lock warning threshold

class TopologyGraph {
  constructor(opts = {}) {
    this._clockNow = opts.clockNow || (() => Date.now());
  }

  /**
   * Build topology graph model from raw cluster status.
   * clusterStatus: from AuthorityCoordinator.getClusterStatus()
   */
  build(clusterStatus, opts = {}) {
    if (!clusterStatus) return this._empty();

    const nowMs = this._clockNow();
    const nodes = this._buildNodes(clusterStatus.nodes || clusterStatus.screens || [], nowMs);
    const splitBrain = this._detectSplitBrain(nodes);
    const freezeEpochDivergence = this._detectFreezeEpochDivergence(nodes);
    const configDrift = this._detectConfigDrift(nodes);
    const overallConfidence = this._computeOverallConfidence(nodes);
    const dbState = this._computeDbState(clusterStatus, nowMs);

    return {
      nodes,
      node_count: nodes.length,
      healthy_count: nodes.filter(n => n.status === 'HEALTHY').length,
      stale_count: nodes.filter(n => n.status === 'STALE').length,
      evicted_count: nodes.filter(n => n.status === 'EVICTED').length,
      split_brain: splitBrain,
      freeze_epoch_divergence: freezeEpochDivergence,
      config_drift: configDrift,
      overall_confidence: overallConfidence,
      db_state: dbState,
      freeze_state: clusterStatus.freeze_state ?? null,
      authority_epoch: clusterStatus.epoch ?? null,
      generated_at: clusterStatus.generated_at ?? null,
      consistency_level: 'MEMORY_ONLY',
      ha_ceiling: '2-node active/active (shared PostgreSQL primary)',
    };
  }

  // ─── Node building ────────────────────────────────────────────────────────

  _buildNodes(rawNodes, nowMs) {
    return rawNodes.map(n => {
      const lastSeenMs = n.last_seen ? new Date(n.last_seen).getTime() : 0;
      const ageMs = nowMs - lastSeenMs;
      const status = this._classifyNodeStatus(n, ageMs);
      const confidence = this._computeNodeConfidence(n, ageMs);

      return {
        id: n.id || n.node_id || n.screen_id,
        last_seen: n.last_seen || n.last_heartbeat,
        age_ms: ageMs,
        status,
        confidence,
        freeze_epoch: n.freeze_epoch ?? null,
        authority_epoch: n.authority_epoch ?? null,
        config_hash: n.config_hash ?? null,
        freeze_state: n.freeze_state ?? null,
        metadata: n.metadata || n.fields || {},
      };
    });
  }

  _classifyNodeStatus(node, ageMs) {
    if (node.evicted) return 'EVICTED';
    if (ageMs <= STALE_THRESHOLD_MS) return 'HEALTHY';
    if (ageMs <= EVICT_THRESHOLD_MS) return 'STALE';
    return 'UNKNOWN';
  }

  _computeNodeConfidence(node, ageMs) {
    if (node.evicted) return 'NONE';
    if (ageMs <= 5000) return 'HIGH';
    if (ageMs <= STALE_THRESHOLD_MS) return 'MEDIUM';
    if (ageMs <= EVICT_THRESHOLD_MS) return 'LOW';
    return 'NONE';
  }

  // ─── Anomaly detection ────────────────────────────────────────────────────

  _detectSplitBrain(nodes) {
    const activeNodes = nodes.filter(n => n.status !== 'EVICTED' && n.status !== 'UNKNOWN');
    if (activeNodes.length < 2) return null;

    const epochs = new Set(activeNodes.map(n => n.authority_epoch).filter(e => e !== null));
    const freezeStates = new Set(activeNodes.map(n => n.freeze_state).filter(s => s !== null));

    if (epochs.size > 1 || freezeStates.size > 1) {
      return {
        detected: true,
        epoch_divergence: epochs.size > 1,
        freeze_state_divergence: freezeStates.size > 1,
        epochs: [...epochs],
        freeze_states: [...freezeStates],
        affected_nodes: activeNodes.map(n => ({
          id: n.id,
          authority_epoch: n.authority_epoch,
          freeze_state: n.freeze_state,
        })),
      };
    }
    return { detected: false };
  }

  _detectFreezeEpochDivergence(nodes) {
    const epochs = nodes
      .filter(n => n.status !== 'EVICTED' && n.freeze_epoch !== null)
      .map(n => n.freeze_epoch);
    if (epochs.length < 2) return { detected: false };

    const uniqueEpochs = new Set(epochs);
    if (uniqueEpochs.size > 1) {
      return {
        detected: true,
        epochs: [...uniqueEpochs],
        message: 'Nodes report different freeze epochs — one node may not have received the latest freeze/unfreeze',
      };
    }
    return { detected: false };
  }

  _detectConfigDrift(nodes) {
    const hashes = nodes
      .filter(n => n.status !== 'EVICTED' && n.config_hash)
      .map(n => n.config_hash);
    if (hashes.length < 2) return { detected: false };

    const uniqueHashes = new Set(hashes);
    if (uniqueHashes.size > 1) {
      return {
        detected: true,
        hashes: [...uniqueHashes],
        message: 'Nodes report different config hashes — rolling restart or initFromDb(pool) required',
      };
    }
    return { detected: false };
  }

  _computeOverallConfidence(nodes) {
    const active = nodes.filter(n => n.status !== 'EVICTED');
    if (active.length === 0) return 'UNKNOWN';
    const order = ['HIGH', 'MEDIUM', 'LOW', 'NONE', 'UNKNOWN'];
    let worst = 0; // index 0 = HIGH
    for (const n of active) {
      const idx = order.indexOf(n.confidence);
      if (idx > worst) worst = idx;
    }
    return order[worst];
  }

  _computeDbState(clusterStatus, nowMs) {
    const lastAdvisoryMs = clusterStatus.last_advisory_lock_ms
      ? nowMs - clusterStatus.last_advisory_lock_ms
      : null;

    if (lastAdvisoryMs === null) return { status: 'UNKNOWN', age_ms: null };
    if (lastAdvisoryMs <= DB_ADVISORY_STALE_MS) return { status: 'HEALTHY', age_ms: lastAdvisoryMs };
    if (lastAdvisoryMs <= DB_ADVISORY_WARN_MS) return { status: 'STALE', age_ms: lastAdvisoryMs };
    return { status: 'UNREACHABLE', age_ms: lastAdvisoryMs };
  }

  _empty() {
    return {
      nodes: [], node_count: 0, healthy_count: 0, stale_count: 0, evicted_count: 0,
      split_brain: null, freeze_epoch_divergence: { detected: false }, config_drift: { detected: false },
      overall_confidence: 'UNKNOWN', db_state: { status: 'UNKNOWN' }, consistency_level: 'MEMORY_ONLY',
    };
  }
}

module.exports = { TopologyGraph };
