'use strict';
/**
 * ConvergenceIntegrityCertification
 *
 * CIC-01: convergence-engine.js exists
 * CIC-02: DIVERGENCE_CODES has all required codes
 * CIC-03: functional — detectSubsystemDivergence() finds degraded runtime
 * CIC-04: functional — detectReplayDrift() flags broken chain
 * CIC-05: functional — detectOrphanedWorkflows() finds unlinked workflow
 * CIC-06: functional — detectTopologyMismatch() finds unregistered topology entity
 * CIC-07: functional — runFullScan() returns finding_count
 * CIC-08: functional — getFindings() returns array
 * CIC-09: functional — no mutation — runFullScan called twice same base findings
 * CIC-10: functional — emits platform.convergence.finding event
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

class ConvergenceIntegrityCertification {
  async run() {
    const checks = [
      this._exists('CIC-01', 'convergence-engine.js', 'ConvergenceEngine',    'convergence-engine.js exists'),
      this._exists('CIC-02', 'convergence-engine.js', 'EXECUTION_BYPASS',     'DIVERGENCE_CODES has all required codes'),
      this._divergence_finds_degraded(),
      this._replay_drift_flags_broken_chain(),
      this._orphaned_workflow(),
      this._topology_mismatch(),
      this._full_scan_count(),
      this._get_findings_array(),
      this._no_mutation_double_scan(),
      this._emits_finding_event(),
    ];
    return this._result('ConvergenceIntegrityCertification', checks);
  }

  _exists(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _ce(opts = {}) {
    const { ConvergenceEngine } = require('../convergence-engine');
    return new ConvergenceEngine(opts);
  }

  _divergence_finds_degraded() {
    const id = 'CIC-03'; const desc = 'detectSubsystemDivergence() finds required runtime not READY';
    try {
      const { RuntimeRegistry } = require('../runtime-registry');
      const reg = new RuntimeRegistry();
      reg.register('kernel', {}, { required: true });
      // state defaults to REGISTERED, not READY
      const ce = this._ce({ registry: reg });
      const findings = ce.detectSubsystemDivergence();
      if (findings.length === 0) return { id, description: desc, status: 'FAIL', detail: 'should find degraded kernel' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _replay_drift_flags_broken_chain() {
    const id = 'CIC-04'; const desc = 'detectReplayDrift() flags broken decision chain';
    try {
      const brokenDT = { verifyChain: () => ({ valid: false, broken_at: 0, reason: 'hash_mismatch' }) };
      const ce = this._ce({ decisionTrace: brokenDT });
      const findings = ce.detectReplayDrift();
      if (findings.length === 0) return { id, description: desc, status: 'FAIL', detail: 'should find replay drift' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _orphaned_workflow() {
    const id = 'CIC-05'; const desc = 'detectOrphanedWorkflows() finds unlinked workflow';
    try {
      const { TopologyManager } = require('../topology-manager');
      const tm = new TopologyManager();
      tm.register('wf1', 'WORKFLOW', {});
      // no agent linked
      const ce = this._ce({ topology: tm });
      const findings = ce.detectOrphanedWorkflows();
      if (findings.length === 0) return { id, description: desc, status: 'FAIL', detail: 'should find orphan' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _topology_mismatch() {
    const id = 'CIC-06'; const desc = 'detectTopologyMismatch() finds runtime missing from topology';
    try {
      const { RuntimeRegistry } = require('../runtime-registry');
      const { TopologyManager }  = require('../topology-manager');
      const reg = new RuntimeRegistry();
      reg.register('missing_rt', {}, {});
      const tm = new TopologyManager();
      // missing_rt not in topology
      const ce = this._ce({ registry: reg, topology: tm });
      const findings = ce.detectTopologyMismatch();
      if (findings.length === 0) return { id, description: desc, status: 'FAIL', detail: 'should find mismatch' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _full_scan_count() {
    const id = 'CIC-07'; const desc = 'runFullScan() returns finding_count';
    try {
      const ce   = this._ce();
      const scan = ce.runFullScan();
      if (typeof scan.finding_count !== 'number')
        return { id, description: desc, status: 'FAIL', detail: 'missing finding_count' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _get_findings_array() {
    const id = 'CIC-08'; const desc = 'getFindings() returns array';
    try {
      const ce = this._ce();
      if (!Array.isArray(ce.getFindings()))
        return { id, description: desc, status: 'FAIL', detail: 'not an array' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _no_mutation_double_scan() {
    const id = 'CIC-09'; const desc = 'runFullScan is detection only — no mutation side effects';
    try {
      const ce = this._ce();
      const s1 = ce.runFullScan();
      const s2 = ce.runFullScan();
      // Second scan on empty engine should yield same result
      if (s1.finding_count !== s2.finding_count)
        return { id, description: desc, status: 'FAIL', detail: `s1=${s1.finding_count} s2=${s2.finding_count}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _emits_finding_event() {
    const id = 'CIC-10'; const desc = 'finding emits platform.convergence.finding event';
    try {
      const events = [];
      const bus = { emit: (t) => events.push(t) };
      const { RuntimeRegistry } = require('../runtime-registry');
      const reg = new RuntimeRegistry();
      reg.register('kernel', {}, { required: true });
      const ce = this._ce({ registry: reg, eventBus: bus });
      ce.detectSubsystemDivergence();
      if (!events.includes('platform.convergence.finding'))
        return { id, description: desc, status: 'FAIL', detail: 'event not emitted' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { ConvergenceIntegrityCertification };
