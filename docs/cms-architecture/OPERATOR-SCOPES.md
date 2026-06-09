# OPERATOR-SCOPES.md
# ClubHub TV — Operator Scopes

**Document type:** Architecture reference — request-time authorization layer
**Status:** Ratified
**Date:** 2026-05-26
**Scope:** Scope definitions, evaluation, expansion/contraction, failure modes, audit integration
**Authority:** Derives from ROLE-AND-PERMISSION-MODEL.md and AUTHORITY-BOUNDARIES.md.
              Defines the operational mechanics of how authority is applied at request time.

---

## 0. Normative Language

MUST / MUST NOT / SHOULD / MAY carry the meanings defined in ENGINEERING-CONSTITUTION-v1.md §0.

---

## 1. What a Scope Is

A **scope** is the set of organizational nodes (enterprises, regions, venues, screen zones,
and screens) that a principal is authorized to observe and mutate, given their assigned roles.

Scope is not a single value — it is a computed set derived from the principal's role
assignments at the time of each request. The same principal may have different effective
scopes for different operations (e.g., they can READ a wider set than they can PUBLISH to).

Scope is always evaluated fresh at request time. There is no cached scope that persists
between requests. If a principal's role is revoked, the revocation takes effect on the
next request — no grace period, no session-level scope persistence.

---

## 2. Scope Types

### 2.1 PLATFORM Scope

**Holder:** PLATFORM_ADMIN only
**Covers:** All enterprises, all regions, all venues, all screen zones, all screens on the
            platform
**Mutation authority within scope:** CONSTITUTIONAL (highest category) — but see §8 for
                                     absolute prohibitions that apply even at PLATFORM scope
**Read authority within scope:** All data in all tenants (cross-tenant reads are logged)

PLATFORM scope is not a superset of all other scopes in terms of what actions are
permitted — it is a superset of visibility and administrative authority. Certain actions
(like mutating PRE outputs) are prohibited at PLATFORM scope as rigorously as at any other.

### 2.2 ENTERPRISE Scope

**Holder:** ENTERPRISE_ADMIN for a specific ENTERPRISE_GROUP
**Covers:** The named enterprise entity; all its regional organizations; all its venues;
            all zones and screens within those venues
**Mutation authority within scope:** CONTENT, SCHEDULING, OVERRIDE, EMERGENCY (fleet),
                                     CONFIGURATION, GOVERNANCE (fleet-level)
**Read authority within scope:** All enterprise data, venue data, zone data, screen data,
                                 replay audit logs, parity records, entropy reports for the
                                 enterprise's full hierarchy

ENTERPRISE scope does not cover:
- Other enterprises (even within the same platform deployment)
- Platform-level resources not delegated to the enterprise
- The platform state machine or global constitutional parameters

### 2.3 REGIONAL Scope

**Holder:** REGIONAL_MANAGER for a specific REGIONAL_ORGANIZATION
**Covers:** The named regional organization; all venues within it; all zones and screens
            within those venues
**Mutation authority within scope:** SCHEDULING (regional templates), OVERRIDE (regional),
                                     EMERGENCY (multi-venue ACK), ENTROPY_ACK (region-scope)
**Read authority within scope:** All venue, zone, screen, and schedule data within the region;
                                 entropy reports for the region; replay audit records for the
                                 region's venues (within the AUDITOR constraints if also AUDITOR)

REGIONAL scope does not cover:
- Other regions in the same enterprise
- Enterprise-level configuration (read-only observation; no mutation)
- Venues directly attached to the enterprise that are not in any region

### 2.4 VENUE Scope

**Holder:** VENUE_OPERATOR for a specific VENUE
**Covers:** The named venue; all its screen zones; all enrolled screens
**Mutation authority within scope:** CONTENT (venue-local), SCHEDULING (venue schedules and
                                     zone rules), OVERRIDE (venue-local and zone-local),
                                     EMERGENCY (local trigger and ACK), ENTROPY_ACK (venue)
**Read authority within scope:** Venue data, zone data, screen data, venue schedules, active
                                 override status, local emergency state, venue entropy alerts

VENUE scope does not cover:
- Other venues in the same enterprise
- Regional templates (read-only)
- Enterprise templates (read-only)
- Parity reports (VENUE_OPERATOR does not hold CANARY_APPROVE — parity data is governance-level)
- Replay audit logs beyond the venue's own operational history (detailed forensic access
  requires AUDITOR role assignment)

