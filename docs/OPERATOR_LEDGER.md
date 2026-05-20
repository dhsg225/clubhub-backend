# Operator Ledger

`backend/src/lib/operator-ledger.js`

An append-only, tamper-evident ledger of all operator actions. Every entry is
linked to the previous one via a SHA-256 hash chain. No delete or mutate API exists.

## What it is

A module-level in-memory array (`_ledger`) with a hash chain. The chain sentinel
is `LEDGER_GENESIS` for the first entry's `previous_entry_hash`. Call `resetLedger()`
between tests. `saveLedger()` writes the current state to disk.

## Tracked Action Types

```
rollout_promote      rollout_rollback     rollout_freeze
rollout_unfreeze     waiver_created       quarantine_override
manifest_invalidate  policy_override      threshold_override
config_changed
```

`appendEntry()` throws if `action_type` is not in this set.
`appendEntry()` throws if `action_type === 'waiver_created'` and no `justification` is provided.

## Ledger Entry Format

```
{
  action_id,           // act-XXXXXXXX (sequential hex)
  operator_id,         // who performed the action
  action_type,         // one of the allowed types above
  justification,       // required for waiver_created; optional otherwise
  before_state_hash,   // optional: hash of state before action
  after_state_hash,    // optional: hash of state after action
  related_incident,    // optional: incident_id this action is linked to
  approval_chain,      // array of approver IDs (may be empty)
  ts,                  // ISO-8601 timestamp
  entry_hash,          // sha256(previous_entry_hash + stableStringify(core_fields))[0:16]
  previous_entry_hash, // 'LEDGER_GENESIS' for first entry, else previous entry_hash
}
```

## Hash Chain

```
entry_hash = sha256(
  previous_entry_hash + stableStringify({action_id, operator_id, action_type, justification, ts})
)[0:16]
```

`verifyIntegrity()` recomputes the chain from scratch, comparing `previous_entry_hash`
and `entry_hash` for every entry. Returns `{ valid: boolean, violations: [] }`.

## operator-ledger.json Format

Written by `saveLedger(reportsDir)`:
```json
{
  "generated_at": "...",
  "integrity": { "valid": true, "violations": [] },
  "entries": [ /* array of ledger entries */ ]
}
```

## Invariants

- No entry is ever removed or modified after append.
- Hash chain is computable from the ledger array alone — no external state needed.
- `LEDGER_GENESIS` is the only sentinel; first entry always has this as `previous_entry_hash`.
- `waiver_created` without justification throws synchronously before any entry is appended.

## Limitations

- In-memory only — ledger is lost on process restart unless `saveLedger()` is called.
- Sequential IDs are not globally unique across multiple instances.
- No DB persistence — distributed deployments must serialize and share the ledger externally.
- `entry_hash` is only 16 hex chars (64-bit prefix of SHA-256); collision resistance is limited.
- Timestamps come from `new Date()` — not governed by the Clock abstraction.
