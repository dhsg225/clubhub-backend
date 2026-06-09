import fs   from 'node:fs';
import path from 'node:path';
import { MetricsCollector }                              from './lib/metrics.js';
import { FleetController }                               from './lib/fleet.js';
import { ChaosController }                               from './lib/chaos.js';
import { Reporter }                                      from './lib/reporter.js';
import { Clock }                                         from './lib/clock.js';
import { ProvenanceTracker }                             from './lib/provenance.js';
import { ReplayCapture, ReplayController, validateReplay } from './lib/replay.js';
import { applyMutation, getMutationLog, resetMutationLog,
         saveMutationLog, saveStateHashTrace }            from './lib/mutations.js';
import { MUTATION_OPERATIONS }                           from './lib/state-authority.js';
import { RecoveryGovernor }                              from './lib/recovery-governor.js';
import { createIncidentBundle }                          from './lib/incident-bundle.js';

async function main() {
  const args          = process.argv.slice(2);
  const suiteArg      = args.find(a => a.startsWith('--suite='))?.split('=')[1] || 'basic';
  const isCi          = args.includes('--ci');
  const noDocker      = args.includes('--no-docker');
  const deterministic = args.includes('--deterministic');
  const seed          = args.find(a => a.startsWith('--seed='))?.split('=')[1] || '42';
  const replayPath    = args.find(a => a.startsWith('--replay='))?.split('=')[1] ?? null;

  const clockMode = replayPath ? 'replay' : 'realtime';
  const clock     = new Clock(clockMode);

  const thresholdsPath = path.resolve(process.cwd(), 'test-config/thresholds.json');
  let thresholds = {};
  try {
    thresholds = JSON.parse(fs.readFileSync(thresholdsPath, 'utf8'));
  } catch {
    console.warn(`Warning: Could not load thresholds from ${thresholdsPath}. Gating disabled.`);
  }

  // ── Replay setup ─────────────────────────────────────────────────────────
  let replayController = null;
  let effectiveSeed    = seed;
  let effectiveDet     = deterministic;

  if (replayPath) {
    replayController = new ReplayController(replayPath);
    const rc = replayController.runConfig;
    if (rc.seed)          effectiveSeed = rc.seed;
    if (rc.deterministic) effectiveDet  = rc.deterministic;
    applyMutation({ domain: 'replay', entity_id: 'run', operation: MUTATION_OPERATIONS.TRANSITION,
      from_state: 'IDLE', to_state: 'LOADING', clock, mutator: 'runner' });
    applyMutation({ domain: 'replay', entity_id: 'run', operation: MUTATION_OPERATIONS.TRANSITION,
      from_state: 'LOADING', to_state: 'READY', clock, mutator: 'runner' });
    console.log(`[REPLAY] Loaded: ${replayPath} seed=${effectiveSeed}`);
  }

  const replayCapture = new ReplayCapture();
  replayCapture.setRunConfig({
    suiteOrder:    suiteArg === 'all' ? ['basic', 'chaos', 'stress'] : [suiteArg],
    seed:          effectiveSeed,
    deterministic: effectiveDet,
  });

  const metrics   = new MetricsCollector(clock);
  const reporter  = new Reporter({ ci: isCi });
  const recovery  = new RecoveryGovernor(clock, thresholds);
  const chaos    = new ChaosController({
    dockerEnabled:    !noDocker,
    clock,
    replayCapture:    replayController ? null : replayCapture,
    replayController: replayController ?? null,
    replayMode:       !!replayController,
    governor:         recovery,  // all waitForHealth() calls route through RecoveryGovernor
  });

  const fleet = new FleetController(metrics, {
    deterministic: effectiveDet, seed: effectiveSeed,
    backendUrl: process.env.BACKEND_URL || 'http://localhost:4000',
  });

  const suites = suiteArg === 'all' ? ['basic', 'chaos', 'stress'] : [suiteArg];

  process.on('SIGINT',  async () => { await fleet.stop(); process.exit(1); });
  process.on('SIGTERM', async () => { await fleet.stop(); process.exit(1); });

  // Metrics: CLEAN → COLLECTING
  applyMutation({ domain: 'metrics', entity_id: 'global', operation: MUTATION_OPERATIONS.TRANSITION,
    from_state: 'CLEAN', to_state: 'COLLECTING', clock, suite: suiteArg, mutator: 'runner' });

  if (replayController) {
    applyMutation({ domain: 'replay', entity_id: 'run', operation: MUTATION_OPERATIONS.TRANSITION,
      from_state: 'READY', to_state: 'REPLAYING', clock, mutator: 'runner' });
  }

  let allSuitesPassed = true;

  try {
    await fleet.start();
    for (const suiteName of suites) {
      metrics.setSuite(suiteName);
      applyMutation({ domain: 'suite', entity_id: suiteName, operation: MUTATION_OPERATIONS.TRANSITION,
        from_state: 'PENDING', to_state: 'RUNNING', clock, suite: suiteName, mutator: 'runner' });

      const module     = await import(`./suites/${suiteName}.js`);
      const suitePassed = await module.run(reporter, { fleet, chaos, metrics, thresholds });
      if (suitePassed === false) allSuitesPassed = false;

      applyMutation({ domain: 'suite', entity_id: suiteName, operation: MUTATION_OPERATIONS.TRANSITION,
        from_state: 'RUNNING', to_state: suitePassed === false ? 'FAILED' : 'PASSED',
        clock, suite: suiteName, mutator: 'runner' });
    }
  } catch (err) {
    console.error(`Fatal error running suite ${suiteArg}:`, err);
    allSuitesPassed = false;
  } finally {
    await fleet.stop();

    const summary = metrics.getSummary();

    const consistencyViolations = metrics.checkConsistency();
    if (consistencyViolations.length > 0) {
      allSuitesPassed = false;
      console.error('\nMETRIC CONSISTENCY VIOLATIONS:');
      consistencyViolations.forEach(v => console.error(`  [${v.metric}] ${v.issue}`));
    }

    const gatingResults = performThresholdGating(summary, thresholds);
    if (gatingResults.failed) {
      allSuitesPassed = false;
      console.error('\nCI GATE FAILURE: Thresholds exceeded!');
      gatingResults.errors.forEach(e => console.error(`- ${e}`));
    }

    // Metrics domain finalization
    const metricsFinal = gatingResults.breaches.length > 0 ? 'BREACHED' : 'COLLECTING';
    applyMutation({ domain: 'metrics', entity_id: 'global', operation: MUTATION_OPERATIONS.TRANSITION,
      from_state: metricsFinal, to_state: 'FINALIZED', clock, suite: suiteArg, mutator: 'runner' });

    const reportsDir  = path.resolve(process.cwd(), 'reports');
    const failuresDir = path.join(reportsDir, 'failures');
    try { fs.mkdirSync(failuresDir, { recursive: true }); } catch {}

    // ── Failure provenance ──────────────────────────────────────────────────
    if (gatingResults.breaches.length > 0) {
      const prov = new ProvenanceTracker();
      for (const breach of gatingResults.breaches) {
        prov.recordBreach({
          ...breach, suite: suiteArg,
          events: metrics.events, marks: metrics.marks,
          chaosTimeline: metrics.chaosTimeline, mutationLog: getMutationLog(),
        });
      }
      try {
        fs.writeFileSync(
          path.join(reportsDir, 'failure-provenance.json'),
          JSON.stringify(prov.getReport(), null, 2)
        );
      } catch {}
    }

    // ── Failure snapshot (immutable) ────────────────────────────────────────
    if (gatingResults.failed || consistencyViolations.length > 0) {
      try {
        const ts           = clock.iso().replace(/[:.]/g, '-');
        const snapshotPath = path.join(failuresDir, `${ts}-${suiteArg}.json`);
        fs.writeFileSync(snapshotPath, JSON.stringify({
          frozen_at: clock.iso(), suite: suiteArg,
          threshold_breaches: gatingResults.breaches,
          consistency_violations: consistencyViolations,
          metrics_summary: summary,
          event_buffer: metrics.events.slice(-200),
          active_thresholds: thresholds,
          chaos_timeline: metrics.chaosTimeline,
          mutation_log: getMutationLog(),
        }, null, 2));
        fs.chmodSync(snapshotPath, 0o444);
      } catch {}
    }

    // ── Persist mutation log + state-hash trace ─────────────────────────────
    saveMutationLog(reportsDir);
    const hashTrace = saveStateHashTrace(reportsDir, clock.iso());

    // ── Recovery governance report ───────────────────────────────────────────
    recovery.saveReport(reportsDir);

    // ── Evidence registry ───────────────────────────────────────────────────
    try {
      fs.writeFileSync(
        path.join(reportsDir, 'metric-evidence.json'),
        JSON.stringify({ run_id: new Date(clock.now()).toISOString(), suite: suiteArg, evidence: summary._evidence }, null, 2)
      );
    } catch {}

    // ── Incident bundle (severe failures) ───────────────────────────────────
    if (gatingResults.failed || consistencyViolations.length > 0) {
      try {
        createIncidentBundle({
          suite:          suiteArg,
          seed:           effectiveSeed,
          deterministic:  effectiveDet,
          thresholds,
          breaches:       gatingResults.breaches,
          consistencyViolations,
          metricsSummary: summary,
          mutationLog:    getMutationLog(),
          hashTrace,
          events:         metrics.events,
          chaosTimeline:  metrics.chaosTimeline,
          clock,
        }, reportsDir);
      } catch (bundleErr) {
        console.warn(`Warning: incident bundle creation failed — ${bundleErr.message}`);
      }
    }

    // ── Replay capture (live runs) ──────────────────────────────────────────
    if (!replayController) {
      try {
        replayCapture.setOriginalResults({
          summary, breaches: gatingResults.breaches,
          mutationLog: getMutationLog(), hashTrace,
        });
        replayCapture.save(path.join(reportsDir, 'replay-capture.json'));
      } catch {}
    }

    // ── Replay validation (--replay mode) ──────────────────────────────────
    if (replayController) {
      applyMutation({ domain: 'replay', entity_id: 'run', operation: MUTATION_OPERATIONS.TRANSITION,
        from_state: 'REPLAYING', to_state: 'VALIDATING', clock, mutator: 'runner' });
      try {
        const replayMutLog = getMutationLog().filter(m => m.replayable);
        const validationResult = validateReplay(
          replayController.capture, summary, gatingResults,
          { replayMutationLog: replayMutLog, replayHashTrace: hashTrace }
        );
        fs.writeFileSync(
          path.join(reportsDir, 'replay-validation.json'),
          JSON.stringify(validationResult, null, 2)
        );
        // Always write divergence report in replay mode
        fs.writeFileSync(
          path.join(reportsDir, 'state-divergence.json'),
          JSON.stringify({
            generated_at:        clock.iso(),
            status:              validationResult.status,
            mutation_divergences: validationResult.mutation_comparison ?? [],
            hash_divergences:    validationResult.hash_comparison ?? [],
            metric_divergences:  validationResult.metric_comparison ?? [],
            divergences:         validationResult.divergences,
          }, null, 2)
        );
        applyMutation({ domain: 'replay', entity_id: 'run', operation: MUTATION_OPERATIONS.TRANSITION,
          from_state: 'VALIDATING', to_state: validationResult.status === 'PASS' ? 'PASSED' : 'FAILED',
          clock, mutator: 'runner' });
        if (validationResult.status === 'FAIL') {
          allSuitesPassed = false;
          console.error('\nREPLAY VALIDATION FAILED:');
          validationResult.divergences.forEach(d => console.error(`  ${d}`));
        } else {
          console.log('[REPLAY] Validation PASSED.');
        }
      } catch (err) {
        console.warn(`Warning: replay validation error — ${err.message}`);
      }
    }

    const success = await reporter.finish(summary);
    process.exit((allSuitesPassed && success) ? 0 : 1);
  }
}

