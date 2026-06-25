'use strict';
/**
 * agent-runtime/deterministic-context.js
 *
 * DeterministicContext — wraps all non-deterministic OS primitives for agent execution.
 *
 * In replay mode, all non-determinism is suppressed:
 *   - Clock:  kernel DeterministicClock (logical monotonic ts) — never uses wall-clock
 *   - Random: seeded LCG (same seed → identical sequence across runs)
 *   - Events: replay-safe subscriptions
 *
 * NEVER calls Date.now() — always uses the injected kernel clock.
 * NEVER calls Math.random() — always uses seeded RNG.
 */

class DeterministicContext {
  constructor({ kernelClock, seed, eventBus, replayHooks }) {
    this._kernelClock = kernelClock;   // DeterministicClock from kernel
    this._seed        = seed ?? 42;
    this._eventBus    = eventBus;
    this._replayHooks = replayHooks ?? null;
    this._rngState    = this._seed;
    this._subscriptions = [];
  }

  /**
   * now()
   *
   * Returns the kernel logical clock value.
   * Deterministic — same value for the same logical point in time.
   * Does not use Date or wall-clock time.
   */
  now() {
    return this._kernelClock.ts();
  }

  /**
   * random()
   *
   * Seeded pseudo-random number generator (linear congruential generator).
   * Given the same seed, produces identical sequences across replay runs.
   */
  random() {
    // LCG constants from Numerical Recipes
    this._rngState = (this._rngState * 1664525 + 1013904223) >>> 0;
    return this._rngState / 0xFFFFFFFF;
  }

  /**
   * resetRng(seed?)
   *
   * Reset RNG state for replay — ensures identical sequence from same seed.
   */
  resetRng(seed) {
    this._rngState = seed ?? this._seed;
  }

  /**
   * isReplayMode()
   */
  isReplayMode() {
    return this._replayHooks ? this._replayHooks.isReplayMode() : false;
  }

  /**
   * subscribe(pattern, handler)
   *
   * Event bus subscription — replay-safe.
   */
  subscribe(pattern, handler) {
    const sub = this._eventBus.subscribe(pattern, handler);
    this._subscriptions.push(sub);
    return sub;
  }

  dispose() {
    for (const sub of this._subscriptions) {
      if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
    }
    this._subscriptions = [];
  }

  snapshot() {
    return {
      logical_ts:  this._kernelClock.ts(),
      rng_state:   this._rngState,
      replay_mode: this.isReplayMode(),
    };
  }
}

module.exports = { DeterministicContext };
