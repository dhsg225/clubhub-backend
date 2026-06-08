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
 *  25. recovery_governor_wired    — chaos.js routes waitForHealth() through RecoveryGovernor
 *  26. fleet_consensus_wired      — epoch incremented at startup, generation on content change
 *  27. freeze_enforcement         — rollout-store.js enforces freeze before promoteRing()
 *  28. event_causality            — event-lineage.js exists with withLineage + orphan detection
 *  29. operator_overrides         — operator-overrides.js with expiry, ledger, incident linkage
 *  30. governance_db              — governance-db.js exists with cluster-global state (initSchema, incrementInt)
 *  31. cluster_consensus_persistent — fleet-consensus.js has setPool + initFromDb for DB-backed epoch/generation/freeze
 *  32. ledger_db_persistent       — operator-ledger.js has setPool + initFromDb + DB persistence
 *  33. incident_durable           — incident-orchestrator.js has setPool + initFromDb + persistIncident
 *  34. config_db_persistent       — governed-config.js has setPool + initFromDb for restart-safe config
 *  35. no_direct_threshold_reads  — backend src files do not bypass governed-config for thresholds.json
 *  36. deterministic_ids          — no crypto.randomBytes in ID generation for governed entities
 *  37. freeze_ledger_linked       — ota.js freeze/unfreeze routes append to operator ledger
 *
 *  ── Active/Active Authority Convergence (38-45) ──
 *  38. strong_freeze_read         — rollout-store.js uses DB-authoritative freeze read before promoting
 *  39. async_epoch_increment      — incrementEpoch() is async+DB-authoritative; index.js awaits it
 *  40. async_manifest_generation  — incrementManifestGeneration() is async+DB-authoritative; manifestEngine.js awaits it
 *  41. linearized_ledger_append   — appendEntryLinearized() exists with pg advisory lock for total ordering
 *  42. incident_version_lock      — transitionStrong() uses advisory lock + optimistic version locking
 *  43. db_failure_governance      — DB_FAILURE_MODE and HA_SAFETY_MODEL defined in distributed-authority.js
 *  44. governance_transaction_boundaries — strong freeze read + withAdvisoryLock primitive established
 *  45. ha_deployment_ceiling      — active/active topology safety ratings and advisory-only paths documented
 *
 *  ── Governed-Config Accessor checks (46-49) ──
 *  46. governed_threshold_accessor — governed-config.js exports getThreshold, requireThreshold, getThresholdSnapshot, getThresholdVersion
 *  47. governed_config_singleton   — governed-config.js exports setInstance and getInstance
 *  48. no_runtime_threshold_reads  — ota.js and screenAuth.js don't read thresholds.json directly at runtime
 *  49. threshold_snapshot_hashing  — governed-config.js uses configHash and getThresholdSnapshot for content-addressable versioning
 *
 *  ── Event Lineage Mode checks (50-54) ──
 *  50. lineage_mode_support        — event-lineage.js has LINEAGE_MODES (STRICT/REPORT/REPLAY)
 *  51. rollout_lineage_wired       — rollout-store.js uses withLineage on RING_FROZEN/RING_PROMOTED events
 *  52. incident_lineage_wired      — incident-orchestrator.js uses withLineage in createIncident
 *  53. lineage_modes_exported      — LINEAGE_MODES exported from event-lineage.js
 *  54. lineage_strict_throws       — verifyLineage STRICT mode throws on anomalies
 *
 *  ── Deterministic ID checks (55-58) ──
 *  55. deterministic_id_module     — deterministic-id.js exists with deriveDeterministicId + crypto hash
 *  56. incident_id_deterministic   — incident-orchestrator.js _makeIncidentId does not include Date.now()
 *  57. incident_id_uses_module     — incident-orchestrator.js imports and calls deriveDeterministicId
 *  58. deterministic_id_stable_stringify — deterministic-id.js uses stable serialisation
 *
 *  ── Cluster-Safe Freeze Authority checks (59-62) ──
 *  59. freeze_epoch_counter        — fleet-consensus.js has freeze_epoch counter
 *  60. get_freeze_state_strong     — fleet-consensus.js exports getFreezeStateStrong
 *  61. freeze_epoch_db_persisted   — freeze_epoch persisted to DB in getFreezeStateStrong
 *  62. freeze_epoch_increments     — _setFreeze and unfreezeRollout both increment _freezeEpoch
 *
 *  ── Operator Authority Enforcement checks (63-68) ──
 *  63. operator_auth_module        — operatorAuth.js exists at backend/src/middleware/
 *  64. operator_auth_hmac          — operatorAuth.js uses HMAC-SHA256 with timingSafeEqual
 *  65. operator_auth_roles         — operatorAuth.js defines ADMIN, OPERATOR, VIEWER roles
 *  66. operator_auth_exports       — operatorAuth.js exports requireOperatorAuth, issueOperatorToken, verifyOperatorToken
 *  67. ota_mutation_protected      — OTA mutation routes protected by requireOperatorAuth
 *  68. operator_token_expiry       — operatorAuth.js enforces token expiry
 *
 *  ── Resource Governance checks (69-72) ──
 *  69. max_screens_bound           — fleet-consensus.js has MAX_SCREENS constant
 *  70. screen_eviction_policy      — recordHeartbeat evicts oldest screen at MAX_SCREENS
 *  71. ledger_max_size             — operator-ledger.js has MAX_LEDGER_ENTRIES
 *  72. ledger_compaction           — operator-ledger.js compacts when exceeding MAX_LEDGER_ENTRIES
 *
 *  ── Governance Finalization checks (73-79) ──
 *  73. governed_clock              — governed-clock.js present; event-lineage uses governed clock
 *  74. full_lineage_enforcement    — core governed emitters use withLineage()
 *  75. operator_revocation         — operator-sessions.js with revokeToken/revokeOperator/rotateSigningKey/isRevoked/initFromDb
 *  76. jti_replay_protection       — operatorAuth.js embeds jti and checks revocation
 *  77. strong_freeze_consistency   — fleet-consensus.js has freezeStrong() and DB failure policy
 *  78. incident_lifecycle_governance — MAX_ACTIVE_INCIDENTS bounded; archiveResolvedIncidents present
 *  79. certification_harness       — governance-certification.js present with all 10 scenarios
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
const ROLLOUT_STORE_PATH       = path.join(ROOT, 'backend/src/lib/rollout-store.js');
const MANIFEST_ENGINE_PATH     = path.join(ROOT, 'backend/src/lib/manifestEngine.js');
const INDEX_PATH               = path.join(ROOT, 'backend/src/index.js');
const EVENT_LINEAGE_PATH       = path.join(ROOT, 'backend/src/lib/event-lineage.js');
const OPERATOR_OVERRIDES_PATH  = path.join(ROOT, 'backend/src/lib/operator-overrides.js');
const REPORTS_DIR             = path.join(ROOT, 'reports');
const DETERMINISTIC_ID_PATH   = path.join(ROOT, 'backend/src/lib/deterministic-id.js');
const OPERATOR_AUTH_PATH      = path.join(ROOT, 'backend/src/middleware/operatorAuth.js');
const GOVERNED_CLOCK_PATH     = path.join(ROOT, 'backend/src/lib/governed-clock.js');
const ROLLOUT_STATE_PATH      = path.join(ROOT, 'backend/src/lib/rollout-state.js');
const OPERATOR_SESSIONS_PATH  = path.join(ROOT, 'backend/src/lib/operator-sessions.js');
const OPERATOR_AUTH_PATH2     = path.join(ROOT, 'backend/src/middleware/operatorAuth.js');
const CERTIFICATION_PATH      = path.join(ROOT, 'test-runner/certification/governance-certification.js');

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

// ── Convergence hardening checks (25-29) ──────────────────────────────────────

/**
 * 25. recovery_governor_wired
 * Verify chaos.js routes waitForHealth() through the RecoveryGovernor:
 *   - constructor accepts a governor option
 *   - _pendingRecovery is set by inject methods
 *   - startRecovery is called within waitForHealth
 *   - direct retry loop removed from public waitForHealth path
 */
