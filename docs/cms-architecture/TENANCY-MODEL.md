# TENANCY-MODEL.md
# ClubHub TV — CMS Tenancy Model

**Document type:** Architecture reference — permanent authority layer
**Status:** Ratified
**Date:** 2026-05-26
**Scope:** All CMS components, API layers, database schemas, and PRE corpus scoping
**Authority:** This document defines the canonical tenancy semantics. It is superseded only
              by an explicit constitutional amendment per ENGINEERING-CONSTITUTION-v1.md §30.

---

## 0. Normative Language

MUST / MUST NOT / SHOULD / MAY carry the meanings defined in ENGINEERING-CONSTITUTION-v1.md §0.

---

## 1. What Tenancy Means on This Platform

A **tenant** is an organizational entity that holds exclusive authority over a bounded set of
resources: venues, screens, content libraries, schedule templates, sponsorship agreements, and
PRE corpus state.

Tenancy on ClubHub TV is **constitutional** — it is not merely an access-control concept.
A tenant's boundary delimits:

1. **Data isolation** — which rows in shared tables are readable and writable by the tenant
2. **Configuration isolation** — which schedule templates, content categories, and override
   policies belong to the tenant
3. **Constitutional isolation** — which PRE corpus is authoritative for each screen within
   the tenant

Because PRE.resolve() is a pure deterministic function evaluated against a point-in-time
system state (screen_id, t, SystemState), the correctness of each resolution depends entirely
on which corpus definitions and schedule configurations are presented to it. Tenant isolation
is therefore a **correctness requirement**, not merely a privacy preference.

A breach of tenant isolation — where Tenant A's corpus definitions are presented to Tenant B's
screen — produces a wrong playlist. That wrong playlist is played publicly. Tenant isolation
MUST be enforced as rigorously as any constitutional invariant.

---

## 2. The Five-Tier Hierarchy

ClubHub TV uses a five-tier organizational hierarchy. Every resource in the system is anchored
to exactly one node in this hierarchy, and every node has exactly one parent (except TIER_0,
which is the root).

```
TIER_0   PLATFORM_OWNER        (ClubHub platform itself)
  │
TIER_1   ENTERPRISE_GROUP      (multi-venue commercial operator)
  │
TIER_2   REGIONAL_ORGANIZATION (optional geographic/divisional grouping)
  │
TIER_3   VENUE                 (individual location — the leaf of commercial accountability)
  │
TIER_4   SCREEN_ZONE           (functional screen area within a venue)
```

### 2.1 TIER_0 — PLATFORM_OWNER

The ClubHub platform itself. There is exactly one TIER_0 entity in any deployment. TIER_0 is
not a customer-facing entity — it is the organizational anchor for platform-level operations.

Responsibilities:
- Provision and deprovision TIER_1 entities (ENTERPRISE_GROUPs and independent venues)
- Hold and manage human authentication tokens for constitutional reset operations
- Execute platform-wide EMERGENCY_FREEZE and release it (sole holder of this authority)
- Approve canary promotions from SHADOW_ONLY to AUTHORITATIVE
- Maintain the global PRE corpus integrity seal

The PLATFORM_ADMIN role is the sole role operating at TIER_0 scope. There is no delegation
of TIER_0 authority to any lower tier.

### 2.2 TIER_1 — ENTERPRISE_GROUP

A commercial entity that owns and operates multiple venues under a single brand or management
structure. Examples: a chain of 12 sports clubs, a national hospitality group, a regional pub
chain.

An ENTERPRISE_GROUP:
- Is provisioned by PLATFORM_ADMIN
- May contain zero or more TIER_2 (REGIONAL_ORGANIZATION) groupings
- May contain TIER_3 (VENUE) entities directly (if no regional subdivision is needed)
- Holds a shared content library and enterprise-level schedule templates
- May negotiate platform-wide sponsorship agreements that propagate downward to all venues
- Has a designated ENTERPRISE_ADMIN who holds fleet-level governance authority

