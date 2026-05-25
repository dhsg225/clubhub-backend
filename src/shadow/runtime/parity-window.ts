/**
 * Rolling parity window tracker.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Wraps ParityRecorder with time-windowed statistics.
 */

import type { ParityRecorder } from '../storage/parity-recorder';

// ─── Window Stats ─────────────────────────────────────────────────────────────

export interface ParityWindowStats {
  window_ms: number;
  total: number;
  agreements: number;
  warnings: number;
  disagreements: number;
  parity_score: number;
  class3_count: number;
  class4_count: number;
}

// ─── Window Computation ───────────────────────────────────────────────────────

/**
 * Compute parity statistics over a time window.
 *
 * @param recorder - The parity record store
 * @param windowMs - Window size in milliseconds
 * @param nowMs - Current time (UTC ms)
 */
export function computeParityWindow(
  recorder: ParityRecorder,
  windowMs: number,
  nowMs: number,
): ParityWindowStats {
  const startMs = nowMs - windowMs;
  const records = recorder.getWindow(startMs, nowMs);

  const total = records.length;
  const agreements   = records.filter(r => r.divergence_class === null).length;
  const warnings     = records.filter(r => r.divergence_class !== null && r.divergence_class <= 2).length;
  const disagreements = records.filter(r => r.divergence_class !== null && r.divergence_class >= 3).length;
  const class3_count = records.filter(r => r.divergence_class === 3).length;
  const class4_count = records.filter(r => r.divergence_class === 4).length;

  const parity_score = total > 0 ? agreements / total : 1.0;

  return {
    window_ms: windowMs,
    total,
    agreements,
    warnings,
    disagreements,
    parity_score,
    class3_count,
    class4_count,
  };
}
