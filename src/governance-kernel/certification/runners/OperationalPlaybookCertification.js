'use strict';
/**
 * OperationalPlaybookCertification — verifies all 9 playbooks exist with required sections.
 *
 * OPC-01..09: Each playbook has ## Preconditions, ## Commands, ## Rollback, ## Replay implications, ## Certification implications
 */
const fs   = require('fs');
const path = require('path');

const PLAYBOOKS_ROOT = path.resolve(__dirname, '../../operator-playbooks');

const REQUIRED_PLAYBOOKS = [
  'FREEZE_PLAYBOOK.md',
  'INCIDENT_RESPONSE_PLAYBOOK.md',
  'REPLAY_FORENSICS_PLAYBOOK.md',
  'CONFIG_ROLLBACK_PLAYBOOK.md',
  'DEGRADED_MODE_PLAYBOOK.md',
  'HA_FAILOVER_PLAYBOOK.md',
  'PLUGIN_FAILURE_PLAYBOOK.md',
  'CERTIFICATION_FAILURE_PLAYBOOK.md',
  'SECURITY_RESPONSE_PLAYBOOK.md',
];

const REQUIRED_SECTIONS = [
  '## Preconditions',
  '## Commands',
  '## Rollback',
  '## Replay implications',
  '## Certification implications',
];

class OperationalPlaybookCertification {
  async run() {
    const checks = REQUIRED_PLAYBOOKS.map((file, i) => {
      const id = `OPC-0${i + 1}`;
      const filePath = path.join(PLAYBOOKS_ROOT, file);
      if (!fs.existsSync(filePath)) {
        return { id, description: `${file} exists with required sections`, status: 'FAIL', detail: `${file} does not exist` };
      }
      const src = fs.readFileSync(filePath, 'utf8');
      const missing = REQUIRED_SECTIONS.filter(s => !src.includes(s));
      if (missing.length > 0) {
        return { id, description: `${file} has all required sections`, status: 'FAIL', detail: `${file} missing sections: ${missing.join(', ')}` };
      }
      return { id, description: `${file} has all required sections`, status: 'PASS', detail: null };
    });

    return this._result('OperationalPlaybookCertification', checks);
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { OperationalPlaybookCertification };
