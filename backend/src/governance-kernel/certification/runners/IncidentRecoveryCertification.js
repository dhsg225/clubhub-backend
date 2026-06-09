'use strict';
const fs   = require('node:fs');
const path = require('node:path');
const SRC  = path.join(__dirname, '../../../');

class IncidentRecoveryCertification {
  get name() { return 'IncidentRecoveryCertification'; }
  async run() {
    const caveats = [];
    const incPath = path.join(SRC, 'governance-kernel/core/incident-manager.js');
    if (!fs.existsSync(incPath)) {
      caveats.push({ severity: 'FAIL', check: 'incident_manager', detail: 'incident-manager.js missing' });
    } else {
      const src = fs.readFileSync(incPath, 'utf8');
      const required = [
        ['createIncident',           'create_incident'],
        ['archiveResolvedIncidents', 'archive_incidents'],
        ['MAX_ACTIVE_INCIDENTS',     'incident_bound'],
        ['INCIDENT_STATES',          'incident_states'],
        ['initFromDb',               'incident_db_init'],
      ];
      for (const [pattern, check] of required) {
        if (!src.includes(pattern)) caveats.push({ severity: 'FAIL', check, detail: `${pattern} missing` });
      }
    }
    const rating = caveats.some(c => c.severity === 'FAIL') ? 'FAIL'
                 : caveats.some(c => c.severity === 'CONDITIONAL') ? 'CONDITIONAL' : 'PASS';
    return { name: this.name, rating, caveats };
  }
}
module.exports = IncidentRecoveryCertification;
