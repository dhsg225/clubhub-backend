// Named constants used in MetricsCollector heuristics.
// These are internal implementation anchors, NOT CI gate thresholds.
// CI gate thresholds live exclusively in test-config/thresholds.json and are
// enforced in runner.js performThresholdGating(). Any numeric value that also
// appears in thresholds.json is coincidental — do not conflate the two uses.
const _LIVENESS_TIMEOUT_MS   = 30000; // screen considered offline if no success within this window
const _SCORE_LATENCY_GOOD_MS = 500;   // p95 at or below this earns full latency score
const _SCORE_LATENCY_BAD_MS  = 5000;  // p95 at or above this earns zero latency score

import { Clock }                     from './clock.js';
import { newCorrelationId, enrichEvent } from './events.js';

// Governed metric keys — must match METRIC_EVIDENCE_REQUIREMENTS in validate-contracts.js
// and GOVERNED_METRICS exports in suite files.
export const GOVERNED_METRIC_KEYS = Object.freeze([
  'poll_success_rate',
  'p95_latency_ms',
  'max_poll_drift_ms',
  'desync_count',
  'max_desync_duration_ms',
  'named_recovery.backend_restart',
  'named_recovery.db_restart',
  'named_recovery.network_outage',
]);

export class MetricsCollector {
  /**
   * @param {Clock} clock  Governed clock instance. Defaults to realtime Clock.
   */
  constructor(clock) {
    this._clock = clock instanceof Clock ? clock : new Clock();
    this.reset();
  }

  reset() {
    this.screens = new Map(); // screenId -> data
    this.marks = new Map();   // name -> timestamp
    this.events = [];
    this.chaosTimeline = [];
    this._namedRecoveries = new Map(); // name -> duration_ms (set by recordNamedRecovery)
    this._desyncStart = null;          // ts when desync first detected
    this._maxDesyncDurationMs = 0;     // max observed desync window

    // Evidence registry: governed metric key -> {first_seen_ts, last_seen_ts, sample_count, source_suite}
    this._evidenceRegistry = new Map();

    // Suite name, set by setSuite() before each suite runs.
    this._currentSuite = null;

    // Causal context: correlation_id of the active chaos mark (set by mark(), cleared by next mark).
    // All events ingested after a mark reference this as caused_by.
    this._activeChaosId = null;

    // Per-mark correlation IDs for causal chain reconstruction.
    this._markIds = new Map(); // mark name -> correlation_id
  }

  /**
   * Set the active suite name so evidence is tagged with its source.
   * Called by runner.js before each suite executes.
   */
  setSuite(name) {
    this._currentSuite = name;
  }

  /**
   * Record a data observation for a governed metric key.
   */
  _recordEvidence(key) {
    const ts = this._clock.now();
    const existing = this._evidenceRegistry.get(key);
    if (!existing) {
      this._evidenceRegistry.set(key, {
        first_seen_ts: ts,
        last_seen_ts:  ts,
        sample_count:  1,
        source_suite:  this._currentSuite,
      });
    } else {
      existing.last_seen_ts = ts;
      existing.sample_count++;
    }
  }

  mark(name) {
    const ts  = this._clock.now();
    const cid = newCorrelationId();
    this.marks.set(name, ts);
    this._markIds.set(name, cid);
    this._activeChaosId = `mark:${name}:${cid}`;
    this.chaosTimeline.push({
      ts:             new Date(ts).toISOString(),
      type:           'mark',
      name,
      correlation_id: cid,
    });
    return ts;
  }

