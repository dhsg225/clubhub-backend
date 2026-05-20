#!/usr/bin/env node
/**
 * validate-contracts.js
 *
 * Contract Enforcement System for ClubHub TV.
 * Treats CLUBHUB_SYSTEM_CONTRACTS.md as the single authoritative source of
 * truth for all thresholds, SLAs, and CI gate definitions.
 *
 * Checks performed:
 *   1. contract_file_present       — CLUBHUB_SYSTEM_CONTRACTS.md exists
 *   2. contract_version_and_status — versioned and marked ENFORCED
 *   3. required_sections_present   — all 10 sections exist
 *   4. thresholds_json_loadable    — test-config/thresholds.json is valid JSON
 *   5. threshold_drift             — §3.2 contract values match thresholds.json
 *   6. runner_threshold_coverage   — every thresholds.json key is enforced in runner.js
 *   7. hidden_thresholds           — no hardcoded contract values in comparison expressions
 *   8. gap_registry_valid          — no unwaived SEVERE drift entries
 *   9. metric_evidence_paths       — every governed threshold has producer + runner gate
 *  10. suite_coverage              — every governed metric claimed by at least one suite
 *  11. nondeterminism_patterns     — no Date.now()/Math.random()/new Date() in governed files
 *  12. state_domain_coverage       — all 8 governed domains declare transitions + legal exports
 *  13. mutation_envelope_usage     — applyMutation imported in runner.js and chaos.js
 *  14. direct_mutation_patterns    — no .state=/.status=/Object.assign() on governed state
 *  15. state_hash_chain            — mutations.js uses mutation_hash chain; replay verifies final hash
 *  16. recovery_governance         — recovery-governor.js exists with all 7 named categories
 *  17. fleet_consensus             — fleet-consensus.js exists; manifest route has authority_epoch
 *  18. incident_bundle             — incident-bundle.js exists; runner.js creates bundles on failure
 *  19. policy_engine               — policy-engine.js exists with all 6 named policies
 *  20. operator_ledger             — operator-ledger.js exists, append-only hash chain
 *  21. autonomous_rollout          — autonomous-rollout.js uses policy engine for promotion
 *  22. distributed_authority       — distributed-authority.js DB-backed (not memory-only)
 *  23. governed_config             — governed-config.js wraps config with versioning
 *  24. incident_orchestration      — incident-orchestrator.js exists with all incident states
 *
 * Exit codes:
 *   0  — all checks pass
 *   1  — one or more checks failed (deploy blocker)
 *   2  — validator internal error (infrastructure failure)
 *
 * Output:
 *   Human-readable to stdout by default.
 *   --ci or --json flags emit structured JSON only.
 *   Always writes reports/contract-validation.json.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const CONTRACT_PATH    = path.join(ROOT, 'CLUBHUB_SYSTEM_CONTRACTS.md');
const THRESHOLDS_PATH  = path.join(ROOT, 'test-config/thresholds.json');
const RUNNER_PATH      = path.join(ROOT, 'test-runner/runner.js');
const METRICS_LIB_PATH = path.join(ROOT, 'test-runner/lib/metrics.js');
const CHAOS_LIB_PATH        = path.join(ROOT, 'test-runner/lib/chaos.js');
const STATE_AUTHORITY_PATH    = path.join(ROOT, 'test-runner/lib/state-authority.js');
const MUTATIONS_LIB_PATH      = path.join(ROOT, 'test-runner/lib/mutations.js');
const STATE_HASH_LIB_PATH     = path.join(ROOT, 'test-runner/lib/state-hash.js');
const RECOVERY_GOVERNOR_PATH  = path.join(ROOT, 'test-runner/lib/recovery-governor.js');
const FLEET_CONSENSUS_PATH    = path.join(ROOT, 'backend/src/lib/fleet-consensus.js');
const MANIFEST_ROUTE_PATH     = path.join(ROOT, 'backend/src/routes/manifest.js');
const INCIDENT_BUNDLE_PATH    = path.join(ROOT, 'test-runner/lib/incident-bundle.js');
const POLICY_ENGINE_PATH       = path.join(ROOT, 'backend/src/lib/policy-engine.js');
const OPERATOR_LEDGER_PATH     = path.join(ROOT, 'backend/src/lib/operator-ledger.js');
const AUTONOMOUS_ROLLOUT_PATH  = path.join(ROOT, 'backend/src/lib/autonomous-rollout.js');
const DIST_AUTHORITY_PATH      = path.join(ROOT, 'backend/src/lib/distributed-authority.js');
const GOVERNED_CONFIG_PATH     = path.join(ROOT, 'backend/src/lib/governed-config.js');
const INCIDENT_ORCH_PATH       = path.join(ROOT, 'backend/src/lib/incident-orchestrator.js');
const OTA_ROUTE_PATH           = path.join(ROOT, 'backend/src/routes/ota.js');
const REPORTS_DIR             = path.join(ROOT, 'reports');

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE BINDING TABLE
//
// Maps every §3.2 CI gate metric to its thresholds.json path and expected
// value. This table is the machine-readable form of §3.2. Any change here
// MUST be accompanied by a corresponding change in §3.2 of the contract.
//
// To add a new gate:
//   1. Add the row to the §3.2 table in CLUBHUB_SYSTEM_CONTRACTS.md
//   2. Add the entry here
//   3. Add the entry to test-config/thresholds.json
//   4. Add enforcement code to test-runner/runner.js performThresholdGating()
// ─────────────────────────────────────────────────────────────────────────────
const THRESHOLD_BINDINGS = [
  {
    metric:    'Backend recovery time',
    jsonPath:  'recovery.backend_restart_ms',
    expected:  30000,
    operator:  'lte',
    unit:      'ms',
    section:   '§3.2',
    deployBlocker: 'DB-4',
  },
  {
    metric:    'DB recovery time',
    jsonPath:  'recovery.db_restart_ms',
    expected:  60000,
    operator:  'lte',
    unit:      'ms',
    section:   '§3.2',
    deployBlocker: 'DB-9',
  },
  {
    metric:    'Network outage recovery',
    jsonPath:  'recovery.network_outage_recovery_ms',
    expected:  15000,
    operator:  'lte',
    unit:      'ms',
    section:   '§3.2',
    deployBlocker: 'DB-4',
  },
  {
    metric:    'P95 poll latency',
    jsonPath:  'performance.max_p95_latency_ms',
    expected:  500,
    operator:  'lte',
    unit:      'ms',
    section:   '§3.2',
    deployBlocker: 'DB-2',
  },
  {
    metric:    'Poll success rate',
    jsonPath:  'performance.min_poll_success_rate',
    expected:  98.0,
    operator:  'gte',
    unit:      '%',
    section:   '§3.2',
    deployBlocker: 'DB-7',
  },
  {
    metric:    'Poll drift',
    jsonPath:  'performance.max_poll_drift_ms',
    expected:  5000,
    operator:  'lte',
    unit:      'ms',
    section:   '§3.2',
    deployBlocker: 'DB-2',
  },
  {
    metric:    'Desync count',
    jsonPath:  'coherence.max_desync_count',
    expected:  0,
    operator:  'eq',
    unit:      'count',
    section:   '§3.2',
    deployBlocker: 'DB-3',
  },
  {
    metric:    'Desync duration',
    jsonPath:  'coherence.max_desync_duration_ms',
    expected:  45000,
    operator:  'lte',
    unit:      'ms',
    section:   '§3.2',
    deployBlocker: 'DB-2',
  },

  // ── OTA operational thresholds (§11) ──────────────────────────────────────
  // These are OPERATIONAL parameters, not CI performance gates.
  // operational: true → validated for drift but NOT required in runner.js.
  {
    metric:    'Ring 1 max coverage',
    jsonPath:  'ota.ring1_max_pct',
    expected:  30,
    operator:  'eq',
    unit:      '%',
    section:   '§11',
    deployBlocker: 'OTA-DB1',
    operational: true,
  },
  {
    metric:    'Ring 2 max coverage',
    jsonPath:  'ota.ring2_max_pct',
    expected:  70,
    operator:  'eq',
    unit:      '%',
    section:   '§11',
    deployBlocker: 'OTA-DB1',
    operational: true,
  },
  {
    metric:    'Min fleet OTA success rate',
    jsonPath:  'ota.min_fleet_success_rate',
    expected:  80,
    operator:  'gte',
    unit:      '%',
    section:   '§11',
    deployBlocker: 'OTA-DB2',
    operational: true,
  },
  {
    metric:    'Observation window per ring',
    jsonPath:  'ota.observation_window_ms',
    expected:  300000,
    operator:  'eq',
    unit:      'ms',
    section:   '§11',
    deployBlocker: 'OTA-DB3',
    operational: true,
  },
  {
    metric:    'Ring 3 rollback window',
    jsonPath:  'ota.rollback_window_ms',
    expected:  3600000,
    operator:  'eq',
    unit:      'ms',
    section:   '§11',
    deployBlocker: 'OTA-DB3',
    operational: true,
  },

  // ── Security enrollment thresholds (§12) ─────────────────────────────────
  {
    metric:    'Session token expiry',
    jsonPath:  'security.session_token_expiry_ms',
    expected:  86400000,
    operator:  'eq',
    unit:      'ms',
    section:   '§12',
    deployBlocker: 'DRIFT-DB2',
    operational: true,
  },
  {
    metric:    'Token refresh window',
    jsonPath:  'security.token_refresh_window_ms',
    expected:  3600000,
    operator:  'eq',
    unit:      'ms',
    section:   '§12',
    deployBlocker: 'DRIFT-DB2',
    operational: true,
  },
  {
    metric:    'Max failed enrollments',
    jsonPath:  'security.max_failed_enrollments',
    expected:  5,
    operator:  'eq',
    unit:      'count',
    section:   '§12',
    deployBlocker: 'DRIFT-DB2',
    operational: true,
  },
  {
    metric:    'Enrollment token expiry',
    jsonPath:  'security.enrollment_token_expiry_ms',
    expected:  2592000000,
    operator:  'eq',
    unit:      'ms',
    section:   '§12',
    deployBlocker: 'DRIFT-DB2',
    operational: true,
  },
];

// Every distinct numeric value referenced in THRESHOLD_BINDINGS that is
// large enough to be uniquely meaningful (skip 0 — it's too common to scan).
const THRESHOLD_NUMERIC_VALUES = [
  ...new Set(THRESHOLD_BINDINGS.map(b => b.expected).filter(v => v > 1)),
];

// ─────────────────────────────────────────────────────────────────────────────
// METRIC EVIDENCE REQUIREMENTS
//
// Maps every non-operational CI gate to its producer in metrics.js, its
// enforcement pattern in runner.js, and the governed key used in suite
// GOVERNED_METRICS declarations.
//
// Used by:
//   checkMetricEvidencePaths() — verifies producer and gate patterns exist in source
//   checkSuiteCoverage()       — verifies every governed key is claimed by a suite
//   generateTraceabilityReport() — builds reports/threshold-traceability.json
// ─────────────────────────────────────────────────────────────────────────────
const METRIC_EVIDENCE_REQUIREMENTS = [
  {
    jsonPath:        'performance.min_poll_success_rate',
    governedKey:     'poll_success_rate',
    metricsProducer: 'pollSuccessRate()',
    runnerGate:      'summary.poll_success_rate',
  },
  {
    jsonPath:        'performance.max_p95_latency_ms',
    governedKey:     'p95_latency_ms',
    metricsProducer: 'p95PollLatency()',
    runnerGate:      'summary.p95_latency_ms',
  },
  {
    jsonPath:        'performance.max_poll_drift_ms',
    governedKey:     'max_poll_drift_ms',
    metricsProducer: 'pollDriftMs()',
    runnerGate:      'summary.max_poll_drift_ms',
  },
  {
    jsonPath:        'coherence.max_desync_count',
    governedKey:     'desync_count',
    metricsProducer: 'getDesyncCount()',
    runnerGate:      'summary.desync_count',
  },
  {
    jsonPath:        'coherence.max_desync_duration_ms',
    governedKey:     'max_desync_duration_ms',
    metricsProducer: '_maxDesyncDurationMs',
    runnerGate:      'summary.max_desync_duration_ms',
  },
  {
    jsonPath:        'recovery.backend_restart_ms',
    governedKey:     'named_recovery.backend_restart',
    metricsProducer: 'recordNamedRecovery',
    runnerGate:      'nr.backend_restart',
  },
  {
    jsonPath:        'recovery.db_restart_ms',
    governedKey:     'named_recovery.db_restart',
    metricsProducer: 'recordNamedRecovery',
    runnerGate:      'nr.db_restart',
  },
  {
    jsonPath:        'recovery.network_outage_recovery_ms',
    governedKey:     'named_recovery.network_outage',
    metricsProducer: 'recordNamedRecovery',
    runnerGate:      'nr.network_outage',
  },
];

// Required top-level sections in the contract.
const REQUIRED_SECTIONS = [
  '## 1. SYSTEM HEALTH MODEL',
  '## 2. FAILURE TAXONOMY',
  '## 3. CI GATING RULES',
  '## 4. RECOVERY SLAs',
  '## 5. TRUTH HIERARCHY',
  '## 6. DEPLOY-BLOCKING FAILURES',
  '## 7. POLLING CONTRACT',
  '## 8. RATE LIMIT CONTRACT',
  '## 9. STABILITY SCORE CONTRACT',
  '## 10. CONTRACT MAINTENANCE',
];

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────

function getNestedValue(obj, dotPath) {
  return dotPath.split('.').reduce((acc, k) => acc?.[k], obj);
}

function flattenObject(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') {
      Object.assign(out, flattenObject(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

/**
 * Parse a threshold cell like "≤ 30,000 ms" or "≥ 98.0%" → number.
 */
