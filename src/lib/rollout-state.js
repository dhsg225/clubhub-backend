'use strict';
/**
 * rollout-state.js
 *
 * OTA deployment ring state machine. Implements OTA_GOVERNANCE.md §2.
 * All ring sizes and observation windows read from thresholds.json `ota` section.
 *
 * Usage:
 *   const RolloutState = require('./rollout-state');
 *   const rollout = new RolloutState({ updateId: 'v1.2.0', targetVersion: '1.2.0', thresholds });
 *   rollout.transition('STAGING');
 *   rollout.promoteRing(metrics);
 */

const { emit, EVENTS }  = require('./events');
const { withLineage }   = require('./event-lineage');

// Valid state set — exhaustive per OTA_GOVERNANCE.md §2
const STATES = Object.freeze({
  PENDING:      'PENDING',
  STAGING:      'STAGING',
  RING_0:       'RING_0',
  RING_1:       'RING_1',
  RING_2:       'RING_2',
  RING_3:       'RING_3',
  COMPLETE:     'COMPLETE',
  ROLLED_BACK:  'ROLLED_BACK',
  FROZEN:       'FROZEN',
});

// Legal transitions per OTA_GOVERNANCE.md §2 state machine
const ALLOWED_TRANSITIONS = {
  PENDING:      ['STAGING'],
  STAGING:      ['RING_0', 'RING_1'],
  RING_0:       ['RING_1', 'ROLLED_BACK', 'FROZEN'],
  RING_1:       ['RING_2', 'ROLLED_BACK', 'FROZEN'],
  RING_2:       ['RING_3', 'ROLLED_BACK', 'FROZEN'],
  RING_3:       ['COMPLETE', 'ROLLED_BACK'],
  FROZEN:       ['RING_0', 'RING_1', 'RING_2', 'RING_3'],  // resume to prior ring
  COMPLETE:     [],    // terminal
  ROLLED_BACK:  ['PENDING'],  // only after defect remediated
};

// Ring → coverage pct (read from thresholds in constructor; these are fallback defaults)
const RING_DEFAULT_PCT = { RING_0: 1, RING_1: 30, RING_2: 70, RING_3: 100 };

// Rollback trigger IDs per OTA_GOVERNANCE.md §4
const ROLLBACK_TRIGGERS = Object.freeze({
  RT1: 'RT1_FLEET_SUCCESS_RATE_BELOW_FLOOR',
  RT2: 'RT2_CLASS_F_FAILURE',
  RT3: 'RT3_RING_HEALTH_SCORE_BELOW_FLOOR',
  RT4: 'RT4_BACKEND_HEALTH_503',
  RT5: 'RT5_ROLLBACK_SLA_EXCEEDED',
});

// Freeze condition IDs per OTA_GOVERNANCE.md §5
const FREEZE_CONDITIONS = Object.freeze({
  FC1: 'FC1_FLEET_UNHEALTHY',
  FC2: 'FC2_CI_CONTRACT_FAIL',
  FC3: 'FC3_ACTIVE_INCIDENT',
  FC4: 'FC4_CLASS_F_FAILURE',
  FC5: 'FC5_BACKEND_503',
  FC6: 'FC6_SOAK_FAILED',
});

class RolloutState {
  /**
   * @param {object} options
   * @param {string} options.updateId        Unique ID for this update (e.g. 'v1.2.0')
   * @param {string} options.targetVersion   Firmware/software version being deployed
   * @param {object} options.thresholds      Loaded from test-config/thresholds.json
   * @param {number} options.totalScreens    Current fleet size (for blast radius calculations)
   */
  constructor({ updateId, targetVersion, thresholds = {}, totalScreens = 0, freezeCheck = null }) {
    this.updateId      = updateId;
    this.targetVersion = targetVersion;
    this.totalScreens  = totalScreens;
    this.state         = STATES.PENDING;
    this.previousState = null;
    this.frozenFrom    = null;
    this.history       = [];     // [{from, to, at, reason}]
    this.adoptionLog   = {};     // ring → final adoption pct
    this.startedAt     = Date.now();
    this.ringEnteredAt = null;
    this._freezeCheck  = freezeCheck ?? null;

    // Governed thresholds (with fallback defaults)
    const ota = thresholds.ota || {};
    this.ring1MaxPct          = ota.ring1_max_pct            ?? RING_DEFAULT_PCT.RING_1;
    this.ring2MaxPct          = ota.ring2_max_pct            ?? RING_DEFAULT_PCT.RING_2;
    this.minFleetSuccessRate  = ota.min_fleet_success_rate   ?? 80;
    this.observationWindowMs  = ota.observation_window_ms    ?? 300_000;
    this.rollbackWindowMs     = ota.rollback_window_ms       ?? 3_600_000;
    this.ringHealthPassScore  = 0.85;  // per OTA_GOVERNANCE.md §7
    this.ringHealthStopScore  = 0.70;  // per OTA_GOVERNANCE.md §7
  }

