# GOVERNANCE_INVARIANTS.md
# Governance Kernel v1 — Invariants and Laws

**Status:** FROZEN (v1.0.0)
**Effective:** 2026-05-23
**Authority:** These invariants are normative. Violations are bugs, not features.

Each law is classified:
- **[HARD]** — enforced in code; violation is a runtime error or certification FAIL
- **[SOFT]** — enforced by convention + validator checks; violation is a WARN/CONDITIONAL
- **[ADVISORY]** — documented expectation; violation is known gap, tracked

---

## AUTHORITY LAWS

### A1 — Epoch Monotonicity [HARD]
The authority epoch MUST only increase. It MUST be incremented atomically via the database
(`pg_advisory_xact_lock` + `UPDATE governance_state SET int_value = int_value + 1`).
No in-memory increment is authoritative. Memory value is updated from the DB return value.

**Checked by:** validate-contracts.js check 40 (`no_in_memory_epoch_only`), check 62 (`freeze_epoch_counter`)

### A2 — Single Threshold Read Path [HARD]
All modules MUST read thresholds through `getThreshold()` / `requireThreshold()` /
`getThresholdSnapshot()` from `core/config-authority.js`. No module may call
`JSON.parse(fs.readFileSync(...thresholds.json...))` except the one permitted bootstrap read
in the application's startup sequence.

**Checked by:** validate-contracts.js check 35 (`no_direct_threshold_reads`)

### A3 — Lease Holder Assumption [SOFT]
In active/active topologies, `isLeaseHolder()` MUST be consulted before performing
singleton-sensitive operations (config updates, epoch increments that are not recovery).
Callers that skip this check accept eventual authority divergence.

**Checked by:** validate-contracts.js checks 38–45 (HA authority checks)

### A4 — Clock Authority [HARD]
All governance-critical timestamps MUST use `clock.now()` or `clock.nowIso()` from
`core/clock.js`. Raw `Date.now()` is permitted ONLY for:
- operator token `iat`/`exp` (interoperability requirement)
- node heartbeat `received_at` (wall-clock by design — not governance-critical)
- HTTP request duration logging (not governance state)

**Checked by:** validate-contracts.js check 73 (`governed_clock`)

### A5 — Config Change Attribution [HARD]
Every `GovernedConfig.update()` call MUST provide `opts.justification`. Calls without
justification throw immediately. Config changes are hash-chained and version-stamped.

**Enforcement:** `if (!justification) throw new Error(...)` in config-authority.js

---

## FREEZE LAWS

### F1 — Freeze FAIL_CLOSED [HARD]
`freezeStrong()` MUST commit the freeze to in-memory state even if the DB write fails,
when `DB_FAILURE_POLICY === 'FAIL_CLOSED'` (the default). The freeze is conservative:
in doubt, the system freezes.

**Enforcement:** try/catch in `freezeStrong()` — in-memory freeze applied before DB await returns

### F2 — Freeze Epoch Monotonicity [HARD]
The `_freezeEpoch` counter MUST be incremented on every freeze and unfreeze event.
It MUST be persisted to the DB. It provides stale-epoch detection for nodes.

**Checked by:** validate-contracts.js check 59 (`freeze_epoch_counter`)

### F3 — Freeze Read Authority [SOFT]
Production callers that depend on freeze state for safety decisions MUST use
`getFreezeStateStrong(pool)` (DB_AUTHORITATIVE), not `isDeploymentFrozen()` (CACHE_COHERENT).
Using the cached read is CACHE_COHERENT and may be stale in active/active.

**Checked by:** validate-contracts.js check 60 (`strong_freeze_read`)

### F4 — No Freeze Bypass Without Override [HARD]
No deployment promotion MAY proceed when `isDeploymentFrozen()` returns true without
an explicit `freeze_bypass` override in the operator overrides system, with valid
`operator_id` and `justification`.

**Enforcement:** evaluatePromotion() checks `authorityLeaseSafe: !fleetConsensus.isRolloutFrozen()`

---

## REPLAY LAWS

### R1 — Replay Side-Effect Prohibition [HARD]
Replay mode (`kernel.replay(events)`) MUST NOT emit real-world side effects:
- no DB writes during replay
- no HTTP calls during replay
- no file system writes during replay
- `clock.freeze()` is set for the duration of replay

**Enforcement:** kernel.replay() sets `_mode = REPLAY_MODES.REPLAY`; callers must check mode before writing

### R2 — Clock Monotonicity in Replay [HARD]
During replay, `clock.setFixed(lineage_ts)` sets absolute time. Events MUST be replayed
in `lineage_ts` order. Out-of-order replay produces undefined state.

### R3 — ORPHANED_EVENT in Replay [SOFT]
In `LINEAGE_MODES.REPLAY`, the `ORPHANED_EVENT` anomaly MUST be suppressed. Replayed
events have no live causal parents; treating them as orphaned would make all replay invalid.

