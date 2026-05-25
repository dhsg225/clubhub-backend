/**
 * Runtime guards that classify failures as they occur.
 * Called from runtime wrapper — never from PRE itself.
 */

import type { FailureClass } from './failure-registry';

export interface FailureClassification {
  failure_class: FailureClass;
  failure_mode_id: string;
  message: string;
  replay_impact: 'none' | 'flag' | 'halt';
  shadow_impact: 'none' | 'halt_canary' | 'all_stop';
  requires_human_review: boolean;
}

/** Classify a PRE resolution error */
export function classifyPREError(error: Error, resolutionLevel: number | null): FailureClassification {
  // Emergency precedence failure → CLASS_4
  if (resolutionLevel !== null && resolutionLevel !== 0 && error.message.includes('INV-7')) {
    return { failure_class: 4, failure_mode_id: 'FM-003', message: error.message, replay_impact: 'halt', shadow_impact: 'all_stop', requires_human_review: true };
  }
  // Invariant violation → CLASS_3
  if (error.name === 'InvariantViolationError' || error.message.includes('INV-')) {
    return { failure_class: 3, failure_mode_id: 'FM-002', message: error.message, replay_impact: 'flag', shadow_impact: 'halt_canary', requires_human_review: true };
  }
  // General PRE throw → CLASS_3
  return { failure_class: 3, failure_mode_id: 'FM-001', message: error.message, replay_impact: 'flag', shadow_impact: 'halt_canary', requires_human_review: true };
}

/** Classify a corpus integrity failure */
export function classifyCorpusIntegrityFailure(detail: string): FailureClassification {
  return { failure_class: 4, failure_mode_id: 'FM-004', message: detail, replay_impact: 'halt', shadow_impact: 'all_stop', requires_human_review: true };
}

/** Classify a shadow divergence */
export function classifyShadowDivergence(divergenceClass: number): FailureClassification {
  if (divergenceClass >= 4) {
    return { failure_class: 4, failure_mode_id: 'FM-003', message: `Shadow CLASS_${divergenceClass} divergence`, replay_impact: 'halt', shadow_impact: 'all_stop', requires_human_review: true };
  }
  if (divergenceClass === 3) {
    return { failure_class: 3, failure_mode_id: 'FM-006', message: `Shadow CLASS_3 divergence`, replay_impact: 'flag', shadow_impact: 'halt_canary', requires_human_review: true };
  }
  return { failure_class: 2, failure_mode_id: 'FM-007', message: `Shadow CLASS_${divergenceClass} divergence (tolerated)`, replay_impact: 'none', shadow_impact: 'none', requires_human_review: false };
}