  // ── State transitions ─────────────────────────────────────────────────────

  /**
   * Attempt a state transition. Returns {ok, error}.
   */
  transition(toState, reason = null) {
    const allowed = ALLOWED_TRANSITIONS[this.state] || [];
    if (!allowed.includes(toState)) {
      return { ok: false, error: `Transition ${this.state} → ${toState} is not permitted` };
    }
    this._record(this.state, toState, reason);
    if (toState === STATES.FROZEN) {
      this.frozenFrom = this.state;
    }
    this.state = toState;
    this.ringEnteredAt = Date.now();
    this._emitTransitionEvent(toState, reason);
    return { ok: true };
  }

  /**
   * Evaluate metrics and promote to the next ring if criteria are met.
   * Returns {promoted, blocked, reason}.
   *
   * @param {object} metrics  Fleet metrics snapshot:
   *   { fleetSuccessRate, ringHealthScore, desyncCount, unhealthyScreens, adoptionPct }
   */
  promoteRing(metrics = {}) {
    if (this.state === STATES.FROZEN || this.state === STATES.COMPLETE ||
        this.state === STATES.ROLLED_BACK || this.state === STATES.PENDING) {
      return { promoted: false, blocked: true, reason: `Cannot promote from ${this.state}` };
    }

    // External freeze check (e.g. fleet-consensus freeze)
    if (this._freezeCheck && this._freezeCheck()) {
      this.transition(STATES.FROZEN, FREEZE_CONDITIONS.FC1);
      return { promoted: false, blocked: true, freeze_class: 'CONSENSUS_FROZEN', reason: 'External freeze check triggered' };
    }

    // Check rollback triggers first
    const trigger = this._checkRollbackTriggers(metrics);
    if (trigger) {
      this.transition(STATES.ROLLED_BACK, trigger);
      return { promoted: false, blocked: true, reason: `Rollback triggered: ${trigger}` };
    }

    // Check freeze conditions
    const freeze = this._checkFreezeConditions(metrics);
    if (freeze) {
      this.transition(STATES.FROZEN, freeze);
      return { promoted: false, blocked: true, reason: `Frozen: ${freeze}` };
    }

    // Check observation window
    const elapsed = Date.now() - (this.ringEnteredAt ?? this.startedAt);
    const requiredWindow = this.state === STATES.RING_3
      ? this.rollbackWindowMs
      : this.observationWindowMs;

    if (elapsed < requiredWindow) {
      return {
        promoted: false,
        blocked: false,
        reason: `Observation window active: ${elapsed}ms / ${requiredWindow}ms elapsed`,
      };
    }

    // Check ring health score
    const score = metrics.ringHealthScore ?? 1.0;
    if (score < this.ringHealthPassScore) {
      return {
        promoted: false,
        blocked: true,
        reason: `Ring health score ${score.toFixed(2)} below promotion threshold ${this.ringHealthPassScore}`,
      };
    }

    // Determine next state
    const next = this._nextRingState();
    if (!next) {
      return { promoted: false, blocked: true, reason: 'No next ring state from ' + this.state };
    }

    this.adoptionLog[this.state] = metrics.adoptionPct ?? null;
    this.transition(next, `observation_window_elapsed:${elapsed}ms`);
    return { promoted: true, blocked: false, toState: next };
  }

  /**
   * Manually initiate rollback with a reason string.
   */
  rollback(reason) {
    if (this.state === STATES.COMPLETE) {
      return { ok: false, error: 'Cannot rollback a COMPLETE update; create a new update' };
    }
    return this.transition(STATES.ROLLED_BACK, reason);
  }

  /**
   * Lift a freeze and return to the state the rollout was in before freezing.
   */
  liftFreeze(reason = 'operator_lifted') {
    if (this.state !== STATES.FROZEN) {
      return { ok: false, error: `Not in FROZEN state (current: ${this.state})` };
    }
    const resumeTo = this.frozenFrom;
    this.frozenFrom = null;
    return this.transition(resumeTo, reason);
  }

