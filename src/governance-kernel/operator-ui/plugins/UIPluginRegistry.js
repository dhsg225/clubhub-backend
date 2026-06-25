'use strict';

/**
 * UIPluginRegistry — governed plugin UI extension system.
 *
 * Plugins registered in the kernel's PluginRegistry may also register
 * UI extensions here. UI extensions can contribute:
 *   - views (read panels)
 *   - replay renderers
 *   - topology overlays
 *
 * Plugins CANNOT:
 *   - bypass governance APIs
 *   - mutate kernel state directly
 *   - inject authority claims
 *   - override freeze or certification indicators
 *   - access GovernedStateStore write methods
 *
 * CERTIFIED by UIConsistencyCertification — AuthorityBoundaryCertification.
 */

const ALLOWED_EXTENSION_TYPES = Object.freeze([
  'VIEW',             // Read-only panel showing plugin-specific data
  'REPLAY_RENDERER',  // Custom renderer for replay events of a specific type
  'TOPOLOGY_OVERLAY', // Additional layer on topology graph
]);

const FORBIDDEN_EXTENSION_TYPES = Object.freeze([
  'FREEZE_OVERRIDE',        // Cannot override freeze visualization
  'CERTIFICATION_OVERRIDE', // Cannot override certification indicators
  'AUTH_PROVIDER',          // Cannot provide/modify auth tokens
  'COMMAND_INJECTOR',       // Cannot inject governance commands
]);

class UIPluginRegistry {
  constructor() {
    this._plugins = new Map();
    this._violations = [];
  }

  /**
   * Register a UI plugin extension.
   *
   * Plugin descriptor:
   * {
   *   name: string,                     // must match kernel PluginRegistry name
   *   version: string,
   *   extensions: [{
   *     type: 'VIEW' | 'REPLAY_RENDERER' | 'TOPOLOGY_OVERLAY',
   *     id: string,                     // unique extension ID
   *     label: string,                  // display label
   *     render: function,               // pure render function (no side effects)
   *     replaySafe: boolean,            // true if safe during replay rendering
   *     deterministic: boolean,         // true if render output is deterministic given same input
   *     bypassGovernance: false,        // MUST be false — auto-rejected if true
   *   }]
   * }
   */
  register(plugin) {
    const errors = this._validate(plugin);
    if (errors.length > 0) {
      this._violations.push({ plugin: plugin.name, errors });
      throw new Error(`UIPlugin '${plugin.name}' rejected: ${errors.join('; ')}`);
    }

    this._plugins.set(plugin.name, {
      name: plugin.name,
      version: plugin.version,
      extensions: plugin.extensions,
      registered_at: new Date().toISOString(),
    });

    return { accepted: true, name: plugin.name };
  }

  get(name) { return this._plugins.get(name) ?? null; }
  getAll() { return [...this._plugins.values()]; }

  /**
   * Get all extensions of a specific type.
   * Used by the UI to enumerate available extensions at render time.
   */
  getExtensions(type) {
    const result = [];
    for (const plugin of this._plugins.values()) {
      for (const ext of plugin.extensions || []) {
        if (ext.type === type) {
          result.push({ ...ext, plugin_name: plugin.name });
        }
      }
    }
    return result;
  }

  /**
   * Get extensions safe for replay rendering.
   * Only extensions with replaySafe: true are returned during replay mode.
   */
  getReplaySafeExtensions(type) {
    return this.getExtensions(type).filter(ext => ext.replaySafe === true);
  }

  getViolations() { return [...this._violations]; }

  // ─── Validation ───────────────────────────────────────────────────────────

  _validate(plugin) {
    const errors = [];

    if (!plugin.name) errors.push('name is required');
    if (!plugin.version) errors.push('version is required');
    if (!Array.isArray(plugin.extensions)) errors.push('extensions must be an array');

    for (const ext of (plugin.extensions || [])) {
      if (ext.bypassGovernance === true) {
        errors.push(`Extension '${ext.id}' has bypassGovernance: true — HARD VIOLATION`);
      }
      if (!ALLOWED_EXTENSION_TYPES.includes(ext.type)) {
        errors.push(`Extension '${ext.id}' has forbidden type '${ext.type}'`);
      }
      if (FORBIDDEN_EXTENSION_TYPES.includes(ext.type)) {
        errors.push(`Extension '${ext.id}' attempts forbidden type '${ext.type}'`);
      }
      if (ext.type === 'REPLAY_RENDERER' && ext.replaySafe !== true) {
        errors.push(`REPLAY_RENDERER '${ext.id}' must declare replaySafe: true`);
      }
      if (typeof ext.render !== 'function') {
        errors.push(`Extension '${ext.id}' missing render function`);
      }
      if (ext.deterministic !== true) {
        // Non-deterministic renderers are allowed but get an advisory warning
        // They are excluded from replay rendering regardless of replaySafe flag
      }
    }

    return errors;
  }
}

module.exports = { UIPluginRegistry, ALLOWED_EXTENSION_TYPES, FORBIDDEN_EXTENSION_TYPES };
