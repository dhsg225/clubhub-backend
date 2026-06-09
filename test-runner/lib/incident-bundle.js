/**
 * incident-bundle.js — Incident reproduction bundle creator.
 *
 * Every severe threshold breach or consistency violation produces a reproducible
 * incident bundle. The bundle contains all artifacts required to reproduce
 * the failure offline:
 *
 *   - replay capture        (reports/replay-capture.json)
 *   - mutation log          (complete mutation envelope sequence)
 *   - state hash trace      (chain entries for divergence detection)
 *   - provenance chain      (causal chain from chaos mark to first failure)
 *   - threshold breaches    (exact breach values and thresholds)
 *   - governed thresholds   (snapshot of thresholds.json at time of failure)
 *   - environment metadata  (node version, platform, suite, seed)
 *   - event stream slice    (last 500 metric events)
 *   - recovery actions      (recovery-governance.json entries for this run)
 *   - divergence report     (state-divergence.json if replay was run)
 *
 * Bundle format:
 *   reports/incidents/<incident_id>-manifest.json   — index + bundle_hash
 *   reports/incidents/<incident_id>.tar.gz          — compressed archive (if tar available)
 *   reports/incidents/<incident_id>-bundle.json     — fallback JSON bundle (always written)
 *
 * The bundle_hash is SHA-256 of the canonical bundle manifest. Corruption is
 * detected on load by recomputing and comparing.
 *
 * The replay_command field embeds the exact CLI invocation needed to replay the run.
 *
 * Usage:
 *   import { createIncidentBundle } from './incident-bundle.js';
 *   const bundle = createIncidentBundle(ctx, reportsDir);
 *
 * ctx shape:
 *   suite, seed, deterministic,
 *   thresholds, breaches, consistencyViolations,
 *   metricsSummary, mutationLog, hashTrace,
 *   events, chaosTimeline, provenanceReport,
 *   divergenceReport, recoveryReport, clock
 */

import fs      from 'node:fs';
import path    from 'node:path';
import crypto  from 'node:crypto';
import { execSync } from 'node:child_process';

// ─── Canonical serialiser (same as state-hash.js — inline to avoid circular dep) ─

