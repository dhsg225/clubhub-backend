/**
 * state-hash.js — Cryptographic mutation chain for governed state.
 *
 * Every mutation envelope in the chain links to its predecessor via
 * mutation_hash = sha256(previous_mutation_hash + canonicalized_payload).
 * This makes the mutation log tamper-evident and replay-verifiable.
 *
 * Design decisions:
 *   - Chain payload uses only replay-stable fields (no ts, no correlation_id).
 *   - GENESIS is the sentinel previous_mutation_hash for the first entry.
 *   - Hash is truncated to 16 hex chars (64-bit) — sufficient for chain integrity
 *     detection, not a security primitive.
 *
 * Divergence classifications (returned by verifyChain):
 *   HASH_MISMATCH          — stored mutation_hash ≠ recomputed hash
 *   MISSING_MUTATION       — seq gap in the chain (e.g. 1,2,4)
 *   FORKED_HISTORY         — entry.previous_mutation_hash ≠ predecessor.mutation_hash
 *   OUT_OF_ORDER_MUTATION  — entry.ts < predecessor.ts
 *   DUPLICATE_SEQ          — two entries share the same seq
 *   NONDETERMINISTIC_REPLAY — same position but different hash vs. reference chain
 *
 * Exported:
 *   CHAIN_GENESIS           — sentinel value for first entry's previous_mutation_hash
 *   stableStringify(val)    — deterministic JSON serializer
 *   computeMutationHash(prevHash, payload) — single-step chain hash
 *   HashChain               — stateful chain tracker used in mutations.js
 *   verifyChain(entries)    — validates a complete chain array
 *   compareChains(orig, replay) — cross-run divergence comparison
 */

import crypto from 'node:crypto';

export const CHAIN_GENESIS = 'GENESIS';

// Fields included in the chain hash — must be identical across replay runs.
// Excluded: ts (wall clock), correlation_id (unique per run), mutation_id (sequential but run-unique).
const CHAIN_FIELDS = ['seq', 'domain', 'entity_id', 'operation', 'from_state', 'to_state', 'mutator'];

// ─── Deterministic serialiser ─────────────────────────────────────────────────

