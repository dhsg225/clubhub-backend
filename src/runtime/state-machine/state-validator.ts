import type { ConstitutionalState } from './constitutional-state';
import { isTransitionAllowed } from './allowed-transitions';

export class StateTransitionError extends Error {
  constructor(from: ConstitutionalState, to: ConstitutionalState) {
    super(`Invalid state transition: ${from} → ${to}. This is a CLASS_4 failure.`);
    this.name = 'StateTransitionError';
  }
}

export function validateTransition(from: ConstitutionalState, to: ConstitutionalState): void {
  if (!isTransitionAllowed(from, to)) {
    throw new StateTransitionError(from, to);
  }
}
