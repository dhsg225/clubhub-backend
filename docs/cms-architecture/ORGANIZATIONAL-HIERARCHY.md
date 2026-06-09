# ORGANIZATIONAL-HIERARCHY.md
# ClubHub TV — Organizational Hierarchy

**Document type:** Architecture reference
**Status:** Ratified
**Date:** 2026-05-26
**Scope:** Organizational structure, schedule inheritance, hierarchy operations
**Authority:** Derives from TENANCY-MODEL.md. Supplements ENGINEERING-CONSTITUTION-v1.md.

---

## 0. Normative Language

MUST / MUST NOT / SHOULD / MAY carry the meanings defined in ENGINEERING-CONSTITUTION-v1.md §0.

---

## 1. Full Hierarchy Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TIER_0: PLATFORM_OWNER                                                 │
│  ClubHub TV Platform                                                    │
│  Authority: PLATFORM_ADMIN                                              │
│  Scope: All tenants, all regions, all venues, all screens               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ provisions
           ┌───────────────────┼────────────────────┐
           │                   │                    │
┌──────────▼──────────┐  ┌─────▼───────────┐  ┌────▼──────────────────┐
│ TIER_1:             │  │ TIER_1:         │  │ TIER_3:               │
│ ENTERPRISE_GROUP    │  │ ENTERPRISE_GROUP │  │ VENUE (standalone)    │
│ "Premier Clubs Ltd" │  │ "Sports Direct  │  │ "The Anchor Hotel"    │
│ ENTERPRISE_ADMIN    │  │  Venues Ltd"    │  │ VENUE_OPERATOR        │
│ 12 venues           │  │ ENTERPRISE_ADMIN│  │ No TIER_1/2 parent    │
└──────────┬──────────┘  │ 8 venues        │  └────────────┬──────────┘
           │             └─────────────────┘               │
    ┌──────┴──────┐                                         │
    │             │                              ┌──────────▼──────────┐
┌───▼───────┐ ┌──▼──────────┐                   │ TIER_4: SCREEN_ZONE  │
│ TIER_2:   │ │ TIER_2:     │                   │ "Public Bar"         │
│ REGIONAL  │ │ REGIONAL    │                   │ "Restaurant"         │
│ "Northern │ │ "Southern   │                   │ "Beer Garden"        │
│ Division" │ │ Division"   │                   └─────────────────────┘
│ REGIONAL  │ │ REGIONAL    │
│ MANAGER   │ │ MANAGER     │
└───┬───────┘ └──┬──────────┘
    │            │
┌───▼───────┐ ┌──▼──────────┐
│ TIER_3:   │ │ TIER_3:     │
│ VENUE     │ │ VENUE       │
│ "Premier  │ │ "Premier    │
│ Harrogate"│ │ Guildford"  │
│ VENUE_OP  │ │ VENUE_OP    │
└───┬───────┘ └─────────────┘
    │
