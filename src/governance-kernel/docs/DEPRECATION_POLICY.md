# DEPRECATION_POLICY.md
# Governance Kernel v1 — Deprecation and Mutation Governance

**Status:** FROZEN (v1.0.0)
**Effective:** 2026-05-23

---

## 1. Mutation control tiers

Not all kernel changes carry the same risk. Changes are classified by blast radius:

| Tier | Scope | Required process |
|------|-------|-----------------|
| **T0 — Core authority semantics** | Consistency levels, freeze laws, replay contract, lineage laws | Full Governance RFC + certification re-run |
| **T1 — IMMUTABLE API surfaces** | Method signatures, BUS_EVENTS keys, certification format | Governance RFC + v2 version bump |
| **T2 — EVOLVABLE API surfaces** | Optional params, new methods, resource ceiling values | Change notice + certification re-run |
| **T3 — EXPERIMENTAL surfaces** | DSL, observability, adapter implementations | PR description only |
| **T4 — Documentation and comments** | This file, architecture docs | PR description only |

---

## 2. Governance RFC process

Any T0 or T1 change requires a Governance RFC before implementation.

### RFC template

```markdown
# Governance RFC — [title]

**RFC ID:** GRF-YYYY-NNN
**Tier:** T0 | T1
**Author:** [name]
**Date:** YYYY-MM-DD
**Status:** DRAFT | REVIEW | ACCEPTED | REJECTED

## Problem statement
[What governance problem does this solve?]

## Proposed change
[Exact change to API, semantics, or invariant]

## Invariant impact
[Which laws in GOVERNANCE_INVARIANTS.md are affected?]
[Are any laws being weakened? If yes, this RFC is presumptively rejected.]

## Replay impact
[Does this change affect replay semantics? If yes, how is backward compatibility preserved?]

## Certification impact
[Which certification runners are affected?]
[What is the expected certification result after the change?]

## HA impact
[Does this change affect active/active safety? How?]

## Consistency level changes
[Are any operation consistency levels changing? From what to what?]

## Migration path
[How do callers migrate from old behavior to new?]

## Backward compatibility
[What breaks? How long is the deprecation window?]

## Alternatives considered
[What else was considered and why was it rejected?]
```

### RFC acceptance criteria

An RFC is ACCEPTED when all of the following hold:
1. No governance law is weakened (HARD laws cannot be removed, only strengthened)
2. Replay contract backward compatibility is preserved or a migration path is defined
3. Certification re-runs at PASS or CONDITIONAL with the change applied
4. HA ceiling is not reduced below current (2-node active/active)
5. All IMMUTABLE API surfaces retain their documented guarantees

An RFC is AUTOMATICALLY REJECTED if it:
- Removes `timingSafeEqual` from token verification
- Changes freeze default from FAIL_CLOSED
- Removes `_stableStringify` from deterministic ID derivation
- Reduces any resource ceiling (MAX_NODES, MAX_LEDGER_ENTRIES, MAX_ACTIVE_INCIDENTS)
- Removes any INCIDENT_STATES value
- Removes any LINEAGE_MODES value
- Removes any LINEAGE_ANOMALY value
- Removes any check from validate-contracts.js

---

## 3. Deprecation lifecycle

For EVOLVABLE methods that need to be changed:

```
Phase 1 — SOFT DEPRECATION (at least 1 minor version)
  - Old method continues to work
  - New method introduced alongside it
  - JSDoc @deprecated added to old method
  - DEPRECATION_POLICY.md updated with timeline

Phase 2 — HARD DEPRECATION (at least 1 minor version)
  - Old method logs a warning on first call
  - New method is the documented path
  - Migration guide published

Phase 3 — REMOVAL
  - Old method removed
  - Version bump (minor or major depending on tier)
  - Old method name reserved (cannot be reused with different semantics)
```

Minimum deprecation window: **2 minor versions** for T2, **1 major version** for T1.

---

## 4. Mandatory review checklist

Every PR touching `backend/src/governance-kernel/core/` or `backend/src/governance-kernel/api/`
MUST include answers to:

```
□ Which stability tier does this change fall into? (T0–T4)
□ If T0 or T1: Is the Governance RFC written and accepted?
□ Are any GOVERNANCE_INVARIANTS.md laws affected?
□ Are any CONSISTENCY_MODEL.md levels changing?
□ Does the REPLAY_CONTRACT.md remain valid after this change?
□ Did certification re-run? Result: ___/9 PASS, LEVEL: ___
□ Did validate-contracts.js re-run? Result: ___/79 PASS
□ Are any IMMUTABLE API method signatures changing?
□ Are any BUS_EVENTS keys being renamed or removed?
□ Is any resource ceiling being changed?
□ Does the HA ceiling remain at 2-node active/active?
```

