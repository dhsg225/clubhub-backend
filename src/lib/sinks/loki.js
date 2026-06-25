'use strict';
/**
 * loki.js
 *
 * Loki-compatible event sink for ClubHub TV observability.
 * Implements pluggable sink interface: { write(envelope) }
 *
 * Batches events and pushes to Loki every FLUSH_INTERVAL_MS.
 * Aggregation failure never crashes the backend — errors are logged to stdout.
 *
 * Configuration (via environment variables):
 *   LOKI_URL         — Loki push endpoint (e.g. http://loki:3100)
 *   LOKI_FLUSH_MS    — flush interval in ms (default: 5000)
 *   LOKI_BATCH_SIZE  — max events per flush (default: 100)
 *
 * Usage:
 *   const { LokiSink } = require('./sinks/loki');
 *   const { registerSink } = require('../events');
 *   if (process.env.LOKI_URL) registerSink(new LokiSink());
 */

const http  = require('node:http');
const https = require('node:https');

const DEFAULT_FLUSH_MS   = 5_000;
const DEFAULT_BATCH_SIZE = 100;

class LokiSink {
  constructor(options = {}) {
    this.lokiUrl    = options.lokiUrl    ?? process.env.LOKI_URL;
    this.flushMs    = options.flushMs    ?? parseInt(process.env.LOKI_FLUSH_MS  ?? DEFAULT_FLUSH_MS, 10);
    this.batchSize  = options.batchSize  ?? parseInt(process.env.LOKI_BATCH_SIZE ?? DEFAULT_BATCH_SIZE, 10);
    this._queue     = [];
    this._lossCount = 0;
    this._timer     = null;

    if (this.lokiUrl) {
      this._timer = setInterval(() => this._flush(), this.flushMs).unref();
    }
  }

  /**
   * Pluggable sink interface.
   * Called by events.js for every emitted event.
   */
  write(envelope) {
    if (!this.lokiUrl) return;

    if (this._queue.length >= this.batchSize * 2) {
      // Drop oldest — record loss
      this._queue.shift();
      this._lossCount++;
    }
    this._queue.push(envelope);
  }

  async _flush() {
    if (!this._queue.length) return;

    const batch = this._queue.splice(0, this.batchSize);
    const now   = BigInt(Date.now()) * 1_000_000n;

    // Group by namespace for Loki label efficiency
    const byNs = {};
    for (const ev of batch) {
      const ns = ev.ns ?? 'PLATFORM';
      if (!byNs[ns]) byNs[ns] = [];
      byNs[ns].push([String(now), JSON.stringify(ev)]);
    }

    const payload = JSON.stringify({
      streams: Object.entries(byNs).map(([ns, values]) => ({
        stream: { app: 'clubhub', ns, env: batch[0]?.env ?? 'unknown' },
        values,
      })),
    });

    try {
      await this._post(payload);
    } catch (err) {
      // Aggregation failure must not crash backend — log to stdout only
      process.stdout.write(JSON.stringify({
        ts:    new Date().toISOString(),
        level: 'WARN',
        event: 'PLATFORM.sink_failed',
        sink:  'loki',
        error: err.message,
        dropped: batch.length,
        total_loss: this._lossCount,
      }) + '\n');
    }
  }

  _post(payload) {
    return new Promise((resolve, reject) => {
      const url      = new URL('/loki/api/v1/push', this.lokiUrl);
      const lib      = url.protocol === 'https:' ? https : http;
      const buf      = Buffer.from(payload);
      const opts     = {
        method:   'POST',
        hostname: url.hostname,
        port:     url.port || (url.protocol === 'https:' ? 443 : 80),
        path:     url.pathname,
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': buf.length,
        },
        timeout: 5_000,
      };
      const req = lib.request(opts, res => {
        res.resume();  // drain
        if (res.statusCode >= 400) reject(new Error(`Loki responded ${res.statusCode}`));
        else resolve();
      });
      req.on('error',   reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Loki push timeout')); });
      req.write(buf);
      req.end();
    });
  }

  /** Stats for health endpoint / diagnostics */
  stats() {
    return { queue_depth: this._queue.length, loss_count: this._lossCount };
  }

  destroy() {
    if (this._timer) clearInterval(this._timer);
    this._flush(); // best-effort final flush
  }
}

module.exports = { LokiSink };