### 2.5 SCREEN_ZONE Scope

SCREEN_ZONE scope is not an independently assignable role scope — it is the granularity at
which VENUE scope becomes effective for content operations. A VENUE_OPERATOR's mutations
(campaign publishing, zone rule changes) target specific zones.

For permission evaluation, SCREEN_ZONE scope is treated as a subset of VENUE scope. There
is no separate "zone operator" role — zone-level authority derives from VENUE_OPERATOR for
the parent venue.

---

## 3. Scope Evaluation at Request Time

Every mutating API request MUST undergo a four-step scope evaluation before any state is
modified. This is the authorization gate:

```
Step 1: AUTHENTICATE — verify the principal's identity (session token, service token)
Step 2: IDENTIFY ROLES — load all active role assignments for the principal
Step 3: COMPUTE EFFECTIVE SCOPE — derive the set of resources the principal can reach
         for the requested operation type
Step 4: CHECK TARGET RESOURCE — verify the request's target resource is within the
         computed effective scope
```

If any step fails, the request is rejected with:
- HTTP 401 for authentication failure (Step 1)
- HTTP 403 for scope check failure (Steps 2-4)
- An audit log entry recording the rejection (principal, resource, operation, failure reason)
- No partial execution — the operation is atomic at the scope gate

**Scope evaluation MUST be performed before any state read or write that the operation
depends on.** There is no "optimistic execution" pattern where the operation runs and the
scope check happens after. Scope is a pre-condition, not a post-condition.

### 3.1 Scope Computation Detail

Given a principal P requesting operation O on resource R:

```
effective_scope(P, O) =
  union of scopes from all active, non-expired role assignments of P
  filtered to: roles that grant permission category for operation O
  resolved to: the set of organizational nodes those roles cover
```

Example: P holds VENUE_OPERATOR for Venue A and AUDITOR for Enterprise B.
- Operation: PUBLISH schedule to Venue A
- Relevant roles: VENUE_OPERATOR (grants PUBLISH within Venue A scope)
- Effective scope for PUBLISH: Venue A only
- Target resource: Venue A schedule → IN SCOPE → proceed

Example: Same principal, operation: READ replay audit log for Enterprise B.
- Relevant roles: AUDITOR for Enterprise B (grants READ audit for all venues in Enterprise B)
- Effective scope for READ replay audit: all venues in Enterprise B
- Target resource: Venue X (in Enterprise B) audit log → IN SCOPE → proceed

Example: Same principal, operation: PUBLISH schedule to Venue Y (in Enterprise B).
- Relevant roles: AUDITOR for Enterprise B (no PUBLISH authority); VENUE_OPERATOR for A (wrong venue)
- Effective scope for PUBLISH: Venue A only
- Target resource: Venue Y → OUT OF SCOPE → reject

---

## 4. Scope Inheritance for Enterprise Admins

ENTERPRISE_ADMIN scope is inherited — it covers the entire enterprise hierarchy without
explicit per-venue grants. This works as follows:

When an ENTERPRISE_ADMIN is assigned to Enterprise E:
- Their scope automatically includes every existing VENUE in E
- Their scope automatically includes every REGIONAL_ORGANIZATION in E
- Their scope automatically includes every SCREEN_ZONE and enrolled SCREEN in any venue in E
- When a new VENUE is added to E, it is automatically within the ENTERPRISE_ADMIN's scope
  (no explicit scope extension required)
- When a VENUE is removed from E, it is automatically removed from scope

This is called **inherited expansion**: the ENTERPRISE_ADMIN's scope grows and shrinks
with the enterprise's membership. They do not need to be manually updated when the
enterprise's venue list changes.

Contrast with VENUE_OPERATOR: their scope is exactly the named venue. If a venue
gains a new screen zone, the VENUE_OPERATOR's scope automatically covers it (scope
inherits within venue). But the VENUE_OPERATOR's scope does NOT expand to cover a new
venue added to the enterprise — that requires a new VENUE_OPERATOR assignment.

---

## 5. Scope Expansion and Contraction

### 5.1 Scope Expansion — Adding a New Venue

When ENTERPRISE_ADMIN creates a new venue under their enterprise:
1. Venue is created in the database
2. Enterprise scope for all existing ENTERPRISE_ADMINs automatically includes the new venue
3. ENTERPRISE_ADMIN assigns VENUE_OPERATOR for the new venue (this is a scoped assignment,
   not automatic)
