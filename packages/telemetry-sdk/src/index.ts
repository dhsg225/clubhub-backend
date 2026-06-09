/**
 * @clubhub/telemetry-sdk
 *
 * Structured logging and metrics for constitutional runtime.
 *
 * FORBIDDEN in @clubhub/pre-engine (FP-21).
 * Only import this from runtime wrappers, not from PRE resolution logic.
 */

import type { BaseLogLine } from '@clubhub/constitutional-types';

// ─── Logger ──────────────────────────────────────────────────────────────────

let _requestId: string | null = null;
let _replayId: string | null = null;

export function setRequestId(id: string | null): void {
  _requestId = id;
}

export function setReplayId(id: string | null): void {
  _replayId = id;
}

export function base(
  severity: BaseLogLine['severity'],
  event_type: string,
): Omit<BaseLogLine, 'event_type'> & { event_type: string } {
  return {
    ts: Date.now(),
    severity,
    event_type,
    request_id: _requestId,
    replay_id: _replayId,
  };
}

export function emit(logLine: BaseLogLine): void {
  // In production: route to OpenTelemetry/structured log sink
  // In development: write to stdout as NDJSON
  process.stdout.write(JSON.stringify(logLine) + '\n');
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export const METRICS = {
  PRE_INVOCATIONS_TOTAL: 'pre_invocations_total',
  PRE_LEVEL_SELECTION_TOTAL: 'pre_level_selection_total',
  SHADOW_PARITY_RATIO: 'shadow_parity_ratio',
  CANARY_STAGE: 'canary_stage',
  ROLLBACK_TRIGGER_TOTAL: 'rollback_trigger_total',
  PREVIEW_REQUEST_TOTAL: 'preview_request_total',
  REPLAY_AUDIT_WRITES_TOTAL: 'replay_audit_writes_total',
  ENTROPY_JOB_DURATION_MS: 'entropy_job_duration_ms',
  PARITY_DIVERGENCES_TOTAL: 'parity_divergences_total',
} as const;

type MetricName = (typeof METRICS)[keyof typeof METRICS];

export function increment(metric: MetricName, labels?: Record<string, string>): void {
  // In production: route to Prometheus/OTel metrics
  // In development: no-op (metrics are optional in local dev)
  if (process.env['METRICS_DEBUG'] === 'true') {
    process.stdout.write(
      JSON.stringify({ metric, labels, type: 'increment', ts: Date.now() }) + '\n',
    );
  }
}

export function setGauge(
  metric: MetricName,
  value: number,
  labels?: Record<string, string>,
): void {
  if (process.env['METRICS_DEBUG'] === 'true') {
    process.stdout.write(
      JSON.stringify({ metric, labels, value, type: 'gauge', ts: Date.now() }) + '\n',
    );
  }
}