An enterprise group is the primary unit of commercial accountability. Billing, SLA contracts,
and enterprise support agreements are attached to TIER_1 entities.

### 2.3 TIER_2 — REGIONAL_ORGANIZATION

An optional tier for geographic or divisional grouping within an enterprise. Examples:
"Northern Division", "London Region", "Premium Tier Sites".

A REGIONAL_ORGANIZATION:
- Is created by ENTERPRISE_ADMIN
- Belongs to exactly one ENTERPRISE_GROUP
- Contains one or more TIER_3 (VENUE) entities
- May hold regional schedule templates that override enterprise defaults and are themselves
  overridable by venue-local configuration
- Has a designated REGIONAL_MANAGER

TIER_2 is optional. If an enterprise does not require geographic subdivision, all venues
attach directly under the TIER_1 ENTERPRISE_GROUP. Skipping TIER_2 does not affect
constitutional correctness — it simply collapses the schedule resolution hierarchy by one
layer (see §5 for PRE corpus scoping consequences).

### 2.4 TIER_3 — VENUE

An individual physical location. This is the primary unit of operational accountability.
Every screen belongs to a venue. Every PRE resolution is performed in the context of a venue.

A VENUE:
- Is created by ENTERPRISE_ADMIN (for enterprise-owned venues) or by PLATFORM_ADMIN
  (for independently-operated venues)
- Belongs to either a TIER_2 REGIONAL_ORGANIZATION or directly to a TIER_1 ENTERPRISE_GROUP
  or to no enterprise at all (standalone operation — see §4.2)
