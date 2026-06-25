'use strict';
/**
 * AdversarialReplayCertification
 *
 * ARC-01: adversarial-replay.js has runAdversarialSuite
 * ARC-02: adversarial-replay.js has replayDuringFreeze
 * ARC-03: adversarial-replay.js has replayDuplicatedWorkflow
 * ARC-04: functional — runAdversarialSuite returns PASS rating
 * ARC-05: functional — replayDuringFreeze completes without mutating freeze
 * ARC-06: functional — workflow collision detected
 * ARC-07: scenarios/freeze_split_brain.js exports SCENARIO_ID and run()
 * ARC-08: scenarios/incident_storm.js exports SCENARIO_ID and run()
 * ARC-09: scenario run() — freeze_split_brain reports divergence
 * ARC-10: scenario run() — incident_storm records all incidents
 */
const fs   = require('fs');
const path = require('path');

const SIM_ROOT = path.resolve(__dirname, '..');

class AdversarialReplayCertification {
  async run() {
    const static_checks = [
      this._exists_in('ARC-01', 'adversarial-replay.js', 'runAdversarialSuite'),
      this._exists_in('ARC-02', 'adversarial-replay.js', 'replayDuringFreeze'),
      this._exists_in('ARC-03', 'adversarial-replay.js', 'replayDuplicatedWorkflow'),
      this._exists_in('ARC-07', 'scenarios/freeze_split_brain.js', 'SCENARIO_ID'),
      this._exists_in('ARC-08', 'scenarios/incident_storm.js', 'run'),
    ];

    const functional_checks = [
      await this._adversarialSuitePass(),
      await this._replayDuringFreezeCheck(),
      await this._workflowCollisionCheck(),
      await this._splitBrainScenarioCheck(),
      await this._incidentStormScenarioCheck(),
    ];

    const checks = [...static_checks, ...functional_checks];
    return this._result('AdversarialReplayCertification', checks);
  }

  // ——— Static ——————————————————————————————————————————————————

  _exists_in(id, file, marker) {
    const fp   = path.join(SIM_ROOT, file);
    const desc = `${file} has ${marker}`;
    if (!fs.existsSync(fp)) return { id, description: desc, status: 'FAIL', detail: `${file} missing` };
    const src = fs.readFileSync(fp, 'utf8');
    if (!src.includes(marker)) return { id, description: desc, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description: desc, status: 'PASS', detail: null };
  }

  // ——— Functional ——————————————————————————————————————————————

  _makeContext() {
    const { AdversarialReplay }  = require('../adversarial-replay');
    const { SimulationCluster }  = require('../simulation-cluster');
    const { SimulationClock }    = require('../simulation-clock');
    const { SimulationEventBus } = require('../simulation-event-bus');
    const clock    = new SimulationClock();
    const eventBus = new SimulationEventBus(clock);
    const cluster  = new SimulationCluster({ seed: 200, nodeCount: 2, clock, eventBus });
    const replayer = new AdversarialReplay(clock, eventBus);
    const raw      = Array.from({ length: 4 }, (_, i) => ({
      event_id:   `arc_evt_${i}`,
      event_type: 'test.cert',
      ts:         1_700_000_000_000 + i * 50,
    }));
    const trace = replayer.buildTrace(raw);
    return { replayer, cluster, trace };
  }

  async _adversarialSuitePass() {
    const id = 'ARC-04'; const desc = 'runAdversarialSuite returns PASS rating';
    try {
      const { replayer, cluster, trace } = this._makeContext();
      const suite = replayer.runAdversarialSuite(trace, cluster);
      if (suite.rating !== 'PASS') {
        const failing = suite.checks.filter(c => c.status === 'FAIL').map(c => c.name);
        return { id, description: desc, status: 'FAIL', detail: `Suite FAIL. Failing: ${failing.join(', ')}` };
      }
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _replayDuringFreezeCheck() {
    const id = 'ARC-05'; const desc = 'replayDuringFreeze completes without mutating freeze state';
    try {
      const { replayer, cluster, trace } = this._makeContext();
      cluster.broadcastFreeze('cert_test', 'node_0');
      const was_frozen = cluster.getNode('node_0').frozen;
      const result     = replayer.replayDuringFreeze(cluster, trace.slice(0, 2));
      const still_frozen = cluster.getNode('node_0').frozen;
      if (!result.completed) return { id, description: desc, status: 'FAIL', detail: 'replay did not complete' };
      if (!was_frozen)       return { id, description: desc, status: 'FAIL', detail: 'freeze was not applied before replay' };
      if (!still_frozen)     return { id, description: desc, status: 'FAIL', detail: 'freeze was mutated by replay' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _workflowCollisionCheck() {
    const id = 'ARC-06'; const desc = 'workflow collision detected by replayDuplicatedWorkflow';
    try {
      const { replayer, cluster } = this._makeContext();
      const result = replayer.replayDuplicatedWorkflow(cluster, 'node_0', 'arc_cert_wf');
      if (!result.rejected) return { id, description: desc, status: 'FAIL', detail: 'duplicate workflow was not rejected' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _splitBrainScenarioCheck() {
    const id = 'ARC-09'; const desc = 'freeze_split_brain scenario reports divergence';
    try {
      const scenario = require('../scenarios/freeze_split_brain');
      const result   = await scenario.run({ seed: 1001 });
      const div_check = result.invariant_checks.find(c => c.id === 'INV-03');
      if (!div_check || div_check.status !== 'PASS') {
        return { id, description: desc, status: 'FAIL', detail: `INV-03 status: ${div_check?.status}` };
      }
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _incidentStormScenarioCheck() {
    const id = 'ARC-10'; const desc = 'incident_storm scenario records all 50 incidents';
    try {
      const scenario = require('../scenarios/incident_storm');
      const result   = await scenario.run({ seed: 1003 });
      const count_check = result.invariant_checks.find(c => c.id === 'INV-01');
      if (!count_check || count_check.status !== 'PASS') {
        return { id, description: desc, status: 'FAIL', detail: `INV-01 status: ${count_check?.status}` };
      }
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { AdversarialReplayCertification };
