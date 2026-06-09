'use strict';
/**
 * governed-config.js — OTA config access routes through kernel ConfigAuthority.
 *
 * OTA runtime MUST NOT use lib/governed-config singleton directly.
 * All config reads and writes route through ConfigAuthority.
 *
 * This preserves:
 *   - Hash chain integrity (ConfigAuthority.update() maintains chain)
 *   - Snapshot semantics (ConfigAuthority.snapshot())
 *   - Freeze behavior (ConfigAuthority.isFrozen())
 *   - Versioning (ConfigAuthority.version())
 *
 * OTA runtime MAY:
 *   - Read config via get() and require()
 *   - Update config via update() with required justification
 *   - Inspect snapshot and version
 *
 * OTA runtime MAY NOT:
 *   - Mutate config in replay mode
 *   - Bypass justification requirement on update()
 *   - Access governed-config singleton directly
 */

const replayHooks = require('./replay-hooks');

class GovernedConfig {
  constructor() {
    this._configAuthority = null;
    this._auditLedger     = null;
    this._eventBus        = null;
    this._BUS_EVENTS      = null;
  }

  init(deps = {}) {
    this._configAuthority = deps.configAuthority;
    this._auditLedger     = deps.auditLedger;
    this._eventBus        = deps.eventBus ?? null;
    this._BUS_EVENTS      = deps.eventBus?.BUS_EVENTS ?? null;
  }

  _requireInit() {
    if (!this._configAuthority || !this._auditLedger) {
      throw new Error('GovernedConfig: not initialized — call init(deps) before use');
    }
  }

  _ledgerEntry(opts) {
    try {
      this._auditLedger.appendEntry({
        action_type:   opts.action_type,
        operator_id:   opts.operator_id ?? null,
        justification: opts.justification ?? '',
        before_state_hash: opts.before_state_hash ?? null,
        after_state_hash:  opts.after_state_hash  ?? null,
      });
    } catch { /* non-fatal */ }
  }

  _emit(eventType, fields) {
    if (!this._eventBus) return;
    try { this._eventBus.emit(eventType, fields); } catch { /* non-fatal */ }
  }

  // ── Read access (safe in replay) ──────────────────────────────────────────

  /**
   * Get a config value by dot-path.
   * @param {string} dotPath — e.g. 'ota.ring1_max_pct'
   */
  get(dotPath) {
    this._requireInit();
    return this._configAuthority.get(dotPath);
  }

  /**
   * Get a config value by dot-path; throws if undefined.
   * @param {string} dotPath
   */
  require(dotPath) {
    this._requireInit();
    return this._configAuthority.require(dotPath);
  }

  /**
   * Returns frozen snapshot of current config with hash and version.
   */
  snapshot() {
    this._requireInit();
    return this._configAuthority.snapshot();
  }

  /**
   * Returns all config values as frozen object.
   */
  getAll() {
    this._requireInit();
    return this._configAuthority.getAll();
  }

  /**
   * Returns current config version.
   */
  version() {
    this._requireInit();
    return this._configAuthority.version();
  }

  isFrozen() {
    this._requireInit();
    return this._configAuthority.isFrozen();
  }

  // ── Write access (blocked in replay) ─────────────────────────────────────

  /**
   * Update config via ConfigAuthority. Justification is required.
   * Routes through hash chain — produces new version with before/after hashes.
   *
   * @param {object} changes    — { 'ota.ring1_max_pct': 25, ... }
   * @param {object} opts       — { justification, operator_id }
   * @returns {object} snapshot — { config_version, config_hash, previous_config_hash, ... }
   */
  update(changes, opts = {}) {
    this._requireInit();
    replayHooks.assertNotReplay('config.update');

    if (!opts.justification) {
      throw new Error('GovernedConfig.update() requires opts.justification');
    }

    const beforeSnap = this._configAuthority.snapshot();
    const snap = this._configAuthority.update(changes, opts);

    this._ledgerEntry({
      action_type:        'config_changed',
      operator_id:        opts.operator_id,
      justification:      opts.justification,
      before_state_hash:  beforeSnap?.config_hash ?? null,
      after_state_hash:   snap?.config_hash       ?? null,
    });

    this._emit(this._BUS_EVENTS?.CONFIG?.UPDATED ?? 'governance.config.updated', {
      operator_id:        opts.operator_id ?? null,
      config_version:     snap?.config_version,
      config_hash:        snap?.config_hash,
      previous_hash:      snap?.previous_config_hash ?? null,
      changed_keys:       snap?.changed_keys ?? [],
      lineage_ts:         new Date().toISOString(),
    });

    return snap;
  }
}

module.exports = { GovernedConfig };
