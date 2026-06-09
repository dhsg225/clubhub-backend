'use strict';
/**
 * reality-gap.js
 *
 * Drift measurement and gap registry for ClubHub TV.
 * Implements REALITY_GAP_VALIDATION.md §3 and §6.
 *
 * Usage:
 *   const gap = require('./reality-gap');
 *
 *   // Record a real-Pi observation
 *   gap.recordObservation('T2', 'reboot_recovery_ms', 3500, 32000, 'Pi 4 clean SD, cold boot');
 *
 *   // Get drift for a metric
 *   const { ratio, classification } = gap.computeDrift(3500, 32000);
 *   // → { ratio: 9.14, classification: 'SEVERE' }
 *
 *   // Generate full report
 *   const report = gap.generateReport();
 *
 *   // Run as standalone tool: node simulator/reality-gap.js --report
 */

const fs   = require('node:fs');
const path = require('node:path');

const REGISTRY_PATH = path.resolve(process.cwd(), 'soak-reports/gap-registry.json');
const FORMAT_VERSION = '1.0';

// Drift classification thresholds per REALITY_GAP_VALIDATION.md §3.2
const DRIFT_THRESHOLDS = {
  CALIBRATED:  0.10,  // |ratio-1| ≤ 0.10
  DEGRADED:    0.30,  // |ratio-1| ≤ 0.30
  SIGNIFICANT: 1.00,  // |ratio-1| ≤ 1.00
  // > 1.00 → SEVERE
};

// Known assumption IDs per REALITY_GAP_VALIDATION.md §1
const ASSUMPTION_IDS = new Set([
  'T1','T2','T3','T4','T5',
  'R1','R2','R3','R4','R5',
  'H1','H2','H3','H4','H5',
  'E1','E2','E3','E4',
  'A1','A2','A3','A4',
]);

// ── Core calculations ─────────────────────────────────────────────────────────

/**
 * Compute drift ratio and classification.
 * @param {number} simulatorValue  Value from simulator measurement
 * @param {number} realPiValue     Value from real Pi observation
 * @returns {{ ratio: number, delta: number, classification: string }}
 */
function computeDrift(simulatorValue, realPiValue) {
  if (!simulatorValue || simulatorValue === 0) {
    return { ratio: null, delta: null, classification: 'UNMEASURED' };
  }
  const ratio = realPiValue / simulatorValue;
  const delta = Math.abs(ratio - 1.0);

  let classification;
  if (delta <= DRIFT_THRESHOLDS.CALIBRATED)       classification = 'CALIBRATED';
  else if (delta <= DRIFT_THRESHOLDS.DEGRADED)     classification = 'DEGRADED';
  else if (delta <= DRIFT_THRESHOLDS.SIGNIFICANT)  classification = 'SIGNIFICANT';
  else                                              classification = 'SEVERE';

  return { ratio: Math.round(ratio * 100) / 100, delta: Math.round(delta * 100) / 100, classification };
}

// ── Registry I/O ──────────────────────────────────────────────────────────────

