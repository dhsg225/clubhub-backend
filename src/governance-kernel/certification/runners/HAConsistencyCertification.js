'use strict';
const fs   = require('node:fs');
const path = require('node:path');
const SRC  = path.join(__dirname, '../../../');

class HAConsistencyCertification {
  get name() { return 'HAConsistencyCertification'; }
  async run() {
    const caveats = [];
    // cluster-consensus must have freezeStrong and getFreezeStateStrong
    const ccPath = path.join(SRC, 'governance-kernel/core/cluster-consensus.js');
    if (!fs.existsSync(ccPath)) {
      caveats.push({ severity: 'FAIL', check: 'cluster_consensus_exists', detail: 'cluster-consensus.js missing' });
    } else {
      const src = fs.readFileSync(ccPath, 'utf8');
      if (!src.includes('freezeStrong'))         caveats.push({ severity: 'FAIL', check: 'freeze_strong', detail: 'freezeStrong() missing' });
      if (!src.includes('getFreezeStateStrong')) caveats.push({ severity: 'FAIL', check: 'get_freeze_strong', detail: 'getFreezeStateStrong() missing' });
      if (!src.includes('incrementEpoch'))       caveats.push({ severity: 'FAIL', check: 'increment_epoch', detail: 'incrementEpoch() missing' });
      if (!src.includes('FAIL_CLOSED'))          caveats.push({ severity: 'CONDITIONAL', check: 'fail_closed', detail: 'FAIL_CLOSED default not found' });
    }
    // distributed-authority must have HA_SAFETY_MODEL
    const daPath = path.join(SRC, 'governance-kernel/core/distributed-authority.js');
    if (fs.existsSync(daPath)) {
      const src = fs.readFileSync(daPath, 'utf8');
      if (!src.includes('HA_SAFETY_MODEL')) caveats.push({ severity: 'CONDITIONAL', check: 'ha_safety_model', detail: 'HA_SAFETY_MODEL not documented' });
      if (!src.includes('withAdvisoryLock') && !src.includes('pg_advisory')) {
        caveats.push({ severity: 'CONDITIONAL', check: 'advisory_lock', detail: 'advisory lock not referenced in distributed-authority' });
      }
    }
    // governance-db must have withAdvisoryLock
    const dbPath = path.join(SRC, 'governance-kernel/core/governance-db.js');
    if (fs.existsSync(dbPath)) {
      const src = fs.readFileSync(dbPath, 'utf8');
      if (!src.includes('withAdvisoryLock')) caveats.push({ severity: 'FAIL', check: 'advisory_lock_db', detail: 'withAdvisoryLock missing from governance-db' });
      if (!src.includes('pg_advisory_xact_lock')) caveats.push({ severity: 'FAIL', check: 'pg_advisory_sql', detail: 'pg_advisory_xact_lock not used' });
    }
    // Node/screen eviction bound
    if (fs.existsSync(ccPath)) {
      const src = fs.readFileSync(ccPath, 'utf8');
      if (!src.includes('MAX_NODES') && !src.includes('MAX_SCREENS')) {
        caveats.push({ severity: 'FAIL', check: 'node_bound', detail: 'MAX_NODES bound missing' });
      }
    }
    const rating = caveats.some(c => c.severity === 'FAIL') ? 'FAIL'
                 : caveats.some(c => c.severity === 'CONDITIONAL') ? 'CONDITIONAL' : 'PASS';
    return { name: this.name, rating, caveats };
  }
}
module.exports = HAConsistencyCertification;