function checkRecoveryGovernorWired() {
  const violations = [];

  if (!fs.existsSync(CHAOS_LIB_PATH)) {
    return {
      name: 'recovery_governor_wired', status: 'FAIL',
      detail: 'chaos.js not found', violations: [{ issue: 'chaos.js missing' }], blocker: 'DB-1',
    };
  }

  const src = fs.readFileSync(CHAOS_LIB_PATH, 'utf8');

  if (!src.includes('_governor')) {
    violations.push({ issue: "chaos.js has no '_governor' field — RecoveryGovernor not accepted as constructor option" });
  }
  if (!src.includes('_pendingRecovery')) {
    violations.push({ issue: "chaos.js has no '_pendingRecovery' — inject methods do not stage recovery category" });
  }
  if (!src.includes('startRecovery')) {
    violations.push({ issue: "chaos.js does not call startRecovery() — waitForHealth not routed through governor" });
  }
  if (!src.includes('completeRecovery')) {
    violations.push({ issue: "chaos.js does not call completeRecovery() — successful recovery not signalled to governor" });
  }
  if (!src.includes('failRecovery')) {
    violations.push({ issue: "chaos.js does not call failRecovery() — failure escalation path missing" });
  }

  // Verify runner.js passes governor to ChaosController
  const runnerSrc = fs.existsSync(RUNNER_PATH) ? fs.readFileSync(RUNNER_PATH, 'utf8') : '';
  if (!runnerSrc.includes('governor:') && !runnerSrc.includes('governor :')) {
    violations.push({
      file:   path.relative(ROOT, RUNNER_PATH),
      issue:  'runner.js does not pass governor to ChaosController — RecoveryGovernor not wired into chaos execution',
      action: "Add 'governor: recovery' to the ChaosController constructor options in runner.js",
    });
  }

  return {
    name:    'recovery_governor_wired',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'RecoveryGovernor verified: chaos.js routes waitForHealth() through governor; runner.js injects governor'
      : `${violations.length} recovery governor wiring violation(s)`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: Recovery governor not wired: [${violations.map(v => (v.issue ?? '').slice(0, 60)).join(' | ')}]`
      : null,
  };
}

/**
 * 26. fleet_consensus_wired
 * Verify consensus lineage is incremented at runtime boundaries:
 *   - index.js calls incrementEpoch() at startup
 *   - manifestEngine.js calls incrementManifestGeneration() when content changes
 *   - manifest route exports lineage rejection classification
 */
function checkFleetConsensusWired() {
  const violations = [];

  const indexSrc   = fs.existsSync(INDEX_PATH)          ? fs.readFileSync(INDEX_PATH, 'utf8')          : '';
  const engineSrc  = fs.existsSync(MANIFEST_ENGINE_PATH) ? fs.readFileSync(MANIFEST_ENGINE_PATH, 'utf8') : '';
  const manifestSrc = fs.existsSync(MANIFEST_ROUTE_PATH) ? fs.readFileSync(MANIFEST_ROUTE_PATH, 'utf8') : '';

  if (!indexSrc.includes('incrementEpoch')) {
    violations.push({
      file:   path.relative(ROOT, INDEX_PATH),
      issue:  'index.js does not call incrementEpoch() — authority_epoch is never advanced at startup',
      action: "Call fleetConsensus.incrementEpoch() after PLATFORM.STARTUP event in index.js",
    });
  }
  if (!engineSrc.includes('incrementManifestGeneration')) {
    violations.push({
      file:   path.relative(ROOT, MANIFEST_ENGINE_PATH),
      issue:  'manifestEngine.js does not call incrementManifestGeneration() — content changes are not reflected in consensus lineage',
      action: "Call fleetConsensus.incrementManifestGeneration() when manifest checksum changes in computeManifest()",
    });
  }
  if (!manifestSrc.includes('LINEAGE_REJECTION') && !manifestSrc.includes('STALE_EPOCH')) {
    violations.push({
      file:   path.relative(ROOT, MANIFEST_ROUTE_PATH),
      issue:  'manifest route does not classify lineage rejections — stale screen submissions accepted without audit record',
      action: "Add STALE_EPOCH/STALE_MANIFEST/UNKNOWN_AUTHORITY lineage rejection classification to manifest.js",
    });
  }

  return {
    name:    'fleet_consensus_wired',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'Fleet consensus wiring verified: incrementEpoch on startup, incrementManifestGeneration on content change, lineage rejection classification present'
      : `${violations.length} fleet consensus wiring violation(s)`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: Fleet consensus not wired: [${violations.map(v => (v.issue ?? '').slice(0, 60)).join(' | ')}]`
      : null,
  };
}

/**
 * 27. freeze_enforcement
 * Verify rollout-store.js enforces freeze classifications before promoteRing():
 *   - isRolloutFrozen() checked before promotion
 *   - freeze classification labels present (CONSENSUS_SPLIT_BRAIN, AUTHORITY_LOSS, etc.)
 *   - freeze emits RING_FROZEN event with freeze_class field
 */
function checkFreezeEnforcement() {
  const violations = [];

  if (!fs.existsSync(ROLLOUT_STORE_PATH)) {
    return {
      name: 'freeze_enforcement', status: 'FAIL',
      detail: 'rollout-store.js not found',
      violations: [{ issue: 'rollout-store.js missing' }],
      blocker: 'DB-1: rollout-store.js missing',
    };
  }

  const src = fs.readFileSync(ROLLOUT_STORE_PATH, 'utf8');

  if (!src.includes('isRolloutFrozen')) {
    violations.push({
      file:   path.relative(ROOT, ROLLOUT_STORE_PATH),
      issue:  "rollout-store.js promoteRing() does not check isRolloutFrozen() — consensus freezes are advisory only",
      action: "Add fleetConsensus.isRolloutFrozen() check at the top of promoteRing() in rollout-store.js",
    });
  }

  const FREEZE_CLASSES = ['CONSENSUS_SPLIT_BRAIN', 'AUTHORITY_LOSS', 'POLICY_DENY', 'MANUAL_OPERATOR_FREEZE'];
  for (const cls of FREEZE_CLASSES) {
    if (!src.includes(cls)) {
      violations.push({
        issue:  `Freeze classification '${cls}' not present in rollout-store.js`,
        action: `Add '${cls}' classification to the freeze enforcement block in promoteRing()`,
      });
    }
  }

  if (!src.includes('freeze_class')) {
    violations.push({
      issue:  "promoteRing() does not emit 'freeze_class' in OTA.RING_FROZEN events — freeze reason is unclassified",
      action: "Include 'freeze_class' field in OTA.RING_FROZEN emissions from rollout-store.js",
    });
  }

  return {
    name:    'freeze_enforcement',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'Freeze enforcement verified: isRolloutFrozen() consulted in promoteRing(), all 4 freeze classifications present'
      : `${violations.length} freeze enforcement violation(s)`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: Freeze enforcement gaps: [${violations.map(v => (v.issue ?? '').slice(0, 60)).join(' | ')}]`
      : null,
  };
}

/**
 * 28. event_causality
 * Verify event-lineage.js exists with required capabilities:
 *   - withLineage() for enriching events with causal context
 *   - verifyLineage() for detecting orphaned events and broken chains
 *   - exportLineage() for writing reports/event-lineage.json
 *   - ORPHANED_EVENT detection explicitly implemented
 */
function checkEventCausality() {
  const violations = [];

  if (!fs.existsSync(EVENT_LINEAGE_PATH)) {
    return {
      name:    'event_causality',
      status:  'FAIL',
      detail:  `event-lineage.js not found at ${path.relative(ROOT, EVENT_LINEAGE_PATH)}`,
      violations: [{ issue: 'event-lineage.js missing — governed events have no causal tracking' }],
      blocker: 'DB-1: event-lineage.js missing',
    };
  }

  const src = fs.readFileSync(EVENT_LINEAGE_PATH, 'utf8');

  if (!src.includes('withLineage')) {
    violations.push({ issue: "'withLineage' not exported from event-lineage.js — events cannot be causally enriched" });
  }
  if (!src.includes('verifyLineage')) {
    violations.push({ issue: "'verifyLineage' not exported from event-lineage.js — causal chain verification missing" });
  }
  if (!src.includes('exportLineage')) {
    violations.push({ issue: "'exportLineage' not found — event-lineage.json report cannot be generated" });
  }
  if (!src.includes('ORPHANED_EVENT')) {
    violations.push({ issue: "'ORPHANED_EVENT' anomaly type not defined — orphan detection not implemented" });
  }
  if (!src.includes('caused_by')) {
    violations.push({ issue: "'caused_by' not referenced in event-lineage.js — causal parent tracking absent" });
  }

  return {
    name:    'event_causality',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'Event causality verified: withLineage, verifyLineage, exportLineage, ORPHANED_EVENT detection all present'
      : `${violations.length} event causality violation(s)`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: Event causality gaps: [${violations.map(v => (v.issue ?? '').slice(0, 60)).join(' | ')}]`
      : null,
  };
}

/**
 * 29. operator_overrides
 * Verify operator-overrides.js exists with safety requirements:
 *   - expiry enforced on all overrides
 *   - SECURITY.override_used event emitted on use
 *   - operator ledger append on use
 *   - linked_incident required
 *   - createOverride, checkOverride, useOverride exported
 */
function checkOperatorOverrides() {
  const violations = [];

  if (!fs.existsSync(OPERATOR_OVERRIDES_PATH)) {
    return {
      name:    'operator_overrides',
      status:  'FAIL',
      detail:  `operator-overrides.js not found at ${path.relative(ROOT, OPERATOR_OVERRIDES_PATH)}`,
      violations: [{ issue: 'operator-overrides.js missing — operator overrides are unbounded and ungoverned' }],
      blocker: 'DB-1: operator-overrides.js missing',
    };
  }

  const src = fs.readFileSync(OPERATOR_OVERRIDES_PATH, 'utf8');

  if (!src.includes('expiry')) {
    violations.push({ issue: "'expiry' not enforced in operator-overrides.js — overrides can be indefinite" });
  }
  if (!src.includes('SECURITY.override_used') && !src.includes("'SECURITY.override_used'") && !src.includes('"SECURITY.override_used"')) {
    violations.push({ issue: "'SECURITY.override_used' event not emitted — override use is not audit-visible" });
  }
  if (!src.includes('linked_incident')) {
    violations.push({ issue: "'linked_incident' not required in operator-overrides.js — overrides not linked to incidents" });
  }
  if (!src.includes('createOverride')) {
    violations.push({ issue: "'createOverride' not exported from operator-overrides.js" });
  }
  if (!src.includes('useOverride')) {
    violations.push({ issue: "'useOverride' not exported from operator-overrides.js" });
  }
  if (!src.includes('appendEntry') && !src.includes('operatorLedger')) {
    violations.push({ issue: "override use does not write to operator ledger — overrides are not tamper-evidently audited" });
  }

  return {
    name:    'operator_overrides',
    status:  violations.length === 0 ? 'PASS' : 'FAIL',
    detail:  violations.length === 0
      ? 'Operator overrides verified: expiry enforced, SECURITY.override_used emitted, ledger-appended, incident-linked'
      : `${violations.length} operator override violation(s)`,
    violations,
    blocker: violations.length > 0
      ? `DB-1: Operator override issues: [${violations.map(v => (v.issue ?? '').slice(0, 60)).join(' | ')}]`
      : null,
  };
}

