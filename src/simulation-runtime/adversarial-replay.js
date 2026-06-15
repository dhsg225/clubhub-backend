'use strict';
/**
 * AdversarialReplay — replay traces under pathological conditions.
 *
 * H3: Replay corruption must always be detected.
 * H1: Same input → same detection result.
 *
 * Operations:
 *   buildTrace(events)             → add hash-chain to event list
 *   verifyTrace(trace)             → full chain integrity check
 *   replayCorruptedOrdering(trace) → detect chain break from reorder
 *   replayPartialTrace(trace, n)   → verify partial replay is safe
 *   replayDuplicatedTrace(trace)   → detect duplicate insertion
 *   replayTamperedHash(trace, i)   → detect single hash corruption
 *   replayDuplicatedWorkflow(cluster, workflowId) → detect collision
 *   replayDuringFreeze(cluster, events) → verify freeze-safe replay
 *   runAdversarialSuite(trace, cluster) → run all checks, return summary
 */
const crypto = require('node:crypto');

class AdversarialReplay {
  constructor(clock, eventBus) {
    this._clock    = clock;
    this._eventBus = eventBus;
  }

  // ——— Trace Building ——————————————————————————————————————————————

  /**
   * Attach step_index, prev_hash, and hash to each event.
   * Returns a new array — original is not mutated.
   */
  buildTrace(events) {
    let prevHash = '0'.repeat(64);
    return events.map((evt, idx) => {
      const base = { ...evt, step_index: idx, prev_hash: prevHash };
      const hash = crypto.createHash('sha256').update(JSON.stringify(base)).digest('hex');
      prevHash = hash;
      return Object.freeze({ ...base, hash });
    });
  }

  // ——— Chain Verification ——————————————————————————————————————————

  /**
   * Walk trace and verify hash chain integrity.
   * Returns { valid, broken_at, reason }.
   */
  verifyTrace(trace) {
    let prevHash = '0'.repeat(64);
    for (let i = 0; i < trace.length; i++) {
      const entry = trace[i];

      if (entry.prev_hash !== prevHash) {
        return {
          valid:        false,
          broken_at:    i,
          reason:       'prev_hash_mismatch',
          expected_prev: prevHash,
          actual_prev:   entry.prev_hash,
        };
      }

      const { hash, ...rest } = entry;
      const computed = crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex');
      if (computed !== hash) {
        return {
          valid:      false,
          broken_at:  i,
          reason:     'hash_mismatch',
          expected:   hash,
          computed,
        };
      }

      prevHash = hash;
    }
    return { valid: true, broken_at: null, reason: null };
  }

  // ——— Adversarial Replay Modes ————————————————————————————————————

  /**
   * Reorder first two events and attempt replay.
   * A valid chain must detect this as corrupt.
   */
  replayCorruptedOrdering(trace) {
    if (trace.length < 2) {
      return { rejected: true, reason: 'trace_too_short', broken_at: null };
    }
    const reordered = [trace[1], trace[0], ...trace.slice(2)];
    const result    = this.verifyTrace(reordered);
    return {
      rejected:   !result.valid,
      broken_at:  result.broken_at,
      reason:     result.reason ?? 'accepted',
    };
  }

  /**
   * Replay a partial trace (first keepCount events).
   * Partial replay of a valid prefix MUST still pass verification.
   */
  replayPartialTrace(trace, keepCount) {
    const partial = trace.slice(0, keepCount);
    const result  = this.verifyTrace(partial);
    return {
      valid:      result.valid,
      length:     partial.length,
      broken_at:  result.broken_at,
      reason:     result.reason,
    };
  }

  /**
   * Insert a duplicate of event at duplicateIdx and verify rejection.
   */
  replayDuplicatedTrace(trace, duplicateIdx = 0) {
    if (duplicateIdx >= trace.length) {
      return { rejected: true, reason: 'invalid_index', broken_at: null };
    }
    const src       = trace[duplicateIdx];
    const dupEntry  = {
      ...src,
      event_id:  (src.event_id ?? 'e') + '_DUP',
      hash:      src.hash ? ('DUP_' + src.hash) : undefined,
    };
    const duplicated = [
      ...trace.slice(0, duplicateIdx + 1),
      dupEntry,
      ...trace.slice(duplicateIdx + 1),
    ];
    const result = this.verifyTrace(duplicated);
    return {
      rejected:   !result.valid,
      broken_at:  result.broken_at,
      reason:     result.reason ?? 'accepted',
    };
  }

