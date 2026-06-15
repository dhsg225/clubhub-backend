'use strict';
/**
 * replay-hooks.js — Replay execution model for OTA runtime.
 *
 * During kernel REPLAY mode:
 *   - All deployment mutations are blocked
 *   - Side effects are suppressed
 *   - Deterministic clock is used (not wall-clock)
 *   - Events are emitted through kernel event bus only
 *
 * Replay mode is entered/exited externally by lifecycle.js.
 * This module provides the guard surface for all governed-* modules.
 */

const REPLAY_VIOLATION = 'REPLAY_ISOLATION_VIOLATION';

let _replayMode = false;
let _sideEffectsSuppressed = false;
let _replayCorrelationId   = null;
let _replayEnterTs         = null;
let _replayExitTs          = null;
let _suppressedCount       = 0;

// ── Mode control ──────────────────────────────────────────────────────────────

/**
 * Enter replay mode. Sets the isolation state for all governed modules.
 * @param {string} [correlationId]
 */
function enterReplay(correlationId) {
  _replayMode            = true;
  _sideEffectsSuppressed = true;
  _replayCorrelationId   = correlationId ?? null;
  _replayEnterTs         = new Date().toISOString();
  _replayExitTs          = null;
  _suppressedCount       = 0;
}

/**
 * Exit replay mode. Restores live execution state.
 */
function exitReplay() {
  _replayMode            = false;
  _sideEffectsSuppressed = false;
  _replayExitTs          = new Date().toISOString();
}

/**
 * Returns true if currently in replay mode.
 */
function isReplayMode() {
  return _replayMode;
}

/**
 * Returns true if side effects are suppressed (superset of replay mode).
 */
function isSideEffectsSuppressed() {
  return _sideEffectsSuppressed;
}

// ── Guard helpers ─────────────────────────────────────────────────────────────

/**
 * Throws if currently in replay mode.
 * Use before any mutation that must not execute during replay.
 * @param {string} operationName — for error context
 */
function assertNotReplay(operationName) {
  if (_replayMode) {
    throw Object.assign(
      new Error(`${REPLAY_VIOLATION}: '${operationName}' is a mutating operation and must not execute during replay`),
      { code: REPLAY_VIOLATION, operation: operationName }
    );
  }
}

/**
 * Execute fn only if NOT in replay mode.
 * In replay mode, increments suppressed counter and returns null.
 * @param {string} label — descriptive label for suppression tracking
 * @param {Function} fn  — side-effect function to conditionally execute
 * @returns {*} fn result or null if suppressed
 */
function suppressedSideEffect(label, fn) {
  if (_sideEffectsSuppressed) {
    _suppressedCount++;
    return null;
  }
  return fn();
}

/**
 * Async version of suppressedSideEffect.
 */
async function suppressedSideEffectAsync(label, fn) {
  if (_sideEffectsSuppressed) {
    _suppressedCount++;
    return null;
  }
  return fn();
}

/**
 * Execute fn with side effects explicitly suppressed for the duration.
 * Used when wrapping a replay-safe function that may have conditional side effects.
 * @param {Function} fn — async function to execute
 */
async function withReplaySuppression(fn) {
  const wasSuppressed = _sideEffectsSuppressed;
  _sideEffectsSuppressed = true;
  try {
    return await fn();
  } finally {
    _sideEffectsSuppressed = wasSuppressed;
  }
}

// ── Deployment-specific guards ────────────────────────────────────────────────

/**
 * Returns true if deployment mutations are permitted.
 * False during replay or when freeze is active.
 * @param {boolean} isFrozen — pass current freeze state
 */
function canMutateDeployment(isFrozen) {
  if (_replayMode) return false;
  if (isFrozen)    return false;
  return true;
}

/**
 * Assert deployment mutation is permitted.
 * @param {boolean} isFrozen
 * @param {string}  operationName
 */
function assertCanMutateDeployment(isFrozen, operationName) {
  assertNotReplay(operationName);
  if (isFrozen) {
    throw Object.assign(
      new Error(`DEPLOYMENT_FROZEN: '${operationName}' is blocked — deployment is frozen`),
      { code: 'DEPLOYMENT_FROZEN', operation: operationName }
    );
  }
}

// ── Status ────────────────────────────────────────────────────────────────────

function status() {
  return Object.freeze({
    replay_mode:              _replayMode,
    side_effects_suppressed:  _sideEffectsSuppressed,
    replay_correlation_id:    _replayCorrelationId,
    replay_enter_ts:          _replayEnterTs,
    replay_exit_ts:           _replayExitTs,
    suppressed_count:         _suppressedCount,
  });
}

function _reset() {
  _replayMode            = false;
  _sideEffectsSuppressed = false;
  _replayCorrelationId   = null;
  _replayEnterTs         = null;
  _replayExitTs          = null;
  _suppressedCount       = 0;
}

module.exports = {
  enterReplay,
  exitReplay,
  isReplayMode,
  isSideEffectsSuppressed,
  assertNotReplay,
  suppressedSideEffect,
  suppressedSideEffectAsync,
  withReplaySuppression,
  canMutateDeployment,
  assertCanMutateDeployment,
  status,
  _reset,
  REPLAY_VIOLATION,
};
