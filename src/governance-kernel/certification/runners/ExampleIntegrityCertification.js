'use strict';
/**
 * ExampleIntegrityCertification — verifies all 5 example dirs have README.md + index.js.
 *
 * EIC-01: examples/basic-kernel/
 * EIC-02: examples/replay-runtime/
 * EIC-03: examples/plugin-runtime/
 * EIC-04: examples/ha-topology/
 * EIC-05: examples/deterministic-replay/
 */
const fs   = require('fs');
const path = require('path');

const EXAMPLES_ROOT = path.resolve(__dirname, '../../examples');

const REQUIRED_EXAMPLES = [
  { id: 'EIC-01', dir: 'basic-kernel' },
  { id: 'EIC-02', dir: 'replay-runtime' },
  { id: 'EIC-03', dir: 'plugin-runtime' },
  { id: 'EIC-04', dir: 'ha-topology' },
  { id: 'EIC-05', dir: 'deterministic-replay' },
];

class ExampleIntegrityCertification {
  async run() {
    const checks = REQUIRED_EXAMPLES.map(({ id, dir }) => {
      const dirPath = path.join(EXAMPLES_ROOT, dir);
      if (!fs.existsSync(dirPath)) {
        return { id, description: `examples/${dir}/ exists`, status: 'FAIL', detail: `examples/${dir}/ directory does not exist` };
      }
      const hasReadme = fs.existsSync(path.join(dirPath, 'README.md'));
      const hasIndex  = fs.existsSync(path.join(dirPath, 'index.js'));
      if (!hasReadme || !hasIndex) {
        const missing = [!hasReadme && 'README.md', !hasIndex && 'index.js'].filter(Boolean);
        return { id, description: `examples/${dir}/ has README.md + index.js`, status: 'FAIL', detail: `examples/${dir}/ missing: ${missing.join(', ')}` };
      }
      // Verify README is non-empty and has expected sections
      const readme = fs.readFileSync(path.join(dirPath, 'README.md'), 'utf8');
      if (!readme.includes('## ')) {
        return { id, description: `examples/${dir}/ README has sections`, status: 'FAIL', detail: `examples/${dir}/README.md has no sections` };
      }
      return { id, description: `examples/${dir}/ has README.md + index.js`, status: 'PASS', detail: null };
    });

    return this._result('ExampleIntegrityCertification', checks);
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { ExampleIntegrityCertification };
