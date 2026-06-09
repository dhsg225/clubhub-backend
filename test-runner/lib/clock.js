/**
 * Governed Clock — the single approved source of time for suites, runner, and metrics.
 *
 * Modes:
 *   realtime     — delegates to Date.now() (production default)
 *   replay       — delegates to Date.now(); chaos timing is governed by ReplayController
 *   deterministic — monotonic counter from _origin, advanced only by advance(ms)
 *
 * IMPORTANT: validate-contracts.js enforces that Date.now(), Math.random(), and
 * new Date() (no args) must not appear in suites/*.js, runner.js, lib/metrics.js,
 * or lib/chaos.js. All time access in those files must go through clock.now().
 */
export class Clock {
  constructor(mode = 'realtime') {
    this.mode = mode; // 'realtime' | 'replay' | 'deterministic'
    this._origin = Date.now();      // Real epoch at construction — always real
    this._deterministicTs = 0;     // Offset from _origin for deterministic mode
  }

  /**
   * Return current timestamp in milliseconds.
   * In deterministic mode, time only advances when advance() is called.
   */
  now() {
    if (this.mode === 'deterministic') {
      return this._origin + this._deterministicTs;
    }
    return Date.now();
  }

  /**
   * Advance the deterministic clock by ms. No-op in other modes.
   */
  advance(ms) {
    if (this.mode === 'deterministic') {
      this._deterministicTs += ms;
    }
  }

  /**
   * Return ms elapsed since fromTs, as measured by this clock.
   */
  elapsed(fromTs) {
    return this.now() - fromTs;
  }

  /**
   * ISO-8601 string of the current clock time.
   * Use instead of new Date().toISOString() in governed files.
   */
  iso() {
    return new Date(this.now()).toISOString();
  }
}
