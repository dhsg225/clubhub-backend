/**
 * Resolution explanation generator.
 *
 * Converts a PRE_Output into a ResolutionExplanation.
 *
 * CRITICAL: summary is a deterministic template fill — never freeform generation.
 * CRITICAL: All fields derived from trace fields, not generated text.
 */

import type { PRE_Output } from '../../pre/types';
import type { ResolutionExplanation } from '../types';
import { LEVEL_NAMES } from '../constants';
import { formatReasonTrace } from '../formatters/reason-trace-formatter';

/**
 * Build a deterministic summary string from structured fields.
 * Format: "Resolved at LEVEL_{n} ({level_name}). {N} levels evaluated, {M} skipped."
 */
function buildSummary(
  terminatingLevel:  number,
  levelName:         string,
  skippedCount:      number,
  evaluatedCount:    number
): string {
  return `Resolved at LEVEL_${terminatingLevel} (${levelName}). ${evaluatedCount} levels evaluated, ${skippedCount} skipped.`;
}

/**
 * Generate a full resolution explanation from a PRE_Output.
 * Pure function — same input always produces same output.
 */
export function explainResolution(output: PRE_Output): ResolutionExplanation {
  const terminatingLevel     = output.resolution_level;
  const terminating_level_name = LEVEL_NAMES[terminatingLevel] ?? `Level ${terminatingLevel}`;

  const { level_explanations, skipped_levels, active_constraints } = formatReasonTrace(
    output.reason_trace,
    terminatingLevel
  );

  // Count evaluated levels: those with a non-null trace entry
  const evaluatedCount = level_explanations.filter(e => e.outcome !== null).length;
  const skippedCount   = skipped_levels.length;

  const summary = buildSummary(terminatingLevel, terminating_level_name, skippedCount, evaluatedCount);

  return {
    terminating_level:      terminatingLevel,
    terminating_level_name,
    summary,
    level_explanations,
    skipped_levels,
    active_constraints,
  };
}
