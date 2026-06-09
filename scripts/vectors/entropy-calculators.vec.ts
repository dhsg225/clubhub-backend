#!/usr/bin/env ts-node
/**
 * Entropy calculator contract vectors.
 *
 * Tests M-01 through M-12 calculators for:
 *   1. Output range: value in [0, 1]
 *   2. Determinism: same input → same output
 *   3. Threshold boundaries: just-below-warn, just-above-warn, just-above-critical
 *   4. Explanation: non-empty string
 *   5. Contributing factors: array (may be empty for score=0)
 *
 * Usage: npx ts-node scripts/vectors/entropy-calculators.vec.ts
 */

import type { SystemStateSnapshot, OverrideRecord, ScheduleRecord, SponsorshipContractRecord } from '../../src/pre/types';
import { buildMinimalState, assert, summary } from './_fixture';

// Import calculators
import { computeM01OverrideDivergence }           from '../../src/entropy/calculators/m01-override-divergence';
import { computeM02ScheduleFragmentation }         from '../../src/entropy/calculators/m02-schedule-fragmentation';
import { computeM03CampaignCoverage }              from '../../src/entropy/calculators/m03-campaign-coverage';
import { computeM04PrioritySpread }                from '../../src/entropy/calculators/m04-priority-spread';
import { computeM05ManualInterventionFrequency }   from '../../src/entropy/calculators/m05-manual-intervention-frequency';
import { computeM06EmergencySemanticDrift }        from '../../src/entropy/calculators/m06-emergency-semantic-drift';
import { computeM07ScreenConfigurationDivergence } from '../../src/entropy/calculators/m07-screen-configuration-divergence';
import { computeM08SponsorSaturation }             from '../../src/entropy/calculators/m08-sponsor-saturation';
import { computeM09DeviceStaleness }               from '../../src/entropy/calculators/m09-device-staleness';
import { computeM10ContentMixInstability }         from '../../src/entropy/calculators/m10-content-mix-instability';
import { computeM11PreviewResolutionDivergence }   from '../../src/entropy/calculators/m11-preview-resolution-divergence';
import { computeM12ScreenStaleness }               from '../../src/entropy/calculators/m12-screen-staleness';

const AT = 1_748_000_000_000; // Fixed evaluation timestamp

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertMetricValid(
  result: ReturnType<typeof computeM01OverrideDivergence>,
  label:  string
): void {
  assert(result.value >= 0 && result.value <= 1,    `${label}: value in [0,1] (got ${result.value})`);
  assert(typeof result.raw_value === 'number',       `${label}: raw_value is number`);
  assert(typeof result.unit === 'string' && result.unit.length > 0, `${label}: unit is non-empty string`);
  assert(typeof result.explanation === 'string' && result.explanation.length > 0,
    `${label}: explanation is non-empty string`);
  assert(Array.isArray(result.contributing_factors), `${label}: contributing_factors is array`);
  assert(result.computed_at === AT,                  `${label}: computed_at matches at parameter`);
}

function makeOverride(overrides: Partial<OverrideRecord> = {}): OverrideRecord {
  return {
    id:             'override-1',
    content_id:     'content-a',
    target_type:    'screen',
    target_id:      'screen-001',
    starts_at:      AT - 1000,
    expires_at:     null,
    is_operational: false,
    priority:       10,
    reason:         null,
    issued_by:      null,
    ...overrides,
  };
}

function makeSchedule(overrides: Partial<ScheduleRecord> = {}): ScheduleRecord {
  return {
    id:                 'schedule-1',
    campaign_id:        null,
    content_id:         'content-a',
    target_type:        'venue',
    target_id:          'venue-001',
    specificity:        0,
    starts_at:          AT - 1000,
    expires_at:         null,
    days_of_week:       [],
    start_time_minutes: null,
    end_time_minutes:   null,
    is_active:          true,
    is_fallback:        false,
    priority:           10,
    ...overrides,
  };
}

// ─── M-01: Override Divergence ────────────────────────────────────────────────

console.log('\n── M-01: Override Divergence ──');

{
  // Zero state: no overrides
  const state  = buildMinimalState({ overrides: [] });
  const result = computeM01OverrideDivergence(state, AT);
  assertMetricValid(result, 'M-01 clean');
  assert(result.value === 0, 'M-01 clean: value is 0 with no overrides');
  assert(result.metric_id === 'M-01', 'M-01: metric_id is M-01');

  // Determinism
  const result2 = computeM01OverrideDivergence(state, AT);
  assert(result.value === result2.value, 'M-01: deterministic (same input → same output)');
}

