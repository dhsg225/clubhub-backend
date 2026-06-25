'use strict';
/**
 * SimulationClock — deterministic virtual clock for governed simulation.
 *
 * H1: Same seed → identical time sequence.
 * No wall-clock reads. No Date.now(). No nondeterminism.
 *
 * API:
 *   clock.now()             → current virtual epoch ms
 *   clock.nowIso()          → ISO string
 *   clock.fastForward(ms)   → advance time (must be positive)
 *   clock.freeze()          → lock time at current value
 *   clock.unfreeze()        → resume tick advancement
 *   clock.rewind(ms)        → move time back (adversarial scenarios only)
 *   clock.tick(ms?)         → advance by ms (default 1) if not frozen
 *   clock.setFixed(epochMs) → pin clock to exact value (replay mode)
 *   clock.reset(epochMs?)   → reset to base or given epoch
 *   clock.isFrozen()        → boolean
 *   clock.snapshot()        → serializable state
 */

const BASE_EPOCH_MS = 1_700_000_000_000; // 2023-11-14 — deterministic base

class SimulationClock {
  constructor(baseEpochMs = BASE_EPOCH_MS) {
    this._base      = baseEpochMs;
    this._current   = baseEpochMs;
    this._frozen    = false;
    this._tick_seq  = 0; // monotonic sub-ms sequence
  }

  /** Current virtual time in ms. */
  now() { return this._current; }

  /** ISO 8601 string of virtual now(). */
  nowIso() { return new Date(this._current).toISOString(); }

  /**
   * Advance virtual clock by ms milliseconds.
   * Throws if ms is negative — use rewind() for adversarial reversal.
   */
  fastForward(ms) {
    if (typeof ms !== 'number' || ms < 0) {
      throw new RangeError(`fastForward requires non-negative ms; got ${ms}`);
    }
    if (!this._frozen) this._current += ms;
    this._tick_seq = 0;
    return this._current;
  }

  /**
   * Move virtual clock backwards (adversarial scenarios only).
   * Does NOT affect frozen state.
   */
  rewind(ms) {
    if (typeof ms !== 'number' || ms < 0) {
      throw new RangeError(`rewind requires non-negative ms; got ${ms}`);
    }
    this._current -= ms;
    this._tick_seq = 0;
    return this._current;
  }

  /** Freeze clock — now() returns same value until unfreeze(). */
  freeze() {
    this._frozen = true;
    return this._current;
  }

  /** Unfreeze — tick() and fastForward() resume advancing time. */
  unfreeze() {
    this._frozen = false;
    return this._current;
  }

  /** Whether clock is frozen. */
  isFrozen() { return this._frozen; }

  /**
   * Advance by ms (default 1) unless frozen.
   * Returns current value. Always increments _tick_seq for monotonic ordering.
   */
  tick(ms = 1) {
    if (!this._frozen) this._current += ms;
    this._tick_seq++;
    return this._current;
  }

  /**
   * Pin clock to exact epoch ms (replay mode).
   * Implicitly freezes.
   */
  setFixed(epochMs) {
    this._current = epochMs;
    this._frozen  = true;
    this._tick_seq = 0;
    return this._current;
  }

  /**
   * Reset clock to base or given epoch. Clears frozen state.
   */
  reset(epochMs) {
    this._current  = epochMs ?? this._base;
    this._frozen   = false;
    this._tick_seq = 0;
    return this._current;
  }

  /** Serializable snapshot — safe to hash and compare. */
  snapshot() {
    return Object.freeze({
      current:   this._current,
      frozen:    this._frozen,
      tick_seq:  this._tick_seq,
      base:      this._base,
    });
  }
}

module.exports = { SimulationClock, BASE_EPOCH_MS };
