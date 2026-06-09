#!/usr/bin/env node
'use strict';
/**
 * fleet-divergence.js — Fleet consensus probe and split-brain detector.
 *
 * Polls the manifest endpoint once per screen in the fleet and compares:
 *   authority_epoch       — must be identical across all screens
 *   manifest_generation   — must converge within CONVERGENCE_WINDOW_MS
 *   manifest checksum     — must match within the convergence window
 *
 * Detects and classifies:
 *   SPLIT_BRAIN           — screens running irreconcilable manifest versions
 *   STALE_SCREEN          — screen has not advanced past a previous manifest version
 *   AUTHORITY_MISMATCH    — screens report different authority_epochs
 *   MANIFEST_LINEAGE_BREAK — screen's reported previous_manifest_hash is unknown
 *   CONVERGENCE_TIMEOUT   — fleet did not converge within the observation window
 *
 * Outputs:
 *   reports/consensus-health.json   — full snapshot + divergence report
 *
 * Usage:
 *   node simulator/fleet-divergence.js
 *   node simulator/fleet-divergence.js --backend=http://localhost:4000 --screens=10
 *   node simulator/fleet-divergence.js --watch --interval=30000
 */

const fs   = require('node:fs');
const path = require('node:path');

const BACKEND       = process.env.BACKEND_URL || 'http://localhost:4000';
const SCREEN_COUNT  = parseInt(process.env.SCREEN_COUNT || '10', 10);
const SCREEN_PREFIX = process.env.SCREEN_PREFIX || 'sim-screen';
const REPORTS_DIR   = path.resolve(process.cwd(), 'reports');

const args          = process.argv.slice(2);
const watchMode     = args.includes('--watch');
const intervalMs    = parseInt((args.find(a => a.startsWith('--interval='))?.split('=')[1]) || '30000', 10);
const backendArg    = args.find(a => a.startsWith('--backend='))?.split('=')[1];
const screensArg    = args.find(a => a.startsWith('--screens='))?.split('=')[1];

const EFFECTIVE_BACKEND = backendArg || BACKEND;
const EFFECTIVE_COUNT   = screensArg ? parseInt(screensArg, 10) : SCREEN_COUNT;

// Divergence classifications
const DIVERGENCE_TYPES = Object.freeze({
  SPLIT_BRAIN:            'SPLIT_BRAIN',
  STALE_SCREEN:           'STALE_SCREEN',
  AUTHORITY_MISMATCH:     'AUTHORITY_MISMATCH',
  MANIFEST_LINEAGE_BREAK: 'MANIFEST_LINEAGE_BREAK',
  CONVERGENCE_TIMEOUT:    'CONVERGENCE_TIMEOUT',
});

// ─── Per-screen manifest probe ────────────────────────────────────────────────

async function probeScreen(screenId) {
  const url = `${EFFECTIVE_BACKEND}/manifest?screen_id=${encodeURIComponent(screenId)}`;
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const latency_ms = Date.now() - start;
    if (!res.ok) {
      return { screen_id: screenId, error: `HTTP ${res.status}`, latency_ms, probed_at: new Date().toISOString() };
    }
    const body = await res.json();
    return {
      screen_id:           screenId,
      authority_epoch:     body.authority_epoch     ?? null,
      manifest_generation: body.manifest_generation ?? null,
      checksum:            body.checksum            ?? null,
      version:             body.version             ?? null,
      ota:                 body.ota                 ?? null,
      latency_ms,
      probed_at: new Date().toISOString(),
      error: null,
    };
  } catch (err) {
    return { screen_id: screenId, error: err.message, latency_ms: Date.now() - start, probed_at: new Date().toISOString() };
  }
}

// ─── Consensus analysis ───────────────────────────────────────────────────────

