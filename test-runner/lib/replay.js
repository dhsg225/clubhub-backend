/**
 * Replay system — deterministic capture and replay of chaos suite runs.
 * Extended with mutation-sequence and state-hash comparison for divergence detection.
 *
 * ReplayCapture:    Records chaos injections + timing + mutation log + hash trace.
 * ReplayController: Gates chaos execution to reproduce original timing.
 * validateReplay(): Compares breach set, metrics, mutation sequence, hash sequence.
 *
 * Outputs: reports/replay-capture.json, reports/replay-validation.json,
 *          reports/state-divergence.json (on divergence)
 */
import fs   from 'node:fs';
import path from 'node:path';
import { verifyChain, compareChains } from './state-hash.js';

const METRIC_TOLERANCE       = 0.10;
const GOVERNED_REPLAY_METRICS = [
  'poll_success_rate', 'p95_latency_ms', 'max_poll_drift_ms',
  'desync_count', 'max_desync_duration_ms',
];

// ─────────────────────────────────────────────────────────────────────────────
export class ReplayCapture {
  constructor() {
    this._startTs         = Date.now();
    this._entries         = [];
    this.suiteOrder       = [];
    this.seed             = '42';
    this.deterministic    = true;
    this.originalSummary  = null;
    this.originalBreaches = [];
    this.mutationLog      = [];
    this.hashTrace        = [];
  }

  setRunConfig({ suiteOrder, seed, deterministic }) {
    this.suiteOrder    = suiteOrder;
    this.seed          = seed;
    this.deterministic = deterministic;
  }

  setOriginalResults({ summary, breaches, mutationLog = [], hashTrace = [] }) {
    this.originalSummary  = summary;
    this.originalBreaches = breaches;
    this.mutationLog      = mutationLog.filter(m => m.replayable);
    this.hashTrace        = hashTrace;
  }

  recordChaos(action, params = {}) {
    this._entries.push({ type: 'chaos', action, params, ts_offset: Date.now() - this._startTs });
  }

