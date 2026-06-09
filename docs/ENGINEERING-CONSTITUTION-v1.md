# ENGINEERING-CONSTITUTION-v1.md
# ClubHub TV — Engineering Constitution

**Document type:** Governance constitution — permanent authority layer
**Status:** Ratified — effective immediately upon publication
**Date:** 2026-05-17
**Authority:** Supersedes ad-hoc architectural decisions; is superseded only by an explicit
              constitutional amendment per Section 30.

---

## 0. Normative Language

The key words in this document carry the following precise meanings:

- **MUST** — Absolute requirement. Violation is a defect. No exceptions without amendment.
- **MUST NOT** — Absolute prohibition. Any implementation exhibiting this behavior is non-conformant.
- **SHOULD** — Strong recommendation. Deviation requires explicit documented justification.
- **SHOULD NOT** — Strong discouragement. Deviation requires explicit documented justification.
- **MAY** — Permitted. Not required. No justification needed to omit.
- **SHALL** — Synonym for MUST.
- **SHALL NOT** — Synonym for MUST NOT.

Where this document conflicts with a downstream specification (BACKEND-ARCHITECTURE-v1.md,
PRE-REFERENCE-IMPLEMENTATION-v1.md), this document takes precedence on matters of
philosophy and law; the downstream specification takes precedence on matters of behavioral
detail within its scope.

---

## 1. Purpose of the Constitution

This document is the architectural constitution for the ClubHub TV platform. It defines the
non-negotiable laws, invariants, mutation rules, and operational philosophy that govern all
engineering work on the platform — past, present, and future.

This document is not a coding-style guide. It is not a best-practices memo. It is not a
suggestion list. It is the governing contract that every engineer, every service, every
migration, and every deployment MUST satisfy. It exists because:

1. The platform resolves what content plays on physical screens in public venues. Errors are
   visible to the public and contractually consequential.

2. The Playback Resolution Engine (PRE) is a pure deterministic function. Its purity is the
   platform's most valuable property. That property can be destroyed by a single careless
   side effect.

3. Operational explainability is a contractual obligation to venue operators. An operator
   MUST always be able to answer: "why is that screen showing that content right now?" Any
   architecture that makes this question unanswerable is defective.

4. Auditability is a legal requirement. State mutations that are not auditable are
   violations, not technical debt.

5. Small-team discipline is more important at small scale than at large scale. At large scale,
   institutional gravity enforces correctness. At small scale, a single unreviewed shortcut
   can corrupt the invariants that the entire platform depends on.

Engineers who disagree with a provision of this constitution MUST raise an amendment
proposal per Section 30. They MUST NOT work around provisions unilaterally.

---

## 2. Core Architectural Philosophy

The following principles are the foundation from which all specific rules are derived. When
a specific rule is ambiguous, the correct interpretation is the one most consistent with
these principles.

**2.1 Determinism outranks convenience.**
A solution that is deterministic but harder to implement is always preferred over a solution
that is convenient but introduces non-determinism.

**2.2 Explainability outranks optimization.**
A system that can explain every output is preferred over a system that is faster but opaque.
Performance optimization MUST NOT be achieved at the cost of explainability. If an
optimization cannot be explained by the reason_trace, it MUST NOT be applied to the
resolution path.

**2.3 Visibility outranks automation.**
Surfacing a problem to an operator is always preferred over automatically correcting it.
Automatic correction infers operator intent, which is unauditable. Visibility creates an
audit record; automation destroys one.

**2.4 Correctness outranks availability.**
It is better to serve the System Fallback than to serve an incorrect playlist. Incorrect
content displayed confidently is worse than correct content displayed with a degraded
indicator.

**2.5 Immutability outranks mutability.**
Resolved outputs are computed, not stored as truth. Stored state is input to computation,
not output of it. Caches are acceleration layers, not authorities.

**2.6 Explicit ownership outranks shared ownership.**
Every table, every cache key, every event type, and every API endpoint has exactly one
authoritative owner. Ambiguous ownership is a defect to be resolved, not a design to be
tolerated.

**2.7 Human operators are authoritative over intent.**
No algorithm, heuristic, or automated process may correct, modify, or override operator
configuration without explicit operator confirmation. The system observes; operators decide.

---

## 3. PRE Invariants

The following invariants are absolute requirements of all PRE implementations. Violation of
any invariant constitutes a critical defect that MUST be treated as a P0 incident.

**INV-1: Purity.**
`PRE(screen_id, t, S) = PRE(screen_id, t, S)` always. The PRE MUST NOT produce side
effects. It MUST NOT write to any persistent store, cache, log, or external system. It
MUST NOT modify any input argument. It MUST NOT issue network calls. It MUST NOT read
environment variables, process state, or wall-clock time. The sole sources of external input
are the explicit parameters: `screen_id`, `t`, and the database read-transaction.

**INV-2: Totality.**
For all valid `(screen_id, t)` pairs, the PRE MUST return a PRE_Output. It MUST NOT return
null, undefined, or throw an unhandled exception. If no content is schedulable, the System
Fallback playlist MUST be returned with `is_fallback: true`.

**INV-3: Determinism.**
For identical `(screen_id, t, SystemState)`, the PRE MUST produce bit-identical output
including checksum, version, item ordering, reason_trace, and confidence_score. Random
number generators, UUID generation, and wall-clock reads MUST NOT influence any field in
PRE_Output.

**INV-4: Monotone Versioning.**
Version numbers are monotonically non-decreasing per screen. A version increment occurs if
and only if the checksum changes. The version MUST NOT decrement under any circumstances
including rollback, override clearance, or emergency clearance.

**INV-5: Level Termination.**
If the PRE produces a base_playlist at Level N, all levels above N are not evaluated for
the base_playlist. Level 6 (Device Truth Annotation) is always evaluated regardless of
termination level, and MUST NOT modify the playlist.

**INV-6: No Content Amplification.**
The set of content_ids in the output playlist MUST be a strict subset of content_ids
referenced by active rules in SystemState at time `t`. The PRE MUST NOT introduce content
that has no corresponding active rule.

**INV-7: Emergency Absoluteness.**
An active emergency for a screen's venue MUST suppress all other resolution levels. No
campaign, override, sponsor injection, or structural fallback content MAY appear in a
resolved playlist when an active emergency record exists for that venue.

