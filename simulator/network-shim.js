'use strict';

// ClubHub TV — Network Condition Shim
//
// A fetch wrapper that injects configurable real-world failure modes:
//   DNS failures, packet delay, random drops, captive portal responses,
//   backend timeouts, slow responses, and intermittent disconnects.
//
// Usage:
//   const { NetworkShim } = require('./network-shim');
//   const net = new NetworkShim();
//   net.setCondition('slow', { latencyMs: 2000 });
//   const res = await net.fetch('http://...');
//
// All condition methods return `this` for chaining.
// Call net.clear() to reset all conditions to nominal.

const FAULT_TYPES = [
  'nominal',        // no faults
  'slow',           // added latency
  'jitter',         // random variable latency
  'drop',           // random connection drops (ECONNRESET)
  'refused',        // connection refused (backend down)
  'timeout',        // hang until AbortSignal fires
  'dns_fail',       // getaddrinfo ENOTFOUND
  'captive_portal', // returns HTML redirect instead of JSON
  'packet_loss',    // some requests dropped entirely
  'slow_start',     // first N ms of connection is slow, then normal
];

class NetworkShim {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this._clear();
    this._fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
    this._defaultTimeoutMs = options.defaultTimeoutMs || 5_000;
  }

  _clear() {
    this.conditions = {
      latencyMs:        0,       // fixed delay before every request
      jitterMs:         0,       // ± random jitter on top of latencyMs
      dropRate:         0,       // 0.0–1.0 probability of ECONNRESET
      refusedRate:      0,       // 0.0–1.0 probability of ECONNREFUSED
      dnsFailRate:      0,       // 0.0–1.0 probability of ENOTFOUND
      timeoutRate:      0,       // 0.0–1.0 probability of request hanging
      captiveRate:      0,       // 0.0–1.0 probability of captive portal response
      offline:          false,   // if true: all requests fail with ECONNREFUSED
      slowBodyMs:       0,       // extra delay after headers before body (simulates slow transfer)
    };
  }

  // ── Condition presets ─────────────────────────────────────────────────────

  clear() {
    this._clear();
    return this;
  }

  setNominal() {
    return this.clear();
  }

  setSlow(latencyMs = 2_000) {
    this.conditions.latencyMs = latencyMs;
    return this;
  }

  setJitter(baseMs = 100, jitterMs = 500) {
    this.conditions.latencyMs = baseMs;
    this.conditions.jitterMs  = jitterMs;
    return this;
  }

  setFlaky(dropRate = 0.2) {
    this.conditions.dropRate = dropRate;
    return this;
  }

  setOffline() {
    this.conditions.offline = true;
    return this;
  }

  setOnline() {
    this.conditions.offline = false;
    return this;
  }

  setDnsFailure(rate = 1.0) {
    this.conditions.dnsFailRate = rate;
    return this;
  }

  setCaptivePortal(rate = 1.0) {
    this.conditions.captiveRate = rate;
    return this;
  }

  setPacketLoss(rate = 0.15) {
    this.conditions.dropRate = rate;
    return this;
  }

  setSlowBody(ms = 3_000) {
    this.conditions.slowBodyMs = ms;
    return this;
  }

  setCondition(type, params = {}) {
    switch (type) {
      case 'nominal':       return this.clear();
      case 'slow':          return this.setSlow(params.latencyMs || 2_000);
      case 'jitter':        return this.setJitter(params.baseMs, params.jitterMs);
      case 'drop':          return this.setFlaky(params.rate || 0.2);
      case 'refused':       this.conditions.refusedRate = params.rate || 1.0; return this;
      case 'timeout':       this.conditions.timeoutRate  = params.rate || 1.0; return this;
      case 'dns_fail':      return this.setDnsFailure(params.rate || 1.0);
      case 'captive_portal':return this.setCaptivePortal(params.rate || 1.0);
      case 'packet_loss':   return this.setPacketLoss(params.rate || 0.15);
      case 'slow_start':    return this.setJitter(params.slowMs || 5_000, 0);
      case 'offline':       return this.setOffline();
      default:
        throw new Error(`Unknown fault type: ${type}. Valid: ${FAULT_TYPES.join(', ')}`);
    }
  }

  // ── Fetch implementation ──────────────────────────────────────────────────

  async fetch(url, options = {}) {
    const c = this.conditions;

    // Hard offline
    if (c.offline) throw Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });

    // DNS failure
    if (c.dnsFailRate > 0 && Math.random() < c.dnsFailRate) {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
    }

    // Connection refused
    if (c.refusedRate > 0 && Math.random() < c.refusedRate) {
      throw Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
    }

    // Timeout (just hang — the AbortSignal in the caller will fire)
    if (c.timeoutRate > 0 && Math.random() < c.timeoutRate) {
      await new Promise(r => setTimeout(r, this._defaultTimeoutMs + 1_000));
      throw Object.assign(new Error('AbortError'), { name: 'AbortError' });
    }

    // Connection drop (before request completes)
    if (c.dropRate > 0 && Math.random() < c.dropRate) {
      throw Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' });
    }

    // Latency + jitter
    const latency = c.latencyMs + (c.jitterMs > 0 ? Math.random() * c.jitterMs * 2 - c.jitterMs : 0);
    if (latency > 0) await _sleep(Math.max(0, latency));

    // Captive portal
    if (c.captiveRate > 0 && Math.random() < c.captiveRate) {
      return new Response(
        '<html><body>Sign in to continue</body></html>',
        { status: 200, headers: { 'content-type': 'text/html' } }
      );
    }

    // Real request
    const timeoutMs = options._timeoutMs || this._defaultTimeoutMs;
    const signal = options.signal || AbortSignal.timeout(timeoutMs);
    const res = await this._fetchImpl(url, { ...options, signal, _timeoutMs: undefined });

    // Slow body (delay after headers)
    if (c.slowBodyMs > 0) {
      await _sleep(c.slowBodyMs);
    }

    return res;
  }

  // ── Current state summary (for status API) ────────────────────────────────
  summary() {
    const c = this.conditions;
    if (c.offline) return 'offline';
    if (c.dnsFailRate >= 1) return 'dns_fail';
    if (c.latencyMs >= 2000) return 'slow';
    if (c.dropRate >= 0.5) return 'high_packet_loss';
    if (c.captiveRate >= 1) return 'captive_portal';
    const any = c.latencyMs || c.jitterMs || c.dropRate || c.captiveRate || c.refusedRate || c.timeoutRate;
    return any ? 'degraded' : 'nominal';
  }
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { NetworkShim, FAULT_TYPES };
