'use strict';
const fs   = require('node:fs');
const path = require('node:path');
const SRC  = path.join(__dirname, '../../../');

class DeterminismCertification {
  get name() { return 'DeterminismCertification'; }
  async run() {
    const caveats = [];
    // Check deterministic ID module
    const idPath = path.join(SRC, 'governance-kernel/core/deterministic-id.js');
    if (!fs.existsSync(idPath)) {
      caveats.push({ severity: 'FAIL', check: 'deterministic_id_exists', detail: 'deterministic-id.js missing' });
    } else {
      const src = fs.readFileSync(idPath, 'utf8');
      if (!src.includes('sha256'))            caveats.push({ severity: 'FAIL', check: 'det_id_sha256', detail: 'SHA-256 not used' });
      if (!src.includes('_stableStringify'))  caveats.push({ severity: 'FAIL', check: 'det_id_stable', detail: '_stableStringify missing' });
      if (src.includes('Date.now()'))         caveats.push({ severity: 'FAIL', check: 'det_id_no_clock', detail: 'Date.now() found in deterministic-id — nondeterministic' });
    }
    // Check incident-manager uses deterministic IDs
    const incPath = path.join(SRC, 'governance-kernel/core/incident-manager.js');
    if (fs.existsSync(incPath)) {
      const src = fs.readFileSync(incPath, 'utf8');
      if (!src.includes('deriveDeterministicId') && !src.includes('deterministic-id')) {
        caveats.push({ severity: 'CONDITIONAL', check: 'incident_det_id', detail: 'incident-manager does not use deterministic IDs' });
      }
    }
    // Check governed clock is used for timestamps (not raw Date.now) in critical paths
    const clockPath = path.join(SRC, 'governance-kernel/core/clock.js');
    if (fs.existsSync(clockPath)) {
      const src = fs.readFileSync(clockPath, 'utf8');
      if (!src.includes('nowIso')) caveats.push({ severity: 'FAIL', check: 'clock_nowIso', detail: 'nowIso() missing from clock' });
    }
    const rating = caveats.some(c => c.severity === 'FAIL') ? 'FAIL'
                 : caveats.some(c => c.severity === 'CONDITIONAL') ? 'CONDITIONAL' : 'PASS';
    return { name: this.name, rating, caveats };
  }
}
module.exports = DeterminismCertification;
