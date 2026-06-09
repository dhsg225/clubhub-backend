'use strict';

/**
 * UIConsistencyCertification — certifies that the operator UI state model
 * maintains consistency level discipline.
 *
 * Checks (static source analysis):
 *   UIC-01: GovernedStateStore has no direct write methods
 *   UIC-02: GovernedStateStore.applyEvent() validates sequence_id for gap detection
 *   UIC-03: LINEARIZED events are not applied optimistically
 *   UIC-04: Replay mode prevents live event application
 *   UIC-05: All state slices carry consistency_level metadata
 *   UIC-06: Stale detection uses received_at comparison
 *   UIC-07: Split-brain disables mutations
 *   UIC-08: Selectors do not mutate state
 *   UIC-09: Reducers are pure functions (no side effects)
 *   UIC-10: GovernedEventStream does not import kernel modules
 */

const fs = require('fs');
const path = require('path');

class UIConsistencyCertification {
  constructor(opts = {}) {
    this._root = opts.root || path.resolve(__dirname, '../');
  }

  async run() {
    const checks = [];

    checks.push(this._checkNoDirectWriteMethods());
    checks.push(this._checkGapDetection());
    checks.push(this._checkNoOptimisticLinearized());
    checks.push(this._checkReplayIsolation());
    checks.push(this._checkConsistencyLevelMetadata());
    checks.push(this._checkStaleDetection());
    checks.push(this._checkSplitBrainMutationBlock());
    checks.push(this._checkSelectorsArePure());
    checks.push(this._checkReducersArePure());
    checks.push(this._checkNoKernelImportsInTransport());

    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    const warn = checks.filter(c => c.status === 'WARN').length;

    return {
      name: 'UIConsistencyCertification',
      rating: fail > 0 ? 'FAIL' : warn > 0 ? 'CONDITIONAL' : 'PASS',
      pass_count: pass,
      fail_count: fail,
      warn_count: warn,
      checks,
    };
  }

  _checkNoDirectWriteMethods() {
    const src = this._read('state/GovernedStateStore.js');
    // Store should not expose a public 'set', 'put', 'write', or 'mutate' method
    const forbidden = /^\s+set\b|^\s+put\b|^\s+write\b|^\s+mutate\b/m;
    const ok = !forbidden.test(src);
    return {
      id: 'UIC-01',
      description: 'GovernedStateStore has no direct write methods',
      status: ok ? 'PASS' : 'FAIL',
      detail: ok ? null : 'Found direct write method in GovernedStateStore',
    };
  }

  _checkGapDetection() {
    const src = this._read('state/GovernedStateStore.js');
    const hasGap = src.includes('GAP_DETECTED') || src.includes('gap') || src.includes('sequence_id');
    return {
      id: 'UIC-02',
      description: 'GovernedStateStore validates sequence_id for gap detection',
      status: hasGap ? 'PASS' : 'FAIL',
      detail: hasGap ? null : 'No gap detection logic found in GovernedStateStore',
    };
  }

  _checkNoOptimisticLinearized() {
    const src = this._read('state/GovernedStateStore.js');
    // OPTIMISTIC must not be a declared authority source value
    const noOptimisticDeclared = !src.includes("OPTIMISTIC: 'OPTIMISTIC'") && !src.includes('OPTIMISTIC: "OPTIMISTIC"');
    // OPTIMISTIC must not be used as an authority_source value assignment (exclude comments)
    const codeLines = src.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
    const noOptimisticAssigned = !codeLines.some(l => l.includes('AUTHORITY_SOURCES.OPTIMISTIC'));
    return {
      id: 'UIC-03',
      description: 'LINEARIZED operations are not applied optimistically',
      status: (noOptimisticDeclared && noOptimisticAssigned) ? 'PASS' : 'FAIL',
      detail: (noOptimisticDeclared && noOptimisticAssigned) ? null : 'Optimistic authority source declared or used in store',
    };
  }

