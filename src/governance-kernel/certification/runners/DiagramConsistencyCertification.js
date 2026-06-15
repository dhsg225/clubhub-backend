'use strict';
/**
 * DiagramConsistencyCertification — verifies all 8 diagram docs exist with ASCII art.
 *
 * DIC-01..08: Each diagram doc exists and contains ASCII box-drawing or arrow characters.
 */
const fs   = require('fs');
const path = require('path');

const DIAGRAMS_ROOT = path.resolve(__dirname, '../../diagrams');

const REQUIRED_DIAGRAMS = [
  'SYSTEM_ARCHITECTURE.md',
  'AUTHORITY_FLOW.md',
  'REPLAY_FLOW.md',
  'EVENT_LINEAGE_FLOW.md',
  'PLUGIN_RUNTIME_FLOW.md',
  'CERTIFICATION_FLOW.md',
  'FAILURE_RECOVERY_FLOW.md',
  'HA_DEPLOYMENT_FLOW.md',
];

// ASCII art detection: box-drawing chars or arrow art
const ASCII_PATTERN = /[─│┌└┐┘├┤┬┴┼►▼▲◄]|──►|──►|───/;

class DiagramConsistencyCertification {
  async run() {
    const checks = REQUIRED_DIAGRAMS.map((file, i) => {
      const id = `DIC-0${i + 1}`;
      const filePath = path.join(DIAGRAMS_ROOT, file);
      if (!fs.existsSync(filePath)) {
        return { id, description: `${file} exists with ASCII diagram`, status: 'FAIL', detail: `${file} does not exist` };
      }
      const src = fs.readFileSync(filePath, 'utf8');
      const hasAscii = ASCII_PATTERN.test(src);
      if (!hasAscii) {
        return { id, description: `${file} contains ASCII art diagram`, status: 'FAIL', detail: `${file} missing ASCII art (no box-drawing characters found)` };
      }
      return { id, description: `${file} contains ASCII art diagram`, status: 'PASS', detail: null };
    });

    return this._result('DiagramConsistencyCertification', checks);
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { DiagramConsistencyCertification };
