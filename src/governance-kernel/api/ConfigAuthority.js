'use strict';
const configMod = require('../core/config-authority');

class ConfigAuthority {
  get(dotPath)           { return configMod.getThreshold(dotPath); }
  require(dotPath)       { return configMod.requireThreshold(dotPath); }
  snapshot()             { return configMod.getThresholdSnapshot(); }
  version()              { return configMod.getThresholdVersion(); }
  update(changes, opts)  {
    const inst = configMod.getInstance();
    if (!inst) throw new Error('ConfigAuthority: governed-config singleton not initialized');
    return inst.update(changes, opts);
  }
  getAll()               { return configMod.getInstance()?.getAll() ?? {}; }
  freeze()               { configMod.getInstance()?.freeze(); }
  unfreeze()             { configMod.getInstance()?.unfreeze(); }
  isFrozen()             { return configMod.getInstance()?.isFrozen() ?? false; }
}
module.exports = { ConfigAuthority };
