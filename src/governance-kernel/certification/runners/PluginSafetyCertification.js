'use strict';
const fs   = require('node:fs');
const path = require('node:path');
const SRC  = path.join(__dirname, '../../../');

class PluginSafetyCertification {
  get name() { return 'PluginSafetyCertification'; }
  async run() {
    const caveats = [];
    const regPath = path.join(SRC, 'governance-kernel/plugins/PluginRegistry.js');
    if (!fs.existsSync(regPath)) {
      caveats.push({ severity: 'FAIL', check: 'plugin_registry', detail: 'PluginRegistry.js missing' });
    } else {
      const src = fs.readFileSync(regPath, 'utf8');
      if (!src.includes('bypassGovernance')) caveats.push({ severity: 'FAIL', check: 'bypass_check', detail: 'bypassGovernance check missing' });
      if (!src.includes('validate'))         caveats.push({ severity: 'FAIL', check: 'plugin_validate', detail: 'validate() missing' });
      if (!src.includes('determinismLevel')) caveats.push({ severity: 'FAIL', check: 'determinism_decl', detail: 'determinismLevel requirement missing' });
      if (!src.includes('authorityLevel'))   caveats.push({ severity: 'FAIL', check: 'authority_decl', detail: 'authorityLevel requirement missing' });
    }
    // OTA plugin should declare correct capabilities
    const otaPath = path.join(SRC, 'plugins/ota/index.js');
    if (!fs.existsSync(otaPath)) {
      caveats.push({ severity: 'CONDITIONAL', check: 'ota_plugin', detail: 'OTA plugin not yet registered at plugins/ota/index.js' });
    } else {
      const src = fs.readFileSync(otaPath, 'utf8');
      if (src.includes('bypassGovernance: true')) {
        caveats.push({ severity: 'FAIL', check: 'ota_bypass', detail: 'OTA plugin declares bypassGovernance:true' });
      }
    }
    const rating = caveats.some(c => c.severity === 'FAIL') ? 'FAIL'
                 : caveats.some(c => c.severity === 'CONDITIONAL') ? 'CONDITIONAL' : 'PASS';
    return { name: this.name, rating, caveats };
  }
}
module.exports = PluginSafetyCertification;