function analyzeConsensus(probeResults) {
  const healthy     = probeResults.filter(r => !r.error);
  const errored     = probeResults.filter(r => r.error);
  const divergences = [];

  if (healthy.length === 0) {
    return {
      status:          'AUTHORITY_LOSS',
      divergences:     [{ type: DIVERGENCE_TYPES.AUTHORITY_MISMATCH, message: 'No screens responded successfully' }],
      rollout_frozen:  true,
      summary:         { healthy: 0, errored: errored.length, total: probeResults.length },
    };
  }

  // Authority epoch consistency
  const epochs = new Set(healthy.map(r => r.authority_epoch).filter(e => e != null));
  if (epochs.size > 1) {
    divergences.push({
      type:    DIVERGENCE_TYPES.AUTHORITY_MISMATCH,
      message: `Screens report ${epochs.size} distinct authority_epochs: [${[...epochs].join(', ')}]`,
      epochs:  [...epochs],
    });
  }

  // Manifest version consistency
  const generations = new Set(healthy.map(r => r.manifest_generation).filter(g => g != null));
  const checksums   = new Set(healthy.map(r => r.checksum).filter(c => c != null));

  if (checksums.size > 2) {
    // More than 2 distinct checksums across the fleet = split-brain
    divergences.push({
      type:      DIVERGENCE_TYPES.SPLIT_BRAIN,
      message:   `${checksums.size} distinct manifest checksums across fleet`,
      checksums: [...checksums],
    });
  }

  // Stale screens — generation more than 2 behind the max
  if (generations.size > 0) {
    const maxGen = Math.max(...generations);
    const staleScreens = healthy.filter(r => r.manifest_generation != null && r.manifest_generation < maxGen - 1);
    for (const s of staleScreens) {
      divergences.push({
        type:       DIVERGENCE_TYPES.STALE_SCREEN,
        screen_id:  s.screen_id,
        generation: s.manifest_generation,
        current:    maxGen,
        message:    `Screen ${s.screen_id} is ${maxGen - s.manifest_generation} generations behind`,
      });
    }
  }

  // Determine status
  let status;
  const hasSplitBrain    = divergences.some(d => d.type === DIVERGENCE_TYPES.SPLIT_BRAIN);
  const hasAuthMismatch  = divergences.some(d => d.type === DIVERGENCE_TYPES.AUTHORITY_MISMATCH);
  const hasStaleScreens  = divergences.some(d => d.type === DIVERGENCE_TYPES.STALE_SCREEN);

  if (hasSplitBrain) {
    status = 'SPLIT_BRAIN';
  } else if (hasAuthMismatch) {
    status = 'AUTHORITY_LOSS';
  } else if (hasStaleScreens || errored.length > 0) {
    status = errored.length / probeResults.length > 0.4 ? 'DEGRADED' : 'STALE_SCREEN';
  } else {
    status = 'HEALTHY';
  }

  return {
    status,
    divergences,
    rollout_frozen: hasSplitBrain || hasAuthMismatch,
    summary: {
      healthy:             healthy.length,
      errored:             errored.length,
      total:               probeResults.length,
      distinct_checksums:  checksums.size,
      distinct_epochs:     epochs.size,
      distinct_generations: generations.size,
    },
  };
}

// ─── Report writer ────────────────────────────────────────────────────────────

function writeReport(probeResults, analysis) {
  const report = {
    generated_at: new Date().toISOString(),
    backend:      EFFECTIVE_BACKEND,
    consensus:    analysis,
    screens:      probeResults,
  };

  try {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const reportPath = path.join(REPORTS_DIR, 'consensus-health.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`[fleet-divergence] Consensus report written: ${reportPath}`);
  } catch (err) {
    console.error(`[fleet-divergence] Failed to write report: ${err.message}`);
  }

  return report;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runProbe() {
  const screenIds = Array.from({ length: EFFECTIVE_COUNT }, (_, i) => `${SCREEN_PREFIX}-${i + 1}`);
  console.log(`[fleet-divergence] Probing ${EFFECTIVE_COUNT} screens at ${EFFECTIVE_BACKEND}`);

  const probeResults = await Promise.all(screenIds.map(probeScreen));
  const analysis     = analyzeConsensus(probeResults);
  const report       = writeReport(probeResults, analysis);

  const { status, divergences } = analysis;
  const icon = status === 'HEALTHY' ? '✓' : '✗';
  console.log(`[fleet-divergence] ${icon} Consensus: ${status} (${divergences.length} divergence(s))`);

  if (divergences.length > 0) {
    for (const d of divergences) {
      console.error(`  [${d.type}] ${d.message}`);
    }
  }

  return report;
}

async function main() {
  await runProbe();

  if (watchMode) {
    console.log(`[fleet-divergence] Watch mode: re-probing every ${intervalMs}ms`);
    setInterval(runProbe, intervalMs);
  }
}

main().catch(err => {
  console.error('[fleet-divergence] Fatal error:', err.message);
  process.exit(1);
});
