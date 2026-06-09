import { assert } from '../lib/assert.js';

// Governed metrics this suite exercises. Must match METRIC_EVIDENCE_REQUIREMENTS
// governedKey values in validate-contracts.js.
export const GOVERNED_METRICS = [
  'poll_success_rate',
  'p95_latency_ms',
];

export async function run(reporter, { fleet, chaos, metrics }) {
  reporter.begin('Basic Functionality');

  // Test: health_check
  const t1 = reporter.test('health_check');
  try {
    const res = await fetch(`${chaos.backendUrl}/health`);
    const data = await res.json();
    assert.that(data.status === 'ok', 'status=ok');
    assert.that(data.db === 'connected', 'db=connected');
    t1.pass();
  } catch (err) {
    t1.fail(err);
  }

  // Test: cold_start
  const t2 = reporter.test('cold_start');
  try {
    await fleet.waitForAllPolled(60000);
    assert.that(metrics.allLive(fleet.count), 'all screens live');
    
    // Check stagger: polls should be spread out
    const ts = metrics.events
      .filter(e => e.event === 'poll.success')
      .map(e => e.ts);
    const min = Math.min(...ts);
    const max = Math.max(...ts);
    const spread = max - min;
    assert.metric('poll_spread', spread).toBeGreaterThan(3000, 'polls should be staggered over >3s');
    
    t2.pass({ spread });
  } catch (err) {
    t2.fail(err);
  }

  // Test: manifest_delivery
  const t3 = reporter.test('manifest_delivery');
  try {
    const screenId = `${fleet.prefix}-01`;
    const oldChecksum = metrics.screens.get(screenId)?.lastChecksum;
    
    // Create content + schedule
    const contentRes = await fetch(`${chaos.backendUrl}/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_type: 'promo_slide',
        data: { headline: 'Test Manifest', subheadline: 'Delivery' }
      })
    });
    const content = await contentRes.json();
    
    await fetch(`${chaos.backendUrl}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id: content.id,
        screen_id: screenId,
        priority: 200,
        duration: 10
      })
    });

    // Wait for change
    await assert.eventually(() => {
      const s = metrics.screens.get(screenId);
      return s && s.lastChecksum !== oldChecksum;
    }, { timeout: 35000, label: 'screen detects change' });
    
    t3.pass();
  } catch (err) {
    t3.fail(err);
  }

  // Test: fallback_promotion
  const t4 = reporter.test('fallback_promotion');
  try {
    await chaos.clearAllContent();
    
    await assert.eventually(() => {
      for (const s of metrics.screens.values()) {
        const lastEvent = metrics.events.filter(e => e.screen === s.screenId && e.event === 'poll.success').pop();
        if (!lastEvent || lastEvent.items.length > 0) return false;
      }
      return true;
    }, { timeout: 30000, label: 'all screens show empty/fallback' });
    
    t4.pass();
  } catch (err) {
    t4.fail(err);
  }

  // Test: cache_persistence
  const t5 = reporter.test('cache_persistence');
  try {
    metrics.mark('fleet_reboot');
    await fleet.rebootAll();
    
    await assert.eventually(() => {
      return metrics.allRecoveredAfterMark('fleet_reboot');
    }, { timeout: 45000, label: 'fleet reloads cache and recovers' });
    
    t5.pass({ recoveryTime: metrics.recoveryTimeAfterMark('fleet_reboot') });
  } catch (err) {
    t5.fail(err);
  }
}
