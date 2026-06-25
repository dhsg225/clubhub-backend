'use strict';

/**
 * DriftVisualization — produces structured drift alerts for operator UI.
 *
 * Takes a TopologyGraph model and produces a set of DriftAlert objects
 * for rendering in the operator topology panel.
 *
 * Drift types:
 *   - SPLIT_BRAIN: epoch or freeze_state divergence between instances
 *   - FREEZE_EPOCH_DIVERGENCE: different freeze epochs across nodes
 *   - CONFIG_DRIFT: different config hashes across nodes
 *   - STALE_NODES: nodes past CACHE_COHERENT threshold
 *   - LINEAGE_GAP: event stream gaps detected in session
 *   - DB_UNREACHABLE: DB advisory lock not recently confirmed
 *
 * UI_AUTHORITY_BOUNDARY: Pure model. No kernel imports.
 */

const DRIFT_LEVELS = Object.freeze({
  CRITICAL: 'CRITICAL',   // Block mutations — must resolve
  WARNING: 'WARNING',     // Advisory — investigate
  INFO: 'INFO',           // Informational — no action required
});

class DriftVisualization {
  /**
   * Analyze a TopologyGraph model and produce drift alerts.
   * graph: output of TopologyGraph.build()
   * opts.lineageGapCount: number of detected event stream gaps (from GovernedEventStream stats)
   */
  static analyze(graph, opts = {}) {
    const alerts = [];

    if (!graph) return { alerts: [], highest_level: null, mutations_blocked: false };

    // SPLIT_BRAIN — critical
    if (graph.split_brain?.detected) {
      alerts.push({
        type: 'SPLIT_BRAIN',
        level: DRIFT_LEVELS.CRITICAL,
        message: 'Split brain detected — instances report conflicting authority state',
        detail: graph.split_brain,
        resolution: 'Use "Force DB check" to get authoritative state from DB, then confirm resolution',
        blocks_mutations: true,
      });
    }

    // FREEZE_EPOCH_DIVERGENCE — warning
    if (graph.freeze_epoch_divergence?.detected) {
      alerts.push({
        type: 'FREEZE_EPOCH_DIVERGENCE',
        level: DRIFT_LEVELS.WARNING,
        message: `Freeze epoch divergence: nodes report epochs ${graph.freeze_epoch_divergence.epochs.join(', ')}`,
        detail: graph.freeze_epoch_divergence,
        resolution: 'Use "Force DB check" to sync freeze state. Consider rolling restart.',
        blocks_mutations: false,
      });
    }

    // CONFIG_DRIFT — warning
    if (graph.config_drift?.detected) {
      alerts.push({
        type: 'CONFIG_DRIFT',
        level: DRIFT_LEVELS.WARNING,
        message: `Config drift detected across nodes`,
        detail: graph.config_drift,
        resolution: 'Trigger rolling restart or call govConfig.initFromDb(pool) on stale instances',
        blocks_mutations: false,
      });
    }

    // STALE_NODES — warning or info
    const staleNodes = (graph.nodes || []).filter(n => n.status === 'STALE');
    if (staleNodes.length > 0) {
      alerts.push({
        type: 'STALE_NODES',
        level: staleNodes.length > graph.node_count / 2 ? DRIFT_LEVELS.WARNING : DRIFT_LEVELS.INFO,
        message: `${staleNodes.length} node(s) have stale heartbeats (> 30s)`,
        detail: { stale_node_ids: staleNodes.map(n => n.id) },
        resolution: 'Check node connectivity and heartbeat configuration',
        blocks_mutations: false,
      });
    }

    // DB_UNREACHABLE — critical if freeze state is from memory only
    if (graph.db_state?.status === 'UNREACHABLE') {
      const freezeIsSafe = graph.freeze_state === true; // fail-closed: frozen = safe
      alerts.push({
        type: 'DB_UNREACHABLE',
        level: freezeIsSafe ? DRIFT_LEVELS.WARNING : DRIFT_LEVELS.CRITICAL,
        message: 'DB advisory lock not recently confirmed — governance-db unreachable',
        detail: { age_ms: graph.db_state.age_ms },
        resolution: freezeIsSafe
          ? 'Deployment is frozen (FAIL_CLOSED). Investigate DB connectivity.'
          : 'LINEARIZED operations unavailable. Investigate DB connectivity immediately.',
        blocks_mutations: !freezeIsSafe,
      });
    }

    // LINEAGE_GAP — info or warning
    const gapCount = opts.lineageGapCount || 0;
    if (gapCount > 0) {
      alerts.push({
        type: 'LINEAGE_GAP',
        level: gapCount > 3 ? DRIFT_LEVELS.WARNING : DRIFT_LEVELS.INFO,
        message: `${gapCount} event stream gap(s) detected — state may be incomplete`,
        detail: { gap_count: gapCount },
        resolution: 'State will reconcile from next snapshot fetch. No action required if count is stable.',
        blocks_mutations: false,
      });
    }

    const highest = DriftVisualization._highestLevel(alerts);
    const blocked = alerts.some(a => a.blocks_mutations);

    return { alerts, highest_level: highest, mutations_blocked: blocked };
  }

  static _highestLevel(alerts) {
    if (alerts.some(a => a.level === DRIFT_LEVELS.CRITICAL)) return DRIFT_LEVELS.CRITICAL;
    if (alerts.some(a => a.level === DRIFT_LEVELS.WARNING)) return DRIFT_LEVELS.WARNING;
    if (alerts.length > 0) return DRIFT_LEVELS.INFO;
    return null;
  }
}

module.exports = { DriftVisualization, DRIFT_LEVELS };
