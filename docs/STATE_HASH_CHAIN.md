# State Hash Chain

**Enforcement location:** `test-runner/lib/state-hash.js`, `test-runner/lib/mutations.js`
**Contract check:** `validate-contracts.js` check 15 — `state_hash_chain`

---

## What it is

Every governed state mutation in the test runner produces a cryptographically linked chain entry. Each mutation envelope carries:

```
mutation_hash           — sha256(previous_mutation_hash + canonical_payload)[0:16]
previous_mutation_hash  — mutation_hash of the preceding entry, or "GENESIS" for the first
seq                     — monotonically incrementing sequence number (starts at 1 per run)
```

The chain links every mutation to its predecessor. A tampered, replayed-out-of-order, or dropped mutation is detectable by recomputing the chain from `GENESIS` and comparing hashes at each position.

---

## Canonical payload

The payload hashed per chain link includes only **replay-stable fields**:

```
seq, domain, entity_id, operation, from_state, to_state, mutator
```

Excluded: `ts` (wall clock differs between runs), `correlation_id` (unique per run), `mutation_id` (run-scoped). This ensures the chain hash is identical for identical logical mutation sequences across original and replay runs.

---

## Chain hash computation

```
mutation_hash = sha256(
  stableStringify({
    prev:    previous_mutation_hash,   // "GENESIS" for first entry
    payload: { seq, domain, entity_id, operation, from_state, to_state, mutator }
  })
)[0:16]
```

`stableStringify` recursively sorts object keys, handles `Set`, `Map`, and `Array`. Output is deterministic regardless of insertion order.

---

## `HashChain` class

`test-runner/lib/mutations.js` maintains a module-level `HashChain` singleton. Every call to `applyMutation()` calls `_chain.next(fields)` which:

1. Increments `_seq`
2. Computes `mutation_hash = computeMutationHash(_lastHash, payload)`
3. Updates `_lastHash`
4. Returns `{ seq, mutation_hash, previous_mutation_hash }` — merged into the frozen envelope

`resetMutationLog()` calls `_chain.reset()`, resetting both `_seq` and `_lastHash` to `GENESIS`.

---

## State hash trace

`saveStateHashTrace()` in `mutations.js` writes `reports/state-hash-trace.json`. Each entry includes the chain fields in addition to state value hashes:

```json
{
  "seq": 1,
  "mutation_hash": "a3f1...",
  "previous_mutation_hash": "GENESIS",
  "from_state": "PENDING",
  "to_state": "RUNNING",
  "domain": "suite",
  ...
}
```

---

## Divergence detection

`verifyChain(entries)` in `state-hash.js` accepts the ordered mutation log and returns:

| Type | Condition |
|------|-----------|
| `HASH_MISMATCH` | Stored `mutation_hash` ≠ recomputed hash |
| `MISSING_MUTATION` | Seq gap (entries at 1, 2, 4 — seq 3 absent) |
| `FORKED_HISTORY` | `entry.previous_mutation_hash` ≠ `predecessor.mutation_hash` |
| `OUT_OF_ORDER_MUTATION` | `entry.ts < predecessor.ts` |
| `DUPLICATE_SEQ` | Two entries share the same seq |
| `NONDETERMINISTIC_REPLAY` | Same position, different hash vs. reference chain |

`compareChains(origEntries, replayEntries)` performs cross-run comparison and returns `{ divergences, final_hash_match }`.

---

## Replay integration

`validateReplay()` in `replay.js` calls `verifyChain(replayHashTrace)` to verify the replay chain is self-consistent, then calls `compareChains(origChainEntries, replayChainEntries)` to compare final chain hashes. A `final_hash_match: false` is reported as a divergence.

Reports written: `reports/replay-validation.json`, `reports/state-divergence.json`.

---

## Invariants

1. Every `applyMutation()` call advances the chain — no mutation can be added without a chain entry.
2. `mutation_hash` is deterministic: identical input fields produce identical output across runs.
3. The first entry's `previous_mutation_hash` is always `"GENESIS"`.
4. Chain entries are frozen objects — they cannot be mutated after logging.
5. `validate-contracts.js` check 15 fails if `mutations.js` omits either chain field.

---

## Limitations

- Hash is 16 hex chars (64-bit). Collision probability is negligible for test-run-length chains (thousands of mutations). Not a cryptographic security primitive.
- Chain covers only mutations that pass through `applyMutation()`. Direct state assignments (prohibited by check 14) would not appear in the chain.
- In `realtime` clock mode, `ts` fields may have minor skew but the hash chain is unaffected (ts is excluded from chain payload).
- Cross-machine replay requires identical seq ordering. Non-deterministic chaos execution produces differing seq order → chain divergence.
