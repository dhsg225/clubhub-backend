/**
 * GovernedClock — the only permitted time source in all governed modules.
 *
 * Wall clock (Date.now(), new Date(), performance.now()) is FORBIDDEN in any
 * module that affects PRE output, corpus entries, or state machine timestamps.
 *
 * Callers must call GovernedClock.set() before any governed operation.
 * During replay, call GovernedClock.freeze() with the corpus entry's
 * governed_timestamp to ensure deterministic reconstruction.
 */

let _current: string | null = null;

export const GovernedClock = {
  /** Set the current governed time. Must be called before any resolve() or transition(). */
  set(iso: string): void {
    if (!isValidISO8601(iso)) {
      throw new Error(`GovernedClock.set: invalid ISO8601 value: ${iso}`);
    }
    _current = iso;
  },

  /**
   * Freeze the clock at a specific ISO8601 timestamp.
   * Used during replay reconstruction — clock does not advance.
   */
  freeze(iso: string): void {
    GovernedClock.set(iso);
  },

  /** Return the current governed time. Throws if not set. */
  now(): string {
    if (_current === null) {
      throw new Error(
        'GovernedClock has not been set. Call GovernedClock.set(iso) before any governed operation.'
      );
    }
    return _current;
  },

  /** Reset to unset state. Used between test runs. */
  reset(): void {
    _current = null;
  },

  /** Advance the clock by a number of milliseconds (for simulation). */
  advance(ms: number): void {
    const t = new Date(GovernedClock.now()).getTime() + ms;
    _current = new Date(t).toISOString();
  },
};

function isValidISO8601(s: string): boolean {
  return !isNaN(Date.parse(s));
}