**INV-8: Sponsorship Non-Penetration.**
Sponsor injection (Level 4) MUST NOT apply when resolution terminates at Level 0 or Level
1. Operational authority supersedes sponsorship obligations at those levels.

**INV-9: Timezone Isolation.**
The PRE MUST evaluate all time-of-day and day-of-week constraints against venue-local time
derived from the venue's configured IANA timezone and the `t` parameter. The process system
timezone MUST NOT be used.

**INV-10: Output Completeness.**
Every item in the output playlist MUST have a corresponding entry in `reason_trace`. The
`reason_trace` MUST be sufficient for a human operator to reconstruct exactly why each item
is present, without access to any system other than the PRE_Output itself.

---

## 4. Manifest Resolution Authority Rules

**4.1** The PRE is the sole authority for manifest resolution. There MUST NOT be a second
resolution path, a parallel resolution path, or a fallback resolution path that applies
different logic.

**4.2** The Manifest Delivery System MUST call `PRE.resolve()` as its sole mechanism for
computing a manifest. It MUST NOT contain scheduling logic, override logic, or content
selection logic.

**4.3** No service other than the Manifest Delivery System MAY call `PRE.resolve()` in the
serving path. The Preview Service MAY call `PRE.resolve()` for read-only explainability
purposes. All such calls MUST include `preview: true` in their response and MUST NOT affect
any cache, version counter, or delivery log.

**4.4** The checksum algorithm is FNV-1a 32-bit applied to the canonical serialization of
the playlist. This algorithm MUST NOT be changed after Phase 5 (proof-of-play dependency).
Any proposed change requires a constitutional amendment and a full proof-of-play migration
plan.

**4.5** The version counter for each screen MUST be the monotonic source of truth for cache
invalidation. Version counters MUST NOT be reset, re-seeded from external state, or
reconciled across replicas. The `screen_versions` table is the authoritative store.

**4.6** The legacy manifest engine MAY continue to operate under the `PRE_ENABLED=false`
feature flag during transition. Once the Phase 5 acceptance gate passes, the legacy engine
MUST be removed. Both engines MUST NOT serve different screens simultaneously in production
without the `screens.pre_enabled` per-screen column controlling which engine serves each
screen.

**4.7** Shadow mode (`PRE_SHADOW_MODE=true`) MUST serve legacy engine output to screens.
It MUST log divergences but MUST NOT act on them. A shadow-mode divergence is observational
data, not a defect to be auto-corrected.

---

## 5. State Mutation Rules

**5.1** All mutations to authoritative state MUST go through the owning service. Bypass of
service ownership (e.g., direct SQL UPDATE to a table owned by another service from
migration code or a background job) MUST NOT occur.

**5.2** Every state mutation that affects the scheduling, override, emergency, or
sponsorship tables MUST emit an audit event before (or atomically with) the transaction
commit. A mutation that succeeds without an audit record is a defect.

**5.3** Mutations MUST be idempotent where technically feasible. Background jobs, retry
logic, and OTA delivery callbacks MUST use idempotency keys or conditional writes to
prevent duplicate mutations.

**5.4** Bulk mutations (affecting more than one screen, area, or venue in a single
operation) MUST be wrapped in a single database transaction. Partial success of a bulk
mutation is not permitted.

**5.5** No service MAY mutate state owned by another service except through that service's
published API. Cross-service SQL writes are forbidden regardless of operational urgency.
Operational urgency is addressed through break-glass procedures defined in RUNBOOK, not by
bypassing service boundaries.

**5.6** State mutations triggered by a screen poll response are forbidden. The screen poll
path (GET /api/manifest/:screenId) is a read-only path. Any mutation that a poll triggers
(e.g., updating `last_seen_at`, incrementing delivery counters) MUST be deferred to an
async write path that cannot affect the poll response latency or transactional correctness.

---

## 6. Transactional Integrity Rules

**6.1** All business-meaningful state changes MUST be wrapped in a database transaction.
"Business-meaningful" means: any change that, if partially applied, would leave the system
in a state that is inconsistent from the perspective of a human operator or the PRE.

**6.2** Transactions MUST be as short as possible. Network calls, external API calls, file
I/O, and unbounded loops MUST NOT occur inside a database transaction.

**6.3** Long-running transactions that hold row locks on the `schedules`, `overrides`, or
`emergency_states` tables are a P1 incident. These tables are on the PRE read path. Lock
contention on these tables degrades manifest resolution for all screens.

**6.4** Optimistic concurrency (compare-and-swap via version columns) MUST be used for
concurrent mutations to the same entity. Pessimistic locking (SELECT FOR UPDATE) MAY be
used only when optimistic concurrency is demonstrably insufficient and the lock duration is
bounded.

**6.5** Transactions MUST NOT be used to enforce uniqueness invariants that a database
constraint can enforce. Database constraints are preferred over application-layer transaction
logic for schema-level uniqueness.

**6.6** Any migration that cannot run inside a transaction (e.g., `CREATE INDEX
CONCURRENTLY`) MUST be isolated in its own migration file, flagged explicitly as
non-transactional, and run manually in a separate deployment step. It MUST NOT be bundled
with transactional migrations.

---

## 7. Cache Philosophy

**7.1** Caches are acceleration layers. They MUST NOT be the authoritative source of truth
for any piece of state. If the cache and the database disagree, the database is correct.

**7.2** The manifest cache is a computed artifact of PRE resolution. It is valid only for
the `valid_until` timestamp in the PRE_Output. Cached manifests MUST NOT be served past
their validity window without re-verification.

**7.3** Cache invalidation MUST be driven by version counters, not by time. A version
counter change invalidates the cache for the affected screen unconditionally. TTL-based
invalidation is a safety backstop, not the primary invalidation mechanism.

**7.4** Cache keys MUST be deterministic functions of their inputs. A cache key MUST NOT
incorporate wall-clock time, process ID, or any non-deterministic value.

**7.5** The cache MUST NOT be promoted to an authority under failure conditions. If the
cache cannot be verified (database unreachable), the cached result MAY be served with a
degraded indicator in the manifest metadata. It MUST NOT be served as a fully-authoritative
result.

