'use strict';

/**
 * ConfigDiffEngine — computes and formats config diffs for operator review.
 *
 * Produces human-readable and machine-readable diffs between config versions.
 * Used by ConfigProposalBuilder and the config mutation UX.
 *
 * UI_AUTHORITY_BOUNDARY: Pure computation. No kernel imports.
 */

const crypto = require('crypto');

function _stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(_stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + _stableStringify(obj[k])).join(',') + '}';
}

class ConfigDiffEngine {
  /**
   * Compute diff between two flat-or-nested config objects.
   * Returns: array of { path, before, after, type, impact }
   */
  static diff(before, after) {
    const result = [];
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    for (const key of allKeys) {
      const bVal = (before || {})[key];
      const aVal = (after || {})[key];

      if (typeof bVal === 'object' && typeof aVal === 'object' && bVal !== null && aVal !== null) {
        // Recurse into nested objects
        const nested = ConfigDiffEngine.diff(bVal, aVal);
        for (const entry of nested) {
          result.push({ ...entry, path: `${key}.${entry.path}` });
        }
      } else if (_stableStringify(bVal) !== _stableStringify(aVal)) {
        result.push({
          path: key,
          before: bVal ?? null,
          after: aVal ?? null,
          type: bVal === undefined ? 'ADDED' : aVal === undefined ? 'REMOVED' : 'CHANGED',
          impact: ConfigDiffEngine._classifyImpact(key, bVal, aVal),
        });
      }
    }

    return result;
  }

  /**
   * Apply a set of dot-path changes to a config object.
   * Returns new config object (original not mutated).
   */
  static apply(config, changes) {
    const result = JSON.parse(JSON.stringify(config || {}));
    for (const [dotPath, value] of Object.entries(changes)) {
      const parts = dotPath.split('.');
      let cur = result;
      for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) {
          cur[parts[i]] = {};
        }
        cur = cur[parts[i]];
      }
      if (value === undefined) {
        delete cur[parts[parts.length - 1]];
      } else {
        cur[parts[parts.length - 1]] = value;
      }
    }
    return result;
  }

  /**
   * Compute deterministic hash of config object.
   * Matches core/deterministic-id.js _stableStringify + SHA-256.
   */
  static hash(config) {
    return crypto
      .createHash('sha256')
      .update(_stableStringify(config || {}))
      .digest('hex')
      .slice(0, 16);
  }

  /**
   * Format diff as human-readable lines for display.
   */
  static format(diffEntries) {
    return diffEntries.map(e => {
      const impact = e.impact ? `  IMPACT: ${e.impact}` : '';
      if (e.type === 'ADDED') {
        return `  + ${e.path}: (new) → ${JSON.stringify(e.after)}${impact}`;
      }
      if (e.type === 'REMOVED') {
        return `  - ${e.path}: ${JSON.stringify(e.before)} → (removed)${impact}`;
      }
      return `  ${e.path}\n    - BEFORE: ${JSON.stringify(e.before)}\n    + AFTER:  ${JSON.stringify(e.after)}${impact ? '\n    ' + impact : ''}`;
    }).join('\n\n');
  }

  /**
   * Returns true if the diff contains any changes that require a Governance RFC.
   */
  static requiresRFC(diffEntries) {
    const rfcPaths = ['MAX_NODES', 'MAX_LEDGER_ENTRIES', 'MAX_ACTIVE_INCIDENTS', 'FAIL_CLOSED', 'FAIL_OPEN'];
    return diffEntries.some(e => rfcPaths.some(p => e.path.toUpperCase().includes(p)));
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  static _classifyImpact(path, before, after) {
    const p = path.toLowerCase();

    if (p.includes('min_success_rate')) {
      const change = (after ?? 0) - (before ?? 0);
      return change > 0
        ? 'Stricter success threshold — may trigger more frequent freeze'
        : 'Looser success threshold — deployment gate relaxed';
    }
    if (p.includes('stale_threshold')) {
      const change = (after ?? 0) - (before ?? 0);
      return change < 0
        ? 'Shorter stale window — more frequent DB authority checks'
        : 'Longer stale window — increased cache tolerance';
    }
    if (p.includes('max_nodes') || p.includes('max_screens')) {
      return 'Resource ceiling change — REQUIRES Governance RFC (T0)';
    }
    if (p.includes('max_active_incidents') || p.includes('max_ledger')) {
      return 'Resource ceiling change — REQUIRES Governance RFC (T0)';
    }
    if (p.includes('fail_closed') || p.includes('fail_open') || p.includes('stale_ok')) {
      return 'Freeze failure policy change — HAConsistencyCertification re-run required';
    }
    return null;
  }
}

module.exports = { ConfigDiffEngine };
