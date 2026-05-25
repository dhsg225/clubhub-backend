/**
 * Reason trace formatter.
 *
 * Converts PRE reason_trace into structured, deterministic LevelExplanation[].
 *
 * Rules:
 *   - Never paraphrase — derive from reason string directly
 *   - Preserve ALL levels including null (not-reached) ones
 *   - Extract structured fields from reason strings
 *   - All output deterministic given same reason_trace input
 */

import type { ReasonTrace, ReasonTraceLevel } from '../../pre/types';
import type { LevelExplanation, SkippedLevel } from '../types';
import { LEVEL_NAMES, PRE_LEVEL_COUNT } from '../constants';

// ─── Reason String Parsers ────────────────────────────────────────────────────

/**
 * Parse a key=value pair list from a reason string segment.
 * e.g. "schedule_id=sched-001,campaign=Summer Menu 2026,specificity=AREA"
 */
function parseKvPairs(segment: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Split on commas that are NOT inside a value (values don't contain commas in our format)
  const parts = segment.split(',');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) {
      result['_flag_' + part] = 'true';
    } else {
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      result[key] = val;
    }
  }
  return result;
}

/**
 * Parse a structured reason string into a detail object.
 * Format: "L{N}:{CODE}:{kv_pairs}"
 * Returns null if no structured data found.
 */
export function parseReasonString(reason: string): {
  level: number;
  code: string;
  detail: Record<string, unknown>;
} | null {
  const match = reason.match(/^L(\d+):([A-Z0-9_]+)(?::(.*))?$/);
  if (!match) return null;

  const level = parseInt(match[1] as string, 10);
  const code  = match[2] as string;
  const rest  = match[3] ?? '';

  const detail: Record<string, unknown> = { code };
  if (rest) {
    const kv = parseKvPairs(rest);
    Object.assign(detail, kv);
  }

  return { level, code, detail };
}

// ─── Active Constraint Extraction ─────────────────────────────────────────────

/**
 * Extract active_constraints from the winning level's trace entry detail.
 * Looks for dow_constraint, start_time_minutes, end_time_minutes, days_of_week fields.
 */
export function extractActiveConstraints(detail: Record<string, unknown>): string[] {
  const constraints: string[] = [];

  const dow = detail['dow_constraint'];
  if (typeof dow === 'string' && dow !== '') {
    constraints.push(`days_of_week constraint: ${dow.replace(/_/g, ' ')}`);
  }

  const startMin = detail['start_time_minutes'];
  const endMin   = detail['end_time_minutes'];
  if (typeof startMin === 'string' && typeof endMin === 'string') {
    constraints.push(`time window: ${startMin}–${endMin} minutes-of-day`);
  } else if (typeof startMin === 'string') {
    constraints.push(`time window starts at: ${startMin} minutes-of-day`);
  } else if (typeof endMin === 'string') {
    constraints.push(`time window ends at: ${endMin} minutes-of-day`);
  }

  const specificity = detail['specificity'];
  if (typeof specificity === 'string' && specificity !== '') {
    constraints.push(`specificity: ${specificity}`);
  }

  const wonBy = detail['won_by'];
  if (typeof wonBy === 'string' && wonBy !== '') {
    constraints.push(`won_by: ${wonBy.replace(/_/g, ' ')}`);
  }

  return constraints;
}

// ─── Level Trace → LevelExplanation ──────────────────────────────────────────

/**
 * Build a LevelExplanation from a ReasonTraceLevel entry (or null if not reached).
 */
export function buildLevelExplanation(
  level:       number,
  traceEntry:  ReasonTraceLevel | null,
  isSkipped:   boolean
): LevelExplanation {
  const level_name = LEVEL_NAMES[level] ?? `Level ${level}`;

  if (traceEntry === null) {
    if (isSkipped) {
      return {
        level,
        level_name,
        outcome: 'SKIP',
        reason:  'Not evaluated — skipped by higher-priority termination',
        detail:  null,
      };
    }
    return {
      level,
      level_name,
      outcome: null,
      reason:  null,
      detail:  null,
    };
  }

  const parsed = parseReasonString(traceEntry.reason);
  const detail: Record<string, unknown> = parsed ? parsed.detail : { raw: traceEntry.reason };

  // Include any extra fields from the trace entry (e.g. contracts_active, confidence_score)
  for (const [k, v] of Object.entries(traceEntry)) {
    if (k !== 'outcome' && k !== 'reason') {
      detail[k] = v;
    }
  }

  return {
    level,
    level_name,
    outcome: traceEntry.outcome,
    reason:  traceEntry.reason,
    detail,
  };
}

// ─── Trace → LevelExplanation[] ──────────────────────────────────────────────

const TRACE_KEYS: Array<keyof ReasonTrace> = [
  'level_0_emergency',
  'level_1_operational',
  'level_2_scheduled',
  'level_3_campaign',
  'level_4_sponsorship',
  'level_5_structural',
  'level_6_device_truth',
];

/**
 * Convert a full ReasonTrace into LevelExplanation[] for all 7 levels.
 * Determines which levels were skipped vs not-reached based on terminatingLevel.
 */
export function formatReasonTrace(
  trace:            ReasonTrace,
  terminatingLevel: number
): {
  level_explanations: LevelExplanation[];
  skipped_levels:     SkippedLevel[];
  active_constraints: string[];
} {
  const traceValues = [
    trace.level_0_emergency,
    trace.level_1_operational,
    trace.level_2_scheduled,
    trace.level_3_campaign,
    trace.level_4_sponsorship,
    trace.level_5_structural,
    trace.level_6_device_truth,
  ];

  const level_explanations: LevelExplanation[] = [];
  const skipped_levels:     SkippedLevel[]     = [];
  let   active_constraints: string[]           = [];

  for (let i = 0; i < PRE_LEVEL_COUNT; i++) {
    const entry = traceValues[i] ?? null;

    // Level 6 is always annotation — not skipped even if null
    const isAnnotationLevel = i === 6;

    // Determine skip status:
    // A level is "skipped" if:
    //   - It has no trace entry AND
    //   - It is below the terminating level AND
    //   - It is not the annotation level (6) AND
    //   - Special: levels 4+5 are skipped at LEVEL_0 and LEVEL_1
    const isBeforeTerminating = i < terminatingLevel;
    const isSkipped = !isAnnotationLevel && entry === null && (
      isBeforeTerminating ||
      ((terminatingLevel === 0 || terminatingLevel === 1) && (i === 4 || i === 5))
    );

    const explanation = buildLevelExplanation(i, entry as ReasonTraceLevel | null, isSkipped);
    level_explanations.push(explanation);

    if (isSkipped && i !== terminatingLevel) {
      const skipReason = (terminatingLevel === 0 || terminatingLevel === 1) && (i === 4 || i === 5)
        ? `Skipped — levels 4 and 5 are bypassed when resolution terminates at LEVEL_${terminatingLevel}`
        : `Skipped — resolution terminated at LEVEL_${terminatingLevel} before reaching this level`;

      skipped_levels.push({
        level:       i,
        level_name:  LEVEL_NAMES[i] ?? `Level ${i}`,
        skip_reason: skipReason,
      });
    }

    // Extract active constraints from the winning (terminating) level's trace entry
    if (i === terminatingLevel && entry !== null) {
      const parsed = parseReasonString((entry as ReasonTraceLevel).reason);
      if (parsed) {
        active_constraints = extractActiveConstraints(parsed.detail);
      }
    }
  }

  return { level_explanations, skipped_levels, active_constraints };
}