**Enforcement:** `verifyLineage(events, { mode: LINEAGE_MODES.REPLAY })` filters ORPHANED_EVENT

### R4 — Deterministic ID Stability [HARD]
`deriveDeterministicId(namespace, payload, length)` MUST produce identical output for
identical inputs across restarts, Node.js versions, and platforms. The hash input MUST
use `_stableStringify` (key-sorted JSON serialization) and MUST NOT include any
wall-clock value.

**Checked by:** validate-contracts.js check 55 (`deterministic_id_module`), check 56, check 57

### R5 — Replay Config Snapshot [SOFT]
Replay callers SHOULD record the `config_hash` and `config_version` at the time of the
original event. Replaying against a different config version may produce different outcomes.
The kernel provides `getThresholdSnapshot()` for this purpose.

---

## LINEAGE LAWS

### L1 — No Unlineaged Governance Events [SOFT]
All governance state transitions that involve fleet authority, freeze, incidents, or rollout
MUST wrap their event payload with `withLineage()`. Events emitted without lineage
are ADVISORY-ONLY and cannot participate in causal analysis.

**Checked by:** validate-contracts.js check 74 (`full_lineage_enforcement`)

### L2 — Correlation Chain Integrity [SOFT]
Each lineage context SHOULD carry `caused_by` (the parent event ID or context). Orphaned
events (no `caused_by`) are flagged as `LINEAGE_ANOMALY.ORPHANED_EVENT` in STRICT mode.

### L3 — Authority Epoch in Lineage [SOFT]
Every `withLineage()` call SHOULD pass `authority_epoch: clusterConsensus.getEpoch()`.
Events without `authority_epoch` cannot participate in epoch-gated replay.

### L4 — Lineage Buffer Bound [HARD]
The lineage event buffer (`_events`) is bounded at 2,000 entries. Overflow evicts the
oldest event. No unbounded lineage accumulation is permitted.

---

## INCIDENT LAWS

### I1 — Deterministic Incident IDs [HARD]
Incident IDs MUST be derived from `deriveDeterministicId('inc', { type, severity, causal_chain })`.
They MUST NOT include wall-clock values. Two incidents with identical type, severity, and
causal chain produce the same ID — enabling DB-level deduplication.

**Checked by:** validate-contracts.js check 78 (`incident_lifecycle_governance`)

### I2 — Active Incident Bound [HARD]
The active incident count MUST NOT exceed `MAX_ACTIVE_INCIDENTS = 500`. On overflow,
the oldest RESOLVED incident MUST be evicted before a new incident is accepted.

**Checked by:** validate-contracts.js check 78

### I3 — Incident Archive [HARD]
Incidents older than `RESOLVED_INCIDENT_TTL_MS = 7 days` MUST be eligible for archival
to the `incidents_archive` DB table. `archiveResolvedIncidents(pool)` executes this.

### I4 — Concurrent Transition Safety [HARD]
`transitionStrong(pool, id, toState, reason)` MUST use `pg_advisory_xact_lock` + version
check. Concurrent transitions on the same incident MUST throw `IncidentConcurrencyError`,
not silently corrupt state.

---

## OPERATOR LAWS

### O1 — Token Signature Verification [HARD]
All operator tokens MUST be verified with `crypto.timingSafeEqual`. Buffer-length check
MUST precede the equality check. Constant-time comparison is mandatory; early-exit
comparison is a timing attack vector.

**Checked by:** validate-contracts.js check 65 (`operator_hmac_sha256`), check 66 (`operator_timing_safe`)

### O2 — Role Hierarchy [HARD]
ADMIN ≥ OPERATOR ≥ VIEWER. A route protected by `requireAuth(ROLES.OPERATOR)` MUST
accept ADMIN tokens. A route protected by ADMIN MUST reject OPERATOR tokens. No
role escalation path exists in the token format.

### O3 — JTI Uniqueness [HARD]
Every issued token MUST carry a unique `jti` (`crypto.randomBytes(8).toString('hex')`).
Tokens without `jti` cannot be selectively revoked.

### O4 — JTI Revocation Check [HARD]
`verifyToken()` MUST call `sessionAuth.isRevoked(payload.jti)` before returning `valid: true`.
The check MUST occur after signature verification and expiry check.

**Checked by:** validate-contracts.js check 76 (`jti_replay_protection`)

### O5 — All Actions Ledgered [SOFT]
Operator-initiated governance actions (freeze, unfreeze, promote, rollback, config change)
SHOULD append an entry to the audit ledger with `operator_id`, `action_type`, `justification`.
Ledger failures MUST NOT block the primary action.

---

## CERTIFICATION LAWS

