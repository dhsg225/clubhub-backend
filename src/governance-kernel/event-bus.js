'use strict';
/**
 * Governance Event Bus
 *
 * Typed, causal, replayable governance event system.
 *
 * Every event includes:
 *   event_type        — string type from BUS_EVENTS catalog
 *   event_id          — random hex ID
 *   deterministic_ts  — governed clock ISO timestamp
 *   ...fields         — event-specific payload
 *
 * Supports:
 *   emit(type, fields)     — emit typed event
 *   subscribe(type, fn)    — subscribe to event type (returns unsubscribe fn)
 *   subscribe('*', fn)     — wildcard subscription
 *   getBuffer(opts)        — query event buffer
 *   snapshot()             — get all buffered events
 */
const crypto = require('node:crypto');
const clock  = require('./core/clock');

const MAX_BUS_EVENTS = 5000;

const BUS_EVENTS = Object.freeze({
  KERNEL: {
    INITIALIZED:  'governance.kernel.initialized',
    RECOVERED:    'governance.kernel.recovered',
    SHUTDOWN:     'governance.kernel.shutdown',
    REPLAY_EVENT: 'governance.kernel.replay_event',
  },
  AUTHORITY: {
    EPOCH_INCREMENTED:    'governance.authority.epoch_incremented',
    LEASE_ACQUIRED:       'governance.authority.lease_acquired',
    LEASE_RELEASED:       'governance.authority.lease_released',
    FREEZE_REQUESTED:     'governance.authority.freeze_requested',
    FREEZE_COMMITTED:     'governance.authority.freeze_committed',
    UNFREEZE_REQUESTED:   'governance.authority.unfreeze_requested',
    SPLIT_BRAIN_DETECTED: 'governance.authority.split_brain_detected',
  },
  CONFIG: {
    UPDATED:          'governance.config.updated',
    FROZEN:           'governance.config.frozen',
    UNFROZEN:         'governance.config.unfrozen',
    VERSION_MISMATCH: 'governance.config.version_mismatch',
  },
  INCIDENT: {
    DETECTED:   'governance.incident.detected',
    TRIAGED:    'governance.incident.triaged',
    MITIGATING: 'governance.incident.mitigating',
    RESOLVED:   'governance.incident.resolved',
    ARCHIVED:   'governance.incident.archived',
    OVERFLOW:   'governance.incident.overflow',
  },
  OPERATOR: {
    TOKEN_ISSUED:    'governance.operator.token_issued',
    TOKEN_REVOKED:   'governance.operator.token_revoked',
    KEY_ROTATED:     'governance.operator.key_rotated',
    ACTION_LEDGERED: 'governance.operator.action_ledgered',
  },
  DEPLOYMENT: {
    WAVE_PROMOTED:  'governance.deployment.wave_promoted',
    WAVE_FROZEN:    'governance.deployment.wave_frozen',
    ROLLBACK:       'governance.deployment.rollback',
    COMPLETE:       'governance.deployment.complete',
  },
  CLUSTER: {
    NODE_HEARTBEAT: 'governance.cluster.node_heartbeat',
    NODE_STALE:     'governance.cluster.node_stale',
    NODE_EVICTED:   'governance.cluster.node_evicted',
    STATUS_CHANGED: 'governance.cluster.status_changed',
  },
  PLUGIN: {
    REGISTERED: 'governance.plugin.registered',
    REJECTED:   'governance.plugin.rejected',
    ACTION:     'governance.plugin.action',
  },
});

const _subscribers = new Map();
const _buffer      = [];

function emit(eventType, fields = {}) {
  const event = Object.freeze({
    event_type:        eventType,
    event_id:          crypto.randomBytes(6).toString('hex'),
    deterministic_ts:  clock.nowIso(),
    ...fields,
  });

  _buffer.push(event);
  if (_buffer.length > MAX_BUS_EVENTS) _buffer.shift();

  const handlers = _subscribers.get(eventType);
  if (handlers) for (const h of handlers) { try { h(event); } catch { /* safe */ } }

  const wildcards = _subscribers.get('*');
  if (wildcards) for (const h of wildcards) { try { h(event); } catch { /* safe */ } }

  return event;
}

function subscribe(eventType, handler) {
  if (!_subscribers.has(eventType)) _subscribers.set(eventType, new Set());
  _subscribers.get(eventType).add(handler);
  return () => _subscribers.get(eventType)?.delete(handler);
}

function getBuffer(opts = {}) {
  const { type, limit } = opts;
  let events = type ? _buffer.filter(e => e.event_type === type) : [..._buffer];
  if (limit) events = events.slice(-limit);
  return events;
}

function snapshot() { return [..._buffer]; }

function _reset() { _buffer.length = 0; _subscribers.clear(); }

module.exports = { emit, subscribe, getBuffer, snapshot, BUS_EVENTS, _reset };
