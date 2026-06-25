# CONFIG_MUTATION_WORKFLOW.md
# Governance Kernel v1 — Config Governance Mutation Workflow

**Status:** FROZEN (A2.0.0)
**Effective:** 2026-05-24

---

## 1. Governed config editing model

Config changes in the Governance Kernel are NOT direct edits.
All config changes are **governed proposals** that must pass through:

1. Proposal construction (ConfigProposalBuilder)
2. Diff review (ConfigDiffEngine)
3. Impact preview (certification, replay, lineage)
4. Submission with justification
5. Server-side `ConfigAuthority.update(changes, { justification })` — DB_ASYNC
6. Event confirmation

There is no "quick edit" path. Every config change is attributable.

---

## 2. Proposal lifecycle

```
DRAFT → PREVIEWED → SUBMITTED → CONFIRMED | REJECTED
```

| State | Description |
|-------|-------------|
| DRAFT | Operator has opened editor but not previewed diff |
| PREVIEWED | Diff computed, hash previewed, certification impact shown |
| SUBMITTED | POST /governance/config/proposals — awaiting server confirmation |
| CONFIRMED | Server confirmed DB_ASYNC write; new config_hash visible |
| REJECTED | Server rejected (frozen state, insufficient role, invalid values) |

---

## 3. Proposal fields

```javascript
{
  // What is changing
  changes: {
    'ota.min_success_rate': 0.97,
    'ota.stale_threshold_ms': 90000,
  },

  // Attribution (required by ConfigAuthority.update())
  justification: 'Increasing min_success_rate per ops review 2026-05-24',
  operator_id: token.oid,
  role: token.role,
  jti: token.jti,

  // Replay safety
  config_hash_before: currentSnapshot.config_hash,  // hash of config before change
  config_hash_after: previewedHash,                  // hash after change (deterministic)

  // Determinism metadata
  lineage_ts: clock.nowIso(),   // governed clock at submission
  authority_epoch: currentEpoch,
}
```

---

## 4. Diff display requirements

ConfigDiffEngine renders a structured diff:

```
config.ota.min_success_rate
  - BEFORE:  0.95
  + AFTER:   0.97
  IMPACT:    Stricter success threshold — may cause more frequent freeze triggers

config.ota.stale_threshold_ms
  - BEFORE:  120000
  + AFTER:   90000
  IMPACT:    Shorter stale window — more frequent DB checks

Config hash:
  - BEFORE:  a1b2c3d4e5f6...
  + AFTER:   f6e5d4c3b2a1...  (deterministic)
```

The `config_hash` is SHA-256 of `_stableStringify(fullConfig)` — displayed for replay traceability.

---

## 5. Certification impact preview

Before submission, ConfigDiffEngine shows:

- Which certification runners may be affected by this change
- Whether any resource ceiling changes are proposed (MAX_NODES, etc.)
- Whether a Governance RFC is required (T0/T1 change)

Example warnings:
- "Changing MAX_ACTIVE_INCIDENTS requires a Governance RFC (T0 — Resource ceiling)"
- "This change may affect ResourceBoundCertification — re-run recommended"
- "Config changes are DB_ASYNC — all instances should restart or call initFromDb(pool)"

---

## 6. Replay impact visibility

When a config change affects threshold values used in policy decisions:

- UI shows: "Warning: Config version change may cause policy decisions to differ in replay"
- Reference: REPLAY_CONTRACT.md §7 — "Different threshold values → POSSIBLY INCOMPATIBLE"
- Operator is advised to record `getThresholdSnapshot()` before and after

---

## 7. Rollback preview

The proposal builder shows:
- Current config hash (the rollback target if this change is reverted)
- "Rollback proposal" button — creates a proposal that restores current values
- Note: rollback is also a governed proposal, not an instant revert

---

## 8. Stale proposal invalidation

If the config snapshot changes (another operator submits a config change) while
the proposal is in DRAFT state:

- UI shows: "Config changed since you opened this proposal — diff is stale"
- Proposal is invalidated (status → STALE_DRAFT)
- Operator must re-open proposal with fresh config snapshot as baseline

This prevents concurrent config mutation from producing unexpected compound diffs.

---

## 9. Active/active propagation warning

After confirmation, the UI shows:

"Config change confirmed. Note: Other active instances will not see this change
until they restart or call govConfig.initFromDb(pool).
Current consistency level: MEMORY_ONLY (M+async)."

This is mandatory — operators must not assume immediate cross-instance propagation.