4. REGIONAL_MANAGER's scope expands to include the new venue if it is assigned to their region
5. No role records need to be updated for ENTERPRISE_ADMIN — scope expansion is automatic

### 5.2 Scope Contraction — Removing a Venue

When a venue is deprovisioned:
1. Venue enters READ_ONLY state
2. All active sessions with VENUE_OPERATOR scope for this venue lose mutation access immediately
3. Audit records retain the venue reference (soft delete — records preserved)
4. ENTERPRISE_ADMIN scope automatically no longer covers the venue for mutation
5. ENTERPRISE_ADMIN can still READ the venue's historical audit records (within retention window)

### 5.3 Scope Expansion — Granting Local Override Authority

When ENTERPRISE_ADMIN grants a venue local override authority:
1. A `venue_override_authority` grant record is created
2. VENUE_OPERATOR scope for that venue expands: PUBLISH now covers schedules that override
   enterprise templates (previously, venue schedules were below enterprise templates in priority)
3. This grant is logged as a governance action with the ENTERPRISE_ADMIN's identity

Revoking local override authority:
1. Grant record is deactivated
2. VENUE_OPERATOR scope contracts: venue schedules return to below-enterprise-template status
3. Existing published venue schedules become lower-priority (they are not deleted — they
   simply stop overriding the enterprise template)

### 5.4 Scope Expansion — Temporal Role

When a temporal role is issued (e.g., contractor VENUE_OPERATOR for 30 days):
1. Role assignment created with `expires_at` timestamp
2. Scope includes the venue for the duration
3. At expiry: scope is automatically revoked; active sessions are invalidated; audit log entry
4. Extension requires new assignment by original granting authority — no auto-renewal

---

## 6. Cross-Scope Operations

Some operations inherently affect multiple scopes simultaneously. These are the most
governance-sensitive operations on the platform.

### 6.1 Fleet-Wide Emergency

When ENTERPRISE_ADMIN triggers a fleet emergency:
- Target: all venues in the enterprise (multiple VENUE scopes simultaneously)
- Authorization: ENTERPRISE scope covers all of them (inherited authority)
- Execution: emergency state is set atomically across all venue records
- Audit: a single `FleetEmergencyLog` entry with scope = enterprise_id and list of
         affected venue_ids
- All affected VENUE_OPERATORs are notified (they are observers, not authority holders here)

This is a cross-scope write (multiple venues), but it is authorized by a single principal
whose scope covers all affected resources.

### 6.2 Enterprise Template Publishing

When ENTERPRISE_ADMIN publishes an enterprise schedule template:
- Target: all venues in the enterprise
- Authorization: ENTERPRISE scope covers all venues
- Effect: PRE.resolve() will use the new template as LEVEL_2 input for all enterprise screens
- Each affected screen's next resolution produces a new PRE_Output with updated checksum and
  version (INV-4 monotone versioning — version only increments, never decrements)
- Audit: single `SchedulePublishLog` with scope=enterprise and target_venues=[all]

### 6.3 Platform EMERGENCY_FREEZE

When PLATFORM_ADMIN triggers EMERGENCY_FREEZE:
- Target: ALL screens on ALL tenants (crosses all scope boundaries)
- Authorization: PLATFORM scope; human-auth token verified
- Execution: global constitutional breaker transitions to EMERGENCY_FREEZE
- PRE.resolve() returns system fallback for all invocations — no tenant config is evaluated
- Audit: `ConstitutionalFreezeLog` with scope=PLATFORM and authorized_by=<admin_identity>
- All ENTERPRISE_ADMINs and monitoring systems are notified

This is the only operation that legitimately crosses tenant scope boundaries in a mutating
direction. It is authorized by PLATFORM scope and always logged at maximum priority.

### 6.4 Canary Promotion Decision

Canary stage transitions affect the PRE version evaluated for comparison in shadow execution.
Scope for a canary promotion decision is the enterprise (for SHADOW_ONLY → FLEET_WIDE) or
platform (for FLEET_WIDE → AUTHORITATIVE).

A promotion approved by ENTERPRISE_ADMIN affects shadow execution for their enterprise's
screens. The promotion does not affect another enterprise's canary stage — canary progression
is per-enterprise (not global).

AUTHORITATIVE promotion (PLATFORM_ADMIN) changes the platform's production PRE behavior
globally across all enterprises. This is a PLATFORM scope operation.

