'use strict';
/**
 * Simulation Scenario Catalog
 *
 * 10 canonical deterministic adversarial scenarios.
 * All scenarios:
 *   - Accept { seed } parameter (default per scenario)
 *   - Produce deterministic outputs for the same seed
 *   - Return { scenario_id, seed, report, invariant_checks }
 *   - Emit simulation report via SimulationReport
 *   - Declare expected invariants
 */

const freeze_split_brain       = require('./freeze_split_brain');
const concurrent_config_updates = require('./concurrent_config_updates');
const incident_storm           = require('./incident_storm');
const replay_trace_corruption  = require('./replay_trace_corruption');
const ledger_chain_tamper      = require('./ledger_chain_tamper');
const delayed_epoch_propagation = require('./delayed_epoch_propagation');
const plugin_failure_cascade   = require('./plugin_failure_cascade');
const workflow_collision_storm = require('./workflow_collision_storm');
const replay_during_freeze     = require('./replay_during_freeze');
const operator_revocation_race = require('./operator_revocation_race');

const SCENARIOS = Object.freeze({
  freeze_split_brain,
  concurrent_config_updates,
  incident_storm,
  replay_trace_corruption,
  ledger_chain_tamper,
  delayed_epoch_propagation,
  plugin_failure_cascade,
  workflow_collision_storm,
  replay_during_freeze,
  operator_revocation_race,
});

/**
 * Run all 10 scenarios with their default seeds.
 * Returns array of results in deterministic order.
 */
async function runAll(opts = {}) {
  const results = [];
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    try {
      const result = await scenario.run(opts[name] ?? {});
      results.push(result);
    } catch (err) {
      results.push({
        scenario_id:      name,
        seed:             opts[name]?.seed ?? -1,
        error:            err.message,
        invariant_checks: [],
        report:           null,
      });
    }
  }
  return results;
}

/**
 * Run a single named scenario.
 */
async function runScenario(name, opts = {}) {
  const scenario = SCENARIOS[name];
  if (!scenario) throw new Error(`Unknown scenario: ${name}. Available: ${Object.keys(SCENARIOS).join(', ')}`);
  return scenario.run(opts);
}

module.exports = { SCENARIOS, runAll, runScenario };
