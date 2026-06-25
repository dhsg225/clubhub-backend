'use strict';
/**
 * AIBoundaryCertification
 *
 * ABC-01: bounded-executor.js exists and exports BoundedExecutor
 * ABC-02: BoundedExecutor has check()
 * ABC-03: BoundedExecutor has record()
 * ABC-04: BoundedExecutor has pushDepth() / popDepth()
 * ABC-05: bounded-executor.js has no Date.now() (deterministic)
 * ABC-06: functional — recursion ceiling enforced (H4)
 * ABC-07: functional — session quota enforced (H6)
 * ABC-08: functional — per-minute rate enforced (H6)
 * ABC-09: functional — depth push/pop is balanced
 * ABC-10: functional — explainability.js has no free-form narrative generation
 * ABC-11: functional — Explainability.explainDecision() returns structured object
 * ABC-12: functional — orchestration halts workflow on DENIED step (H8)
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

class AIBoundaryCertification {
  async run() {
    const static_checks = [
      this._file_has('ABC-01', 'bounded-executor.js', 'BoundedExecutor',   'bounded-executor.js exports BoundedExecutor'),
      this._file_has('ABC-02', 'bounded-executor.js', 'check',             'BoundedExecutor has check()'),
      this._file_has('ABC-03', 'bounded-executor.js', 'record',            'BoundedExecutor has record()'),
      this._file_has('ABC-04', 'bounded-executor.js', 'pushDepth',         'BoundedExecutor has pushDepth/popDepth'),
      this._file_no ('ABC-05', 'bounded-executor.js', 'Date.now()',        'bounded-executor.js has no Date.now()'),
    ];

    const functional_checks = [
      this._recursion_ceiling(),
      this._session_quota(),
      this._per_minute_rate(),
      this._depth_balanced(),
      this._no_narrative_generation(),
      this._explain_structured(),
      await this._workflow_halts_on_denied(),
    ];

    return this._result('AIBoundaryCertification', [...static_checks, ...functional_checks]);
  }

  _file_has(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _file_no(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    const src = fs.readFileSync(fp, 'utf8').split('\n')
      .filter(l => { const t = l.trim(); return !t.startsWith('//') && !t.startsWith('*'); })
      .join('\n');
    if (src.includes(marker)) return { id, description, status: 'FAIL', detail: `found forbidden '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _recursion_ceiling() {
    const id = 'ABC-06'; const desc = 'recursion ceiling enforced (H4)';
    try {
      const { BoundedExecutor } = require('../bounded-executor');
      const be = new BoundedExecutor({ max_depth: 3 });
      const r  = be.check('agent_a', 'APPEND_AUDIT', 1_700_000_000_000, 4);
      if (r.result !== 'RECURSION_CEILING')
        return { id, description: desc, status: 'FAIL', detail: `got ${r.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _session_quota() {
    const id = 'ABC-07'; const desc = 'session quota enforced (H6)';
    try {
      const { BoundedExecutor } = require('../bounded-executor');
      const be = new BoundedExecutor({ session_quota: 2 });
      be.record('agent_b', 1_700_000_000_001);
      be.record('agent_b', 1_700_000_000_002);
      const r = be.check('agent_b', 'APPEND_AUDIT', 1_700_000_000_003, 0);
      if (r.result !== 'QUOTA_EXCEEDED')
        return { id, description: desc, status: 'FAIL', detail: `got ${r.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _per_minute_rate() {
    const id = 'ABC-08'; const desc = 'per-minute rate enforced (H6)';
    try {
      const { BoundedExecutor } = require('../bounded-executor');
      const be  = new BoundedExecutor({ max_per_minute: 3 });
      const now = 1_700_000_000_000;
      // Record 3 calls within the last minute window
      be.record('agent_c', now - 1000);
      be.record('agent_c', now - 2000);
      be.record('agent_c', now - 3000);
      const r = be.check('agent_c', 'APPEND_AUDIT', now, 0);
      if (r.result !== 'RATE_MINUTE')
        return { id, description: desc, status: 'FAIL', detail: `got ${r.result}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _depth_balanced() {
    const id = 'ABC-09'; const desc = 'depth push/pop is balanced';
    try {
      const { BoundedExecutor } = require('../bounded-executor');
      const be = new BoundedExecutor();
      be.pushDepth('agent_d');
      be.pushDepth('agent_d');
      if (be.getDepth('agent_d') !== 2) return { id, description: desc, status: 'FAIL', detail: 'push failed' };
      be.popDepth('agent_d');
      if (be.getDepth('agent_d') !== 1) return { id, description: desc, status: 'FAIL', detail: 'pop failed' };
      be.popDepth('agent_d');
      if (be.getDepth('agent_d') !== 0) return { id, description: desc, status: 'FAIL', detail: 'balance failed' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _no_narrative_generation() {
    const id = 'ABC-10'; const desc = 'explainability has no nondeterministic narrative generation';
    try {
      const fp = path.join(ROOT, 'explainability.js');
      if (!fs.existsSync(fp)) return { id, description: desc, status: 'FAIL', detail: 'explainability.js missing' };
      const src = fs.readFileSync(fp, 'utf8');
      // Should not import OpenAI, Anthropic, or call LLM APIs
      const forbidden = ['openai', 'anthropic', 'gpt-', 'llm', 'Math.random()'];
      for (const f of forbidden) {
        if (src.toLowerCase().includes(f.toLowerCase()))
          return { id, description: desc, status: 'FAIL', detail: `found forbidden '${f}'` };
      }
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _explain_structured() {
    const id = 'ABC-11'; const desc = 'Explainability.explainDecision() returns structured object';
    try {
      const { Explainability } = require('../explainability');
      const ex = new Explainability();
      const fake_entry = {
        decision_id:      'dec_test_1',
        agent_id:         'agent_a',
        workflow_id:      'wf_test',
        policy_result:    'DENIED',
        reason:           'policy_deny',
        policy_id:        'P-001',
        proposed_action:  { action_type: 'FREEZE', args: {} },
        lineage_ts:       1_700_000_000_000,
        execution_result: null,
      };
      const exp = ex.explainDecision(fake_entry);
      if (!exp.type || !exp.decision_id || !exp.policy_result)
        return { id, description: desc, status: 'FAIL', detail: 'explanation missing required fields' };
      if (typeof exp !== 'object' || typeof exp.type !== 'string')
        return { id, description: desc, status: 'FAIL', detail: 'explanation is not a structured object' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  async _workflow_halts_on_denied() {
    const id = 'ABC-12'; const desc = 'orchestration halts workflow on DENIED step (H8)';
    try {
      const { OrchestrationRuntime } = require('../orchestration-runtime');
      const { PolicyEngine }         = require('../policy-engine');
      const { DecisionTrace }        = require('../decision-trace');
      const { BoundedExecutor }      = require('../bounded-executor');

      const pe = new PolicyEngine();
      pe.loadPolicies([{ id: 'deny_all', name: 'deny_all', priority: 100, action: 'deny', conditions: [] }]);

      let step2_executed = false;
      const rt = new OrchestrationRuntime({
        sdkClient:       { execute: async () => { step2_executed = true; return {}; } },
        clock:           { now: () => 1_700_000_000_000 },
        policyEngine:    pe,
        decisionTrace:   new DecisionTrace(),
        boundedExecutor: new BoundedExecutor(),
      });

      rt.registerAgent('halt_test');

      const { status, results } = await rt.submitWorkflow('halt_test', [
        { action_type: 'APPEND_AUDIT', args: {} },
        { action_type: 'APPEND_AUDIT', args: {} },  // must never execute
      ]);

      if (status !== 'HALTED')
        return { id, description: desc, status: 'FAIL', detail: `workflow status: ${status}` };
      if (results.length !== 1)
        return { id, description: desc, status: 'FAIL', detail: `expected 1 result, got ${results.length}` };
      if (step2_executed)
        return { id, description: desc, status: 'FAIL', detail: 'step 2 executed after denial' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { AIBoundaryCertification };
