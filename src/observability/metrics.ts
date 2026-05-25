/**
 * Prometheus-compatible metric emitters.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13.3
 *
 * Metric namespaces:
 *   clubhub_pre_*        — PRE invocation metrics
 *   clubhub_replay_*     — Replay harness metrics
 *   clubhub_invariant_*  — Invariant assertion metrics
 *   clubhub_entropy_*    — Entropy score metrics
 *   clubhub_parity_*     — Shadow-mode parity metrics
 *   clubhub_chaos_*      — Chaos scenario metrics
 */

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricDefinition {
  name:   string;
  type:   MetricType;
  help:   string;
  labels: string[];
}

// ─── Metric Registry ──────────────────────────────────────────────────────────

const registry = new Map<string, MetricDefinition>();

function define(def: MetricDefinition): MetricDefinition {
  registry.set(def.name, def);
  return def;
}

// ─── Metric Definitions ───────────────────────────────────────────────────────

export const METRICS = {
  // PRE
  PRE_INVOCATIONS_TOTAL:       define({ name: 'clubhub_pre_invocations_total',       type: 'counter',   help: 'Total PRE.resolve() invocations',           labels: ['resolution_level', 'is_fallback'] }),
  PRE_DURATION_MS:             define({ name: 'clubhub_pre_duration_ms',             type: 'histogram', help: 'PRE.resolve() execution time in ms',        labels: [] }),

  // Replay
  REPLAY_PACKETS_TOTAL:        define({ name: 'clubhub_replay_packets_total',        type: 'counter',   help: 'Total replay packets executed',             labels: ['corpus_class', 'result'] }),
  REPLAY_RUN_DURATION_MS:      define({ name: 'clubhub_replay_run_duration_ms',      type: 'histogram', help: 'Full replay run duration in ms',            labels: [] }),
  REPLAY_DIVERGENCES_TOTAL:    define({ name: 'clubhub_replay_divergences_total',    type: 'counter',   help: 'Replay divergences by class',               labels: ['divergence_class'] }),

  // Invariants
  INVARIANT_VIOLATIONS_TOTAL:  define({ name: 'clubhub_invariant_violations_total',  type: 'counter',   help: 'INV-N assertion failures',                  labels: ['invariant_id', 'severity'] }),
  INVARIANT_CHECKS_TOTAL:      define({ name: 'clubhub_invariant_checks_total',      type: 'counter',   help: 'Total invariant checks executed',           labels: ['invariant_id'] }),

  // Entropy — per-screen and per-venue scoring (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §16)
  ENTROPY_SCORE:               define({ name: 'clubhub_entropy_score',               type: 'gauge',     help: 'Entropy composite score [0,1] per screen',  labels: ['screen_id', 'venue_id'] }),
  ENTROPY_METRIC_VALUE:        define({ name: 'clubhub_entropy_metric_value',        type: 'gauge',     help: 'Individual entropy metric value [0,1]',     labels: ['metric_id', 'screen_id'] }),
  ENTROPY_ADVISORY_TIER:       define({ name: 'clubhub_entropy_advisory_tier',       type: 'gauge',     help: 'Entropy advisory tier (0–4) per screen',    labels: ['screen_id'] }),
  ENTROPY_SCREEN_COUNT:        define({ name: 'clubhub_entropy_screen_count',        type: 'gauge',     help: 'Count of screens by entropy label',         labels: ['venue_id', 'label'] }),
  ENTROPY_CRITICAL_COUNT:      define({ name: 'clubhub_entropy_critical_count',      type: 'gauge',     help: 'Count of screens at CRITICAL entropy level', labels: ['venue_id'] }),

  // Parity
  PARITY_SCORE_24H:            define({ name: 'clubhub_parity_score_24h',            type: 'gauge',     help: 'Shadow parity score over 24h window',       labels: [] }),
  PARITY_DIVERGENCES_TOTAL:    define({ name: 'clubhub_parity_divergences_total',    type: 'counter',   help: 'Shadow-mode parity divergences',            labels: ['divergence_class'] }),

  // Forbidden states
  FORBIDDEN_STATE_VIOLATIONS:  define({ name: 'clubhub_forbidden_state_violations',  type: 'gauge',     help: 'FORBIDDEN state violations currently active',labels: ['forbidden_id'] }),

  // Emergency
  EMERGENCY_ACTIVATIONS_TOTAL: define({ name: 'clubhub_emergency_activations_total', type: 'counter',   help: 'Emergency state activations',               labels: ['venue_id', 'is_global'] }),

  // Shadow / canary
  SHADOW_PARITY_RATIO:         define({ name: 'clubhub_shadow_parity_ratio',         type: 'gauge',     help: 'Shadow parity ratio (agreements/total)',    labels: ['canary_stage'] }),
  CANARY_STAGE:                define({ name: 'clubhub_canary_stage',                type: 'gauge',     help: 'Current canary stage index (0-5)',           labels: [] }),
  ROLLBACK_TRIGGER_TOTAL:      define({ name: 'clubhub_rollback_trigger_total',      type: 'counter',   help: 'Rollback trigger events by reason',         labels: ['reason', 'severity'] }),

  // Preview API
  PREVIEW_REQUEST_TOTAL:       define({ name: 'clubhub_preview_request_total',       type: 'counter',   help: 'Preview endpoint requests by surface',      labels: ['surface'] }),

  // Replay audit
  REPLAY_AUDIT_WRITES_TOTAL:   define({ name: 'clubhub_replay_audit_writes_total',   type: 'counter',   help: 'Replay audit records written',              labels: [] }),

  // Entropy jobs
  ENTROPY_JOB_DURATION_MS:     define({ name: 'clubhub_entropy_job_duration_ms',     type: 'histogram', help: 'Entropy job execution time in ms',          labels: ['job_type'] }),

  // PRE level selection
  PRE_LEVEL_SELECTION_TOTAL:   define({ name: 'clubhub_pre_level_selection_total',   type: 'counter',   help: 'PRE resolution level selections',           labels: ['level'] }),
} as const;

// ─── In-memory counter/gauge store (no external dep required for bootstrap) ───

type LabelSet = Record<string, string>;

const counters  = new Map<string, number>();
const gauges    = new Map<string, number>();

function labelKey(name: string, labels: LabelSet): string {
  const sorted = Object.keys(labels).sort().map(k => `${k}="${labels[k]}"`).join(',');
  return `${name}{${sorted}}`;
}

export function increment(metric: MetricDefinition, labels: LabelSet = {}, amount = 1): void {
  const key = labelKey(metric.name, labels);
  counters.set(key, (counters.get(key) ?? 0) + amount);
}

export function setGauge(metric: MetricDefinition, value: number, labels: LabelSet = {}): void {
  const key = labelKey(metric.name, labels);
  gauges.set(key, value);
}

/** Export all metrics in Prometheus text format */
export function exportPrometheusText(): string {
  const lines: string[] = [];

  for (const [key, value] of counters) {
    lines.push(`# TYPE ${key.split('{')[0]} counter`);
    lines.push(`${key} ${value}`);
  }
  for (const [key, value] of gauges) {
    lines.push(`# TYPE ${key.split('{')[0]} gauge`);
    lines.push(`${key} ${value}`);
  }

  return lines.join('\n') + '\n';
}
