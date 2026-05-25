/**
 * Gate that determines whether shadow execution runs for a given request.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Shadow execution is deterministic — same input always makes same gate decision.
 */

import type { CanaryStage } from '../types';
import { determineShouldSample } from './shadow-sampling';

// ─── Gate Config ──────────────────────────────────────────────────────────────

export interface ShadowGateConfig {
  enabled: boolean;
  canary_stage: CanaryStage;
  /** 0.0 to 1.0 — uses deterministic sampling, not random */
  sampling_rate: number;
}

// ─── Gate Evaluation ─────────────────────────────────────────────────────────

/**
 * Determine whether shadow execution should run for a given request.
 *
 * Deterministic: hash(screen_id + at) % 10000 / 10000.0 < sampling_rate
 * Never uses Math.random().
 */
export function shouldRunShadow(
  config: ShadowGateConfig,
  screenId: string,
  at: number,
): boolean {
  if (!config.enabled) return false;

  // SHADOW_ONLY stage: always run shadow
  if (config.canary_stage === 'SHADOW_ONLY') {
    return determineShouldSample(screenId, at, config.sampling_rate);
  }

  // All other stages: deterministic sampling
  return determineShouldSample(screenId, at, config.sampling_rate);
}
