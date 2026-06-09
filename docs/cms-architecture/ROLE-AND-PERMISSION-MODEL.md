# ROLE-AND-PERMISSION-MODEL.md
# ClubHub TV — Role and Permission Model

**Document type:** Architecture reference — security and governance layer
**Status:** Ratified
**Date:** 2026-05-26
**Scope:** All roles, all permission categories, all scope dimensions
**Authority:** Derives from TENANCY-MODEL.md. Informs AUTHORITY-BOUNDARIES.md and OPERATOR-SCOPES.md.

---

## 0. Normative Language

MUST / MUST NOT / SHOULD / MAY carry the meanings defined in ENGINEERING-CONSTITUTION-v1.md §0.

---

## 1. Role Overview

The platform defines six principal role types. Every human user, service account, and
automated system that interacts with the platform is assigned one or more of these roles,
each scoped to a specific organizational node in the five-tier hierarchy.

| Role                | Tier Scope    | Authority Level | Mutation Authority | Emergency Authority |
|---------------------|---------------|-----------------|--------------------|---------------------|
| PLATFORM_ADMIN      | TIER_0        | Constitutional  | Full               | Full (including FREEZE) |
| ENTERPRISE_ADMIN    | TIER_1        | Fleet           | Fleet-scoped       | Fleet emergency only |
| REGIONAL_MANAGER    | TIER_2        | Regional        | Region-scoped      | Multi-venue ACK only |
| VENUE_OPERATOR      | TIER_3        | Venue           | Venue-scoped       | Venue-local only |
| SPONSOR_STAKEHOLDER | TIER_3/4      | Read + Preview  | None               | None |
| AUDITOR             | Configurable  | Read-only       | None               | None |

---

## 2. Full Capability Matrix

The following table defines every capability by role and permission category.

Permission category definitions:
- **READ**: View data, configuration, operational state, and metrics
- **CREATE**: Create new organizational entities, content, or configuration records
- **PUBLISH**: Publish schedules or campaigns to active screens
- **OVERRIDE**: Issue or clear schedule overrides
- **EMERGENCY**: Trigger, escalate, or acknowledge emergency states
- **ENTROPY_ACK**: Acknowledge entropy alerts (required before entropy warnings clear)
- **CANARY_APPROVE**: Approve canary stage transitions
- **CONSTITUTIONAL_RESET**: Execute constitutional state machine resets

