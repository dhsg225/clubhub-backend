'use strict';
const fs   = require('node:fs');
const path = require('node:path');
const SRC  = path.join(__dirname, '../../../');

class ResourceBoundCertification {
  get name() { return 'ResourceBoundCertification'; }
  async run() {
    const caveats = [];
    const checks = [
      { file: 'cluster-consensus.js', pattern: /MAX_NODES|MAX_SCREENS/, check: 'max_nodes' },
      { file: 'audit-ledger.js',      pattern: /MAX_LEDGER_ENTRIES/,    check: 'max_ledger' },
      { file: 'incident-manager.js',  pattern: /MAX_ACTIVE_INCIDENTS/,  check: 'max_incidents' },
    ];
    for (const { file, pattern, check } of checks) {
      const p = path.join(SRC, 'governance-kernel/core', file);
      if (!fs.existsSync(p)) {
        caveats.push({ severity: 'FAIL', check, detail: `${file} missing` });
      } else {
        const src = fs.readFileSync(p, 'utf8');
        if (!pattern.test(src)) caveats.push({ severity: 'FAIL', check, detail: `${check} bound missing in ${file}` });
      }
    }
    // Check eviction logic
    const ccPath = path.join(SRC, 'governance-kernel/core/cluster-consensus.js');
    if (fs.existsSync(ccPath)) {
      const src = fs.readFileSync(ccPath, 'utf8');
      if (!src.includes('evict') && !src.includes('.delete(') && !src.includes('oldest')) {
        caveats.push({ severity: 'CONDITIONAL', check: 'node_eviction', detail: 'node eviction logic not found' });
      }
    }
    const rating = caveats.some(c => c.severity === 'FAIL') ? 'FAIL'
                 : caveats.some(c => c.severity === 'CONDITIONAL') ? 'CONDITIONAL' : 'PASS';
    return { name: this.name, rating, caveats };
  }
}
module.exports = ResourceBoundCertification;