---

## 7. Scope and the Replay Audit

Every replay audit record MUST carry the full scope chain under which the action was
authorized. This is not optional metadata — it is required for forensic replayability.

### 7.1 Scope Metadata in Audit Records

Each `ReplayAuditRecord` carries:
```
authorized_scope: {
  principal_id: string,          // WHO authorized this
  role_at_authorization: string, // WHICH role was exercised
  scope_type: 'PLATFORM' | 'ENTERPRISE' | 'REGIONAL' | 'VENUE' | 'SERVICE',
  enterprise_id: string | null,
  region_id: string | null,
  venue_id: string | null,
  zone_id: string | null,
  scope_verified_at: timestamp,  // when scope check passed
}
```

This allows forensic reconstruction of:
- "Who authorized this schedule change and under what scope?"
- "Was this emergency triggered by someone with legitimate authority?"
- "When did this principal's scope cover this venue?"

### 7.2 Scope Metadata Immutability

`authorized_scope` metadata in audit records is immutable. It MUST NOT be altered after
the record is written. FP-22 (`replay_packet_immutable: no field reassignment on audit
records`) enforces this at the code level.

If a principal's scope later changes (role revoked, venue re-parented), the historical
audit records retain the scope that was active at the time of the action. This is correct
and required for forensic accuracy.

### 7.3 Audit Scope for Service Accounts

Service accounts (entropy scheduler, shadow runner, parity recorder) operate under
SERVICE scope. Their audit records carry:
```
authorized_scope: {
  principal_id: 'service:entropy-scheduler',
  role_at_authorization: 'SERVICE_ACCOUNT',
  scope_type: 'SERVICE',
  enterprise_id: null,  // services are not enterprise-scoped
  ...
}
```

Service accounts MUST NOT hold ENTERPRISE_ADMIN, VENUE_OPERATOR, or any other human role.
They operate under constitutional constraints without any human role's mutation authority.

---

## 8. Scope Isolation Failure Modes

Scope check failures are not routine authorization rejections — they are potential security
events and MUST be handled as such.

### 8.1 Standard Scope Rejection (Expected Case)

A user attempts to access a resource outside their scope (typical: misconfigured UI, wrong
venue selected, session token mismatch).

**Response:**
1. Reject the request immediately (HTTP 403)
2. Log `ScopeRejectionLog` entry: principal, resource, operation, reason, timestamp
3. Return to caller: "You do not have access to this resource" (no leaking of why or what exists)
4. No alert (this is normal operational behavior)

### 8.2 Anomalous Scope Access Pattern (Suspicious Case)

A principal attempts repeated scope violations in a short window, or the scope check reveals
that a principal is attempting to access a resource in a different tenant.

**Response:**
1. Reject the request (HTTP 403)
2. Log `ScopeAnomalyLog` entry with elevated severity
3. Increment anomaly counter for this principal
4. If anomaly counter exceeds threshold within window: generate `SecurityAlertLog` and
   notify PLATFORM_ADMIN via configured alert channel
5. Consider session invalidation if threshold is exceeded

### 8.3 Scope Check System Failure (Critical Case)

The scope evaluation system itself fails (e.g., role database unavailable, scope
computation throws an unhandled exception).

**Response:**
1. DENY the request with HTTP 503 (not 403 — this is a system error, not an access decision)
2. Log the failure with full error context
3. DO NOT fall back to "allow" — the default on scope system failure is DENY
4. Alert monitoring immediately — a scope system failure means authorization is degraded
5. The scope system failure does NOT affect PRE.resolve() directly, but it prevents any
   mutations from being authorized, which is the safe state

**The fail-safe is DENY.** There is no condition under which a scope system failure should
result in access being granted. Correctness outranks availability at this security layer.

### 8.4 Scope Check Bypass Attempt (Attack Case)

