/**
 * Deterministic shadow sampling.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * For the same (screenId, at) pair, always returns the same sampling decision.
 * Uses fnv1a32 hash of the concatenated key to derive a stable bucket.
 * Never uses Math.random().
 */

import { fnv1a32 } from '../../pre/algorithms/fnv1a32';

/**
 * Compute a stable sampling bucket in [0, 1) for the given (screenId, at) pair.
 * Deterministic: same inputs always return same value.
 */
export function computeSamplingBucket(screenId: string, at: number): number {
  const hash = fnv1a32(screenId + ':' + at.toString());
  const intVal = parseInt(hash, 16);
  return (intVal % 10000) / 10000;
}

/**
 * Determine whether this (screenId, at) should be sampled at the given rate.
 * Deterministic: same inputs always return same decision.
 */
export function determineShouldSample(
  screenId: string,
  at: number,
  rate: number,
): boolean {
  return computeSamplingBucket(screenId, at) < rate;
}
