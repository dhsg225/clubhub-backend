/**
 * Chaos execution type definitions.
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 *
 * These types define the exact interfaces for chaos scenario execution,
 * degraded state representation, and constitutional verification under
 * failure conditions.
 *
 * CRITICAL CONSTRAINTS:
 *   - All degraded states MUST be built deterministically (no Math.random())
 *   - All fault injection MUST be documented in injected_faults
 *   - Chaos OBSERVES and REPORTS — it never mutates resolution behavior
 *   - Two PRE.resolve() calls per scenario verify hash stability
 */

import type { PRE_Input, PRE_Output, SystemStateSnapshot } from '../pre/types';
import type { InvariantResult } from '../verification/invariants/types';

// ─── Scenario Identifiers ─────────────────────────────────────────────────────

export type ChaosScenarioId =
  | 'CHAOS-001'
  | 'CHAOS-002'
  | 'CHAOS-003'
  | 'CHAOS-004'
  | 'CHAOS-005'
  | 'CHAOS-006'
  | 'CHAOS-007';

// ─── Degradation Classes ──────────────────────────────────────────────────────

export type DegradationClass =
  | 'BACKEND_RESTART'
  | 'DB_RESTART_STALE_READ'
  | 'CACHE_LOSS'
  | 'EVENT_BUS_LAG'
  | 'CLOCK_SKEW'
  | 'POLL_STORM'
  | 'EMERGENCY_DURING_POLL_STORM';

// ─── Degraded Condition ───────────────────────────────────────────────────────

export interface DegradedCondition {
  /** Degradation class identifier */
  class: DegradationClass;
  /** Human-readable description of what was degraded */
  description: string;
  /** Explicit list of all faults injected — reproducible */
  injected_faults: string[];
  /** Simulated timestamp at which fault was injected */
  fault_at: number;
}

// ─── Chaos Scenario ───────────────────────────────────────────────────────────

export interface ChaosScenario {
  id: ChaosScenarioId;
  name: string;
  description: string;
  degradation_class: DegradationClass;
  /**
   * Build the degraded SystemStateSnapshot deterministically.
   * MUST NOT mutate baseState — always copy with spread.
   * MUST NOT use Math.random() or Date.now().
   */
  buildDegradedState(
    baseState: SystemStateSnapshot,
    at: number
  ): {
    state: SystemStateSnapshot;
    conditions: DegradedCondition;
  };
  /** What degraded behavior is expected from PRE.resolve() */
  expectedBehavior: {
    resolution_level: number | 'any';
    is_fallback: boolean | 'any';
    invariants_pass: boolean;
    reason_trace_explainable: boolean;
    /** Specific named assertions this scenario must verify */
    assertions: string[];
  };
}

// ─── Execution Results ────────────────────────────────────────────────────────

export interface ChaosExecutionResult {
  scenario_id: ChaosScenarioId;
  scenario_name: string;
  degradation_class: DegradationClass;
  conditions: DegradedCondition;
  pre_input: PRE_Input;
  pre_output: PRE_Output | null;
  output_hash: string | null;
  invariant_results: InvariantResult[];
  all_invariants_pass: boolean;
  assertion_results: AssertionResult[];
  all_assertions_pass: boolean;
  execution_ms: number;
  replay_artifact: ChaosReplayArtifact;
  telemetry: ChaosTelemetryEnvelope;
  status: 'PASS' | 'FAIL' | 'EXECUTION_ERROR';
  error?: string | undefined;
}

// ─── Assertion Results ────────────────────────────────────────────────────────

export interface AssertionResult {
  assertion: string;
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
  detail?: string;
}

// ─── Invariant Report ─────────────────────────────────────────────────────────

export interface ChaosInvariantReport {
  scenario_id: ChaosScenarioId;
  invariants_checked: number;
  invariants_passed: number;
  violations: InvariantResult[];
}

// ─── Replay Artifact ──────────────────────────────────────────────────────────

export interface ChaosReplayArtifact {
  scenario_id: ChaosScenarioId;
  /** FNV-1a 32-bit hash of the canonical PRE_Input */
  input_hash: string;
  /** FNV-1a 32-bit hash of first PRE_Output (null if execution errored) */
  output_hash: string | null;
  /** FNV-1a 32-bit hash of canonicalizeJson(conditions) */
  conditions_hash: string;
  /** First run output hash */
  run_1_output_hash: string | null;
  /** Second run output hash (determinism check) */
  run_2_output_hash: string | null;
  /** True when run_1 === run_2 (PRE is pure) */
  hashes_stable: boolean;
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface ChaosTelemetryEnvelope {
  scenario_started_at: number;
  scenario_completed_at: number;
  events: ChaosEvent[];
}

export type ChaosEvent =
  | { type: 'chaos_scenario_started';       scenario_id: ChaosScenarioId; at: number }
  | { type: 'chaos_scenario_completed';     scenario_id: ChaosScenarioId; status: string; at: number }
  | { type: 'chaos_invariant_failed';       scenario_id: ChaosScenarioId; invariant_id: string; at: number }
  | { type: 'degraded_resolution_detected'; scenario_id: ChaosScenarioId; resolution_level: number; is_fallback: boolean; at: number }
  | { type: 'stale_data_window_detected';   scenario_id: ChaosScenarioId; stale_fields: string[]; at: number }
  | { type: 'replay_divergence_detected';   scenario_id: ChaosScenarioId; hash_1: string; hash_2: string; at: number }
  | { type: 'fallback_resolution_used';     scenario_id: ChaosScenarioId; reason: string; at: number };
