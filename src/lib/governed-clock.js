'use strict';
/**
 * governed-clock.js
 *
 * Cluster-governed clock layer. All governance-critical modules must use
 * this module instead of calling Date.now() or new Date() directly.
 *
 * In normal operation: delegates to wall-clock (zero overhead).
 * In replay mode: fixed clock with monotonic advancement.
 * In test mode: controllable offset.
 */

let _offset     = 0;       // ms offset added to wall-clock
let _fixed      = null;    // non-null in replay mode: fixed epoch ms
let _frozen     = false;   // if true, now() returns fixed value
let _monotonic  = 0;       // replay monotonic counter (ns)

/**
 * Current governed time in ms.
 * In replay mode: returns _fixed + monotonic advancement.
 */
function now() {
  if (_fixed !== null) return _fixed + Math.floor(_monotonic / 1_000_000);
  return Date.now() + _offset;
}

/** ISO 8601 string of governed now(). */
function nowIso() {
  return new Date(now()).toISOString();
}

/**
 * Monotonic counter — increments by 1 ms per call in replay mode,
 * or returns performance.now() equivalent in live mode.
 */
function monotonic() {
  if (_fixed !== null) {
    _monotonic += 1_000_000; // advance 1ms per call
    return _monotonic;
  }
  return Date.now() * 1_000_000; // nanosecond-scale
}

/** Freeze clock at current now() (replay entry point). */
function freeze() {
  _fixed    = now();
  _frozen   = true;
  _monotonic = 0;
}

/** Unfreeze clock — return to wall-clock. */
function unfreeze() {
  _fixed   = null;
  _frozen  = false;
}

/** Set wall-clock offset (for clock-skew simulation). */
function setOffset(ms) {
  _offset = ms;
}

/** Set fixed epoch directly (deterministic replay). */
function setFixed(epochMs) {
  _fixed    = epochMs;
  _frozen   = true;
  _monotonic = 0;
}

/** Whether clock is in replay/frozen mode. */
function isFrozen() {
  return _frozen;
}

/** Reset to live wall-clock (test cleanup). */
function _reset() {
  _offset    = 0;
  _fixed     = null;
  _frozen    = false;
  _monotonic = 0;
}

module.exports = { now, nowIso, monotonic, freeze, unfreeze, setOffset, setFixed, isFrozen, _reset };
