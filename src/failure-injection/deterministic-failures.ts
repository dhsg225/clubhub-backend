/**
 * Pure deterministic fault constructors.
 * These produce known, reproducible failure conditions for testing.
 * All functions are pure — they never mutate input state.
 */

import type { PRE_Output } from '../pre/types';
import type { SystemStateSnapshot } from '../pre/types';

/** Inject a null active_playlist (INV-2 violation trigger) */
export function injectEmptyPlaylist(output: PRE_Output): PRE_Output {
  return { ...output, playlist: [] };
}

/** Inject mismatched resolution level during active emergency (INV-7 violation trigger) */
export function injectEmergencyResolutionMismatch(output: PRE_Output): PRE_Output {
  return { ...output, resolution_level: 3 }; // should be 0 during emergency
}

/** Inject playlist checksum mismatch (stability violation trigger) */
export function injectChecksumMismatch(output: PRE_Output): PRE_Output {
  return { ...output, playlist_checksum: 'deadbeef' };
}

/** Produce a state snapshot with no active schedules (CHAOS-002 equivalent) */
export function buildNoScheduleState(base: SystemStateSnapshot): SystemStateSnapshot {
  return { ...base, schedules: [] };
}

/** Produce a state snapshot with null delivery log (CHAOS-001 equivalent) */
export function buildNullDeliveryState(base: SystemStateSnapshot): SystemStateSnapshot {
  return { ...base, last_delivery: null };
}
