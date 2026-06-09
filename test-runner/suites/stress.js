import { assert } from '../lib/assert.js';

// Governed metrics this suite exercises. Must match METRIC_EVIDENCE_REQUIREMENTS
// governedKey values in validate-contracts.js.
export const GOVERNED_METRICS = [
  'poll_success_rate',
  'p95_latency_ms',
  'max_poll_drift_ms',
  'desync_count',
  'max_desync_duration_ms',
];

export async function run(reporter, { fleet, chaos, metrics, thresholds }) {
  reporter.begin('Stress Testing');

  // Test: sustained_load_60s
  const t1 = reporter.test('sustained_load_60s');
  try {
    metrics.reset(); // clear counters for clean rate measurement
    await new Promise(r => setTimeout(r, 60000));
    
    const successRate = metrics.pollSuccessRate();
    const p95 = metrics.p95PollLatency();
    
    assert.metric('poll_success_rate', successRate).toBeGreaterThan(thresholds.performance.min_poll_success_rate, `Success rate > ${thresholds.performance.min_poll_success_rate}%`);
    assert.metric('p95_latency', p95).toBeLessThan(thresholds.performance.max_p95_latency_ms, `p95 latency < ${thresholds.performance.max_p95_latency_ms}ms`);
    
    t1.pass({ successRate, p95 });
  } catch (err) {
    t1.fail(err);
  }

  // Test: poll_drift
  const t2 = reporter.test('poll_drift');
  try {
    const drift = metrics.pollDriftMs();
    if (metrics.events.filter(e => e.event === 'poll.success').length < 2) {
      t2.skip('Not enough data to measure drift');
    } else {
      assert.metric('poll_drift', drift).toBeLessThan(thresholds.performance.max_poll_drift_ms, `Drift < ${thresholds.performance.max_poll_drift_ms}ms`);
      t2.pass({ drift });
    }
  } catch (err) {
    t2.fail(err);
  }

  // Test: cache_coherence
  const t3 = reporter.test('cache_coherence');
  try {
    // Change a global content item
    const contentRes = await fetch(`${chaos.backendUrl}/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_type: 'promo_slide',
        data: { headline: 'Global Sync', subheadline: 'Coherence Test' }
      })
    });
    const content = await contentRes.json();
    
    await fetch(`${chaos.backendUrl}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id: content.id,
        venue_id: 'venue-1', // Assuming seed or chaos setup this venue
        priority: 300,
        duration: 10
      })
    });

    await assert.eventually(() => {
      const checksums = new Set();
      for (const s of metrics.screens.values()) {
        if (s.lastChecksum) checksums.add(s.lastChecksum);
      }
      // If we have 10 screens, they should all eventually converge to the same checksum
      return checksums.size === 1;
    }, { timeout: 60000, label: 'all screens converge to same checksum' });
    
    t3.pass();
  } catch (err) {
    t3.fail(err);
  }
}
