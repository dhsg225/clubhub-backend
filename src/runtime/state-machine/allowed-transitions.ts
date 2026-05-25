/**
 * Defines all valid state transitions.
 * Any transition not in this table is CLASS_4.
 */
import type { ConstitutionalState } from './constitutional-state';

export const ALLOWED_TRANSITIONS: ReadonlyMap<ConstitutionalState, readonly ConstitutionalState[]> = new Map([
  ['INITIALIZING',       ['HEALTHY', 'DEGRADED', 'PRE_DISABLED']],
  ['HEALTHY',            ['DEGRADED', 'CONSTITUTIONAL_RISK', 'SHADOW_ONLY', 'READ_ONLY', 'EMERGENCY_FREEZE']],
  ['DEGRADED',           ['HEALTHY', 'CONSTITUTIONAL_RISK', 'PRE_DISABLED', 'READ_ONLY', 'EMERGENCY_FREEZE']],
  ['CONSTITUTIONAL_RISK',['DEGRADED', 'PRE_DISABLED', 'READ_ONLY', 'EMERGENCY_FREEZE']],
  ['SHADOW_ONLY',        ['HEALTHY', 'DEGRADED', 'CONSTITUTIONAL_RISK', 'PRE_DISABLED', 'READ_ONLY', 'EMERGENCY_FREEZE']],
  ['PRE_DISABLED',       ['DEGRADED', 'HEALTHY', 'READ_ONLY', 'EMERGENCY_FREEZE']],
  ['READ_ONLY',          ['EMERGENCY_FREEZE']],  // can only get worse from READ_ONLY without human reset
  ['EMERGENCY_FREEZE',   []],                    // no automatic exit
]);

export function isTransitionAllowed(from: ConstitutionalState, to: ConstitutionalState): boolean {
  return ALLOWED_TRANSITIONS.get(from)?.includes(to) ?? false;
}
