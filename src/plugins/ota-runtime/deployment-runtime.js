'use strict';
/**
 * deployment-runtime.js — OTA deployment state tracking.
 *
 * Tracks the current deployment context in memory:
 *   - Active artifact and generation
 *   - Ring/wave progress
 *   - Rollout statistics per ring
 *   - Governed clock timestamps
 *
 * This module is NOT an authority source.
 * All state mutations route through governed-deployment.js.
 * This module is a READ model — updated by consumers after successful governed transitions.
 *
 * All timestamps use the kernel-governed clock interface (passed in via init).
 */

const RING_STATUS = Object.freeze({
  PENDING:   'PENDING',
  ACTIVE:    'ACTIVE',
  COMPLETE:  'COMPLETE',
  FAILED:    'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
});

class DeploymentRuntime {
  constructor() {
    this._clock       = null;
    this._artifact    = null;
    this._generation  = 0;
    this._startedAt   = null;
    this._completedAt = null;
    this._rings       = new Map();
    this._status      = 'IDLE';
    this._rollbackFrom = null;
  }

  /**
   * @param {object} clock — kernel DeterministicClock or governed-clock module { nowIso }
   */
  init(deps = {}) {
    this._clock = deps.clock ?? { nowIso: () => new Date().toISOString() };
  }

  _now() {
    return this._clock.nowIso ? this._clock.nowIso() : new Date().toISOString();
  }

  // ── Artifact tracking ─────────────────────────────────────────────────────

  /**
   * Set current active artifact after a governed deployment begins.
   * @param {string} artifactId
   * @param {number} generation
   * @param {object} opts — { operator_id }
   */
  setArtifact(artifactId, generation, opts = {}) {
    this._artifact   = artifactId;
    this._generation = generation;
    this._startedAt  = this._now();
    this._completedAt = null;
    this._status     = 'DEPLOYING';
    this._rings.clear();
  }

  // ── Ring/wave progress ────────────────────────────────────────────────────

  /**
   * Record wave progress for a ring after a governed wave promotion.
   * @param {number} ring
   * @param {number} waveIndex
   * @param {number} nodeCount
   * @param {object} opts — { epoch }
   */
  updateProgress(ring, waveIndex, nodeCount, opts = {}) {
    const existing = this._rings.get(ring) ?? {
      ring,
      status:     RING_STATUS.PENDING,
      wave_count: 0,
      node_count: 0,
      started_at: null,
      epoch:      null,
    };

    this._rings.set(ring, Object.freeze({
      ...existing,
      status:     RING_STATUS.ACTIVE,
      wave_count: existing.wave_count + 1,
      node_count: existing.node_count + (nodeCount ?? 0),
      started_at: existing.started_at ?? this._now(),
      epoch:      opts.epoch ?? existing.epoch,
    }));
  }

  /**
   * Mark a ring as complete.
   */
  completeRing(ring) {
    const existing = this._rings.get(ring);
    if (existing) {
      this._rings.set(ring, Object.freeze({
        ...existing,
        status:       RING_STATUS.COMPLETE,
        completed_at: this._now(),
      }));
    }
  }

  /**
   * Mark a ring as failed.
   */
  failRing(ring, reason) {
    const existing = this._rings.get(ring);
    if (existing) {
      this._rings.set(ring, Object.freeze({
        ...existing,
        status:    RING_STATUS.FAILED,
        failed_at: this._now(),
        reason:    reason ?? '',
      }));
    }
  }

  // ── Completion / Rollback ─────────────────────────────────────────────────

  markComplete(opts = {}) {
    this._status      = 'COMPLETE';
    this._completedAt = this._now();
  }

  markRolledBack(opts = {}) {
    this._rollbackFrom = this._artifact;
    this._status       = 'ROLLED_BACK';
    // Rings that were ACTIVE or PENDING → ROLLED_BACK
    for (const [ring, state] of this._rings) {
      if (state.status === RING_STATUS.ACTIVE || state.status === RING_STATUS.PENDING) {
        this._rings.set(ring, Object.freeze({
          ...state,
          status: RING_STATUS.ROLLED_BACK,
        }));
      }
    }
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  getDeploymentContext() {
    return Object.freeze({
      artifact_id:   this._artifact,
      generation:    this._generation,
      status:        this._status,
      started_at:    this._startedAt,
      completed_at:  this._completedAt,
      rollback_from: this._rollbackFrom,
    });
  }

  snapshot() {
    return Object.freeze({
      artifact_id:   this._artifact,
      generation:    this._generation,
      status:        this._status,
      started_at:    this._startedAt,
      completed_at:  this._completedAt,
      rollback_from: this._rollbackFrom,
      rings:         Object.fromEntries(this._rings),
    });
  }

  reset() {
    this._artifact    = null;
    this._generation  = 0;
    this._startedAt   = null;
    this._completedAt = null;
    this._rings.clear();
    this._status      = 'IDLE';
    this._rollbackFrom = null;
  }
}

module.exports = { DeploymentRuntime, RING_STATUS };
