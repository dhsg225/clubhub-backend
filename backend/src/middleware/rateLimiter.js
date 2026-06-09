'use strict';

// In-memory sliding-window rate limiter — no external dependencies.
//
// How it works:
//   Per unique IP, we keep a list of request timestamps inside a sliding window
//   of `windowMs` milliseconds. When the count exceeds `maxRequests`, the request
//   is rejected with 429. Old timestamps outside the window are discarded on each
//   check, and a periodic sweep removes stale IP entries entirely.
//
// Usage:
//   const { rateLimit } = require('./middleware/rateLimiter');
//   router.use(rateLimit(60, 60_000));   // 60 req per 60 seconds
//
// Default presets (exported for convenience):
//   rateLimit.read  — 120 req/min  (manifest polling: 10 screens × 15s = 4 req/min each)
//   rateLimit.write — 60  req/min  (content/schedule mutations)
//   rateLimit.heavy — 10  req/min  (bootstrap / admin operations)

const windows = new Map(); // ip -> number[]

function rateLimit(maxRequests, windowMs) {
  return function rateLimitMiddleware(req, res, next) {
    const ip  = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();
    const cut = now - windowMs;

    let hits = (windows.get(ip) || []).filter(t => t > cut);

    if (hits.length >= maxRequests) {
      const retryAfterMs = windowMs - (now - hits[0]);
      res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000));
      return res.status(429).json({
        error: 'Too many requests',
        retry_after_ms: retryAfterMs,
      });
    }

    hits.push(now);
    windows.set(ip, hits);

    // Probabilistic cleanup: ~1-in-500 requests, sweep stale IP buckets
    if (Math.random() < 0.002) {
      for (const [key, val] of windows) {
        if (val.filter(t => t > cut).length === 0) windows.delete(key);
      }
    }

    next();
  };
}

rateLimit.read  = rateLimit(120, 60_000);
rateLimit.write = rateLimit(60,  60_000);
rateLimit.heavy = rateLimit(10,  60_000);

module.exports = { rateLimit };
