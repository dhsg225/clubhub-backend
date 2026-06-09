/**
 * Governed Mutation Envelopes.
 * Every state mutation in a governed domain must go through applyMutation().
 * Direct property assignment, Object.assign, and spread mutations are prohibited
 * and detected by validate-contracts.js checkDirectMutationPatterns().
 *
 * Output: reports/mutation-log.json, reports/state-hash-trace.json
 */
import fs     from 'node:fs';
import path   from 'node:path';
import { newCorrelationId }                                     from './events.js';
import { STATE_DOMAINS, assertLegalTransition, MUTATION_OPERATIONS } from './state-authority.js';
import { HashChain, stableStringify }                           from './state-hash.js';
import crypto from 'node:crypto';

let _seq   = 0;
let _chain = new HashChain();
const _log = [];

export function resetMutationLog() { _log.length = 0; _seq = 0; _chain.reset(); }
export function getMutationLog()   { return [..._log]; }

function newMutationId() {
  return `mut-${(++_seq).toString(16).padStart(8, '0')}`;
}

// ─── Deterministic, replay-stable state hash ─────────────────────────────────

function stableStringify(val) {
  if (val === null || val === undefined) return String(val);
  if (typeof val !== 'object')  return JSON.stringify(val);
  if (val instanceof Set)       return stableStringify([...val].sort());
  if (val instanceof Map)       return stableStringify(Object.fromEntries([...val].sort((a,b)=>a[0]<b[0]?-1:1)));
  if (Array.isArray(val))       return '[' + val.map(stableStringify).join(',') + ']';
  const keys = Object.keys(val).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${stableStringify(val[k])}`).join(',') + '}';
}

export function hashState(state) {
  return crypto.createHash('sha256').update(stableStringify(state)).digest('hex').slice(0, 16);
}

// ─── Core mutation apply ──────────────────────────────────────────────────────

/**
 * Apply a governed state mutation, validate transition legality, and append
 * an immutable envelope to the mutation log.
 *
 * @param {object} opts
 *   domain          — governed domain key
 *   entity_id       — logical entity within the domain
 *   operation       — MUTATION_OPERATIONS value
 *   from_state      — state before mutation (for TRANSITION: must be legal)
 *   to_state        — state after mutation
 *   correlation_id  — optional; generated if absent
 *   caused_by       — correlation_id of causing event/mark
 *   suite           — active suite name
 *   mutator         — component issuing the mutation ('runner'|'chaos'|'metrics'|...)
 *   clock           — governed Clock instance (required)
 *   replayMode      — if true, persistent-domain mutations throw immediately
 *
 * @returns {{ envelope, result }} envelope is the logged record; result = to_state
 * @throws  IllegalTransitionError on illegal transition
 * @throws  Error on persistent mutation during replay
 */
export function applyMutation(opts) {
  const {
    domain, entity_id, operation,
    from_state = null, to_state = null,
    correlation_id, caused_by, suite, mutator,
    clock, replayMode = false,
  } = opts;

  const domainDef = STATE_DOMAINS[domain];

  // Replay guard: block persistent mutations
  if (replayMode && domainDef?.persistent) {
    throw new Error(
      `REPLAY_MUTATION_BLOCKED: persistent mutation in domain '${domain}' is prohibited during replay`
    );
  }

  // Transition legality
  if (operation === MUTATION_OPERATIONS.TRANSITION && from_state != null && to_state != null) {
    assertLegalTransition(domain, from_state, to_state);
  }

  const ts       = clock ? clock.now() : Date.now();
  const prevHash = from_state != null ? hashState(from_state) : null;
  const nextHash = to_state   != null ? hashState(to_state)   : null;

  // Advance the chain — must happen before building the envelope so seq is assigned
  const chainEntry = _chain.next({
    domain,
    entity_id:  entity_id  ?? null,
    operation,
    from_state: from_state ?? null,
    to_state:   to_state   ?? null,
    mutator:    mutator    ?? null,
  });

  const envelope = Object.freeze({
    mutation_id:             newMutationId(),
    correlation_id:          correlation_id ?? newCorrelationId(),
    ts,
    suite:                   suite      ?? null,
    domain,
    entity_id:               entity_id  ?? null,
    operation,
    mutator:                 mutator    ?? null,
    previous_state_hash:     prevHash,
    next_state_hash:         nextHash,
    caused_by:               caused_by  ?? null,
    replayable:              domainDef?.replayable ?? false,
    persisted:               domainDef?.persistent ?? false,
    // Chain fields — link this envelope to its predecessor
    seq:                     chainEntry.seq,
    mutation_hash:           chainEntry.mutation_hash,
    previous_mutation_hash:  chainEntry.previous_mutation_hash,
  });

  _log.push(envelope);
  return { envelope, result: to_state };
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

export function saveMutationLog(reportsDir) {
  try {
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportsDir, 'mutation-log.json'),
      JSON.stringify({ generated_at: new Date().toISOString(), mutations: _log }, null, 2)
    );
  } catch { /* non-fatal */ }
}

export function saveStateHashTrace(reportsDir, isoTs) {
  const entries = _log
    .filter(m => m.previous_state_hash !== null || m.next_state_hash !== null)
    .map(m => ({
      mutation_id:            m.mutation_id,
      domain:                 m.domain,
      entity_id:              m.entity_id,
      ts:                     m.ts,
      operation:              m.operation,
      suite:                  m.suite,
      prev_hash:              m.previous_state_hash,
      next_hash:              m.next_state_hash,
      // Chain fields for replay verification
      seq:                    m.seq,
      mutation_hash:          m.mutation_hash,
      previous_mutation_hash: m.previous_mutation_hash,
      from_state:             m.from_state ?? null,
      to_state:               m.to_state   ?? null,
      mutator:                m.mutator    ?? null,
    }));
  try {
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportsDir, 'state-hash-trace.json'),
      JSON.stringify({ generated_at: isoTs, entries }, null, 2)
    );
  } catch { /* non-fatal */ }
  return entries;
}
