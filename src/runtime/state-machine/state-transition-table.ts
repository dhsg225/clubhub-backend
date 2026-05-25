/**
 * Maps failure classifications to state transitions.
 * Pure function — takes current state + failure class → new state.
 */
import type { ConstitutionalState } from './constitutional-state';
import type { FailureClass } from '../../failure-injection/failure-registry';

export function deriveNextState(
  currentState: ConstitutionalState,
  failureClass: FailureClass,
): ConstitutionalState {
  if (failureClass === 5) return 'EMERGENCY_FREEZE';
  if (failureClass === 4) return 'READ_ONLY';
  if (failureClass === 3) {
    if (currentState === 'HEALTHY' || currentState === 'DEGRADED') return 'CONSTITUTIONAL_RISK';
    if (currentState === 'CONSTITUTIONAL_RISK') return 'PRE_DISABLED';
    return 'READ_ONLY';
  }
  if (failureClass === 2) {
    if (currentState === 'HEALTHY') return 'DEGRADED';
    return currentState;  // stay in current degraded state
  }
  if (failureClass === 1) return currentState;  // CLASS_1 doesn't change state
  return currentState;  // CLASS_0 = no change
}
