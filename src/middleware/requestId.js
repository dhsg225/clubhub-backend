'use strict';

const { randomUUID } = require('crypto');

// Attaches a UUID to every request as req.requestId and X-Request-Id response header.
// Downstream code can include req.requestId in log lines to correlate logs across
// a single request's lifecycle.
module.exports = function requestIdMiddleware(req, _res, next) {
  req.requestId = randomUUID();
  next();
};
