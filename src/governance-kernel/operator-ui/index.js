'use strict';

/**
 * Governance Kernel — Operator Control Plane (Phase A2)
 *
 * Entry point for the operator UI layer.
 *
 * Architecture:
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  OPERATOR LAYER — human decision (ADMIN/OPERATOR/VIEWER)  │
 *   └──────────────────────────┬────────────────────────────────┘
 *                              │ governed intent only
 *   ┌──────────────────────────▼────────────────────────────────┐
 *   │  CONTROL PLANE — state/transport/replay                   │
 *   │  GovernedStateStore, GovernedEventStream, ReplayTimeline  │
 *   └──────────────────────────┬────────────────────────────────┘
 *                              │ HTTP governed API only
 *   ┌──────────────────────────▼────────────────────────────────┐
 *   │  API GATEWAY — OperatorAuthority.requireAuth() + audit    │
 *   └──────────────────────────┬────────────────────────────────┘
 *                              │ kernel api/ calls only
 *   ┌──────────────────────────▼────────────────────────────────┐
 *   │  GOVERNANCE KERNEL — sole authority                       │
 *   └───────────────────────────────────────────────────────────┘
 *
 * UI_AUTHORITY_BOUNDARY:
 *   - This package never imports governance-kernel/core/ or api/ directly
 *   - All kernel access is through API gateway routes
 *   - GovernedStateStore is a READ MODEL ONLY
 *
 * Certification:
 *   - UIConsistencyCertification (10 checks)
 *   - ReplaySurfaceCertification (8 checks)
 *   - AuthorityBoundaryCertification (10 checks)
 */

// State
const { GovernedStateStore, RENDERING_MODES, CONSISTENCY_LEVELS, AUTHORITY_SOURCES } = require('./state/GovernedStateStore');
const selectors = require('./state/selectors');
const reducers = require('./state/reducers');

// Transport
const { GovernedEventStream, DEFAULT_POLL_INTERVALS_MS } = require('./transport/GovernedEventStream');
const { SnapshotClient } = require('./transport/SnapshotClient');

// Replay
const { ReplayTimeline } = require('./replay/ReplayTimeline');
const { ForensicView } = require('./replay/ForensicView');

// Core UI models
const { ConfigProposalBuilder, PROPOSAL_STATES } = require('./core/ConfigProposalBuilder');
const { ConfigDiffEngine } = require('./core/ConfigDiffEngine');
const { OperatorSessionView, ROLES, ROLE_CAPABILITIES } = require('./core/OperatorSessionView');
const { TopologyGraph } = require('./core/TopologyGraph');
const { DriftVisualization, DRIFT_LEVELS } = require('./core/DriftVisualization');

// Plugin system
const { UIPluginRegistry, ALLOWED_EXTENSION_TYPES, FORBIDDEN_EXTENSION_TYPES } = require('./plugins/UIPluginRegistry');

// Certification
const { UIConsistencyCertification } = require('./certification/UIConsistencyCertification');
const { ReplaySurfaceCertification } = require('./certification/ReplaySurfaceCertification');
const { AuthorityBoundaryCertification } = require('./certification/AuthorityBoundaryCertification');

/**
 * Run all three UI certification suites.
 * Returns combined certification report.
 */
async function certifyUI(opts = {}) {
  const runners = [
    new UIConsistencyCertification(opts),
    new ReplaySurfaceCertification(opts),
    new AuthorityBoundaryCertification(opts),
  ];

  const results = await Promise.all(runners.map(r => r.run()));

  const totalPass = results.reduce((sum, r) => sum + r.pass_count, 0);
  const totalFail = results.reduce((sum, r) => sum + r.fail_count, 0);
  const totalWarn = results.reduce((sum, r) => sum + (r.warn_count || 0), 0);

  const rating = totalFail > 0 ? 'FAIL'
    : totalWarn > 0 ? 'CONDITIONAL'
    : 'PASS';

  return {
    phase: 'A2',
    component: 'operator-ui',
    generated_at: new Date().toISOString(),
    overall_rating: rating,
    runner_count: runners.length,
    pass_count: totalPass,
    fail_count: totalFail,
    conditional_count: totalWarn,
    results,
  };
}

module.exports = {
  // State
  GovernedStateStore,
  RENDERING_MODES,
  CONSISTENCY_LEVELS,
  AUTHORITY_SOURCES,
  selectors,
  reducers,

  // Transport
  GovernedEventStream,
  DEFAULT_POLL_INTERVALS_MS,
  SnapshotClient,

  // Replay
  ReplayTimeline,
  ForensicView,

  // Core UI models
  ConfigProposalBuilder,
  PROPOSAL_STATES,
  ConfigDiffEngine,
  OperatorSessionView,
  ROLES,
  ROLE_CAPABILITIES,
  TopologyGraph,
  DriftVisualization,
  DRIFT_LEVELS,

  // Plugins
  UIPluginRegistry,
  ALLOWED_EXTENSION_TYPES,
  FORBIDDEN_EXTENSION_TYPES,

  // Certification
  UIConsistencyCertification,
  ReplaySurfaceCertification,
  AuthorityBoundaryCertification,
  certifyUI,
};
