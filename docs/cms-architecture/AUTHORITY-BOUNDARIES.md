# AUTHORITY-BOUNDARIES.md
# ClubHub TV — Authority Boundaries

**Document type:** Architecture reference — governance and authority layer
**Status:** Ratified
**Date:** 2026-05-26
**Scope:** All authority categories, delegation rules, authority ceilings, constitutional limits
**Authority:** Derives from TENANCY-MODEL.md and ROLE-AND-PERMISSION-MODEL.md. Defines the
              authority semantics that OPERATOR-SCOPES.md implements at request time.

---

## 0. Normative Language

MUST / MUST NOT / SHOULD / MAY carry the meanings defined in ENGINEERING-CONSTITUTION-v1.md §0.

---

## 1. Authority Categories

The platform defines seven authority categories. Every consequential action on the platform
falls into exactly one primary authority category. Where actions span multiple categories
(e.g., a campaign override that includes an emergency bypass), the most restrictive category
governs.

| Category         | Description                                                 | Highest Holder       |
|------------------|-------------------------------------------------------------|----------------------|
| CONTENT          | What media exists in the library                            | ENTERPRISE_ADMIN     |
| SCHEDULING       | When and where content plays                                | ENTERPRISE_ADMIN     |
| OVERRIDE         | Displacing the standard schedule for a bounded period       | VENUE_OPERATOR (local) |
| EMERGENCY        | Immediate cessation of normal operation                     | PLATFORM_ADMIN (freeze) |
| CONFIGURATION    | System behavior parameters                                  | ENTERPRISE_ADMIN     |
| GOVERNANCE       | Platform rules, canary promotion, role assignment           | PLATFORM_ADMIN       |
| CONSTITUTIONAL   | PRE invariants, state machine, audit integrity              | PLATFORM_ADMIN only  |

---

## 2. Per-Category Authority Detail

### 2.1 CONTENT Authority

**What it covers:** Creating, modifying, archiving, and associating media content items.
A content item is anything that can appear in a PRE-resolved playlist: video files, images,
audio tracks, syndicated feed entries.

**Authority holders by scope:**
- PLATFORM_ADMIN: all content across all tenants
- ENTERPRISE_ADMIN: all content within their enterprise content library
- REGIONAL_MANAGER: regional content within their region's library
- VENUE_OPERATOR: venue-local content entries (zone-specific content rules)
- SPONSOR_STAKEHOLDER: read-only access to their own sponsored content items only

**Escalation triggers:**
- Content that contains a regulatory compliance flag (gambling, alcohol, political) requires
  ENTERPRISE_ADMIN confirmation before it can be published, even if created by VENUE_OPERATOR
- Content addition to a zone with a content exclusion rule: VENUE_OPERATOR is warned;
  rule violation requires ENTERPRISE_ADMIN override of the exclusion

**Cannot be delegated below VENUE_OPERATOR:** Content authority does not extend to
SPONSOR_STAKEHOLDER — sponsors may view their content but not modify the content library.

### 2.2 SCHEDULING Authority

**What it covers:** Creating, modifying, and publishing schedule templates at any tier.
Scheduling determines what PRE.resolve() evaluates at LEVEL_2 and LEVEL_3.