**7.6** Background cache warming (pre-computing manifests before they are requested) is
permitted. Cache warming MUST use `PRE.resolve()` through the identical code path as live
resolution. It MUST NOT use a simplified or partial resolution path.

**7.7** No cache layer MAY exist between PRE inputs and PRE computation. The database
read-transaction passed to `PRE.resolve()` MUST reflect committed state at the time of the
call. Query result caching (connection pooler caches, ORM query caches) MUST NOT be used
for tables on the PRE read path.

---

## 8. Service Boundary Rules

**8.1** The platform's service boundaries are defined in BACKEND-ARCHITECTURE-v1.md. These
boundaries MUST be respected by all code. A service boundary is not a suggestion; it is an
ownership contract.

**8.2** Services communicate through published API contracts. A service's internal
implementation details (internal helper functions, intermediate data structures, private
table columns) are not part of its contract and MUST NOT be depended upon by other services.

**8.3** The authoritative table ownership mapping is:

| Service              | Owns (authoritative write authority)                            |
|----------------------|-----------------------------------------------------------------|
| Scheduling Service   | campaigns, campaign_content_items, campaign_schedules, schedules|
| Emergency Service    | emergency_states                                                |
| Override Service     | overrides                                                       |
| Sponsorship Engine   | sponsorship_contracts                                           |
| Device Management    | screens, screen_versions, areas, tv_groups                      |
| OTA Service          | ota_deployments, ota_ring_assignments                           |
| Audit Service        | audit_events (append-only)                                      |
| PRE                  | Nothing (read-only consumer of all the above)                   |

No service MAY write to a table it does not own. No service MAY read a table in a way that
creates an undocumented dependency on another service's internal schema.

**8.4** The PRE owns no tables. It MUST NOT acquire write authority over any table. Any
proposal to give the PRE write access to a table MUST be treated as a constitution violation
proposal and handled via Section 30.

**8.5** Future service extraction (modular monolith to microservices) MUST use the
boundaries defined here. Adding new cross-service dependencies that are not present in the
current boundary model requires a constitutional amendment.

---

## 9. Audit Log Requirements

**9.1** An audit event MUST be emitted for every operator-initiated state mutation. The
definition of "operator-initiated" includes: all requests through the Operator API Gateway,
all background jobs initiated by operator action, and all automated processes that act on
operator configuration.

**9.2** Every audit event MUST contain: `event_id` (UUID), `event_type` (namespaced
string), `actor_id` (user or service identifier), `target_type`, `target_id`,
`occurred_at` (UTC milliseconds), `payload` (full before/after state or delta), and
`request_id` (from the originating HTTP request, if applicable).

**9.3** The audit log MUST be append-only. Audit records MUST NOT be updated, soft-deleted,
or hard-deleted. Archival to cold storage is permitted; deletion from any storage tier is
not.

**9.4** Audit writes MUST be atomic with the state mutation they record. A pattern of
"mutate first, then audit" is a defect. The correct pattern is: include the audit write in
the same transaction as the mutation, or use an outbox pattern that guarantees exactly-once
delivery.

**9.5** Audit events for emergency activations and deactivations MUST be treated as
priority-1 events. They MUST NOT be queued behind non-emergency audit events. In-memory
queueing of emergency audit events is forbidden; they MUST be written synchronously within
the request lifecycle.

**9.6** The audit log MUST be queryable by `target_id` and `event_type` within a time
range. An operator MUST be able to retrieve the full audit history for any screen, area,
venue, campaign, or override within O(log n) time on the `occurred_at` index.

---

## 10. Event Bus Requirements

**10.1** Events on the internal event bus MUST use namespaced dot-notation identifiers.
The namespace prefix MUST match the emitting service. Example: `campaign.published`,
`emergency.activated`, `screen.discovered`, `ota.ring_promoted`.

**10.2** Events MUST be immutable after emission. An event describes what happened; it does
not prescribe what should happen next. Consumers are free to ignore any event.

**10.3** Events MUST contain sufficient context for a consumer to act without querying the
database. An event that says "something changed, please look it up" is a notification, not
an event. Notifications are permitted for low-frequency, low-criticality concerns; they MUST
NOT be used for scheduling, emergency, or override events.

**10.4** The event bus MUST NOT be used for synchronous request-response patterns. If a
caller needs a response, it uses a direct API call. The event bus is for fire-and-forget
side effects (cache invalidation, audit emission, metric collection, notification).

**10.5** At-least-once delivery is the required guarantee. Consumers MUST be idempotent.
Exactly-once delivery is not required and SHOULD NOT be assumed.

**10.6** Cache invalidation events MUST be emitted within the same transaction that commits
the state change causing the invalidation, using an outbox pattern. A committed state change
that does not eventually produce a cache invalidation event is a defect.

---

## 11. Forbidden Patterns

The following patterns are categorically forbidden. No business justification, time
pressure, or operational emergency overrides these prohibitions.

**FP-01: Duplicate Resolution Logic.**
Resolution logic (the determination of what a screen displays at a given time) MUST reside
exclusively in the PRE. Any code outside the PRE that implements a partial, simplified, or
approximate version of the resolution algorithm is forbidden. This includes: frontend
playlist simulation, "fast-path" manifest shortcuts in API handlers, cache population logic
that infers content from schedule data, and background jobs that precompute playlists using
custom query logic.

**FP-02: Side Effects in the PRE.**
The PRE MUST NOT write to any store, emit any event, update any counter, or produce any
observable external effect. Any function called from within `PRE.resolve()` that produces
a side effect is forbidden.

**FP-03: Direct Cross-Service Table Access.**
A service MUST NOT write to a table owned by another service. A service MUST NOT depend on
the internal schema of another service's tables for correctness. Only published contract
outputs (API responses, event payloads) are valid cross-service data sources.

**FP-04: Mutation on the Poll Path.**
The manifest poll path (GET /api/manifest/:screenId) MUST NOT perform synchronous database
writes. It MUST NOT update any row in any table as part of producing the manifest response.
Delivery logging, last-seen-at updates, and analytics counters MUST be deferred to
asynchronous write paths.

