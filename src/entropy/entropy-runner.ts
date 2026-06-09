/**
 * Per-screen entropy runner.
 *
 * Constitutional authority: OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §16.3
 *
 * Runs all 12 metric calculators against a single SystemStateSnapshot
 * and returns a composite EntropyScore.
 *
 * This is the atomic unit of entropy computation — the venue and fleet
 * runners aggregate multiple screen results.
 *
 * Pure function — no side effects, no mutation, deterministic.
 * Never throws — each calculator catches its own errors.
 */

import type { SystemStateSnapshot } from '../pre/types';
import type { EntropyScore } from './types';
import { computeEntropyScore } from './entropy-score';

import { computeM01OverrideDivergence }            from './calculators/m01-override-divergence';
import { computeM02ScheduleFragmentation }          from './calculators/m02-schedule-fragmentation';
import { computeM03CampaignCoverage }               from './calculators/m03-campaign-coverage';
import { computeM04PrioritySpread }                 from './calculators/m04-priority-spread';
import { computeM05ManualInterventionFrequency }    from './calculators/m05-manual-intervention-frequency';
import { computeM06EmergencySemanticDrift }         from './calculators/m06-emergency-semantic-drift';
import { computeM07ScreenConfigurationDivergence }  from './calculators/m07-screen-configuration-divergence';
import { computeM08SponsorSaturation }              from './calculators/m08-sponsor-saturation';
import { computeM09DeviceStaleness }                from './calculators/m09-device-staleness';
import { computeM10ContentMixInstability }          from './calculators/m10-content-mix-instability';
import { computeM11PreviewResolutionDivergence }    from './calculators/m11-preview-resolution-divergence';
import { computeM12ScreenStaleness }                from './calculators/m12-screen-staleness';

/**
 * Compute entropy score for a single screen state snapshot.
 *
 * @param state SystemStateSnapshot for the screen
 * @param at    UTC ms evaluation timestamp (must be the same `at` used for PRE.resolve())
 * @returns EntropyScore with all 12 metric results and composite
 */
export function computeScreenEntropy(
  state: SystemStateSnapshot,
  at:    number
): EntropyScore {
  const metrics = [
    computeM01OverrideDivergence(state, at),
    computeM02ScheduleFragmentation(state, at),
    computeM03CampaignCoverage(state, at),
    computeM04PrioritySpread(state, at),
    computeM05ManualInterventionFrequency(state, at),
    computeM06EmergencySemanticDrift(state, at),
    computeM07ScreenConfigurationDivergence(state, at),
    computeM08SponsorSaturation(state, at),
    computeM09DeviceStaleness(state, at),
    computeM10ContentMixInstability(state, at),
    computeM11PreviewResolutionDivergence(state, at),
    computeM12ScreenStaleness(state, at),
  ];

  return computeEntropyScore(metrics, at, state.screen.id, state.venue.id);
}
