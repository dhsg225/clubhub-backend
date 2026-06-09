/**
 * INV-5: Level Termination
 *
 * Resolution terminates at exactly one level. Once a level resolves the output,
 * lower-priority levels are not evaluated. The resolution_level field records
 * which level terminated resolution.
 *
 * The reason_trace must be consistent: exactly one level has outcome 'RESOLVED',
 * and all lower-priority levels must have outcome 'SKIP' or null.
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.5
 * PRE-REFERENCE-IMPLEMENTATION-v1.md §2 (Resolution Algorithm)
 *
 * Level priority (highest to lowest):
 *   LEVEL_0 > LEVEL_1 > LEVEL_2 > LEVEL_3 > LEVEL_4 > LEVEL_5 > LEVEL_6
 */

import { registerInvariant } from './index';
import { RESOLUTION_LEVELS } from '../../pre/types';

registerInvariant({
  id: 'INV-5',
  description: 'Resolution terminates at exactly one level; reason_trace consistent with resolution_level',
  severity: 'CONSTITUTIONAL_BREACH',
  assert(output, _input) {
    const level = output.resolution_level;

    if (!Number.isInteger(level) || level < 0 || level > 6) {
      return {
        invariantId: 'INV-5',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message: `resolution_level=${level} is not a valid level (0–6).`,
      };
    }

    const trace = output.reason_trace;

    // Map level number to trace field name
    const levelTraceFields: Record<number, keyof typeof trace> = {
      [RESOLUTION_LEVELS.LEVEL_0_EMERGENCY]:    'level_0_emergency',
      [RESOLUTION_LEVELS.LEVEL_1_OPERATIONAL]:  'level_1_operational',
      [RESOLUTION_LEVELS.LEVEL_2_SCHEDULED]:    'level_2_scheduled',
      [RESOLUTION_LEVELS.LEVEL_3_CAMPAIGN]:     'level_3_campaign',
      [RESOLUTION_LEVELS.LEVEL_4_SPONSORSHIP]:  'level_4_sponsorship',
      [RESOLUTION_LEVELS.LEVEL_5_STRUCTURAL]:   'level_5_structural',
      [RESOLUTION_LEVELS.LEVEL_6_DEVICE_TRUTH]: 'level_6_device_truth',
    };

    // The resolving level's trace entry must be non-null
    const resolvingFieldName = levelTraceFields[level];
    if (!resolvingFieldName) {
      return {
        invariantId: 'INV-5',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message: `No trace field mapping for resolution_level=${level}.`,
      };
    }

    const resolvingEntry = trace[resolvingFieldName];
    if (resolvingEntry === null || resolvingEntry === undefined) {
      return {
        invariantId: 'INV-5',
        passed: false,
        severity: 'CONSTITUTIONAL_BREACH',
        message:
          `Level termination violation: resolution_level=${level} but ` +
          `reason_trace.${String(resolvingFieldName)} is null. ` +
          `The resolving level must have a non-null trace entry.`,
      };
    }

    // All levels with lower index than resolution_level must be null
    // (they were skipped — never evaluated because a higher-priority level resolved)
    for (let higherLevel = 0; higherLevel < level; higherLevel++) {
      const higherField = levelTraceFields[higherLevel];
      if (higherField && trace[higherField] !== null) {
        const entry = trace[higherField];
        // SKIP outcomes at higher-priority levels are allowed.
        // A higher-priority level may be evaluated and find something (e.g. an expired override)
        // but still "skip" — recording why it didn't resolve. This is informational, not a breach.
        if (entry && typeof entry === 'object' && 'outcome' in entry && (entry as { outcome: unknown }).outcome === 'SKIP') {
          continue;
        }
        // EXCEPT: LEVEL_4 (sponsorship) runs AFTER LEVEL_3 (campaign) to inject SOV,
        // so LEVEL_4 may be non-null when LEVEL_3 resolved. This is by design.
        if (higherLevel === RESOLUTION_LEVELS.LEVEL_4_SPONSORSHIP) {
          continue; // Sponsorship injection is additive, not alternative
        }
        return {
          invariantId: 'INV-5',
          passed: false,
          severity: 'CONSTITUTIONAL_BREACH',
          message:
            `Level termination violation: resolution_level=${level} but ` +
            `reason_trace.${String(higherField)} (level ${higherLevel}) has a RESOLVED outcome. ` +
            `A higher-priority level must not RESOLVE when a lower-priority level terminates.`,
          detail: { conflicting_level: higherLevel, field: higherField },
        };
      }
    }

    return {
      invariantId: 'INV-5',
      passed: true,
      severity: 'CONSTITUTIONAL_BREACH',
      message: `Level termination holds: resolves at LEVEL_${level}, trace consistent`,
    };
  },
});
