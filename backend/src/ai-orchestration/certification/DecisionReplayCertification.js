'use strict';
/**
 * DecisionReplayCertification
 *
 * DRC-01: decision-trace.js exists and exports DecisionTrace
 * DRC-02: DecisionTrace has create() + finalize()
 * DRC-03: DecisionTrace has verifyChain()
 * DRC-04: DecisionTrace has static rebuild()
 * DRC-05: decision-trace.js has prev_hash (hash chain field)
 * DRC-06: decision-trace.js has replay_hash
 * DRC-07: functional — finalized entry has valid replay_hash
 * DRC-08: functional — chain verifyChain() passes after multiple entries
 * DRC-09: functional — rebuild() reconstructs valid trace from entries
 * DRC-10: functional — tampered replay_hash breaks chain verification
 * DRC-11: functional — OrchestrationRuntime.runReplay() matches original decisions
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

class DecisionReplayCertification {
  async run() {
    const static_checks = [
      this._file_has('DRC-01', 'decision-trace.js', 'DecisionTrace',  'decision-trace.js exports DecisionTrace'),
      this._file_has('DRC-02', 'decision-trace.js', 'finalize',       'DecisionTrace has create() + finalize()'),
      this._file_has('DRC-03', 'decision-trace.js', 'verifyChain',    'DecisionTrace has verifyChain()'),
      this._file_has('DRC-04', 'decision-trace.js', 'rebuild',        'DecisionTrace has static rebuild()'),
      this._file_has('DRC-05', 'decision-trace.js', 'prev_hash',      'decision-trace has prev_hash (chain)'),
      this._file_has('DRC-06', 'decision-trace.js', 'replay_hash',    'decision-trace has replay_hash'),
    ];

    const functional_checks = [
      this._finalized_has_hash(),
      this._chain_passes(),
      this._rebuild_valid(),
      this._tamper_breaks_chain(),
      await this._replay_matches_original(),
    ];

    return this._result('DecisionReplayCertification', [...static_checks, ...functional_checks]);
  }

  // ——— Static ———————————————————————————————————————————————————

  _file_has(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  // ——— Helpers ——————————————————————————————————————————————————

  _makeTrace() {
    const { DecisionTrace } = require('../decision-trace');
    return new DecisionTrace();
  }

  _addEntry(dt, overrides = {}) {
    const id = dt.create({
      agent_id:        'cert_agent',
      workflow_id:     'wf_drc',
      proposed_action: { action_type: 'APPEND_AUDIT', args: {} },
      context:         { frozen: false, epoch: 1 },
      lineage_ts:      1_700_000_000_000,
      ...overrides,
    });
    dt.recordPolicy(id, { result: 'APPROVED', policy_id: 'allow_all', reason: 'policy_allow' });
    return dt.finalize(id, { status: 'COMPLETED' });
  }

  // ——— Functional ———————————————————————————————————————————————

  _finalized_has_hash() {
    const id = 'DRC-07'; const desc = 'finalized entry has valid replay_hash';
    try {
      const dt = this._makeTrace();
      const entry = this._addEntry(dt);
      if (!entry.replay_hash || entry.replay_hash.length !== 64)
        return { id, description: desc, status: 'FAIL', detail: `hash: ${entry.replay_hash}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _chain_passes() {
    const id = 'DRC-08'; const desc = 'verifyChain() passes after multiple entries';
    try {
      const dt = this._makeTrace();
      this._addEntry(dt);
      this._addEntry(dt);
      this._addEntry(dt);
      const result = dt.verifyChain();
      if (!result.valid) return { id, description: desc, status: 'FAIL', detail: `chain broken at ${result.broken_at}: ${result.reason}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _rebuild_valid() {
    const id = 'DRC-09'; const desc = 'rebuild() reconstructs valid trace from entries';
    try {
      const { DecisionTrace } = require('../decision-trace');
      const dt = this._makeTrace();
      this._addEntry(dt);
      this._addEntry(dt);
      const entries = dt.getFinalized();
      const { valid, trace } = DecisionTrace.rebuild(entries);
      if (!valid || !trace) return { id, description: desc, status: 'FAIL', detail: 'rebuild failed' };
      const recheck = trace.verifyChain();
      if (!recheck.valid) return { id, description: desc, status: 'FAIL', detail: `rebuilt chain broken: ${recheck.reason}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _tamper_breaks_chain() {
    const id = 'DRC-10'; const desc = 'tampered replay_hash breaks verifyChain()';
    try {
      const dt = this._makeTrace();
      this._addEntry(dt);
      this._addEntry(dt);
      // Tamper first entry
      dt._entries[0].replay_hash = 'TAMPERED_' + dt._entries[0].replay_hash;
      const result = dt.verifyChain();
      if (result.valid) return { id, description: desc, status: 'FAIL', detail: 'tampered chain was accepted' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _replay_matches_original() {
    const id = 'DRC-11'; const desc = 'OrchestrationRuntime.runReplay() matches original decisions (H3)';
    try {
      const { OrchestrationRuntime } = require('../orchestration-runtime');
      const { PolicyEngine }         = require('../policy-engine');
      const { DecisionTrace }        = require('../decision-trace');
      const { BoundedExecutor }      = require('../bounded-executor');

      const pe = new PolicyEngine();
      pe.loadPolicies([{ id: 'allow_all', name: 'allow_all', priority: 1, action: 'allow', conditions: [] }]);

      const dt = this._makeTrace();
      this._addEntry(dt);
      this._addEntry(dt);
      const entries = dt.getFinalized();

      const rt = new OrchestrationRuntime({
        sdkClient:       { execute: async () => ({ result: 'ok' }) },
        clock:           { now: () => 1_700_000_000_000 },
        policyEngine:    pe,
        decisionTrace:   new DecisionTrace(),
        boundedExecutor: new BoundedExecutor(),
      });

      const replay = await rt.runReplay(entries, { frozen: false });
      if (!replay.valid)
        return { id, description: desc, status: 'FAIL', detail: `mismatches: ${JSON.stringify(replay.mismatches)}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { DecisionReplayCertification };
