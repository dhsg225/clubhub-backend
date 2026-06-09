'use strict';
/**
 * OTA Runtime — Governed plugin runtime for OTA deployment system.
 *
 * Phase A3: OTA Plugin Conversion + Governed Runtime Integration
 *
 * Architecture:
 *   OTA Routes → OTA Plugin Runtime → Governance Kernel APIs → governance-kernel/core/*
 *
 * OTA runtime is a GOVERNED APPLICATION — not an authority owner.
 * All authority operations route through kernel API classes.
 *
 * Lifecycle: UNINITIALIZED → BOOTING → ACTIVE (→ FROZEN | DEGRADED | REPLAY)
 *
 * Usage:
 *   const runtime = createOTARuntime();
 *   await runtime.init({ pool, authorityCoordinator, freezeController, ... });
 *   runtime.lifecycle.transition('ACTIVE', 'startup complete');
 *
 *   const router = runtime.createRouter({ pool });
 *   app.use('/api/ota-runtime', router);
 *
 *   const cert = await runtime.certifyRuntime();
 */

const { OTARuntimeLifecycle, LIFECYCLE_STATES } = require('./lifecycle');
const replayHooks                                = require('./replay-hooks');
const { GovernedDeployment }                     = require('./governed-deployment');
const { GovernedIncidents }                      = require('./governed-incidents');
const { GovernedConfig }                         = require('./governed-config');
const { GovernedOperators }                      = require('./governed-operators');
const { DeploymentRuntime }                      = require('./deployment-runtime');
const { createRouter }                           = require('./routes');

const {
  OTARuntimeCertification,
} = require('./certification/OTARuntimeCertification');
const {
  GovernedRoutingCertification,
} = require('./certification/GovernedRoutingCertification');
const {
  ReplayIsolationCertification,
} = require('./certification/ReplayIsolationCertification');
const {
  AuthorityBypassCertification,
} = require('./certification/AuthorityBypassCertification');
const {
  LifecycleConsistencyCertification,
} = require('./certification/LifecycleConsistencyCertification');

// ── Factory ───────────────────────────────────────────────────────────────────

function createOTARuntime() {
  const lifecycle          = new OTARuntimeLifecycle();
  const governedDeployment = new GovernedDeployment();
  const governedIncidents  = new GovernedIncidents();
  const governedConfig     = new GovernedConfig();
  const governedOperators  = new GovernedOperators();
  const deploymentRuntime  = new DeploymentRuntime();

  /**
   * Initialize with kernel API dependencies.
   * All kernel APIs are passed in — never imported directly from kernel/core/.
   *
   * @param {object} deps
   * @param {object} deps.authorityCoordinator — AuthorityCoordinator instance
   * @param {object} deps.freezeController     — FreezeController instance
   * @param {object} deps.incidentManager      — IncidentManager instance
   * @param {object} deps.auditLedger          — AuditLedger instance
   * @param {object} deps.configAuthority      — ConfigAuthority instance
   * @param {object} deps.operatorAuthority    — OperatorAuthority instance
   * @param {object} [deps.lineageEngine]      — LineageEngine instance (optional)
   * @param {object} [deps.eventBus]           — kernel event-bus module (optional)
   * @param {object} [deps.clock]              — DeterministicClock or governed-clock (optional)
   */
  async function init(deps = {}) {
    lifecycle.transition('BOOTING', 'OTA runtime initializing');

    const {
      authorityCoordinator,
      freezeController,
      incidentManager,
      auditLedger,
      configAuthority,
      operatorAuthority,
      lineageEngine,
      eventBus,
      clock,
    } = deps;

    const sharedDeps = {
      authorityCoordinator,
      freezeController,
      incidentManager,
      auditLedger,
      configAuthority,
      operatorAuthority,
      lineageEngine,
      eventBus,
      clock,
    };

    if (eventBus) lifecycle.setEventBus(eventBus);

    governedDeployment.init({
      authorityCoordinator,
      freezeController,
      auditLedger,
      lineageEngine,
      eventBus,
    });

    governedIncidents.init({
      incidentManager,
      auditLedger,
      eventBus,
    });

    governedConfig.init({
      configAuthority,
      auditLedger,
      eventBus,
    });

    governedOperators.init({
      operatorAuthority,
      auditLedger,
      eventBus,
    });

    deploymentRuntime.init({ clock });

    lifecycle.transition('RECOVERING', 'dependency initialization complete');
    // Caller transitions to ACTIVE after verifying kernel state
  }

  /**
   * Create a governed Express router.
   * @param {object} opts — { pool } pg.Pool for LINEARIZED operations
   */
  function createOTARouter(opts = {}) {
    return createRouter({
      governedDeployment,
      governedIncidents,
      governedConfig,
      governedOperators,
      deploymentRuntime,
      lifecycle,
      replayHooks,
      pool: opts.pool ?? null,
    });
  }

  /**
   * Run all A3 certification suites.
   * Static source analysis — does not require runtime state.
   * @returns {object} certification report
   */
  async function certifyRuntime() {
    const runners = [
      new OTARuntimeCertification(),
      new GovernedRoutingCertification(),
      new ReplayIsolationCertification(),
      new AuthorityBypassCertification(),
      new LifecycleConsistencyCertification(),
    ];

    const results   = [];
    let totalPass   = 0;
    let totalFail   = 0;

    for (const runner of runners) {
      const result = await runner.run();
      results.push(result);
      totalPass += result.pass_count;
      totalFail += result.fail_count;
    }

    const overallRating = totalFail > 0 ? 'FAIL' : 'PASS';
    lifecycle.setCertificationStatus(overallRating);

    return Object.freeze({
      phase:          'A3',
      component:      'ota-runtime',
      generated_at:   new Date().toISOString(),
      overall_rating: overallRating,
      runner_count:   results.length,
      pass_count:     totalPass,
      fail_count:     totalFail,
      results,
    });
  }

  // ── Replay mode control ───────────────────────────────────────────────────

  function enterReplay(correlationId) {
    replayHooks.enterReplay(correlationId);
    if (lifecycle.isActive()) {
      lifecycle.transition('REPLAY', 'kernel replay mode entered');
    }
  }

  function exitReplay() {
    replayHooks.exitReplay();
    if (lifecycle.isReplay()) {
      lifecycle.transition('ACTIVE', 'kernel replay mode exited');
    }
  }

  return {
    // Lifecycle
    lifecycle,
    LIFECYCLE_STATES,

    // Governed modules
    governedDeployment,
    governedIncidents,
    governedConfig,
    governedOperators,
    deploymentRuntime,

    // Replay
    replayHooks,
    enterReplay,
    exitReplay,

    // Init + routes
    init,
    createRouter: createOTARouter,

    // Certification
    certifyRuntime,

    // Snapshot
    snapshot() {
      return Object.freeze({
        plugin:              'ota',
        lifecycle:           lifecycle.snapshot(),
        deployment:          deploymentRuntime.snapshot(),
        config_version:      governedConfig.isFrozen?.() ?? null,
        replay_status:       replayHooks.status(),
        health:              lifecycle.healthReport(),
      });
    },
  };
}

module.exports = { createOTARuntime, LIFECYCLE_STATES };
