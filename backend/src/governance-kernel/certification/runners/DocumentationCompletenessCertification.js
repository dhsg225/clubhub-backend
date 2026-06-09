'use strict';
/**
 * DocumentationCompletenessCertification — verifies all 12 platform docs exist with key content.
 *
 * DCC-01: PLATFORM_OVERVIEW.md — has consistency levels section
 * DCC-02: KERNEL_QUICKSTART.md — has code examples
 * DCC-03: RUNTIME_LIFECYCLE_GUIDE.md — has lifecycle states
 * DCC-04: REPLAY_GUIDE.md — has replay modes
 * DCC-05: AUTHORITY_MODEL_GUIDE.md — has consistency levels
 * DCC-06: PLUGIN_DEVELOPMENT_GUIDE.md — has authority boundary rule
 * DCC-07: CERTIFICATION_GUIDE.md — has certification levels
 * DCC-08: HA_TOPOLOGY_GUIDE.md — has HA ceiling
 * DCC-09: THREAT_MODEL_GUIDE.md — has threat entries
 * DCC-10: FAILURE_MODE_GUIDE.md — has DB failure policies
 * DCC-11: DETERMINISM_GUIDE.md — has CONTENT_ADDRESSED
 * DCC-12: GLOSSARY.md — has glossary terms
 */
const fs   = require('fs');
const path = require('path');

const DOCS_ROOT = path.resolve(__dirname, '../../platform-docs');

const REQUIRED_DOCS = [
  { id: 'DCC-01', file: 'PLATFORM_OVERVIEW.md',        marker: 'LINEARIZED',          desc: 'PLATFORM_OVERVIEW.md has consistency levels' },
  { id: 'DCC-02', file: 'KERNEL_QUICKSTART.md',         marker: 'require(',            desc: 'KERNEL_QUICKSTART.md has code examples' },
  { id: 'DCC-03', file: 'RUNTIME_LIFECYCLE_GUIDE.md',   marker: 'LIFECYCLE_STATES',    desc: 'RUNTIME_LIFECYCLE_GUIDE.md documents lifecycle states' },
  { id: 'DCC-04', file: 'REPLAY_GUIDE.md',              marker: 'REPLAY',              desc: 'REPLAY_GUIDE.md documents replay modes' },
  { id: 'DCC-05', file: 'AUTHORITY_MODEL_GUIDE.md',     marker: 'CACHE_COHERENT',      desc: 'AUTHORITY_MODEL_GUIDE.md documents consistency levels' },
  { id: 'DCC-06', file: 'PLUGIN_DEVELOPMENT_GUIDE.md',  marker: 'FORBIDDEN',           desc: 'PLUGIN_DEVELOPMENT_GUIDE.md has authority boundary rules' },
  { id: 'DCC-07', file: 'CERTIFICATION_GUIDE.md',       marker: 'HA_PRODUCTION',       desc: 'CERTIFICATION_GUIDE.md has certification levels' },
  { id: 'DCC-08', file: 'HA_TOPOLOGY_GUIDE.md',         marker: '2-node',              desc: 'HA_TOPOLOGY_GUIDE.md documents HA ceiling' },
  { id: 'DCC-09', file: 'THREAT_MODEL_GUIDE.md',        marker: 'Mitigation',          desc: 'THREAT_MODEL_GUIDE.md has threat mitigations' },
  { id: 'DCC-10', file: 'FAILURE_MODE_GUIDE.md',        marker: 'FAIL_CLOSED',         desc: 'FAILURE_MODE_GUIDE.md has DB failure policies' },
  { id: 'DCC-11', file: 'DETERMINISM_GUIDE.md',         marker: 'CONTENT_ADDRESSED',   desc: 'DETERMINISM_GUIDE.md documents determinism levels' },
  { id: 'DCC-12', file: 'GLOSSARY.md',                  marker: 'LINEARIZED',          desc: 'GLOSSARY.md has terminology definitions' },
];

class DocumentationCompletenessCertification {
  async run() {
    const checks = REQUIRED_DOCS.map(({ id, file, marker, desc }) => {
      const filePath = path.join(DOCS_ROOT, file);
      if (!fs.existsSync(filePath)) {
        return { id, description: desc, status: 'FAIL', detail: `${file} does not exist` };
      }
      const src = fs.readFileSync(filePath, 'utf8');
      if (!src.includes(marker)) {
        return { id, description: desc, status: 'FAIL', detail: `${file} missing required content marker: '${marker}'` };
      }
      return { id, description: desc, status: 'PASS', detail: null };
    });

    return this._result('DocumentationCompletenessCertification', checks);
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { DocumentationCompletenessCertification };