**FP-05: Unadited State Mutation.**
Any state mutation in the scheduling, override, emergency, sponsorship, or device tables
that does not produce a corresponding audit record is forbidden. This applies to API
handlers, background jobs, migrations, and manual database operations.

**FP-06: Automatic Corrective Behavior.**
The system MUST NOT automatically correct, normalize, rebalance, or repair operator
configuration. Detecting a misconfiguration and surfacing it to the operator is permitted
and encouraged. Acting on that detection without explicit operator confirmation is forbidden.

**FP-07: Hardcoded Threshold Values in Logic.**
Numeric threshold values (latency limits, success rate minimums, recovery time maxima,
share-of-voice limits) MUST NOT be embedded as literals in application logic, test
assertions, or resolution code. They MUST reside in authoritative configuration sources
(`thresholds.json` for CI, database records for runtime) and be injected at the point of
use.

**FP-08: Non-Transactional Bulk Mutation.**
A bulk mutation (affecting multiple entities) that is not wrapped in a single transaction
is forbidden. A bulk mutation that can succeed for some entities and fail for others, leaving
the system in a partially-applied state, is forbidden.

**FP-09: Version Counter Reset.**
Version counters for screens MUST NOT be reset, re-seeded, or reconciled to a lower value.
Version numbers that have been delivered to a screen are permanent. A rollback of content
does not roll back the version counter.

**FP-10: Timezone Ambiguity.**
Code that uses the process system timezone to evaluate scheduling constraints is forbidden.
All temporal evaluations MUST use the venue's configured IANA timezone and the explicit
timestamp parameter. `new Date()`, `Date.now()`, and `new Date().toLocaleDateString()` are
forbidden inside any function in the resolution path.

**FP-11: Nullable Emergency Override.**
Logic that silently ignores or swallows an active emergency record (treats an emergency as
absent when it is present) is forbidden. An active emergency MUST unconditionally terminate
resolution at Level 0.

**FP-12: Speculative Schema Reads.**
Reading columns that may not exist (using `IF EXISTS`-style logic or `try/catch` on column
access) is forbidden in production code paths. Schema changes are coordinated through
migration files. Runtime schema speculation indicates a migration sequencing defect.

**FP-13: Implicit Service Ordering.**
Background jobs or event handlers that assume a specific ordering of events from different
services without an explicit synchronization mechanism are forbidden. Inter-service ordering
guarantees MUST be explicit, not assumed.

**FP-14: Frontend Playback Authority.**
Frontend clients (browser player, Pi appliance player) MUST NOT implement playlist
resolution, content selection, or schedule evaluation logic. They are manifest consumers,
not resolvers. A frontend that decides what to play based on local schedule data is a
forbidden autonomous resolver.

**FP-15: Unversioned Cache Invalidation.**
Cache invalidation driven by time alone (TTL without a version check) is forbidden for
manifest caches. A manifest cache entry MUST be validated against the current version
counter before serving, regardless of its age. TTL is a safety backstop, not a replacement
for version-driven invalidation.

---

## 12. Operational Philosophy

**12.1** The platform exists to serve venue operators. Every architectural decision MUST be
evaluated against the question: "Does this make it easier or harder for an operator to
understand what the platform is doing?"

**12.2** Complexity is a liability, not an asset. No feature MAY be added to the resolution
path unless it is required for correctness or contractually required by operator agreement.
Optional enhancements to resolution belong in operator configuration, not in the PRE.

**12.3** Failures MUST be visible, not silent. A screen that is failing to resolve content
MUST produce observable signals (error metrics, audit events, health endpoint degradation)
that are detectable without looking at the screen. Silent degradation — the screen appears
functional but is serving incorrect content — is the worst failure mode and MUST be
prioritized for detection above all other failure modes.

**12.4** Operational documentation is part of the system, not supplementary to it. An
API endpoint without operational runbook documentation is incomplete. A migration without a
rollback procedure is incomplete. A new feature without observable health signals is
incomplete.

**12.5** On-call engineers MUST be able to diagnose any P1 incident without access to
proprietary tooling, internal dashboards, or tribal knowledge. All diagnostic information
MUST be derivable from: the audit log, structured application logs, the health endpoint
responses, and the PRE Preview endpoint. If diagnosis requires more than these four sources,
the observability is insufficient.

---

## 13. Visibility vs. Automation

**13.1** When the system detects a condition that is operationally significant (misconfigured
schedule, orphaned override, saturation warning, desync between PRE expected and screen
reported), the REQUIRED response is to surface that condition through an observable signal.
The FORBIDDEN response is to automatically correct it.

**13.2** The observable signal hierarchy is:

1. Structured log entry (always required; zero operator visibility in real-time but
   queryable)
2. Metric increment (counter, gauge, or histogram; dashboard-visible)
3. Advisory in the entropy score model (periodic; visible in operator dashboard)
4. Tier 1 inline advisory (visible during related operator workflows)
5. Tier 2 noticed advisory (persistent dismissible notification)
6. Tier 3 confirmation gate (blocking confirmation prompt — the maximum permitted friction)

**13.3** No enforcement level above Tier 3 (blocking confirmation gate) is permitted. An
operator MUST always be able to proceed after acknowledging the confirmation. The system
MUST NOT refuse an operator action on the grounds that the action is inadvisable.

**13.4** Automated actions taken without operator confirmation are limited to:
- Cache invalidation in response to a verified version change
- Metric collection and aggregation
- Audit log writes
- Health endpoint state updates
- OTA ring promotion/rollback with explicit operator-configured thresholds (these are
  operator-delegated automation, not autonomous system decisions)

All other automated actions MUST have an explicit operator-delegated rule that was
previously confirmed by an operator.

**13.5** The Entropy Score (defined in OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md) is an
observability instrument. It MUST NOT trigger automated corrective behavior at any score
level. A score of 100 is a signal, not an authorization.

---

## 14. Determinism Requirements

**14.1** The system's determinism guarantee is: for any screen, at any point in time, given
the SystemState that was committed at that time, the output of the PRE is knowable without
running the PRE. This requires that SystemState be recoverable from the audit log.

