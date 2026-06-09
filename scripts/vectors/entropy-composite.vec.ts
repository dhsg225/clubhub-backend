#!/usr/bin/env ts-node
/**
 * Entropy composite score contract vectors.
 *
 * Tests:
 *   1. All-zero metrics → composite near 0
 *   2. All-max metrics → composite near 1
 *   3. Label assignment at boundaries (0.20, 0.40, 0.60, 0.80)
 *   4. Advisory tier escalation at each transition
 *   5. Determinism: same input → same output
 *
 * Usage: npx ts-node scripts/vectors/entropy-composite.vec.ts
 */

import type { MetricResult } from '../../src/entropy/types';
import { computeEntropyScore } from '../../src/entropy/entropy-score';
import { assignEntropyLabel } from '../../src/entropy/entropy-labeling';
import { computeAdvisoryTier } from '../../src/entropy/advisory-tier';
import { assert, assertEqual, summary } from './_fixture';

const AT = 1_748_000_000_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMetric(
  metric_id: string,
  value:     number
): MetricResult {
  return {
    metric_id,
    value,
    raw_value:            value * 100,
    unit:                 'test_unit',
    threshold_warn:       0.50,
    threshold_critical:   0.80,
    explanation:          `Test metric ${metric_id} with value ${value}`,
    contributing_factors: value > 0 ? [`value=${value}`] : [],
    computed_at:          AT,
  };
}

function makeAllMetrics(value: number): MetricResult[] {
  return [
    'M-01', 'M-02', 'M-03', 'M-04', 'M-05', 'M-06',
    'M-07', 'M-08', 'M-09', 'M-10', 'M-11', 'M-12',
  ].map(id => makeMetric(id, value));
}

// ─── All-zero metrics ─────────────────────────────────────────────────────────

console.log('\n── All-zero metrics → composite near 0 ──');

{
  const metrics = makeAllMetrics(0);
  const score   = computeEntropyScore(metrics, AT, 'screen-001', 'venue-001');

  assert(score.composite >= 0 && score.composite <= 1,
    `composite in [0,1]: ${score.composite}`);
  assert(score.composite === 0, `all-zero metrics → composite is exactly 0 (got ${score.composite})`);
  assertEqual(score.label, 'HEALTHY', 'all-zero → label is HEALTHY');
  assertEqual(score.advisory_tier, 0, 'all-zero → advisory_tier is 0');
  assert(score.screen_id === 'screen-001', 'screen_id is set');
  assert(score.venue_id === 'venue-001', 'venue_id is set');
}

// ─── All-max metrics ──────────────────────────────────────────────────────────

console.log('\n── All-max metrics → composite near 1 ──');

{
  const metrics = makeAllMetrics(1.0);
  const score   = computeEntropyScore(metrics, AT);

  assert(score.composite >= 0.9, `all-max metrics → composite >= 0.9 (got ${score.composite})`);
  assertEqual(score.label, 'CRITICAL', 'all-max → label is CRITICAL');
  assertEqual(score.advisory_tier, 4, 'all-max → advisory_tier is 4');
}

// ─── Determinism ──────────────────────────────────────────────────────────────

console.log('\n── Determinism ──');

{
  const metrics = makeAllMetrics(0.5);
  const score1  = computeEntropyScore(metrics, AT);
  const score2  = computeEntropyScore(metrics, AT);

  assert(score1.composite === score2.composite, `deterministic: composite same on re-run`);
  assertEqual(score1.label, score2.label, 'deterministic: label same on re-run');
  assertEqual(score1.advisory_tier, score2.advisory_tier, 'deterministic: advisory_tier same on re-run');
}

// ─── Label boundary tests ─────────────────────────────────────────────────────

console.log('\n── Label boundary tests ──');

{
  // HEALTHY: 0.00–0.20
  assertEqual(assignEntropyLabel(0.00), 'HEALTHY',  'label at 0.00 is HEALTHY');
  assertEqual(assignEntropyLabel(0.10), 'HEALTHY',  'label at 0.10 is HEALTHY');
  assertEqual(assignEntropyLabel(0.20), 'HEALTHY',  'label at 0.20 is HEALTHY');

  // NOMINAL: 0.20–0.40
  assertEqual(assignEntropyLabel(0.21), 'NOMINAL',  'label at 0.21 is NOMINAL');
  assertEqual(assignEntropyLabel(0.30), 'NOMINAL',  'label at 0.30 is NOMINAL');
  assertEqual(assignEntropyLabel(0.40), 'NOMINAL',  'label at 0.40 is NOMINAL');

  // DRIFTING: 0.40–0.60
  assertEqual(assignEntropyLabel(0.41), 'DRIFTING', 'label at 0.41 is DRIFTING');
  assertEqual(assignEntropyLabel(0.50), 'DRIFTING', 'label at 0.50 is DRIFTING');
  assertEqual(assignEntropyLabel(0.60), 'DRIFTING', 'label at 0.60 is DRIFTING');

  // DEGRADED: 0.60–0.80
  assertEqual(assignEntropyLabel(0.61), 'DEGRADED', 'label at 0.61 is DEGRADED');
  assertEqual(assignEntropyLabel(0.70), 'DEGRADED', 'label at 0.70 is DEGRADED');
  assertEqual(assignEntropyLabel(0.80), 'DEGRADED', 'label at 0.80 is DEGRADED');

  // CRITICAL: > 0.80
  assertEqual(assignEntropyLabel(0.81), 'CRITICAL', 'label at 0.81 is CRITICAL');
  assertEqual(assignEntropyLabel(1.00), 'CRITICAL', 'label at 1.00 is CRITICAL');
}

