/**
 * Global constitutional breaker.
 * When tripped, the system enters READ_ONLY mode:
 * - PRE disabled
 * - Shadow disabled
 * - Entropy advisory only (read existing state)
 * - Audit reads allowed; writes forbidden
 * - Only legacy resolver serves responses
 *
 * Tripped by: CLASS_4 or CLASS_5 classification.
 * Reset: ONLY by explicit human operator action.
 */

export type ConstitutionalMode = 'NORMAL' | 'READ_ONLY' | 'EMERGENCY_FREEZE';

export class GlobalConstitutionalBreaker {
  private mode: ConstitutionalMode = 'NORMAL';
  private tripReason: string | null = null;
  private trippedAt: number | null = null;

  getMode(): ConstitutionalMode { return this.mode; }
  getTripReason(): string | null { return this.tripReason; }

  /** Trip to READ_ONLY. May only be called, never silently set. */
  tripToReadOnly(reason: string, nowMs: number): void {
    if (this.mode !== 'EMERGENCY_FREEZE') {
      this.mode = 'READ_ONLY';
      this.tripReason = reason;
      this.trippedAt = nowMs;
    }
  }

  /** Trip to EMERGENCY_FREEZE. Strongest possible state. */
  tripToEmergencyFreeze(reason: string, nowMs: number): void {
    this.mode = 'EMERGENCY_FREEZE';
    this.tripReason = reason;
    this.trippedAt = nowMs;
  }

  /** Returns whether PRE invocation is permitted */
  isPREAllowed(): boolean { return this.mode === 'NORMAL'; }

  /** Returns whether shadow execution is permitted */
  isShadowAllowed(): boolean { return this.mode === 'NORMAL'; }

  /** Returns whether audit writes are permitted */
  isAuditWriteAllowed(): boolean { return this.mode !== 'EMERGENCY_FREEZE'; }

  /** Reset to NORMAL — requires explicit human action string as proof */
  reset(humanAuthorizationToken: string): void {
    if (!humanAuthorizationToken || humanAuthorizationToken.length < 8) {
      throw new Error('GlobalConstitutionalBreaker.reset() requires a non-empty human authorization token');
    }
    this.mode = 'NORMAL';
    this.tripReason = null;
    this.trippedAt = null;
  }

  toJSON(): object {
    return { mode: this.mode, trip_reason: this.tripReason, tripped_at: this.trippedAt };
  }
}