export function stableStringify(val) {
  if (val === null || val === undefined) return String(val);
  if (typeof val !== 'object') return JSON.stringify(val);
  if (val instanceof Set)  return stableStringify([...val].sort());
  if (val instanceof Map)  return stableStringify(Object.fromEntries([...val].sort((a, b) => (a[0] < b[0] ? -1 : 1))));
  if (Array.isArray(val))  return '[' + val.map(stableStringify).join(',') + ']';
  const keys = Object.keys(val).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${stableStringify(val[k])}`).join(',') + '}';
}

// ─── Single-step chain hash ───────────────────────────────────────────────────

/**
 * Compute the mutation_hash for one chain link.
 *
 * @param {string} previousMutationHash  mutation_hash of the preceding entry, or CHAIN_GENESIS
 * @param {object} payload               raw fields; only CHAIN_FIELDS are hashed
 * @returns {string}                     16-char hex hash
 */
export function computeMutationHash(previousMutationHash, payload) {
  const stable = stableStringify({
    prev:    previousMutationHash ?? CHAIN_GENESIS,
    payload: Object.fromEntries(CHAIN_FIELDS.map(k => [k, payload[k] ?? null])),
  });
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

// ─── Stateful chain tracker ───────────────────────────────────────────────────

/**
 * HashChain tracks the running chain state.
 * Used as a module-level singleton inside mutations.js.
 *
 * next(fields) returns { seq, mutation_hash, previous_mutation_hash }
 * which is merged into each mutation envelope.
 */
export class HashChain {
  constructor() {
    this._seq      = 0;
    this._lastHash = CHAIN_GENESIS;
  }

  /**
   * Advance the chain by one mutation.
   * @param {object} fields  Must include domain, entity_id, operation, from_state, to_state, mutator
   * @returns {{ seq, mutation_hash, previous_mutation_hash }}
   */
  next(fields) {
    this._seq++;
    const seq             = this._seq;
    const previousHash    = this._lastHash;
    const mutation_hash   = computeMutationHash(previousHash, { seq, ...fields });
    this._lastHash        = mutation_hash;
    return { seq, mutation_hash, previous_mutation_hash: previousHash };
  }

  reset() {
    this._seq      = 0;
    this._lastHash = CHAIN_GENESIS;
  }

  get lastHash() { return this._lastHash; }
  get seq()      { return this._seq; }
}

// ─── Chain verification ───────────────────────────────────────────────────────

export const DIVERGENCE_TYPES = Object.freeze({
  HASH_MISMATCH:           'HASH_MISMATCH',
  MISSING_MUTATION:        'MISSING_MUTATION',
  FORKED_HISTORY:          'FORKED_HISTORY',
  OUT_OF_ORDER_MUTATION:   'OUT_OF_ORDER_MUTATION',
  DUPLICATE_SEQ:           'DUPLICATE_SEQ',
  NONDETERMINISTIC_REPLAY: 'NONDETERMINISTIC_REPLAY',
});

/**
 * Verify the integrity of a single mutation chain.
 * Checks: duplicate seq, missing seq, correct previous_mutation_hash linkage,
 * hash recomputation correctness, and timestamp ordering.
 *
 * @param {Array} entries  Array of mutation envelope objects (ordered by seq)
 * @returns {{ valid: boolean, divergences: Array }}
 */
export function verifyChain(entries) {
  if (!entries || entries.length === 0) return { valid: true, divergences: [] };

  const divergences = [];
  const seqSeen     = new Set();
  let   expectedSeq = 1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const prev  = i > 0 ? entries[i - 1] : null;

    // 1. Duplicate seq
    if (entry.seq != null) {
      if (seqSeen.has(entry.seq)) {
        divergences.push({
          type:    DIVERGENCE_TYPES.DUPLICATE_SEQ,
          index:   i,
          seq:     entry.seq,
          message: `Duplicate seq ${entry.seq} at index ${i}`,
        });
      }
      seqSeen.add(entry.seq);
    }

    // 2. Missing seq (gap detection)
    if (entry.seq != null && entry.seq !== expectedSeq) {
      for (let missing = expectedSeq; missing < entry.seq; missing++) {
        divergences.push({
          type:    DIVERGENCE_TYPES.MISSING_MUTATION,
          index:   i,
          missing_seq: missing,
          message: `Missing mutation at seq ${missing} (found ${entry.seq} at index ${i})`,
        });
      }
    }
    if (entry.seq != null) expectedSeq = entry.seq + 1;

    // 3. Forked history — previous_mutation_hash must chain to predecessor
    if (prev && entry.previous_mutation_hash != null) {
      if (entry.previous_mutation_hash !== prev.mutation_hash) {
        divergences.push({
          type:     DIVERGENCE_TYPES.FORKED_HISTORY,
          index:    i,
          seq:      entry.seq,
          expected: prev.mutation_hash,
          actual:   entry.previous_mutation_hash,
          message:  `Forked history at seq ${entry.seq}: expected prev=${prev.mutation_hash} but got ${entry.previous_mutation_hash}`,
        });
      }
    }
    if (i === 0 && entry.previous_mutation_hash != null && entry.previous_mutation_hash !== CHAIN_GENESIS) {
      divergences.push({
        type:     DIVERGENCE_TYPES.FORKED_HISTORY,
        index:    0,
        seq:      entry.seq,
        expected: CHAIN_GENESIS,
        actual:   entry.previous_mutation_hash,
        message:  `First entry previous_mutation_hash should be GENESIS, got ${entry.previous_mutation_hash}`,
      });
    }

    // 4. Hash recomputation
    if (entry.mutation_hash != null && entry.seq != null) {
      const prevHash    = entry.previous_mutation_hash ?? CHAIN_GENESIS;
      const recomputed  = computeMutationHash(prevHash, {
        seq:        entry.seq,
        domain:     entry.domain,
        entity_id:  entry.entity_id,
        operation:  entry.operation,
        from_state: entry.from_state ?? null,
        to_state:   entry.to_state   ?? null,
        mutator:    entry.mutator    ?? null,
      });
      if (recomputed !== entry.mutation_hash) {
        divergences.push({
          type:       DIVERGENCE_TYPES.HASH_MISMATCH,
          index:      i,
          seq:        entry.seq,
          domain:     entry.domain,
          expected:   recomputed,
          actual:     entry.mutation_hash,
          message:    `Hash mismatch at seq ${entry.seq} in domain '${entry.domain}': stored=${entry.mutation_hash} recomputed=${recomputed}`,
        });
      }
    }

    // 5. Timestamp ordering (soft check — clock skew is possible in realtime mode)
    if (prev && entry.ts != null && prev.ts != null && entry.ts < prev.ts) {
      divergences.push({
        type:    DIVERGENCE_TYPES.OUT_OF_ORDER_MUTATION,
        index:   i,
        seq:     entry.seq,
        ts:      entry.ts,
        prev_ts: prev.ts,
        message: `Out-of-order timestamp at seq ${entry.seq}: ts=${entry.ts} < prev_ts=${prev.ts}`,
      });
    }
  }

  return { valid: divergences.length === 0, divergences };
}

/**
 * Compare original and replay chains for NONDETERMINISTIC_REPLAY divergences.
 * Called from replay.js after a replay run completes.
 *
 * @param {Array} origEntries    mutation log from the original run
 * @param {Array} replayEntries  mutation log from the replay run
 * @returns {{ divergences: Array, final_hash_match: boolean }}
 */
export function compareChains(origEntries, replayEntries) {
  const divergences = [];
  const maxLen = Math.max(origEntries.length, replayEntries.length);

  for (let i = 0; i < maxLen; i++) {
    const orig   = origEntries[i];
    const replay = replayEntries[i];

    if (!orig) {
      divergences.push({
        type:    DIVERGENCE_TYPES.NONDETERMINISTIC_REPLAY,
        index:   i,
        message: `Replay has extra mutation at index ${i} (absent in original): seq=${replay?.seq} domain=${replay?.domain}`,
      });
      continue;
    }
    if (!replay) {
      divergences.push({
        type:    DIVERGENCE_TYPES.NONDETERMINISTIC_REPLAY,
        index:   i,
        message: `Replay missing mutation at index ${i} (present in original): seq=${orig.seq} domain=${orig.domain}`,
      });
      continue;
    }

    if (orig.mutation_hash !== replay.mutation_hash) {
      divergences.push({
        type:     DIVERGENCE_TYPES.NONDETERMINISTIC_REPLAY,
        index:    i,
        seq_orig:   orig.seq,
        seq_replay: replay.seq,
        orig_hash:   orig.mutation_hash,
        replay_hash: replay.mutation_hash,
        domain:     orig.domain ?? replay.domain,
        message:    `Nondeterministic replay at index ${i}: orig_hash=${orig.mutation_hash} replay_hash=${replay.mutation_hash} domain=${orig.domain}`,
      });
    }
  }

  const origFinal   = origEntries.at(-1)?.mutation_hash ?? CHAIN_GENESIS;
  const replayFinal = replayEntries.at(-1)?.mutation_hash ?? CHAIN_GENESIS;
  const final_hash_match = origFinal === replayFinal;

  if (!final_hash_match && divergences.length === 0) {
    // Chain lengths match but final hashes differ — shouldn't happen, but guard it
    divergences.push({
      type:         DIVERGENCE_TYPES.HASH_MISMATCH,
      index:        maxLen - 1,
      orig_final:   origFinal,
      replay_final: replayFinal,
      message:      `Final chain hash mismatch: orig=${origFinal} replay=${replayFinal}`,
    });
  }

  return { divergences, final_hash_match };
}
