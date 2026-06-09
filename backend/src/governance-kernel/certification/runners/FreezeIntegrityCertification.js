'use strict';
const fs   = require('node:fs');
const path = require('node:path');
const SRC  = path.join(__dirname, '../../../');

class FreezeIntegrityCertification {
  get name() { return 'FreezeIntegrityCertification'; }
  async run() {
    const caveats = [];
    const ccPath = path.join(SRC, 'governance-kernel/core/cluster-consensus.js');
    if (!fs.existsSync(ccPath)) {
      caveats.push({ severity: 'FAIL', check: 'freeze_module', detail: 'cluster-consensus.js missing' });
    } else {
      const src = fs.readFileSync(ccPath, 'utf8');
      if (!src.includes('freezeStrong'))         caveats.push({ severity: 'FAIL', check: 'freeze_strong', detail: 'freezeStrong() missing' });
      if (!src.includes('getFreezeStateStrong')) caveats.push({ severity: 'FAIL', check: 'freeze_db_read', detail: 'getFreezeStateStrong() missing' });
      if (!src.includes('_freezeEpoch'))         caveats.push({ severity: 'FAIL', check: 'freeze_epoch', detail: '_freezeEpoch counter missing' });
      if (!src.includes('FAIL_CLOSED'))          caveats.push({ severity: 'CONDITIONAL', check: 'fail_closed', detail: 'FAIL_CLOSED policy not found' });
    }
    // Freeze controller API
    const fcPath = path.join(SRC, 'governance-kernel/api/FreezeController.js');
    if (!fs.existsSync(fcPath)) {
      caveats.push({ severity: 'CONDITIONAL', check: 'freeze_api', detail: 'FreezeController.js missing' });
    }
    const rating = caveats.some(c => c.severity === 'FAIL') ? 'FAIL'
                 : caveats.some(c => c.severity === 'CONDITIONAL') ? 'CONDITIONAL' : 'PASS';
    return { name: this.name, rating, caveats };
  }
}
module.exports = FreezeIntegrityCertification;