  save(filePath) {
    const capture = {
      format_version: '1',
      captured_at:    new Date().toISOString(),
      run_config: {
        suite_order:   this.suiteOrder,
        seed:          this.seed,
        deterministic: this.deterministic,
        original_summary:  this.originalSummary,
        original_breaches: this.originalBreaches,
        mutation_log:  this.mutationLog,
        hash_trace:    this.hashTrace,
      },
      events: this._entries,
    };
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(capture, null, 2));
    return capture;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export class ReplayController {
  constructor(captureOrPath) {
    this._capture    = typeof captureOrPath === 'string'
      ? JSON.parse(fs.readFileSync(captureOrPath, 'utf8'))
      : captureOrPath;
    this._startTs    = Date.now();
    this._chaosQueue = (this._capture.events ?? [])
      .filter(e => e.type === 'chaos')
      .map(e => ({ ...e, _used: false }));
  }

  get runConfig() { return this._capture.run_config ?? {}; }
  get capture()   { return this._capture; }

  async nextChaosEvent(action) {
    const entry = this._chaosQueue.find(e => e.action === action && !e._used);
    if (!entry) return null;
    entry._used  = true;
    const waitMs = Math.max(0, this._startTs + entry.ts_offset - Date.now());
    if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
    return entry;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * Validate that a replay reproduced the original run within governed tolerances.
 * Also compares mutation sequence and state hash sequence.
 *
 * @param originalCapture    Loaded replay-capture.json object
 * @param replaySummary      metrics.getSummary() from replay run
 * @param replayGating       performThresholdGating() result from replay run
 * @param opts.replayMutationLog   getMutationLog() filtered to replayable from replay run
 * @param opts.replayHashTrace     saveStateHashTrace() entries from replay run
 * @returns validation report (write to reports/replay-validation.json)
 */
export function validateReplay(originalCapture, replaySummary, replayGating, opts = {}) {
  const { replayMutationLog = [], replayHashTrace = [] } = opts;
  const orig             = originalCapture.run_config ?? {};
  const originalSummary  = orig.original_summary  ?? null;
  const originalBreaches = orig.original_breaches ?? [];
  const origMutations    = orig.mutation_log       ?? [];
  const origHashTrace    = orig.hash_trace         ?? [];

  const divergences        = [];
  const mutation_divergences = [];
  const hash_divergences     = [];

  // ── 1. Threshold breach set ──────────────────────────────────────────────
  const origBreachKeys   = new Set(originalBreaches.map(b => b.threshold_key));
  const replayBreachKeys = new Set((replayGating.breaches ?? []).map(b => b.threshold_key));
  for (const k of origBreachKeys)   { if (!replayBreachKeys.has(k)) divergences.push(`Expected breach '${k}' not reproduced`); }
  for (const k of replayBreachKeys) { if (!origBreachKeys.has(k))   divergences.push(`Unexpected breach '${k}' in replay`); }

  // ── 2. Governed metrics within tolerance ─────────────────────────────────
  const metricComparisons = [];
  if (originalSummary) {
    for (const key of GOVERNED_REPLAY_METRICS) {
      const origVal   = originalSummary[key];
      const replayVal = replaySummary[key];
      if (origVal == null || replayVal == null) continue;
      const pct = origVal !== 0 ? Math.abs(replayVal - origVal) / Math.abs(origVal) : (replayVal !== 0 ? 1 : 0);
      const ok  = pct <= METRIC_TOLERANCE;
      if (!ok) divergences.push(`Metric '${key}' diverged: orig=${origVal} replay=${replayVal} (${(pct*100).toFixed(1)}%)`);
      metricComparisons.push({ metric: key, original: origVal, replay: replayVal, pct_diff: parseFloat((pct*100).toFixed(2)), within_tolerance: ok });
    }
  }

  // ── 3. Named recoveries ───────────────────────────────────────────────────
  for (const [name, ms] of Object.entries(originalSummary?.named_recoveries ?? {})) {
    if (replaySummary.named_recoveries?.[name] == null) {
      divergences.push(`Named recovery '${name}' (${ms}ms) absent in replay`);
    }
  }

  // ── 4. Mutation sequence ──────────────────────────────────────────────────
  if (origMutations.length > 0 || replayMutationLog.length > 0) {
    const origSeq   = origMutations.map(m => `${m.domain}:${m.operation}:${m.entity_id}`);
    const replaySeq = replayMutationLog.map(m => `${m.domain}:${m.operation}:${m.entity_id}`);
    const maxLen    = Math.max(origSeq.length, replaySeq.length);
    for (let i = 0; i < maxLen; i++) {
      if (origSeq[i] !== replaySeq[i]) {
        mutation_divergences.push({
          index:    i,
          original: origSeq[i] ?? '(absent)',
          replay:   replaySeq[i] ?? '(absent)',
        });
        divergences.push(`Mutation[${i}] diverged: orig='${origSeq[i] ?? '(absent)'}' replay='${replaySeq[i] ?? '(absent)'}'`);
      }
    }
  }

  // ── 5. State hash sequence (legacy field comparison) ─────────────────────
  if (origHashTrace.length > 0 || replayHashTrace.length > 0) {
    const origHashes   = origHashTrace.map(e => e.next_hash);
    const replayHashes = replayHashTrace.map(e => e.next_hash);
    const maxLen       = Math.max(origHashes.length, replayHashes.length);
    for (let i = 0; i < maxLen; i++) {
      if (origHashes[i] !== replayHashes[i]) {
        hash_divergences.push({
          index:    i,
          original: origHashes[i] ?? '(absent)',
          replay:   replayHashes[i] ?? '(absent)',
          domain:   origHashTrace[i]?.domain ?? replayHashTrace[i]?.domain ?? '?',
        });
        divergences.push(`StateHash[${i}] diverged in domain '${origHashTrace[i]?.domain ?? '?'}'`);
      }
    }
  }

  // ── 6. Mutation chain integrity (replay chain must be self-consistent) ────
  const replayChainCheck = verifyChain(replayHashTrace);
  if (!replayChainCheck.valid) {
    for (const d of replayChainCheck.divergences) {
      divergences.push(`ReplayChain[${d.index ?? '?'}] ${d.type}: ${d.message}`);
    }
  }

  // ── 7. Cross-run chain comparison (final hash must match) ─────────────────
  const origChainEntries   = origMutations.filter(m => m.mutation_hash);
  const replayChainEntries = replayHashTrace.filter(m => m.mutation_hash);
  let chain_comparison = null;

  if (origChainEntries.length > 0 && replayChainEntries.length > 0) {
    const crossChain = compareChains(origChainEntries, replayChainEntries);
    chain_comparison = crossChain;
    if (!crossChain.final_hash_match) {
      divergences.push(`Chain final hash mismatch: orig and replay chains diverged`);
    }
    for (const d of crossChain.divergences) {
      divergences.push(`ChainDivergence[${d.index}]: ${d.message}`);
    }
  }

  return {
    validated_at:        new Date().toISOString(),
    status:              divergences.length === 0 ? 'PASS' : 'FAIL',
    threshold_match:     origBreachKeys.size === replayBreachKeys.size && !divergences.some(d => d.includes('breach')),
    causal_chain_match:  !divergences.some(d => d.includes('recovery')),
    final_hash_match:    chain_comparison?.final_hash_match ?? null,
    metric_comparison:   metricComparisons,
    mutation_comparison: mutation_divergences,
    hash_comparison:     hash_divergences,
    chain_comparison:    chain_comparison ? chain_comparison.divergences : [],
    divergences,
  };
}