**14.2** All content item ordering within a playlist level MUST use Smooth Weighted Round
Robin (SWRR) as the canonical interleaving algorithm. SWRR MUST be the only weighted
interleaving algorithm in the codebase. Alternatives (random selection, simple modulo,
hash-based distribution) MUST NOT be used for playlist construction.

**14.3** Tie-breaking in specificity comparisons MUST use a deterministic tiebreaker. The
canonical tiebreaker is lexicographic ascending order on `rule_id`. This tiebreaker MUST be
applied consistently; it MUST NOT be omitted on the grounds that ties are "rare in
practice."

**14.4** The checksum MUST be computed from the canonical serialization of the playlist.
Canonical serialization means: content items in SWRR order, item fields in defined sort
order, no extraneous fields, no locale-dependent encoding. The canonical serialization
algorithm MUST be documented and versioned. A change to the serialization algorithm
constitutes a breaking change and requires a constitutional amendment.

**14.5** Any function that is called from within the PRE and whose output can vary between
calls with identical inputs (i.e., any function that reads wall-clock time, generates
random values, reads environment state, or has non-deterministic external dependencies)
MUST NOT be called from within the PRE.

---

## 15. Replayability Requirements

**15.1** It MUST be possible to replay the PRE computation for any screen at any past
timestamp, given the SystemState that was active at that timestamp. This requires that the
audit log contain sufficient information to reconstruct SystemState at any point in the
audit history.

**15.2** The audit log MUST record full before/after state deltas for all mutations to
tables in the PRE's read set: `screens`, `areas`, `tv_groups`, `venues`, `organizations`,
`schedules`, `campaigns`, `campaign_schedules`, `overrides`, `emergency_states`,
`sponsorship_contracts`.

**15.3** A replay function `replayPRE(screen_id, at, audit_log)` MUST be maintainable. It
need not be a production-serving code path, but it MUST exist as a verification tool and
MUST produce output that agrees with the live PRE for the same inputs. Divergence between
replay output and live output indicates an audit log completeness defect.

**15.4** Point-in-time recovery of SystemState MUST be achievable from the audit log within
a 90-day retention window. The audit log MUST be retained for a minimum of 90 days in
queryable form and 365 days in archival form.

**15.5** The proof-of-play system MUST be grounded in PRE replayability. A proof-of-play
claim is only as strong as the ability to recompute what the PRE would have resolved at that
moment. Proof-of-play reports that cannot be verified against PRE replay output are
inadmissible.

---

## 16. Concurrency Rules

**16.1** The manifest delivery path MUST be safe for concurrent execution by any number of
goroutines/worker threads. `PRE.resolve()` MUST be re-entrant. It MUST NOT use shared
mutable state.

**16.2** Version counter increments MUST use compare-and-swap semantics (e.g.,
`UPDATE screen_versions SET version = version + 1 WHERE screen_id = $1 AND version = $2`).
Unconditional increments MUST NOT be used where concurrent increment is possible.

**16.3** The emergency activation path MUST be safe for concurrent activation and
deactivation. Two simultaneous emergency activations for the same venue MUST be serializable
by the database. The outcome MUST be deterministic (last-writer-wins on `activated_at`).

**16.4** Cache invalidation MUST be safe for concurrent invocation. A cache invalidation
triggered by a version N commit MUST NOT interfere with a cache invalidation triggered by a
version N+1 commit that arrives before N's invalidation completes.

**16.5** Background jobs that operate on overlapping screen sets MUST use advisory locks or
work-queue exclusion to prevent concurrent execution. Concurrent background jobs MUST NOT
write conflicting values to the same row.

---

## 17. Failure Handling Philosophy

**17.1** Failures MUST be classified before they are handled. The classification determines
the response:

| Class        | Definition                                              | Response                               |
|--------------|---------------------------------------------------------|----------------------------------------|
| Transient    | Likely to resolve without intervention (DB hiccup,      | Retry with backoff; log at WARN level  |
|              | network blip, lock timeout)                             |                                        |
| Permanent    | Will not resolve without intervention (schema defect,   | Fail fast; alert; do not retry         |
|              | invariant violation, config error)                      |                                        |
| Degraded     | Partial function available (cache stale, replica lag,   | Serve degraded with explicit indicator |
|              | non-critical dependency down)                           |                                        |
| Fatal        | Core function unavailable (DB down, PRE throws,         | Serve System Fallback; alert P0        |
|              | emergency system unreachable)                           |                                        |

**17.2** Retries MUST use exponential backoff with jitter. A fixed-delay retry loop is
forbidden. Maximum retry counts MUST be bounded and logged.

**17.3** The System Fallback MUST be available without any database access. It MUST be
compiled into the application binary. It MUST NOT require a network call, a file read, or
any external system to produce.

**17.4** Error messages in API responses MUST be operator-actionable. They MUST describe
what is wrong and what the operator can do about it. They MUST NOT expose internal stack
traces, SQL query text, or database error codes to API clients.

**17.5** A failure in a non-critical path (analytics ingestion, proof-of-play write, audit
log write to secondary store) MUST NOT fail the request that triggered it. Non-critical
path failures MUST be logged and metriced. They MUST NOT cause user-visible errors.

**17.6** Circuit breakers SHOULD be applied to all dependencies of the manifest delivery
path. A tripped circuit breaker MUST cause the manifest delivery system to serve the cached
manifest (with degraded indicator) or the System Fallback. It MUST NOT cause a 500 error
to the polling screen.

---

## 18. Database Integrity Rules

**18.1** Schema constraints are the first line of defense for data integrity. `NOT NULL`,
`CHECK`, `FOREIGN KEY`, and `UNIQUE` constraints MUST be used wherever the schema semantics
require them. Application-layer constraint enforcement is a complement to schema
constraints, not a substitute.

**18.2** Foreign key constraints MUST be enforced for all relationships between tables in
the PRE read set. Orphaned rows (schedules referencing non-existent venues, overrides
referencing non-existent screens) are a PRE correctness risk.

**18.3** Soft delete MUST NOT be used for tables in the PRE read set unless the `deleted_at`
column is indexed and all PRE queries include a `WHERE deleted_at IS NULL` clause. The
preferred pattern for deactivating records is a `status` column with a `CHECK` constraint.
Soft-deleted rows that the PRE silently includes in resolution are a critical defect.