{
  // With active override: should produce high raw_value (100)
  const state  = buildMinimalState({ overrides: [makeOverride()] });
  const result = computeM01OverrideDivergence(state, AT);
  assertMetricValid(result, 'M-01 with override');
  assert(result.raw_value === 100, 'M-01: raw_value is 100 when screen has override');
  assert(result.value > 0, 'M-01: normalized value > 0 when override present');
}

{
  // Expired override: should not count
  const state  = buildMinimalState({ overrides: [makeOverride({ expires_at: AT - 1000 })] });
  const result = computeM01OverrideDivergence(state, AT);
  assert(result.raw_value === 0, 'M-01: expired override does not count');
}

// ─── M-02: Schedule Fragmentation ────────────────────────────────────────────

console.log('\n── M-02: Schedule Fragmentation ──');

{
  // No schedules: zero
  const state  = buildMinimalState({ schedules: [] });
  const result = computeM02ScheduleFragmentation(state, AT);
  assertMetricValid(result, 'M-02 clean');
  assert(result.value === 0, 'M-02 clean: value is 0 with no schedules');
}

{
  // Two schedules with same (content_id, target_type, target_id) = 1 duplicate pair
  const s1 = makeSchedule({ id: 'sched-1', content_id: 'content-a', target_type: 'venue', target_id: 'venue-001' });
  const s2 = makeSchedule({ id: 'sched-2', content_id: 'content-a', target_type: 'venue', target_id: 'venue-001' });
  const state  = buildMinimalState({ schedules: [s1, s2] });
  const result = computeM02ScheduleFragmentation(state, AT);
  assertMetricValid(result, 'M-02 with duplicate');
  assert(result.raw_value === 1, 'M-02: 1 duplicate pair detected');
  assert(result.value > 0, 'M-02: normalized value > 0 with duplicates');

  // Determinism
  const result2 = computeM02ScheduleFragmentation(state, AT);
  assert(result.value === result2.value, 'M-02: deterministic');
}

{
  // Just below advisory (3 pairs) — raw_value=2, below advisory=3
  const schedules: ScheduleRecord[] = [];
  for (let i = 0; i < 4; i++) {
    // 2 pairs: content-a×venue-001 (2 items) and content-b×venue-001 (2 items)
    schedules.push(makeSchedule({ id: `s${i}`, content_id: i < 2 ? 'content-a' : 'content-b' }));
  }
  const state  = buildMinimalState({ schedules });
  const result = computeM02ScheduleFragmentation(state, AT);
  assert(result.raw_value === 2, 'M-02: 2 duplicate pairs just below advisory');
  assert(result.value < 0.50, 'M-02: normalized value < 0.50 below advisory threshold');
}

// ─── M-03: Campaign Coverage ──────────────────────────────────────────────────

console.log('\n── M-03: Campaign Coverage ──');

{
  // No schedules: 100% coverage → 0% inverted → value = 0
  const state  = buildMinimalState({ schedules: [] });
  const result = computeM03CampaignCoverage(state, AT);
  assertMetricValid(result, 'M-03 empty');
  assert(result.value === 0, 'M-03 empty: value is 0 (no schedules = clean)');
}

{
  // All schedules have campaign_id: 100% coverage → 0% inverted → value = 0
  const s1 = makeSchedule({ id: 's1', campaign_id: 'camp-1' });
  const s2 = makeSchedule({ id: 's2', campaign_id: 'camp-2' });
  const state  = buildMinimalState({ schedules: [s1, s2] });
  const result = computeM03CampaignCoverage(state, AT);
  assertMetricValid(result, 'M-03 full coverage');
  assert(result.raw_value === 0, 'M-03 full coverage: raw_value (inverted) is 0');
  assert(result.value === 0, 'M-03 full coverage: normalized value is 0');
}

