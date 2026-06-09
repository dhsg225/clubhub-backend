'use strict';
const eventBus = require('../event-bus');

const DETERMINISM_LEVELS   = Object.freeze(['NONDETERMINISTIC', 'DETERMINISTIC_PER_DB', 'CONTENT_ADDRESSED']);
const REPLAYABILITY_LEVELS = Object.freeze(['NOT_REPLAYABLE', 'PARTIALLY_REPLAYABLE', 'FULLY_REPLAYABLE']);
const AUTHORITY_LEVELS     = Object.freeze(['ADVISORY', 'CACHE_COHERENT', 'DB_AUTHORITATIVE', 'LINEARIZED']);
const HA_SAFETY_LEVELS     = Object.freeze(['SINGLE_NODE', 'ACTIVE_PASSIVE', 'ACTIVE_ACTIVE_READS', 'ACTIVE_ACTIVE_WRITES']);

const REQUIRED_CAPABILITIES = ['name', 'version', 'determinismLevel', 'replayabilityLevel', 'authorityLevel', 'haSafetyLevel'];

class PluginRegistry {
  constructor() { this._plugins = new Map(); }

  validate(plugin) {
    const missing = REQUIRED_CAPABILITIES.filter(k => !plugin[k]);
    if (missing.length)           return { valid: false, reason: `missing capabilities: ${missing.join(', ')}` };
    if (!DETERMINISM_LEVELS.includes(plugin.determinismLevel))
                                  return { valid: false, reason: `unknown determinismLevel: ${plugin.determinismLevel}` };
    if (!AUTHORITY_LEVELS.includes(plugin.authorityLevel))
                                  return { valid: false, reason: `unknown authorityLevel: ${plugin.authorityLevel}` };
    if (plugin.bypassGovernance)  return { valid: false, reason: 'plugins cannot declare bypassGovernance' };
    return { valid: true };
  }

  register(plugin) {
    const result = this.validate(plugin);
    if (!result.valid) {
      eventBus.emit(eventBus.BUS_EVENTS.PLUGIN.REJECTED, { name: plugin.name, reason: result.reason });
      throw new Error(`Plugin rejected: ${result.reason}`);
    }
    this._plugins.set(plugin.name, plugin);
    eventBus.emit(eventBus.BUS_EVENTS.PLUGIN.REGISTERED, {
      name:             plugin.name,
      version:          plugin.version,
      determinismLevel: plugin.determinismLevel,
      authorityLevel:   plugin.authorityLevel,
    });
    return plugin;
  }

  get(name)  { return this._plugins.get(name); }
  getAll()   { return [...this._plugins.values()]; }
}

module.exports = { PluginRegistry, DETERMINISM_LEVELS, REPLAYABILITY_LEVELS, AUTHORITY_LEVELS, HA_SAFETY_LEVELS };
