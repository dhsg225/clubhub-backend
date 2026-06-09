# GLOSSARY.md
# Governance Kernel — Platform Glossary

---

## Authority terms

**Authority epoch** — Monotonically increasing integer representing the cluster's consensus generation. LINEARIZED via pg_advisory_xact_lock. Two nodes with the same epoch are in consensus.

**Authority source** — Declared origin of a state value: SNAPSHOT (DB read), EVENT (bus emission), or REPLAY (historical playback). OPTIMISTIC intentionally absent.

**Authority boundary** — The rule that application code accesses governance only through `api/` classes, never `core/` primitives directly.

**FAIL_CLOSED** — DB failure policy: freeze deployment when DB is unreachable. The safest posture for production.

**LINEARIZED** — Consistency level: serialized via pg_advisory_xact_lock. Total order across all cluster nodes. Highest consistency available.

**Split-brain** — Condition where two nodes report divergent authority_epoch or freeze_state. Mutations are blocked until operator resolves.

---

## Replay terms

**lineage_ts** — Wall-clock timestamp attached to events for human audit purposes. Intentionally nondeterministic.

**deterministic_ts** — Governed clock timestamp. In LIVE mode: wall-clock. In REPLAY mode: replay clock (deterministic within session).

**received_at** — Timestamp when a heartbeat or event was received. NOT updated during replay — preserves original staleness profile.

**causal chain** — Lineage metadata connecting an event to its parent event: `{ correlation_id, caused_by, authority_epoch, incident_id }`.

**ForensicView** — Read-only incident investigation surface. Pure function. No side effects, no kernel imports, no DB access.

---

## Lifecycle terms

**RENDERING_MODES** — Operator UI display modes: LIVE, REPLAY, FORENSIC, SIMULATION, STALE, SPLIT_BRAIN, RECONNECTING, SNAPSHOT_LOADING.

**LIFECYCLE_STATES** (OTA runtime) — UNINITIALIZED, BOOTING, RECOVERING, ACTIVE, FROZEN, DEGRADED, REPLAY, SHUTDOWN.

**freeze_epoch** — The epoch value at which the last freeze was committed. Used to detect FREEZE_EPOCH_DIVERGENCE between nodes.

**FREEZE_EPOCH_DIVERGENCE** — Nodes agree on epoch but disagree on freeze_epoch. Lighter than split-brain; mutations not blocked but operators should investigate.

---

## Config terms

**stableStringify** — Deterministic JSON serialization: keys sorted lexicographically, recursive. Produces identical output for identical objects regardless of insertion order.

**hash chain** — Config version history where each version records `previous_config_hash`. Breaks if a version is silently modified.

**config_version** — Sequential integer incremented on each `ConfigAuthority.update()` call.

---

## Operator terms

**JTI** — JWT ID claim. Unique token identifier used for revocation. Stored in DB revocation list.

**requireAuth(role)** — Express middleware factory from OperatorAuthority. Verifies HMAC-SHA256 token and role level. Returns 401 or 403 on failure.

**operator attribution** — The requirement that every mutation records `operator_id`, `justification`, and `action_type` in AuditLedger.

**MAX_ACTIVE_INCIDENTS** — Resource bound: maximum concurrent active incidents (500). Enforced by IncidentManager.

**MAX_SCREENS** — Resource bound: maximum registered screens (1000). Enforced by plugin resource checks.

---

## Certification terms

**HARD guarantee** — An invariant that causes certification FAIL if violated. No exceptions.

**SOFT guarantee** — An invariant that causes WARN or CONDITIONAL if violated. Advisory but documented.

**ADVISORY** — A known gap or limitation. Documented but not enforced by certification. Planned for future versions.

**zero false PASS tolerance** — Certification principle: a check that passes incorrectly is worse than no check.
