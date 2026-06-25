'use strict';
const { PluginRegistry } = require('./PluginRegistry');
const registry = new PluginRegistry();

function register(plugin) { return registry.register(plugin); }
function get(name)         { return registry.get(name); }
function getAll()          { return registry.getAll(); }

module.exports = { register, get, getAll, PluginRegistry };