{
  // 0% campaign coverage (no campaign_id): inverted = 100, above review threshold (70)
  const s1 = makeSchedule({ id: 's1', campaign_id: null });
  const s2 = makeSchedule({ id: 's2', campaign_id: null });
  const state  = buildMinimalState({ schedules: [s1, s2] });
  const result = computeM03CampaignCoverage(state, AT);
  assertMetricValid(result, 'M-03 zero coverage');
  assert(result.raw_value === 100, 'M-03 zero coverage: inverted raw_value is 100');
  assert(result.value > 0.50, 'M-03 zero coverage: normalized value > 0.50 (above advisory)');

  // Determinism
  const result2 = computeM03CampaignCoverage(state, AT);
  assert(result.value === result2.value, 'M-03: deterministic');
}

// ─── M-04: Priority Spread ────────────────────────────────────────────────────

console.log('\n── M-04: Priority Spread ──');

{
  // No schedules: value = 0
  const state  = buildMinimalState({ schedules: [] });
  const result = computeM04PrioritySpread(state, AT);
  assertMetricValid(result, 'M-04 empty');
  assert(result.value === 0, 'M-04 empty: value is 0');
}

{
  // Priority spread = 0 (all same priority)
  const s1 = makeSchedule({ id: 's1', priority: 10 });
  const s2 = makeSchedule({ id: 's2', priority: 10 });
  const state  = buildMinimalState({ schedules: [s1, s2] });
  const result = computeM04PrioritySpread(state, AT);
  assertMetricValid(result, 'M-04 uniform priority');
  assert(result.raw_value === 0, 'M-04: raw_value is 0 with uniform priorities');
  assert(result.value === 0, 'M-04: normalized value is 0 with uniform priorities');
}

{
  // Priority spread = 250 (above review threshold of 200)
  const s1 = makeSchedule({ id: 's1', priority: 0 });
  const s2 = makeSchedule({ id: 's2', priority: 250 });
  const state  = buildMinimalState({ schedules: [s1, s2] });
  const result = computeM04PrioritySpread(state, AT);
  assertMetricValid(result, 'M-04 large spread');
  assert(result.raw_value === 250, 'M-04: raw_value is 250');
  assert(result.value > 0.80, 'M-04: value > 0.80 above review threshold');

  // Determinism
  const result2 = computeM04PrioritySpread(state, AT);
  assert(result.value === result2.value, 'M-04: deterministic');
}

{
  // Just below advisory (priority spread = 99 < 100)
  const s1 = makeSchedule({ id: 's1', priority: 0 });
  const s2 = makeSchedule({ id: 's2', priority: 99 });
  const state  = buildMinimalState({ schedules: [s1, s2] });
  const result = computeM04PrioritySpread(state, AT);
  assert(result.value < 0.50, 'M-04: value < 0.50 just below advisory threshold');
}

// ─── M-05: Manual Intervention Frequency ─────────────────────────────────────

console.log('\n── M-05: Manual Intervention Frequency ──');

{
  // No overrides: value = 0
  const state  = buildMinimalState({ overrides: [] });
  const result = computeM05ManualInterventionFrequency(state, AT);
  assertMetricValid(result, 'M-05 empty');
  assert(result.value === 0, 'M-05 empty: value is 0');
}

{
  // Recent permanent override (< 30 days): should not count
  const override = makeOverride({ starts_at: AT - (29 * 24 * 60 * 60 * 1000), expires_at: null });
  const state    = buildMinimalState({ overrides: [override] });
  const result   = computeM05ManualInterventionFrequency(state, AT);
  assertMetricValid(result, 'M-05 recent override');
  assert(result.raw_value === 0, 'M-05: recent permanent override does not count');
}

{
  // Old permanent override (> 30 days): should count
  const override = makeOverride({ starts_at: AT - (31 * 24 * 60 * 60 * 1000), expires_at: null });
  const state    = buildMinimalState({ overrides: [override] });
  const result   = computeM05ManualInterventionFrequency(state, AT);
  assertMetricValid(result, 'M-05 old permanent override');
  assert(result.raw_value === 1, 'M-05: 1 old permanent override counted');
  assert(result.value > 0, 'M-05: normalized value > 0');

  // Determinism
  const result2 = computeM05ManualInterventionFrequency(state, AT);
  assert(result.value === result2.value, 'M-05: deterministic');
}

// ─── M-06: Emergency Semantic Drift ──────────────────────────────────────────

console.log('\n── M-06: Emergency Semantic Drift ──');

