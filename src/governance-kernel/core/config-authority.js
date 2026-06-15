'use strict';
/**
 * governed-config.js
 *
 * Versioned, hashed, operator-attributed configuration management.
 * Wraps thresholds.json with full change history and justification requirements.
 */

const crypto = require('node:crypto');
const fs     = require('node:fs');
const path   = require('node:path');
const clock  = require('./clock');

// ── Helpers ───────────────────────────────────────────────────────────────────

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function configHash(obj) {
  return crypto.createHash('sha256').update(stableStringify(obj)).digest('hex').slice(0, 16);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getByDotPath(obj, dotPath) {
  return dotPath.split('.').reduce((acc, k) => acc?.[k], obj);
}

function setByDotPath(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cursor  = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cursor[parts[i]] == null || typeof cursor[parts[i]] !== 'object') {
      cursor[parts[i]] = {};
    }
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
}

function diffKeys(prev, next, prefix = '') {
  const changed = [];
  const allKeys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next ?? {})]);
  for (const k of allKeys) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    const pv = prev?.[k];
    const nv = next?.[k];
    if (typeof pv === 'object' && pv !== null && typeof nv === 'object' && nv !== null) {
      changed.push(...diffKeys(pv, nv, fullKey));
    } else if (pv !== nv) {
      changed.push(fullKey);
    }
  }
  return changed;
}

// ── GovernedConfig class ──────────────────────────────────────────────────────

class GovernedConfig {
  /**
   * @param {object} initialConfig   — loaded thresholds.json
   * @param {object} [operatorLedger] — optional ledger for audit trail
   */
  constructor(initialConfig, operatorLedger) {
    this._config         = deepClone(initialConfig ?? {});
    this._operatorLedger = operatorLedger ?? null;
    this._frozen         = false;
    this._version        = 1;
    this._history        = [];
    this._pool           = null;

    // Record initial snapshot
    this._history.push(Object.freeze({
      config_version:       1,
      previous_version:     null,
      changed_keys:         [],
      justification:        'initial_load',
      operator_id:          'system',
      ts:                   clock.nowIso(),
      config_hash:          configHash(this._config),
      previous_config_hash: null,
    }));
  }

  setPool(pool) {
    this._pool = pool;
  }

  // ── DB init ─────────────────────────────────────────────────────────────────

  async initFromDb(pool) {
    const p = pool || this._pool;
    if (!p) return;

    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS governed_config_history (
          id             BIGSERIAL PRIMARY KEY,
          config_version INT NOT NULL,
          config_hash    VARCHAR(32) NOT NULL,
          prev_hash      VARCHAR(32),
          operator_id    VARCHAR(255),
          justification  TEXT,
          changed_keys   JSONB,
          snapshot       JSONB NOT NULL,
          ts             TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Load latest config version from DB
      const r = await p.query(
        'SELECT * FROM governed_config_history ORDER BY config_version DESC LIMIT 1'
      );
      if (r.rows.length) {
        const row = r.rows[0];
        if (row.snapshot && typeof row.snapshot === 'object') {
          this._config  = deepClone(row.snapshot);
          this._version = row.config_version;
        }
      }
    } catch { /* non-fatal */ }
  }

