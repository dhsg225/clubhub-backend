'use strict';
/**
 * AgentLifecycleCertification — verifies agent runtime lifecycle state machine is correct.
 *
 * ALC-01: state-machine.js defines all 6 AGENT_STATES
 * ALC-02: TERMINATED is declared as terminal (TERMINATED: [])
 * ALC-03: runtime.js transitions to 'RUNNING' state
 * ALC-04: runtime.js transitions to 'BLOCKED' state (on kernel FROZEN)
 * ALC-05: executor.js checks for TERMINATED before steps
 * ALC-06: executor.js checks for BLOCKED before steps
 * ALC-07: runtime.js emits agent.lifecycle.changed events
 * ALC-08: index.js exports createAgentRuntime
 */
const fs   = require('fs');
const path = require('path');

const AGENT_ROOT = path.resolve(__dirname, '../../../agent-runtime');

const REQUIRED_STATES = ['IDLE', 'RUNNING', 'WAITING', 'BLOCKED', 'REPLAYING', 'TERMINATED'];

class AgentLifecycleCertification {
  async run() {
    const checks = [
      this._checkAllStates('ALC-01'),
      this._checkTerminalState('ALC-02'),
      this._checkString('ALC-03', 'runtime.js',       "'RUNNING'",               'runtime.js transitions to RUNNING state'),
      this._checkString('ALC-04', 'runtime.js',       "'BLOCKED'",               'runtime.js transitions to BLOCKED state'),
      this._checkString('ALC-05', 'executor.js',      'isTerminated()',           'executor.js checks isTerminated() before steps'),
      this._checkString('ALC-06', 'executor.js',      'isBlocked()',             'executor.js checks isBlocked() before steps'),
      this._checkString('ALC-07', 'runtime.js',       "'agent.lifecycle.changed'", "runtime.js emits agent.lifecycle.changed"),
      this._checkString('ALC-08', 'index.js',         'createAgentRuntime',       'index.js exports createAgentRuntime'),
    ];

    return this._result('AgentLifecycleCertification', checks);
  }

  _checkAllStates(id) {
    const description = 'state-machine.js defines all 6 AGENT_STATES';
    const filePath    = path.join(AGENT_ROOT, 'state-machine.js');
    if (!fs.existsSync(filePath)) {
      return { id, description, status: 'FAIL', detail: 'state-machine.js does not exist' };
    }
    const src = fs.readFileSync(filePath, 'utf8');
    const missing = REQUIRED_STATES.filter(s => !src.includes(s));
    if (missing.length > 0) {
      return { id, description, status: 'FAIL', detail: `state-machine.js missing states: ${missing.join(', ')}` };
    }
    return { id, description, status: 'PASS', detail: null };
  }

  _checkTerminalState(id) {
    const description = 'TERMINATED is declared as terminal state (no outgoing transitions)';
    const filePath    = path.join(AGENT_ROOT, 'state-machine.js');
    if (!fs.existsSync(filePath)) {
      return { id, description, status: 'FAIL', detail: 'state-machine.js does not exist' };
    }
    const src = fs.readFileSync(filePath, 'utf8');
    // Match: TERMINATED: []  (with optional whitespace)
    if (!/TERMINATED\s*:\s*\[\s*\]/.test(src)) {
      return { id, description, status: 'FAIL', detail: 'TERMINATED state not declared as terminal (TERMINATED: [])' };
    }
    return { id, description, status: 'PASS', detail: null };
  }

  _checkString(id, file, marker, description) {
    const filePath = path.join(AGENT_ROOT, file);
    if (!fs.existsSync(filePath)) {
      return { id, description, status: 'FAIL', detail: `${file} does not exist` };
    }
    const src = fs.readFileSync(filePath, 'utf8');
    if (!src.includes(marker)) {
      return { id, description, status: 'FAIL', detail: `${file} missing: '${marker}'` };
    }
    return { id, description, status: 'PASS', detail: null };
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { AgentLifecycleCertification };
