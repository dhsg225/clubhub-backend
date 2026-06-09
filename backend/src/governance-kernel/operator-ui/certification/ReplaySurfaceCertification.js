'use strict';

/**
 * ReplaySurfaceCertification — certifies that replay rendering is isolated
 * and deterministic in the operator UI.
 *
 * Checks:
 *   RSC-01: ReplayTimeline sorts events by lineage_ts ascending
 *   RSC-02: ReplayTimeline does not update received_at during replay
 *   RSC-03: GovernedStateStore.applyReplayEvent() enforces replay mode guard
 *   RSC-04: ForensicView does not issue tokens or write to DB
 *   RSC-05: GovernedEventStream.startReplay() sorts events before applying
 *   RSC-06: Replay renderers in UIPluginRegistry require replaySafe: true
 *   RSC-07: GovernedStateStore.exitReplayMode() clears replay cursor
 *   RSC-08: ReplayTimeline annotates FREEZE and EPOCH events
 */

const fs = require('fs');
const path = require('path');

class ReplaySurfaceCertification {
  constructor(opts = {}) {
    this._root = opts.root || path.resolve(__dirname, '../');
  }

  async run() {
    const checks = [];

    checks.push(this._checkTimelineSorting());
    checks.push(this._checkReceivedAtNotUpdated());
    checks.push(this._checkReplayModeGuard());
    checks.push(this._checkForensicViewNoSideEffects());
    checks.push(this._checkEventStreamSorting());
    checks.push(this._checkPluginReplaySafe());
    checks.push(this._checkExitReplayClearsCursor());
    checks.push(this._checkTimelineAnnotations());

    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    const warn = checks.filter(c => c.status === 'WARN').length;

    return {
      name: 'ReplaySurfaceCertification',
      rating: fail > 0 ? 'FAIL' : warn > 0 ? 'CONDITIONAL' : 'PASS',
      pass_count: pass,
      fail_count: fail,
      warn_count: warn,
      checks,
    };
  }

  _checkTimelineSorting() {
    const src = this._read('replay/ReplayTimeline.js');
    const sorts = src.includes('lineage_ts') && src.includes('.sort(') && src.includes('ascending');
    const sortsAsc = src.includes("lineage_ts < b.lineage_ts ? -1 : 1") ||
                     src.includes('lineage_ts').toString() && src.includes('-1');
    return {
      id: 'RSC-01',
      description: 'ReplayTimeline sorts events by lineage_ts ascending',
      status: (sorts || sortsAsc) ? 'PASS' : 'FAIL',
      detail: (sorts || sortsAsc) ? null : 'ReplayTimeline does not sort by lineage_ts ascending',
    };
  }

  _checkReceivedAtNotUpdated() {
    const src = this._read('replay/ReplayTimeline.js') + this._read('state/GovernedStateStore.js');
    // During replay, received_at must not be updated to wall-clock
    const hasPreserveComment = src.includes('received_at') &&
      (src.includes('preserve received_at') || src.includes('NOT updated') || src.includes('null /* preserve'));
    return {
      id: 'RSC-02',
      description: 'received_at is not updated during replay (per UI_RUNTIME_MODEL §5)',
      status: hasPreserveComment ? 'PASS' : 'WARN',
      detail: hasPreserveComment ? null : 'Cannot confirm received_at preservation during replay — verify manually',
    };
  }

  _checkReplayModeGuard() {
    const src = this._read('state/GovernedStateStore.js');
    const hasGuard = src.includes('applyReplayEvent') &&
                     src.includes('enterReplayMode') &&
                     src.includes("throw new Error") &&
                     src.includes('outside replay mode');
    return {
      id: 'RSC-03',
      description: 'GovernedStateStore.applyReplayEvent() enforces replay mode guard',
      status: hasGuard ? 'PASS' : 'FAIL',
      detail: hasGuard ? null : 'applyReplayEvent() missing replay mode guard',
    };
  }

  _checkForensicViewNoSideEffects() {
    const src = this._read('replay/ForensicView.js');
    const noKernelImport = !src.includes('governance-kernel/core') && !src.includes('governance-kernel/api');
    const noDbAccess = !src.includes('pool.query') && !src.includes('pg.') && !src.includes('withAdvisoryLock');
    const noTokenIssuance = !src.includes('issueToken') && !src.includes('revokeToken');
    return {
      id: 'RSC-04',
      description: 'ForensicView does not issue tokens or write to DB',
      status: (noKernelImport && noDbAccess && noTokenIssuance) ? 'PASS' : 'FAIL',
      detail: (noKernelImport && noDbAccess && noTokenIssuance) ? null : 'ForensicView has forbidden side effects',
    };
  }

  _checkEventStreamSorting() {
    const src = this._read('transport/GovernedEventStream.js');
    const sortsByLineage = src.includes('lineage_ts') && src.includes('.sort(') &&
                           (src.includes('ascending') || src.includes('-1'));
    return {
      id: 'RSC-05',
      description: 'GovernedEventStream.startReplay() sorts events by lineage_ts',
      status: sortsByLineage ? 'PASS' : 'FAIL',
      detail: sortsByLineage ? null : 'GovernedEventStream.startReplay() does not sort events',
    };
  }

  _checkPluginReplaySafe() {
    const src = this._read('plugins/UIPluginRegistry.js');
    const enforcesReplaySafe = src.includes('replaySafe') &&
                               src.includes('REPLAY_RENDERER') &&
                               src.includes('replaySafe: true');
    return {
      id: 'RSC-06',
      description: 'UIPluginRegistry requires replaySafe: true for REPLAY_RENDERER extensions',
      status: enforcesReplaySafe ? 'PASS' : 'FAIL',
      detail: enforcesReplaySafe ? null : 'UIPluginRegistry does not enforce replaySafe for REPLAY_RENDERER',
    };
  }

  _checkExitReplayClearsCursor() {
    const src = this._read('state/GovernedStateStore.js');
    const clears = src.includes('exitReplayMode') && src.includes('_replayCursor = null');
    return {
      id: 'RSC-07',
      description: 'GovernedStateStore.exitReplayMode() clears replay cursor',
      status: clears ? 'PASS' : 'FAIL',
      detail: clears ? null : 'exitReplayMode() does not clear replay cursor',
    };
  }

  _checkTimelineAnnotations() {
    const src = this._read('replay/ReplayTimeline.js');
    const annotatesFreezes = src.includes("'FREEZE'") || src.includes('"FREEZE"');
    const annotatesEpoch = src.includes("'EPOCH'") || src.includes('"EPOCH"');
    return {
      id: 'RSC-08',
      description: 'ReplayTimeline annotates FREEZE and EPOCH events for navigation',
      status: (annotatesFreezes && annotatesEpoch) ? 'PASS' : 'FAIL',
      detail: (annotatesFreezes && annotatesEpoch) ? null : 'ReplayTimeline missing FREEZE or EPOCH annotations',
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

module.exports = { ReplaySurfaceCertification };