{
  // No emergency: value = 0
  const state  = buildMinimalState({ emergency: null });
  const result = computeM06EmergencySemanticDrift(state, AT);
  assertMetricValid(result, 'M-06 no emergency');
  assert(result.value === 0, 'M-06 no emergency: value is 0');
}

{
  // Global emergency with reason (legitimate use): drift score = 0
  const state = buildMinimalState({
    emergency: {
      id:           'em-1',
      venue_id:     'venue-001',
      content_id:   'content-a',
      is_global:    true,
      is_active:    true,
      activated_at: AT - (6 * 60 * 60 * 1000), // 6 hours ago (> 4 hours)
      reason:       'Venue evacuation - safety incident',
    }
  });
  const result = computeM06EmergencySemanticDrift(state, AT);
  assertMetricValid(result, 'M-06 legitimate emergency');
  assert(result.raw_value === 0, 'M-06 legitimate: no drift signals (global + reason + long-running)');
  assert(result.value === 0, 'M-06 legitimate: normalized value is 0');
}

{
  // Non-global, no reason, short duration: 3 signals × 2 points = 6 (above review=6)
  const state = buildMinimalState({
    emergency: {
      id:           'em-2',
      venue_id:     'venue-001',
      content_id:   'content-a',
      is_global:    false,      // signal: +2
      is_active:    true,
      activated_at: AT - (30 * 60 * 1000), // 30 mins ago (< 4 hours) → +2
      reason:       null,       // signal: +2
    }
  });
  const result = computeM06EmergencySemanticDrift(state, AT);
  assertMetricValid(result, 'M-06 full drift');
  assert(result.raw_value === 6, 'M-06 full drift: score is 6 (3 signals × 2 each)');
  assert(result.value >= 0.80, 'M-06 full drift: value >= 0.80 (at or above review threshold)');

  // Determinism
  const result2 = computeM06EmergencySemanticDrift(state, AT);
  assert(result.value === result2.value, 'M-06: deterministic');
}

// ─── M-07: Screen Configuration Divergence ───────────────────────────────────

console.log('\n── M-07: Screen Configuration Divergence ──');

{
  // No overrides: value = 0
  const state  = buildMinimalState({ overrides: [] });
  const result = computeM07ScreenConfigurationDivergence(state, AT);
  assertMetricValid(result, 'M-07 no overrides');
  assert(result.value === 0, 'M-07 no overrides: value is 0');
}

{
  // Recent override (< 90 days): not stale
  const override = makeOverride({ starts_at: AT - (50 * 24 * 60 * 60 * 1000) });
  const state    = buildMinimalState({ overrides: [override] });
  const result   = computeM07ScreenConfigurationDivergence(state, AT);
  assertMetricValid(result, 'M-07 recent override');
  assert(result.raw_value === 0, 'M-07: override < 90 days is not stale');
}

{
  // All overrides stale (> 90 days): raw_value = 100
  const override = makeOverride({ starts_at: AT - (100 * 24 * 60 * 60 * 1000) });
  const state    = buildMinimalState({ overrides: [override] });
  const result   = computeM07ScreenConfigurationDivergence(state, AT);
  assertMetricValid(result, 'M-07 stale override');
  assert(result.raw_value === 100, 'M-07: all stale overrides → raw_value = 100');
  assert(result.value > 0, 'M-07: normalized value > 0');

  // Determinism
  const result2 = computeM07ScreenConfigurationDivergence(state, AT);
  assert(result.value === result2.value, 'M-07: deterministic');
}

// ─── M-08: Sponsor Saturation ─────────────────────────────────────────────────

console.log('\n── M-08: Sponsor Saturation ──');

{
  // No sponsorships: value = 0
  const state  = buildMinimalState({ sponsorships: [] });
  const result = computeM08SponsorSaturation(state, AT);
  assertMetricValid(result, 'M-08 empty');
  assert(result.value === 0, 'M-08 empty: value is 0');
}

{
  // SOV at 100% of warning threshold (0.30): raw_value = 100 (at review boundary)
  const sponsorship: SponsorshipContractRecord = {
    id:         'sp-1',
    area_id:    'area-001',
    content_id: 'content-a',
    sov_pct:    0.30,
    starts_at:  AT - 1000,
    expires_at: null,
    is_active:  true,
  };
  const state  = buildMinimalState({ sponsorships: [sponsorship] });
  const result = computeM08SponsorSaturation(state, AT);
  assertMetricValid(result, 'M-08 at threshold');
  assert(result.raw_value === 100, 'M-08: SOV at 100% of threshold → raw_value = 100');
  assert(result.value >= 0.80, 'M-08: value >= 0.80 at review threshold');

  // Determinism
  const result2 = computeM08SponsorSaturation(state, AT);
  assert(result.value === result2.value, 'M-08: deterministic');
}

