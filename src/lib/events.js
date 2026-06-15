'use strict';
/**
 * events.js
 *
 * Operational event emitter for ClubHub TV.
 * Implements the event taxonomy defined in OBSERVABILITY.md §2.
 *
 * All events are structured JSON emitted via logger.js. The emitter enforces
 * required field presence, namespace correctness, and correlation ID propagation
 * (OBSERVABILITY.md §3).
 *
 * Usage:
 *   const { emit, EVENTS } = require('./events');
 *
 *   // In a request handler:
 *   emit(EVENTS.SCREEN.POLL_SUCCESS, req, {
 *     screen_id: 'sim-01',
 *     checksum: 'abc123',
 *     version: 3,
 *     latency_ms: 12,
 *     cache_hit: true,
 *   });
 *
 *   // Outside request context:
 *   emit(EVENTS.PLATFORM.STARTUP, null, { port: 4000, node_version: process.version, db_connected: true });
 */

const logger = require('./logger');

// ─────────────────────────────────────────────────────────────────────────────
// SINK + BUFFER
// Pluggable sink support for external log aggregation (e.g. Loki).
// In-memory ring buffer for forensic reconstruction (OBSERVABILITY.md §7).
// ─────────────────────────────────────────────────────────────────────────────

const _sinks  = [];
const _buffer = [];
const MAX_BUFFER = 1000;

/**
 * Register a pluggable event sink.
 * Sink must implement: { write(envelope) }
 * Sink failures are silently swallowed — they must not crash the backend.
 */
function registerSink(sink) {
  _sinks.push(sink);
}

/**
 * Return a copy of the in-memory event buffer (most recent MAX_BUFFER events).
 * Used by forensics.js for incident reconstruction.
 */