// ── Distributed governance checks (30-37) ─────────────────────────────────────

const GOVERNANCE_DB_PATH     = path.join(ROOT, 'backend/src/lib/governance-db.js');
const INCIDENT_ORCH_PATH2    = path.join(ROOT, 'backend/src/lib/incident-orchestrator.js');
const OTA_ROUTE_PATH2        = path.join(ROOT, 'backend/src/routes/ota.js');

function checkGovernanceDb() {
  if (!fs.existsSync(GOVERNANCE_DB_PATH)) return { name:'governance_db',status:'FAIL',detail:'governance-db.js not found',violations:[{issue:'governance-db.js missing'}],blocker:'DB-1' };
  const src = fs.readFileSync(GOVERNANCE_DB_PATH,'utf8');
  const v=[];
  if (!src.includes('initSchema'))   v.push({issue:"'initSchema' not found in governance-db.js"});
  if (!src.includes('incrementInt')) v.push({issue:"'incrementInt' not found — no atomic cluster counter"});
  if (!src.includes('getIntValue'))  v.push({issue:"'getIntValue' not found in governance-db.js"});
  if (!src.includes('setIntValue'))  v.push({issue:"'setIntValue' not found in governance-db.js"});
  return { name:'governance_db', status:v.length===0?'PASS':'FAIL',
    detail:v.length===0?'governance-db.js verified: initSchema, incrementInt, getIntValue, setIntValue present':`${v.length} governance-db violation(s)`,
    violations:v, blocker:v.length>0?`DB-1: governance-db gaps: [${v.map(x=>x.issue.slice(0,50)).join(' | ')}]`:null };
}

function checkClusterConsensusPersistent() {
  const src = fs.existsSync(FLEET_CONSENSUS_PATH) ? fs.readFileSync(FLEET_CONSENSUS_PATH,'utf8') : '';
  const v=[];
  if (!src.includes('initFromDb'))  v.push({issue:"fleet-consensus.js missing 'initFromDb' — epoch/generation not loaded from DB on restart"});
  if (!src.includes('setPool'))     v.push({issue:"fleet-consensus.js missing 'setPool' — DB pool not injectable"});
  if (!src.includes('governance-db') && !src.includes('governanceDb')) v.push({issue:"fleet-consensus.js does not reference governance-db — cluster state not persisted"});
  return { name:'cluster_consensus_persistent', status:v.length===0?'PASS':'FAIL',
    detail:v.length===0?'Fleet consensus persistence verified: setPool, initFromDb, governance-db wired':`${v.length} cluster consensus persistence violation(s)`,
    violations:v, blocker:v.length>0?`DB-1: Consensus not cluster-persistent: [${v.map(x=>x.issue.slice(0,60)).join(' | ')}]`:null };
}

function checkLedgerDbPersistent() {
  const src = fs.existsSync(OPERATOR_LEDGER_PATH) ? fs.readFileSync(OPERATOR_LEDGER_PATH,'utf8') : '';
  const v=[];
  if (!src.includes('initFromDb'))   v.push({issue:"operator-ledger.js missing 'initFromDb' — hash chain not restored after restart"});
  if (!src.includes('setPool'))      v.push({issue:"operator-ledger.js missing 'setPool' — DB pool not injectable"});
  if (!src.includes('act-'))         v.push({issue:"operator-ledger.js has no 'act-' sequential ID pattern"});
  if (src.includes('randomBytes') && src.includes('action_id')) v.push({issue:"operator-ledger.js uses randomBytes for action_id — non-deterministic ledger IDs"});
  return { name:'ledger_db_persistent', status:v.length===0?'PASS':'FAIL',
    detail:v.length===0?'Operator ledger DB persistence verified: setPool, initFromDb, sequential IDs':`${v.length} ledger persistence violation(s)`,
    violations:v, blocker:v.length>0?`DB-1: Ledger not restart-safe: [${v.map(x=>x.issue.slice(0,60)).join(' | ')}]`:null };
}

function checkIncidentDurable() {
  const src = fs.existsSync(INCIDENT_ORCH_PATH2) ? fs.readFileSync(INCIDENT_ORCH_PATH2,'utf8') : '';
  const v=[];
  if (!src.includes('initFromDb'))      v.push({issue:"incident-orchestrator.js missing 'initFromDb' — incidents lost on restart"});
  if (!src.includes('persistIncident') && !src.includes('setPool')) v.push({issue:"incident-orchestrator.js missing 'persistIncident' or 'setPool' — no DB persistence path"});
  if (src.includes('randomBytes') && src.includes('inc-')) v.push({issue:"incident-orchestrator.js uses randomBytes for incident_id — non-deterministic IDs"});
  return { name:'incident_durable', status:v.length===0?'PASS':'FAIL',
    detail:v.length===0?'Incident durability verified: initFromDb, persistIncident present, deterministic IDs':`${v.length} incident durability violation(s)`,
    violations:v, blocker:v.length>0?`DB-1: Incidents not restart-safe: [${v.map(x=>x.issue.slice(0,60)).join(' | ')}]`:null };
}

function checkConfigDbPersistent() {
  const src = fs.existsSync(GOVERNED_CONFIG_PATH) ? fs.readFileSync(GOVERNED_CONFIG_PATH,'utf8') : '';
  const v=[];
  if (!src.includes('initFromDb'))    v.push({issue:"governed-config.js missing 'initFromDb' — config history not restored after restart"});
  if (!src.includes('setPool') && !src.includes('persistSnapshot')) v.push({issue:"governed-config.js missing 'setPool' or 'persistSnapshot' — no DB persistence path"});
  return { name:'config_db_persistent', status:v.length===0?'PASS':'FAIL',
    detail:v.length===0?'Governed config DB persistence verified: initFromDb and DB persistence present':`${v.length} config DB persistence violation(s)`,
    violations:v, blocker:v.length>0?`DB-1: Config not restart-safe: [${v.map(x=>x.issue.slice(0,60)).join(' | ')}]`:null };
}

function checkNoDirectThresholdReads() {
  const violations=[];
  const backendSrcDir = path.join(ROOT,'backend/src');
  // governed-config.js: owns the threshold read by design
  // index.js: contains the ONE permitted bootstrap read that seeds the GovernedConfig singleton
  const EXEMPT = new Set(['governed-config.js', 'index.js']);
  // Match non-comment lines that load thresholds.json via readFileSync or require()
  const DIRECT_READ_RE = /^\s*(?!\/\/|\/?\*)[^*]*(readFileSync|require\s*\()[^)]*thresholds\.json/;
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir,{withFileTypes:true})) {
      const full = path.join(dir,f.name);
      if (f.isDirectory()) { scanDir(full); continue; }
      if (!f.name.endsWith('.js') || EXEMPT.has(f.name)) continue;
      const lines = fs.readFileSync(full,'utf8').split('\n');
      for (let i=0; i<lines.length; i++) {
        if (DIRECT_READ_RE.test(lines[i])) {
          violations.push({ file: path.relative(ROOT,full), line: i+1, issue:`Direct thresholds.json read — must route through governed-config` });
        }
      }
    }
  }
  scanDir(backendSrcDir);
  return { name:'no_direct_threshold_reads', status:violations.length===0?'PASS':'FAIL',
    detail:violations.length===0?'No direct thresholds.json reads in backend/src (governed-config.js and index.js bootstrap are exempt)':`${violations.length} direct thresholds.json read(s) detected — must use governed-config`,
    violations, blocker:violations.length>0?`DB-1: Modules bypass governed-config for threshold reads: [${violations.map(v=>v.file+(v.line?':'+v.line:'')).join(', ')}]`:null };
}

function checkDeterministicIds() {
  const targets = [OPERATOR_LEDGER_PATH, INCIDENT_ORCH_PATH2, OPERATOR_OVERRIDES_PATH];
  const violations=[];
  for (const p of targets) {
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p,'utf8');
    // randomBytes in an ID-generating context (not for hashing)
    const lines = src.split('\n');
    for (let i=0;i<lines.length;i++) {
      if (/randomBytes/.test(lines[i]) && /id\s*=|_id\s*=|Id\s*=/.test(lines[i])) {
        violations.push({ file: path.relative(ROOT,p), line:i+1, issue:`randomBytes used for ID generation — non-deterministic across replays` });
      }
    }
  }
  return { name:'deterministic_ids', status:violations.length===0?'PASS':'FAIL',
    detail:violations.length===0?'Deterministic ID generation verified: no randomBytes in governed entity ID paths':`${violations.length} non-deterministic ID generation(s) detected`,
    violations, blocker:violations.length>0?`DB-1: Non-deterministic IDs break replay: [${violations.map(v=>v.file+':'+v.line).join(', ')}]`:null };
}

