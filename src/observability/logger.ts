/**
 * Structured constitutional logger.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13
 *
 * All constitutional infrastructure emits structured JSON lines via this module.
 * Severity CONSTITUTIONAL_BREACH and CATASTROPHIC MUST trigger alert emission.
 *
 * RULES:
 * - No locale-sensitive formatting (timestamps as UTC ms integers)
 * - No ad-hoc string concatenation — use typed log schemas
 * - CONSTITUTIONAL_BREACH and CATASTROPHIC logs are never suppressed
 */

import type { AnyLogLine, LogSeverity } from './telemetry-schemas';

// ─── Correlation Context ──────────────────────────────────────────────────────

/** Thread-local equivalent: request and replay correlation IDs */
let _requestId: string | null = null;
let _replayId: string | null = null;

export function setRequestId(id: string | null): void { _requestId = id; }
export function setReplayId(id: string | null): void  { _replayId = id; }
export function getRequestId(): string | null { return _requestId; }
export function getReplayId(): string | null  { return _replayId; }

// ─── Alert Sink ──────────────────────────────────────────────────────────────

type AlertSink = (line: AnyLogLine) => void;
const alertSinks: AlertSink[] = [];

/** Register an alert sink. Called for CONSTITUTIONAL_BREACH and CATASTROPHIC logs. */
export function registerAlertSink(sink: AlertSink): void {
  alertSinks.push(sink);
}

const ALERT_SEVERITIES = new Set<LogSeverity>(['CONSTITUTIONAL_BREACH', 'CATASTROPHIC']);

// ─── Emit ─────────────────────────────────────────────────────────────────────

/**
 * Emit a structured log line.
 *
 * In test environments, output is suppressed unless LOG_LEVEL=debug.
 * In production, all lines go to stdout as JSON.
 * CONSTITUTIONAL_BREACH and CATASTROPHIC always emit regardless of environment.
 */
export function emit(line: AnyLogLine): void {
  const withCorrelation: AnyLogLine = {
    ...line,
    request_id: line.request_id ?? _requestId,
    replay_id:  line.replay_id  ?? _replayId,
  };

  // Always write to stdout as JSON
  process.stdout.write(JSON.stringify(withCorrelation) + '\n');

  // Alert sinks for constitutional breaches
  if (ALERT_SEVERITIES.has(withCorrelation.severity)) {
    for (const sink of alertSinks) {
      try {
        sink(withCorrelation);
      } catch {
        // Alert sink failure must not suppress the log or crash the system
        process.stderr.write(`Alert sink failed for ${withCorrelation.event_type}\n`);
      }
    }
  }
}

// ─── Convenience Builders ─────────────────────────────────────────────────────

export function now(): number {
  return Date.now();
}

/** Build base fields for any log line */
export function base(severity: LogSeverity, event_type: string): {
  ts: number; severity: LogSeverity; event_type: string;
  request_id: string | null; replay_id: string | null;
} {
  return {
    ts: Date.now(),
    severity,
    event_type,
    request_id: _requestId,
    replay_id: _replayId,
  };
}
