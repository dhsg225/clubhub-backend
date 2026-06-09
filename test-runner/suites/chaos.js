import { assert } from '../lib/assert.js';

// Governed metrics this suite exercises. Must match METRIC_EVIDENCE_REQUIREMENTS
// governedKey values in validate-contracts.js.
export const GOVERNED_METRICS = [
  'poll_success_rate',
  'p95_latency_ms',
  'desync_count',
  'max_desync_duration_ms',
  'named_recovery.backend_restart',
  'named_recovery.db_restart',
  'named_recovery.network_outage',
];

export async function run(reporter, { fleet, chaos, metrics, thresholds }) {
  if (!chaos.dockerEnabled) {
    reporter.begin('Chaos Testing (SKIPPED)');
    reporter.test('all_chaos').skip('Docker Compose not available');
    return;
  }

  reporter.begin('Chaos Testing');

  // Test: backend_restart_recovery
  const t1 = reporter.test('backend_restart_recovery');
  try {
    metrics.mark('backend_restart');
    await chaos.restartBackend();
    await chaos.waitForHealth();
    
    // Capture recovery time inside the condition to prevent timing leakage:
    // once allRecoveredAfterMark() returns true, subsequent poll events can
    // advance lastSuccessTs before the caller resumes. Snapshotting here
    // guarantees the value reflects the actual recovery moment.
    let recoveryTime = 0;
    await assert.eventually(() => {
      if (!metrics.allRecoveredAfterMark('backend_restart')) return false;
      recoveryTime = metrics.recoveryTimeAfterMark('backend_restart');
      return true;
    }, { timeout: 60000, label: 'recovery after backend restart' });
    metrics.recordNamedRecovery('backend_restart', recoveryTime);
    assert.metric('recovery_time', recoveryTime).toBeLessThan(thresholds.recovery.backend_restart_ms, `recovery < ${thresholds.recovery.backend_restart_ms}ms`);
    assert.metric('max_offline_streak', metrics.maxOfflineStreak()).toBeLessThan(4, 'streak <= 3 cycles');

    t1.pass({ recoveryTime });
  } catch (err) {
    t1.fail(err);
  }

  // Test: db_restart_recovery
  const t2 = reporter.test('db_restart_recovery');
  try {
    metrics.mark('db_restart');
    await chaos.restartDb();
    await chaos.waitForHealth();
    
    let dbRecoveryTime = 0;
    await assert.eventually(() => {
      if (!metrics.allRecoveredAfterMark('db_restart')) return false;
      dbRecoveryTime = metrics.recoveryTimeAfterMark('db_restart');
      return true;
    }, { timeout: 90000, label: 'recovery after DB restart' });
    metrics.recordNamedRecovery('db_restart', dbRecoveryTime);
    t2.pass({ recoveryTime: dbRecoveryTime });
  } catch (err) {
    t2.fail(err);
  }

  // Test: network_outage_30s
  const t3 = reporter.test('network_outage_30s');
  try {
    metrics.mark('network_outage');
    await chaos.outage(30000);
    await chaos.waitForHealth();
    
    let networkRecoveryTime = 0;
    await assert.eventually(() => {
      if (!metrics.allRecoveredAfterMark('network_outage')) return false;
      networkRecoveryTime = metrics.recoveryTimeAfterMark('network_outage');
      return true;
    }, { timeout: 20000, label: 'recovery after outage' });
    metrics.recordNamedRecovery('network_outage', networkRecoveryTime);
    t3.pass();
  } catch (err) {
    t3.fail(err);
  }

  // Test: content_churn_version_tracking
  const t4 = reporter.test('content_churn_version_tracking');
  try {
    const screenId = `${fleet.prefix}-02`;
    const initialChecksums = new Set(metrics.screens.get(screenId)?.checksums || []);

    // Run churn and checksum detection concurrently.
    // Use 6s content windows (5 iters × ~6.5s = ~32s) so the 15s poll cycle reliably overlaps.
    await Promise.all([
      chaos.contentChurn(5, screenId, 6000),
      assert.eventually(() => {
        const s = metrics.screens.get(screenId);
        // checksums is accumulative — stays true once a new checksum is ever seen
        return s && s.checksums.size > initialChecksums.size;
      }, { timeout: 90000, label: 'churn checksum tracking' }),
    ]);
    
    const finalChecksums = metrics.screens.get(screenId)?.checksums || new Set();
    assert.metric('checksums_seen', finalChecksums.size - initialChecksums.size).toBeGreaterThan(0, 'should see at least one checksum update');
    
    t4.pass();
  } catch (err) {
    t4.fail(err);
  }

  // Test: flood_recovery
  const t5 = reporter.test('flood_recovery');
  try {
    metrics.mark('flood');
    await fleet.rebootAll();
    
    await assert.eventually(() => {
      return metrics.allRecoveredAfterMark('flood');
    }, { timeout: 45000, label: 'flood recovery' });
    
    // Check spread again
    const ts = metrics.events
      .filter(e => e.internal_ts > metrics.marks.get('flood') && e.event === 'poll.success')
      .map(e => e.internal_ts);
    const spread = Math.max(...ts) - Math.min(...ts);
    assert.metric('flood_spread', spread).toBeGreaterThan(3000, 'poll spread > 3s variance');
    
    t5.pass({ spread });
  } catch (err) {
    t5.fail(err);
  }
}