**Authority holders by scope:**
- PLATFORM_ADMIN: platform-level fallback schedule; enterprise template override in emergency
- ENTERPRISE_ADMIN: enterprise templates (propagate to all venues)
- REGIONAL_MANAGER: regional templates (propagate to region's venues)
- VENUE_OPERATOR: venue-local schedules and zone rules (within local override authority grant)

**Inheritance direction:** Configuration inherits **downward**. Enterprise templates are the
default for all venues. Regional templates override enterprise defaults for the region.
Venue schedules override regional defaults (if local override authority is granted).

**Conflict resolution:** Lower tiers take precedence over higher tiers within their scope,
but only for the configuration category where override authority has been granted. A VENUE_OPERATOR
without local override authority grant cannot override enterprise templates even by publishing
a venue schedule — the enterprise template takes precedence.

**Escalation triggers:**
- A venue schedule that conflicts with enterprise content compliance rules requires
  ENTERPRISE_ADMIN review before taking effect
- Schedule changes during active sponsorship periods require sponsorship-agreement review
  (system flags; ENTERPRISE_ADMIN confirms)

### 2.3 OVERRIDE Authority

**What it covers:** Issuing time-bounded schedule overrides that displace the normal
schedule resolution. Overrides are PRE inputs — they appear at LEVEL_1 or LEVEL_2 and
are evaluated by PRE.resolve() within normal invariants.

**Authority holders by scope:**
- PLATFORM_ADMIN: platform-wide override (affects all tenants — for constitutional emergencies)
- ENTERPRISE_ADMIN: enterprise-wide override (all venues in enterprise)
- REGIONAL_MANAGER: region-wide override (all venues in region)
- VENUE_OPERATOR: venue-local and zone-local override (requires local override authority grant)

**Override hierarchy (highest wins):**
```
Platform emergency [LEVEL_0, always beats all overrides]
Enterprise emergency [LEVEL_0, beats all non-platform overrides]
Venue emergency [LEVEL_0, beats all local overrides]
Campaign override [LEVEL_1, beats schedule default]
Schedule default [LEVEL_2, base resolution]
```

**Override scope boundary:** An override issued at a given tier affects only the screens
within that tier's scope. An ENTERPRISE_ADMIN override does not affect screens in other
enterprises. A VENUE_OPERATOR override does not affect other venues in the same enterprise.

**Override expiry:** All overrides MUST have an expiry. Indefinite overrides are not
permitted. Maximum override duration is configurable per enterprise (default: 24 hours).
If an override expires and no new schedule is active, resolution falls through to inherited
enterprise template or platform fallback.

### 2.4 EMERGENCY Authority

Emergency authority is the most consequential authority on the platform. Emergency state
activates PRE LEVEL_0 — the terminates all normal resolution and serves a designated
emergency content loop or system fallback.

**Three tiers of emergency, with distinct scopes and holders:**

#### Local Emergency (VENUE scope)

**Trigger authority:** VENUE_OPERATOR (and above)
**Scope of effect:** All screens in the triggering venue only
**Acknowledgment:** VENUE_OPERATOR must acknowledge; REGIONAL_MANAGER is notified
**Release authority:** VENUE_OPERATOR (and above)
**PRE behavior:** LEVEL_0 terminates resolution for venue screens; emergency content or
                  system fallback is served

**Local emergency does NOT:**
- Affect screens in any other venue (even within the same enterprise)
- Require ENTERPRISE_ADMIN involvement to trigger or release
- Propagate upward automatically

#### Fleet Emergency (ENTERPRISE scope)

**Trigger authority:** ENTERPRISE_ADMIN (and PLATFORM_ADMIN)
**Scope of effect:** All screens across all venues in the enterprise
**Acknowledgment:** ENTERPRISE_ADMIN acknowledges; REGIONAL_MANAGERs and VENUE_OPERATORs
                   are notified
**Release authority:** ENTERPRISE_ADMIN (and PLATFORM_ADMIN)
**PRE behavior:** LEVEL_0 for all enterprise screens

**Fleet emergency does NOT:**
- Affect screens in other enterprises on the platform
- Require PLATFORM_ADMIN to trigger (PLATFORM_ADMIN may trigger, but ENTERPRISE_ADMIN is sufficient)
- Auto-escalate to platform freeze (human decision required)

#### Constitutional Freeze — EMERGENCY_FREEZE (PLATFORM scope)

**Trigger authority:** PLATFORM_ADMIN only. No other role can trigger EMERGENCY_FREEZE.
**Scope of effect:** ALL screens across ALL tenants on the platform
**Acknowledgment:** PLATFORM_ADMIN holds constitutional responsibility
**Release authority:** PLATFORM_ADMIN only, with non-empty human-auth token (≥8 characters)
**PRE behavior:** Platform enters EMERGENCY_FREEZE state; PRE.resolve() returns system
                  fallback for all screens; no tenant can override this with a local config

**EMERGENCY_FREEZE rules:**
- There is NO automatic release. The constitutional state machine has no self-healing path
  from EMERGENCY_FREEZE. A human PLATFORM_ADMIN with a valid token MUST manually release.
- EMERGENCY_FREEZE cannot be triggered by ENTERPRISE_ADMIN, REGIONAL_MANAGER, or
  VENUE_OPERATOR under any circumstances. If any lower-tier role's action could trigger
  EMERGENCY_FREEZE (e.g., a bug in an emergency escalation path), this is a critical defect.
- EMERGENCY_FREEZE log entries are never purged. They are permanently retained audit records.
- Sponsors MUST NOT be notified of EMERGENCY_FREEZE via automated channels. Sponsor-facing
  status should show only "screens temporarily unavailable."

**Emergency escalation path (deliberate human decision at each step):**
```
Local emergency (VENUE_OPERATOR)
  → Human decision: escalate?
  → Fleet emergency (ENTERPRISE_ADMIN)
  → Human decision: escalate?
  → PLATFORM_ADMIN consultation
  → Human decision: freeze platform?
  → EMERGENCY_FREEZE (PLATFORM_ADMIN, with token)
```

There is no automated escalation. Escalation is always a conscious human decision.

### 2.5 CONFIGURATION Authority

**What it covers:** System behavior parameters that are not schedule or content: entropy
thresholds, circuit breaker settings, shadow execution sampling rates, replay audit
retention periods, content exclusion rule categories.

**Authority holders by scope:**
- PLATFORM_ADMIN: global configuration defaults; constitutional parameters
- ENTERPRISE_ADMIN: enterprise-level parameter overrides (within platform-allowed ranges)
- VENUE_OPERATOR: venue-local parameters (within enterprise-allowed ranges)

**Constitutional parameters (PLATFORM_ADMIN only):**
- Entropy circuit breaker threshold
- Shadow parity circuit breaker threshold
- Replay audit retention window (QUERYABLE_DAYS, ARCHIVAL_DAYS)
- PRE circuit breaker recovery probe interval
- Global constitutional state machine allowed transitions

These parameters have system-wide safety implications. An ENTERPRISE_ADMIN MUST NOT be
able to set entropy thresholds so high that entropy alerts never fire — this would suppress
a safety signal.

**Configuration cannot be delegated:** An enterprise cannot grant a venue the ability to
modify parameters that are enterprise-governed. The configuration scope boundary is the
same as the role scope boundary.

### 2.6 GOVERNANCE Authority

**What it covers:** Platform rules, canary promotion, role assignment, tenant provisioning,
policy definition.

**Authority holders:**
- PLATFORM_ADMIN: all governance authority; unique ability to create enterprises and assign
  ENTERPRISE_ADMIN roles
- ENTERPRISE_ADMIN: fleet governance within their enterprise; can create venues, assign
  REGIONAL_MANAGER and VENUE_OPERATOR roles
- REGIONAL_MANAGER: regional governance within their region; can assign VENUE_OPERATOR
  within their region

**Delegated administration — permitted:**
ENTERPRISE_ADMIN MAY delegate REGIONAL_MANAGER creation (creating REGIONAL_ORGANIZATION
entities and assigning REGIONAL_MANAGER roles). This is a standard operational delegation.

**Delegated administration — prohibited:**
ENTERPRISE_ADMIN MUST NOT create other ENTERPRISE_ADMIN accounts. Creating an
ENTERPRISE_ADMIN requires PLATFORM_ADMIN action. This prevents authority escalation
within an enterprise — no enterprise can self-expand its highest authority role without
platform oversight.

REGIONAL_MANAGER MUST NOT create regional organizations. They govern existing ones;
ENTERPRISE_ADMIN creates them.

### 2.7 CONSTITUTIONAL Authority

**What it covers:** PRE invariants, constitutional state machine transitions, audit record
integrity, corpus integrity verification, canary AUTHORITATIVE promotion.

**Sole holder:** PLATFORM_ADMIN only.

Constitutional authority cannot be delegated under any circumstances. It is not a
configurable setting. No API endpoint permits constitutional operations without
PLATFORM_ADMIN credentials and human-auth token.

**Constitutional operations:**
- Release EMERGENCY_FREEZE
- Approve FLEET_WIDE → AUTHORITATIVE canary promotion
- Execute corpus integrity repair
- Issue constitutional override (platform-wide fallback schedule)
- Reset global constitutional circuit breaker

---

## 3. Inherited vs Granted Authority

### 3.1 Inherited Authority

ENTERPRISE_ADMIN inherits all venue-level permissions for every venue in their enterprise.
They do not need an explicit VENUE_OPERATOR grant for each venue — enterprise scope
implies venue authority.

Similarly, REGIONAL_MANAGER inherits venue-level oversight permissions (not full mutation
authority) for all venues in their region.

Inheritance is hierarchical and downward:
```
PLATFORM_ADMIN inherits → ENTERPRISE_ADMIN capabilities for all enterprises
ENTERPRISE_ADMIN inherits → VENUE_OPERATOR capabilities for all enterprise venues
REGIONAL_MANAGER inherits → venue read + entropy ack + emergency ack for region venues
```

Inheritance does NOT work upward. A VENUE_OPERATOR cannot inherit regional or enterprise
authority even if they are the only person currently active for their enterprise.

### 3.2 Granted Authority

Certain authorities are NOT inherited — they must be explicitly granted:

- **Local override authority for VENUE_OPERATOR:** An ENTERPRISE_ADMIN must explicitly
  grant a specific venue the ability to publish schedules that override enterprise templates.
  Without this grant, venue schedules take effect below the enterprise template in the
  resolution stack (they are additional, not overriding).

- **AUDITOR scope extension:** An AUDITOR is assigned to a specific enterprise scope. If
  they need to audit a second enterprise, a second AUDITOR assignment is required.

- **Cross-region entropy acknowledgment:** A REGIONAL_MANAGER acknowledges entropy for
  their region. If they need to cover an adjacent region during a manager's absence,
  temporary REGIONAL_MANAGER role for the adjacent region must be granted by ENTERPRISE_ADMIN.

---

## 4. Sponsor Authority Ceiling

The SPONSOR_STAKEHOLDER authority ceiling is absolute and cannot be raised by any mechanism:

```
SPONSOR_STAKEHOLDER ceiling:
  READ (content, schedule preview, own content performance)
  No PUBLISH
  No OVERRIDE
  No EMERGENCY
  No ENTROPY_ACK
  No CANARY_APPROVE
  No CONSTITUTIONAL_RESET
```

This ceiling applies regardless of:
- The commercial value of the sponsorship relationship
- Contractual agreements that reference "platform access"
- Executive decisions made without platform team involvement

If a contractual agreement has been made that implies sponsor access beyond this ceiling,
the implementation MUST NOT honor the excess access. The correct resolution is to
renegotiate the contract or build a purpose-specific reporting interface.

Sponsors who need performance data receive it through the sponsor reporting dashboard
(purpose-built for sponsor-visible data only) — not through operational platform access.

---

## 5. Five Things No Authority Level May Do

These prohibitions are absolute. They exist at a layer above role-based access control.
Even PLATFORM_ADMIN cannot perform these actions — they are architectural invariants
enforced in code (FP-20 through FP-25), not access policy.

**1. Bypass PRE.resolve()**
No authority level can make content play on a screen without going through PRE.resolve().
Emergency overrides, platform fallbacks, and operator overrides all work by changing the
INPUTS to PRE.resolve() — they do not skip it. Any code path that serves content without
calling invokePRE() is a constitutional violation.

**2. Mutate PRE outputs post-resolution**
Once PRE.resolve() returns a PRE_Output, no field of that output may be modified by any
system component. FP-20 (`runtime_no_pre_mutation: no direct assignment to pre_output.*`)
enforces this at the code level. This includes audit system components — even the audit
writer may not alter pre_output fields before persisting them.

**3. Skip invariant checks**
The 9 PRE invariants (INV-1 through INV-9, as defined in ENGINEERING-CONSTITUTION-v1.md §3)
run on every PRE invocation. No role, no configuration parameter, and no emergency state
can disable invariant checking. `runAllInvariants()` is unconditional.

**4. Auto-promote canary to AUTHORITATIVE**
The canary promotion path SHADOW_ONLY → AUTHORITATIVE requires human approval at every
stage transition. FP-24 (`no_auto_promotion: canary_stage direct assignment blocked`)
enforces this at the code level. Promotion by scheduled job, automated metric threshold,
or any non-human trigger is prohibited.

**5. Self-reset EMERGENCY_FREEZE**
EMERGENCY_FREEZE is a constitutional state with no automated exit. The state machine's
allowed-transitions table has no transition FROM EMERGENCY_FREEZE that is automated.
Release requires PLATFORM_ADMIN with a valid human-auth token. No system component may
clear EMERGENCY_FREEZE without human authorization.

---

## 6. Override Authority Hierarchy in Full

When multiple overrides are active simultaneously, the following strict precedence applies:

```
Priority  Source                          PRE Level  Notes
────────  ──────────────────────────────  ─────────  ──────────────────────────────────────
1         Platform EMERGENCY_FREEZE        LEVEL_0    System fallback; all zones; all tenants
2         Enterprise fleet emergency       LEVEL_0    All enterprise venues; not cross-tenant
3         Venue local emergency            LEVEL_0    This venue's screens only
4         Platform content override        LEVEL_1    Rare; platform crisis messaging only
5         Enterprise campaign override     LEVEL_1    Enterprise-published; all venues in scope
6         Regional campaign override       LEVEL_1    Regional MANAGER published; region scope
7         Venue campaign override          LEVEL_1    VENUE_OPERATOR published; venue scope
8         Enterprise schedule template     LEVEL_2    Default for all venues without local overrides
9         Regional schedule template       LEVEL_2    Overrides enterprise template for region
10        Venue local schedule             LEVEL_2    Overrides regional (requires override grant)
11        Sponsorship slots (additive)     LEVEL_4    SOV-weighted; additive to base playlist
12        System structural fallback       LEVEL_5    Platform-level; always present
```

Priorities 1-3 are mutually exclusive within their scope (a venue cannot be in both venue
emergency and fleet emergency with different content — fleet emergency applies to all venues
in the enterprise including those with active local emergencies).

Priorities 4-7 can coexist across different scopes but resolve to the highest-priority
applicable override at each screen.

---

*See also: TENANCY-MODEL.md, ORGANIZATIONAL-HIERARCHY.md, ROLE-AND-PERMISSION-MODEL.md, OPERATOR-SCOPES.md*