// ─── M-09: Device Staleness ───────────────────────────────────────────────────

console.log('\n── M-09: Device Staleness ──');

{
  // Screen never seen (last_seen_at = null): stale
  const state  = buildMinimalState({ screen: { ...buildMinimalState().screen, last_seen_at: null } });
  const result = computeM09DeviceStaleness(state, AT);
  assertMetricValid(result, 'M-09 never seen');
  assert(result.raw_value === 100, 'M-09 never seen: raw_value = 100');
  assert(result.value > 0, 'M-09 never seen: value > 0');
}

{
  // Screen seen 30 min ago (within 1-hour threshold): fresh
  const state  = buildMinimalState({ screen: { ...buildMinimalState().screen, last_seen_at: AT - (30 * 60 * 1000) } });
  const result = computeM09DeviceStaleness(state, AT);
  assertMetricValid(result, 'M-09 fresh');
  assert(result.raw_value === 0, 'M-09 fresh: raw_value = 0 (seen 30 min ago)');
  assert(result.value === 0, 'M-09 fresh: value = 0');
}

{
  // Screen seen 2 hours ago (> 1-hour threshold): stale
  const state  = buildMinimalState({ screen: { ...buildMinimalState().screen, last_seen_at: AT - (2 * 60 * 60 * 1000) } });
  const result = computeM09DeviceStaleness(state, AT);
  assertMetricValid(result, 'M-09 stale');
  assert(result.raw_value === 100, 'M-09 stale: raw_value = 100');

  // Determinism
  const result2 = computeM09DeviceStaleness(state, AT);
  assert(result.value === result2.value, 'M-09: deterministic');
}

// ─── M-10: Content Mix Instability ────────────────────────────────────────────

console.log('\n── M-10: Content Mix Instability ──');

{
  // No schedules: value = 0
  const state  = buildMinimalState({ schedules: [] });
  const result = computeM10ContentMixInstability(state, AT);
  assertMetricValid(result, 'M-10 no schedules');
  assert(result.value === 0, 'M-10: value = 0 with no schedules');
}

{
  // Single schedule: no instability
  const s1 = makeSchedule({ id: 's1', priority: 10 });
  const state  = buildMinimalState({ schedules: [s1] });
  const result = computeM10ContentMixInstability(state, AT);
  assertMetricValid(result, 'M-10 single schedule');
  assert(result.value === 0, 'M-10: single schedule produces no instability');
}

{
  // Uniform priority (all same): CV = 0
  const schedules: ScheduleRecord[] = [10, 10, 10].map((p, i) =>
    makeSchedule({ id: `s${i}`, priority: p })
  );
  const state  = buildMinimalState({ schedules });
  const result = computeM10ContentMixInstability(state, AT);
  assertMetricValid(result, 'M-10 uniform');
  assert(result.raw_value === 0, 'M-10: uniform priorities → CV = 0');
  assert(result.value === 0, 'M-10: uniform priorities → value = 0');

  // Determinism
  const result2 = computeM10ContentMixInstability(state, AT);
  assert(result.value === result2.value, 'M-10: deterministic');
}

// ─── M-11: Preview Resolution Divergence ──────────────────────────────────────

console.log('\n── M-11: Preview Resolution Divergence ──');

{
  // No delivery, no overrides: uncertain (raw_value = 50)
  const state  = buildMinimalState({ last_delivery: null, overrides: [] });
  const result = computeM11PreviewResolutionDivergence(state, AT);
  assertMetricValid(result, 'M-11 no delivery');
  assert(result.raw_value === 50, 'M-11 no delivery: raw_value = 50 (uncertain)');
}

