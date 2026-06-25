'use strict';
/**
 * rate-limiter.js — per-tenant, per-operator rate limiting for control plane.
 * No wall-clock dependency for core logic — lineage_ts injected.
 */

const DEFAULT_LIMITS = Object.freeze({
  per_minute: 60,
  per_hour:   500,
  per_tenant_minute: 200,
});

class RateLimiter {
  constructor(limits = {}) {
    this._limits  = { ...DEFAULT_LIMITS, ...limits };
    this._buckets = new Map();  // key → [timestamps]
  }

  _key(tenantId, operatorId) { return `${tenantId}:${operatorId}`; }

  check(tenantId, operatorId, lineage_ts) {
    const key       = this._key(tenantId, operatorId);
    const tenantKey = `tenant:${tenantId}`;
    const now       = lineage_ts;

    const operatorCalls = this._getWindow(key, now, 60_000);
    if (operatorCalls >= this._limits.per_minute)
      return { ok: false, reason: 'RATE_LIMIT_OPERATOR_MINUTE' };

    const tenantCalls = this._getWindow(tenantKey, now, 60_000);
    if (tenantCalls >= this._limits.per_tenant_minute)
      return { ok: false, reason: 'RATE_LIMIT_TENANT_MINUTE' };

    return { ok: true };
  }

  record(tenantId, operatorId, lineage_ts) {
    const key       = this._key(tenantId, operatorId);
    const tenantKey = `tenant:${tenantId}`;
    if (!this._buckets.has(key))       this._buckets.set(key, []);
    if (!this._buckets.has(tenantKey)) this._buckets.set(tenantKey, []);
    this._buckets.get(key).push(lineage_ts);
    this._buckets.get(tenantKey).push(lineage_ts);
  }

  _getWindow(key, now, windowMs) {
    const bucket = this._buckets.get(key) ?? [];
    const cutoff = now - windowMs;
    return bucket.filter(ts => ts > cutoff).length;
  }

  snapshot() {
    const keys = {};
    for (const [k, v] of this._buckets) keys[k] = v.length;
    return { keys };
  }
}

module.exports = { RateLimiter, DEFAULT_LIMITS };