Any code path that reaches a database write or a state mutation without a scope check
having been recorded in the audit log is a critical defect. Monitoring MUST detect and
alert on:
- Mutations with no corresponding `authorized_scope` audit record
- Service account mutations outside SERVICE scope (e.g., a service account using an
  enterprise_id that doesn't match any of its configured enterprise targets)
- Role-escalation patterns (a VENUE_OPERATOR suddenly appearing in a CANARY_APPROVE audit entry)

---

## 9. Monitoring Scope — AUDITOR Constraints

AUDITOR scope is designed for compliance and forensic use. Its constraints are specific:

**AUDITOR can read:**
- Full replay audit log for all venues in their assigned enterprise
- Entropy reports for all venues in their assigned enterprise
- Parity records for all venues in their assigned enterprise
- Schedule history (what was published, when, by whom) for all venues in their enterprise
- PRE trace output for individual invocations within their enterprise

**AUDITOR cannot read:**
- Any data from a different enterprise (even if requested by their own organization's leadership)
- Constitutional state machine internals (allowed-transitions table, breaker state) beyond
  the publicly observable current state
- Service account credentials or token values
- Other principals' session tokens or auth credentials

**AUDITOR cannot mutate anything.** Every AUDITOR action is a read. If an AUDITOR needs
to trigger any action based on what they find (e.g., raise an incident), they do so through
a VENUE_OPERATOR or ENTERPRISE_ADMIN with the appropriate authority.

**Cross-enterprise audit use case:** If a regulator needs audit access across multiple
enterprises (e.g., a national licensing authority), PLATFORM_ADMIN generates a targeted
audit export from each enterprise and delivers it through a controlled channel. The regulator
does NOT receive multi-enterprise AUDITOR access. This preserves tenant isolation even for
legitimate regulatory requests.

---

## 10. Service Account Scopes

Automated systems — the entropy scheduler, shadow runner, parity recorder, replay audit
writer, and OTA delivery system — operate under SERVICE scope.

### 10.1 SERVICE Scope Properties

SERVICE scope is distinct from all human role scopes:
- Service accounts are not assigned to any TIER_1 or TIER_2 entity
- Service accounts have no emergency authority (they cannot trigger or acknowledge emergencies)
- Service accounts have no canary promotion authority
- Service accounts have no constitutional reset authority
- Service accounts' write authority is limited to their designated subsystem tables:
  - Entropy scheduler → entropy_alerts table (append only)
  - Parity recorder → parity_records table (append only, see FP-25)
  - Replay audit writer → workflow_traces table (append only, hash-chained)
  - OTA delivery → ota_delivery_records table (append only)

### 10.2 Constitutional Constraints on Service Accounts

Service accounts operate within the PRE boundary constraints (PRE-BOUNDARY.md). They MUST:
- Never call PRE.resolve() directly (they go through invokePRE())
- Never modify pre_output records (FP-20)
- Never emit telemetry from within src/pre/ (FP-21)
- Append-only within their designated tables (FP-25)

Service accounts MUST NOT:
- Escalate their own authority (a service account cannot grant itself ENTERPRISE_ADMIN access)
- Cross tenant boundaries in writes (entropy scheduler writes to the entropy table for
  enterprise E — it does not write to enterprise F's entropy alerts)
- Issue emergency state changes

### 10.3 Service Account Audit Records

Service account actions are logged in the same audit stream as human actions, with
`scope_type: 'SERVICE'` and `principal_id` in the format `'service:{service-name}'`.
This makes it possible to distinguish automated system actions from human operator actions
in forensic replay.

When a service account's action produces a consequence (e.g., entropy alert triggers a
circuit breaker state change), the audit chain carries both: the service account's record
for the original write, and the system's record for the consequent state transition.

---

## 11. Scope Reference Summary

```
Scope Type      Holder Role          Covers (Organizational Nodes)     Key Constraints
────────────────────────────────────────────────────────────────────────────────────────
PLATFORM        PLATFORM_ADMIN       All tenants, all nodes            Cross-tenant reads logged
ENTERPRISE      ENTERPRISE_ADMIN     Named enterprise + all children   Cannot cross enterprises
REGIONAL        REGIONAL_MANAGER     Named region + all child venues   Cannot cross regions
VENUE           VENUE_OPERATOR       Named venue + all zones/screens   Cannot cross venues
SCREEN_ZONE     (derived from VENUE) Named zone + screens in zone      Subset of VENUE
SERVICE         Service accounts     Designated subsystem tables only  Append-only writes
────────────────────────────────────────────────────────────────────────────────────────
```

All scopes carry scope metadata in every audit record. All scope checks are pre-conditions
to mutation. Scope check failure defaults to DENY. Scope system failure defaults to DENY.
There is no path through scope evaluation that silently grants excess authority.

---

*See also: TENANCY-MODEL.md, ORGANIZATIONAL-HIERARCHY.md, ROLE-AND-PERMISSION-MODEL.md, AUTHORITY-BOUNDARIES.md*
