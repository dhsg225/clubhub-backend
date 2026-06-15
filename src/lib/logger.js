'use strict';

// Structured JSON logger — single source of truth for all backend log output.
// All fields are written to stdout as a single JSON line so Docker/systemd can
// ingest them with any JSON-aware log aggregator (Loki, Datadog, CloudWatch, etc.)
//
// Usage:
//   const log = require('./logger');
//   log.info('manifest.computed', { screen_id, duration_ms, cache_hit });
//   log.warn('screen.auto_registered', { screen_id });
//   log.error('db.query_failed', { error: err.message, req_id });
//
// Log level is controlled by LOG_LEVEL env var (DEBUG|INFO|WARN|ERROR, default INFO).

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.INFO;

function write(level, event, fields) {
  if (LEVELS[level] < CURRENT) return;
  process.stdout.write(
    JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields }) + '\n'
  );
}

module.exports = {
  debug: (event, fields = {}) => write('DEBUG', event, fields),
  info:  (event, fields = {}) => write('INFO',  event, fields),
  warn:  (event, fields = {}) => write('WARN',  event, fields),
  error: (event, fields = {}) => write('ERROR', event, fields),
};