**18.4** The `emergency_states` table MUST use database-level uniqueness constraints to
enforce at-most-one active emergency per venue. Application-layer deduplication is
insufficient.

**18.5** Timestamp columns MUST use `TIMESTAMPTZ` (timezone-aware). `TIMESTAMP WITHOUT TIME
ZONE` is forbidden for any column that stores an absolute moment in time. Relative durations
MUST be stored in milliseconds as integers, not as intervals.

**18.6** No column that is part of a PRE query predicate MUST be nullable unless the null
case has explicit PRE semantics. Nullable columns in `WHERE` clauses introduce three-valued
logic that must be explicitly handled.

---

## 19. Migration Safety Rules

**19.1** All migrations are irreversible once applied to production. Migration files MUST be
treated as permanent, immutable artifacts. Editing a migration file after it has been run
on any shared environment is forbidden.

**19.2** Migrations MUST be additive before they are subtractive. The safe sequence for
removing a column is: (a) stop reading the column in application code; (b) deploy; (c)
confirm deployment; (d) add a migration that drops the column. Steps (a–c) and (d) MUST be
in separate deployments separated by at least one release cycle.

**19.3** Migrations that affect tables in the PRE read set MUST be reviewed against all PRE
query paths before deployment. A migration that makes an existing PRE query incorrect is
a P0 risk.

**19.4** `DROP TABLE`, `DROP COLUMN`, and `TRUNCATE` statements MUST NOT appear in
migrations that run automatically during deployment. They MUST be executed manually with
explicit confirmation.

**19.5** Every migration file MUST include a rollback procedure in a comment block at the
top of the file. The rollback procedure MUST specify: whether rollback is possible, and if
so, the exact SQL to execute. If rollback is not possible (e.g., destructive data removal),
the comment MUST state that explicitly.

**19.6** Index creation on large tables MUST use `CREATE INDEX CONCURRENTLY`. Non-concurrent
index creation on tables with live traffic is forbidden.

**19.7** Migration numbering is permanent. `migrate_003.sql` is always `migrate_003.sql`.
Renumbering migrations is forbidden. Inserting a migration between two existing migrations
requires a decimal identifier (e.g., `migrate_003b.sql`).

---

## 20. Backward Compatibility Rules

**20.1** The manifest endpoint (`GET /api/manifest/:screenId`) response contract MUST NOT
change in a breaking way. Breaking changes include: removing fields, changing field types,
changing the meaning of existing fields, or changing error response shapes. Non-breaking
additions (new optional fields) MAY be made.

**20.2** A deployed screen MUST be able to continue operating on its current firmware for a
minimum of 6 months after an API change is announced. Deprecation windows shorter than 6
months require explicit operator consent from all affected venues.

**20.3** Feature flags MUST be used for all changes to the manifest response format until
the new format has been validated in production. The flag MUST default to the old behavior.

**20.4** Any change to the checksum algorithm requires: a constitutional amendment, an
explicit migration of all existing cached checksums, a proof-of-play audit to identify
any reports that reference old-format checksums, and operator notification.

**20.5** The system MUST support simultaneous operation of screens running both legacy
(pre-PRE) and PRE-enabled manifests until the Phase 6 acceptance gate passes. The `screens.pre_enabled` column is the authoritative routing signal.

**20.6** Public API versioning MUST use URL path versioning (`/api/v1/`, `/api/v2/`). Header
versioning and query parameter versioning MUST NOT be used as the primary versioning
mechanism.

---

## 21. Preview and Explainability Requirements

**21.1** Every resolution output MUST be explainable to a human operator without source code
access. The `reason_trace` in the PRE_Output MUST be sufficient for this purpose.

**21.2** The PRE Preview endpoint (`GET /api/preview/screen/:screen_id`) MUST be available
in all environments. It MUST call `PRE.resolve()` against live database state. It MUST
return the full `reason_trace`. It MUST NOT produce side effects.

**21.3** Preview endpoint responses MUST include `preview: true` to prevent them from being
treated as authoritative manifest responses by any consumer.

**21.4** The Preview endpoint SHOULD accept an optional `?at=` query parameter to resolve
for a future or past timestamp. When `at` is in the past, the result is informational (live
SystemState, not historical SystemState). When `at` is in the future, the result is a
forecast (live SystemState with time advanced).

**21.5** The divergence advisory (`divergence_advisory` field in preview response) MUST be
computed for every preview call. It MUST compare the full-resolution output against a
baseline computed without active overrides. An operator MUST be able to see what the screen
would show without any active overrides, without making a separate API call.

**21.6** The reason_trace MUST use human-readable natural language, not internal field names
or database identifiers alone. An example of a conformant reason_trace entry:
`"Level 2 Operational Override 'Happy Hour Menu' (id: ov-4421, set by user jsmith@venue)
active until 19:00 venue time — suppresses Level 3 campaign content."`

An example of a non-conformant reason_trace entry: `"L2_OP_OVERRIDE ov-4421 terminal"`.

---

## 22. Frontend Authority Restrictions

**22.1** Frontend clients (browser admin interface, Pi appliance player, future mobile apps)
are manifest consumers. They MUST NOT implement content selection, schedule evaluation, or
playlist resolution logic.

**22.2** The Pi appliance player MUST treat the manifest as the authoritative instruction
set. It MUST NOT reorder playlist items, skip items based on local logic, or supplement the
playlist with locally-cached content that was not included in the most recent manifest.

**22.3** Exception: when the screen cannot reach the backend (network outage), the Pi
appliance MAY continue playing the most recently received manifest. This is an availability
continuation, not resolution logic. The appliance MUST NOT modify the playlist content
during this continuation.

**22.4** The browser admin interface MUST NOT display a simulated preview of what a screen
will show at a future time using client-side logic. Future-state previews MUST call the
Preview endpoint. The frontend is a display layer for server-computed previews, not a
resolver.

**22.5** No frontend client MAY modify the `version` or `checksum` field of a received
manifest. These are read-only delivery metadata. A frontend that sends a modified version
or checksum in a delivery acknowledgment is producing incorrect proof-of-play data.

---

## 23. Emergency System Rules