function parseThresholdCell(str) {
  if (!str) return null;
  const cleaned = str
    .replace(/[≤≥=<>]/g, '')
    .replace(/,/g, '')
    .replace(/ms|%|count/gi, '')
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Extract the §3.2 table rows from contract markdown.
 * Returns [{metric, threshold, parsedValue}] or null if the section is absent.
 */
function parseContractThresholdTable(markdown) {
  const lines = markdown.split('\n');
  let inSection = false;
  const tableLines = [];

  for (const line of lines) {
    if (/^###\s+3\.2\s+Threshold Gates/.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^###/.test(line)) break; // next subsection
    if (inSection && line.startsWith('|')) tableLines.push(line);
  }

  if (tableLines.length === 0) return null;

  const rows = [];
  let headerSkipped = false;

  for (const line of tableLines) {
    if (/^\|\s*[-:]+/.test(line)) continue; // separator row
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    if (!headerSkipped) {
      headerSkipped = true;
      continue; // "Metric | Threshold | Fail Condition"
    }

    rows.push({
      metric:       cells[0],
      threshold:    cells[1],
      failCondition: cells[2] ?? '',
      parsedValue:  parseThresholdCell(cells[1]),
    });
  }

  return rows.length > 0 ? rows : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK FUNCTIONS
// Each returns: { name, status, detail, blocker?, violations?, warnings?, ... }
// status: 'PASS' | 'FAIL' | 'WARN'
// blocker: string | null  (non-null means deploy blocker triggered)
// ─────────────────────────────────────────────────────────────────────────────

function checkContractPresent() {
  const exists = fs.existsSync(CONTRACT_PATH);
  return {
    name:    'contract_file_present',
    status:  exists ? 'PASS' : 'FAIL',
    detail:  exists ? CONTRACT_PATH : `Not found: ${CONTRACT_PATH}`,
    blocker: exists ? null : 'DB-12: CLUBHUB_SYSTEM_CONTRACTS.md absent — cannot validate contracts',
  };
}

function checkContractVersion(markdown) {
  const versionMatch = markdown.match(/\*\*Version:\*\*\s*([\d.]+)/);
  const statusMatch  = markdown.match(/\*\*Status:\*\*\s*(\w+)/);
  const version = versionMatch?.[1] ?? null;
  const status  = statusMatch?.[1]  ?? null;
  const pass = !!version && status === 'ENFORCED';
  return {
    name:   'contract_version_and_status',
    status: pass ? 'PASS' : 'FAIL',
    detail: pass
      ? `Version ${version}, Status: ENFORCED`
      : `Contract not authoritative — version=${version ?? 'missing'}, status=${status ?? 'missing'} (must be ENFORCED)`,
    blocker: pass ? null : 'Contract is missing version or not marked ENFORCED — cannot be used as authority',
  };
}

function checkRequiredSections(markdown) {
  const missing = REQUIRED_SECTIONS.filter(s => !markdown.includes(s));
  return {
    name:    'required_sections_present',
    status:  missing.length === 0 ? 'PASS' : 'FAIL',
    detail:  missing.length === 0
      ? `All ${REQUIRED_SECTIONS.length} required sections present`
      : `${missing.length} section(s) missing: ${missing.join(', ')}`,
    missing,
    blocker: missing.length > 0
      ? `Contract incomplete — missing: ${missing.join(', ')}`
      : null,
  };
}

function checkThresholdsLoadable() {
  try {
    const raw = fs.readFileSync(THRESHOLDS_PATH, 'utf8');
    JSON.parse(raw);
    return {
      name:    'thresholds_json_loadable',
      status:  'PASS',
      detail:  THRESHOLDS_PATH,
      blocker: null,
    };
  } catch (err) {
    return {
      name:    'thresholds_json_loadable',
      status:  'FAIL',
      detail:  err.message,
      blocker: `DB-12: ${THRESHOLDS_PATH} unreadable — ${err.message}`,
    };
  }
}

function checkThresholdDrift(markdown, thresholdsJson) {
  const contractTable = parseContractThresholdTable(markdown);
  const violations = [];
  const warnings   = [];

  if (!contractTable) {
    return {
      name:    'threshold_drift',
      status:  'FAIL',
      detail:  'Could not parse §3.2 threshold table from contract',
      violations,
      warnings,
      blocker: 'DB-4: §3.2 table not parseable — cannot detect drift',
    };
  }

  // ── Check 1: every THRESHOLD_BINDING key exists in thresholds.json
  //             and its value matches the contract's expected value ──────────
  for (const binding of THRESHOLD_BINDINGS) {
    const actual = getNestedValue(thresholdsJson, binding.jsonPath);

    if (actual === undefined) {
      violations.push({
        metric:               binding.metric,
        json_path:            binding.jsonPath,
        contract_value:       binding.expected,
        thresholds_json_value: undefined,
        issue: `${binding.jsonPath} is absent from thresholds.json but declared as a CI gate in ${binding.section}`,
        blocker: `${binding.deployBlocker}: ${binding.jsonPath} missing from thresholds.json`,
      });
      continue;
    }

    if (actual !== binding.expected) {
      violations.push({
        metric:               binding.metric,
        json_path:            binding.jsonPath,
        contract_value:       binding.expected,
        thresholds_json_value: actual,
        issue: `DRIFT: contract says ${binding.expected}${binding.unit}, thresholds.json has ${actual}`,
        blocker: `${binding.deployBlocker}: drift on ${binding.jsonPath} — contract=${binding.expected}, json=${actual}. Fix thresholds.json or update contract with ADR evidence (§3.4).`,
      });
      continue;
    }

    // ── Check 2: parsed table value matches the static binding ─────────────
    // Guards against contract text being edited without updating THRESHOLD_BINDINGS.
    // Uses exact metric name match so "Poll drift" ≠ "Poll success rate".
    const tableRow = contractTable.find(r =>
      r.metric.toLowerCase() === binding.metric.toLowerCase()
    );
    if (tableRow && tableRow.parsedValue !== null && tableRow.parsedValue !== binding.expected) {
      warnings.push({
        metric:               binding.metric,
        json_path:            binding.jsonPath,
        binding_value:        binding.expected,
        parsed_table_value:   tableRow.parsedValue,
        issue: `THRESHOLD_BINDINGS[${binding.metric}].expected (${binding.expected}) differs from §3.2 table value (${tableRow.parsedValue}). Update THRESHOLD_BINDINGS in validate-contracts.js to match the contract.`,
      });
    }
  }

  // ── Check 3: thresholds.json has no keys unknown to the contract ─────────
  const boundPaths  = new Set(THRESHOLD_BINDINGS.map(b => b.jsonPath));
  const actualPaths = Object.keys(flattenObject(thresholdsJson));
  const orphans     = actualPaths.filter(p => !boundPaths.has(p));

  if (orphans.length > 0) {
    warnings.push({
      issue:       'thresholds.json contains keys not declared in §3.2 of the contract — these are invisible to the contract enforcement system',
      orphan_keys: orphans,
      action:      'Either add them to §3.2 and THRESHOLD_BINDINGS, or remove them from thresholds.json.',
    });
  }

  const pass = violations.length === 0;
  return {
    name:    'threshold_drift',
    status:  pass ? (warnings.length > 0 ? 'WARN' : 'PASS') : 'FAIL',
    detail:  pass
      ? `All ${THRESHOLD_BINDINGS.length} contract thresholds match thresholds.json`
      : `${violations.length} drift violation(s) detected`,
    violations,
    warnings,
    blocker: violations.length > 0
      ? violations.map(v => v.blocker).join(' | ')
      : null,
  };
}

/**
 * Check that every thresholds.json key is referenced (by name) in runner.js.
 * A key that exists in thresholds.json but is never read by runner.js is a
 * declared CI gate with no enforcement — a contract violation.
 */
function checkRunnerCoverage(thresholdsJson) {
  const runnerSrc = fs.existsSync(RUNNER_PATH)
    ? fs.readFileSync(RUNNER_PATH, 'utf8')
    : '';

  // Operational thresholds (§11) are enforced by rollout-state.js, not runner.js.
  const operationalPaths = new Set(
    THRESHOLD_BINDINGS.filter(b => b.operational).map(b => b.jsonPath)
  );

  const allPaths  = Object.keys(flattenObject(thresholdsJson))
    .filter(p => !operationalPaths.has(p));
  const unchecked = [];

  for (const dotPath of allPaths) {
    // Strict check: runner.js must reference the full dot-path as thresholds.${dotPath}.
    // Leaf-name matching is rejected as fuzzy — it passes if the key name appears
    // anywhere in runner.js (including comments or unrelated variables).
    if (!runnerSrc.includes(`thresholds.${dotPath}`)) {
      unchecked.push({
        json_path: dotPath,
        issue:     `${dotPath} is declared in thresholds.json but "thresholds.${dotPath}" is never referenced in runner.js — the CI gate is defined but not enforced`,
        action:    `Add a check for thresholds.${dotPath} in the performThresholdGating() function in test-runner/runner.js`,
      });
    }
  }

  return {
    name:      'runner_threshold_coverage',
    status:    unchecked.length === 0 ? 'PASS' : 'FAIL',
    detail:    unchecked.length === 0
      ? `All ${allPaths.length} threshold key(s) enforced in runner.js`
      : `${unchecked.length} of ${allPaths.length} threshold(s) declared but not enforced in runner.js`,
    unchecked,
    blocker:   unchecked.length > 0
      ? `DB-1: ${unchecked.length} CI gate(s) in thresholds.json have no enforcement in runner.js: [${unchecked.map(u => u.json_path).join(', ')}]`
      : null,
  };
}

/**
 * Scan test-runner source files for hardcoded numeric literals that match
 * known contract threshold values, in two contexts:
 *
 *   1. Comparison expressions: `if (latency > 500)` instead of
 *      `if (latency > thresholds.performance.max_p95_latency_ms)`
 *
 *   2. Nullish-coalescing fallbacks: `thresholds?.foo?.bar ?? 500`
 *      The fallback literal is a hidden threshold even when the line also
 *      references thresholds.* — the fallback bypasses the loaded config.
 *
 * Scanned files: runner.js, lib/metrics.js, suites/*.js
 *
 * Skips:
 *   - Comment lines and JSDoc
 *   - Comparison expressions on lines where thresholds.* supplies the value
 *     (legitimate enforcement), unless the same line also has a ?? fallback
 *   - Desync count threshold (0) — too common to scan meaningfully
 */
function checkHiddenThresholds() {
  const suitesDir = path.join(ROOT, 'test-runner/suites');
  const scanTargets = [
    RUNNER_PATH,
    METRICS_LIB_PATH,
    ...(fs.existsSync(suitesDir)
      ? fs.readdirSync(suitesDir)
          .filter(f => f.endsWith('.js'))
          .map(f => path.join(suitesDir, f))
      : []),
  ];

  const violations = [];

  for (const filePath of scanTargets) {
    if (!fs.existsSync(filePath)) continue;
    const src   = fs.readFileSync(filePath, 'utf8');
    const lines = src.split('\n');
    const relPath = path.relative(ROOT, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line    = lines[i];
      const trimmed = line.trim();

      // Skip blank lines, comments, JSDoc
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      for (const value of THRESHOLD_NUMERIC_VALUES) {
        // Pattern 1: comparison operator immediately before the value
        const comparisonPattern = new RegExp(`[<>!]=?=?\\s*${value}(?![\\d.a-zA-Z_%])`);
        // Pattern 2: nullish-coalescing fallback (??) — always a hidden threshold
        const nullishPattern    = new RegExp(`\\?\\?\\s*${value}(?![\\d.a-zA-Z_%])`);
        // Pattern 3: logical-OR fallback (||) — always a hidden threshold
        const orFallbackPattern = new RegExp(`\\|\\|\\s*${value}(?![\\d.a-zA-Z_%])`);

        const hasDirectComparison = comparisonPattern.test(line);
        const hasNullish          = nullishPattern.test(line);
        const hasOrFallback       = orFallbackPattern.test(line);
        const hasFallback         = hasNullish || hasOrFallback;
        const fallbackKind        = hasNullish ? 'nullish_fallback(??)' : 'or_fallback(||)';

        // A direct comparison on the same line as a thresholds.* access is legitimate
        // enforcement — skip it, unless the same line ALSO has a fallback literal.
        if (hasDirectComparison && line.includes('thresholds.') && !hasFallback) continue;

        if (hasDirectComparison || hasFallback) {
          violations.push({
            file:  relPath,
            line:  i + 1,
            text:  trimmed,
            value,
            kind:  hasFallback ? fallbackKind : 'comparison',
            issue: `Hardcoded contract threshold value ${value} in ${hasFallback ? `fallback expression (${fallbackKind})` : 'comparison expression'} — must be read from thresholds.* instead`,
            action: `Replace the literal ${value} with the appropriate thresholds.* reference (see §3.2 THRESHOLD_BINDINGS in validate-contracts.js)`,
          });
        }
      }
    }
  }

  return {
    name:       'hidden_thresholds',
    status:     violations.length === 0 ? 'PASS' : 'FAIL',
    detail:     violations.length === 0
      ? `No hardcoded contract threshold values found in ${scanTargets.length} scanned file(s)`
      : `${violations.length} hardcoded threshold value(s) detected in test runner source`,
    violations,
    blocker:    violations.length > 0
      ? `Contract §3.4 rule: threshold values must not be hardcoded in test files — ${violations.length} violation(s) found`
      : null,
  };
}

/**
 * Check the gap registry for SEVERE drift entries without active waivers.
 * Implements REALITY_GAP_VALIDATION.md §7 (validate-contracts.js integration).
 *
 * DRIFT-DB1: Registry absent → WARN (not a deploy blocker)
 * DRIFT-DB2: Unwaived SEVERE entries → FAIL (Ring 1 promotion blocked)
 */
function checkGapRegistry() {
  const registryPath = path.join(ROOT, 'soak-reports/gap-registry.json');
  const waiversPath  = path.join(ROOT, 'soak-reports/gap-waivers.json');

  // Registry absent: advisory warning only (DRIFT-DB1)
  if (!fs.existsSync(registryPath)) {
    return {
      name:    'gap_registry_valid',
      status:  'WARN',
      detail:  'soak-reports/gap-registry.json not found — no real-Pi observations recorded yet (DRIFT-DB1)',
      blocker: null,
    };
  }

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (err) {
    return {
      name:    'gap_registry_valid',
      status:  'FAIL',
      detail:  `gap-registry.json parse error: ${err.message}`,
      blocker: 'DRIFT-DB2: Gap registry present but unreadable — cannot validate drift state',
    };
  }

  // Validate format
  if (!registry.format_version || !Array.isArray(registry.entries)) {
    return {
      name:    'gap_registry_valid',
      status:  'FAIL',
      detail:  'gap-registry.json is missing format_version or entries array',
      blocker: 'DRIFT-DB2: Gap registry malformed — validate format before deployment',
    };
  }

  const severeEntries = registry.entries.filter(e => e.classification === 'SEVERE');

  if (severeEntries.length === 0) {
    return {
      name:    'gap_registry_valid',
      status:  'PASS',
      detail:  `Gap registry valid: ${registry.entries.length} observations, 0 SEVERE drift entries`,
      blocker: null,
    };
  }

  // Load waivers
  let activeWaivers = [];
  if (fs.existsSync(waiversPath)) {
    try {
      const waiverData = JSON.parse(fs.readFileSync(waiversPath, 'utf8'));
      const now = new Date();
      activeWaivers = (waiverData.waivers || []).filter(w =>
        w.waived_until && new Date(w.waived_until) > now
      );
    } catch { /* no valid waivers */ }
  }

  const unwaived = severeEntries.filter(entry =>
    !activeWaivers.some(w => w.metric === entry.metric && w.assumption_id === entry.assumption_id)
  );

  if (unwaived.length === 0) {
    return {
      name:    'gap_registry_valid',
      status:  'WARN',
      detail:  `${severeEntries.length} SEVERE drift gap(s) present, all covered by active waivers (${activeWaivers.length} active)`,
      blocker: null,
    };
  }

  const summary = unwaived.map(e => `${e.assumption_id}/${e.metric}(drift=${e.drift})`).join(', ');
  return {
    name:    'gap_registry_valid',
    status:  'FAIL',
    detail:  `${unwaived.length} SEVERE drift gap(s) without active waiver: ${summary}`,
    blocker: `DRIFT-DB2: Unwaived SEVERE drift blocks Ring 1 promotion. Add waivers to soak-reports/gap-waivers.json or fix the underlying gap.`,
    unwaived,
  };
}

/**
 * Verify that every non-operational governed threshold has:
 *   (a) a producer method/field in metrics.js
 *   (b) a runner gate expression in runner.js
 *
 * Missing evidence path = deploy blocker.
 */
function checkMetricEvidencePaths() {
  const metricsSrc = fs.existsSync(METRICS_LIB_PATH)
    ? fs.readFileSync(METRICS_LIB_PATH, 'utf8')
    : '';
  const runnerSrc = fs.existsSync(RUNNER_PATH)
    ? fs.readFileSync(RUNNER_PATH, 'utf8')
    : '';

  const violations = [];

  for (const req of METRIC_EVIDENCE_REQUIREMENTS) {
    const producerFound = metricsSrc.includes(req.metricsProducer);
    const gateFound     = runnerSrc.includes(req.runnerGate);

    if (!producerFound) {
      violations.push({
        jsonPath:  req.jsonPath,
        governedKey: req.governedKey,
        missing:   'producer',
        expected:  req.metricsProducer,
        file:      path.relative(ROOT, METRICS_LIB_PATH),
        issue:     `Governed threshold ${req.jsonPath} has no producer: '${req.metricsProducer}' not found in metrics.js`,
      });
    }

    if (!gateFound) {
      violations.push({
        jsonPath:  req.jsonPath,
        governedKey: req.governedKey,
        missing:   'runner_gate',
        expected:  req.runnerGate,
        file:      path.relative(ROOT, RUNNER_PATH),
        issue:     `Governed threshold ${req.jsonPath} has no runner gate: '${req.runnerGate}' not found in runner.js`,
      });
    }
  }

  return {
    name:    'metric_evidence_paths',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? `All ${METRIC_EVIDENCE_REQUIREMENTS.length} governed metrics have verified producer and runner gate paths`
      : `${violations.length} evidence path(s) missing for governed metrics`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: ${violations.length} governed metric(s) lack verified evidence path: [${[...new Set(violations.map(v => v.jsonPath))].join(', ')}]`
      : null,
  };
}

/**
 * Parse GOVERNED_METRICS export from a suite source file.
 * Returns array of governed-key strings, or null if not declared.
 */
function parseSuiteGovernedMetrics(src) {
  const match = src.match(/export\s+const\s+GOVERNED_METRICS\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return null;
  const items = [];
  const itemRe = /['"]([^'"]+)['"]/g;
  let m;
  while ((m = itemRe.exec(match[1])) !== null) {
    items.push(m[1]);
  }
  return items;
}

/**
 * Verify that:
 *   1. Every suite declares GOVERNED_METRICS.
 *   2. Every non-operational governed threshold is exercised by at least one suite.
 *   3. No suite declares a metric not present in METRIC_EVIDENCE_REQUIREMENTS (orphan).
 *
 * Fail on orphaned governed metrics (threshold with no suite coverage).
 */
function checkSuiteCoverage() {
  const suitesDir = path.join(ROOT, 'test-runner/suites');
  const violations = [];
  const warnings   = [];

  if (!fs.existsSync(suitesDir)) {
    return {
      name:    'suite_coverage',
      status:  'FAIL',
      detail:  `Suites directory not found: ${path.relative(ROOT, suitesDir)}`,
      violations,
      warnings,
      blocker: 'DB-1: Suite directory absent — cannot verify governed metric coverage',
    };
  }

  const suiteFiles = fs.readdirSync(suitesDir).filter(f => f.endsWith('.js'));
  const suiteCoverage = {}; // suiteName -> [governedKeys]
  const missingDeclarations = [];

  for (const file of suiteFiles) {
    const filePath  = path.join(suitesDir, file);
    const suiteName = path.basename(file, '.js');
    const src       = fs.readFileSync(filePath, 'utf8');
    const keys      = parseSuiteGovernedMetrics(src);

    if (keys === null) {
      missingDeclarations.push({
        suite: suiteName,
        file:  path.relative(ROOT, filePath),
        issue: `Suite '${suiteName}' does not export GOVERNED_METRICS — cannot verify its metric coverage`,
      });
    } else {
      suiteCoverage[suiteName] = keys;
    }
  }

  // All non-operational governed keys that must have suite coverage.
  const requiredKeys = new Set(METRIC_EVIDENCE_REQUIREMENTS.map(r => r.governedKey));
  // All governed keys declared by any suite.
  const coveredKeys  = new Set(Object.values(suiteCoverage).flat());

  // 1. Orphaned governed metrics: required key not claimed by any suite.
  for (const key of requiredKeys) {
    if (!coveredKeys.has(key)) {
      const req = METRIC_EVIDENCE_REQUIREMENTS.find(r => r.governedKey === key);
      violations.push({
        governedKey: key,
        jsonPath:    req?.jsonPath,
        issue:       `Governed metric '${key}' (threshold: ${req?.jsonPath}) is enforced in runner.js but no suite declares coverage for it`,
        action:      `Add '${key}' to GOVERNED_METRICS in the suite that exercises it`,
      });
    }
  }

  // 2. Orphaned suite declarations: suite claims a key that isn't a governed metric.
  for (const [suiteName, keys] of Object.entries(suiteCoverage)) {
    for (const key of keys) {
      if (!requiredKeys.has(key)) {
        warnings.push({
          suite:      suiteName,
          governedKey: key,
          issue:      `Suite '${suiteName}' declares coverage for '${key}' but that key is not in METRIC_EVIDENCE_REQUIREMENTS — stale declaration`,
          action:     `Remove '${key}' from GOVERNED_METRICS in ${suiteName}.js or add it to METRIC_EVIDENCE_REQUIREMENTS`,
        });
      }
    }
  }

  // 3. Missing GOVERNED_METRICS declarations are violations.
  for (const m of missingDeclarations) {
    violations.push({
      ...m,
      action: `Export 'GOVERNED_METRICS' array from ${m.file}`,
    });
  }

  const pass = violations.length === 0;
  return {
    name:    'suite_coverage',
    status:  pass ? (warnings.length > 0 ? 'WARN' : 'PASS') : 'FAIL',
    detail:  pass
      ? `All ${requiredKeys.size} governed metrics covered by ${Object.keys(suiteCoverage).length} suite(s)`
      : `${violations.length} suite coverage violation(s) detected`,
    violations,
    warnings,
    blocker: violations.length > 0
      ? `DB-1: ${violations.length} governed metric(s) have no suite coverage: [${violations.filter(v => v.governedKey).map(v => v.governedKey).join(', ')}]`
      : null,
  };
}

/**
 * Scan governed files for nondeterministic patterns that prevent deterministic replay.
 *
 * Scanned files: suites/*.js, runner.js, lib/metrics.js, lib/chaos.js
 * Excluded (approved):
 *   lib/clock.js         — the governed time authority itself
 *   lib/events.js        — sequential counter infrastructure
 *   lib/replay.js        — infrastructure; uses Date.now() for real-time offset tracking
 *   lib/provenance.js    — report infrastructure
 *   lib/reporter.js      — internal timing only
 *   lib/fleet.js         — internal timeout polling
 *   lib/assert.js        — internal timeout polling
 *
 * Prohibited patterns in scanned files:
 *   Date.now()           — must use clock.now()
 *   Math.random()        — must use the governed fleet seed
 *   new Date()           — (no args) must use new Date(clock.now()) or clock.iso()
 */
function checkNondeterminism() {
  const suitesDir = path.join(ROOT, 'test-runner/suites');
  const scanTargets = [
    RUNNER_PATH,
    METRICS_LIB_PATH,
    CHAOS_LIB_PATH,
    ...(fs.existsSync(suitesDir)
      ? fs.readdirSync(suitesDir)
          .filter(f => f.endsWith('.js'))
          .map(f => path.join(suitesDir, f))
      : []),
  ];

  const violations = [];

  for (const filePath of scanTargets) {
    if (!fs.existsSync(filePath)) continue;
    const src     = fs.readFileSync(filePath, 'utf8');
    const lines   = src.split('\n');
    const relPath = path.relative(ROOT, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line    = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      // Pattern 1: Date.now() — must be replaced by clock.now()
      if (/\bDate\.now\(\)/.test(line)) {
        violations.push({
          file:  relPath,
          line:  i + 1,
          text:  trimmed,
          kind:  'direct_date_now',
          issue: 'Direct Date.now() — use clock.now() from the governed Clock abstraction (test-runner/lib/clock.js)',
          action: 'Replace Date.now() with clock.now() where clock is an injected Clock instance',
        });
      }

      // Pattern 2: Math.random() — nondeterministic; replay requires seed-governed randomness
      if (/\bMath\.random\(\)/.test(line)) {
        violations.push({
          file:  relPath,
          line:  i + 1,
          text:  trimmed,
          kind:  'math_random',
          issue: 'Math.random() is nondeterministic — use the fleet seed (--seed) for any randomness',
          action: 'Remove Math.random() or move it behind the deterministic seed path in the simulator',
        });
      }

      // Pattern 3: new Date() with no arguments — nondeterministic wall-clock
      if (/\bnew Date\(\s*\)/.test(line)) {
        violations.push({
          file:  relPath,
          line:  i + 1,
          text:  trimmed,
          kind:  'new_date_no_args',
          issue: 'new Date() without arguments captures nondeterministic wall-clock time',
          action: 'Replace with new Date(clock.now()) or clock.iso()',
        });
      }
    }
  }

  return {
    name:    'nondeterminism_patterns',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? `No nondeterministic patterns found in ${scanTargets.length} scanned file(s)`
      : `${violations.length} nondeterministic pattern(s) detected in governed files`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: ${violations.length} nondeterministic pattern(s) prevent deterministic replay in: [${[...new Set(violations.map(v => v.file))].join(', ')}]`
      : null,
  };
}

/**
 * Verify that state-authority.js:
 *   1. Declares all 7 required governed domains (rollout, screen, manifest, chaos, suite, metrics, replay).
 *   2. Each domain entry has at least one allowed_transition_paths entry.
 *   3. Exports assertLegalTransition and VALID_TRANSITIONS.
 *   4. Exports MUTATION_OPERATIONS.
 */
function checkStateDomainCoverage() {
  const violations = [];

  if (!fs.existsSync(STATE_AUTHORITY_PATH)) {
    return {
      name:    'state_domain_coverage',
      status:  'FAIL',
      detail:  `state-authority.js not found at ${path.relative(ROOT, STATE_AUTHORITY_PATH)}`,
      violations: [{ issue: 'state-authority.js is missing — governed state machine not defined', action: 'Create test-runner/lib/state-authority.js with STATE_DOMAINS, assertLegalTransition, VALID_TRANSITIONS, MUTATION_OPERATIONS' }],
      blocker: 'DB-1: state-authority.js missing — state mutation governance not active',
    };
  }

  const src = fs.readFileSync(STATE_AUTHORITY_PATH, 'utf8');

  // Required domains — 8 total (rollout, screen, manifest, chaos, suite, metrics, replay, recovery)
  const REQUIRED_DOMAINS = ['rollout', 'screen', 'manifest', 'chaos', 'suite', 'metrics', 'replay', 'recovery'];
  for (const domain of REQUIRED_DOMAINS) {
    if (!src.includes(`${domain}:`)) {
      violations.push({
        domain,
        issue:  `Governed domain '${domain}' not declared in STATE_DOMAINS`,
        action: `Add '${domain}' entry with allowed_transition_paths to STATE_DOMAINS in state-authority.js`,
      });
    }
  }

  // allowed_transition_paths must appear for each domain — checked by presence of the property name
  if (!src.includes('allowed_transition_paths')) {
    violations.push({
      issue:  'No allowed_transition_paths declared in STATE_DOMAINS — state transitions are ungoverned',
      action: 'Add allowed_transition_paths arrays to each domain in STATE_DOMAINS',
    });
  }

  // Required exports
  if (!src.includes('export function assertLegalTransition') && !src.includes('export { assertLegalTransition')) {
    violations.push({
      issue:  'assertLegalTransition is not exported from state-authority.js',
      action: 'Export assertLegalTransition so mutation envelopes can enforce transition legality',
    });
  }

  if (!src.includes('export const VALID_TRANSITIONS') && !src.includes('export { VALID_TRANSITIONS')) {
    violations.push({
      issue:  'VALID_TRANSITIONS is not exported from state-authority.js',
      action: 'Export VALID_TRANSITIONS Set for O(1) transition lookup',
    });
  }

  if (!src.includes('export const MUTATION_OPERATIONS') && !src.includes('export { MUTATION_OPERATIONS')) {
    violations.push({
      issue:  'MUTATION_OPERATIONS is not exported from state-authority.js',
      action: 'Export MUTATION_OPERATIONS enum from state-authority.js',
    });
  }

  return {
    name:    'state_domain_coverage',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? `All ${REQUIRED_DOMAINS.length} governed domains (incl. recovery) declared with transitions and legal exports verified`
      : `${violations.length} state domain coverage violation(s) detected`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: ${violations.length} state governance issue(s): [${violations.map(v => v.domain ?? 'export').join(', ')}]`
      : null,
  };
}

/**
 * Verify that:
 *   1. applyMutation is imported in runner.js (governs suite/metrics/replay transitions).
 *   2. applyMutation is imported in chaos.js (governs chaos domain transitions).
 *   3. saveMutationLog is exported from mutations.js.
 *   4. saveStateHashTrace is exported from mutations.js.
 *   5. getMutationLog is exported from mutations.js.
 */
function checkMutationEnvelopeUsage() {
  const violations = [];

  const runnerSrc  = fs.existsSync(RUNNER_PATH)       ? fs.readFileSync(RUNNER_PATH, 'utf8')       : '';
  const chaosSrc   = fs.existsSync(CHAOS_LIB_PATH)    ? fs.readFileSync(CHAOS_LIB_PATH, 'utf8')    : '';
  const mutSrc     = fs.existsSync(MUTATIONS_LIB_PATH) ? fs.readFileSync(MUTATIONS_LIB_PATH, 'utf8') : null;

  if (!runnerSrc.includes('applyMutation')) {
    violations.push({
      file:   path.relative(ROOT, RUNNER_PATH),
      issue:  'runner.js does not import or use applyMutation — suite/metrics/replay state transitions are ungoverned',
      action: "Import applyMutation from './lib/mutations.js' and use it for all domain state transitions in runner.js",
    });
  }

  if (!chaosSrc.includes('applyMutation')) {
    violations.push({
      file:   path.relative(ROOT, CHAOS_LIB_PATH),
      issue:  'chaos.js does not import or use applyMutation — chaos domain transitions are ungoverned',
      action: "Import applyMutation from './mutations.js' and use it for chaos domain state transitions",
    });
  }

  if (mutSrc === null) {
    violations.push({
      file:   path.relative(ROOT, MUTATIONS_LIB_PATH),
      issue:  'mutations.js not found — mutation envelope infrastructure is missing',
      action: 'Create test-runner/lib/mutations.js with applyMutation, saveMutationLog, saveStateHashTrace, getMutationLog',
    });
  } else {
    for (const exportName of ['saveMutationLog', 'saveStateHashTrace', 'getMutationLog']) {
      if (!mutSrc.includes(`export function ${exportName}`) && !mutSrc.includes(`export { ${exportName}`)) {
        violations.push({
          file:   path.relative(ROOT, MUTATIONS_LIB_PATH),
          issue:  `'${exportName}' is not exported from mutations.js`,
          action: `Export ${exportName} from mutations.js`,
        });
      }
    }
  }

  return {
    name:    'mutation_envelope_usage',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'applyMutation verified in runner.js and chaos.js; saveMutationLog/saveStateHashTrace/getMutationLog exported'
      : `${violations.length} mutation envelope usage violation(s) detected`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: ${violations.length} mutation envelope gap(s) — ungoverned state changes possible: [${violations.map(v => v.file ?? v.issue.slice(0,40)).join(', ')}]`
      : null,
  };
}

/**
 * Scan governed source files for direct state mutation patterns that bypass
 * the applyMutation envelope:
 *
 *   .state =        — direct property assignment to a state field
 *   .status =       — direct property assignment to a status field
 *   Object.assign(  — spread merge that can silently overwrite governed state
 *
 * Scanned files: suites/*.js, runner.js, lib/metrics.js, lib/chaos.js, lib/fleet.js
 * Excluded (not governed state holders): lib/mutations.js, lib/state-authority.js,
 *   lib/clock.js, lib/events.js, lib/replay.js, lib/provenance.js, lib/reporter.js
 *
 * Each match is a violation — a bypass of the mutation governance layer.
 */
function checkDirectMutationPatterns() {
  const suitesDir = path.join(ROOT, 'test-runner/suites');
  const fleetPath = path.join(ROOT, 'test-runner/lib/fleet.js');

  const scanTargets = [
    RUNNER_PATH,
    METRICS_LIB_PATH,
    CHAOS_LIB_PATH,
    ...(fs.existsSync(fleetPath) ? [fleetPath] : []),
    ...(fs.existsSync(suitesDir)
      ? fs.readdirSync(suitesDir).filter(f => f.endsWith('.js')).map(f => path.join(suitesDir, f))
      : []),
  ];

  // Patterns that indicate direct mutation of governed state.
  // Use negative lookahead for = to distinguish assignment (=) from comparison (==, ===).
  const DIRECT_PATTERNS = [
    {
      re:     /\.\s*state\s*=(?!=)/,
      kind:   'direct_state_assign',
      issue:  'Direct `.state =` assignment bypasses mutation governance',
      action: "Use applyMutation({ operation: MUTATION_OPERATIONS.TRANSITION, ... }) instead of direct assignment",
    },
    {
      re:     /\.\s*status\s*=(?!=)/,
      kind:   'direct_status_assign',
      issue:  'Direct `.status =` assignment bypasses mutation governance',
      action: "Use applyMutation({ operation: MUTATION_OPERATIONS.SET_STATE, ... }) instead of direct assignment",
    },
    {
      re:     /\bObject\.assign\s*\(/,
      kind:   'object_assign',
      issue:  'Object.assign() can silently overwrite governed state without audit trail',
      action: 'Replace Object.assign() on governed state with applyMutation() calls',
    },
  ];

  const violations = [];

  for (const filePath of scanTargets) {
    if (!fs.existsSync(filePath)) continue;
    const src     = fs.readFileSync(filePath, 'utf8');
    const lines   = src.split('\n');
    const relPath = path.relative(ROOT, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line    = lines[i];
      const trimmed = line.trim();
      // Skip blank lines, pure comments
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      for (const { re, kind, issue, action } of DIRECT_PATTERNS) {
        if (re.test(line)) {
          violations.push({ file: relPath, line: i + 1, text: trimmed, kind, issue, action });
        }
      }
    }
  }

  return {
    name:    'direct_mutation_patterns',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? `No direct mutation patterns found in ${scanTargets.length} scanned file(s)`
      : `${violations.length} direct mutation bypass(es) detected in governed files`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: ${violations.length} direct mutation pattern(s) bypass governance in: [${[...new Set(violations.map(v => v.file))].join(', ')}]`
      : null,
  };
}

/**
 * Verify the mutation hash chain is wired into mutations.js and replay.js:
 *   1. state-hash.js exists and exports HashChain, verifyChain, compareChains.
 *   2. mutations.js imports from state-hash.js and adds mutation_hash + previous_mutation_hash.
 *   3. replay.js imports verifyChain or compareChains for final hash verification.
 */
function checkStateHashChain() {
  const violations = [];

  // 1. state-hash.js must exist
  if (!fs.existsSync(STATE_HASH_LIB_PATH)) {
    return {
      name:    'state_hash_chain',
      status:  'FAIL',
      detail:  `state-hash.js not found at ${path.relative(ROOT, STATE_HASH_LIB_PATH)}`,
      violations: [{ issue: 'state-hash.js is missing — mutation hash chain not implemented', action: 'Create test-runner/lib/state-hash.js with HashChain, verifyChain, compareChains' }],
      blocker: 'DB-1: state-hash.js missing — chain integrity not enforceable',
    };
  }

  const hashSrc = fs.readFileSync(STATE_HASH_LIB_PATH, 'utf8');

  for (const exportName of ['HashChain', 'verifyChain', 'compareChains', 'computeMutationHash']) {
    if (!hashSrc.includes(`export class ${exportName}`) && !hashSrc.includes(`export function ${exportName}`) && !hashSrc.includes(`export { ${exportName}`)) {
      violations.push({
        file:   path.relative(ROOT, STATE_HASH_LIB_PATH),
        issue:  `'${exportName}' not exported from state-hash.js`,
        action: `Export ${exportName} from state-hash.js`,
      });
    }
  }

  // 2. mutations.js must import from state-hash.js and include chain fields
  const mutSrc = fs.existsSync(MUTATIONS_LIB_PATH) ? fs.readFileSync(MUTATIONS_LIB_PATH, 'utf8') : '';

  if (!mutSrc.includes('state-hash.js')) {
    violations.push({
      file:   path.relative(ROOT, MUTATIONS_LIB_PATH),
      issue:  'mutations.js does not import from state-hash.js — mutation hash chain not active',
      action: "import { HashChain } from './state-hash.js' in mutations.js",
    });
  }

  if (!mutSrc.includes('mutation_hash')) {
    violations.push({
      file:   path.relative(ROOT, MUTATIONS_LIB_PATH),
      issue:  "mutations.js does not include 'mutation_hash' in mutation envelopes",
      action: 'Add mutation_hash and previous_mutation_hash to the frozen envelope in applyMutation()',
    });
  }

  if (!mutSrc.includes('previous_mutation_hash')) {
    violations.push({
      file:   path.relative(ROOT, MUTATIONS_LIB_PATH),
      issue:  "mutations.js does not include 'previous_mutation_hash' — chain linkage absent",
      action: 'Add previous_mutation_hash to the frozen envelope in applyMutation()',
    });
  }

  // 3. replay.js must use chain verification
  const replaySrc = fs.existsSync(path.join(ROOT, 'test-runner/lib/replay.js'))
    ? fs.readFileSync(path.join(ROOT, 'test-runner/lib/replay.js'), 'utf8') : '';

  if (!replaySrc.includes('verifyChain') && !replaySrc.includes('compareChains')) {
    violations.push({
      file:   'test-runner/lib/replay.js',
      issue:  'replay.js does not call verifyChain() or compareChains() — final hash not verified',
      action: "Import verifyChain and compareChains from './state-hash.js' in replay.js",
    });
  }

  if (!replaySrc.includes('final_hash_match')) {
    violations.push({
      file:   'test-runner/lib/replay.js',
      issue:  "replay.js does not check 'final_hash_match' — replay chain completeness not enforced",
      action: 'Add final_hash_match check in validateReplay() using compareChains()',
    });
  }

  return {
    name:    'state_hash_chain',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'Mutation hash chain verified: state-hash.js wired into mutations.js and replay.js'
      : `${violations.length} hash chain integrity violation(s) detected`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: ${violations.length} hash chain gap(s) — tamper detection not active: [${violations.map(v => v.issue.slice(0,50)).join(' | ')}]`
      : null,
  };
}

/**
 * Verify recovery governance:
 *   1. recovery-governor.js exists.
 *   2. All 7 named recovery categories are declared.
 *   3. thresholds.json has recovery entries for retryable categories.
 *   4. recovery-governor.js uses applyMutation for state transitions.
 *   5. No naked setTimeout recovery loops outside the governor in chaos.js.
 */
function checkRecoveryGovernance(thresholdsJson) {
  const violations = [];
  const warnings   = [];

  if (!fs.existsSync(RECOVERY_GOVERNOR_PATH)) {
    return {
      name:    'recovery_governance',
      status:  'FAIL',
      detail:  `recovery-governor.js not found at ${path.relative(ROOT, RECOVERY_GOVERNOR_PATH)}`,
      violations: [{ issue: 'recovery-governor.js is missing — recovery behavior is ungoverned', action: 'Create test-runner/lib/recovery-governor.js with all 7 recovery categories' }],
      blocker: 'DB-1: recovery-governor.js missing — no governed recovery path',
    };
  }

  const govSrc = fs.readFileSync(RECOVERY_GOVERNOR_PATH, 'utf8');

  // 1. All 7 named recovery categories
  const REQUIRED_CATEGORIES = [
    'backend_restart', 'db_restart', 'network_outage',
    'screen_desync', 'stalled_rollout', 'manifest_timeout', 'replay_divergence',
  ];
  for (const cat of REQUIRED_CATEGORIES) {
    if (!govSrc.includes(cat)) {
      violations.push({
        category: cat,
        issue:    `Recovery category '${cat}' not declared in recovery-governor.js`,
        action:   `Add '${cat}' entry to RECOVERY_CATEGORIES in recovery-governor.js`,
      });
    }
  }

  // 2. applyMutation must be used for state transitions
  if (!govSrc.includes('applyMutation')) {
    violations.push({
      file:   path.relative(ROOT, RECOVERY_GOVERNOR_PATH),
      issue:  'recovery-governor.js does not use applyMutation — recovery transitions are ungoverned',
      action: "Import applyMutation from './mutations.js' and use it for IDLE→STARTED, STARTED→COMPLETED etc.",
    });
  }

  // 3. Clock injection required
  if (!govSrc.includes('Clock')) {
    violations.push({
      file:   path.relative(ROOT, RECOVERY_GOVERNOR_PATH),
      issue:  'recovery-governor.js does not use governed Clock — backoff timers are nondeterministic',
      action: 'Inject a Clock instance and use it for all timing operations',
    });
  }

  // 4. thresholds.json must have recovery entries for retryable categories
  const recoveryThresholds = thresholdsJson?.recovery ?? {};
  const RETRYABLE_THRESHOLD_KEYS = ['backend_restart_ms', 'db_restart_ms', 'network_outage_recovery_ms'];
  for (const key of RETRYABLE_THRESHOLD_KEYS) {
    if (recoveryThresholds[key] == null) {
      violations.push({
        threshold_key: `recovery.${key}`,
        issue:         `thresholds.json missing 'recovery.${key}' — retryable recovery has no governed timeout`,
        action:        `Add 'recovery.${key}' to test-config/thresholds.json`,
      });
    }
  }

  // 5. chaos.js should not have bare setTimeout recovery loops (heuristic)
  const chaosSrc = fs.existsSync(CHAOS_LIB_PATH) ? fs.readFileSync(CHAOS_LIB_PATH, 'utf8') : '';
  const lines = chaosSrc.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i].trim();
    if (!line || line.startsWith('//') || line.startsWith('*')) continue;
    // Flag while-loop + setTimeout patterns that look like manual retry loops
    if (/while\s*\(/.test(line) && lines.slice(i, i + 10).some(l => /setTimeout/.test(l) && !/waitForHealth/.test(l))) {
      warnings.push({
        file:    path.relative(ROOT, CHAOS_LIB_PATH),
        line:    i + 1,
        issue:   'Possible ungovernored retry loop with setTimeout in chaos.js — consider using RecoveryGovernor',
        action:  'Replace ad-hoc retry loops with RecoveryGovernor.startRecovery() / failRecovery()',
      });
    }
  }

  return {
    name:    'recovery_governance',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? `All ${REQUIRED_CATEGORIES.length} recovery categories governed; retryable thresholds present`
      : `${violations.length} recovery governance violation(s) detected`,
    violations,
    warnings,
    blocker: violations.length > 0
      ? `DB-1: ${violations.length} recovery governance gap(s): [${violations.map(v => v.category ?? v.threshold_key ?? 'misc').join(', ')}]`
      : null,
  };
}

/**
 * Verify fleet consensus infrastructure:
 *   1. fleet-consensus.js exists in backend/src/lib/.
 *   2. fleet-consensus.js defines SPLIT_BRAIN state and freeze trigger.
 *   3. manifest.js route imports fleet-consensus and includes authority_epoch in response.
 *   4. manifest.js includes manifest_generation in response.
 */
function checkFleetConsensus() {
  const violations = [];

  if (!fs.existsSync(FLEET_CONSENSUS_PATH)) {
    return {
      name:    'fleet_consensus',
      status:  'FAIL',
      detail:  `fleet-consensus.js not found at ${path.relative(ROOT, FLEET_CONSENSUS_PATH)}`,
      violations: [{ issue: 'fleet-consensus.js is missing — split-brain detection not implemented', action: 'Create backend/src/lib/fleet-consensus.js with SPLIT_BRAIN detection and rollout freeze' }],
      blocker: 'DB-1: fleet-consensus.js missing — fleet state authority not observable',
    };
  }

  const consensusSrc = fs.readFileSync(FLEET_CONSENSUS_PATH, 'utf8');

  // SPLIT_BRAIN state must be defined
  if (!consensusSrc.includes('SPLIT_BRAIN')) {
    violations.push({
      file:   path.relative(ROOT, FLEET_CONSENSUS_PATH),
      issue:  "fleet-consensus.js does not define 'SPLIT_BRAIN' consensus state",
      action: "Add SPLIT_BRAIN to CONSENSUS_STATES and detection logic in getStatus()",
    });
  }

  // Freeze trigger on split-brain
  if (!consensusSrc.includes('isRolloutFrozen') && !consensusSrc.includes('rollout_frozen')) {
    violations.push({
      file:   path.relative(ROOT, FLEET_CONSENSUS_PATH),
      issue:  'fleet-consensus.js has no rollout freeze path for SPLIT_BRAIN',
      action: 'Add isRolloutFrozen() and freeze trigger in the SPLIT_BRAIN detection branch',
    });
  }

  // AUTHORITY_LOSS state
  if (!consensusSrc.includes('AUTHORITY_LOSS')) {
    violations.push({
      file:   path.relative(ROOT, FLEET_CONSENSUS_PATH),
      issue:  "fleet-consensus.js does not define 'AUTHORITY_LOSS' state",
      action: "Add AUTHORITY_LOSS to CONSENSUS_STATES",
    });
  }

  // Manifest route must import fleet-consensus
  const manifestSrc = fs.existsSync(MANIFEST_ROUTE_PATH)
    ? fs.readFileSync(MANIFEST_ROUTE_PATH, 'utf8') : '';

  if (!manifestSrc.includes('fleet-consensus')) {
    violations.push({
      file:   path.relative(ROOT, MANIFEST_ROUTE_PATH),
      issue:  "manifest.js route does not import fleet-consensus — authority_epoch not available",
      action: "require('../lib/fleet-consensus') in manifest.js",
    });
  }

  if (!manifestSrc.includes('authority_epoch')) {
    violations.push({
      file:   path.relative(ROOT, MANIFEST_ROUTE_PATH),
      issue:  "manifest.js route does not include 'authority_epoch' in response",
      action: "Add authority_epoch: fleetConsensus.getEpoch() to manifest response",
    });
  }

  if (!manifestSrc.includes('manifest_generation')) {
    violations.push({
      file:   path.relative(ROOT, MANIFEST_ROUTE_PATH),
      issue:  "manifest.js route does not include 'manifest_generation' — screen lineage tracking absent",
      action: "Add manifest_generation: fleetConsensus.getManifestGeneration() to manifest response",
    });
  }

  return {
    name:    'fleet_consensus',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'Fleet consensus verified: split-brain detection, rollout freeze, and manifest lineage present'
      : `${violations.length} fleet consensus violation(s) detected`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: ${violations.length} fleet consensus gap(s) — split-brain cannot be detected: [${violations.map(v => v.issue.slice(0,50)).join(' | ')}]`
      : null,
  };
}

/**
 * Verify incident bundle infrastructure:
 *   1. incident-bundle.js exists and exports createIncidentBundle.
 *   2. incident-bundle.js includes mutationLog (mutation audit trail) in bundle.
 *   3. incident-bundle.js includes governed_thresholds (threshold snapshot) in bundle.
 *   4. incident-bundle.js includes replay_command (bundle must be reproducible).
 *   5. runner.js imports createIncidentBundle and calls it on severe failure.
 */
function checkIncidentBundle() {
  const violations = [];

  if (!fs.existsSync(INCIDENT_BUNDLE_PATH)) {
    return {
      name:    'incident_bundle',
      status:  'FAIL',
      detail:  `incident-bundle.js not found at ${path.relative(ROOT, INCIDENT_BUNDLE_PATH)}`,
      violations: [{ issue: 'incident-bundle.js is missing — severe failures cannot be reproduced offline', action: 'Create test-runner/lib/incident-bundle.js with createIncidentBundle()' }],
      blocker: 'DB-1: incident-bundle.js missing — failure reproduction not possible',
    };
  }

  const bundleSrc = fs.readFileSync(INCIDENT_BUNDLE_PATH, 'utf8');

  // createIncidentBundle must be exported
  if (!bundleSrc.includes('export function createIncidentBundle') && !bundleSrc.includes('export { createIncidentBundle')) {
    violations.push({
      file:   path.relative(ROOT, INCIDENT_BUNDLE_PATH),
      issue:  "'createIncidentBundle' is not exported from incident-bundle.js",
      action: 'Export createIncidentBundle from incident-bundle.js',
    });
  }

  // Must include mutation log
  if (!bundleSrc.includes('mutationLog') && !bundleSrc.includes('mutation_log')) {
    violations.push({
      file:   path.relative(ROOT, INCIDENT_BUNDLE_PATH),
      issue:  "incident-bundle.js does not include mutationLog — audit trail absent from bundle",
      action: "Include mutationLog in the bundle content under 'mutation_log' key",
    });
  }

  // Must include threshold snapshot
  if (!bundleSrc.includes('governed_thresholds') && !bundleSrc.includes('thresholds')) {
    violations.push({
      file:   path.relative(ROOT, INCIDENT_BUNDLE_PATH),
      issue:  "incident-bundle.js does not include governed thresholds — offline verification not possible",
      action: "Include governed_thresholds in the bundle content",
    });
  }

  // Must include replay_command
  if (!bundleSrc.includes('replay_command')) {
    violations.push({
      file:   path.relative(ROOT, INCIDENT_BUNDLE_PATH),
      issue:  "incident-bundle.js does not include 'replay_command' — bundle cannot be replayed",
      action: "Add replay_command field with the exact CLI invocation needed to reproduce the failure",
    });
  }

  // Must include bundle_hash for corruption detection
  if (!bundleSrc.includes('bundle_hash')) {
    violations.push({
      file:   path.relative(ROOT, INCIDENT_BUNDLE_PATH),
      issue:  "incident-bundle.js does not compute bundle_hash — corruption detection not possible",
      action: "Compute and embed bundle_hash (SHA-256 of canonical bundle content) in the manifest",
    });
  }

  // runner.js must import and use createIncidentBundle
  const runnerSrc = fs.existsSync(RUNNER_PATH) ? fs.readFileSync(RUNNER_PATH, 'utf8') : '';
  if (!runnerSrc.includes('createIncidentBundle')) {
    violations.push({
      file:   path.relative(ROOT, RUNNER_PATH),
      issue:  "runner.js does not call createIncidentBundle — severe failures produce no reproduction bundle",
      action: "Import createIncidentBundle from './lib/incident-bundle.js' and call it when gatingResults.failed",
    });
  }

  return {
    name:    'incident_bundle',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'Incident bundle verified: createIncidentBundle exported, mutation log and threshold snapshot included, replay command present, wired in runner.js'
      : `${violations.length} incident bundle violation(s) detected`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: ${violations.length} incident bundle gap(s) — failures cannot be reproduced: [${violations.map(v => v.issue.slice(0,60)).join(' | ')}]`
      : null,
  };
}

// ── Governance checks (19-24) ─────────────────────────────────────────────────

function checkPolicyEngine() {
  const violations = [];
  const warnings   = [];

  if (!fs.existsSync(POLICY_ENGINE_PATH)) {
    return {
      name:    'policy_engine',
      status:  'FAIL',
      detail:  `policy-engine.js not found at ${path.relative(ROOT, POLICY_ENGINE_PATH)}`,
      violations: [{ issue: 'policy-engine.js is missing — runtime policy decisions not governed' }],
      blocker: 'DB-1: policy-engine.js missing — policy governance not active',
    };
  }

  const src = fs.readFileSync(POLICY_ENGINE_PATH, 'utf8');

  if (!src.includes('evaluatePolicy')) {
    violations.push({ issue: "'evaluatePolicy' not exported from policy-engine.js" });
  }

  const REQUIRED_POLICIES = [
    'rollout_promotion', 'rollout_freeze', 'rollout_rollback',
    'recovery_escalation', 'operator_override', 'manifest_rejection',
  ];
  for (const p of REQUIRED_POLICIES) {
    if (!src.includes(p)) {
      violations.push({ issue: `Policy '${p}' not defined in policy-engine.js` });
    }
  }

  if (!src.includes('saveDecisions')) {
    violations.push({ issue: "'saveDecisions' not exported from policy-engine.js" });
  }

  // WARN if ota.js does not reference policy-engine (autonomous-rollout is the intermediary)
  const otaSrc = fs.existsSync(OTA_ROUTE_PATH) ? fs.readFileSync(OTA_ROUTE_PATH, 'utf8') : '';
  if (!otaSrc.includes('policy-engine') && !otaSrc.includes('autonomous-rollout')) {
    warnings.push({
      issue:  'ota.js does not import policy-engine or autonomous-rollout — policy-governed promotions not wired into OTA route',
      action: "Consider requiring '../lib/autonomous-rollout' in ota.js promote handler",
    });
  }

  return {
    name:     'policy_engine',
    status:   violations.length === 0 ? (warnings.length > 0 ? 'WARN' : 'PASS') : 'FAIL',
    detail:   violations.length === 0
      ? `policy-engine.js verified: all 6 named policies present, evaluatePolicy and saveDecisions exported`
      : `${violations.length} policy engine violation(s)`,
    violations,
    warnings,
    blocker: violations.length > 0
      ? `DB-1: policy engine missing requirements: [${violations.map(v => v.issue.slice(0, 50)).join(' | ')}]`
      : null,
  };
}

function checkOperatorLedger() {
  const violations = [];

  if (!fs.existsSync(OPERATOR_LEDGER_PATH)) {
    return {
      name:    'operator_ledger',
      status:  'FAIL',
      detail:  `operator-ledger.js not found at ${path.relative(ROOT, OPERATOR_LEDGER_PATH)}`,
      violations: [{ issue: 'operator-ledger.js is missing — operator actions are unaudited' }],
      blocker: 'DB-1: operator-ledger.js missing — no tamper-evident audit trail',
    };
  }

  const src = fs.readFileSync(OPERATOR_LEDGER_PATH, 'utf8');

  if (!src.includes('appendEntry')) {
    violations.push({ issue: "'appendEntry' not exported from operator-ledger.js" });
  }
  if (!src.includes('verifyIntegrity')) {
    violations.push({ issue: "'verifyIntegrity' not exported from operator-ledger.js" });
  }
  if (!src.includes('LEDGER_GENESIS')) {
    violations.push({ issue: "Hash chain sentinel 'LEDGER_GENESIS' not found in operator-ledger.js" });
  }
  if (!src.includes('waiver_created')) {
    violations.push({ issue: "'waiver_created' action type not in allowed set — justification requirement not enforced" });
  }

  return {
    name:    'operator_ledger',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'operator-ledger.js verified: appendEntry, verifyIntegrity, LEDGER_GENESIS, waiver_created present'
      : `${violations.length} operator ledger violation(s)`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: operator ledger issues: [${violations.map(v => v.issue.slice(0, 50)).join(' | ')}]`
      : null,
  };
}

function checkAutonomousRollout() {
  const violations = [];

  if (!fs.existsSync(AUTONOMOUS_ROLLOUT_PATH)) {
    return {
      name:    'autonomous_rollout',
      status:  'FAIL',
      detail:  `autonomous-rollout.js not found at ${path.relative(ROOT, AUTONOMOUS_ROLLOUT_PATH)}`,
      violations: [{ issue: 'autonomous-rollout.js is missing — evidence-driven promotion not implemented' }],
      blocker: 'DB-1: autonomous-rollout.js missing',
    };
  }

  const src = fs.readFileSync(AUTONOMOUS_ROLLOUT_PATH, 'utf8');

  if (!src.includes('evaluatePromotion')) {
    violations.push({ issue: "'evaluatePromotion' not exported from autonomous-rollout.js" });
  }
  if (!src.includes('policyEngine')) {
    violations.push({ issue: "'policyEngine' not referenced in autonomous-rollout.js — must use policy engine, not direct logic" });
  }
  if (!src.includes('evidence_snapshot')) {
    violations.push({ issue: "'evidence_snapshot' not found in autonomous-rollout.js — evidence must be preserved" });
  }

  return {
    name:    'autonomous_rollout',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'autonomous-rollout.js verified: evaluatePromotion uses policy engine, evidence_snapshot preserved'
      : `${violations.length} autonomous rollout violation(s)`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: autonomous rollout issues: [${violations.map(v => v.issue.slice(0, 50)).join(' | ')}]`
      : null,
  };
}

function checkDistributedAuthority() {
  const violations = [];

  if (!fs.existsSync(DIST_AUTHORITY_PATH)) {
    return {
      name:    'distributed_authority',
      status:  'FAIL',
      detail:  `distributed-authority.js not found at ${path.relative(ROOT, DIST_AUTHORITY_PATH)}`,
      violations: [{ issue: 'distributed-authority.js is missing — no DB-backed authority lease' }],
      blocker: 'DB-1: distributed-authority.js missing',
    };
  }

  const src = fs.readFileSync(DIST_AUTHORITY_PATH, 'utf8');

  if (!src.includes('acquireLease')) {
    violations.push({ issue: "'acquireLease' not found in distributed-authority.js" });
  }
  if (!src.includes('CREATE TABLE')) {
    violations.push({ issue: "'CREATE TABLE' not found in distributed-authority.js — must not be memory-only" });
  }
  if (!src.includes('AUTHORITY.freeze_propagated')) {
    violations.push({ issue: "'AUTHORITY.freeze_propagated' event not found in distributed-authority.js" });
  }
  if (!src.includes('epoch')) {
    violations.push({ issue: "'epoch' not found in distributed-authority.js — monotonic epoch required" });
  }

  return {
    name:    'distributed_authority',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'distributed-authority.js verified: DB-backed, acquireLease, epoch, freeze_propagated event present'
      : `${violations.length} distributed authority violation(s)`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: distributed authority issues: [${violations.map(v => v.issue.slice(0, 50)).join(' | ')}]`
      : null,
  };
}

function checkGovernedConfig() {
  const violations = [];

  if (!fs.existsSync(GOVERNED_CONFIG_PATH)) {
    return {
      name:    'governed_config',
      status:  'FAIL',
      detail:  `governed-config.js not found at ${path.relative(ROOT, GOVERNED_CONFIG_PATH)}`,
      violations: [{ issue: 'governed-config.js is missing — config changes are unversioned and unattributed' }],
      blocker: 'DB-1: governed-config.js missing',
    };
  }

  const src = fs.readFileSync(GOVERNED_CONFIG_PATH, 'utf8');

  if (!src.includes('config_hash')) {
    violations.push({ issue: "'config_hash' not found in governed-config.js" });
  }
  if (!src.includes('config_version')) {
    violations.push({ issue: "'config_version' not found in governed-config.js" });
  }
  if (!src.includes('justification')) {
    violations.push({ issue: "'justification' not referenced in governed-config.js — justification required for updates" });
  }
  if (!src.includes('rollbackTo')) {
    violations.push({ issue: "'rollbackTo' not found in governed-config.js — rollback support required" });
  }

  return {
    name:    'governed_config',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'governed-config.js verified: config_hash, config_version, justification, rollbackTo present'
      : `${violations.length} governed config violation(s)`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: governed config issues: [${violations.map(v => v.issue.slice(0, 50)).join(' | ')}]`
      : null,
  };
}

function checkIncidentOrchestration() {
  const violations = [];

  if (!fs.existsSync(INCIDENT_ORCH_PATH)) {
    return {
      name:    'incident_orchestration',
      status:  'FAIL',
      detail:  `incident-orchestrator.js not found at ${path.relative(ROOT, INCIDENT_ORCH_PATH)}`,
      violations: [{ issue: 'incident-orchestrator.js is missing — incidents cannot be governed' }],
      blocker: 'DB-1: incident-orchestrator.js missing',
    };
  }

  const src = fs.readFileSync(INCIDENT_ORCH_PATH, 'utf8');

  if (!src.includes('createIncident')) {
    violations.push({ issue: "'createIncident' not found in incident-orchestrator.js" });
  }

  const REQUIRED_STATES = [
    'DETECTED', 'TRIAGED', 'MITIGATING', 'FROZEN', 'RECOVERING', 'RESOLVED', 'POSTMORTEM_REQUIRED',
  ];
  for (const state of REQUIRED_STATES) {
    if (!src.includes(state)) {
      violations.push({ issue: `Incident state '${state}' not declared in incident-orchestrator.js` });
    }
  }

  if (!src.includes('policyEngine')) {
    violations.push({ issue: "'policyEngine' not referenced in incident-orchestrator.js — incident creation must go through policy" });
  }

  return {
    name:    'incident_orchestration',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? `incident-orchestrator.js verified: all ${REQUIRED_STATES.length} incident states, createIncident, policyEngine present`
      : `${violations.length} incident orchestration violation(s)`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: incident orchestration issues: [${violations.map(v => v.issue.slice(0, 50)).join(' | ')}]`
      : null,
  };
}

/**
 * Generate reports/threshold-traceability.json.
 *
 * For each non-operational CI gate, maps:
 *   threshold_key → producer → suite_coverage → runner_enforcement → evidence_observed
 *
 * evidence_observed is populated from reports/metric-evidence.json if it exists
 * (written by runner.js after each test run). Absent = no run yet.
 */
function generateTraceabilityReport(reportsDir) {
  const metricsSrc = fs.existsSync(METRICS_LIB_PATH)
    ? fs.readFileSync(METRICS_LIB_PATH, 'utf8') : '';
  const runnerSrc  = fs.existsSync(RUNNER_PATH)
    ? fs.readFileSync(RUNNER_PATH, 'utf8') : '';

  // Parse suite GOVERNED_METRICS.
  const suitesDir    = path.join(ROOT, 'test-runner/suites');
  const suiteCoverage = {};
  if (fs.existsSync(suitesDir)) {
    for (const file of fs.readdirSync(suitesDir).filter(f => f.endsWith('.js'))) {
      const src  = fs.readFileSync(path.join(suitesDir, file), 'utf8');
      const keys = parseSuiteGovernedMetrics(src);
      if (keys) suiteCoverage[path.basename(file, '.js')] = keys;
    }
  }

  // Load runtime evidence if a prior run saved it.
  let runtimeEvidence = null;
  const evidencePath = path.join(reportsDir, 'metric-evidence.json');
  if (fs.existsSync(evidencePath)) {
    try {
      runtimeEvidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    } catch { /* missing or corrupt — treat as no evidence */ }
  }

  const thresholds = [];

  for (const req of METRIC_EVIDENCE_REQUIREMENTS) {
    const binding = THRESHOLD_BINDINGS.find(b => b.jsonPath === req.jsonPath);

    const producerFound = metricsSrc.includes(req.metricsProducer);
    const gateFound     = runnerSrc.includes(req.runnerGate);

    const suitesWithCoverage = Object.entries(suiteCoverage)
      .filter(([, keys]) => keys.includes(req.governedKey))
      .map(([name]) => name);

    const observedEvidence = runtimeEvidence?.evidence?.[req.governedKey] ?? null;

    thresholds.push({
      threshold_key:  req.jsonPath,
      metric:         binding?.metric ?? req.jsonPath,
      section:        binding?.section ?? 'unknown',
      deploy_blocker: binding?.deployBlocker ?? 'unknown',
      producer: {
        file:        path.relative(ROOT, METRICS_LIB_PATH),
        pattern:     req.metricsProducer,
        found:       producerFound,
      },
      suite_coverage: {
        suites: suitesWithCoverage,
        found:  suitesWithCoverage.length > 0,
      },
      runner_enforcement: {
        file:    path.relative(ROOT, RUNNER_PATH),
        pattern: req.runnerGate,
        found:   gateFound,
      },
      evidence_observed: observedEvidence,
    });
  }

  const report = {
    generated_at:   new Date().toISOString(),
    evidence_source: runtimeEvidence
      ? { run_id: runtimeEvidence.run_id, suite: runtimeEvidence.suite }
      : null,
    thresholds,
  };

  try {
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const outPath = path.join(reportsDir, 'threshold-traceability.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    return outPath;
  } catch (err) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

function printHuman(report) {
  const { summary, checks, deploy_blockers } = report;
  const LINE = '═'.repeat(64);
  const THIN = '─'.repeat(64);

  console.log(`\n${LINE}`);
  console.log('CLUBHUB CONTRACT VALIDATION');
  console.log(`Contract: ${path.relative(ROOT, CONTRACT_PATH)}`);
  console.log(LINE);

  for (const check of checks) {
    const icon = { PASS: '✓', FAIL: '✗', WARN: '⚠' }[check.status] ?? '?';
    const label = `${icon} [${check.status}] ${check.name}`;
    console.log(`\n${label}`);
    console.log(`  ${check.detail}`);

    if (check.violations?.length) {
      for (const v of check.violations) {
        console.log(`  VIOLATION: ${v.issue}`);
        if (v.json_path !== undefined) {
          console.log(`    path: ${v.json_path}`);
          console.log(`    contract expects: ${v.contract_value ?? '(none)'}`);
          console.log(`    thresholds.json:  ${v.thresholds_json_value ?? '(absent)'}`);
        }
        if (v.file) console.log(`    ${v.file}:${v.line}  ${v.text}`);
        if (v.action) console.log(`    → ${v.action}`);
      }
    }

    if (check.unchecked?.length) {
      for (const u of check.unchecked) {
        console.log(`  UNCHECKED GATE: ${u.json_path}`);
        console.log(`    → ${u.action}`);
      }
    }

    if (check.warnings?.length) {
      for (const w of check.warnings) {
        console.log(`  WARN: ${w.issue}`);
        if (w.orphan_keys) console.log(`    orphan keys: ${w.orphan_keys.join(', ')}`);
        if (w.action) console.log(`    → ${w.action}`);
      }
    }

    if (check.missing?.length) {
      for (const m of check.missing) console.log(`  MISSING: ${m}`);
    }
  }

  console.log(`\n${THIN}`);
  console.log(`RESULT: ${summary.status}  (${summary.passed}/${summary.total_checks} checks passed, ${summary.warned} warnings)`);

  if (deploy_blockers.length > 0) {
    console.log(`\nDEPLOY BLOCKERS (${deploy_blockers.length}):`);
    for (const b of deploy_blockers) console.log(`  [BLOCK] ${b}`);
  }

  console.log(`${LINE}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args     = process.argv.slice(2);
  const outputJson = args.includes('--json') || args.includes('--ci');

  // ── Step 1: contract file must exist before we can do anything ────────────
  const contractPresentCheck = checkContractPresent();
  if (contractPresentCheck.status === 'FAIL') {
    const earlyReport = makeReport([contractPresentCheck]);
    emit(earlyReport, outputJson);
    process.exit(1);
  }

  const markdown = fs.readFileSync(CONTRACT_PATH, 'utf8');

  // ── Step 2: load thresholds.json (allow failure — check handles it) ───────
  let thresholdsJson = {};
  const thresholdsCheck = checkThresholdsLoadable();
  if (thresholdsCheck.status === 'PASS') {
    thresholdsJson = JSON.parse(fs.readFileSync(THRESHOLDS_PATH, 'utf8'));
  }

  // ── Step 3: run all checks ────────────────────────────────────────────────
  const checks = [
    contractPresentCheck,
    checkContractVersion(markdown),
    checkRequiredSections(markdown),
    thresholdsCheck,
    checkThresholdDrift(markdown, thresholdsJson),
    checkRunnerCoverage(thresholdsJson),
    checkHiddenThresholds(),
    checkGapRegistry(),
    checkMetricEvidencePaths(),
    checkSuiteCoverage(),
    checkNondeterminism(),
    checkStateDomainCoverage(),
    checkMutationEnvelopeUsage(),
    checkDirectMutationPatterns(),
    checkStateHashChain(),
    checkRecoveryGovernance(thresholdsJson),
    checkFleetConsensus(),
    checkIncidentBundle(),
    checkPolicyEngine(),
    checkOperatorLedger(),
    checkAutonomousRollout(),
    checkDistributedAuthority(),
    checkGovernedConfig(),
    checkIncidentOrchestration(),
  ];

  const report = makeReport(checks);

  // ── Step 4: persist reports ───────────────────────────────────────────────
  try {
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const reportPath = path.join(REPORTS_DIR, 'contract-validation.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    if (!outputJson) console.log(`Report written: ${path.relative(ROOT, reportPath)}`);
  } catch (err) {
    if (!outputJson) console.warn(`Warning: could not write report — ${err.message}`);
  }

  // ── Step 4b: generate threshold traceability report ───────────────────────
  const tracePath = generateTraceabilityReport(REPORTS_DIR);
  if (tracePath && !outputJson) {
    console.log(`Report written: ${path.relative(ROOT, tracePath)}`);
  }

  // ── Step 5: output and exit ───────────────────────────────────────────────
  emit(report, outputJson);
  process.exit(report.exit_code);
}

function makeReport(checks) {
  const failed  = checks.filter(c => c.status === 'FAIL');
  const warned  = checks.filter(c => c.status === 'WARN');
  const blockers = checks.filter(c => c.blocker).flatMap(c =>
    Array.isArray(c.blocker) ? c.blocker : [c.blocker]
  );

  return {
    run_id:           new Date().toISOString().replace(/[:.]/g, '-'),
    timestamp:        new Date().toISOString(),
    contract_path:    path.relative(ROOT, CONTRACT_PATH),
    thresholds_path:  path.relative(ROOT, THRESHOLDS_PATH),
    summary: {
      total_checks: checks.length,
      passed:       checks.filter(c => c.status === 'PASS').length,
      failed:       failed.length,
      warned:       warned.length,
      status:       failed.length === 0 ? 'PASS' : 'FAIL',
    },
    checks,
    deploy_blockers: blockers,
    exit_code:       failed.length > 0 ? 1 : 0,
  };
}

function emit(report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }
}

main().catch(err => {
  console.error(`Contract validator internal error: ${err.message}`);
  console.error(err.stack);
  process.exit(2);
});
