/**
 * Chaos smoke run script — runs all 7 chaos scenarios and writes the report.
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 *
 * Usage:
 *   npx ts-node scripts/run-chaos.ts
 *
 * Exit codes:
 *   0 — all scenarios passed (constitutional_status === 'PASS')
 *   1 — at least one scenario failed or errored (constitutional_status === 'FAIL')
 *
 * Output:
 *   chaos-output/chaos-report.json          — latest report (overwritten)
 *   chaos-output/chaos-report-{run_id}.json — archived report
 */

import {
  runAllChaosScenarios,
} from '../src/chaos/runtime/chaos-runner';
import {
  generateChaosReport,
  writeChaosReport,
  printChaosReportSummary,
} from '../src/chaos/runtime/chaos-reporter';
import {
  buildMinimalState,
  buildCampaignState,
  buildEmergencyState,
  buildOverrideState,
} from '../src/chaos/fixtures/degraded-state-factory';
import { runChaosScenario, ALL_CHAOS_SCENARIOS } from '../src/chaos/runtime/chaos-runner';
import { CHAOS_REPORT_DIR } from '../src/chaos/constants';
import type { ChaosExecutionResult } from '../src/chaos/types';

// ─── Evaluation timestamp ────────────────────────────────────────────────────
// Use a fixed past timestamp for reproducible CI runs
// This aligns with the corpus fixture timestamp
const AT = 1_748_390_400_000;

console.log('=== ClubHub TV — Chaos Smoke Run ===');
console.log(`Timestamp: ${AT} (${new Date(AT).toISOString()})`);
console.log(`Scenarios: ${ALL_CHAOS_SCENARIOS.length}`);
console.log('');

// ─── Build base states ───────────────────────────────────────────────────────

const minimalState   = buildMinimalState();
const campaignState  = buildCampaignState(AT);
const emergencyState = buildEmergencyState(AT);
const overrideState  = buildOverrideState(AT);

// ─── Run scenarios with appropriate base states ───────────────────────────────
// Each scenario uses the base state most relevant to its degradation class

const scenario001 = ALL_CHAOS_SCENARIOS[0]!;  // CHAOS-001: Backend Restart
const scenario002 = ALL_CHAOS_SCENARIOS[1]!;  // CHAOS-002: DB Restart
const scenario003 = ALL_CHAOS_SCENARIOS[2]!;  // CHAOS-003: Cache Loss
const scenario004 = ALL_CHAOS_SCENARIOS[3]!;  // CHAOS-004: Event Bus Lag
const scenario005 = ALL_CHAOS_SCENARIOS[4]!;  // CHAOS-005: Clock Skew
const scenario006 = ALL_CHAOS_SCENARIOS[5]!;  // CHAOS-006: Poll Storm
const scenario007 = ALL_CHAOS_SCENARIOS[6]!;  // CHAOS-007: Emergency Poll Storm

const results: ChaosExecutionResult[] = [
  runChaosScenario(scenario001, minimalState,   AT),  // minimal: no delivery log
  runChaosScenario(scenario002, campaignState,  AT),  // campaign: schedules to make stale
  runChaosScenario(scenario003, campaignState,  AT),  // campaign: content to clear
  runChaosScenario(scenario004, overrideState,  AT),  // override: lag the override
  runChaosScenario(scenario005, campaignState,  AT),  // campaign: schedules to expire
  runChaosScenario(scenario006, campaignState,  AT),  // campaign: poll storm
  runChaosScenario(scenario007, emergencyState, AT),  // emergency: poll storm
];

// ─── Print per-scenario status ────────────────────────────────────────────────

for (const result of results) {
  const status = result.status === 'PASS' ? 'PASS' : 'FAIL';
  const invStatus = result.all_invariants_pass ? 'INV:PASS' : 'INV:FAIL';
  const assertStatus = result.all_assertions_pass ? 'ASSERT:PASS' : 'ASSERT:FAIL';
  console.log(`  [${status}] ${result.scenario_id} — ${result.scenario_name} | ${invStatus} | ${assertStatus}`);
}

// ─── Generate and write report ────────────────────────────────────────────────

const report = generateChaosReport(results, AT);
writeChaosReport(report, CHAOS_REPORT_DIR);
printChaosReportSummary(report);

// ─── Exit code ────────────────────────────────────────────────────────────────

if (report.constitutional_status === 'FAIL') {
  process.exit(1);
} else {
  process.exit(0);
}