```
                          PLAT  ENT   REG   VENUE SPON  AUDIT
                          ADMIN ADMIN MGR   OPER  HOLD  OR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
READ
  All tenant data         YES   own   own   own   own*  own†
  PRE trace output        YES   own   own   own   NO    own†
  Replay audit log        YES   own   own   own   NO    own†
  Parity reports          YES   own   own   own   NO    own†
  Entropy reports         YES   own   own   own   NO    own†
  Content preview         YES   YES   YES   YES   YES   NO
  Canary stage status     YES   own   own   own   NO    own†

CREATE
  Enterprise groups       YES   NO    NO    NO    NO    NO
  Regional orgs           YES   YES   NO    NO    NO    NO
  Venues                  YES   YES   NO    NO    NO    NO
  Screen zones            YES   YES   NO    YES   NO    NO
  Content entries         YES   YES   YES   YES   NO    NO
  Sponsorship agreements  YES   YES   NO    NO    NO    NO

PUBLISH
  Enterprise templates    YES   YES   NO    NO    NO    NO
  Regional templates      YES   YES   YES   NO    NO    NO
  Venue schedules         YES   YES   YES   YES   NO    NO
  Zone-level rules        YES   YES   YES   YES   NO    NO
  Campaigns (local)       YES   YES   YES   YES   NO    NO

OVERRIDE
  Platform-wide           YES   NO    NO    NO    NO    NO
  Enterprise-wide         YES   YES   NO    NO    NO    NO
  Region-wide             YES   YES   YES   NO    NO    NO
  Venue-local             YES   YES   YES   YES‡  NO    NO
  Zone-local              YES   YES   YES   YES   NO    NO

EMERGENCY
  EMERGENCY_FREEZE        YES   NO    NO    NO    NO    NO
  Fleet emergency         YES   YES   NO    NO    NO    NO
  Multi-venue ACK         YES   YES   YES   NO    NO    NO
  Local emergency trigger YES   YES   YES   YES   NO    NO
  Local emergency ACK     YES   YES   YES   YES   NO    NO

ENTROPY_ACK
  Fleet-scope             YES   YES   NO    NO    NO    NO
  Region-scope            YES   YES   YES   NO    NO    NO
  Venue-scope             YES   YES   YES   YES   NO    NO

CANARY_APPROVE
  SHADOW_ONLY → FLEET_WIDE  YES  YES  NO    NO    NO    NO
  FLEET_WIDE → AUTHORITATIVE YES  NO   NO    NO    NO    NO

CONSTITUTIONAL_RESET
  EMERGENCY_FREEZE → NORMAL  YES  NO   NO    NO    NO    NO
  Any state machine reset    YES  NO   NO    NO    NO    NO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Legend:
- `YES` — permitted with no additional conditions
- `NO` — prohibited; cannot be granted; system MUST reject
- `own` — permitted within the principal's assigned organizational scope only
- `own*` — SPONSOR_STAKEHOLDER: content and playlist previews only; no operational state
- `own†` — AUDITOR: replay log and entropy reports within their assigned enterprise scope;
            no cross-enterprise visibility; no mutation
- `‡` — VENUE_OPERATOR local overrides require that local override authority has been
         explicitly granted by ENTERPRISE_ADMIN (see ORGANIZATIONAL-HIERARCHY.md §2.4)

---

## 3. Role Definitions

### 3.1 PLATFORM_ADMIN

**Organizational anchor:** TIER_0 — ClubHub platform itself
**Typical holder:** ClubHub engineering/operations staff; must be a named individual
**Token requirement:** Holds constitutional human-auth tokens; used for EMERGENCY_FREEZE
                       release and AUTHORITATIVE canary promotion. Token MUST be non-empty
                       and ≥8 characters. System rejects shorter or empty tokens.

The PLATFORM_ADMIN is not a day-to-day operational role. PLATFORM_ADMIN actions are
exceptional, high-consequence decisions. Every PLATFORM_ADMIN action is logged with
the highest audit priority — these records are never purged.

PLATFORM_ADMIN is the only role that can:
- Release EMERGENCY_FREEZE (constitutional reset)
- Approve FLEET_WIDE → AUTHORITATIVE canary promotion
- Create or deprovision ENTERPRISE_GROUP entities
- Access any tenant's replay audit log
- Execute cross-tenant forensic operations

A platform deployment SHOULD have at least two PLATFORM_ADMIN principals to avoid single
point of failure in constitutional operations. Both MUST have valid human-auth tokens.

### 3.2 ENTERPRISE_ADMIN

**Organizational anchor:** TIER_1 — a specific ENTERPRISE_GROUP
**Typical holder:** Fleet manager, IT director, head of operations at the enterprise
**Token requirement:** Human auth token required for SHADOW_ONLY → FLEET_WIDE canary
                       approval. Canary approval MUST NOT proceed with an empty token.

The ENTERPRISE_ADMIN is the highest role at the enterprise level. They are accountable for
all operational decisions affecting their enterprise's fleet. An ENTERPRISE_ADMIN MUST be
assigned to every ENTERPRISE_GROUP — an enterprise with no ENTERPRISE_ADMIN is an
operational risk and SHOULD be flagged by platform monitoring.

Key enterprise admin capabilities:
- Fleet-wide emergency triggers
- Canary promotion authority (SHADOW_ONLY through FLEET_WIDE)
- Enterprise template publishing (affects all venues in the enterprise)
- Role assignment for REGIONAL_MANAGER and VENUE_OPERATOR within their enterprise
- Venue creation and deprovisioning within their enterprise

### 3.3 REGIONAL_MANAGER

**Organizational anchor:** TIER_2 — a specific REGIONAL_ORGANIZATION
**Typical holder:** Regional operations manager, area manager
**Token requirement:** None for standard operations. Human token NOT required for regional
                       emergency acknowledgment.

The REGIONAL_MANAGER has multi-venue oversight within their region. They do not have
authority over venues in other regions of the same enterprise. Their primary operational
value is multi-venue coordination and regional entropy oversight.

Key regional manager capabilities:
- Multi-venue emergency acknowledgment within their region
- Regional template publishing
- Entropy alert acknowledgment for all venues in the region
- VENUE_OPERATOR assignment within their region

### 3.4 VENUE_OPERATOR

**Organizational anchor:** TIER_3 — a specific VENUE
**Typical holder:** Venue manager, hospitality IT, on-site technician
**Token requirement:** None. VENUE_OPERATOR is a day-to-day operational role.

The VENUE_OPERATOR is the primary human operator of the platform under normal conditions.
Most day-to-day decisions (what's playing, what's overriding, local campaigns, screen
commissioning) flow through VENUE_OPERATOR.

Key venue operator capabilities:
- Screen commissioning (enrolling Pi devices, defining zones)
- Local campaign publishing
- Local schedule overrides (requires local override authority grant from ENTERPRISE_ADMIN)
- Local emergency trigger and acknowledgment
- Venue-scope entropy acknowledgment

### 3.5 SPONSOR_STAKEHOLDER

**Organizational anchor:** TIER_3 or TIER_4 — associated with a specific venue or zone
**Typical holder:** Advertising partner, brand representative, commercial sponsor
**Token requirement:** None — read-only role.

The SPONSOR_STAKEHOLDER is a read-plus-preview role with zero mutation authority and zero
emergency authority. The commercial importance of a sponsor relationship does NOT expand
this role's technical authority. A sponsor who funds 100% of a venue's advertising budget
has exactly the same technical authority as any other SPONSOR_STAKEHOLDER.

SPONSOR_STAKEHOLDER isolation rules (MUST NOT be circumvented):
- MAY view scheduled content and preview future playlists for their associated venue/zone
- MUST NOT view parity reports, entropy reports, or replay audit logs
- MUST NOT view emergency state beyond public-facing status indicators
- MUST NOT trigger any emergency flow
- MUST NOT view constitutional state machine state
- MUST NOT view canary promotion status
- MUST NOT view PRE trace output (reason_trace reveals internal scheduling logic)
- MUST NOT view competitor sponsor's content or SOV allocation

These restrictions exist because parity reports, entropy data, and replay logs contain
operational intelligence about the platform's decision-making internals. This information
is not within scope of a commercial sponsorship relationship.

### 3.6 AUDITOR

**Organizational anchor:** Configurable — typically enterprise-scoped or venue-scoped
**Typical holder:** External auditor, compliance officer, internal audit team
**Token requirement:** None — read-only role.

The AUDITOR has read access to replay audit logs, entropy reports, and parity records within
their assigned enterprise scope. AUDITOR access MUST NOT cross enterprise boundaries.

Key auditor capabilities:
- Read replay audit log (full, not filtered) within assigned enterprise
- Read entropy reports within assigned enterprise
- Read parity records within assigned enterprise
- View schedule history and resolution records

AUDITOR MUST NOT:
- Modify any record
- Cross enterprise boundaries
- Access constitutional state machine controls
- View other enterprises' data even if auditing the platform globally

For platform-wide audit (regulatory compliance), PLATFORM_ADMIN provides the audit export
directly rather than granting cross-enterprise AUDITOR access.

---

## 4. Permission Categories in Detail

### 4.1 READ

Read permissions govern visibility. All reads are logged. Reads by PLATFORM_ADMIN across
tenant boundaries are logged with elevated priority.

### 4.2 CREATE

Create permissions govern entity creation. CREATE does not imply PUBLISH — a content entry
can be created (exists in library) without being published to an active schedule.

### 4.3 PUBLISH

Publish permissions govern the act of making content or schedules active. Publishing is the
mutation that affects what screens actually display. Publish operations generate an audit
record and trigger a PRE re-evaluation on affected screens.

### 4.4 OVERRIDE

Override permissions govern the ability to bypass the standard schedule resolution order.
Overrides are constitutional — they are inputs to PRE.resolve(), not bypasses of it.
An override does not skip PRE; it changes what PRE sees as the active override schedule.

### 4.5 EMERGENCY

Emergency permissions are the most consequential mutation permissions on the platform.
Emergency state is a LEVEL_0 PRE input — it terminates normal resolution immediately.
Emergency triggers MUST be logged with the triggering principal's identity, timestamp,
reason (if provided), and the scope of affected screens.

### 4.6 ENTROPY_ACK

Entropy acknowledgment is a distinct permission category because entropy alerts are not
merely informational — they represent drift between expected and actual screen behavior.
Acknowledging an entropy alert is a governance action: the authorizing principal is
asserting that they are aware of the drift and have decided how to respond.

Acknowledging entropy does NOT clear the underlying condition. The alert clears when the
entropy measurement returns to within threshold, or when the root cause is resolved.

### 4.7 CANARY_APPROVE

Canary approval is a sequential gate. The canary stage sequence is:
`SHADOW_ONLY → INTERNAL_CANARY → SINGLE_VENUE → MULTI_VENUE → FLEET_WIDE → AUTHORITATIVE`

Stages MUST be traversed sequentially — no skipping. Human approval is required at every
transition. The `requires_human_approval` field on every `StageTransitionResult` MUST be
`true` — no auto-advancement is possible.

ENTERPRISE_ADMIN can approve transitions from SHADOW_ONLY through FLEET_WIDE.
PLATFORM_ADMIN approval is required for FLEET_WIDE → AUTHORITATIVE.
FLEET_WIDE → AUTHORITATIVE requires a human-auth token from PLATFORM_ADMIN.

### 4.8 CONSTITUTIONAL_RESET

Constitutional reset is the most restricted permission category. It is held only by
PLATFORM_ADMIN. It covers:
- Releasing EMERGENCY_FREEZE → any subsequent state
- Resetting the global constitutional circuit breaker
- Approving AUTHORITATIVE canary promotion (see §4.7)

Constitutional reset actions require a non-empty human-auth token (≥8 characters). The
system MUST reject reset attempts with an empty or short token. This is a deliberate
friction — constitutional resets are never routine.

---

## 5. Role Assignment Rules

The following table defines who can assign each role:

| Role to assign      | Who can assign it               | Scope constraint |
|---------------------|---------------------------------|------------------|
| PLATFORM_ADMIN      | PLATFORM_ADMIN only             | Platform-wide    |
| ENTERPRISE_ADMIN    | PLATFORM_ADMIN only             | Named enterprise |
| REGIONAL_MANAGER    | PLATFORM_ADMIN, ENTERPRISE_ADMIN | Within enterprise |
| VENUE_OPERATOR      | PLATFORM_ADMIN, ENTERPRISE_ADMIN, REGIONAL_MANAGER | Within region/enterprise |
| SPONSOR_STAKEHOLDER | PLATFORM_ADMIN, ENTERPRISE_ADMIN, VENUE_OPERATOR | Within venue/zone |
| AUDITOR             | PLATFORM_ADMIN, ENTERPRISE_ADMIN | Within enterprise |

ENTERPRISE_ADMIN MUST NOT create other ENTERPRISE_ADMIN accounts. An enterprise may have
exactly one ENTERPRISE_ADMIN. If an enterprise requires multiple administrators, PLATFORM_ADMIN
provisions additional ENTERPRISE_ADMIN accounts — this is a deliberate governance gate.

---

## 6. Multi-Role Principals

A single human user MAY hold multiple roles, each scoped independently. Common patterns:

**Pattern A: Cross-venue administrative coverage**
- VENUE_OPERATOR for Venue A (primary site)
- AUDITOR for Venue B (secondary site — read-only oversight)

**Pattern B: Inherited enterprise + venue**
- ENTERPRISE_ADMIN for Enterprise X
- VENUE_OPERATOR for a specific venue in Enterprise X (grandfathered, pre-enterprise role)

In this case, the principal holds the union of permissions from both roles within their
respective scopes. Where scopes overlap (both roles cover Venue X), the higher-authority
role's permissions apply to the overlapping scope.

**Pattern C: Cross-enterprise auditing**
- AUDITOR for Enterprise A
- AUDITOR for Enterprise B
- (Two separate AUDITOR roles, each independently scoped — not cross-enterprise)

**Rule:** Multi-role permission evaluation MUST be additive within scope boundaries.
A principal's effective permissions at a given resource are the union of all permissions
granted by all their roles that cover that resource's scope. Role conflicts are resolved
by scope and authority level — higher authority within scope wins.

---

## 7. Temporal Roles

A role assignment MAY have an expiry timestamp. A temporal role grants full permissions
of that role until the expiry, at which point the role is automatically revoked and the
principal drops to their remaining permanent roles.

**Primary use case:** Contractor access. A venue technician contracted for a 30-day
commissioning project receives VENUE_OPERATOR for that period. After 30 days, their
access drops to zero (or to whatever other roles they hold).

**Temporal role rules:**
- Expiry timestamp MUST be set at assignment time; it cannot be infinite
- Expiry MUST be enforced at the API layer, not only at login
- Temporal role expiry generates an audit log entry
- A temporal role MUST NOT be renewed automatically; renewal requires a new explicit assignment

---

## 8. Role Conflict Resolution

When a principal holds roles at multiple scopes that partially overlap, the following
resolution rules apply:

**Case 1: Different tiers, same enterprise**

REGIONAL_MANAGER for Region A + VENUE_OPERATOR for a venue in Region B (same enterprise):
- For venues in Region A: REGIONAL_MANAGER permissions apply
- For the specific venue in Region B: VENUE_OPERATOR permissions apply
- For all other venues in Region B: no access (VENUE_OPERATOR does not grant region-wide access)
- Resolution: permissions are scope-additive; each role grants authority only in its defined scope

**Case 2: Higher role covers lower role's scope**

ENTERPRISE_ADMIN for Enterprise X + VENUE_OPERATOR for a venue in Enterprise X:
- ENTERPRISE_ADMIN already grants all VENUE_OPERATOR permissions for all venues in X
- The VENUE_OPERATOR role is redundant but not harmful
- No conflict: ENTERPRISE_ADMIN subsumes VENUE_OPERATOR within the same enterprise

**Case 3: Cross-enterprise roles**

VENUE_OPERATOR for Venue A (Enterprise X) + AUDITOR for Enterprise Y:
- These do not overlap — completely independent scopes
- Resolution: both roles apply independently; no conflict

**Case 4: Emergency authority conflict**

If a principal holds REGIONAL_MANAGER for Region A and VENUE_OPERATOR for a venue in Region B:
- Emergency trigger for Region A venues: REGIONAL_MANAGER multi-venue ACK applies
- Emergency trigger for Region B venue: VENUE_OPERATOR local trigger only
- No authority amplification: VENUE_OPERATOR status in one region does not grant regional
  emergency authority in another region

---

## 9. Sponsor Stakeholder Isolation

This section provides explicit implementation guidance for SPONSOR_STAKEHOLDER isolation
because commercial pressure to expand sponsor access is a real operational risk.

The sponsor isolation rules are constitutional, not negotiable:

**What sponsors MAY see:**
- The current scheduled playlist for their associated venue/zone (what is playing now)
- Future scheduled playlists (preview of upcoming content) for their zone
- Their own sponsored content items (did my ad play at the scheduled time?)
- Aggregate uptime metrics for their associated screens (were screens online during my slots?)

**What sponsors MUST NOT see (hard prohibitions):**
- PRE trace output (`reason_trace`) — reveals scheduling decision logic
- Parity reports — reveals divergence between PRE and legacy resolution
- Entropy reports — reveals operational drift data
- Replay audit logs — reveals all scheduling decisions, not just sponsor content
- Emergency state details — beyond a simple "screens unavailable" indicator
- Canary stage or shadow execution status
- Constitutional state machine state
- Competitor sponsors' content IDs or SOV allocations
- Override configuration (what overrides are active and why)

**If a sponsor requests elevated access:** The correct response is ALWAYS "no." The commercial
value of the sponsorship relationship does not alter the security model. If the platform team
is pressured to grant a sponsor AUDITOR or VENUE_OPERATOR access to satisfy reporting needs,
the correct resolution is to build a purpose-specific sponsor reporting dashboard that exposes
only the sponsor-visible data described above.

---

## 10. The Constitutional Floor

The constitutional floor defines the set of capabilities that no role can grant and that no
role holds. These are absolute prohibitions, not missing permissions.

**No role on the platform can:**

1. **Skip constitutional enforcement.** There is no "bypass PRE" permission. Every content
   decision goes through PRE.resolve(). There is no fast-path that avoids invariant checks.

2. **Mutate PRE outputs post-resolution.** Once `PRE.resolve()` has returned a `PRE_Output`,
   no principal may modify any field of that output. This is enforced by FP-20 (forbidden
   pattern: `no direct assignment to pre_output.*`). The system MUST NOT provide a UI control
   or API endpoint that modifies a resolved output.

3. **Grant "skip constitutional enforcement."** An ENTERPRISE_ADMIN cannot grant a
   VENUE_OPERATOR the ability to skip enforcement. PLATFORM_ADMIN cannot grant this to
   ENTERPRISE_ADMIN. The capability does not exist.

4. **Auto-promote canary to AUTHORITATIVE.** There is no automated path to AUTHORITATIVE
   promotion. FP-24 (`no_auto_promotion: canary_stage direct assignment blocked`) enforces
   this at the code level. Promotion always requires a human token.

5. **Self-reset EMERGENCY_FREEZE.** EMERGENCY_FREEZE has no automatic exit. A role cannot
   grant another role the ability to release EMERGENCY_FREEZE — only PLATFORM_ADMIN with
   a valid human-auth token can release it. The constitutional state machine's transition
   table has no self-healing path from EMERGENCY_FREEZE.

6. **Access another tenant's data.** Even PLATFORM_ADMIN reads of cross-tenant data are
   logged and must be audit-justified. No role grants "read any tenant without logging."

These prohibitions are not implementation choices — they are design requirements. Any
implementation that permits any of the above MUST be treated as a critical defect.

---

*See also: TENANCY-MODEL.md, ORGANIZATIONAL-HIERARCHY.md, AUTHORITY-BOUNDARIES.md, OPERATOR-SCOPES.md*