- Contains one or more TIER_4 (SCREEN_ZONE) entities
- Has a designated VENUE_OPERATOR
- Has its own emergency trigger scope (local emergencies affect only this venue's screens)
- Maintains a local override schedule that takes precedence over inherited enterprise/regional
  schedules when venue has local override authority

Venue commissioning (the act of bringing a venue online and enrolling its screens) is a
VENUE_OPERATOR responsibility executed after the venue record is created by ENTERPRISE_ADMIN.

### 2.5 TIER_4 — SCREEN_ZONE

A functional screen area within a venue. Examples: "Bar Zone", "Main Lounge", "Courtside",
"Reception", "Restaurant". A SCREEN_ZONE corresponds to a distinct audience context with
potentially different content appropriateness rules, sponsorship slots, and schedule timing.

A SCREEN_ZONE:
- Is created during venue setup by VENUE_OPERATOR
- Contains one or more enrolled physical screens (Raspberry Pi devices)
- Is the granularity at which PRE.resolve() is called (screen_id maps to a SCREEN_ZONE)
- May have zone-specific content exclusion rules (e.g., no alcohol advertising in the
  family-seating zone)
- Cannot exist without a parent TIER_3 VENUE

The SCREEN_ZONE is the leaf of organizational authority. PRE resolution is always invoked
with full awareness of which SCREEN_ZONE a screen belongs to, which TIER_3 VENUE that zone
is in, which TIER_2 region (if any), and which TIER_1 enterprise (if any). The resolution
corpus is scoped accordingly.

---

## 3. Tenant Boundary Enforcement

### 3.1 Data Isolation

Every row in a tenant-scoped table carries a `tenant_id` foreign key. Read queries issued
by any API layer MUST include a `WHERE tenant_id = :requesting_tenant_id` predicate. This
predicate is not optional and is not the caller's responsibility to add — it is enforced at
the data-access layer before any query reaches the database.

There is no cross-tenant JOIN permitted in any query path. If a cross-tenant data need arises
(e.g., shared sponsor content), it is resolved through a platform-owned shared resource table,
not by relaxing tenant predicates.

Data isolation failures MUST be treated as P0 security incidents, not data bugs.

### 3.2 Configuration Isolation

Schedule templates, content libraries, override policies, and emergency defaults are scoped
to the tenant that owns them. A TIER_1 enterprise's configuration is visible to all TIER_3
venues under that enterprise but is NOT visible to venues in other enterprises.

Configuration is owned at the tier level where it was created. Enterprise templates are
owned by the ENTERPRISE_GROUP. Regional overrides are owned by the REGIONAL_ORGANIZATION.
Venue-local configuration is owned by the VENUE.

### 3.3 Constitutional Isolation

The PRE corpus — the set of schedule definitions, sponsorship agreements, override records,
and emergency states that PRE.resolve() evaluates — is scoped per tenant. Specifically:

- When PRE.resolve() is called for a screen in Venue V (owned by Enterprise E, Region R),
  it receives SystemState filtered to: the venue's direct configuration, the region's
  inherited configuration, the enterprise's inherited configuration, and platform-level
  fallbacks only.
- No configuration from another tenant's TIER_1 or below is ever included in the SystemState
  passed to PRE.
- The replay audit record for every PRE invocation carries the full tenant scope chain
  (enterprise_id, region_id, venue_id, screen_zone_id) so that constitutional lineage is
  always tenant-attributed.

PLATFORM_ADMIN may observe PRE trace output across all tenants for audit purposes, but MUST
NOT use that cross-tenant visibility to inject configuration into any tenant's corpus.

---

## 4. Operational Modes

### 4.1 Multi-Tenant Mode (Standard)

The normal operating mode. Multiple ENTERPRISE_GROUPs coexist on the same platform instance.
Each has full tenant isolation as described in §3. Platform-level operations (canary promotions
to AUTHORITATIVE, EMERGENCY_FREEZE, corpus integrity checks) apply platform-wide but are
scoped in their audit lineage to each affected tenant.

### 4.2 Standalone Venue Mode

A TIER_3 VENUE with no TIER_1 or TIER_2 parent. Example: "The Anchor Hotel" — an
independently-operated venue with no enterprise affiliation.

In standalone mode:
- The venue IS its own root for configuration inheritance purposes
- There is no enterprise-level template layer; the venue's configuration is authoritative
  downward (to SCREEN_ZONEs) and has no upward inheritance path
- VENUE_OPERATOR is the highest role in the organization scope (ENTERPRISE_ADMIN authority
  is not applicable)
- Emergency escalation terminates at the venue — there is no fleet-level emergency authority
  to escalate to
- Canary promotion to FLEET_WIDE is not meaningful for a standalone venue; promotion
  authority is limited to SHADOW_ONLY → SINGLE_VENUE with PLATFORM_ADMIN approval required
  for AUTHORITATIVE
- The PRE corpus is defined entirely by venue-level configuration with platform-level
  fallbacks only

Standalone venues MUST be provisioned by PLATFORM_ADMIN, not self-provisioned.

---

## 5. PRE Corpus Scoping Per Tenant

This section defines precisely which tenant's corpus is authoritative for each screen
resolution. This is the most critical application of the tenancy model.

When `invokePRE(screen_id, t)` is called, the runtime wrapper resolves the screen's full
tenant scope chain before building SystemState:

```
screen_id
  → SCREEN_ZONE (zone_id, venue_id)
  → VENUE       (venue_id, region_id or null, enterprise_id or null)
  → REGIONAL_ORGANIZATION (region_id, enterprise_id) [if present]
  → ENTERPRISE_GROUP (enterprise_id) [if present]
```

The SystemState presented to PRE.resolve() is composed by merging configuration at each
tier, with lower tiers taking precedence over higher tiers for conflicts:

```
TIER_4 zone config (highest precedence for content exclusion rules)
  ↓ overrides where present
TIER_3 venue config (local schedule overrides, local emergency state)
  ↓ inherits from, overrides where present
TIER_2 regional config (regional templates, regional emergency state) [if present]
  ↓ inherits from, overrides where present
TIER_1 enterprise config (enterprise templates, enterprise emergency state)
  ↓ inherits from, overrides where present
TIER_0 platform config (system fallback playlist, platform emergency state) [lowest, always present]
```

The replay audit record carries the full scope chain and the resolved configuration at each
tier, enabling forensic reconstruction of exactly why a particular content item played.

---

## 6. Tenant Provisioning Lifecycle

### 6.1 Provisioning

1. PLATFORM_ADMIN creates ENTERPRISE_GROUP record (or standalone VENUE record)
2. PLATFORM_ADMIN assigns initial ENTERPRISE_ADMIN and issues initial auth tokens
3. ENTERPRISE_ADMIN creates REGIONAL_ORGANIZATION records (optional)
4. ENTERPRISE_ADMIN creates VENUE records under their enterprise
5. VENUE_OPERATOR commissions venues: enrolls screens, defines SCREEN_ZONEs
6. Venue enters INITIALIZING state → moves to HEALTHY on first successful PRE resolution

### 6.2 Active Operation

Standard operational lifecycle. VENUE_OPERATORs manage day-to-day scheduling and overrides.
ENTERPRISE_ADMINs manage fleet-level templates and canary promotion decisions. PLATFORM_ADMIN
operates at constitutional governance level only.

### 6.3 Deprovisioning

Venue deprovisioning (tenant offboarding) is a multi-step destructive operation requiring
PLATFORM_ADMIN authority:

1. Venue enters READ_ONLY state (no new manifests issued; screens show last-served content
   or system fallback)
2. Replay audit records are archived per retention policy (QUERYABLE_DAYS=90,
   ARCHIVAL_DAYS=365) — audit lineage is preserved even after deprovisioning
3. All screens are disenrolled; screen hardware releases its enrollment token
4. Venue, zone, and screen records are soft-deleted (not hard-deleted; audit log integrity)
5. Content library is archived to tenant-owned cold storage (if contractually required)
6. Enterprise record (if deprovisionable) follows the same pattern after all venues are closed

Tenant data MUST NOT be hard-deleted while replay audit records referencing that tenant
remain within their retention window.

---

## 7. Cross-Tenant Visibility Rules

### 7.1 Within an Enterprise

An ENTERPRISE_ADMIN can see all venues under their enterprise. A REGIONAL_MANAGER can see
all venues in their region. A VENUE_OPERATOR sees only their venue. All of this is
same-enterprise visibility — no tenant isolation concern.

### 7.2 Enterprise-Owned vs Independently-Operated

Two venues owned by different ENTERPRISE_GROUPs have zero visibility into each other's
data, configuration, or operational state. The platform MUST enforce this at every API layer.

Shared physical proximity (e.g., two venues in the same building owned by different
enterprises) does not create any data sharing relationship.

### 7.3 PLATFORM_ADMIN Cross-Tenant Visibility

PLATFORM_ADMIN holds read access to all tenants for:
- Platform health monitoring
- Constitutional audit (is every PRE corpus valid?)
- Replay forensics (cross-tenant investigation)
- Incident response

PLATFORM_ADMIN cross-tenant reads MUST:
- Be logged with the accessing principal's identity and reason
- Never be used to modify another tenant's configuration
- Never expose one tenant's data to another tenant's principal

The audit log for PLATFORM_ADMIN cross-tenant access is itself tenant-attributed: the record
shows which tenant's data was accessed, by whom, and when.

### 7.4 Shared Platform Resources

Certain resources exist at TIER_0 and are visible to all tenants:
- The system fallback playlist (platform-level constitutional baseline)
- PRE corpus version metadata (not the corpus itself — just the version labels)
- Platform canary stage (SHADOW_ONLY / INTERNAL_CANARY / etc.)
- Platform EMERGENCY_FREEZE state

These shared resources are read-only from any tenant's perspective. No TIER_1 or below
principal may modify shared platform resources.

---

## 8. Worked Examples

### 8.1 Premier Clubs Ltd — Enterprise Hierarchy

**Enterprise:** Premier Clubs Ltd (TIER_1, enterprise_id=pcl-001)

**Regions:**
- Northern Division (TIER_2, region_id=pcl-north, enterprise_id=pcl-001)
- Southern Division (TIER_2, region_id=pcl-south, enterprise_id=pcl-001)
- Metropolitan Region (TIER_2, region_id=pcl-metro, enterprise_id=pcl-001)

**Venues (sample):**
- Premier Harrogate (TIER_3, venue_id=pcl-hrg, region=pcl-north)
- Premier Leeds Central (TIER_3, venue_id=pcl-ldc, region=pcl-north)
- Premier Guildford (TIER_3, venue_id=pcl-gui, region=pcl-south)
- Premier Canary Wharf (TIER_3, venue_id=pcl-cw1, region=pcl-metro)
- ... (12 venues total)

**Screen Zones (example — Premier Harrogate):**
- Harrogate Bar (TIER_4, zone_id=pcl-hrg-bar)
- Harrogate Lounge (TIER_4, zone_id=pcl-hrg-lng)
- Harrogate Squash Courts (TIER_4, zone_id=pcl-hrg-sqsh)

When PRE.resolve() is called for screen `pi-hrg-bar-01` (enrolled in pcl-hrg-bar):
- Zone config: pcl-hrg-bar (bar-specific content rules — no gambling ads at all times)
- Venue config: pcl-hrg (venue schedule, venue emergency state)
- Region config: pcl-north (Northern Division template — weekend sports priority)
- Enterprise config: pcl-001 (Premier Clubs enterprise template — brand schedule)
- Platform config: TIER_0 (system fallback, platform emergency)

An ENTERPRISE_ADMIN for pcl-001 can see all 12 venues and manage fleet-wide templates.
A REGIONAL_MANAGER for pcl-north can see Premier Harrogate and Premier Leeds Central
but NOT Premier Guildford (pcl-south) or Premier Canary Wharf (pcl-metro).

### 8.2 The Anchor Hotel — Standalone Venue

**Venue:** The Anchor Hotel (TIER_3, venue_id=anchor-001, enterprise_id=null, region_id=null)

There is no TIER_1 or TIER_2 parent. The Anchor Hotel is a standalone tenant.

**Screen Zones:**
- Public Bar (TIER_4, zone_id=anchor-bar)
- Restaurant (TIER_4, zone_id=anchor-rest)
- Beer Garden (TIER_4, zone_id=anchor-garden)

When PRE.resolve() is called for screen `pi-anchor-bar-01`:
- Zone config: anchor-bar
- Venue config: anchor-001
- Regional config: (none — TIER_2 absent)
- Enterprise config: (none — TIER_1 absent)
- Platform config: TIER_0 system fallback

The VENUE_OPERATOR for The Anchor Hotel has the highest non-platform role in scope. There
is no ENTERPRISE_ADMIN for this tenant. Canary promotion beyond SINGLE_VENUE requires
PLATFORM_ADMIN involvement directly.

Emergency escalation: a local emergency at The Anchor Hotel affects only anchor-001's
screens. There is no fleet-wide escalation path — the VENUE_OPERATOR notifies PLATFORM_ADMIN
directly if platform-level response is needed.

---

## 9. Constitutional Implications

The tenancy model is constitutionally significant because:

1. **PRE purity is per-tenant.** PRE.resolve() is pure, but "pure" means the same inputs
   always produce the same outputs. Inputs include SystemState, which is tenant-scoped.
   Cross-tenant contamination of SystemState is a PRE purity violation.

2. **Replay requires tenant context.** A replay audit record without its full tenant scope
   chain cannot be faithfully replayed — the SystemState cannot be reconstructed. Every
   replay audit record MUST carry (enterprise_id, region_id, venue_id, zone_id).

3. **Emergency state is tenant-scoped.** A venue emergency does not affect screens in
   another venue. An enterprise emergency affects only that enterprise's venues. Platform
   EMERGENCY_FREEZE is the only emergency that is cross-tenant by design.

4. **Canary promotion authority is scope-aware.** An ENTERPRISE_ADMIN approving a canary
   promotion is approving it within their enterprise scope. Platform AUTHORITATIVE requires
   PLATFORM_ADMIN. These are different decisions with different scopes.

---

*See also: ORGANIZATIONAL-HIERARCHY.md, ROLE-AND-PERMISSION-MODEL.md, AUTHORITY-BOUNDARIES.md, OPERATOR-SCOPES.md*