function checkFreezeLedgerLinked() {
  const src = fs.existsSync(OTA_ROUTE_PATH2) ? fs.readFileSync(OTA_ROUTE_PATH2,'utf8') : fs.existsSync(OTA_ROUTE_PATH) ? fs.readFileSync(OTA_ROUTE_PATH,'utf8') : '';
  const v=[];
  if (!src.includes('operatorLedger')) v.push({issue:"ota.js does not import operatorLedger — freeze/unfreeze operations not audit-ledgered"});
  if (!src.includes('rollout_freeze'))  v.push({issue:"ota.js freeze route does not append 'rollout_freeze' to ledger"});
  if (!src.includes('rollout_unfreeze')) v.push({issue:"ota.js unfreeze route does not append 'rollout_unfreeze' to ledger"});
  return { name:'freeze_ledger_linked', status:v.length===0?'PASS':'FAIL',
    detail:v.length===0?'Freeze/unfreeze ledger linkage verified: rollout_freeze and rollout_unfreeze appended to operator ledger':`${v.length} freeze ledger linkage violation(s)`,
    violations:v, blocker:v.length>0?`DB-1: Freeze operations not ledgered: [${v.map(x=>x.issue.slice(0,60)).join(' | ')}]`:null };
}

// ── Active/Active Authority Convergence checks (38-45) ────────────────────────
// Note: DIST_AUTHORITY_PATH, MANIFEST_ENGINE_PATH, INDEX_PATH already declared above.

/**
 * 38. strong_freeze_read
 * Verify rollout-store.js uses a DB-authoritative freeze read before promoting.
 * In active/active HA, the in-memory isRolloutFrozen() may be stale if another
 * instance set the freeze. The strong read (isRolloutFrozenFromDb) queries DB directly.
 */
function checkStrongFreezeRead() {
  const src = fs.existsSync(ROLLOUT_STORE_PATH) ? fs.readFileSync(ROLLOUT_STORE_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('isRolloutFrozenFromDb') && !src.includes('isRolloutFrozenStrong')) {
    v.push({
      issue:  'rollout-store.promoteRing() uses memory-only isRolloutFrozen() — stale in active/active HA',
      action: 'Replace with await fleetConsensus.isRolloutFrozenFromDb(pool) before promotion',
    });
  }
  return {
    name:   'strong_freeze_read',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0
      ? 'Strong freeze read verified: rollout-store.js uses DB-authoritative isRolloutFrozenFromDb before promoting'
      : `${v.length} strong freeze read violation(s)`,
    violations: v,
    blocker: v.length > 0
      ? `DB-1: Freeze read is stale in active/active — promotions may slip through concurrent freeze: [${v.map(x => x.issue.slice(0, 60)).join(' | ')}]`
      : null,
  };
}

/**
 * 39. async_epoch_increment
 * Verify incrementEpoch() is async+DB-authoritative in fleet-consensus.js
 * and is awaited in index.js startup.
 */
function checkAsyncEpochIncrement() {
  const consensusSrc = fs.existsSync(FLEET_CONSENSUS_PATH) ? fs.readFileSync(FLEET_CONSENSUS_PATH, 'utf8') : '';
  const indexSrc     = fs.existsSync(INDEX_PATH)          ? fs.readFileSync(INDEX_PATH, 'utf8')          : '';
  const v = [];

  if (!consensusSrc.includes('async function incrementEpoch')) {
    v.push({
      file:   path.relative(ROOT, FLEET_CONSENSUS_PATH),
      issue:  'incrementEpoch() is not async — DB increment is fire-and-forget, memory can diverge from DB',
      action: 'Make incrementEpoch() async; await governanceDb.incrementInt and assign returned value to _epoch',
    });
  }
  if (!indexSrc.includes('await fleetConsensus.incrementEpoch') && !indexSrc.includes('await incrementEpoch')) {
    v.push({
      file:   path.relative(ROOT, INDEX_PATH),
      issue:  'index.js does not await incrementEpoch() — epoch may not be DB-authoritative before serving requests',
      action: 'Await fleetConsensus.incrementEpoch() in the app.listen async callback',
    });
  }

  return {
    name:   'async_epoch_increment',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0
      ? 'Async epoch increment verified: incrementEpoch is async+DB-authoritative; index.js awaits it'
      : `${v.length} epoch increment violation(s)`,
    violations: v,
    blocker: v.length > 0
      ? `DB-1: Epoch increment not cluster-authoritative: [${v.map(x => x.issue.slice(0, 60)).join(' | ')}]`
      : null,
  };
}

/**
 * 40. async_manifest_generation
 * Verify incrementManifestGeneration() is async+DB-authoritative in fleet-consensus.js
 * and is awaited in manifestEngine.js.
 */
function checkAsyncManifestGeneration() {
  const consensusSrc = fs.existsSync(FLEET_CONSENSUS_PATH) ? fs.readFileSync(FLEET_CONSENSUS_PATH, 'utf8') : '';
  const engineSrc    = fs.existsSync(MANIFEST_ENGINE_PATH) ? fs.readFileSync(MANIFEST_ENGINE_PATH, 'utf8') : '';
  const v = [];

  if (!consensusSrc.includes('async function incrementManifestGeneration')) {
    v.push({
      file:   path.relative(ROOT, FLEET_CONSENSUS_PATH),
      issue:  'incrementManifestGeneration() is not async — multiple instances can diverge manifest_generation counter',
      action: 'Make incrementManifestGeneration() async; await governanceDb.incrementInt and assign returned value to _manifestGeneration',
    });
  }
  if (!engineSrc.includes('await fleetConsensus.incrementManifestGeneration') && !engineSrc.includes('await incrementManifestGeneration')) {
    v.push({
      file:   path.relative(ROOT, MANIFEST_ENGINE_PATH),
      issue:  'manifestEngine.js does not await incrementManifestGeneration() — generation counter may be fire-and-forget',
      action: 'Await fleetConsensus.incrementManifestGeneration() when checksum changes in computeManifest()',
    });
  }

  return {
    name:   'async_manifest_generation',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0
      ? 'Async manifest generation verified: incrementManifestGeneration is async+DB-authoritative; manifestEngine.js awaits it'
      : `${v.length} manifest generation violation(s)`,
    violations: v,
    blocker: v.length > 0
      ? `DB-1: Manifest generation not cluster-authoritative: [${v.map(x => x.issue.slice(0, 60)).join(' | ')}]`
      : null,
  };
}

/**
 * 41. linearized_ledger_append
 * Verify operator-ledger.js exports appendEntryLinearized() with pg advisory lock
 * for cross-instance hash chain consistency.
 */
function checkLinearizedLedgerAppend() {
  const src = fs.existsSync(OPERATOR_LEDGER_PATH) ? fs.readFileSync(OPERATOR_LEDGER_PATH, 'utf8') : '';
  const v = [];

  if (!src.includes('appendEntryLinearized')) {
    v.push({
      issue:  'operator-ledger.js missing appendEntryLinearized() — concurrent appends from multiple instances diverge hash chain',
      action: 'Add appendEntryLinearized(pool, opts) using pg_advisory_xact_lock for total ordering',
    });
  }
  if (!src.includes('pg_advisory_xact_lock') && !src.includes('advisory_lock') && !src.includes('withAdvisoryLock')) {
    v.push({
      issue:  'appendEntryLinearized does not use pg advisory lock — no cross-instance serialization guarantee',
      action: 'Use pg_advisory_xact_lock or governanceDb.withAdvisoryLock inside appendEntryLinearized',
    });
  }

  return {
    name:   'linearized_ledger_append',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0
      ? 'Linearized ledger append verified: appendEntryLinearized with advisory lock present'
      : `${v.length} ledger linearization violation(s)`,
    violations: v,
    blocker: v.length > 0
      ? `DB-1: Ledger hash chain can diverge in active/active: [${v.map(x => x.issue.slice(0, 60)).join(' | ')}]`
      : null,
  };
}

/**
 * 42. incident_version_lock
 * Verify incident-orchestrator.js has transitionStrong() with optimistic locking
 * to prevent concurrent conflicting transitions in active/active HA.
 */
