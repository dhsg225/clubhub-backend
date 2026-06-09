'use strict';
/**
 * TraceStoreCertification — verifies trace store structure and integration.
 *
 * TSC-01: trace-store/trace-store.js exists with appendTrace
 * TSC-02: trace-writer.js has no UPDATE SQL (append-only)
 * TSC-03: trace-schema.js has stableStringify
 * TSC-04: trace-integrity.js has step_index gap detection
 * TSC-05: trace-replay.js has rebuild function
 * TSC-06: agent-runtime/executor.js has traceStore integration
 * TSC-07: governance-sdk/client.js has traceStore integration
 * TSC-08: trace-schema.js uses createHash (SHA-256)
 * TSC-09: trace-store.js has verifyIntegrity
 * TSC-10: trace-schema.js has prev_trace_hash (hash chain)
 */
const fs   = require('fs');
const path = require('path');

const TRACE_ROOT  = path.resolve(__dirname, '../../../trace-store');
const AGENT_ROOT  = path.resolve(__dirname, '../../../agent-runtime');
const SDK_ROOT    = path.resolve(__dirname, '../../../governance-sdk');

function filterComments(src) {
  return src.split('\n').filter(l => {
    const t = l.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  }).join('\n');
}

class TraceStoreCertification {
  async run() {
    const checks = [
      this._check('TSC-01', TRACE_ROOT, 'trace-store.js',  'appendTrace',       'trace-store.js has appendTrace'),
      this._checkNoString('TSC-02', TRACE_ROOT, 'trace-writer.js', 'UPDATE ',   'trace-writer.js has no UPDATE SQL (append-only)'),
      this._check('TSC-03', TRACE_ROOT, 'trace-schema.js', 'stableStringify',   'trace-schema.js has stableStringify'),
      this._check('TSC-04', TRACE_ROOT, 'trace-integrity.js', 'step_index',     'trace-integrity.js has step_index gap detection'),
      this._check('TSC-05', TRACE_ROOT, 'trace-replay.js', 'rebuild',           'trace-replay.js has rebuild function'),
      this._check('TSC-06', AGENT_ROOT, 'executor.js',     'traceStore',        'executor.js has traceStore integration'),
      this._check('TSC-07', SDK_ROOT,   'client.js',       'traceStore',        'client.js has traceStore integration'),
      this._check('TSC-08', TRACE_ROOT, 'trace-schema.js', 'createHash',        'trace-schema.js uses createHash (SHA-256)'),
      this._check('TSC-09', TRACE_ROOT, 'trace-store.js',  'verifyIntegrity',   'trace-store.js has verifyIntegrity'),
      this._check('TSC-10', TRACE_ROOT, 'trace-schema.js', 'prev_trace_hash',   'trace-schema.js has prev_trace_hash (hash chain)'),
    ];
    return this._result('TraceStoreCertification', checks);
  }

  _check(id, root, file, marker, description) {
    const fp = path.join(root, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} does not exist` };
    const src = fs.readFileSync(fp, 'utf8');
    if (!src.includes(marker)) return { id, description, status: 'FAIL', detail: `${file} missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _checkNoString(id, root, file, marker, description) {
    const fp = path.join(root, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} does not exist` };
    const src = filterComments(fs.readFileSync(fp, 'utf8'));
    if (src.includes(marker)) return { id, description, status: 'FAIL', detail: `${file} contains forbidden '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { TraceStoreCertification };