### C1 — Certification Supersedes Informal Review [HARD]
A governance change that causes any certification runner to return FAIL MUST NOT
be merged to a production branch. CONDITIONAL changes require documented caveats.

### C2 — Validator Checks Are Normative [HARD]
The 79 checks in `validate-contracts.js` are normative. A check cannot be removed
or downgraded from FAIL to WARN without a Governance RFC. New checks may only
increase enforcement, not decrease it.

**Checked by:** validate-contracts.js checks 1–79 must all pass

### C3 — Certification Does Not Self-Certify [HARD]
The certification runner MUST NOT produce a PASS rating by modifying the source
it is analyzing. It is static analysis only.

### C4 — Certification Level Ceiling [HARD]
Certification levels are ordered: DEVELOPMENT < STAGING < PRODUCTION_READY < HA_PRODUCTION.
A system cannot claim HA_PRODUCTION if any runner in the HA_PRODUCTION set returns FAIL.

---

## RESOURCE LAWS

### RS1 — Node Eviction [HARD]
When `_nodes.size >= MAX_NODES` (1000), the oldest node (by `received_at`) MUST be evicted
before a new heartbeat is accepted. No unbounded node accumulation.

### RS2 — Ledger Compaction [HARD]
When `_ledger.length > MAX_LEDGER_ENTRIES` (10,000), `_compactLedgerIfNeeded()` MUST retain
at least the last entry (for hash chain continuity) and discard older entries. The integrity
of the remaining chain is preserved.

### RS3 — Event Bus Bound [HARD]
The event bus ring buffer is bounded at `MAX_BUS_EVENTS = 5000`. Overflow evicts the oldest.
No unbounded buffer accumulation.

### RS4 — Lineage Buffer Bound [HARD]
Already stated as L4. The lineage buffer is bounded at 2,000 events.

---

## SUMMARY TABLE

| Law | Classification | Enforcement |
|-----|---------------|-------------|
| A1 — Epoch Monotonicity | HARD | Advisory lock + DB increment |
| A2 — Single Threshold Read Path | HARD | Validator check 35 |
| A3 — Lease Holder Assumption | SOFT | Validator checks 38–45 |
| A4 — Clock Authority | HARD | Validator check 73 |
| A5 — Config Change Attribution | HARD | Throws on missing justification |
| F1 — Freeze FAIL_CLOSED | HARD | Try/catch with in-memory fallback |
| F2 — Freeze Epoch Monotonicity | HARD | Validator check 59 |
| F3 — Freeze Read Authority | SOFT | API documentation |
| F4 — No Freeze Bypass Without Override | HARD | evaluatePromotion() check |
| R1 — Replay Side-Effect Prohibition | HARD | Mode flag + caller contract |
| R2 — Clock Monotonicity in Replay | HARD | Caller contract (documented) |
| R3 — ORPHANED_EVENT in Replay | SOFT | LINEAGE_MODES.REPLAY filter |
| R4 — Deterministic ID Stability | HARD | Validator check 55 |
| R5 — Replay Config Snapshot | SOFT | getThresholdSnapshot() API |
| L1 — No Unlineaged Governance Events | SOFT | Validator check 74 |
| L2 — Correlation Chain Integrity | SOFT | STRICT mode anomaly |
| L3 — Authority Epoch in Lineage | SOFT | withLineage() ctx parameter |
| L4 — Lineage Buffer Bound | HARD | MAX_EVENTS = 2000 |
| I1 — Deterministic Incident IDs | HARD | Validator check 78 |
| I2 — Active Incident Bound | HARD | MAX_ACTIVE_INCIDENTS = 500 |
| I3 — Incident Archive | HARD | archiveResolvedIncidents() |
| I4 — Concurrent Transition Safety | HARD | advisory lock + version check |
| O1 — Token Signature Verification | HARD | timingSafeEqual |
| O2 — Role Hierarchy | HARD | ROLE_LEVELS map |
| O3 — JTI Uniqueness | HARD | randomBytes(8) per token |
| O4 — JTI Revocation Check | HARD | Validator check 76 |
| O5 — All Actions Ledgered | SOFT | Validator check 63–68 |
| C1 — Certification Supersedes Review | HARD | CI gate |
| C2 — Validator Checks Are Normative | HARD | 79/79 required |
| C3 — Certification Does Not Self-Certify | HARD | Static analysis only |
| C4 — Certification Level Ceiling | HARD | Level computation |
| RS1 — Node Eviction | HARD | MAX_NODES = 1000 |
| RS2 — Ledger Compaction | HARD | MAX_LEDGER_ENTRIES = 10,000 |
| RS3 — Event Bus Bound | HARD | MAX_BUS_EVENTS = 5000 |
| RS4 — Lineage Buffer Bound | HARD | MAX_EVENTS = 2000 |