  ingest(event) {
    if (!event || typeof event !== 'object') return;
    const ts    = this._clock.now();
    const isoTs = new Date(ts).toISOString();

    const enriched = enrichEvent(event, {
      caused_by: this._activeChaosId,
      suite:     this._currentSuite,
    });
    this.events.push({ ...enriched, internal_ts: ts, iso_ts: isoTs });

    const type     = enriched.event;
    const screenId = enriched.screen;

    if (type === 'poll.success' || type === 'poll.failure') {
      const { duration_ms, checksum, version } = enriched;
      const latency = duration_ms;
      let s = this.screens.get(screenId);
      if (!s) {
        s = {
          screenId,
          successes: 0,
          failures: 0,
          latencies: [],
          offlineStreak: 0,
          maxOfflineStreak: 0,
          lastChecksum: null,
          lastSuccessTs: 0,
          versions: new Set(),
          checksums: new Set(),
        };
        this.screens.set(screenId, s);
      }

      // Every poll event feeds poll_success_rate evidence.
      this._recordEvidence('poll_success_rate');

      if (type === 'poll.success') {
        s.successes++;
        s.offlineStreak = 0;
        s.lastChecksum  = checksum;
        s.lastSuccessTs = ts;
        if (latency) {
          s.latencies.push(latency);
          this._recordEvidence('p95_latency_ms');
        }
        if (version)  s.versions.add(version);
        if (checksum) s.checksums.add(checksum);

        // Every success timestamp is a datapoint for poll drift.
        this._recordEvidence('max_poll_drift_ms');

        // Desync duration tracking.
        const desynced = this._isDesynced();
        if (desynced && this._desyncStart === null) {
          this._desyncStart = ts;
          this._recordEvidence('desync_count');
          this._recordEvidence('max_desync_duration_ms');
        } else if (!desynced && this._desyncStart !== null) {
          this._maxDesyncDurationMs = Math.max(
            this._maxDesyncDurationMs,
            ts - this._desyncStart
          );
          this._desyncStart = null;
          this._recordEvidence('max_desync_duration_ms');
        }
      } else {
        s.failures++;
        s.offlineStreak++;
        s.maxOfflineStreak = Math.max(s.maxOfflineStreak, s.offlineStreak);
      }
    }
  }

  /**
   * Record the measured recovery time for a named chaos event.
   * Must be called immediately after allRecoveredAfterMark() resolves,
   * before subsequent events advance lastSuccessTs.
   * e.g. metrics.recordNamedRecovery('backend_restart', recoveryTime)
   */
  recordNamedRecovery(name, durationMs) {
    this._namedRecoveries.set(name, durationMs);
    this._recordEvidence(`named_recovery.${name}`);
  }

  /**
   * Check for telemetry consistency violations.
   * Returns array of { metric, issue }. Empty = clean.
   * Violations cause runner.js to fail — no silent NaN/undefined/zero masking.
   */
  checkConsistency() {
    const violations = [];

    // 1. poll_success_rate requires actual poll events.
    let totalPolls = 0;
    for (const s of this.screens.values()) {
      totalPolls += s.successes + s.failures;
    }
    if (totalPolls === 0 && this.screens.size > 0) {
      violations.push({
        metric: 'poll_success_rate',
        issue:  'poll_success_rate is unverifiable: screens registered but no poll events observed',
      });
    }

    // 2. p95_latency_ms requires ≥2 latency samples.
    let totalLatencies = 0;
    for (const s of this.screens.values()) {
      totalLatencies += s.latencies.length;
    }
    if (this._evidenceRegistry.has('p95_latency_ms') && totalLatencies < 2) {
      violations.push({
        metric: 'p95_latency_ms',
        issue:  `p95_latency_ms computed from ${totalLatencies} sample(s) — statistical minimum is 2`,
      });
    }

    // 3. desync_count > 0 requires divergence evidence in registry.
    const desyncCount = this.getDesyncCount();
    if (desyncCount > 0 && !this._evidenceRegistry.has('desync_count')) {
      violations.push({
        metric: 'desync_count',
        issue:  `desync_count=${desyncCount} but no checksum-divergence event was recorded — evidence inconsistency`,
      });
    }

    // 4. Named recovery metrics require corresponding chaos marks.
    for (const [name] of this._namedRecoveries) {
      if (!this.marks.has(name)) {
        violations.push({
          metric: `named_recovery.${name}`,
          issue:  `Recovery '${name}' recorded but no chaos mark '${name}' exists — recovery has no origin event`,
        });
      }
    }

    return violations;
  }

  _isDesynced() {
    const checksums = new Set();
    for (const s of this.screens.values()) {
      if (s.lastChecksum) checksums.add(s.lastChecksum);
    }
    return checksums.size > 1;
  }

  allLive(count) {
    if (this.screens.size < count) return false;
    for (const s of this.screens.values()) {
      if (this._clock.now() - s.lastSuccessTs > _LIVENESS_TIMEOUT_MS) return false;
    }
    return true;
  }

