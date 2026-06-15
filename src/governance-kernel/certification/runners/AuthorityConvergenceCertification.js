'use strict';
const fs   = require('node:fs');
const path = require('node:path');
const SRC  = path.join(__dirname, '../../../');

class AuthorityConvergenceCertification {
  get name() { return 'AuthorityConvergenceCertification'; }
  async run() {
    const caveats = [];
    const ccPath = path.join(SRC, 'governance-kernel/core/cluster-consensus.js');
    if (fs.existsSync(ccPath)) {
      const src = fs.readFileSync(ccPath, 'utf8');
      if (!src.includes('incrementEpoch'))  caveats.push({ severity: 'FAIL', check: 'epoch_increment', detail: 'incrementEpoch missing' });
      if (!src.includes('getEpoch'))        caveats.push({ severity: 'FAIL', check: 'epoch_read', detail: 'getEpoch missing' });
      if (!src.includes('SPLIT_BRAIN'))     caveats.push({ severity: 'CONDITIONAL', check: 'split_brain', detail: 'SPLIT_BRAIN detection missing' });
      if (!src.includes('QUORUM_PCT') && !src.includes('quorum')) {
        caveats.push({ severity: 'CONDITIONAL', check: 'quorum', detail: 'quorum check not found' });
      }
    } else {
      caveats.push({ severity: 'FAIL', check: 'cluster_consensus', detail: 'cluster-consensus.js missing' });
    }
    const configPath = path.join(SRC, 'governance-kernel/core/config-authority.js');
    if (fs.existsSync(configPath)) {
      const src = fs.readFileSync(configPath, 'utf8');
      if (!src.includes('getThreshold'))   caveats.push({ severity: 'FAIL', check: 'config_threshold', detail: 'getThreshold missing' });
      if (!src.includes('configHash'))     caveats.push({ severity: 'CONDITIONAL', check: 'config_hash', detail: 'config hash not found' });
    } else {
      caveats.push({ severity: 'FAIL', check: 'config_authority', detail: 'config-authority.js missing' });
    }
    const rating = caveats.some(c => c.severity === 'FAIL') ? 'FAIL'
                 : caveats.some(c => c.severity === 'CONDITIONAL') ? 'CONDITIONAL' : 'PASS';
    return { name: this.name, rating, caveats };
  }
}
module.exports = AuthorityConvergenceCertification;
