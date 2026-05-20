# Governed Configuration

`backend/src/lib/governed-config.js`

Versioned, hashed, operator-attributed configuration management. Wraps
`thresholds.json` (or any config object) with full change history and
justification requirements for every update.

## Config Versioning

- Version starts at 1 on construction (initial load counts as version 1).
- Each `update()` call increments the version.
- Every version is recorded in the history array with its snapshot metadata.

## Change Attribution

Every `update()` call requires `opts.justification`. Calls without it throw
synchronously before any change is applied. `opts.operator_id` is optional but
recorded in the snapshot.

## config_hash

```js
sha256(stableStringify(config))[0:16]
```

Computed over the full config object at the time of the snapshot. Changing a
single value changes the hash. The `stableStringify` ensures key ordering is
deterministic.

## Diff Computation

`changed_keys` in each snapshot is an array of dot-paths that differ between
the previous and current config. Computed by deep structural comparison.

## Freeze Mode

`freeze()` blocks all further `update()` calls. `isFrozen()` returns the current
state. `unfreeze()` re-enables updates. The frozen flag is in-memory only —
it does not persist across restarts.

## Rollback Support

`rollbackTo(version)` is declared and looks up the version in history, but the
current implementation throws because full config state is not stored in history
snapshots. This is a known limitation (see Limitations below).

## History JSON Format

Written by `saveHistory(dir)` to `reports/config-history.json`:
```json
{
  "generated_at": "...",
  "current_version": 3,
  "frozen": false,
  "history": [
    {
      "config_version": 1,
      "previous_version": null,
      "changed_keys": [],
      "justification": "initial_load",
      "operator_id": "system",
      "ts": "...",
      "config_hash": "...",
      "previous_config_hash": null
    }
  ]
}
```

## Operator Ledger Integration

If an `operatorLedger` is passed to the constructor, every `update()` appends a
`config_changed` ledger entry with `before_state_hash` and `after_state_hash`.
Ledger failures are caught and do not block the config update.

## Invariants

- `update()` without `justification` always throws — no silent ungoverned changes.
- `config_hash` is always computed from the live config at snapshot time.
- Version always increments; never decrements.
- `getAll()` returns a frozen deep clone — callers cannot mutate the live config directly.

## Limitations

- `rollbackTo()` throws in the current implementation — full config state per version
  is not stored. Only snapshot metadata (hash, diff) is stored in history.
- In-memory only — config state is not persisted to DB.
- Timestamps use `new Date()` — not governed by the Clock abstraction.
- `get(keyPath)` uses simple dot-path traversal — does not handle array indices.
