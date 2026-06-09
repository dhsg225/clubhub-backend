'use strict';
/**
 * FaultInjectionCertification
 *
 * FIC-01: fault-injector.js exists and exports FaultInjector
 * FIC-02: injectClockSkew present
 * FIC-03: injectNetworkPartition present
 * FIC-04: injectReplayCorruption present
 * FIC-05: injectDroppedEvents present
 * FIC-06: injectDelayedConsensus present
 * FIC-07: injectLedgerTampering present
 * FIC-08: restoreAll present (reversibility guarantee)
 * FIC-09: functional — injectClockSkew is reversible
 * FIC-10: functional — injectNetworkPartition is reversible
 * FIC-11: functional — injectLedgerTampering is reversible
 * FIC-12: functional — restoreAll clears all active faults
 */
const fs   = require('fs');
const path = require('path');

const SIM_ROOT = path.resolve(__dirname, '..');

class FaultInjectionCertification {
  async run() {
    const static_checks = [
      this._exists('FIC-01', 'FaultInjector'),
      this._exists('FIC-02', 'injectClockSkew'),
      this._exists('FIC-03', 'injectNetworkPartition'),
      this._exists('FIC-04', 'injectReplayCorruption'),
      this._exists('FIC-05', 'injectDroppedEvents'),
      this._exists('FIC-06', 'injectDelayedConsensus'),
      this._exists('FIC-07', 'injectLedgerTampering'),
      this._exists('FIC-08', 'restoreAll'),
    ];

    const functional_checks = [
      this._clockSkewReversible(),
      this._networkPartitionReversible(),
      this._ledgerTamperReversible(),
      this._restoreAllClearsAll(),
    ];

    const checks = [...static_checks, ...functional_checks];
    return this._result('FaultInjectionCertification', checks);
  }

  // ——— Static ——————————————————————————————————————————————————

  _exists(id, marker) {
    const fp   = path.join(SIM_ROOT, 'fault-injector.js');
    const desc = `fault-injector.js has ${marker}`;
    if (!fs.existsSync(fp)) return { id, description: desc, status: 'FAIL', detail: 'fault-injector.js missing' };
    const src = fs.readFileSync(fp, 'utf8');
    if (!src.includes(marker)) return { id, description: desc, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description: desc, status: 'PASS', detail: null };
  }

  // ——— Functional ——————————————————————————————————————————————

  _clockSkewReversible() {
    const id   = 'FIC-09';
    const desc = 'injectClockSkew is reversible';
    try {
      const { FaultInjector } = require('../fault-injector');
      const fi   = new FaultInjector();
      const node = { id: 'test_node', clockOffset: 0 };
      const { restore } = fi.injectClockSkew(node, 5000);
      if (node.clockOffset !== 5000) return { id, description: desc, status: 'FAIL', detail: 'skew not applied' };
      restore();
      if (node.clockOffset !== 0) return { id, description: desc, status: 'FAIL', detail: 'skew not restored' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) {
      return { id, description: desc, status: 'FAIL', detail: err.message };
    }
  }

  _networkPartitionReversible() {
    const id   = 'FIC-10';
    const desc = 'injectNetworkPartition is reversible';
    try {
      const { FaultInjector }     = require('../fault-injector');
      const { SimulationEventBus } = require('../simulation-event-bus');
      const { SimulationClock }   = require('../simulation-clock');
      const clock  = new SimulationClock();
      const bus    = new SimulationEventBus(clock);
      const fi     = new FaultInjector();
      const { restore } = fi.injectNetworkPartition(bus, 'nodeA', 'nodeB');
      if (!bus.isPartitioned('nodeA', 'nodeB')) return { id, description: desc, status: 'FAIL', detail: 'partition not applied' };
      restore();
      if (bus.isPartitioned('nodeA', 'nodeB')) return { id, description: desc, status: 'FAIL', detail: 'partition not removed' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) {
      return { id, description: desc, status: 'FAIL', detail: err.message };
    }
  }

  _ledgerTamperReversible() {
    const id   = 'FIC-11';
    const desc = 'injectLedgerTampering is reversible';
    try {
      const { FaultInjector }     = require('../fault-injector');
      const { SimulationCluster } = require('../simulation-cluster');
      const { SimulationClock }   = require('../simulation-clock');
      const { SimulationEventBus } = require('../simulation-event-bus');
      const clock    = new SimulationClock();
      const eventBus = new SimulationEventBus(clock);
      const cluster  = new SimulationCluster({ seed: 99, nodeCount: 1, clock, eventBus });
      const node     = cluster.getNode('node_0');

      node.appendLedgerEntry({ type: 'TEST', value: 'alpha' });
      node.appendLedgerEntry({ type: 'TEST', value: 'beta' });

      const original_hash = node.ledger.entries[0].hash;
      const fi   = new FaultInjector();
      const { restore, tampered } = fi.injectLedgerTampering(node.ledger, 0);

      if (!tampered) return { id, description: desc, status: 'FAIL', detail: 'tamper flag not set' };
      if (node.ledger.entries[0].hash === original_hash) return { id, description: desc, status: 'FAIL', detail: 'tamper not applied' };

      restore();
      if (node.ledger.entries[0].hash !== original_hash) return { id, description: desc, status: 'FAIL', detail: 'tamper not reverted' };

      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) {
      return { id, description: desc, status: 'FAIL', detail: err.message };
    }
  }

  _restoreAllClearsAll() {
    const id   = 'FIC-12';
    const desc = 'restoreAll() clears all active faults';
    try {
      const { FaultInjector }     = require('../fault-injector');
      const { SimulationEventBus } = require('../simulation-event-bus');
      const { SimulationClock }   = require('../simulation-clock');
      const clock = new SimulationClock();
      const bus   = new SimulationEventBus(clock);
      const fi    = new FaultInjector();
      const nodeA = { id: 'nA', clockOffset: 0 };
      const nodeB = { id: 'nB', clockOffset: 0 };

      fi.injectClockSkew(nodeA, 1000);
      fi.injectClockSkew(nodeB, 2000);
      fi.injectNetworkPartition(bus, 'nA', 'nB');

      if (fi.getActiveFaultCount() !== 3) {
        return { id, description: desc, status: 'FAIL', detail: `expected 3 active faults, got ${fi.getActiveFaultCount()}` };
      }
      fi.restoreAll();
      if (fi.getActiveFaultCount() !== 0) {
        return { id, description: desc, status: 'FAIL', detail: `expected 0 active faults after restoreAll, got ${fi.getActiveFaultCount()}` };
      }
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) {
      return { id, description: desc, status: 'FAIL', detail: err.message };
    }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { FaultInjectionCertification };