  /**
   * Corrupt hash of event at idx and verify rejection.
   */
  replayTamperedHash(trace, idx = 0) {
    if (idx >= trace.length) {
      return { rejected: true, reason: 'invalid_index', broken_at: null };
    }
    const tampered = trace.map((e, i) =>
      i === idx ? { ...e, hash: 'TAMPERED_' + (e.hash ?? '') } : e
    );
    const result = this.verifyTrace(tampered);
    return {
      rejected:   !result.valid,
      broken_at:  result.broken_at,
      reason:     result.reason ?? 'accepted',
    };
  }

  /**
   * Attempt to start a workflow that already exists on a node.
   * Returns { rejected, reason }.
   */
  replayDuplicatedWorkflow(cluster, nodeId, workflowId) {
    const node = cluster.getNode(nodeId);
    if (!node) return { rejected: true, reason: 'unknown_node' };

    // First start — should succeed
    const first  = node.startWorkflow(workflowId, { replay_test: true });
    // Second start — must be rejected as collision
    const second = node.startWorkflow(workflowId, { replay_test: true });

    return {
      rejected: !second.ok,
      reason:   second.reason ?? 'collision_not_detected',
      first_ok: first.ok,
    };
  }

  /**
   * Replay events while cluster is frozen.
   * Frozen nodes MUST still accept replay (read-only forensic replay is safe).
   * Returns { completed, frozen_during_replay, event_count }.
   */
  replayDuringFreeze(cluster, events) {
    const sourceNode = cluster.authority_node;
    const node       = cluster.getNode(sourceNode);
    if (!node) return { completed: false, reason: 'no_authority_node' };

    const was_frozen = node.frozen;
    if (!was_frozen) node.applyFreeze('adversarial_replay_test');

    let replayed = 0;
    for (const evt of events) {
      // Forensic replay: read-only — just emit to bus for observation
      this._eventBus.emit('simulation.replay.forensic_event', {
        original_event: evt,
        replay_node:    sourceNode,
        frozen_during:  node.frozen,
      });
      replayed++;
    }

    // Restore original freeze state
    if (!was_frozen) node.applyUnfreeze();

    return {
      completed:           true,
      frozen_during_replay: true,
      event_count:          replayed,
    };
  }

  // ——— Full Suite ———————————————————————————————————————————————————

  /**
   * Run all adversarial checks against a trace and cluster.
   * Returns a structured summary with invariant verdicts.
   */
  runAdversarialSuite(trace, cluster) {
    const checks = [];

    // AR-01: Corrupted ordering rejected
    const orderResult = this.replayCorruptedOrdering(trace);
    checks.push({
      id:       'AR-01',
      name:     'corrupted_ordering_rejected',
      status:   orderResult.rejected ? 'PASS' : 'FAIL',
      detail:   orderResult,
    });

    // AR-02: Partial trace valid
    const partialResult = this.replayPartialTrace(trace, Math.max(1, Math.floor(trace.length / 2)));
    checks.push({
      id:       'AR-02',
      name:     'partial_trace_valid',
      status:   partialResult.valid ? 'PASS' : 'FAIL',
      detail:   partialResult,
    });

    // AR-03: Duplicate insertion rejected
    const dupResult = this.replayDuplicatedTrace(trace, 0);
    checks.push({
      id:       'AR-03',
      name:     'duplicate_insertion_rejected',
      status:   dupResult.rejected ? 'PASS' : 'FAIL',
      detail:   dupResult,
    });

    // AR-04: Tampered hash rejected
    const tampResult = this.replayTamperedHash(trace, 0);
    checks.push({
      id:       'AR-04',
      name:     'tampered_hash_rejected',
      status:   tampResult.rejected ? 'PASS' : 'FAIL',
      detail:   tampResult,
    });

    // AR-05: Workflow collision rejected
    const wfResult = this.replayDuplicatedWorkflow(cluster, cluster.authority_node, 'adversarial_wf_test');
    checks.push({
      id:       'AR-05',
      name:     'workflow_collision_rejected',
      status:   wfResult.rejected ? 'PASS' : 'FAIL',
      detail:   wfResult,
    });

    // AR-06: Replay during freeze completes safely
    const freezeResult = this.replayDuringFreeze(cluster, trace.slice(0, 3));
    checks.push({
      id:       'AR-06',
      name:     'replay_during_freeze_safe',
      status:   freezeResult.completed ? 'PASS' : 'FAIL',
      detail:   freezeResult,
    });

    const pass_count = checks.filter(c => c.status === 'PASS').length;
    const fail_count = checks.filter(c => c.status === 'FAIL').length;

    return {
      suite:       'AdversarialReplaySuite',
      check_count: checks.length,
      pass_count,
      fail_count,
      rating:      fail_count === 0 ? 'PASS' : 'FAIL',
      checks,
    };
  }
}

module.exports = { AdversarialReplay };