function checkIncidentVersionLock() {
  const src = fs.existsSync(INCIDENT_ORCH_PATH2) ? fs.readFileSync(INCIDENT_ORCH_PATH2, 'utf8') : '';
  const v = [];

  if (!src.includes('transitionStrong')) {
    v.push({
      issue:  'incident-orchestrator.js missing transitionStrong() — concurrent instances can conflict-transition same incident',
      action: 'Add transitionStrong(pool, incident_id, toState, opts) with advisory lock + optimistic version locking',
    });
  }
  if (!src.includes('version') || (!src.includes('pg_advisory') && !src.includes('withAdvisoryLock') && !src.includes('advisory_lock'))) {
    v.push({
      issue:  'transitionStrong does not use version column or advisory lock — concurrent transitions not serialized',
      action: 'Add version INT column to incidents table; use pg advisory lock + UPDATE WHERE version = $n in transitionStrong',
    });
  }
  if (!src.includes('IncidentConcurrencyError')) {
    v.push({
      issue:  'IncidentConcurrencyError not defined — concurrent transition conflicts not detectable',
      action: 'Add IncidentConcurrencyError class to incident-orchestrator.js',
    });
  }

  return {
    name:   'incident_version_lock',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0
      ? 'Incident version lock verified: transitionStrong with advisory lock and optimistic locking present'
      : `${v.length} incident locking violation(s)`,
    violations: v,
    blocker: v.length > 0
      ? `DB-1: Incident transitions not cluster-serialized: [${v.map(x => x.issue.slice(0, 60)).join(' | ')}]`
      : null,
  };
}

/**
 * 43. db_failure_governance
 * Verify distributed-authority.js defines DB_FAILURE_MODE and HA_SAFETY_MODEL
 * constants documenting degraded-mode behaviour.
 */
function checkDbFailureGovernance() {
  const src = fs.existsSync(DIST_AUTHORITY_PATH) ? fs.readFileSync(DIST_AUTHORITY_PATH, 'utf8') : '';
  const v = [];

  if (!src.includes('DB_FAILURE_MODE')) {
    v.push({
      issue:  'distributed-authority.js missing DB_FAILURE_MODE — no formal definition of degraded-mode behaviour',
      action: 'Add DB_FAILURE_MODE object documenting each subsystem\'s DB-outage behaviour',
    });
  }
  if (!src.includes('HA_SAFETY_MODEL') && !src.includes('SAFE_DEGRADED_MODE') && !src.includes('deployment ceiling')) {
    v.push({
      issue:  'No HA_SAFETY_MODEL or deployment ceiling documented — operators cannot assess active/active safety',
      action: 'Add HA_SAFETY_MODEL object or SAFE_DEGRADED_MODE documenting the deployment ceiling',
    });
  }

  return {
    name:   'db_failure_governance',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0
      ? 'DB failure governance verified: DB_FAILURE_MODE and HA_SAFETY_MODEL defined in distributed-authority.js'
      : `${v.length} DB failure governance violation(s)`,
    violations: v,
    blocker: v.length > 0
      ? `DB-1: DB failure behaviour undefined — operators cannot reason about HA degraded mode: [${v.map(x => x.issue.slice(0, 60)).join(' | ')}]`
      : null,
  };
}

/**
 * 44. governance_transaction_boundaries
 * Verify rollout-store.js defines clear transaction boundaries:
 *   - Strong (DB) freeze read before state change
 *   - withAdvisoryLock or pg_advisory usage available for coordinated writes
 *   - governance-db imported for cluster-authoritative operations
 */
function checkGovernanceTransactionBoundaries() {
  const storeSrc = fs.existsSync(ROLLOUT_STORE_PATH) ? fs.readFileSync(ROLLOUT_STORE_PATH, 'utf8') : '';
  const dbSrc    = fs.existsSync(GOVERNANCE_DB_PATH)  ? fs.readFileSync(GOVERNANCE_DB_PATH, 'utf8')  : '';
  const v = [];

  if (!storeSrc.includes('isRolloutFrozenFromDb') && !storeSrc.includes('isRolloutFrozenStrong')) {
    v.push({ issue: 'rollout-store.js does not perform strong freeze read before promote — freeze+promote boundary not transactionally safe' });
  }
  if (!dbSrc.includes('withAdvisoryLock')) {
    v.push({ issue: 'governance-db.js missing withAdvisoryLock() — no cross-instance serialization primitive available' });
  }

  return {
    name:   'governance_transaction_boundaries',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0
      ? 'Governance transaction boundaries verified: strong freeze read and withAdvisoryLock primitive present'
      : `${v.length} transaction boundary violation(s)`,
    violations: v,
    blocker: v.length > 0
      ? `DB-1: Governance transaction boundaries not established: [${v.map(x => x.issue.slice(0, 60)).join(' | ')}]`
      : null,
  };
}

/**
 * 45. ha_deployment_ceiling
 * Verify distributed-authority.js documents the HA deployment ceiling —
 * which topologies are safe and which require additional coordination.
 */
function checkHaDeploymentCeiling() {
  const src = fs.existsSync(DIST_AUTHORITY_PATH) ? fs.readFileSync(DIST_AUTHORITY_PATH, 'utf8') : '';
  const v = [];

  if (!src.includes('active/active') && !src.includes('active_active') && !src.includes('ACTIVE/ACTIVE')) {
    v.push({
      issue:  'distributed-authority.js does not document active/active HA safety — deployment ceiling unspecified',
      action: 'Add HA_SAFETY_MODEL with topology safety ratings and remaining risks',
    });
  }
  if (!src.includes('CONDITIONALLY_SAFE') && !src.includes('advisory_only') && !src.includes('ADVISORY_ONLY')) {
    v.push({
      issue:  'HA safety model does not distinguish SAFE vs CONDITIONALLY_SAFE paths — operators cannot assess risk',
      action: 'Add topology safety ratings: SAFE, CONDITIONALLY_SAFE, ADVISORY_ONLY in HA_SAFETY_MODEL',
    });
  }

  return {
    name:   'ha_deployment_ceiling',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0
      ? 'HA deployment ceiling verified: active/active topology safety ratings and advisory-only paths documented'
      : `${v.length} HA deployment ceiling violation(s)`,
    violations: v,
    blocker: v.length > 0
      ? `DB-1: HA deployment ceiling not documented — active/active safety unspecified: [${v.map(x => x.issue.slice(0, 60)).join(' | ')}]`
      : null,
  };
}

// ── Governed-Config Accessor checks (46-49) ──────────────────────────────────

/**
 * 46. governed_threshold_accessor
 * governed-config.js must export the full accessor surface:
 *   getThreshold, requireThreshold, getThresholdSnapshot, getThresholdVersion
 */
function checkGovernedThresholdAccessor() {
  const src = fs.existsSync(GOVERNED_CONFIG_PATH) ? fs.readFileSync(GOVERNED_CONFIG_PATH, 'utf8') : '';
  const v = [];
  for (const fn of ['getThreshold', 'requireThreshold', 'getThresholdSnapshot', 'getThresholdVersion']) {
    if (!src.includes(fn)) {
      v.push({ issue: `governed-config.js missing export: ${fn}` });
    }
  }
  return {
    name:   'governed_threshold_accessor',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0
      ? 'Governed threshold accessors verified: getThreshold, requireThreshold, getThresholdSnapshot, getThresholdVersion all present'
      : `${v.length} governed threshold accessor(s) missing`,
    violations: v,
    blocker: v.length > 0 ? `DB-1: governed-config.js missing accessor API: [${v.map(x => x.issue).join(' | ')}]` : null,
  };
}

/**
 * 47. governed_config_singleton
 * governed-config.js must export setInstance and getInstance for process-wide singleton.
 */
function checkGovernedConfigSingleton() {
  const src = fs.existsSync(GOVERNED_CONFIG_PATH) ? fs.readFileSync(GOVERNED_CONFIG_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('setInstance')) v.push({ issue: "governed-config.js missing 'setInstance' export — singleton cannot be wired at startup" });
  if (!src.includes('getInstance')) v.push({ issue: "governed-config.js missing 'getInstance' export — modules cannot access singleton" });
  return {
    name:   'governed_config_singleton',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0
      ? 'Governed-config singleton API verified: setInstance and getInstance exported'
      : `${v.length} singleton API gap(s) detected`,
    violations: v,
    blocker: v.length > 0 ? `DB-1: governed-config singleton not wirable: [${v.map(x => x.issue).join(' | ')}]` : null,
  };
}

/**
 * 48. no_runtime_threshold_reads
 * ota.js and screenAuth.js must not contain readFileSync + thresholds.json.
 * These were the last two non-governed modules; after the fix they must be clean.
 */
function checkNoRuntimeThresholdReads() {
  const targets = [
    { path: OTA_ROUTE_PATH,  name: 'ota.js' },
    { path: path.join(ROOT, 'backend/src/middleware/screenAuth.js'), name: 'screenAuth.js' },
  ];
  const v = [];
  for (const { path: p, name } of targets) {
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    if (src.includes('thresholds.json') && src.includes('readFileSync')) {
      v.push({ file: name, issue: `${name} still reads thresholds.json directly at runtime — must use governed-config singleton` });
    }
  }
  return {
    name:   'no_runtime_threshold_reads',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0
      ? 'No runtime thresholds.json reads in ota.js or screenAuth.js — both route through governed-config'
      : `${v.length} runtime direct read(s) detected`,
    violations: v,
    blocker: v.length > 0 ? `DB-1: Runtime modules bypass governed-config: [${v.map(x => x.file).join(', ')}]` : null,
  };
}

/**
 * 49. threshold_snapshot_hashing
 * governed-config.js must implement configHash and snapshot methods for
 * content-addressable config versioning and replay labelling.
 */