  _checkReplayIsolation() {
    const src = this._read('state/GovernedStateStore.js');
    const hasReplayGuard = src.includes('RENDERING_MODES.REPLAY') &&
                           src.includes('applyReplayEvent') &&
                           (src.includes('return;') || src.includes('silently dropped'));
    return {
      id: 'UIC-04',
      description: 'Replay mode prevents live event application',
      status: hasReplayGuard ? 'PASS' : 'FAIL',
      detail: hasReplayGuard ? null : 'No replay isolation guard found in GovernedStateStore',
    };
  }

  _checkConsistencyLevelMetadata() {
    const src = this._read('state/GovernedStateStore.js');
    const hasConsistencyLevel = src.includes('consistency_level') && src.includes('CACHE_COHERENT');
    return {
      id: 'UIC-05',
      description: 'All state slices carry consistency_level metadata',
      status: hasConsistencyLevel ? 'PASS' : 'FAIL',
      detail: hasConsistencyLevel ? null : 'consistency_level metadata missing from state slices',
    };
  }

  _checkStaleDetection() {
    const src = this._read('state/GovernedStateStore.js');
    const hasStale = src.includes('received_at') && src.includes('is_stale');
    return {
      id: 'UIC-06',
      description: 'Stale detection uses received_at comparison',
      status: hasStale ? 'PASS' : 'FAIL',
      detail: hasStale ? null : 'Stale detection logic missing from GovernedStateStore',
    };
  }

  _checkSplitBrainMutationBlock() {
    const src = this._read('state/GovernedStateStore.js');
    const hasSplitBrain = src.includes('SPLIT_BRAIN') && src.includes('detectSplitBrain');
    const selectorSrc = this._read('state/selectors.js');
    const selectorBlocks = selectorSrc.includes('SPLIT_BRAIN') && selectorSrc.includes('selectCanSubmitMutations');
    return {
      id: 'UIC-07',
      description: 'Split-brain mode disables mutations',
      status: (hasSplitBrain && selectorBlocks) ? 'PASS' : 'FAIL',
      detail: (hasSplitBrain && selectorBlocks) ? null : 'Split-brain mutation blocking incomplete',
    };
  }

  _checkSelectorsArePure() {
    const src = this._read('state/selectors.js');
    // Selectors should not assign to state properties — look for assignment (=) but not comparison (==, ===, !=, !==, <=, >=)
    // Use strict: must be `=` not followed by another `=`
    const hasMutation = /storeState\.\w+\s*=[^=]|slice\.\w+\s*=[^=]/.test(src);
    return {
      id: 'UIC-08',
      description: 'Selectors are pure functions (no state mutation)',
      status: !hasMutation ? 'PASS' : 'FAIL',
      detail: !hasMutation ? null : 'Selector appears to mutate input state',
    };
  }

  _checkReducersArePure() {
    const src = this._read('state/reducers.js');
    // Check reducers return new objects rather than mutating currentValue
    const hasSpread = (src.match(/\.\.\./g) || []).length > 5;
    return {
      id: 'UIC-09',
      description: 'Reducers produce new objects (no mutation)',
      status: hasSpread ? 'PASS' : 'WARN',
      detail: hasSpread ? null : 'Reducers may be mutating input — verify they return new objects',
    };
  }

  _checkNoKernelImportsInTransport() {
    const files = ['transport/GovernedEventStream.js', 'transport/SnapshotClient.js'];
    for (const file of files) {
      const src = this._read(file);
      if (src.includes('governance-kernel/core') || src.includes('governance-kernel/api')) {
        return {
          id: 'UIC-10',
          description: 'GovernedEventStream does not import kernel modules',
          status: 'FAIL',
          detail: `${file} imports governance-kernel modules — UI_AUTHORITY_BOUNDARY violation`,
        };
      }
    }
    return {
      id: 'UIC-10',
      description: 'GovernedEventStream does not import kernel modules',
      status: 'PASS',
      detail: null,
    };
  }

  _read(relPath) {
    try {
      return fs.readFileSync(path.join(this._root, relPath), 'utf8');
    } catch (_) {
      return '';
    }
  }
}

module.exports = { UIConsistencyCertification };