// ─── Advisory tier escalation tests ──────────────────────────────────────────

console.log('\n── Advisory tier escalation ──');

{
  // Tier 0: HEALTHY, no critical metrics
  const healthyMetrics = makeAllMetrics(0.1); // below threshold_warn (0.50)
  assertEqual(computeAdvisoryTier('HEALTHY', healthyMetrics), 0, 'Tier 0: HEALTHY + no critical');

  // Tier 1: NOMINAL, no critical metrics, but some above warn
  const nominalMetrics = makeAllMetrics(0.55); // above threshold_warn (0.50) but below critical (0.80)
  assertEqual(computeAdvisoryTier('NOMINAL', nominalMetrics), 1, 'Tier 1: NOMINAL + elevated metrics');

  // Tier 2: DRIFTING (no multiple critical metrics)
  const driftingMetrics = makeAllMetrics(0.55);
  assertEqual(computeAdvisoryTier('DRIFTING', driftingMetrics), 2, 'Tier 2: DRIFTING');

  // Tier 2: any label with 1 critical metric
  const oneCritical = [
    makeMetric('M-01', 0.9),  // above critical (0.80)
    ...['M-02','M-03','M-04','M-05','M-06','M-07','M-08','M-09','M-10','M-11','M-12']
       .map(id => makeMetric(id, 0.1)),
  ];
  assertEqual(computeAdvisoryTier('HEALTHY', oneCritical), 2, 'Tier 2: HEALTHY but 1 critical metric');

  // Tier 3: DEGRADED
  assertEqual(computeAdvisoryTier('DEGRADED', makeAllMetrics(0.1)), 3, 'Tier 3: DEGRADED label');

  // Tier 3: DRIFTING + 2 critical metrics
  const twoCritical = [
    makeMetric('M-01', 0.9),
    makeMetric('M-02', 0.9),
    ...['M-03','M-04','M-05','M-06','M-07','M-08','M-09','M-10','M-11','M-12']
       .map(id => makeMetric(id, 0.1)),
  ];
  assertEqual(computeAdvisoryTier('DRIFTING', twoCritical), 3, 'Tier 3: DRIFTING + 2 critical metrics');

  // Tier 4: CRITICAL label
  assertEqual(computeAdvisoryTier('CRITICAL', makeAllMetrics(0.1)), 4, 'Tier 4: CRITICAL label');

  // Tier 4: M-06 above critical threshold
  const m06Critical = [
    ...['M-01','M-02','M-03','M-04','M-05'].map(id => makeMetric(id, 0.1)),
    makeMetric('M-06', 0.9),  // M-06 above critical → force tier 4
    ...['M-07','M-08','M-09','M-10','M-11','M-12'].map(id => makeMetric(id, 0.1)),
  ];
  assertEqual(computeAdvisoryTier('HEALTHY', m06Critical), 4, 'Tier 4: M-06 emergency above critical');
}

// ─── Composite weighted correctly ─────────────────────────────────────────────

console.log('\n── Composite weight verification ──');

{
  // Only M-01 at max: composite = 0.25 × 1.0 = 0.25
  const metrics = [
    makeMetric('M-01', 1.0),
    ...['M-02','M-03','M-04','M-05','M-06','M-07','M-08','M-09','M-10','M-11','M-12']
       .map(id => makeMetric(id, 0)),
  ];
  const score = computeEntropyScore(metrics, AT);
  const expected = 0.25;
  assert(
    Math.abs(score.composite - expected) < 0.0001,
    `M-01 only at max → composite = ${expected} (got ${score.composite})`
  );
}

{
  // Only M-03 at max: composite = 0.20 × 1.0 = 0.20
  const metrics = [
    makeMetric('M-01', 0),
    makeMetric('M-02', 0),
    makeMetric('M-03', 1.0),
    ...['M-04','M-05','M-06','M-07','M-08','M-09','M-10','M-11','M-12']
       .map(id => makeMetric(id, 0)),
  ];
  const score = computeEntropyScore(metrics, AT);
  const expected = 0.20;
  assert(
    Math.abs(score.composite - expected) < 0.0001,
    `M-03 only at max → composite = ${expected} (got ${score.composite})`
  );
}

// ─── Composite is clamped to [0, 1] ───────────────────────────────────────────

console.log('\n── Composite clamping ──');

{
  // All values at 1.0 with adjusted metrics (composite should be <= 1.0)
  const metrics = makeAllMetrics(1.0);
  const score   = computeEntropyScore(metrics, AT);
  assert(score.composite <= 1.0, `composite does not exceed 1.0 (got ${score.composite})`);
  assert(score.composite >= 0.0, `composite is not below 0.0 (got ${score.composite})`);
}

summary('entropy-composite.vec.ts');