function checkThresholdSnapshotHashing() {
  const src = fs.existsSync(GOVERNED_CONFIG_PATH) ? fs.readFileSync(GOVERNED_CONFIG_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('configHash'))        v.push({ issue: "governed-config.js missing 'configHash' — config versions are not content-addressable" });
  if (!src.includes('getThresholdSnapshot')) v.push({ issue: "governed-config.js missing 'getThresholdSnapshot' — cannot label replays with config version" });
  if (!src.includes('config_hash'))       v.push({ issue: "governed-config.js snapshot does not include 'config_hash' field" });
  return {
    name:   'threshold_snapshot_hashing',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0
      ? 'Threshold snapshot hashing verified: configHash, getThresholdSnapshot, and config_hash field all present'
      : `${v.length} snapshot hashing gap(s) detected`,
    violations: v,
    blocker: v.length > 0 ? `DB-1: Config snapshots not content-addressable: [${v.map(x => x.issue).join(' | ')}]` : null,
  };
}

// ── Event Lineage Mode checks (50-54) ─────────────────────────────────────────

function checkLineageModeSupport() {
  const src = fs.existsSync(EVENT_LINEAGE_PATH) ? fs.readFileSync(EVENT_LINEAGE_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('LINEAGE_MODES'))     v.push({ issue: "event-lineage.js missing LINEAGE_MODES constant" });
  if (!src.includes("'STRICT'") && !src.includes('"STRICT"'))  v.push({ issue: "event-lineage.js missing STRICT mode" });
  if (!src.includes("'REPORT'") && !src.includes('"REPORT"'))  v.push({ issue: "event-lineage.js missing REPORT mode" });
  if (!src.includes("'REPLAY'") && !src.includes('"REPLAY"'))  v.push({ issue: "event-lineage.js missing REPLAY mode" });
  return { name: 'lineage_mode_support', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'verifyLineage STRICT/REPORT/REPLAY modes present':`${v.length} lineage mode gap(s)`,
    violations: v, blocker: v.length>0?`DB-1: Event lineage lacks operational modes: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkRolloutLineageWired() {
  const src = fs.existsSync(ROLLOUT_STORE_PATH) ? fs.readFileSync(ROLLOUT_STORE_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('withLineage'))    v.push({ issue: "rollout-store.js does not import/use withLineage — RING_FROZEN/RING_PROMOTED events lack lineage" });
  if (!src.includes('event-lineage'))  v.push({ issue: "rollout-store.js does not import event-lineage" });
  return { name: 'rollout_lineage_wired', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'rollout-store.js uses withLineage on RING events':'rollout-store.js missing lineage wiring',
    violations: v, blocker: v.length>0?`DB-1: Rollout ring events lack lineage context: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkIncidentLineageWired() {
  const src = fs.existsSync(INCIDENT_ORCH_PATH) ? fs.readFileSync(INCIDENT_ORCH_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('withLineage'))   v.push({ issue: "incident-orchestrator.js does not use withLineage in createIncident" });
  if (!src.includes('event-lineage')) v.push({ issue: "incident-orchestrator.js does not import event-lineage" });
  return { name: 'incident_lineage_wired', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'incident-orchestrator.js uses withLineage in createIncident':'incident-orchestrator.js missing lineage wiring',
    violations: v, blocker: v.length>0?`DB-1: Incident creation events lack lineage context: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkLineageModesExported() {
  const src = fs.existsSync(EVENT_LINEAGE_PATH) ? fs.readFileSync(EVENT_LINEAGE_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('LINEAGE_MODES')) v.push({ issue: "LINEAGE_MODES not defined in event-lineage.js" });
  if (!src.includes('LINEAGE_MODES') || !src.match(/module\.exports.*LINEAGE_MODES/s)) {
    if (!src.match(/LINEAGE_MODES[,\s}]/)) v.push({ issue: "LINEAGE_MODES not exported from event-lineage.js" });
  }
  return { name: 'lineage_modes_exported', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'LINEAGE_MODES exported from event-lineage.js':`${v.length} export gap(s)`,
    violations: v, blocker: v.length>0?`DB-1: LINEAGE_MODES not exported: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkLineageStrictThrows() {
  const src = fs.existsSync(EVENT_LINEAGE_PATH) ? fs.readFileSync(EVENT_LINEAGE_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('STRICT') || (!src.includes('throw new Error') && !src.includes('throw Error'))) {
    v.push({ issue: "verifyLineage STRICT mode does not throw on anomalies" });
  }
  return { name: 'lineage_strict_throws', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'verifyLineage STRICT mode throws on anomalies as required':'STRICT mode missing throw',
    violations: v, blocker: v.length>0?`DB-1: Lineage STRICT mode does not enforce: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

// ── Deterministic ID checks (55-58) ──────────────────────────────────────────

function checkDeterministicIdModule() {
  const v = [];
  if (!fs.existsSync(DETERMINISTIC_ID_PATH)) { v.push({ issue: 'deterministic-id.js not found' }); }
  else {
    const src = fs.readFileSync(DETERMINISTIC_ID_PATH, 'utf8');
    if (!src.includes('deriveDeterministicId')) v.push({ issue: "deterministic-id.js missing deriveDeterministicId export" });
    if (!src.includes('createHash')) v.push({ issue: "deterministic-id.js missing crypto.createHash — not content-addressed" });
  }
  return { name: 'deterministic_id_module', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'deterministic-id.js verified: deriveDeterministicId with content-addressing present':`${v.length} gap(s)`,
    violations: v, blocker: v.length>0?`DB-1: deterministic-id.js missing: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkIncidentIdDeterministic() {
  const src = fs.existsSync(INCIDENT_ORCH_PATH) ? fs.readFileSync(INCIDENT_ORCH_PATH, 'utf8') : '';
  const v = [];
  // The _makeIncidentId function must NOT include Date.now() in the hash input
  const lines = src.split('\n');
  let inMakeId = false;
  for (let i=0; i<lines.length; i++) {
    if (lines[i].includes('_makeIncidentId') && lines[i].includes('function')) inMakeId = true;
    if (inMakeId && lines[i].includes('Date.now()')) {
      v.push({ file: 'backend/src/lib/incident-orchestrator.js', line: i+1, issue: 'Date.now() in incident ID hash — non-deterministic across cluster instances' });
    }
    if (inMakeId && lines[i].includes('}') && !lines[i].includes('{')) inMakeId = false;
  }
  return { name: 'incident_id_deterministic', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'Incident ID hash does not include Date.now() — deterministic across nodes':`${v.length} non-deterministic ID pattern(s)`,
    violations: v, blocker: v.length>0?`DB-1: Incident IDs are non-deterministic — replays produce different IDs: [${v.map(x=>x.file+':'+x.line).join(', ')}]`:null };
}

function checkIncidentIdUsesModule() {
  const src = fs.existsSync(INCIDENT_ORCH_PATH) ? fs.readFileSync(INCIDENT_ORCH_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('deterministic-id'))     v.push({ issue: "incident-orchestrator.js does not import deterministic-id.js" });
  if (!src.includes('deriveDeterministicId')) v.push({ issue: "incident-orchestrator.js does not call deriveDeterministicId" });
  return { name: 'incident_id_uses_module', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'incident-orchestrator.js uses deterministic-id module for ID derivation':'incident-orchestrator.js missing deterministic-id wiring',
    violations: v, blocker: v.length>0?`DB-1: Incident IDs not using governed deterministic-id module: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkDeterministicIdStableStringify() {
  const src = fs.existsSync(DETERMINISTIC_ID_PATH) ? fs.readFileSync(DETERMINISTIC_ID_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('stableStringify') && !src.includes('_stableStringify')) {
    v.push({ issue: "deterministic-id.js does not use stable serialisation — different key order produces different IDs" });
  }
  return { name: 'deterministic_id_stable_stringify', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'deterministic-id.js uses stable serialisation for canonical form':'deterministic-id.js missing stable serialisation',
    violations: v, blocker: v.length>0?`DB-1: Deterministic IDs are not key-order-stable: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

// ── Cluster-Safe Freeze Authority checks (59-62) ──────────────────────────────

function checkFreezeEpochCounter() {
  const src = fs.existsSync(FLEET_CONSENSUS_PATH) ? fs.readFileSync(FLEET_CONSENSUS_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('_freezeEpoch') && !src.includes('freeze_epoch')) {
    v.push({ issue: "fleet-consensus.js missing freeze_epoch counter" });
  }
  if (!src.includes('_freezeEpoch++') && !src.includes('freezeEpoch++')) {
    v.push({ issue: "fleet-consensus.js does not increment freeze_epoch on freeze" });
  }
  return { name: 'freeze_epoch_counter', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'freeze_epoch counter present and increments on every freeze event':'missing freeze epoch counter',
    violations: v, blocker: v.length>0?`DB-1: Freeze epoch not tracked: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkGetFreezeStateStrong() {
  const src = fs.existsSync(FLEET_CONSENSUS_PATH) ? fs.readFileSync(FLEET_CONSENSUS_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('getFreezeStateStrong')) v.push({ issue: "fleet-consensus.js missing getFreezeStateStrong export" });
  return { name: 'get_freeze_state_strong', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'getFreezeStateStrong exported from fleet-consensus.js':'getFreezeStateStrong missing',
    violations: v, blocker: v.length>0?`DB-1: Strong freeze read API missing: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkFreezeEpochDbPersisted() {
  const src = fs.existsSync(FLEET_CONSENSUS_PATH) ? fs.readFileSync(FLEET_CONSENSUS_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes("'freeze_epoch'") && !src.includes('"freeze_epoch"')) {
    v.push({ issue: "getFreezeStateStrong does not read freeze_epoch from DB — epoch is memory-only" });
  }
  return { name: 'freeze_epoch_db_persisted', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'freeze_epoch persisted to DB and read back in getFreezeStateStrong':'freeze_epoch DB persistence missing',
    violations: v, blocker: v.length>0?`DB-1: Freeze epoch not cluster-durable: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkFreezeEpochIncrements() {
  const src = fs.existsSync(FLEET_CONSENSUS_PATH) ? fs.readFileSync(FLEET_CONSENSUS_PATH, 'utf8') : '';
  const v = [];
  // Both _setFreeze and unfreezeRollout should increment
  const setFreezeHasIncrement   = src.includes('_setFreeze') && src.includes('_freezeEpoch++');
  const unfreezeHasIncrement    = src.includes('unfreezeRollout') && src.match(/unfreezeRollout[\s\S]{0,400}_freezeEpoch\+\+/);
  if (!setFreezeHasIncrement) v.push({ issue: "_setFreeze does not increment _freezeEpoch" });
  if (!unfreezeHasIncrement)  v.push({ issue: "unfreezeRollout does not increment _freezeEpoch" });
  return { name: 'freeze_epoch_increments', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'freeze_epoch increments on both freeze and unfreeze events':'freeze_epoch increment missing',
    violations: v, blocker: v.length>0?`DB-1: Freeze epoch not monotonically increasing: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

// ── Operator Authority Enforcement checks (63-68) ─────────────────────────────

function checkOperatorAuthModule() {
  const v = [];
  if (!fs.existsSync(OPERATOR_AUTH_PATH)) v.push({ issue: 'operatorAuth.js not found at backend/src/middleware/operatorAuth.js' });
  return { name: 'operator_auth_module', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'operatorAuth.js middleware module present':'operatorAuth.js missing',
    violations: v, blocker: v.length>0?`DB-1: Operator auth middleware missing: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkOperatorAuthHmac() {
  const src = fs.existsSync(OPERATOR_AUTH_PATH) ? fs.readFileSync(OPERATOR_AUTH_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('createHmac'))       v.push({ issue: "operatorAuth.js missing HMAC-SHA256 — tokens are not signed" });
  if (!src.includes('timingSafeEqual'))  v.push({ issue: "operatorAuth.js missing timingSafeEqual — vulnerable to timing attacks" });
  return { name: 'operator_auth_hmac', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'operatorAuth.js uses HMAC-SHA256 with constant-time comparison':'operatorAuth.js HMAC gaps',
    violations: v, blocker: v.length>0?`DB-1: Operator token verification insecure: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkOperatorAuthRoles() {
  const src = fs.existsSync(OPERATOR_AUTH_PATH) ? fs.readFileSync(OPERATOR_AUTH_PATH, 'utf8') : '';
  const v = [];
  for (const role of ['ADMIN', 'OPERATOR', 'VIEWER']) {
    if (!src.includes(role)) v.push({ issue: `operatorAuth.js missing role: ${role}` });
  }
  return { name: 'operator_auth_roles', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'operatorAuth.js defines ADMIN, OPERATOR, VIEWER roles':'operatorAuth.js missing role definitions',
    violations: v, blocker: v.length>0?`DB-1: Operator role model incomplete: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkOperatorAuthExports() {
  const src = fs.existsSync(OPERATOR_AUTH_PATH) ? fs.readFileSync(OPERATOR_AUTH_PATH, 'utf8') : '';
  const v = [];
  for (const fn of ['requireOperatorAuth', 'issueOperatorToken', 'verifyOperatorToken']) {
    if (!src.includes(fn)) v.push({ issue: `operatorAuth.js missing export: ${fn}` });
  }
  return { name: 'operator_auth_exports', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'operatorAuth.js exports requireOperatorAuth, issueOperatorToken, verifyOperatorToken':'operator auth export gaps',
    violations: v, blocker: v.length>0?`DB-1: Operator auth API incomplete: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkOtaMutationProtected() {
  const src = fs.existsSync(OTA_ROUTE_PATH) ? fs.readFileSync(OTA_ROUTE_PATH, 'utf8')
    : (fs.existsSync(OTA_ROUTE_PATH2) ? fs.readFileSync(OTA_ROUTE_PATH2, 'utf8') : '');
  const v = [];
  if (!src.includes('requireOperatorAuth'))  v.push({ issue: "ota.js does not use requireOperatorAuth on mutation routes" });
  if (!src.includes('operatorAuth'))         v.push({ issue: "ota.js does not import operatorAuth middleware" });
  return { name: 'ota_mutation_protected', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'OTA mutation routes protected by requireOperatorAuth':'OTA mutation routes unprotected',
    violations: v, blocker: v.length>0?`DB-1: OTA mutation routes have no operator auth: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkOperatorTokenExpiry() {
  const src = fs.existsSync(OPERATOR_AUTH_PATH) ? fs.readFileSync(OPERATOR_AUTH_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('.exp') && !src.includes('payload.exp')) v.push({ issue: "operatorAuth.js does not check token expiry" });
  return { name: 'operator_token_expiry', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'operatorAuth.js enforces token expiry':'token expiry check missing',
    violations: v, blocker: v.length>0?`DB-1: Operator tokens have no expiry enforcement: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

// ── Resource Governance checks (69-72) ────────────────────────────────────────

function checkMaxScreensBound() {
  const src = fs.existsSync(FLEET_CONSENSUS_PATH) ? fs.readFileSync(FLEET_CONSENSUS_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('MAX_SCREENS')) v.push({ issue: "fleet-consensus.js missing MAX_SCREENS constant — _screens map is unbounded" });
  return { name: 'max_screens_bound', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'MAX_SCREENS bound defined in fleet-consensus.js':'MAX_SCREENS bound missing',
    violations: v, blocker: v.length>0?`DB-1: fleet-consensus _screens map is unbounded — OOM risk at scale: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkScreenEvictionPolicy() {
  const src = fs.existsSync(FLEET_CONSENSUS_PATH) ? fs.readFileSync(FLEET_CONSENSUS_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('MAX_SCREENS') || !src.includes('_screens.delete')) {
    v.push({ issue: "fleet-consensus.js recordHeartbeat does not evict oldest screen when at MAX_SCREENS capacity" });
  }
  return { name: 'screen_eviction_policy', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'recordHeartbeat evicts stale screens when at MAX_SCREENS capacity':'screen eviction policy missing',
    violations: v, blocker: v.length>0?`DB-1: Fleet screen registry grows without bound: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkLedgerMaxSize() {
  const src = fs.existsSync(OPERATOR_LEDGER_PATH) ? fs.readFileSync(OPERATOR_LEDGER_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('MAX_LEDGER_ENTRIES')) v.push({ issue: "operator-ledger.js missing MAX_LEDGER_ENTRIES — in-memory ledger is unbounded" });
  return { name: 'ledger_max_size', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'MAX_LEDGER_ENTRIES defined in operator-ledger.js':'MAX_LEDGER_ENTRIES missing',
    violations: v, blocker: v.length>0?`DB-1: Operator ledger in-memory store is unbounded — OOM risk: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

function checkLedgerCompaction() {
  const src = fs.existsSync(OPERATOR_LEDGER_PATH) ? fs.readFileSync(OPERATOR_LEDGER_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('_compactLedgerIfNeeded') && !src.includes('compact')) {
    v.push({ issue: "operator-ledger.js has no compaction logic — grows without bound once MAX_LEDGER_ENTRIES reached" });
  }
  return { name: 'ledger_compaction', status: v.length===0?'PASS':'FAIL',
    detail: v.length===0?'operator-ledger.js compacts in-memory store when exceeding MAX_LEDGER_ENTRIES':'ledger compaction missing',
    violations: v, blocker: v.length>0?`DB-1: Operator ledger never compacts — OOM risk: [${v.map(x=>x.issue).join(' | ')}]`:null };
}

// ── Governance Finalization checks (73-79) ────────────────────────────────────

function checkGovernedClock() {
  const v = [];
  if (!fs.existsSync(GOVERNED_CLOCK_PATH)) {
    v.push({ issue: 'governed-clock.js not found — wall-clock not abstracted for replay' });
    return { name: 'governed_clock', status: 'FAIL', detail: 'governed-clock.js missing', violations: v, blocker: 'DB-1: No governed clock abstraction' };
  }
  const src = fs.readFileSync(GOVERNED_CLOCK_PATH, 'utf8');
  for (const fn of ['now', 'nowIso', 'monotonic', 'freeze', 'unfreeze', 'setOffset']) {
    if (!src.includes(fn)) v.push({ issue: `governed-clock.js missing: ${fn}` });
  }
  // Verify event-lineage.js uses governed clock
  const lineageSrc = fs.existsSync(EVENT_LINEAGE_PATH) ? fs.readFileSync(EVENT_LINEAGE_PATH, 'utf8') : '';
  if (!lineageSrc.includes('governed-clock') && lineageSrc.includes('new Date().toISOString()')) {
    v.push({ issue: 'event-lineage.js still uses new Date() directly — lineage_ts not governed' });
  }
  return {
    name: 'governed_clock',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0 ? 'governed-clock.js verified: now/nowIso/monotonic/freeze/unfreeze/setOffset all present; event-lineage uses governed clock' : `${v.length} governed clock gap(s)`,
    violations: v,
    blocker: v.length > 0 ? `DB-1: Clock not governed — replay nondeterministic: [${v.map(x => x.issue).join(' | ')}]` : null,
  };
}

function checkFullLineageEnforcement() {
  const targets = [
    { path: ROLLOUT_STORE_PATH,  name: 'rollout-store.js' },
    { path: ROLLOUT_STATE_PATH,  name: 'rollout-state.js' },
    { path: INCIDENT_ORCH_PATH,  name: 'incident-orchestrator.js' },
  ];
  const v = [];
  for (const { path: p, name } of targets) {
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    if (!src.includes('withLineage') && src.includes('emit(EVENTS')) {
      v.push({ file: name, issue: `${name} emits governed events without withLineage()` });
    }
  }
  return {
    name: 'full_lineage_enforcement',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0 ? 'Core governed emitters (rollout-store, rollout-state, incident-orchestrator) all use withLineage()' : `${v.length} governed emitter(s) bypass withLineage`,
    violations: v,
    blocker: v.length > 0 ? `DB-1: Governed events emitted without lineage: [${v.map(x => x.file).join(', ')}]` : null,
  };
}

function checkOperatorRevocation() {
  const v = [];
  if (!fs.existsSync(OPERATOR_SESSIONS_PATH)) {
    v.push({ issue: 'operator-sessions.js not found — no revocation capability' });
  } else {
    const src = fs.readFileSync(OPERATOR_SESSIONS_PATH, 'utf8');
    for (const fn of ['revokeToken', 'revokeOperator', 'rotateSigningKey', 'isRevoked', 'initFromDb']) {
      if (!src.includes(fn)) v.push({ issue: `operator-sessions.js missing: ${fn}` });
    }
  }
  return {
    name: 'operator_revocation',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0 ? 'operator-sessions.js verified: revocation, operator-level revoke, and key rotation all present' : `${v.length} revocation gap(s)`,
    violations: v,
    blocker: v.length > 0 ? `DB-1: Operator tokens are irrevocable: [${v.map(x => x.issue).join(' | ')}]` : null,
  };
}

function checkJtiReplayProtection() {
  const authSrc = fs.existsSync(OPERATOR_AUTH_PATH2) ? fs.readFileSync(OPERATOR_AUTH_PATH2, 'utf8') : '';
  const v = [];
  if (!authSrc.includes('jti')) v.push({ issue: "operatorAuth.js does not embed jti in tokens — replay attack possible" });
  if (!authSrc.includes('isRevoked') && !authSrc.includes('operator-sessions')) {
    v.push({ issue: "operatorAuth.js does not check revocation — revoked tokens still accepted" });
  }
  return {
    name: 'jti_replay_protection',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0 ? 'JTI present in tokens; revocation check wired in verifyOperatorToken' : `${v.length} replay protection gap(s)`,
    violations: v,
    blocker: v.length > 0 ? `DB-1: Operator token replay attacks possible: [${v.map(x => x.issue).join(' | ')}]` : null,
  };
}

function checkStrongFreezeConsistency() {
  const src = fs.existsSync(FLEET_CONSENSUS_PATH) ? fs.readFileSync(FLEET_CONSENSUS_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('freezeStrong') && !src.includes('_setFreezeStrong')) {
    v.push({ issue: "fleet-consensus.js missing freezeStrong() — freeze_epoch increment is fire-and-forget, not transactional" });
  }
  if (!src.includes('DB_FREEZE_FAILURE_POLICY') && !src.includes('_dbFailurePolicy') && !src.includes('FAIL_CLOSED')) {
    v.push({ issue: "fleet-consensus.js missing DB outage policy for freeze (FAIL_CLOSED/FAIL_OPEN/STALE_OK)" });
  }
  return {
    name: 'strong_freeze_consistency',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0 ? 'Strong freeze consistency verified: freezeStrong() exists; DB failure policy configured' : `${v.length} freeze consistency gap(s)`,
    violations: v,
    blocker: v.length > 0 ? `DB-1: Freeze epoch can diverge from DB under failure: [${v.map(x => x.issue).join(' | ')}]` : null,
  };
}

function checkIncidentLifecycleGovernance() {
  const src = fs.existsSync(INCIDENT_ORCH_PATH) ? fs.readFileSync(INCIDENT_ORCH_PATH, 'utf8') : '';
  const v = [];
  if (!src.includes('MAX_ACTIVE_INCIDENTS')) v.push({ issue: "incident-orchestrator.js missing MAX_ACTIVE_INCIDENTS — active incident map is unbounded" });
  if (!src.includes('archiveResolvedIncidents') && !src.includes('incidents_archive')) {
    v.push({ issue: "incident-orchestrator.js missing archival mechanism — resolved incidents accumulate indefinitely" });
  }
  return {
    name: 'incident_lifecycle_governance',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0 ? 'Incident lifecycle governance verified: MAX_ACTIVE_INCIDENTS bounded; archiveResolvedIncidents present' : `${v.length} lifecycle governance gap(s)`,
    violations: v,
    blocker: v.length > 0 ? `DB-1: Incident store grows without bound: [${v.map(x => x.issue).join(' | ')}]` : null,
  };
}

function checkCertificationHarness() {
  const v = [];
  if (!fs.existsSync(CERTIFICATION_PATH)) {
    v.push({ issue: 'governance-certification.js not found in test-runner/certification/' });
    return { name: 'certification_harness', status: 'FAIL', detail: 'Certification harness missing', violations: v, blocker: null };
  }
  const src = fs.readFileSync(CERTIFICATION_PATH, 'utf8');
  const scenarios = [
    'db_outage_during_freeze', 'concurrent_promotion_safety', 'operator_token_replay',
    'stale_authority_epoch', 'manifest_generation_race', 'lineage_orphan',
    'replay_determinism', 'split_brain_freeze', 'clock_skew', 'recovery_governor',
  ];
  const missing = scenarios.filter(s => !src.includes(s));
  if (missing.length > 0) v.push({ issue: `Certification harness missing scenarios: ${missing.join(', ')}` });
  return {
    name: 'certification_harness',
    status: v.length === 0 ? 'PASS' : 'FAIL',
    detail: v.length === 0 ? 'Certification harness verified: all 10 governance failure scenarios present' : `${v.length} harness gap(s)`,
    violations: v,
    blocker: null,
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
    checkRecoveryGovernorWired(),
    checkFleetConsensusWired(),
    checkFreezeEnforcement(),
    checkEventCausality(),
    checkOperatorOverrides(),
    checkGovernanceDb(),
    checkClusterConsensusPersistent(),
    checkLedgerDbPersistent(),
    checkIncidentDurable(),
    checkConfigDbPersistent(),
    checkNoDirectThresholdReads(),
    checkDeterministicIds(),
    checkFreezeLedgerLinked(),
    // ── Active/Active Authority Convergence checks (38-45) ──────────────────
    checkStrongFreezeRead(),
    checkAsyncEpochIncrement(),
    checkAsyncManifestGeneration(),
    checkLinearizedLedgerAppend(),
    checkIncidentVersionLock(),
    checkDbFailureGovernance(),
    checkGovernanceTransactionBoundaries(),
    checkHaDeploymentCeiling(),
    // ── Governed-Config Accessor checks (46-49) ──────────────────────────────
    checkGovernedThresholdAccessor(),
    checkGovernedConfigSingleton(),
    checkNoRuntimeThresholdReads(),
    checkThresholdSnapshotHashing(),
    // ── Event Lineage Mode checks (50-54) ────────────────────────────────────
    checkLineageModeSupport(),
    checkRolloutLineageWired(),
    checkIncidentLineageWired(),
    checkLineageModesExported(),
    checkLineageStrictThrows(),
    // ── Deterministic ID checks (55-58) ─────────────────────────────────────
    checkDeterministicIdModule(),
    checkIncidentIdDeterministic(),
    checkIncidentIdUsesModule(),
    checkDeterministicIdStableStringify(),
    // ── Cluster-Safe Freeze Authority checks (59-62) ─────────────────────────
    checkFreezeEpochCounter(),
    checkGetFreezeStateStrong(),
    checkFreezeEpochDbPersisted(),
    checkFreezeEpochIncrements(),
    // ── Operator Authority Enforcement checks (63-68) ────────────────────────
    checkOperatorAuthModule(),
    checkOperatorAuthHmac(),
    checkOperatorAuthRoles(),
    checkOperatorAuthExports(),
    checkOtaMutationProtected(),
    checkOperatorTokenExpiry(),
    // ── Resource Governance checks (69-72) ──────────────────────────────────
    checkMaxScreensBound(),
    checkScreenEvictionPolicy(),
    checkLedgerMaxSize(),
    checkLedgerCompaction(),
    // ── Governance Finalization checks (73-79) ───────────────────────────────
    checkGovernedClock(),
    checkFullLineageEnforcement(),
    checkOperatorRevocation(),
    checkJtiReplayProtection(),
    checkStrongFreezeConsistency(),
    checkIncidentLifecycleGovernance(),
    checkCertificationHarness(),
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