  // ── Blast radius ──────────────────────────────────────────────────────────

  /**
   * Returns the maximum number of screens that can be affected in the current ring.
   * Per OTA_GOVERNANCE.md §3.
   */
  blastRadius() {
    const pct = { RING_0: 1, RING_1: this.ring1MaxPct, RING_2: this.ring2MaxPct, RING_3: 100 };
    const p = pct[this.state] ?? 0;
    return Math.ceil(this.totalScreens * (p / 100));
  }

  /**
   * Determine if a screen (by hash 0-99) is eligible for the current ring.
   * Hash is simpleHash(screenId) % 100 per soak.js convention.
   */
  screenEligible(screenHashPct) {
    if (this.state === STATES.RING_0) return screenHashPct === 0;  // canary only
    if (this.state === STATES.RING_1) return screenHashPct < this.ring1MaxPct;
    if (this.state === STATES.RING_2) return screenHashPct < this.ring2MaxPct;
    if (this.state === STATES.RING_3) return true;
    return false;
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  snapshot() {
    return {
      update_id:       this.updateId,
      target_version:  this.targetVersion,
      state:           this.state,
      started_at:      new Date(this.startedAt).toISOString(),
      ring_entered_at: this.ringEnteredAt ? new Date(this.ringEnteredAt).toISOString() : null,
      blast_radius:    this.blastRadius(),
      adoption_log:    this.adoptionLog,
      history_count:   this.history.length,
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _nextRingState() {
    const seq = [STATES.STAGING, STATES.RING_0, STATES.RING_1, STATES.RING_2, STATES.RING_3, STATES.COMPLETE];
    const idx = seq.indexOf(this.state);
    return idx >= 0 && idx < seq.length - 1 ? seq[idx + 1] : null;
  }

  _checkRollbackTriggers(metrics) {
    if ((metrics.fleetOtaSuccessRate ?? 100) < this.minFleetSuccessRate) return ROLLBACK_TRIGGERS.RT1;
    if (metrics.classFFailureDetected) return ROLLBACK_TRIGGERS.RT2;
    const score = metrics.ringHealthScore ?? 1.0;
    if (score < this.ringHealthStopScore) return ROLLBACK_TRIGGERS.RT3;
    if (metrics.backendHealth503) return ROLLBACK_TRIGGERS.RT4;
    return null;
  }

  _checkFreezeConditions(metrics) {
    if (metrics.fleetUnhealthy) return FREEZE_CONDITIONS.FC1;
    if (metrics.contractValidationFailed) return FREEZE_CONDITIONS.FC2;
    if (metrics.activeIncident) return FREEZE_CONDITIONS.FC3;
    if (metrics.classFFailureDetected) return FREEZE_CONDITIONS.FC4;
    if (metrics.backendHealth503) return FREEZE_CONDITIONS.FC5;
    return null;
  }

  _record(from, to, reason) {
    this.history.push({ from, to, at: new Date().toISOString(), reason });
  }

  _emitTransitionEvent(toState, reason) {
    const eventMap = {
      RING_0: EVENTS.OTA.ROLLOUT_STARTED,
      RING_1: EVENTS.OTA.RING_PROMOTED,
      RING_2: EVENTS.OTA.RING_PROMOTED,
      RING_3: EVENTS.OTA.RING_PROMOTED,
      COMPLETE: EVENTS.OTA.UPDATE_COMPLETE,
      ROLLED_BACK: EVENTS.OTA.ROLLBACK_TRIGGERED,
      FROZEN: EVENTS.OTA.RING_FROZEN,
    };
    const eventName = eventMap[toState];
    if (!eventName) return;
    // Lazy-require fleet-consensus to avoid circular dependency
    let authority_epoch = null;
    let manifest_generation = null;
    try {
      const fc = require('./fleet-consensus');
      authority_epoch     = fc.getEpoch();
      manifest_generation = fc.getManifestGeneration();
    } catch { /* non-fatal */ }
    emit(eventName, null, withLineage({
      update_id:      this.updateId,
      target_version: this.targetVersion,
      from_ring:      this.previousState,
      to_ring:        toState,
      reason,
      blast_radius:   this.blastRadius(),
    }, {
      authority_epoch,
      manifest_generation,
    }));
  }
}

module.exports = { RolloutState, STATES, ROLLBACK_TRIGGERS, FREEZE_CONDITIONS };