---

## 5. Kernel mutation checklist

Before making any change to kernel source:

**Step 1 — Classify**
- Is this T0 (authority semantics), T1 (IMMUTABLE API), T2 (EVOLVABLE), T3 (EXPERIMENTAL), or T4 (docs)?

**Step 2 — RFC (if T0 or T1)**
- Write RFC using template above
- Get RFC accepted before writing any code

**Step 3 — Invariant review**
- Open GOVERNANCE_INVARIANTS.md
- List which laws are touched by this change
- Confirm no HARD law is weakened

**Step 4 — Replay impact review**
- Does the change affect `clock.js`, `lineage.js`, or `core/deterministic-id.js`?
- If yes: would replaying events from before the change produce the same results after?
- If no: a replay compatibility migration is required

**Step 5 — Certification impact review**
- Run `GovernanceCertificationRunner` with the change applied
- Must return PASS or CONDITIONAL (≤ 2 caveats)
- If new FAIL: fix before merge

**Step 6 — HA impact review**
- Does the change affect `core/cluster-consensus.js`, `core/governance-db.js`, or advisory lock paths?
- If yes: verify active/active correctness with the two-instance scenario table from CONSISTENCY_MODEL.md

**Step 7 — OTA validator**
- Run `node test-runner/contracts/validate-contracts.js`
- Must return 79/79 PASS, 0 WARN

**Step 8 — Document**
- Update API_STABILITY_MATRIX.md if method stability classification changes
- Update CONSISTENCY_MODEL.md if consistency levels change
- Update GOVERNANCE_INVARIANTS.md if laws change
- Update this file if process changes

---

## 6. Reserved names

The following identifiers are reserved and cannot be reused with different semantics,
even if the original is removed:

**Consistency levels:** MEMORY_ONLY, CACHE_COHERENT, DB_AUTHORITATIVE, LINEARIZED

**Replay modes:** LIVE, REPLAY, FORENSIC, SIMULATION

**Lineage modes:** STRICT, REPORT, REPLAY

**Lineage anomalies:** ORPHANED_EVENT, BROKEN_CAUSAL_CHAIN, CROSS_INCIDENT_CONTAMINATION,
MISSING_AUTHORITY_CONTEXT, DUPLICATE_CORRELATION

**Incident states:** DETECTED, TRIAGED, MITIGATING, FROZEN, RECOVERING, RESOLVED, POSTMORTEM_REQUIRED

**Freeze policies:** FAIL_CLOSED, FAIL_OPEN, STALE_OK

**Operator roles:** ADMIN, OPERATOR, VIEWER

**BUS_EVENTS namespaces:** governance.kernel.*, governance.authority.*, governance.config.*,
governance.incident.*, governance.operator.*, governance.deployment.*, governance.cluster.*,
governance.plugin.*

**Capability levels:** NONDETERMINISTIC, DETERMINISTIC_PER_DB, CONTENT_ADDRESSED,
NOT_REPLAYABLE, PARTIALLY_REPLAYABLE, FULLY_REPLAYABLE,
ADVISORY, CACHE_COHERENT (plugin level), DB_AUTHORITATIVE (plugin level), LINEARIZED (plugin level),
SINGLE_NODE, ACTIVE_PASSIVE, ACTIVE_ACTIVE_READS, ACTIVE_ACTIVE_WRITES

---

## 7. Current v1 advisory-only gaps (not subject to deprecation — tracked for v2)

These are documented gaps, not deprecated features. They represent paths where the kernel's
governance guarantees are weaker than ideal:

| Gap | Law affected | v2 target |
|-----|-------------|-----------|
| JTI revocation propagation (mid-session) | O4 | Push-based revocation via DB LISTEN/NOTIFY |
| Config update propagation (active/active) | A2 | Periodic re-sync or DB notification |
| Freeze epoch reporting from nodes | F2 | Node-side freeze_epoch heartbeat field |
| Lineage in autonomous-rollout, policy-engine | L1 | Full withLineage() wiring |
| `operator_id = 'system'` for internal actions | O5 | Verifiable system identity |
| Advisory lock in distributed-authority | CERTIFICATION | Reference governance-db explicitly |
| DSL cycle detection | — | Add cycle detection in v1.1+ |
| Multi-domain replay | — | v2 scope |

These gaps are ACCEPTED in v1. They do not require deprecation notices.
They require RFC and implementation work to close, tracked separately.