function performThresholdGating(summary, thresholds) {
  if (!thresholds || Object.keys(thresholds).length === 0) {
    return { failed: false, errors: [], breaches: [] };
  }
  const errors = [], breaches = [];
  function addBreach(threshold_key, value, threshold, operator, message) {
    errors.push(message);
    breaches.push({ threshold_key, value, threshold, operator });
  }

  if (thresholds.performance) {
    if (summary.poll_success_rate < thresholds.performance.min_poll_success_rate)
      addBreach('performance.min_poll_success_rate', summary.poll_success_rate, thresholds.performance.min_poll_success_rate, 'gte',
        `Poll success rate ${summary.poll_success_rate.toFixed(2)}% below threshold ${thresholds.performance.min_poll_success_rate}%`);
    if (summary.p95_latency_ms > thresholds.performance.max_p95_latency_ms)
      addBreach('performance.max_p95_latency_ms', summary.p95_latency_ms, thresholds.performance.max_p95_latency_ms, 'lte',
        `P95 latency ${summary.p95_latency_ms.toFixed(2)}ms exceeds threshold ${thresholds.performance.max_p95_latency_ms}ms`);
    if (summary.max_poll_drift_ms > thresholds.performance.max_poll_drift_ms)
      addBreach('performance.max_poll_drift_ms', summary.max_poll_drift_ms, thresholds.performance.max_poll_drift_ms, 'lte',
        `Max poll drift ${summary.max_poll_drift_ms}ms exceeds threshold ${thresholds.performance.max_poll_drift_ms}ms`);
  }
  if (thresholds.coherence) {
    if (summary.desync_count > thresholds.coherence.max_desync_count)
      addBreach('coherence.max_desync_count', summary.desync_count, thresholds.coherence.max_desync_count, 'eq',
        `Desync count ${summary.desync_count} exceeds threshold ${thresholds.coherence.max_desync_count}`);
    if (summary.max_desync_duration_ms > thresholds.coherence.max_desync_duration_ms)
      addBreach('coherence.max_desync_duration_ms', summary.max_desync_duration_ms, thresholds.coherence.max_desync_duration_ms, 'lte',
        `Max desync duration ${summary.max_desync_duration_ms}ms exceeds threshold ${thresholds.coherence.max_desync_duration_ms}ms`);
  }
  if (thresholds.recovery) {
    const nr = summary.named_recoveries ?? {};
    if (nr.backend_restart > thresholds.recovery.backend_restart_ms)
      addBreach('recovery.backend_restart_ms', nr.backend_restart, thresholds.recovery.backend_restart_ms, 'lte',
        `Backend restart recovery ${nr.backend_restart}ms exceeds threshold ${thresholds.recovery.backend_restart_ms}ms`);
    if (nr.db_restart > thresholds.recovery.db_restart_ms)
      addBreach('recovery.db_restart_ms', nr.db_restart, thresholds.recovery.db_restart_ms, 'lte',
        `DB restart recovery ${nr.db_restart}ms exceeds threshold ${thresholds.recovery.db_restart_ms}ms`);
    if (nr.network_outage > thresholds.recovery.network_outage_recovery_ms)
      addBreach('recovery.network_outage_recovery_ms', nr.network_outage, thresholds.recovery.network_outage_recovery_ms, 'lte',
        `Network outage recovery ${nr.network_outage}ms exceeds threshold ${thresholds.recovery.network_outage_recovery_ms}ms`);
  }
  return { failed: errors.length > 0, errors, breaches };
}

main().catch(err => { console.error(err); process.exit(1); });