┌───▼───────────────────────────┐
│ TIER_4: SCREEN_ZONE           │
│ "Bar Zone" | "Main Lounge"    │
│ "Squash Courts" | "Reception" │
└───────────────────────────────┘
```

---

## 2. Tier Responsibilities and Authority

### 2.1 TIER_0 — PLATFORM_OWNER

**Created by:** Not created — exists at platform initialization
**Deleted by:** Not deletable in normal operation (platform decommission only)

**Responsibilities:**
- Provision and deprovision ENTERPRISE_GROUP entities and standalone venues
- Issue and rotate platform-level authentication tokens
- Manage constitutional state machine (EMERGENCY_FREEZE, canary AUTHORITATIVE promotion)
- Perform platform-wide corpus integrity verification
- Audit any tenant's replay log for forensic or compliance purposes
- Maintain the system fallback playlist at platform level

**Cannot be delegated:** No TIER_0 responsibility may be delegated to any lower tier.
PLATFORM_ADMIN is the sole role at this tier.

### 2.2 TIER_1 — ENTERPRISE_GROUP

**Created by:** PLATFORM_ADMIN only
**Deleted by:** PLATFORM_ADMIN only (after all TIER_2/3 children are closed)

**Responsibilities:**
- Manage enterprise-wide content library
- Define enterprise schedule templates (propagate to all child venues unless overridden)
- Create and delete REGIONAL_ORGANIZATION entities
- Create and delete VENUE entities under the enterprise
- Assign ENTERPRISE_ADMIN, REGIONAL_MANAGER, and VENUE_OPERATOR roles
- Approve canary stage transitions from SHADOW_ONLY to FLEET_WIDE (not to AUTHORITATIVE)
- Trigger fleet-wide emergencies affecting all enterprise venues
- Negotiate enterprise-level sponsorship agreements

**Cannot be delegated to TIER_2:** ENTERPRISE_ADMIN may not create new ENTERPRISE_GROUP
entities. An ENTERPRISE_ADMIN governs their enterprise; they cannot expand the enterprise
structure above TIER_1.

### 2.3 TIER_2 — REGIONAL_ORGANIZATION (Optional)

**Created by:** ENTERPRISE_ADMIN only
**Deleted by:** ENTERPRISE_ADMIN only (after all TIER_3 children are reassigned or closed)

**Responsibilities:**
- Define regional schedule templates (override enterprise templates; overridable by venue)
- Manage multi-venue emergency acknowledgment within the region
- Review and acknowledge entropy reports for all venues in the region
- Assign VENUE_OPERATOR roles for venues in the region (REGIONAL_MANAGER may do this)
- Coordinate cross-venue scheduling decisions within the region

**Optional:** If an enterprise does not need regional subdivision, TIER_2 is absent. Venues
attach directly to TIER_1. There is no requirement to use TIER_2.

### 2.4 TIER_3 — VENUE

**Created by:** ENTERPRISE_ADMIN (enterprise-owned) or PLATFORM_ADMIN (standalone)
**Deleted by:** Same authority as creation; requires all TIER_4 children to be decommissioned

**Responsibilities:**
- Commission physical location: enroll screens, define SCREEN_ZONEs
- Manage day-to-day scheduling overrides within venue authority
- Publish local campaigns
- Trigger local emergencies (venue-scoped)
- Acknowledge venue-level entropy alerts
- Manage venue-specific content exclusion rules (alcohol ads, age-appropriate content)
- Maintain venue contact and location metadata

**Local override authority:** When a venue has been granted local override authority by its
ENTERPRISE_ADMIN, it may publish venue-local schedules that take precedence over inherited
enterprise/regional templates. This authority must be explicitly granted — it is not default.

### 2.5 TIER_4 — SCREEN_ZONE

**Created by:** VENUE_OPERATOR
**Deleted by:** VENUE_OPERATOR (requires all enrolled screens to be disenrolled first)

**Responsibilities:**
- Define functional screen grouping within the venue
- Hold zone-specific content rules (the most granular content policy layer)
- Be the target of PRE.resolve() invocations (all resolutions are zone-contextual)
- Contain one or more enrolled Pi devices

**Zone-specific rules take highest precedence** in the configuration inheritance chain.
Zone rules cannot be overridden by venue, regional, or enterprise configuration — zone rules
represent the final authority on what content is permissible in that physical space.

---

## 3. Optional vs Required Tiers

| Tier  | Required | Minimum Count | Maximum Count |
|-------|----------|---------------|---------------|
| TIER_0 | Always   | 1             | 1             |
| TIER_1 | Only for enterprise tenants | 0 per platform | Unlimited |
| TIER_2 | Never — always optional | 0 per enterprise | Unlimited |
| TIER_3 | Yes — minimum 1 for any operational platform | 1 | Unlimited |
| TIER_4 | Yes — minimum 1 per operational venue | 1 per venue | Unlimited |

A platform with zero venues is valid (bootstrapping state) but cannot serve content.
A venue with zero zones is valid (provisioned, not yet commissioned) but cannot resolve content.
A zone with zero screens is valid (defined, not yet enrolled) — PRE.resolve() is never called.

---

## 4. Schedule Resolution and Hierarchy

Schedule configuration inherits downward through the tier hierarchy. Lower tiers may
override inherited configuration when they have the authority to do so.

### 4.1 Resolution Order (Highest to Lowest Precedence)

```
TIER_4 zone-specific content exclusion rules    [always applied; cannot be overridden]
TIER_3 venue local override schedule            [requires local override authority grant]
TIER_3 venue base schedule
TIER_2 regional template schedule               [if TIER_2 exists]
TIER_1 enterprise template schedule
TIER_0 platform system fallback                 [always present; lowest precedence]
```

This maps directly to PRE level selection:
- LEVEL_0 (Emergency): sourced from the nearest active emergency (venue → region → enterprise → platform)
- LEVEL_1 (Operational override): sourced from venue-local override (if authority granted)
- LEVEL_2 (Scheduled): resolved against the merged schedule stack above
- LEVEL_5 (Structural fallback): platform system fallback

### 4.2 Emergency Escalation Direction

Emergency state propagates **upward** (venue → region → enterprise → platform) for escalation
purposes but applies **downward** (platform → enterprise → region → venue → zone) for effect.

When a venue triggers a local emergency:
1. Venue-scope screens immediately enter emergency state
2. Venue VENUE_OPERATOR acknowledges and manages the emergency
3. REGIONAL_MANAGER is notified (but does not need to act unless escalating)
4. No automatic escalation occurs — escalation is a deliberate human decision

When PLATFORM_ADMIN triggers EMERGENCY_FREEZE:
1. All screens on the platform enter constitutional freeze
2. No schedules are evaluated; PRE.resolve() returns system fallback
3. Release requires PLATFORM_ADMIN human token (non-empty, ≥8 chars)
4. This cannot be triggered by any lower-tier role

### 4.3 Configuration Inheritance Conflicts

When a venue has a configuration value that conflicts with an inherited enterprise value, the
venue value takes precedence IF the venue has local override authority for that configuration
category. If it does not, the enterprise value applies.

Configuration categories where venue ALWAYS takes precedence (no grant required):
- Physical screen enrollment records
- Zone definitions
- Local emergency triggers

Configuration categories requiring explicit override authority grant:
- Schedule content (which playlists play when)
- Sponsorship exclusions
- Content category rules

---

## 5. Orphaned Venue Handling

An **orphaned venue** is a TIER_3 VENUE whose TIER_1 parent ENTERPRISE_GROUP has been
deleted or whose TIER_2 parent REGIONAL_ORGANIZATION has been deleted.

### 5.1 Enterprise Parent Deletion

If an ENTERPRISE_GROUP is deleted while it still has active venues, the deletion MUST be
rejected. PLATFORM_ADMIN MUST first either:

- Reassign all child venues to another enterprise (re-parenting, see §7), OR
- Explicitly close all child venues (venue deprovisioning per TENANCY-MODEL.md §6.3)

There is no automatic orphaning. The referential integrity is enforced at the API layer,
not only at the database layer.

### 5.2 Regional Parent Deletion

If a REGIONAL_ORGANIZATION is deleted, its child venues MUST be:
- Reassigned to another region in the same enterprise, OR
- Attached directly to the TIER_1 enterprise (removing the regional grouping)

There is no automatic orphaning at TIER_2 deletion. ENTERPRISE_ADMIN executes this
reassignment as part of the regional deletion workflow.

### 5.3 Orphan State (Abnormal — Emergency Recovery Only)

In the event of a platform data integrity incident that results in a venue with no resolvable
parent, the venue enters DEGRADED state and its screens serve the system fallback playlist.
PRE.resolve() continues to function — the platform fallback provides a valid LEVEL_5 output.
PLATFORM_ADMIN must resolve the orphan state before the venue can return to HEALTHY.

---

## 6. Worked Example — Premier Golf Management

**Enterprise:** Premier Golf Management (TIER_1, enterprise_id=pgm-001)

**Regions:**
- Northern Division (TIER_2, region_id=pgm-north)
  - Harrogate Golf Club (TIER_3, venue_id=pgm-hrg)
  - York Golf Club (TIER_3, venue_id=pgm-york)
  - Leeds Golf Club (TIER_3, venue_id=pgm-lds)

- Southern Division (TIER_2, region_id=pgm-south)
  - Guildford Golf Club (TIER_3, venue_id=pgm-gui)
  - Brighton Golf Club (TIER_3, venue_id=pgm-bri)

```
Schedule resolution for a screen in Harrogate Golf Club, Bar Zone:

1. Zone: pgm-hrg-bar
   → Rule: no spirits advertising before 17:00

2. Venue: pgm-hrg (Harrogate Golf Club)
   → Saturday tournament schedule override (weekend priority)

3. Region: pgm-north (Northern Division)
   → Regional weekend sports template: Golf highlights 12:00-18:00

4. Enterprise: pgm-001 (Premier Golf Management)
   → Brand schedule: PGM promotional content 2 slots/hour

5. Platform: TIER_0
   → System fallback: ClubHub default loop

Resolution: Saturday 14:00 → Tournament schedule (TIER_3) + PGM brand (TIER_1) +
             Northern sports template (TIER_2, supplements tournament) +
             Bar zone no-spirits rule applied (filters content)
```

An ENTERPRISE_ADMIN for pgm-001 can:
- View all 5 venues
- Publish enterprise templates affecting all 5 venues
- Create/delete regions and venues
- Approve fleet-wide canary promotion

A REGIONAL_MANAGER for pgm-north can:
- View Harrogate, York, Leeds
- Publish regional templates affecting those 3 venues
- Acknowledge multi-venue entropy alerts in the northern region
- Cannot view or affect pgm-south venues

A VENUE_OPERATOR for pgm-hrg can:
- Manage Harrogate Golf Club only
- Publish local campaigns for Harrogate
- Trigger local emergency for Harrogate screens
- Cannot view York or Leeds data

---

## 7. Cross-Enterprise Shared Resources

### 7.1 Shared Sponsor Agreements

A sponsor (e.g., a national beverage brand) may have commercial agreements with multiple
enterprises. These are NOT modeled as a shared resource at the enterprise level — each
enterprise holds its own instance of the sponsorship agreement. This preserves tenant
isolation while accommodating the commercial reality.

The platform does not model a "global sponsor entity" that crosses enterprise boundaries.
If two enterprises share a sponsor, they each independently configure the sponsor's SOV
(share of voice) within their respective corpora.

### 7.2 Shared Content Libraries

Shared content (e.g., a sports channel's syndicated feed licensed to multiple enterprises)
is distributed as platform-provisioned content entries, not as cross-enterprise library
sharing. PLATFORM_ADMIN publishes the shared content item; each enterprise's ENTERPRISE_ADMIN
configures whether and how it appears in their schedule.

### 7.3 What Cannot Be Shared

The following MUST NEVER be shared across enterprise boundaries:
- PRE corpus definitions (schedule templates, override records)
- Emergency state
- Parity records and canary stage progression
- Replay audit logs

---

## 8. Merger and Acquisition — Venue Re-parenting

When a group of venues changes enterprise ownership (acquisition, outsourcing, partnership),
PLATFORM_ADMIN performs venue re-parenting:

### 8.1 Re-parenting Process

1. Destination enterprise (or standalone designation) MUST exist before re-parenting begins
2. PLATFORM_ADMIN issues re-parent command: `venue re-parent <venue_id> <target_enterprise_id>`
3. Venue enters READ_ONLY during transition (screens serve last-resolved manifest)
4. All active schedules on the venue are suspended (not deleted — kept in archive)
5. Venue's parent references are updated atomically
6. Venue VENUE_OPERATOR's scope is rebound to the new enterprise context
7. Destination ENTERPRISE_ADMIN reviews and republishes applicable enterprise templates
8. Venue exits READ_ONLY and enters INITIALIZING in the new enterprise context
9. First successful PRE resolution in new context → HEALTHY

### 8.2 Audit Lineage Preservation

Re-parenting does NOT modify historical replay audit records. Records created before the
re-parent carry the original enterprise_id and are preserved exactly as written. This is
required for historical forensic accuracy — the audit log is immutable.

Post-re-parent records carry the new enterprise_id. The transition point is logged as a
`TenantReParentLog` entry in the audit stream.

### 8.3 Configuration After Re-parenting

After re-parenting:
- Old enterprise templates no longer apply (the enterprise scope chain has changed)
- Regional membership is reset (venue attaches directly to TIER_1 until ENTERPRISE_ADMIN
  assigns it to a region)
- New enterprise templates apply after ENTERPRISE_ADMIN explicitly publishes them to the
  re-parented venue
- The venue retains its zone definitions and screen enrollments — physical commissioning
  does not need to be repeated

---

*See also: TENANCY-MODEL.md, ROLE-AND-PERMISSION-MODEL.md, AUTHORITY-BOUNDARIES.md, OPERATOR-SCOPES.md*
