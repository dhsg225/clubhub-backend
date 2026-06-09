'use strict';
/**
 * WorkflowReplayCertification — verifies SDK workflows are replay-compatible.
 *
 * WRC-01: workflows.js has replayable property
 * WRC-02: workflows.js assigns consistencyLevel to steps
 * WRC-03: replay-client.js exists
 * WRC-04: replay-client.js calls enterReplay
 * WRC-05: executor.js emits workflow.step.completed event
 * WRC-06: workflows.js assigns step_index for deterministic ordering
 */
const fs   = require('fs');
const path = require('path');

const SDK_ROOT   = path.resolve(__dirname, '../../../governance-sdk');
const AGENT_ROOT = path.resolve(__dirname, '../../../agent-runtime');

class WorkflowReplayCertification {
  async run() {
    const checks = [
      this._checkSDK  ('WRC-01', 'workflows.js',     'replayable',            'workflows.js has replayable property'),
      this._checkSDK  ('WRC-02', 'workflows.js',     'consistencyLevel',      'workflows.js assigns consistencyLevel to steps'),
      this._checkExists('WRC-03', 'replay-client.js', SDK_ROOT,               'governance-sdk/replay-client.js exists'),
      this._checkSDK  ('WRC-04', 'replay-client.js', 'enterReplay',           'replay-client.js calls enterReplay'),
      this._checkAgent('WRC-05', 'executor.js',      'workflow.step.completed', "executor.js emits 'workflow.step.completed'"),
      this._checkSDK  ('WRC-06', 'workflows.js',     'step_index',            'workflows.js assigns step_index for deterministic order'),
    ];

    return this._result('WorkflowReplayCertification', checks);
  }

  _checkExists(id, file, root, description) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) {
      return { id, description, status: 'FAIL', detail: `${file} does not exist` };
    }
    return { id, description, status: 'PASS', detail: null };
  }

  _checkSDK(id, file, marker, description) {
    return this._checkMarker(id, file, SDK_ROOT, marker, description);
  }

  _checkAgent(id, file, marker, description) {
    return this._checkMarker(id, file, AGENT_ROOT, marker, description);
  }

  _checkMarker(id, file, root, marker, description) {
    const filePath = path.join(root, file);
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

module.exports = { WorkflowReplayCertification };