function _loadRegistry() {
  try {
    const dir = path.dirname(REGISTRY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(REGISTRY_PATH)) return { format_version: FORMAT_VERSION, entries: [] };
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {
    return { format_version: FORMAT_VERSION, entries: [] };
  }
}

function _saveRegistry(registry) {
  const dir = path.dirname(REGISTRY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a real-Pi observation against a simulator measurement.
 *
 * @param {string} assumptionId   e.g. 'T2' (from REALITY_GAP_VALIDATION.md §1)
 * @param {string} metric         e.g. 'reboot_recovery_ms'
 * @param {number} simulatorValue Value from simulator
 * @param {number} realPiValue    Value observed on real Pi
 * @param {string} [notes]        Context for the measurement
 * @returns {object} The recorded entry with drift classification
 */
function recordObservation(assumptionId, metric, simulatorValue, realPiValue, notes = '') {
  if (!ASSUMPTION_IDS.has(assumptionId)) {
    console.warn(`[reality-gap] Unknown assumption ID: ${assumptionId}. Valid IDs: ${[...ASSUMPTION_IDS].join(', ')}`);
  }

  const drift = computeDrift(simulatorValue, realPiValue);
  const entry = {
    date:             new Date().toISOString(),
    assumption_id:    assumptionId,
    metric,
    simulator_value:  simulatorValue,
    real_pi_value:    realPiValue,
    drift:            drift.ratio,
    delta:            drift.delta,
    classification:   drift.classification,
    notes,
  };

  const registry = _loadRegistry();
  registry.entries.push(entry);
  _saveRegistry(registry);

  if (drift.classification === 'SEVERE') {
    console.warn(`[reality-gap] SEVERE drift on ${assumptionId}/${metric}: ratio=${drift.ratio} — threshold recalibration required`);
  } else if (drift.classification === 'SIGNIFICANT') {
    console.warn(`[reality-gap] SIGNIFICANT drift on ${assumptionId}/${metric}: ratio=${drift.ratio}`);
  }

  return entry;
}

/**
 * Generate a summary report of all gap registry entries.
 * Returns overall drift score and per-assumption-class summaries.
 */
function generateReport() {
  const registry = _loadRegistry();
  const entries = registry.entries;

  if (entries.length === 0) {
    return { entries: 0, message: 'No observations recorded yet.', overall_classification: 'UNMEASURED' };
  }

  // Group by assumption class (T, R, H, E, A)
  const byClass = {};
  for (const e of entries) {
    const cls = e.assumption_id?.[0] ?? 'X';
    if (!byClass[cls]) byClass[cls] = [];
    byClass[cls].push(e);
  }

  // Per-class summary: worst classification
  const classOrder = ['CALIBRATED', 'DEGRADED', 'SIGNIFICANT', 'SEVERE', 'UNMEASURED'];
  const classSummary = {};
  for (const [cls, list] of Object.entries(byClass)) {
    const worst = list.reduce((acc, e) => {
      return classOrder.indexOf(e.classification) > classOrder.indexOf(acc) ? e.classification : acc;
    }, 'CALIBRATED');
    classSummary[cls] = { count: list.length, worst_classification: worst };
  }

  // Overall worst
  const overallWorst = entries.reduce((acc, e) => {
    return classOrder.indexOf(e.classification) > classOrder.indexOf(acc) ? e.classification : acc;
  }, 'CALIBRATED');

  // Entries with SEVERE or SIGNIFICANT gaps
  const actionRequired = entries.filter(e => ['SEVERE', 'SIGNIFICANT'].includes(e.classification));

  return {
    generated_at:           new Date().toISOString(),
    total_observations:     entries.length,
    overall_classification: overallWorst,
    by_assumption_class:    classSummary,
    action_required:        actionRequired.map(e => ({
      assumption_id:    e.assumption_id,
      metric:           e.metric,
      classification:   e.classification,
      drift:            e.drift,
      date:             e.date,
    })),
    registry_path: REGISTRY_PATH,
  };
}

/**
 * Check if the gap registry contains any SEVERE entries for a given metric.
 * Used by validate-contracts.js as a deploy blocker signal.
 */
function hasSevereDrift(metric) {
  const registry = _loadRegistry();
  return registry.entries.some(e => e.metric === metric && e.classification === 'SEVERE');
}

// ── Waiver support ────────────────────────────────────────────────────────────

const WAIVERS_PATH = path.resolve(process.cwd(), 'soak-reports/gap-waivers.json');

/**
 * Load active (non-expired) waivers from soak-reports/gap-waivers.json.
 * Returns [] if the file does not exist or is malformed.
 */
function loadActiveWaivers() {
  try {
    if (!fs.existsSync(WAIVERS_PATH)) return [];
    const data = JSON.parse(fs.readFileSync(WAIVERS_PATH, 'utf8'));
    const now = new Date();
    return (data.waivers || []).filter(w => w.waived_until && new Date(w.waived_until) > now);
  } catch {
    return [];
  }
}

/**
 * Check whether a specific SEVERE drift entry is covered by an active waiver.
 * @param {string} assumptionId  e.g. 'T2'
 * @param {string} metric        e.g. 'reboot_recovery_ms'
 * @returns {boolean}
 */
function hasActiveWaiver(assumptionId, metric) {
  const waivers = loadActiveWaivers();
  return waivers.some(w => w.assumption_id === assumptionId && w.metric === metric);
}

/**
 * Add a time-bound waiver for a SEVERE drift entry.
 * @param {string} assumptionId
 * @param {string} metric
 * @param {string} waivedUntil  ISO-8601 date string
 * @param {string} reason
 * @param {string} [createdBy]
 */
function addWaiver(assumptionId, metric, waivedUntil, reason, createdBy = 'operator') {
  const dir = path.dirname(WAIVERS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let data = { waivers: [] };
  try {
    if (fs.existsSync(WAIVERS_PATH)) {
      data = JSON.parse(fs.readFileSync(WAIVERS_PATH, 'utf8'));
    }
  } catch { /* start fresh */ }

  // Remove expired waivers and any existing waiver for this metric/assumption
  const now = new Date();
  data.waivers = (data.waivers || []).filter(w =>
    new Date(w.waived_until) > now &&
    !(w.assumption_id === assumptionId && w.metric === metric)
  );

  data.waivers.push({
    assumption_id: assumptionId,
    metric,
    waived_until: waivedUntil,
    reason,
    created_by: createdBy,
    created_at: new Date().toISOString(),
  });
  fs.writeFileSync(WAIVERS_PATH, JSON.stringify(data, null, 2));
  console.log(`[reality-gap] Waiver added: ${assumptionId}/${metric} until ${waivedUntil}`);
}

module.exports = { computeDrift, recordObservation, generateReport, hasSevereDrift, loadActiveWaivers, hasActiveWaiver, addWaiver, REGISTRY_PATH, WAIVERS_PATH };

// ── CLI entry point ───────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--report')) {
    const report = generateReport();
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.overall_classification === 'SEVERE' ? 1 : 0);
  }

  if (args.includes('--record')) {
    // Usage: node reality-gap.js --record T2 reboot_recovery_ms 3500 32000 "Pi 4 cold boot"
    const [, assumptionId, metric, simVal, realVal, ...noteWords] = args;
    if (!assumptionId || !metric || !simVal || !realVal) {
      console.error('Usage: node reality-gap.js --record <assumptionId> <metric> <simValue> <realValue> [notes]');
      process.exit(1);
    }
    const entry = recordObservation(
      assumptionId, metric, parseFloat(simVal), parseFloat(realVal), noteWords.join(' ')
    );
    console.log(JSON.stringify(entry, null, 2));
    process.exit(0);
  }

  if (args.includes('--waive')) {
    // Usage: node reality-gap.js --waive T2 reboot_recovery_ms 2026-07-01 "Known hardware timing"
    const [, assumptionId, metric, waivedUntil, ...reasonWords] = args;
    if (!assumptionId || !metric || !waivedUntil) {
      console.error('Usage: node reality-gap.js --waive <assumptionId> <metric> <waivedUntil> [reason]');
      process.exit(1);
    }
    addWaiver(assumptionId, metric, waivedUntil, reasonWords.join(' ') || 'operator waiver');
    process.exit(0);
  }

  console.log(`Usage:
  node simulator/reality-gap.js --report               Print gap registry report
  node simulator/reality-gap.js --record <id> <metric> <sim> <real> [notes]
                                                        Record a real-Pi observation
  node simulator/reality-gap.js --waive <id> <metric> <until> [reason]
                                                        Add a time-bound waiver for SEVERE drift`);
  process.exit(0);
}
