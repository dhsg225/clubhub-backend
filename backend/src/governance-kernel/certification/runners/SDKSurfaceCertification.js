'use strict';
/**
 * SDKSurfaceCertification — verifies governance-sdk surface is correctly structured.
 *
 * SSC-01: governance-sdk/client.js exists
 * SSC-02: client.js has no governance-kernel/core/ imports (comment-filtered)
 * SSC-03: client.js defines GovernanceSDKClient class
 * SSC-04: actions.js defines ACTIONS map
 * SSC-05: validation.js defines validateAction function
 * SSC-06: types.js defines CONSISTENCY_LEVELS
 */
const fs   = require('fs');
const path = require('path');

const SDK_ROOT = path.resolve(__dirname, '../../../governance-sdk');

function filterComments(src) {
  return src.split('\n').filter(l => {
    const t = l.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  }).join('\n');
}

class SDKSurfaceCertification {
  async run() {
    const checks = [
      this._checkFileExists('SSC-01', 'client.js', 'governance-sdk/client.js exists'),
      this._checkNoString('SSC-02', 'client.js', 'governance-kernel/core/', 'client.js has no governance-kernel/core/ imports', true),
      this._checkString('SSC-03', 'client.js', 'GovernanceSDKClient', 'client.js defines GovernanceSDKClient class'),
      this._checkString('SSC-04', 'actions.js', 'ACTIONS', 'actions.js defines ACTIONS map'),
      this._checkString('SSC-05', 'validation.js', 'validateAction', 'validation.js defines validateAction'),
      this._checkString('SSC-06', 'types.js', 'CONSISTENCY_LEVELS', 'types.js defines CONSISTENCY_LEVELS'),
    ];

    return this._result('SDKSurfaceCertification', checks);
  }

  _checkFileExists(id, file, description) {
    const filePath = path.join(SDK_ROOT, file);
    if (!fs.existsSync(filePath)) {
      return { id, description, status: 'FAIL', detail: `${file} does not exist` };
    }
    return { id, description, status: 'PASS', detail: null };
  }

  _checkString(id, file, marker, description) {
    const filePath = path.join(SDK_ROOT, file);
    if (!fs.existsSync(filePath)) {
      return { id, description, status: 'FAIL', detail: `${file} does not exist` };
    }
    const src = fs.readFileSync(filePath, 'utf8');
    if (!src.includes(marker)) {
      return { id, description, status: 'FAIL', detail: `${file} missing: '${marker}'` };
    }
    return { id, description, status: 'PASS', detail: null };
  }

  _checkNoString(id, file, marker, description, filterCommentLines = false) {
    const filePath = path.join(SDK_ROOT, file);
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

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { SDKSurfaceCertification };
