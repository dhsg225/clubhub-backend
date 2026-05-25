/**
 * Handles EMERGENCY_FREEZE state.
 * In this state: no PRE, no shadow, no canary, no new writes.
 * Only serves LEVEL_0 emergency content or LEVEL_5 system fallback.
 * Exit requires explicit human reset token.
 */
import type { ConstitutionalState } from './constitutional-state';

export interface EmergencyFreezeResult {
  state: 'EMERGENCY_FREEZE';
  pre_allowed: false;
  shadow_allowed: false;
  canary_allowed: false;
  audit_write_allowed: false;
  serving_mode: 'EMERGENCY_CONTENT' | 'SYSTEM_FALLBACK_ONLY';
  freeze_reason: string;
}

export function getEmergencyFreezePolicy(freezeReason: string, hasActiveEmergency: boolean): EmergencyFreezeResult {
  return {
    state: 'EMERGENCY_FREEZE',
    pre_allowed: false,
    shadow_allowed: false,
    canary_allowed: false,
    audit_write_allowed: false,
    serving_mode: hasActiveEmergency ? 'EMERGENCY_CONTENT' : 'SYSTEM_FALLBACK_ONLY',
    freeze_reason: freezeReason,
  };
}
