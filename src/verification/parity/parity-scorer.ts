/**
 * Shadow-mode parity scorer.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Tracks PRE vs legacy resolution agreement over a rolling time window.
 * Used to determine when PRE has earned canary promotion.
 *
 * "PRE promotion is parity-earned, never time-earned."
 *
 * Parity is computed per class:
 * - Class 0+1 (cosmetic/tolerated) diffs = AGREEMENT for parity purposes
 * - Class 2 (warning) diffs = recorded but not counted as disagreement
 * - Class 3+4 (constitutional/catastrophic) diffs = DISAGREEMENT
 *
 * Parity score = agreements / total_invocations (rolling window)
 */

export interface ParityRecord {
  screen_id:        string;
  at:               number;         // UTC ms
  legacy_hash:      string;         // FNV-1a of legacy output
  pre_hash:         string;         // FNV-1a of PRE output
  divergence_class: number | null;  // null = identical hashes
  recorded_at:      number;         // UTC ms
}

export interface ParityWindow {
  window_start_ms:  number;
  window_end_ms:    number;
  total:            number;
  agreements:       number;         // class 0, 1, null
  warnings:         number;         // class 2
  disagreements:    number;         // class 3, 4
  parity_score:     number;         // agreements / total
}

/** Rolling window for parity tracking */
export class ParityScorer {
  private records: ParityRecord[] = [];

  /** Add a shadow comparison result */
  record(r: ParityRecord): void {
    this.records.push(r);
    // Trim records older than 7 days
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.records = this.records.filter(rec => rec.recorded_at >= cutoff);
  }

  /** Compute parity score over the last N milliseconds */
  score(windowMs: number): ParityWindow {
    const now = Date.now();
    const windowStart = now - windowMs;
    const window = this.records.filter(r => r.recorded_at >= windowStart);

    const total        = window.length;
    const agreements   = window.filter(r => r.divergence_class === null || r.divergence_class <= 1).length;
    const warnings     = window.filter(r => r.divergence_class === 2).length;
    const disagreements = window.filter(r => r.divergence_class !== null && r.divergence_class >= 3).length;

    return {
      window_start_ms: windowStart,
      window_end_ms:   now,
      total,
      agreements,
      warnings,
      disagreements,
      parity_score: total > 0 ? agreements / total : 1.0,
    };
  }
}

/** Canary promotion gate thresholds */
export const CANARY_GATE = {
  /** Minimum parity score required at 24h window */
  MIN_PARITY_24H: 0.999,
  /** Minimum parity score required at 168h (7d) window */
  MIN_PARITY_7D: 0.9999,
  /** Minimum total invocations required before gate can pass */
  MIN_INVOCATIONS: 1000,
} as const;

export interface CanaryGateResult {
  passes: boolean;
  reason: string;
  score_24h: number;
  score_7d: number;
  total_24h: number;
  total_7d: number;
}

/** Evaluate whether PRE has earned canary promotion */
export function evaluateCanaryGate(scorer: ParityScorer): CanaryGateResult {
  const w24h = scorer.score(24 * 60 * 60 * 1000);
  const w7d  = scorer.score(7 * 24 * 60 * 60 * 1000);

  if (w24h.total < CANARY_GATE.MIN_INVOCATIONS) {
    return {
      passes: false,
      reason: `Insufficient data: ${w24h.total} invocations in 24h, need ${CANARY_GATE.MIN_INVOCATIONS}`,
      score_24h: w24h.parity_score, score_7d: w7d.parity_score,
      total_24h: w24h.total, total_7d: w7d.total,
    };
  }

  if (w24h.parity_score < CANARY_GATE.MIN_PARITY_24H) {
    return {
      passes: false,
      reason: `24h parity ${w24h.parity_score.toFixed(5)} < required ${CANARY_GATE.MIN_PARITY_24H}`,
      score_24h: w24h.parity_score, score_7d: w7d.parity_score,
      total_24h: w24h.total, total_7d: w7d.total,
    };
  }

  if (w7d.total >= CANARY_GATE.MIN_INVOCATIONS && w7d.parity_score < CANARY_GATE.MIN_PARITY_7D) {
    return {
      passes: false,
      reason: `7d parity ${w7d.parity_score.toFixed(5)} < required ${CANARY_GATE.MIN_PARITY_7D}`,
      score_24h: w24h.parity_score, score_7d: w7d.parity_score,
      total_24h: w24h.total, total_7d: w7d.total,
    };
  }

  return {
    passes: true,
    reason: `24h parity=${w24h.parity_score.toFixed(5)} (${w24h.total} samples), 7d parity=${w7d.parity_score.toFixed(5)}`,
    score_24h: w24h.parity_score, score_7d: w7d.parity_score,
    total_24h: w24h.total, total_7d: w7d.total,
  };
}
