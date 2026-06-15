'use strict';
/**
 * BoundedExecutor — enforcement of AI execution quotas and authority ceilings.
 *
 * H4: AI recursion bounded — max_depth ceiling enforced per call chain.
 * H6: AI execution quotas enforced — rate buckets per agent.
 *
 * Tracks:
 *   - call depth per active execution chain (recursion prevention)
 *   - calls per minute per agent (rate ceiling)
 *   - calls per hour per agent (rate ceiling)
 *   - total session invocations per agent (quota ceiling)
 *
 * Uses virtual clock ticks passed by caller (no wall-clock — H1 guarantee).
 *
 * Check results:
 *   OK                — within all bounds
 *   QUOTA_EXCEEDED    — session total exceeded
 *   RECURSION_CEILING — depth limit reached
 *   RATE_MINUTE       — per-minute rate exceeded
 *   RATE_HOUR         — per-hour rate exceeded
 */

const CHECK_RESULTS = Object.freeze({
  OK:                'OK',
  QUOTA_EXCEEDED:    'QUOTA_EXCEEDED',
  RECURSION_CEILING: 'RECURSION_CEILING',
  RATE_MINUTE:       'RATE_MINUTE',
  RATE_HOUR:         'RATE_HOUR',
});

const DEFAULT_LIMITS = Object.freeze({
  max_depth:          10,
  max_per_minute:     60,
  max_per_hour:       500,
  session_quota:      2000,
});

class BoundedExecutor {
  constructor(limits = {}) {
    this._limits = Object.freeze({ ...DEFAULT_LIMITS, ...limits });

    // Per-agent state maps
    this._depths         = new Map();  // agent_id → current depth
    this._session_counts = new Map();  // agent_id → total invocations
    this._minute_buckets = new Map();  // agent_id → [{ ts, count }]
    this._hour_buckets   = new Map();  // agent_id → [{ ts, count }]
  }

  /**
   * Check whether an agent may execute an action.
   * MUST be called before every AI execution attempt.
   *
   * @param {string} agent_id
   * @param {string} action_type
   * @param {number} lineage_ts   — virtual clock ms (deterministic)
   * @param {number} depth        — current call chain depth
   * @returns {{ result, detail }}
   */
  check(agent_id, action_type, lineage_ts, depth = 0) {
    // Recursion ceiling
    if (depth > this._limits.max_depth) {
      return { result: CHECK_RESULTS.RECURSION_CEILING,
               detail: `depth ${depth} > max_depth ${this._limits.max_depth}` };
    }

    // Session quota
    const session_count = this._session_counts.get(agent_id) ?? 0;
    if (session_count >= this._limits.session_quota) {
      return { result: CHECK_RESULTS.QUOTA_EXCEEDED,
               detail: `session_count ${session_count} >= quota ${this._limits.session_quota}` };
    }

    // Rate: per minute
    const per_minute = this._countInWindow(this._minute_buckets, agent_id, lineage_ts, 60_000);
    if (per_minute >= this._limits.max_per_minute) {
      return { result: CHECK_RESULTS.RATE_MINUTE,
               detail: `${per_minute} calls in last 60s >= max_per_minute ${this._limits.max_per_minute}` };
    }

    // Rate: per hour
    const per_hour = this._countInWindow(this._hour_buckets, agent_id, lineage_ts, 3_600_000);
    if (per_hour >= this._limits.max_per_hour) {
      return { result: CHECK_RESULTS.RATE_HOUR,
               detail: `${per_hour} calls in last 3600s >= max_per_hour ${this._limits.max_per_hour}` };
    }

    return { result: CHECK_RESULTS.OK, detail: null };
  }

  /**
   * Record a successful execution (after check() returns OK).
   * Updates all rate buckets and session count.
   */
  record(agent_id, lineage_ts) {
    // Session count
    this._session_counts.set(agent_id, (this._session_counts.get(agent_id) ?? 0) + 1);

    // Rate buckets — append new entry
    this._appendBucket(this._minute_buckets, agent_id, lineage_ts);
    this._appendBucket(this._hour_buckets,   agent_id, lineage_ts);
  }

  /** Push a depth frame (on call start). */
  pushDepth(agent_id) {
    this._depths.set(agent_id, (this._depths.get(agent_id) ?? 0) + 1);
    return this._depths.get(agent_id);
  }

  /** Pop a depth frame (on call completion/abort). */
  popDepth(agent_id) {
    const d = this._depths.get(agent_id) ?? 0;
    if (d > 0) this._depths.set(agent_id, d - 1);
    return this._depths.get(agent_id);
  }

  getDepth(agent_id)        { return this._depths.get(agent_id) ?? 0; }
  getSessionCount(agent_id) { return this._session_counts.get(agent_id) ?? 0; }

  getLimits() { return { ...this._limits }; }

  /**
   * Rate state snapshot for policy engine context injection.
   */
  getRateState(agent_id, lineage_ts) {
    return {
      calls_last_minute: this._countInWindow(this._minute_buckets, agent_id, lineage_ts, 60_000),
      calls_last_hour:   this._countInWindow(this._hour_buckets,   agent_id, lineage_ts, 3_600_000),
      session_total:     this._session_counts.get(agent_id) ?? 0,
    };
  }

  /** Reset a single agent's state (for testing / session boundary). */
  resetAgent(agent_id) {
    this._depths.delete(agent_id);
    this._session_counts.delete(agent_id);
    this._minute_buckets.delete(agent_id);
    this._hour_buckets.delete(agent_id);
  }

  /** Full reset. */
  reset() {
    this._depths.clear();
    this._session_counts.clear();
    this._minute_buckets.clear();
    this._hour_buckets.clear();
  }

  // ——— Private ——————————————————————————————————————————————————————

  _countInWindow(bucketMap, agent_id, now_ts, window_ms) {
    const buckets = bucketMap.get(agent_id) ?? [];
    const cutoff  = now_ts - window_ms;
    return buckets.filter(b => b.ts > cutoff).reduce((s, b) => s + b.count, 0);
  }

  _appendBucket(bucketMap, agent_id, ts) {
    if (!bucketMap.has(agent_id)) bucketMap.set(agent_id, []);
    bucketMap.get(agent_id).push({ ts, count: 1 });
  }
}

module.exports = { BoundedExecutor, CHECK_RESULTS, DEFAULT_LIMITS };