  async persistSnapshot(pool, snap) {
    const p = pool || this._pool;
    if (!p) return;
    try {
      await p.query(
        `INSERT INTO governed_config_history
           (config_version, config_hash, prev_hash, operator_id, justification, changed_keys, snapshot, ts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          snap.config_version,
          snap.config_hash,
          snap.previous_config_hash ?? null,
          snap.operator_id ?? null,
          snap.justification ?? null,
          JSON.stringify(snap.changed_keys ?? []),
          JSON.stringify(this._config),
          snap.ts,
        ]
      );
    } catch { /* fire-and-forget: non-fatal */ }
  }

  get(keyPath) {
    return getByDotPath(this._config, keyPath);
  }

  getAll() {
    return Object.freeze(deepClone(this._config));
  }

  /**
   * Apply changes to the config.
   * @param {object} changes   — { 'recovery.backend_restart_ms': 35000, ... }
   * @param {object} opts      — { justification, operator_id }
   * @throws if frozen or no justification
   * @returns config snapshot
   */
  update(changes, opts = {}) {
    if (this._frozen) {
      throw new Error('GovernedConfig is frozen — updates are blocked');
    }

    const { justification, operator_id } = opts;
    if (!justification) {
      throw new Error('GovernedConfig.update() requires opts.justification');
    }

    const previousConfig = deepClone(this._config);
    const previousHash   = configHash(previousConfig);

    for (const [dotPath, value] of Object.entries(changes)) {
      setByDotPath(this._config, dotPath, value);
    }

    const newHash      = configHash(this._config);
    const changedKeys  = diffKeys(previousConfig, this._config);
    const prevVersion  = this._version;
    this._version     += 1;

    const snap = Object.freeze({
      config_version:       this._version,
      previous_version:     prevVersion,
      changed_keys:         changedKeys,
      justification,
      operator_id:          operator_id ?? null,
      ts:                   clock.nowIso(),
      config_hash:          newHash,
      previous_config_hash: previousHash,
    });

    this._history.push(snap);

    // Fire-and-forget DB persist
    if (this._pool) {
      this.persistSnapshot(this._pool, snap).catch(() => {});
    }

    // Write to ledger if available
    if (this._operatorLedger) {
      try {
        this._operatorLedger.appendEntry({
          operator_id:      operator_id ?? null,
          action_type:      'config_changed',
          justification,
          before_state_hash: previousHash,
          after_state_hash:  newHash,
        });
      } catch { /* ledger failure must not block config update */ }
    }

    return snap;
  }

  snapshot() {
    return this._history[this._history.length - 1];
  }

  rollbackTo(version) {
    const snap = this._history.find(h => h.config_version === version);
    if (!snap) throw new Error(`Config version ${version} not found in history`);
    throw new Error(
      'rollbackTo() requires full config snapshots stored in history. ' +
      `Version ${version} snapshot exists but full config state was not captured. ` +
      'Use an external backup or re-apply changes manually.'
    );
  }

  freeze() {
    this._frozen = true;
  }

  unfreeze() {
    this._frozen = false;
  }

  isFrozen() {
    return this._frozen;
  }

  getHistory() {
    return [...this._history];
  }

  saveHistory(dir) {
    const targetDir = dir ?? path.join(process.cwd(), 'reports');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, 'config-history.json'),
      JSON.stringify({
        generated_at:   new Date().toISOString(),
        current_version: this._version,
        frozen:          this._frozen,
        history:         this._history,
      }, null, 2)
    );
  }
}

// ── Singleton accessor API ─────────────────────────────────────────────────────

let _singleton = null;

function setInstance(instance) {
  _singleton = instance;
}

function getInstance() {
  return _singleton;
}

// ── Threshold accessor helpers ────────────────────────────────────────────────

function getThreshold(dotPath) {
  return _singleton ? _singleton.get(dotPath) : undefined;
}

function requireThreshold(dotPath) {
  const value = getThreshold(dotPath);
  if (value === undefined) {
    throw new Error(
      `governed-config: required threshold '${dotPath}' is undefined. ` +
      'Ensure governed-config singleton is initialised before calling requireThreshold().'
    );
  }
  return value;
}

function getThresholdSnapshot() {
  if (!_singleton) return { config_hash: null, config_version: 0, snapshot: {} };
  return {
    config_hash:    _singleton.snapshot().config_hash,
    config_version: _singleton._version,
    snapshot:       _singleton.getAll(),
  };
}

function getThresholdVersion() {
  return _singleton ? _singleton._version : 0;
}

function setPool(pool) {
  if (_singleton) _singleton.setPool(pool);
}

async function initFromDb(pool) {
  if (_singleton) await _singleton.initFromDb(pool);
}

module.exports = {
  GovernedConfig,
  setInstance,
  getInstance,
  getThreshold,
  requireThreshold,
  getThresholdSnapshot,
  getThresholdVersion,
  setPool,
  initFromDb,
};
