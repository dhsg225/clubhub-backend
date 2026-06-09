'use strict';

/**
 * ConfigProposalBuilder — builds governed config change proposals.
 *
 * Constructs a proposal object with full attribution, diff, hash preview,
 * and certification impact before submission to the API gateway.
 *
 * This is a pure client-side builder. It does NOT call kernel APIs.
 * The server-side route calls ConfigAuthority.update() after validation.
 *
 * UI_AUTHORITY_BOUNDARY: No kernel imports. Pure proposal construction.
 */

const crypto = require('crypto');

// Stable JSON stringify (matches core/deterministic-id.js _stableStringify)
function _stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(_stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + _stableStringify(obj[k])).join(',') + '}';
}

function _configHash(config) {
  return crypto.createHash('sha256').update(_stableStringify(config)).digest('hex').slice(0, 16);
}

const PROPOSAL_STATES = Object.freeze({
  DRAFT: 'DRAFT',
  PREVIEWED: 'PREVIEWED',
  SUBMITTED: 'SUBMITTED',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
  STALE_DRAFT: 'STALE_DRAFT',
});

class ConfigProposalBuilder {
  constructor(opts = {}) {
    this._currentSnapshot = null;  // ConfigAuthority.snapshot() result
    this._changes = {};
    this._justification = '';
    this._operatorContext = null;  // { oid, role, jti }
    this._state = PROPOSAL_STATES.DRAFT;
    this._preview = null;
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  setCurrentSnapshot(snapshot) {
    // snapshot: { config: { ... }, config_hash, version }
    this._currentSnapshot = snapshot;
    // Invalidate any existing preview
    if (this._state === PROPOSAL_STATES.PREVIEWED) {
      this._state = PROPOSAL_STATES.DRAFT;
      this._preview = null;
    }
    return this;
  }

  setOperatorContext(ctx) {
    // ctx: { oid, role, jti }
    this._operatorContext = ctx;
    return this;
  }

  setChange(dotPath, newValue) {
    this._changes[dotPath] = newValue;
    this._state = PROPOSAL_STATES.DRAFT;
    this._preview = null;
    return this;
  }

  setChanges(changesMap) {
    this._changes = { ...this._changes, ...changesMap };
    this._state = PROPOSAL_STATES.DRAFT;
    this._preview = null;
    return this;
  }

  setJustification(justification) {
    this._justification = justification;
    return this;
  }

  // ─── Preview ──────────────────────────────────────────────────────────────

  /**
   * Compute preview: diff, hash preview, certification impact, replay impact.
   * Must be called before build().
   */
  preview() {
    if (!this._currentSnapshot) throw new Error('Call setCurrentSnapshot() before preview()');
    if (Object.keys(this._changes).length === 0) throw new Error('No changes to preview');

    const beforeConfig = this._currentSnapshot.config || {};
    const afterConfig = this._applyChanges(beforeConfig, this._changes);
    const hashBefore = this._currentSnapshot.config_hash || _configHash(beforeConfig);
    const hashAfter = _configHash(afterConfig);

    const diff = this._computeDiff(beforeConfig, this._changes);
    const certImpact = this._computeCertImpact(this._changes);
    const replayImpact = this._computeReplayImpact(this._changes);
    const rollbackProposal = { changes: this._invertChanges(beforeConfig, this._changes) };

    this._preview = {
      diff,
      config_hash_before: hashBefore,
      config_hash_after: hashAfter,
      hash_changed: hashBefore !== hashAfter,
      certification_impact: certImpact,
      replay_impact: replayImpact,
      rollback_proposal: rollbackProposal,
      consistency_warning: 'Config changes are MEMORY_ONLY (M+async). Other instances must restart or call initFromDb(pool) to see this change.',
    };

    this._state = PROPOSAL_STATES.PREVIEWED;
    return this._preview;
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  /**
   * Build the final proposal object for submission.
   * Returns the proposal payload for POST /governance/config/proposals.
   */
  build() {
    if (this._state !== PROPOSAL_STATES.PREVIEWED) {
      throw new Error('Call preview() before build()');
    }
    if (!this._justification.trim()) {
      throw new Error('justification is required (ConfigAuthority.update() requires opts.justification)');
    }
    if (!this._operatorContext) {
      throw new Error('operatorContext required — call setOperatorContext()');
    }

    return {
      changes: { ...this._changes },
      justification: this._justification,
      operator_id: this._operatorContext.oid,
      role: this._operatorContext.role,
      jti: this._operatorContext.jti,
      config_hash_before: this._preview.config_hash_before,
      config_hash_after: this._preview.config_hash_after,
      diff: this._preview.diff,
      certification_impact: this._preview.certification_impact,
      replay_impact: this._preview.replay_impact,
    };
  }

  invalidate(reason) {
    if (this._state === PROPOSAL_STATES.DRAFT || this._state === PROPOSAL_STATES.PREVIEWED) {
      this._state = PROPOSAL_STATES.STALE_DRAFT;
      this._staleReason = reason;
    }
  }

  getState() { return this._state; }
  getPreview() { return this._preview; }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _applyChanges(config, changes) {
    const result = JSON.parse(JSON.stringify(config)); // deep clone
    for (const [dotPath, value] of Object.entries(changes)) {
      const parts = dotPath.split('.');
      let cur = result;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
    }
    return result;
  }

  _invertChanges(config, changes) {
    const rollback = {};
    for (const dotPath of Object.keys(changes)) {
      const parts = dotPath.split('.');
      let cur = config;
      for (const p of parts) cur = cur?.[p];
      rollback[dotPath] = cur ?? null;
    }
    return rollback;
  }

  _computeDiff(config, changes) {
    return Object.entries(changes).map(([dotPath, newVal]) => {
      const parts = dotPath.split('.');
      let cur = config;
      for (const p of parts) cur = cur?.[p];
      return { path: dotPath, before: cur ?? null, after: newVal };
    });
  }

  _computeCertImpact(changes) {
    const warnings = [];
    for (const path of Object.keys(changes)) {
      if (path.includes('MAX_NODES') || path.includes('max_nodes')) {
        warnings.push({ severity: 'REQUIRES_RFC', message: 'Changing MAX_NODES requires Governance RFC (T0)' });
      }
      if (path.includes('MAX_LEDGER') || path.includes('MAX_ACTIVE')) {
        warnings.push({ severity: 'REQUIRES_RFC', message: 'Changing resource ceiling requires Governance RFC (T0)' });
      }
      if (path.includes('freeze') || path.includes('FAIL_CLOSED')) {
        warnings.push({ severity: 'WARNING', message: 'Freeze policy change may affect HAConsistencyCertification — re-run recommended' });
      }
    }
    return warnings;
  }

  _computeReplayImpact(changes) {
    const policyPaths = ['ota.min_success_rate', 'ota.stale_threshold_ms'];
    const affected = Object.keys(changes).filter(p => policyPaths.some(pp => p.startsWith(pp)));
    if (affected.length > 0) {
      return {
        affected: true,
        message: 'Config threshold changes may cause policy decisions to differ in replay (POSSIBLY_INCOMPATIBLE)',
        affected_paths: affected,
      };
    }
    return { affected: false, message: 'No replay impact detected' };
  }
}

module.exports = { ConfigProposalBuilder, PROPOSAL_STATES };