  allRecoveredAfterMark(markName) {
    const markTs = this.marks.get(markName);
    if (!markTs) return false;
    if (this.screens.size === 0) return false;
    for (const s of this.screens.values()) {
      if (s.lastSuccessTs < markTs) return false;
    }
    return true;
  }

  recoveryTimeAfterMark(markName) {
    const markTs = this.marks.get(markName);
    if (!markTs) return 0;
    let lastRecovery = markTs;
    for (const s of this.screens.values()) {
      lastRecovery = Math.max(lastRecovery, s.lastSuccessTs);
    }
    return lastRecovery - markTs;
  }

  pollSuccessRate() {
    let total = 0;
    let successes = 0;
    for (const s of this.screens.values()) {
      total     += (s.successes + s.failures);
      successes += s.successes;
    }
    return total === 0 ? 100 : (successes / total) * 100;
  }

  maxOfflineStreak() {
    let max = 0;
    for (const s of this.screens.values()) {
      max = Math.max(max, s.maxOfflineStreak);
    }
    return max;
  }

  p95PollLatency() {
    const all = [];
    for (const s of this.screens.values()) {
      all.push(...s.latencies);
    }
    if (all.length === 0) return 0;
    all.sort((a, b) => a - b);
    const idx = Math.floor(all.length * 0.95);
    return all[idx];
  }

  /**
   * Maximum deviation from the 15s nominal poll interval across all screens.
   * Computed from event history — call at end of suite when history is complete.
   */
  pollDriftMs() {
    const TARGET_MS = 15000;
    let maxDrift = 0;
    for (const [screenId] of this.screens) {
      const successTs = this.events
        .filter(e => e.screen === screenId && e.event === 'poll.success')
        .map(e => e.internal_ts)
        .sort((a, b) => a - b);
      for (let i = 1; i < successTs.length; i++) {
        const drift = Math.abs(successTs[i] - successTs[i - 1] - TARGET_MS);
        if (drift > maxDrift) maxDrift = drift;
      }
    }
    return maxDrift;
  }

  getRecoveryScore() {
    const successRate = this.pollSuccessRate();
    const p95 = this.p95PollLatency();

    const successScore = (successRate / 100) * 70;

    let latencyScore = 0;
    if (p95 <= _SCORE_LATENCY_GOOD_MS) {
      latencyScore = 30;
    } else if (p95 < _SCORE_LATENCY_BAD_MS) {
      latencyScore = 30 * (1 - (p95 - _SCORE_LATENCY_GOOD_MS) / (_SCORE_LATENCY_BAD_MS - _SCORE_LATENCY_GOOD_MS));
    }
    return Math.round(successScore + latencyScore);
  }

  getDesyncCount() {
    const checksums = new Set();
    for (const s of this.screens.values()) {
      if (s.lastChecksum) checksums.add(s.lastChecksum);
    }
    return checksums.size > 1 ? checksums.size : 0;
  }

  getSummary() {
    // Finalize any open desync window still active at suite end.
    const finalDesyncDuration = this._desyncStart !== null
      ? Math.max(this._maxDesyncDurationMs, this._clock.now() - this._desyncStart)
      : this._maxDesyncDurationMs;

    return {
      total_screens:          this.screens.size,
      poll_success_rate:      this.pollSuccessRate(),
      p95_latency_ms:         this.p95PollLatency(),
      max_offline_streak:     this.maxOfflineStreak(),
      desync_count:           this.getDesyncCount(),
      max_desync_duration_ms: finalDesyncDuration,
      max_poll_drift_ms:      this.pollDriftMs(),
      named_recoveries:       Object.fromEntries(this._namedRecoveries),
      recovery_score:         this.getRecoveryScore(),
      screens: Array.from(this.screens.values()).map(s => ({
        id:             s.screenId,
        success_count:  s.successes,
        failure_count:  s.failures,
        last_checksum:  s.lastChecksum,
        versions_seen:  s.versions.size,
        checksums_seen: s.checksums.size,
      })),
      // Evidence registry populated during execution; consumed by traceability report.
      _evidence: Object.fromEntries(this._evidenceRegistry),
    };
  }
}
