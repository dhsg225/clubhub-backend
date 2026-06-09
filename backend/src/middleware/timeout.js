'use strict';

// Per-request timeout middleware.
// If a handler does not send a response within `ms` milliseconds, a 503 is
// returned automatically. The timer is cleared as soon as the response finishes
// or the connection closes.
//
// Default: 10 000 ms (10 s). Manifest compute runs in ~5-30 ms under normal
// conditions; this fires only on pathological DB stalls.
//
// Usage:
//   app.use(timeout());           // 10s default
//   app.use(timeout(30_000));     // 30s for slower routes

module.exports = function timeout(ms = 10_000) {
  return function timeoutMiddleware(req, res, next) {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({ error: 'Request timed out', timeout_ms: ms });
      }
    }, ms);

    const clear = () => clearTimeout(timer);
    res.on('finish', clear);
    res.on('close',  clear);

    next();
  };
};
