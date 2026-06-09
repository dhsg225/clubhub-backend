'use strict';
/**
 * SDKBoundarySafetyCertification — verifies SDK + agent runtime do not bypass kernel authority boundaries.
 *
 * SBS-01: governance-sdk/client.js has no governance-kernel/core/ imports (comment-filtered)
 * SBS-02: governance-sdk/index.js has no governance-kernel/core/ imports (comment-filtered)
 * SBS-03: agent-runtime/executor.js has no governance-kernel/core/ imports (comment-filtered)
 * SBS-04: agent-runtime/runtime.js has no governance-kernel/core/ imports (comment-filtered)
 * SBS-05: no new Pool() construction in governance-sdk files
 * SBS-06: no new Pool() construction in agent-runtime files
 * SBS-07: executor.js routes mutations through sdkClient
 * SBS-08: no lib/governed- imports in governance-sdk files
 */
const fs   = require('fs');
const path = require('path');

const SDK_ROOT   = path.resolve(__dirname, '../../../governance-sdk');
const AGENT_ROOT = path.resolve(__dirname, '../../../agent-runtime');

const SDK_FILES   = ['client.js', 'workflows.js', 'agent.js', 'replay-client.js', 'validation.js', 'types.js', 'actions.js', 'index.js'];
const AGENT_FILES = ['runtime.js', 'executor.js', 'scheduler.js', 'state-machine.js', 'deterministic-context.js', 'index.js'];

function filterComments(src) {
  return src.split('\n').filter(l => {
    const t = l.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  }).join('\n');
}

function checkNoStringInFiles(files, root, marker) {
  for (const file of files) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) continue;
    const src = filterComments(fs.readFileSync(filePath, 'utf8'));
    if (src.includes(marker)) return file;
  }
  return null;
}

class SDKBoundarySafetyCertification {
  async run() {
    const checks = [
      this._checkNoStringFile('SBS-01', 'client.js',  SDK_ROOT,   'governance-kernel/core/', true,  'governance-sdk/client.js has no core/ imports'),
      this._checkNoStringFile('SBS-02', 'index.js',   SDK_ROOT,   'governance-kernel/core/', true,  'governance-sdk/index.js has no core/ imports'),
      this._checkNoStringFile('SBS-03', 'executor.js', AGENT_ROOT, 'governance-kernel/core/', true,  'agent-runtime/executor.js has no core/ imports'),
      this._checkNoStringFile('SBS-04', 'runtime.js',  AGENT_ROOT, 'governance-kernel/core/', true,  'agent-runtime/runtime.js has no core/ imports'),
      this._checkNoPool('SBS-05', SDK_FILES,   SDK_ROOT,   'no new Pool() in governance-sdk files'),
      this._checkNoPool('SBS-06', AGENT_FILES, AGENT_ROOT, 'no new Pool() in agent-runtime files'),
      this._checkString('SBS-07', 'executor.js', AGENT_ROOT, 'sdkClient',        'executor.js routes mutations through sdkClient'),
      this._checkNoGoverned('SBS-08'),
    ];

    return this._result('SDKBoundarySafetyCertification', checks);
  }

  _checkNoStringFile(id, file, root, marker, filterCommentLines, description) {
    const filePath = path.join(root, file);
    if (!fs.existsSync(filePath)) {
      return { id, description, status: 'FAIL', detail: `${file} does not exist` };
    }
    let src = fs.readFileSync(filePath, 'utf8');
    if (filterCommentLines) src = filterComments(src);
    if (src.includes(marker)) {
      return { id, description, status: 'FAIL', detail: `${file} contains forbidden: '${marker}'` };
    }
    return { id, description, status: 'PASS', detail: null };
  }

  _checkNoPool(id, files, root, description) {
    const hit = checkNoStringInFiles(files, root, 'new Pool(', true);
    if (hit) {
      return { id, description, status: 'FAIL', detail: `${hit} contains 'new Pool(' (pool must be injected)` };
    }
    return { id, description, status: 'PASS', detail: null };
  }

  _checkString(id, file, root, marker, description) {
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

  _checkNoGoverned(id) {
    const description = 'no lib/governed- imports in governance-sdk files';
    const hit = checkNoStringInFiles(SDK_FILES, SDK_ROOT, "lib/governed-");
    if (hit) {
      return { id, description, status: 'FAIL', detail: `${hit} contains lib/governed- import` };
    }
    return { id, description, status: 'PASS', detail: null };
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { SDKBoundarySafetyCertification };