function stableStringifyLocal(val) {
  if (val === null || val === undefined) return String(val);
  if (typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + val.map(stableStringifyLocal).join(',') + ']';
  const keys = Object.keys(val).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${stableStringifyLocal(val[k])}`).join(',') + '}';
}

function bundleHash(manifest) {
  return crypto.createHash('sha256').update(stableStringifyLocal(manifest)).digest('hex');
}

// ─── Incident ID generator ────────────────────────────────────────────────────

function generateIncidentId(suite, clock) {
  const ts  = new Date(clock ? clock.now() : Date.now()).toISOString().replace(/[:.]/g, '-');
  const rnd = crypto.randomBytes(3).toString('hex');
  return `${ts}-${suite}-${rnd}`;
}

// ─── Load optional report file ────────────────────────────────────────────────

function loadOptional(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch { /* non-fatal */ }
  return null;
}

// ─── Core bundle creator ──────────────────────────────────────────────────────

/**
 * Create an incident reproduction bundle.
 *
 * @param {object} ctx  Failure context (see module header)
 * @param {string} reportsDir  Absolute path to reports directory
 * @returns {{ incident_id, manifest_path, bundle_path, bundle_hash }}
 */
export function createIncidentBundle(ctx, reportsDir) {
  const {
    suite             = 'unknown',
    seed              = '42',
    deterministic     = false,
    thresholds        = {},
    breaches          = [],
    consistencyViolations = [],
    metricsSummary    = {},
    mutationLog       = [],
    hashTrace         = [],
    events            = [],
    chaosTimeline     = [],
    provenanceReport  = null,
    divergenceReport  = null,
    recoveryReport    = null,
    clock             = null,
  } = ctx;

  const incident_id   = generateIncidentId(suite, clock);
  const incidentsDir  = path.join(reportsDir, 'incidents');

  try {
    fs.mkdirSync(incidentsDir, { recursive: true });
  } catch { /* non-fatal */ }

  // Load any already-written report files that weren't passed directly
  const replayCapture  = loadOptional(path.join(reportsDir, 'replay-capture.json'));
  const provenanceFull = provenanceReport ?? loadOptional(path.join(reportsDir, 'failure-provenance.json'));
  const divergenceFull = divergenceReport ?? loadOptional(path.join(reportsDir, 'state-divergence.json'));
  const recoveryFull   = recoveryReport   ?? loadOptional(path.join(reportsDir, 'recovery-governance.json'));

  // Construct the replay command that reproduces this run
  const replayCapturePath = path.join(reportsDir, 'replay-capture.json');
  const replay_command = replayCapture
    ? `node test-runner/runner.js --suite=${suite} --replay=${replayCapturePath} --seed=${seed}`
    : `node test-runner/runner.js --suite=${suite} --seed=${seed}${deterministic ? ' --deterministic' : ''}`;

  // Build the complete bundle
  const bundle = {
    format_version:   '1',
    incident_id,
    generated_at:     new Date(clock ? clock.now() : Date.now()).toISOString(),
    severity:         breaches.length > 0 ? 'THRESHOLD_BREACH' : 'CONSISTENCY_VIOLATION',
    replay_command,

    // Run configuration (required for replay)
    run_config: {
      suite,
      seed,
      deterministic,
    },

    // What failed
    threshold_breaches:       breaches,
    consistency_violations:   consistencyViolations,

    // Threshold snapshot at time of failure (for offline verification)
    governed_thresholds:      thresholds,

    // Metrics
    metrics_summary:          metricsSummary,
    event_stream_slice:       events.slice(-500),
    chaos_timeline:           chaosTimeline,

    // State machine trace
    mutation_log:             mutationLog,
    state_hash_trace:         hashTrace,

    // Causal and replay artifacts
    replay_capture:           replayCapture,
    provenance_chain:         provenanceFull,
    divergence_report:        divergenceFull,
    recovery_actions:         recoveryFull,

    // Environment
    environment: {
      node_version: process.version,
      platform:     process.platform,
      arch:         process.arch,
      pid:          process.pid,
    },
  };

  // Compute the bundle_hash BEFORE adding it (hash the content, not the envelope)
  const hash = bundleHash(bundle);
  bundle.bundle_hash = hash;

  // Write the full JSON bundle (always — tar fallback if tar unavailable)
  const bundleJsonPath = path.join(incidentsDir, `${incident_id}-bundle.json`);
  try {
    fs.writeFileSync(bundleJsonPath, JSON.stringify(bundle, null, 2));
  } catch (err) {
    console.error(`[incident-bundle] Failed to write JSON bundle: ${err.message}`);
  }

  // Write a lightweight manifest (index) file with bundle_hash for integrity checks
  const manifestContent = {
    format_version:    '1',
    incident_id,
    generated_at:      bundle.generated_at,
    severity:          bundle.severity,
    suite,
    seed,
    bundle_hash:       hash,
    replay_command,
    replay_source:     replayCapture ? replayCapturePath : null,
    threshold_snapshot_present: Object.keys(thresholds).length > 0,
    mutation_log_entries: mutationLog.length,
    artifacts: {
      bundle_json:     path.relative(reportsDir, bundleJsonPath),
      bundle_tar_gz:   null,  // updated below if tar succeeds
    },
  };

  // Attempt tar.gz creation
  const tarPath = path.join(incidentsDir, `${incident_id}.tar.gz`);
  try {
    // Write component files for tar
    const tmpDir = path.join(incidentsDir, `_tmp-${incident_id}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // Write each component as a separate file in the tmp dir
    const writes = {
      'bundle-manifest.json': manifestContent,
      'run-config.json':      bundle.run_config,
      'threshold-breaches.json': bundle.threshold_breaches,
      'governed-thresholds.json': bundle.governed_thresholds,
      'metrics-summary.json':  bundle.metrics_summary,
      'mutation-log.json':     bundle.mutation_log,
      'state-hash-trace.json': bundle.state_hash_trace,
    };
    if (bundle.replay_capture)   writes['replay-capture.json']   = bundle.replay_capture;
    if (bundle.provenance_chain) writes['provenance-chain.json'] = bundle.provenance_chain;
    if (bundle.divergence_report) writes['divergence-report.json'] = bundle.divergence_report;
    if (bundle.recovery_actions) writes['recovery-actions.json'] = bundle.recovery_actions;

    for (const [filename, content] of Object.entries(writes)) {
      fs.writeFileSync(path.join(tmpDir, filename), JSON.stringify(content, null, 2));
    }

    execSync(`tar -czf ${tarPath} -C ${incidentsDir} ${path.basename(tmpDir)}`, { stdio: 'pipe' });
    // Clean up tmp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
    manifestContent.artifacts.bundle_tar_gz = path.relative(reportsDir, tarPath);
  } catch {
    // tar failure is non-fatal — JSON bundle is the canonical artifact
  }

  const manifestPath = path.join(incidentsDir, `${incident_id}-manifest.json`);
  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2));
    // Make manifest immutable
    fs.chmodSync(manifestPath, 0o444);
  } catch { /* non-fatal */ }

  console.log(`[incident-bundle] Bundle created: incidents/${incident_id}-manifest.json (hash=${hash.slice(0, 8)})`);

  return {
    incident_id,
    manifest_path: manifestPath,
    bundle_path:   bundleJsonPath,
    bundle_hash:   hash,
  };
}

/**
 * Verify a bundle's integrity by recomputing its hash.
 * Returns { valid, expected_hash, actual_hash }.
 *
 * @param {string} bundleJsonPath  Path to <incident_id>-bundle.json
 */
export function verifyBundle(bundleJsonPath) {
  try {
    const raw    = fs.readFileSync(bundleJsonPath, 'utf8');
    const bundle = JSON.parse(raw);
    const stored = bundle.bundle_hash;

    // Recompute without the bundle_hash field
    const { bundle_hash: _, ...content } = bundle;
    const recomputed = bundleHash(content);

    return {
      valid:         stored === recomputed,
      expected_hash: stored,
      actual_hash:   recomputed,
    };
  } catch (err) {
    return { valid: false, expected_hash: null, actual_hash: null, error: err.message };
  }
}