function getBuffer() {
  return [..._buffer];
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT CATALOGUE
// All event names are namespaced constants. Use these — never raw strings.
// Adding a new event requires a corresponding entry in OBSERVABILITY.md §2.3.
// ─────────────────────────────────────────────────────────────────────────────
const EVENTS = Object.freeze({
  PLATFORM: {
    STARTUP:            'PLATFORM.startup',
    SHUTDOWN:           'PLATFORM.shutdown',
    HEALTH_DEGRADED:    'PLATFORM.health_degraded',
    HEALTH_RESTORED:    'PLATFORM.health_restored',
    RATE_LIMIT_HIT:     'PLATFORM.rate_limit_hit',
    REQUEST_TIMEOUT:    'PLATFORM.request_timeout',
    MALFORMED_EVENT:    'PLATFORM.malformed_event',
    LATENCY_SPIKE:      'PLATFORM.latency_spike',
    SINK_FAILED:        'PLATFORM.sink_failed',
  },
  SCREEN: {
    POLL_SUCCESS:            'SCREEN.poll_success',
    POLL_FAILURE:            'SCREEN.poll_failure',
    REGISTERED:              'SCREEN.registered',
    WATCHDOG_REBOOT:         'SCREEN.watchdog_reboot',
    MANIFEST_STALE:          'SCREEN.manifest_stale',
    CHECKSUM_CHANGE:         'SCREEN.checksum_change',
    OTA_START:               'SCREEN.ota_start',
    OTA_COMPLETE:            'SCREEN.ota_complete',
    OTA_FAILED:              'SCREEN.ota_failed',
    OTA_ROLLBACK:            'SCREEN.ota_rollback',
    MANIFEST_INTEGRITY_FAIL: 'SCREEN.manifest_integrity_failure',
  },
  FLEET: {
    HEALTH_TRANSITION:  'FLEET.health_transition',
    DESYNC_DETECTED:    'FLEET.desync_detected',
    DESYNC_RESOLVED:    'FLEET.desync_resolved',
    POLL_RATE_DEGRADED: 'FLEET.poll_rate_degraded',
  },
  OTA: {
    ROLLOUT_STARTED:    'OTA.rollout_started',
    RING_PROMOTED:      'OTA.ring_promoted',
    RING_FROZEN:        'OTA.ring_frozen',
    ROLLBACK_TRIGGERED: 'OTA.rollback_triggered',
    ROLLBACK_COMPLETE:  'OTA.rollback_complete',
    UPDATE_COMPLETE:    'OTA.update_complete',
  },
  SECURITY: {
    ENROLLMENT_ATTEMPT:  'SECURITY.enrollment_attempt',
    ENROLLMENT_REJECTED: 'SECURITY.enrollment_rejected',
    TOKEN_ISSUED:        'SECURITY.token_issued',
    TOKEN_REVOKED:       'SECURITY.token_revoked',
    UNAUTHORIZED_POLL:   'SECURITY.unauthorized_poll',
    NODE_QUARANTINED:    'SECURITY.node_quarantined',
  },
  STORAGE: {
    CACHE_MISS:         'STORAGE.cache_miss',
    CACHE_HIT:          'STORAGE.cache_hit',
    CACHE_INVALIDATED:  'STORAGE.cache_invalidated',
    BACKUP_COMPLETE:    'STORAGE.backup_complete',
    BACKUP_FAILED:      'STORAGE.backup_failed',
    RESTORE_STARTED:    'STORAGE.restore_started',
    RESTORE_COMPLETE:   'STORAGE.restore_complete',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// REQUIRED FIELDS
// Validated on every emit call. Missing fields trigger PLATFORM.malformed_event.
// Per OBSERVABILITY.md §2.2.
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['ns', 'event', 'env'];

// Infer namespace from event string (e.g. 'SCREEN.poll_success' → 'SCREEN')
function inferNamespace(eventName) {
  return eventName ? eventName.split('.')[0] : null;
}

// Resolve the environment label. Prefer explicit env var; fall back to heuristics.
const ENV_LABEL = (() => {
  if (process.env.NODE_ENV === 'test' || process.env.CI) return 'ci';
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.SIMULATION) return 'simulation';
  return 'staging';
})();

// Extract backend version from package.json once at module load
let _backendVersion = 'unknown';
try {
  const pkg = require('../../../package.json');
  _backendVersion = pkg.version || 'unknown';
} catch (_) {}

// ─────────────────────────────────────────────────────────────────────────────
// EMIT
// Primary API. req may be null for non-request-scoped events.
// fields contains event-specific payload (see OBSERVABILITY.md §2.3).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit a platform operational event.
 *
 * @param {string} eventName - A value from EVENTS.*.*
 * @param {object|null} req   - Express request object (for correlation ID) or null
 * @param {object} fields     - Event-specific fields per OBSERVABILITY.md §2.3
 */
function emit(eventName, req, fields = {}) {
  const ns = inferNamespace(eventName);
  if (!ns) {
    _malformed('emit called with invalid eventName', { eventName });
    return;
  }

  // Build the canonical event envelope
  const envelope = {
    ns,
    event:      eventName,
    request_id: req?.requestId ?? fields.request_id ?? null,
    screen_id:  fields.screen_id  ?? null,
    venue_id:   fields.venue_id   ?? null,
    version:    fields.version    ?? _backendVersion,
    env:        ENV_LABEL,
    ...fields,
  };

  // Remove duplicated top-level fields that were spread from `fields`
  // (screen_id, venue_id, version, env are already in envelope)
  // This prevents them appearing twice if caller also passes them.

  // Validate required fields
  const missing = REQUIRED_FIELDS.filter(f => !envelope[f]);
  if (missing.length > 0) {
    _malformed(`Event missing required fields: ${missing.join(', ')}`, { eventName, missing });
    // Still emit the event; partial data is better than silence
  }

  // Route to appropriate log level
  const level = _eventLevel(eventName);
  logger[level](eventName, envelope);

  // Buffer for forensics (OBSERVABILITY.md §7)
  _buffer.push({ ...envelope, ts: new Date().toISOString() });
  if (_buffer.length > MAX_BUFFER) _buffer.shift();

  // Fan out to registered sinks (Loki, etc.)
  for (const sink of _sinks) {
    try { sink.write(envelope); } catch { /* sink failure must not crash backend */ }
  }
}

/**
 * Emit a PLATFORM.malformed_event when event construction fails.
 * Uses logger directly to avoid recursion.
 */
function _malformed(reason, meta = {}) {
  logger.warn(EVENTS.PLATFORM.MALFORMED_EVENT, {
    ns:     'PLATFORM',
    event:  EVENTS.PLATFORM.MALFORMED_EVENT,
    env:    ENV_LABEL,
    reason,
    ...meta,
  });
}

/**
 * Determine log level from event name convention.
 * Rules:
 *   Events ending in _failed, _error, _rejected → 'error'
 *   Events starting with FLEET.desync, SECURITY, FLEET.health_transition UNHEALTHY → 'error'
 *   Events ending in _degraded, _stale, _limit_hit, _timeout, _frozen, _triggered → 'warn'
 *   Everything else → 'info'
 *   STORAGE.cache_miss, cache_hit → 'debug'
 */
function _eventLevel(eventName) {
  if (/\.(cache_miss|cache_hit)$/.test(eventName)) return 'debug';
  if (/\.(failed|error|rejected|integrity_failure|rollback_triggered|desync_detected)$/.test(eventName)) return 'error';
  if (/\.(degraded|stale|rate_limit_hit|request_timeout|ring_frozen|watchdog_reboot|health_degraded|unauthorized_poll|node_quarantined|rollback_triggered|backup_failed)$/.test(eventName)) return 'warn';
  return 'info';
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE WRAPPERS
// For high-frequency events to reduce boilerplate in call sites.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit SCREEN.poll_success with full required fields.
 * Called from manifest route after successful response.
 */
function pollSuccess(req, { screen_id, venue_id, checksum, version, latency_ms, cache_hit }) {
  emit(EVENTS.SCREEN.POLL_SUCCESS, req, {
    screen_id, venue_id, checksum, version, latency_ms, cache_hit,
  });
}

/**
 * Emit SCREEN.poll_failure.
 */
function pollFailure(req, { screen_id, venue_id, reason, consecutive_failures, offline_streak }) {
  emit(EVENTS.SCREEN.POLL_FAILURE, req, {
    screen_id, venue_id, reason, consecutive_failures, offline_streak,
  });
}

/**
 * Emit STORAGE.cache_hit or STORAGE.cache_miss.
 */
function cacheEvent(hit, req, { screen_id, cache_age_ms, compute_ms }) {
  if (hit) {
    emit(EVENTS.STORAGE.CACHE_HIT, req, { screen_id, cache_age_ms });
  } else {
    emit(EVENTS.STORAGE.CACHE_MISS, req, { screen_id, compute_ms });
  }
}

/**
 * Emit PLATFORM.rate_limit_hit.
 * Called from rateLimiter.js when a request is rejected.
 */
function rateLimitHit(req, { tier, limit, window_ms }) {
  // Hash the IP to avoid logging PII
  const ip = req?.ip ?? req?.connection?.remoteAddress ?? 'unknown';
  const ip_hash = _hashIp(ip);
  emit(EVENTS.PLATFORM.RATE_LIMIT_HIT, req, { tier, ip_hash, limit, window_ms });
}

/**
 * Simple one-way IP hash for observability (not security-grade).
 * Consistent within a process lifetime.
 */
function _hashIp(ip) {
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = (Math.imul(31, h) + ip.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

module.exports = { emit, EVENTS, pollSuccess, pollFailure, cacheEvent, rateLimitHit, registerSink, getBuffer };
