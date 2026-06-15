'use strict';
const fs   = require('node:fs');
const path = require('node:path');
const SRC  = path.join(__dirname, '../../../');

class ReplayCertification {
  get name() { return 'ReplayCertification'; }
  async run() {
    const caveats = [];
    // Check governed clock exists and supports freeze/setFixed
    const clockPath = path.join(SRC, 'governance-kernel/core/clock.js');
    if (!fs.existsSync(clockPath)) {
      caveats.push({ severity: 'FAIL', check: 'governed_clock_exists', detail: 'clock.js missing' });
    } else {
      const src = fs.readFileSync(clockPath, 'utf8');
      if (!src.includes('setFixed')) caveats.push({ severity: 'FAIL', check: 'clock_set_fixed', detail: 'setFixed() missing' });
      if (!src.includes('freeze'))   caveats.push({ severity: 'FAIL', check: 'clock_freeze',    detail: 'freeze() missing' });
      if (!src.includes('isFrozen')) caveats.push({ severity: 'FAIL', check: 'clock_is_frozen', detail: 'isFrozen() missing' });
    }
    // Check lineage REPLAY mode
    const lineagePath = path.join(SRC, 'governance-kernel/core/lineage.js');
    if (fs.existsSync(lineagePath)) {
      const src = fs.readFileSync(lineagePath, 'utf8');
      if (!src.includes('REPLAY')) caveats.push({ severity: 'FAIL', check: 'lineage_replay_mode', detail: 'REPLAY mode missing' });
    } else {
      caveats.push({ severity: 'FAIL', check: 'lineage_exists', detail: 'lineage.js missing' });
    }
    const rating = caveats.some(c => c.severity === 'FAIL') ? 'FAIL'
                 : caveats.some(c => c.severity === 'CONDITIONAL') ? 'CONDITIONAL' : 'PASS';
    return { name: this.name, rating, caveats };
  }
}
module.exports = ReplayCertification;
