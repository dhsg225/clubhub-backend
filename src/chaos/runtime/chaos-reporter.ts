/**
 * Chaos reporter — generates and writes chaos run reports.
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 *
 * The reporter is observational: it reads ChaosExecutionResult[] and produces
 * a ChaosRunReport. It does not modify scenario results or invariant outputs.
 *
 * Note: writeChaosReport() uses Node.js fs module. It must only be called
 * from CLI scripts, never from PRE resolution paths.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ChaosExecutionResult } from '../types';
import { fnv1a32 } from '../../pre/algorithms/fnv1a32';
import { canonicalizeJson } from '../../pre/algorithms/canonicalize-json';

// ─── Report Types ─────────────────────────────────────────────────────────────

export interface ChaosRunReport {
  /** Unique run identifier: fnv1a32 of (executed_at + scenario_ids) */
  run_id:                string;
  /** UTC ms when this run was executed */
  executed_at:           number;
  total_scenarios:       number;
  passed:                number;
  failed:                number;
  execution_errors:      number;
  results:               ChaosExecutionResult[];
  /** PASS if all scenarios passed; FAIL otherwise */
  constitutional_status: 'PASS' | 'FAIL';
  /** Human-readable summary line */
  summary:               string;
  /** Total duration across all scenarios (ms) */
  total_execution_ms:    number;
}

// ─── Report Generation ────────────────────────────────────────────────────────

/**
 * Generate a ChaosRunReport from a list of scenario results.
 * Uses the `executed_at` from the first result's telemetry.started_at.
 */
export function generateChaosReport(
  results: ChaosExecutionResult[],
  executedAt: number
): ChaosRunReport {
  const passed         = results.filter(r => r.status === 'PASS').length;
  const failed         = results.filter(r => r.status === 'FAIL').length;
  const executionErrors = results.filter(r => r.status === 'EXECUTION_ERROR').length;
  const totalMs        = results.reduce((sum, r) => sum + r.execution_ms, 0);

  const constitutionalStatus: 'PASS' | 'FAIL' = (failed === 0 && executionErrors === 0)
    ? 'PASS'
    : 'FAIL';

  const scenarioIds = results.map(r => r.scenario_id).join(',');
  const runId = fnv1a32(canonicalizeJson({ executed_at: executedAt, scenarios: scenarioIds }));

  const summary = constitutionalStatus === 'PASS'
    ? `CHAOS RUN PASSED: ${passed}/${results.length} scenarios. Constitutional guarantees verified.`
    : `CHAOS RUN FAILED: ${passed} passed, ${failed} failed, ${executionErrors} errors. ` +
      `Constitutional violations detected.`;

  return {
    run_id:                runId,
    executed_at:           executedAt,
    total_scenarios:       results.length,
    passed,
    failed,
    execution_errors:      executionErrors,
    results,
    constitutional_status: constitutionalStatus,
    summary,
    total_execution_ms:    totalMs,
  };
}

/**
 * Write a ChaosRunReport to disk as JSON.
 * Creates the output directory if it does not exist.
 * Writes both chaos-report.json (latest) and chaos-report-{run_id}.json (archived).
 */
export function writeChaosReport(report: ChaosRunReport, outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const content = JSON.stringify(report, null, 2);

  // Latest report (overwritten on each run)
  const latestPath = path.join(outputDir, 'chaos-report.json');
  fs.writeFileSync(latestPath, content, 'utf8');

  // Archived report (keyed by run_id)
  const archivedPath = path.join(outputDir, `chaos-report-${report.run_id}.json`);
  fs.writeFileSync(archivedPath, content, 'utf8');
}

/**
 * Print a chaos report summary to stdout.
 * Uses plain text (no color codes) for CI compatibility.
 */
export function printChaosReportSummary(report: ChaosRunReport): void {
  console.log('\n=== CHAOS RUN REPORT ===');
  console.log(`Run ID:   ${report.run_id}`);
  console.log(`Status:   ${report.constitutional_status}`);
  console.log(`Results:  ${report.passed} passed / ${report.failed} failed / ${report.execution_errors} errors`);
  console.log(`Duration: ${report.total_execution_ms}ms total`);
  console.log('');

  for (const result of report.results) {
    const icon = result.status === 'PASS' ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${result.scenario_id} — ${result.scenario_name}`);

    if (result.status !== 'PASS') {
      // Print failed assertions
      for (const a of result.assertion_results) {
        if (!a.passed) {
          console.log(`         ASSERTION FAIL: ${a.assertion}`);
          if (a.detail) {
            console.log(`           ${a.detail}`);
          }
        }
      }
      // Print invariant violations
      for (const inv of result.invariant_results) {
        if (!inv.passed) {
          console.log(`         INVARIANT FAIL: ${inv.invariantId} [${inv.severity}]: ${inv.message}`);
        }
      }
      if (result.error) {
        console.log(`         ERROR: ${result.error}`);
      }
    }
  }

  console.log('');
  console.log(report.summary);
  console.log('=========================\n');
}
