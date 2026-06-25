# PLATFORM_OVERVIEW.md
# Governance Kernel — Platform Overview

**Version:** v1.0
**Effective:** 2026-05-24
**HA Ceiling:** 2-node active/active, shared PostgreSQL primary

---

## What this platform is

The Governance Kernel is a **domain-agnostic operational authority platform**. It provides deterministic, replayable, HA-safe governance primitives that application plugins consume through explicit API classes.

It is NOT a framework. It is NOT a message bus. It is NOT a distributed consensus system.

It is an authority layer — a set of contracts around who can change what, when, with what lineage, under what consistency guarantees.

---

## What it governs

| Concern | Governed by |
|---------|-------------|
| System freeze / unfreeze | FreezeController (LINEARIZED via pg_advisory_xact_lock) |
| Operational incidents | IncidentManager (content-addressed IDs, CACHE_COHERENT + LINEARIZED) |
| Operator authorization | OperatorAuthority (HMAC-SHA256, JTI revocation) |
| Config versioning | ConfigAuthority (hash chain, justification-required) |
| Audit attribution | AuditLedger (append-only hash-chain) |
| Epoch / cluster consensus | AuthorityCoordinator (LINEARIZED increments) |
| Event lineage | LineageEngine (causal chain, anomaly detection) |
| Deterministic time | DeterministicClock (replay clock, wall-clock in LIVE mode) |

---

## Consistency levels

Every state-bearing operation declares one of four consistency levels:

```
MEMORY_ONLY      — volatile, lost on restart
                   Example: in-memory freeze flag, session cache
                   HARD guarantee: none for durability

CACHE_COHERENT   — may be up to STALE_THRESHOLD_MS (120s) stale
                   Example: epoch reads between increments
                   HARD guarantee: eventual consistency within threshold

DB_AUTHORITATIVE — single authoritative DB read
                   Example: freeze state verification, incident queries
                   HARD guarantee: reflects DB state at read time

LINEARIZED       — serialized via pg_advisory_xact_lock
                   Example: epoch increment, strong freeze
                   HARD guarantee: total order across all nodes
```

---

## Replay modes

```
LIVE       — normal operation, wall-clock timestamps, side effects active
REPLAY     — historical event playback, governed clock, side effects suppressed
FORENSIC   — read-only overlay for incident investigation, no state mutation
SIMULATION — what-if execution, isolated state, no persistence
```

---

## System boundaries

```
┌─────────────────────────────────────────────────────────┐
│  Application layer (e.g., OTA plugin runtime, routes)   │
├─────────────────────────────────────────────────────────┤
│  Governance Kernel API layer  (governance-kernel/api/)  │
│    AuthorityCoordinator  FreezeController               │
│    IncidentManager        AuditLedger                   │
│    ConfigAuthority        OperatorAuthority             │
│    LineageEngine           DeterministicClock           │
├─────────────────────────────────────────────────────────┤
│  Governance primitives  (governance-kernel/core/)       │
│    cluster-consensus     audit-ledger                   │
│    incident-manager      config-authority               │
│    session-authority     lineage                        │
│    clock                 deterministic-id               │
├─────────────────────────────────────────────────────────┤
│  Storage (PostgreSQL primary, 2-node active/active)     │
└─────────────────────────────────────────────────────────┘
```

**Hard rule:** Application code and plugins must only import from `governance-kernel/api/`. Direct access to `governance-kernel/core/` is an authority boundary violation.

---

## HA model

**HARD ceiling:** 2-node active/active, shared PostgreSQL primary.

- Both nodes share one DB primary. Writes are serialized via advisory locks.
- No cross-node memory synchronization. Each node maintains independent in-memory state.
- Split-brain is possible between nodes; FREEZE operations force DB consensus.
- Multi-region is NOT IMPLEMENTED and not planned for v1.

---

## What this platform is not

- **Not a message queue.** The event bus is an in-process ring buffer (5000 events).
- **Not a distributed consensus system.** Raft/Paxos are not implemented.
- **Not formally verified.** Invariants are enforced by certification suites, not formal proofs.
- **Not multi-region safe.** Single PostgreSQL primary is the consistency authority.
- **Not AI-autonomous.** All mutations require operator attribution.