**23.1** The emergency activation and deactivation path MUST have the lowest latency of any
operator-initiated state change in the system. It MUST NOT be queued behind non-emergency
operations. An emergency activation MUST be committed and cache-invalidating within 5 seconds
of operator confirmation in all non-degraded system states.

**23.2** Emergency state MUST be represented as a database record with an explicit
`activated_at` and `deactivated_at` (nullable). A NULL `deactivated_at` means the emergency
is active. The active/inactive state MUST NOT be inferred from any other field.

**23.3** Emergency content MAY be absent (the `content_id` field MAY be null). When absent,
the System Fallback is displayed. The System Fallback MUST be acceptable for display during
any emergency condition the operator may activate.

**23.4** The PRE MUST evaluate `emergency_states` first, before any other resolution level.
No optimization (caching, early return, speculative execution) MAY cause the PRE to skip
the emergency check.

**23.5** Emergency records MUST NOT be deleted. They MUST be deactivated by setting
`deactivated_at`. The full history of emergency activations is part of the audit record.

**23.6** Emergency scope MUST be venue-level. Screen-level or area-level emergency
overrides are not supported. A proposal to add sub-venue emergency scope requires a
constitutional amendment that addresses INV-8 compatibility.

---

## 24. Override Governance Rules

**24.1** All overrides MUST have an explicit `expires_at` timestamp. Overrides without
expiry are forbidden. The maximum override duration is defined by operator configuration and
MUST be enforced at the service layer, not the PRE layer.

**24.2** The Override Service MUST log the creating operator's identity, the creation time,
the target scope, the content being shown, and the expiry time in the audit record.

**24.3** Override conflicts (two overrides with overlapping scope and overlapping time window
at the same specificity level) MUST be detected at creation time. A blocking conflict MUST
prevent the override from being created. A non-blocking conflict MUST produce a warning
that the operator must acknowledge.

**24.4** Operational overrides (Level 1) take precedence over Scheduled overrides (Level 2).
This ordering is constitutionally fixed. A change to this ordering requires a constitutional
amendment.

**24.5** Overrides targeting a screen MUST verify that the screen exists and is active
before the override is created. An override targeting a non-existent or decommissioned
screen MUST be rejected.

**24.6** Bulk override creation (applying the same override to all screens in an area or
venue) MUST be an atomic operation. Partial application is not permitted. If the bulk
creation fails, all created overrides in that batch MUST be rolled back.

---

## 25. Testing Requirements

**25.1** The PRE MUST have a test suite with 100% branch coverage of the resolution
algorithm. Any change to the PRE MUST maintain this coverage. A PR that reduces PRE branch
coverage MUST NOT be merged.

**25.2** The PRE test suite MUST use fully deterministic, pre-fixture SystemState inputs.
No test MUST use live database state or generate random fixtures. Fixtures MUST be committed
to the repository and reviewed as carefully as production code.

**25.3** All PRE invariants (INV-1 through INV-10) MUST have corresponding test cases that
verify the invariant holds. Invariant tests MUST be in a separate test file from behavioral
tests.

**25.4** The chaos test suite (suites/chaos.js) MUST remain passing on the main branch.
Any PR that causes a chaos test to fail MUST NOT be merged until the failure is resolved or
the test is explicitly amended (with documented justification).

**25.5** Contract enforcement checks (`validate-contracts.js`) MUST pass before any PR is
merged. Hidden threshold violations MUST be treated as merge-blocking defects.

**25.6** Migrations MUST be tested against a real PostgreSQL instance (not an in-memory
substitute) before deployment. Migration tests MUST verify that: (a) the migration applies
cleanly to an empty database, (b) the migration applies cleanly to a database with
representative existing data, (c) all PRE queries return valid results after the migration.

**25.7** Performance benchmarks for the manifest delivery path MUST be run before any
change to the PRE or Manifest Delivery System is merged. Regressions exceeding 10% in p95
latency MUST be investigated and justified before merge.

---

## 26. Performance Constraints

**26.1** The manifest delivery path (screen poll → PRE resolution → cache check → response)
MUST complete within 500ms at p95 under nominal load. This threshold is constitutionally
fixed. A change to this threshold requires a constitutional amendment with a supporting
performance analysis.

**26.2** `PRE.resolve()` itself MUST complete within 200ms at p95. The remaining 300ms
budget is allocated to network, cache, and delivery overhead.

**26.3** The emergency activation path MUST complete within 5 seconds at p99. This includes
database write, cache invalidation, and all audit record emissions.

**26.4** No synchronous operation on the manifest poll path MAY hold a database lock for
more than 50ms. Lock contention exceeding this threshold is a P1 incident.

**26.5** The system MUST sustain 500 concurrent screen polls per second per application
instance without degradation of the p95 latency budget. This defines the minimum horizontal
scaling unit.

**26.6** Performance budgets are enforced by the CI chaos and stress test suites. A
deployment that passes all functional tests but fails performance thresholds MUST NOT be
promoted to production.

---

## 27. Extraction/Scaling Rules

**27.1** The current architecture is a modular monolith. Service extraction to separate
network processes MUST NOT be performed until a specific service is demonstrably constrained
by its co-location with other services (CPU contention, independent scaling requirement,
deployment frequency conflict).

**27.2** When a service is extracted, its module boundary as defined in Section 8 becomes
a network boundary. No additional logic MUST be added to the service during extraction.
Extraction is a structural change, not a feature opportunity.

**27.3** The PRE MUST be extractable as a standalone service without modification to its
implementation. The PRE's dependence on a database connection (rather than pre-fetched state
objects) means extraction requires a state-serving proxy. This proxy MUST be designed during
the extraction planning, not as an afterthought.

**27.4** Database extraction (read replicas, sharding) MUST NOT be introduced until the
write load or read load exceeds the capacity of a single PostgreSQL instance at the
configured hardware tier. Premature database decomposition adds complexity without benefit.

**27.5** If a replica is introduced for the PRE read path, replication lag MUST be
monitored and bounded. The PRE MUST NOT read from a replica whose lag exceeds the
`valid_until` horizon of the most recently served manifest. A lagged replica that causes
the PRE to resolve against stale state is a defect.

---

## 28. Observability Requirements

**28.1** The following signals MUST be present in all production deployments:

| Signal                            | Type      | Retention |
|-----------------------------------|-----------|-----------|
| `manifest_compute_total`          | counter   | 30 days   |
| `manifest_compute_duration_ms`    | histogram | 30 days   |
| `manifest_cache_hit_ratio`        | gauge     | 30 days   |
| `manifest_errors_total`           | counter   | 30 days   |
| `pre_resolution_level_dist`       | histogram | 30 days   |
| `screen_poll_success_rate`        | gauge     | 30 days   |
| `emergency_active_count`          | gauge     | 30 days   |
| `override_active_count`           | gauge     | 30 days   |
| `audit_write_failures_total`      | counter   | 30 days   |
| `version_counter_per_screen`      | gauge     | 90 days   |
| `ota_ring_rollback_total`         | counter   | 90 days   |
| `entropy_score_per_venue`         | gauge     | 90 days   |

**28.2** Structured logs MUST be emitted for every manifest computation. Every log line MUST
include: `screen_id`, `version`, `checksum`, `resolution_level`, `cache_hit`, `duration_ms`,
`is_fallback`, and `request_id`.

**28.3** The `/internal/health` endpoint MUST reflect the health of: database connection,
PRE last computation success, cache availability, and event bus availability. A deployment
that does not expose this endpoint is not production-ready.

**28.4** All P1 or P0 conditions MUST produce an alert through the configured alerting
channel within 60 seconds of the condition becoming active. Alerting that requires a human
to check a dashboard to discover a P0 is insufficient.

**28.5** The PRE Preview endpoint is a first-class observability instrument. Its availability
MUST be monitored. A Preview endpoint that is returning errors is an observability gap that
MUST be treated as a P2 incident.

---

## 29. Things We Will Never Do

This section records architectural decisions that are permanently off the table. These are
not "not yet" items. They are "never, absent a constitutional amendment" items. The
distinction matters: these represent cases where the cost to the platform's core invariants
is understood to permanently exceed any benefit.

**29.1 We will never give the PRE write access to any persistent store.**
The purity of the PRE is the platform's most load-bearing invariant. Any write access, even
for performance (pre-warming caches, updating hit counters), would compromise INV-1 and make
the PRE testable only with a live database. The testing and correctness cost is permanent and
unbounded.

**29.2 We will never implement client-side playlist resolution.**
Frontend clients that resolve playlists independently of the backend create an unauditable
dual-authority problem. The correctness of what a screen shows can no longer be verified
from the backend alone. This would break the proof-of-play guarantee and the replayability
requirement simultaneously.

**29.3 We will never use the manifest cache as the authoritative source of content delivery
records.**
Proof-of-play is a contractual and commercial obligation. It MUST be grounded in PRE
replayable state, not cache artifacts. Cache entries are ephemeral and not audit-safe.

**29.4 We will never automatically correct operator configuration.**
The system's users are venue operators who have business context the system does not have.
An automatic correction that is wrong from the operator's perspective is more harmful than a
surfaced advisory that the operator can ignore. The observability-first philosophy exists
precisely because automatic correction requires inferring intent, which is epistemically
impossible.

**29.5 We will never implement a resolution algorithm that is not fully deterministic.**
A non-deterministic resolver would make it impossible to answer: "what did screen X show at
time T?" The entire audit, compliance, and proof-of-play infrastructure depends on this
answerability. A probabilistic or approximate resolver cannot carry these guarantees.

**29.6 We will never silently demote a manifest to a lower-fidelity result without an
observable indicator.**
If the system must serve a degraded manifest (stale cache, System Fallback), that degradation
MUST be observable in the manifest metadata, in the structured logs, and in the metrics. A
screen that believes it is showing authoritative current content when it is showing stale
content is a contractual liability.

**29.7 We will never bypass the emergency check in the PRE for performance reasons.**
Emergency suppression of content is a safety and legal obligation. No latency optimization,
speculative execution shortcut, or cache strategy MAY cause the emergency check to be
skipped or deferred.

**29.8 We will never treat operational entropy as an error to be automatically cleaned up.**
Configuration entropy reflects decisions made by operators over time. Those decisions may be
individually rational. Automatically rebalancing, pruning, or normalizing operator
configuration would silently override operator intent. Entropy is surfaced as signal; removal
is operator-initiated.

---

## 30. Amendment Rules

**30.1** This constitution is a living document. It MAY be amended to reflect new
architectural understanding, changed product requirements, or corrected judgment. The
amendment process is the mechanism through which engineering laws evolve without regressing
to ad-hoc decision-making.

**30.2** An amendment is required for any of the following:

- Adding to, modifying, or removing a provision in Sections 3, 11, 29
- Changing the PRE function signature or output contract
- Changing the checksum algorithm
- Changing the version counter semantics
- Adding write access to the PRE
- Changing the manifest endpoint response contract in a breaking way
- Adding a new service boundary that is not derivable from the current boundary model
- Adding a new forbidden pattern
- Relaxing a performance constraint in Section 26

**30.3** The amendment process:

1. **Proposal:** A written amendment proposal that states: (a) the specific provision being
   changed, (b) the proposed new language, (c) the motivation, (d) an analysis of which
   downstream invariants or provisions the change affects, and (e) a migration plan if
   existing systems depend on the old provision.

2. **Review period:** A minimum of 5 business days during which all engineers with active
   context on the affected system MUST be given an opportunity to review.

3. **Approval:** An amendment requires sign-off from: the engineer who proposed it (one
   vote), plus at least one other engineer with commit access to the core system (second
   vote). No amendment may be self-approved.

4. **Publication:** The amended document is updated with the new version number (v2, v3,
   etc.) and the amendment history is appended below this section. The previous version is
   archived, not deleted.

**30.4** Emergency amendments (necessitated by a production P0 incident where the
constitution must be deviated from to restore service) are permitted under the following
conditions: (a) the deviation is documented in the incident record, (b) the full amendment
process is completed within 5 business days of the incident, and (c) the deviation is
treated as technical debt until the amendment is ratified.

**30.5** This document is version v1. The amendment history below is initially empty.

---

## Amendment History

*(No amendments recorded. This is v1.)*

---

*End of Engineering Constitution v1.0*
*ClubHub TV Platform — ratified 2026-05-17*
