'use strict';
/**
 * ClusterPartitionCertification
 *
 * CPC-01: simulation-cluster.js exists and exports SimulationCluster
 * CPC-02: SimulationCluster has broadcastFreeze()
 * CPC-03: SimulationCluster has detectDivergence()
 * CPC-04: SimulationCluster has incrementEpoch()
 * CPC-05: simulation-event-bus.js has addPartition() / removePartition()
 * CPC-06: simulation-event-bus.js has isPartitioned()
 * CPC-07: functional — freeze withheld from partitioned node
 * CPC-08: functional — detectDivergence() returns freeze_diverged=true after split freeze
 * CPC-09: functional — epoch diverged when partition prevents propagation
 * CPC-10: functional — partition removal restores connectivity
 */
const fs   = require('fs');
const path = require('path');

const SIM_ROOT = path.resolve(__dirname, '..');

class ClusterPartitionCertification {
  async run() {
    const static_checks = [
      this._exists_in('CPC-01', 'simulation-cluster.js',   'SimulationCluster'),
      this._exists_in('CPC-02', 'simulation-cluster.js',   'broadcastFreeze'),
      this._exists_in('CPC-03', 'simulation-cluster.js',   'detectDivergence'),
      this._exists_in('CPC-04', 'simulation-cluster.js',   'incrementEpoch'),
      this._exists_in('CPC-05', 'simulation-event-bus.js', 'addPartition'),
      this._exists_in('CPC-06', 'simulation-event-bus.js', 'isPartitioned'),
    ];

    const functional_checks = [
      this._freezeWithheldFromPartitioned(),
      this._detectDivergenceAfterSplitFreeze(),
      this._epochDivergenceOnPartition(),
      this._partitionRemovalRestores(),
    ];

    const checks = [...static_checks, ...functional_checks];
    return this._result('ClusterPartitionCertification', checks);
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

  _makeCluster(nodeCount = 3) {
    const { SimulationCluster }  = require('../simulation-cluster');
    const { SimulationClock }    = require('../simulation-clock');
    const { SimulationEventBus } = require('../simulation-event-bus');
    const { FaultInjector }      = require('../fault-injector');
    const clock    = new SimulationClock();
    const eventBus = new SimulationEventBus(clock);
    const cluster  = new SimulationCluster({ seed: 101, nodeCount, clock, eventBus });
    const fi       = new FaultInjector();
    return { cluster, clock, eventBus, fi };
  }

  _freezeWithheldFromPartitioned() {
    const id = 'CPC-07'; const desc = 'freeze withheld from partitioned node';
    try {
      const { cluster, eventBus, fi } = this._makeCluster();
      const { restore } = fi.injectNetworkPartition(eventBus, 'node_0', 'node_2');
      const { results } = cluster.broadcastFreeze('test', 'node_0');
      restore();
      const withheld = results['node_2'] === 'WITHHELD';
      const applied  = results['node_0'] === 'APPLIED' && results['node_1'] === 'APPLIED';
      if (!withheld) return { id, description: desc, status: 'FAIL', detail: `node_2 result: ${results['node_2']}` };
      if (!applied)  return { id, description: desc, status: 'FAIL', detail: `node_0/1 not applied: ${JSON.stringify(results)}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _detectDivergenceAfterSplitFreeze() {
    const id = 'CPC-08'; const desc = 'detectDivergence returns freeze_diverged=true after split freeze';
    try {
      const { cluster, eventBus, fi } = this._makeCluster();
      const { restore } = fi.injectNetworkPartition(eventBus, 'node_0', 'node_2');
      cluster.broadcastFreeze('test', 'node_0');
      restore();
      const div = cluster.detectDivergence();
      if (!div.freeze_diverged) return { id, description: desc, status: 'FAIL', detail: 'freeze_diverged was false' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _epochDivergenceOnPartition() {
    const id = 'CPC-09'; const desc = 'epoch diverges when partition prevents propagation';
    try {
      const { cluster, eventBus, fi } = this._makeCluster();
      const { restore } = fi.injectNetworkPartition(eventBus, 'node_0', 'node_2');
      cluster.incrementEpoch('node_0');
      restore();
      const div = cluster.detectDivergence();
      if (!div.epoch_diverged) return { id, description: desc, status: 'FAIL', detail: 'epoch_diverged was false' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _partitionRemovalRestores() {
    const id = 'CPC-10'; const desc = 'partition removal restores connectivity';
    try {
      const { eventBus, fi } = this._makeCluster();
      const { restore } = fi.injectNetworkPartition(eventBus, 'node_0', 'node_1');
      if (!eventBus.isPartitioned('node_0', 'node_1')) {
        return { id, description: desc, status: 'FAIL', detail: 'partition not added' };
      }
      restore();
      if (eventBus.isPartitioned('node_0', 'node_1')) {
        return { id, description: desc, status: 'FAIL', detail: 'partition not removed after restore' };
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

module.exports = { ClusterPartitionCertification };
