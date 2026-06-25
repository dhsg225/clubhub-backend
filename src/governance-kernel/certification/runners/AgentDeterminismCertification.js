'use strict';
/**
 * AgentDeterminismCertification — verifies agent runtime is fully deterministic.
 *
 * ADC-01: deterministic-context.js exists
 * ADC-02: deterministic-context.js does not call Date.now() directly
 * ADC-03: executor.js accepts context parameter
 * ADC-04: scheduler.js does not use setInterval
 * ADC-05: runtime.js uses DeterministicContext
 * ADC-06: no Math.random() calls in agent-runtime files
 */
const fs   = require('fs');
const path = require('path');

const AGENT_ROOT = path.resolve(__dirname, '../../../agent-runtime');

function filterComments(src) {
  return src.split('\n').filter(l => {
    const t = l.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  }).join('\n');
}

const AGENT_RUNTIME_FILES = [
  'runtime.js',
  'executor.js',
  'scheduler.js',
  'state-machine.js',
  'deterministic-context.js',
  'index.js',
];

class AgentDeterminismCertification {
  async run() {
    const checks = [
      this._checkFileExists('ADC-01', 'deterministic-context.js', 'deterministic-context.js exists'),
      this._checkNoString('ADC-02', 'deterministic-context.js', 'Date.now()',   'deterministic-context.js does not call Date.now()'),
      this._checkString  ('ADC-03', 'executor.js',               'context',     'executor.js accepts context parameter'),
      this._checkNoString('ADC-04', 'scheduler.js',              'setInterval', 'scheduler.js does not use setInterval'),
      this._checkString  ('ADC-05', 'runtime.js',                'DeterministicContext', 'runtime.js uses DeterministicContext'),
      this._checkNoMathRandom('ADC-06'),
    ];

    return this._result('AgentDeterminismCertification', checks);
  }

  _checkNoMathRandom(id) {
    const description = 'no Math.random() calls in agent-runtime files';
    for (const file of AGENT_RUNTIME_FILES) {
      const filePath = path.join(AGENT_ROOT, file);
      if (!fs.existsSync(filePath)) continue;
      const src = filterComments(fs.readFileSync(filePath, 'utf8'));
      if (src.includes('Math.random()')) {
        return { id, description, status: 'FAIL', detail: `${file} contains Math.random()` };
      }
    }
    return { id, description, status: 'PASS', detail: null };
  }

  _checkFileExists(id, file, description) {
    const filePath = path.join(AGENT_ROOT, file);
    if (!fs.existsSync(filePath)) {
      return { id, description, status: 'FAIL', detail: `${file} does not exist` };
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

  _checkNoString(id, file, marker, description) {
    const filePath = path.join(AGENT_ROOT, file);
    if (!fs.existsSync(filePath)) {
      return { id, description, status: 'FAIL', detail: `${file} does not exist` };
    }
    const src = filterComments(fs.readFileSync(filePath, 'utf8'));
    if (src.includes(marker)) {
      return { id, description, status: 'FAIL', detail: `${file} contains: '${marker}'` };
    }
    return { id, description, status: 'PASS', detail: null };
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { AgentDeterminismCertification };