{
  // Recent delivery at structural level, no overrides: no divergence
  const state = buildMinimalState({
    overrides: [],
    last_delivery: {
      id:               'dl-1',
      screen_id:        'screen-001',
      delivered_at:     AT - (5 * 60 * 1000), // 5 min ago
      checksum:         'abc123',
      resolution_level: 5, // structural
    }
  });
  const result = computeM11PreviewResolutionDivergence(state, AT);
  assertMetricValid(result, 'M-11 consistent structural');
  assert(result.raw_value === 0, 'M-11: consistent state → raw_value = 0');
  assert(result.value === 0, 'M-11: consistent state → value = 0');

  // Determinism
  const result2 = computeM11PreviewResolutionDivergence(state, AT);
  assert(result.value === result2.value, 'M-11: deterministic');
}

{
  // Recent delivery at override level, now has no overrides: diverged
  const state = buildMinimalState({
    overrides: [],
    last_delivery: {
      id:               'dl-2',
      screen_id:        'screen-001',
      delivered_at:     AT - (5 * 60 * 1000), // 5 min ago
      checksum:         'def456',
      resolution_level: 1, // override level
    }
  });
  const result = computeM11PreviewResolutionDivergence(state, AT);
  assertMetricValid(result, 'M-11 diverged');
  assert(result.raw_value === 100, 'M-11 diverged: raw_value = 100');
  assert(result.value > 0, 'M-11 diverged: value > 0');
}

// ─── M-12: Screen Staleness ───────────────────────────────────────────────────

console.log('\n── M-12: Screen Staleness ──');

{
  // No delivery: stale
  const state  = buildMinimalState({ last_delivery: null });
  const result = computeM12ScreenStaleness(state, AT);
  assertMetricValid(result, 'M-12 no delivery');
  assert(result.raw_value === 100, 'M-12 no delivery: raw_value = 100');
  assert(result.value > 0, 'M-12 no delivery: value > 0');
}

{
  // Recent delivery: fresh
  const state = buildMinimalState({
    last_delivery: {
      id:               'dl-3',
      screen_id:        'screen-001',
      delivered_at:     AT - (10 * 60 * 1000), // 10 min ago
      checksum:         'ghi789',
      resolution_level: 5,
    }
  });
  const result = computeM12ScreenStaleness(state, AT);
  assertMetricValid(result, 'M-12 fresh delivery');
  assert(result.raw_value === 0, 'M-12: fresh delivery → raw_value = 0');
  assert(result.value === 0, 'M-12: fresh delivery → value = 0');

  // Determinism
  const result2 = computeM12ScreenStaleness(state, AT);
  assert(result.value === result2.value, 'M-12: deterministic');
}

{
  // Old delivery (> 30 minutes): stale
  const state = buildMinimalState({
    last_delivery: {
      id:               'dl-4',
      screen_id:        'screen-001',
      delivered_at:     AT - (45 * 60 * 1000), // 45 min ago
      checksum:         'jkl012',
      resolution_level: 5,
    }
  });
  const result = computeM12ScreenStaleness(state, AT);
  assertMetricValid(result, 'M-12 stale delivery');
  assert(result.raw_value === 100, 'M-12: stale delivery → raw_value = 100');
}

// ─── Cross-calculator: threshold boundary checks ──────────────────────────────

console.log('\n── Threshold boundary checks ──');

{
  // M-04 just below advisory (priority spread = 99 → < 0.50)
  const s1 = makeSchedule({ id: 's1', priority: 0 });
  const s2 = makeSchedule({ id: 's2', priority: 99 });
  const state  = buildMinimalState({ schedules: [s1, s2] });
  const result = computeM04PrioritySpread(state, AT);
  assert(result.value < 0.50, 'M-04 boundary: just below advisory → value < 0.50');

  // M-04 just above advisory (priority spread = 101 → > 0.50)
  const s3 = makeSchedule({ id: 's3', priority: 0 });
  const s4 = makeSchedule({ id: 's4', priority: 101 });
  const state2  = buildMinimalState({ schedules: [s3, s4] });
  const result2 = computeM04PrioritySpread(state2, AT);
  assert(result2.value > 0.50, 'M-04 boundary: just above advisory → value > 0.50');

  // M-04 just above critical (priority spread = 201 → > 0.80)
  const s5 = makeSchedule({ id: 's5', priority: 0 });
  const s6 = makeSchedule({ id: 's6', priority: 201 });
  const state3  = buildMinimalState({ schedules: [s5, s6] });
  const result3 = computeM04PrioritySpread(state3, AT);
  assert(result3.value > 0.80, 'M-04 boundary: just above critical → value > 0.80');
}

summary('entropy-calculators.vec.ts');
