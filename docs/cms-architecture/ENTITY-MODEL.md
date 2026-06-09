# ClubHub TV — CMS Entity Model
# Information Architecture Layer

**Document type:** Canonical entity reference — authoritative data model for CMS and operator surfaces
**Authority:** CMS Architecture
**Audience:** Backend engineers, CMS implementation, UX, agent phases 3–7
**Last updated:** 2026-05-26
**Status:** CANONICAL — downstream implementation must conform

---

## Purpose

This document defines every canonical entity in the ClubHub TV CMS, including its attributes,
ownership boundaries, lifecycle states, and constitutional implications. Entities defined here
are the input vocabulary for PRE.resolve(). The PRE is a pure function: its behavior is
entirely determined by the state of these entities at evaluation time. Any entity that does
not appear here has no authority over resolution.

---

## Governing Philosophy

**Entities are resolution inputs, not outputs.** Operators configure entities. The PRE reads
them. Outputs (playlists, manifests, checksums) are computed, not stored. This distinction is
constitutional.

**Lifecycle state is an input.** An entity in DRAFT state is invisible to the PRE. An entity
in ARCHIVED state has no effect on resolution. Lifecycle state controls PRE visibility — it
is not cosmetic.

**Ownership is authority.** Every entity has an owning tier. Ownership defines who may create,
modify, and archive an entity. Ownership is not delegatable below the owning tier without
explicit permission grants.

---

## Section 1 — Organizational Hierarchy Entities

---

### 1.1 Organization

**Description:** A legal or operational grouping of venues. Organizations correspond to
ENTERPRISE_GROUP (Tier 2) and REGIONAL_ORG (Tier 3) nodes in the 5-tier hierarchy. An
Organization has no direct screen presence — it governs venues. A PLATFORM_OWNER (Tier 1)
entity is represented by the platform itself and does not require an explicit Organization
record.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `org_id`              | UUID       | Immutable primary identifier                                      |
| `parent_org_id`       | UUID\|null | Parent organization; null for top-level enterprise groups         |
| `org_name`            | string     | Display name; mutable                                             |
| `org_tier`            | enum       | `ENTERPRISE_GROUP` or `REGIONAL_ORG`                              |
| `market_verticals`    | string[]   | Markets this org operates in: `GOLF`, `LICENSED_CLUB`, `HOTEL`, `SPORTS_BAR`, `RESTAURANT`, `COMMUNITY`, `ENTERPRISE` |
| `default_timezone`    | string     | IANA timezone string; inherited by venues unless overridden       |
| `compliance_profile`  | string[]   | Compliance content categories required for this org's venues      |
| `created_at`          | timestamp  | Immutable                                                         |
| `created_by`          | user_id    | Immutable                                                         |
| `status`              | enum       | See lifecycle                                                     |

**Owned by:** Parent Organization or PLATFORM_OWNER
**Created by:** PLATFORM_ADMIN (Tier 1 orgs); ENTERPRISE_ADMIN (Tier 3 regional orgs under their enterprise)

**Lifecycle states:**

```
ACTIVE ──────────────────────────────────────────────────────► SUSPENDED
  ▲                                                                  │
  │                 (PLATFORM_ADMIN only)                            │
  └──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                           TERMINATED
```

- `ACTIVE`: Organization is operational. Venues may be added. Campaigns may run.
- `SUSPENDED`: Billing or compliance suspension. Venues still exist but PRE falls to L5 fallback for all venue screens.
- `TERMINATED`: Soft-delete. Organization record and all child entities are retained for audit. No child entities may be activated.

**State transition rules:**
- ACTIVE → SUSPENDED: PLATFORM_ADMIN only. Generates audit record. Suspends all child venues.
- SUSPENDED → ACTIVE: PLATFORM_ADMIN only. Restores child venues to their pre-suspension status.
- ACTIVE or SUSPENDED → TERMINATED: PLATFORM_ADMIN only. Irreversible. All child Venue, Screen, Campaign, Schedule, Override records are archived.

**Constitutional implications:** Organization status changes are audited at the point of mutation. The PRE reads `org.status` indirectly through venue-level context. No PRE output depends directly on an Organization record — the effect flows through the Venue's corpus binding.

---

### 1.2 Venue

**Description:** A physical location operating ClubHub TV screens. The Venue is the
fundamental operational unit. Each Venue has exactly one PRE corpus binding (a CorpusVersion)
deployed to its screens. The Venue is the context boundary for emergencies, overrides, and
entropy reports.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `venue_id`            | UUID       | Immutable primary identifier                                      |
| `org_id`              | UUID       | Owning organization                                               |
| `venue_name`          | string     | Display name; mutable                                             |
| `market_vertical`     | enum       | `GOLF`, `LICENSED_CLUB`, `HOTEL`, `SPORTS_BAR`, `RESTAURANT`, `COMMUNITY`, `ENTERPRISE` |
| `timezone`            | string     | IANA timezone; overrides org default; used for all venue-local schedule evaluation |
| `address`             | object     | Street, city, state, country; used for geographic targeting       |
| `active_corpus_id`    | UUID\|null | Currently deployed CorpusVersion; null before first deployment    |
| `compliance_profile`  | string[]   | Inherited from org; may be extended; may not be reduced           |
| `entropy_alert_level` | enum       | `NONE`, `WARNING`, `CRITICAL`; set by entropy scheduler          |
| `operational_mode`    | enum       | `NORMAL`, `SHADOW`, `CANARY`, `DEGRADED`, `EMERGENCY`; see OPERATIONAL-CONTEXTS.md |
| `created_at`          | timestamp  | Immutable                                                         |
| `created_by`          | user_id    | Immutable                                                         |
| `status`              | enum       | See lifecycle                                                     |

**Owned by:** Organization
**Created by:** ENTERPRISE_ADMIN or REGIONAL_MANAGER (for their org scope)

**Lifecycle states:**

```
ONBOARDING ──────► ACTIVE ──────► SUSPENDED ──────► DECOMMISSIONED
                     │                 ▲
                     └─────────────────┘
                      (REGIONAL_MANAGER+)
```

- `ONBOARDING`: Venue record exists, no screens enrolled, no corpus deployed. PRE not invoked.
- `ACTIVE`: Operational. Screens enrolled. Corpus deployed. PRE resolves normally.
- `SUSPENDED`: Venue-level suspension. Screens exist but receive L5 fallback from PRE. New campaigns may not be activated.
- `DECOMMISSIONED`: Soft-delete. Records retained for audit. No screens may poll. Irreversible without PLATFORM_ADMIN action.

**Constitutional implications:** `venue_id` is passed as context to PRE.resolve(). The venue's
`timezone` is used for all schedule evaluation — incorrect timezone causes all time-of-day
schedule rules to evaluate incorrectly. The `active_corpus_id` must match the corpus deployed
to screens or entropy alerts will fire. `compliance_profile` determines which content
categories are treated as compliance content (L1-protected).

---

## Section 2 — Screen Entities

---

### 2.1 Screen

**Description:** A single physical display device running the ClubHub TV player. The Screen
is the atomic resolution target: PRE.resolve() takes a `screen_id` as its primary input.
Every Screen is assigned to a Venue and a ScreenZone. The `screen_id` is the stable
identifier that appears in resolution inputs, audit records, entropy reports, and manifest
delivery logs.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `screen_id`           | UUID       | Immutable. Primary key in PRE.resolve() input. Stable across hardware replacement. |
| `venue_id`            | UUID       | Owning venue                                                      |
| `zone_id`             | UUID       | Assigned ScreenZone                                               |
| `deployment_group_id` | UUID\|null | DeploymentGroup for corpus delivery                               |
| `hardware_id`         | string     | Physical device MAC or serial; may change on hardware swap        |
| `display_name`        | string     | Operator-assigned name (e.g., "Bar Left", "Reception 1")         |
| `environment_type`    | enum       | `DARK_INTERIOR`, `STANDARD_INTERIOR`, `BRIGHT_INTERIOR`, `OUTDOOR_COVERED`, `OUTDOOR_EXPOSED` |
| `last_poll_at`        | timestamp  | Last successful manifest poll from this screen                    |
| `last_checksum`       | string     | FNV-1a checksum of last delivered playlist                        |
| `confidence_score`    | float      | [0.0, 1.0]; computed by PRE L6 annotation                        |
| `is_enrolled`         | boolean    | Whether screen has completed enrollment and is receiving manifests |
| `created_at`          | timestamp  | Immutable                                                         |
| `status`              | enum       | See lifecycle                                                     |

**Owned by:** Venue
**Created by:** VENUE_OPERATOR or REGIONAL_MANAGER (via screen enrollment flow)

**Lifecycle states:**

```
UNENROLLED ──────► ENROLLED ──────► OFFLINE ──────► DECOMMISSIONED
                       │                ▲
                       └────────────────┘
                         (auto, via poll)
```

- `UNENROLLED`: Screen record created, enrollment key issued, device not yet checked in.
- `ENROLLED`: Screen has checked in and is receiving manifests. Normal operational state.
- `OFFLINE`: Screen has not polled within the configured offline threshold (default: 3 missed polls = 45 seconds). Entropy scheduler tracks offline screens. PRE continues to resolve for offline screens — divergence is detected when the screen reconnects.
- `DECOMMISSIONED`: Screen permanently retired. Record retained for audit. `screen_id` must not be reused.

**State transition rules:**
- UNENROLLED → ENROLLED: Automatic on first successful manifest poll with valid enrollment token.
- ENROLLED → OFFLINE: Automatic. Set by entropy scheduler after poll timeout.
- OFFLINE → ENROLLED: Automatic on next successful poll.
- Any → DECOMMISSIONED: VENUE_OPERATOR+. Irreversible without PLATFORM_ADMIN.

**Constitutional implications:** `screen_id` is the primary key for all PRE invocations and
all audit records. `hardware_id` is for device management only — never appears in resolution
logic. When a physical device is replaced, the old `screen_id` is retained (the screen is a
logical concept, not a hardware concept). `confidence_score` from L6 annotation reflects the
PRE's assessment of divergence risk — low scores trigger entropy alerts.

---

### 2.2 ScreenZone

**Description:** A functional grouping of screens within a Venue. ScreenZones model the
physical and operational sub-spaces of a venue (bar area, reception, poolside, gaming floor,
restaurant). Zone-level targeting is a valid scope for Campaigns, Sponsorships, and Overrides.
A screen belongs to exactly one ScreenZone.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `zone_id`             | UUID       | Immutable                                                         |
| `venue_id`            | UUID       | Owning venue                                                      |
| `zone_name`           | string     | Display name (e.g., "Bar", "Gaming Floor", "Reception")          |
| `zone_type`           | enum       | `BAR`, `GAMING`, `RECEPTION`, `RESTAURANT`, `POOLSIDE`, `CORRIDOR`, `OUTDOOR`, `GENERAL` |
| `compliance_tags`     | string[]   | Zone-specific compliance requirements (extends venue profile)     |
| `screen_count`        | integer    | Derived: count of enrolled screens in this zone                   |
| `created_at`          | timestamp  | Immutable                                                         |
| `status`              | enum       | `ACTIVE`, `ARCHIVED`                                              |

**Owned by:** Venue
**Created by:** VENUE_OPERATOR or REGIONAL_MANAGER

**Lifecycle states:**

- `ACTIVE`: Zone is operational. Screens may be assigned.
- `ARCHIVED`: Zone no longer operational. Existing screen assignments must be migrated before archiving. Archived zones may not receive new campaign or sponsorship targeting.

**Constitutional implications:** Zone assignment is part of the screen context read by PRE L2
(scheduled overrides) and L3 (campaign/schedule) resolvers. Targeting a Campaign to a
`zone_id` means the Campaign's schedule rules are only evaluated when resolving screens in
that zone. A screen cannot be in two zones simultaneously.

---

## Section 3 — Content Program Entities

---

### 3.1 Campaign

**Description:** A time-bounded content program. A Campaign is the primary operator tool for
programming what content plays on screens over a defined period. Campaigns operate at L3
(Campaign/Schedule level) in PRE resolution. Multiple Campaigns may be active simultaneously;
priority and specificity determine which wins at L3.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `campaign_id`         | UUID       | Immutable                                                         |
| `org_id`              | UUID       | Owning organization                                               |
| `name`                | string     | Display name                                                      |
| `description`         | string     | Operator-facing description                                       |
| `campaign_type`       | enum       | `STANDARD`, `PROMOTIONAL`, `SPONSORSHIP_LINKED`, `COMPLIANCE`    |
| `priority`            | integer    | [1–100]; higher wins at L3 when schedules overlap. Default: 50.   |
| `targeting_scope`     | object     | `{ org_ids?, venue_ids?, zone_ids?, market_verticals? }` — determines which screens this campaign is eligible for |
| `schedule_ids`        | UUID[]     | Schedules binding this campaign to time windows                   |
| `playlist_ids`        | UUID[]     | Playlists providing content for this campaign                     |
| `template_id`         | UUID\|null | Template this campaign was derived from                           |
| `valid_from`          | timestamp  | Campaign is invisible to PRE before this time                     |
| `valid_until`         | timestamp\|null | Campaign is invisible to PRE after this time; null = no expiry |
| `created_at`          | timestamp  | Immutable                                                         |
| `created_by`          | user_id    | Immutable                                                         |
| `status`              | enum       | See lifecycle                                                     |

**Owned by:** Organization (enterprise-level campaigns) or Venue (venue-local campaigns)
**Created by:** ENTERPRISE_ADMIN (enterprise-scope), REGIONAL_MANAGER (regional-scope), VENUE_OPERATOR (venue-scope)

**Lifecycle states:**

```
DRAFT ──────► SCHEDULED ──────► ACTIVE ──────► COMPLETED
  │                                               │
  └───────────────► CANCELLED ◄──────────────────┘
```

- `DRAFT`: Not yet submitted for activation. Invisible to PRE.
- `SCHEDULED`: Approved and waiting for `valid_from`. Visible to PRE Preview but not to live resolution.
- `ACTIVE`: Within `valid_from`/`valid_until` window. Eligible for L3 resolution.
- `COMPLETED`: Past `valid_until`. Automatically transitioned. Archived content preserved.
- `CANCELLED`: Manually cancelled. Immediately removed from PRE inputs.

**State transition rules:**
- DRAFT → SCHEDULED: Requires approval from owner tier (VENUE_OPERATOR+ for venue campaigns).
- SCHEDULED → ACTIVE: Automatic at `valid_from`.
- ACTIVE → COMPLETED: Automatic at `valid_until`.
- ACTIVE → CANCELLED: REGIONAL_MANAGER+ for venue campaigns; ENTERPRISE_ADMIN+ for enterprise campaigns.

**Constitutional implications:** Priority only resolves ties within L3. A Campaign at L3 with
priority=1 cannot override an Override at L1 or L2, regardless of priority value. Campaign
deletion while ACTIVE is prohibited — campaigns must be CANCELLED first, which generates an
audit record.

---

### 3.2 Schedule

**Description:** A time-rule defining when a Campaign is active. Schedules express
recurrence, date ranges, and time-of-day windows. A Campaign may have multiple Schedules.
The PRE evaluates schedules using venue-local time. Schedules are evaluated at L3 for campaign
content and at L2 for scheduled overrides.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `schedule_id`         | UUID       | Immutable                                                         |
| `campaign_id`         | UUID\|null | Owning campaign; null if schedule is used by an Override directly |
| `schedule_name`       | string     | Display name                                                      |
| `recurrence_type`     | enum       | `ONCE`, `DAILY`, `WEEKLY`, `CUSTOM_DOW`                          |
| `days_of_week`        | integer[]  | [0–6]; 0=Sunday. Required for WEEKLY and CUSTOM_DOW.             |
| `time_start`          | string     | HH:MM in venue-local time                                         |
| `time_end`            | string     | HH:MM in venue-local time                                         |
| `date_range_start`    | date\|null | Inclusive start date; null = no start boundary                   |
| `date_range_end`      | date\|null | Inclusive end date; null = no end boundary                       |
| `priority`            | integer    | Inherited from parent Campaign; may be overridden here            |
| `created_at`          | timestamp  | Immutable                                                         |
| `status`              | enum       | `ACTIVE`, `PAUSED`, `ARCHIVED`                                    |

**Owned by:** Campaign (or Override)
**Created by:** Campaign owner role

**Lifecycle states:**

- `ACTIVE`: Schedule is evaluated by the PRE when its campaign is active.
- `PAUSED`: Schedule exists but is excluded from PRE evaluation. The campaign remains active if other schedules apply.
- `ARCHIVED`: Schedule permanently removed from PRE inputs. Cannot be restored without recreation.

**Constitutional implications:** `days_of_week` values are evaluated against venue-local wall
clock time — not UTC. The timezone on the owning Venue is authoritative. A schedule with
`days_of_week=[1]` (Monday) evaluated on a Sunday will not match, regardless of UTC day.
This was the defect class that produced EDGE-001.

---

### 3.3 Override

**Description:** A point-in-time or duration-bound departure from the campaign schedule.
Overrides operate at L1 (operational override, set by PLATFORM_ADMIN or ENTERPRISE_ADMIN) or
L2 (scheduled override, set by REGIONAL_MANAGER or VENUE_OPERATOR). An override is not an
emergency — it does not trigger L0 and does not require acknowledgment to clear.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `override_id`         | UUID       | Immutable                                                         |
| `venue_id`            | UUID       | Scope: owning venue                                               |
| `zone_id`             | UUID\|null | Optional: further scoped to a zone                               |
| `screen_id`           | UUID\|null | Optional: further scoped to a single screen                       |
| `override_level`      | enum       | `L1_OPERATIONAL` or `L2_SCHEDULED`                               |
| `playlist_id`         | UUID       | Content to display during override                                |
| `reason`              | string     | Required. Human-readable justification. Appears in audit record.  |
| `priority`            | integer    | Tiebreaker when multiple overrides overlap at same level          |
| `starts_at`           | timestamp\|null | null = immediate                                             |
| `expires_at`          | timestamp\|null | null = indefinite (requires explicit clearance)              |
| `created_at`          | timestamp  | Immutable                                                         |
| `created_by`          | user_id    | Immutable                                                         |
| `cleared_at`          | timestamp\|null | Set when override is manually cleared                        |
| `cleared_by`          | user_id\|null | Set when override is manually cleared                         |
| `status`              | enum       | See lifecycle                                                     |

**Owned by:** Venue (L2); Platform or Organization (L1)
**Created by:** VENUE_OPERATOR+ for L2; REGIONAL_MANAGER+ for L1 in their scope

**Lifecycle states:**

```
PENDING ──────► ACTIVE ──────► EXPIRED
                  │
                  └──────────► CLEARED
```

- `PENDING`: `starts_at` is in the future. Override is known to PRE but not yet effective.
- `ACTIVE`: Current time is within `[starts_at, expires_at)`. Override is effective at its level.
- `EXPIRED`: Past `expires_at`. Override has no PRE effect. Record retained for audit.
- `CLEARED`: Manually cleared before expiry. Clearance is audited (who cleared, when, why).

**Constitutional implications:** Overrides suppress Campaign content below their level.
A L1 override causes the PRE to terminate at L1 — the entire L3 campaign level is skipped.
This is not a bug; it is constitutionally correct. Operators must understand that L1 overrides
are not "campaign-level priority" — they are a different level of the resolution hierarchy.
Override `reason` is mandatory: empty-string reasons are rejected at the API layer.

---

### 3.4 Emergency

**Description:** The highest-priority content intervention. An Emergency triggers L0 resolution
across its scope (venue, zone, or platform-wide). The PRE terminates at L0 when an active
Emergency matches the screen being resolved. No campaign, override, sponsorship, or schedule
can produce content during an active Emergency at its scope. Emergencies require explicit
human acknowledgment to clear — they do not expire automatically.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `emergency_id`        | UUID       | Immutable                                                         |
| `scope_type`          | enum       | `PLATFORM`, `ORG`, `VENUE`, `ZONE`                               |
| `scope_id`            | UUID       | ID of the scoped entity                                           |
| `playlist_id`         | UUID       | Emergency content playlist. Must be pre-approved compliance content. |
| `trigger_reason`      | string     | Required. Human-readable trigger reason.                          |
| `triggered_at`        | timestamp  | Immutable. Time of activation.                                    |
| `triggered_by`        | user_id    | Immutable. Who activated the emergency.                           |
| `acknowledged_at`     | timestamp\|null | Time of human acknowledgment to clear                        |
| `acknowledged_by`     | user_id\|null | Who acknowledged (cleared) the emergency                      |
| `acknowledgment_note` | string\|null | Required at clearance. Explains why emergency is safe to clear. |
| `status`              | enum       | See lifecycle                                                     |

**Owned by:** Venue (venue/zone scope); Organization (org scope); Platform (platform scope)
**Created by:** VENUE_OPERATOR+ (venue/zone scope); REGIONAL_MANAGER+ (org scope); PLATFORM_ADMIN (platform scope)

**Lifecycle states:**

```
ACTIVE ──────────────────────────────────────► ACKNOWLEDGED
  (requires human acknowledgment — no auto-expiry)
```

- `ACTIVE`: Emergency is live. PRE terminates at L0 for all screens in scope. Workspace shows EMERGENCY_FREEZE indicators.
- `ACKNOWLEDGED`: Emergency has been cleared by an authorized operator. PRE resumes normal resolution. Acknowledgment record is immutable.

**State transition rules:**
- Emergency activation: creates ACTIVE record immediately. Audit record generated.
- ACTIVE → ACKNOWLEDGED: Requires human acknowledgment action from authorized role (VENUE_OPERATOR+ for venue scope). Acknowledgment note is mandatory. This is a non-delegatable human action.

**Constitutional implications:** Emergency absoluteness is constitutional invariant INV-7. No
content sourced at L1–L6 appears on a screen during an active L0 emergency at its scope.
Emergency content itself must be pre-approved — it cannot reference non-compliance content
that hasn't already been validated. Emergency clearance without acknowledgment_note is
rejected at the API layer.

---

## Section 4 — Content Entities

---

### 4.1 ContentAsset

**Description:** A single media file — video, image, or graphic — available for inclusion in
Playlists. ContentAssets are the leaf-level content primitives. They carry checksum, duration,
and compliance metadata. The PRE references ContentAssets by ID; their content itself is
served by the media delivery layer.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `asset_id`            | UUID       | Immutable                                                         |
| `org_id`              | UUID\|null | Owning organization; null = platform-level asset                  |
| `venue_id`            | UUID\|null | Owning venue; null = organization or platform-level asset         |
| `asset_name`          | string     | Display name                                                      |
| `media_type`          | enum       | `VIDEO`, `IMAGE`, `GRAPHIC`                                       |
| `duration_ms`         | integer    | Content duration in milliseconds. Required for VIDEO; for IMAGE, specifies display duration. |
| `file_checksum`       | string     | SHA-256 of the raw media file. Immutable once set.               |
| `file_size_bytes`     | integer    | Immutable once set                                                |
| `resolution`          | string     | e.g., "1920x1080"                                                 |
| `compliance_flags`    | string[]   | Compliance categories this asset satisfies (e.g., `RESPONSIBLE_GAMBLING`, `DUTY_OF_CARE`) |
| `is_compliance_asset` | boolean    | If true: asset is required by compliance profile; cannot be excluded below L1 |
| `content_rating`      | enum       | `GENERAL`, `MATURE`, `RESTRICTED`                                 |
| `created_at`          | timestamp  | Immutable                                                         |
| `uploaded_by`         | user_id    | Immutable                                                         |
| `status`              | enum       | See lifecycle                                                     |

**Owned by:** Organization or Venue (venue-local assets); Platform (system assets)
**Created by:** ENTERPRISE_ADMIN (org assets); VENUE_OPERATOR (venue assets)

**Lifecycle states:**

```
UPLOADING ──────► PROCESSING ──────► ACTIVE ──────► ARCHIVED
                                        │
                                    QUARANTINED
                                   (compliance hold)
```

- `UPLOADING`: File transfer in progress. Asset not available for Playlist inclusion.
- `PROCESSING`: File received, checksum computed, format validation in progress.
- `ACTIVE`: Asset validated and available for Playlist inclusion.
- `QUARANTINED`: Asset flagged for compliance review. Immediately removed from all active Playlists. Playlists referencing a quarantined asset are marked DEGRADED.
- `ARCHIVED`: Asset retired from active use. Cannot be added to new Playlists. Existing archived references are preserved in audit records.

**Constitutional implications:** Deletion of ContentAssets is prohibited while they are
referenced by any ACTIVE or SCHEDULED Campaign's Playlist. The asset must be archived, not
deleted — deletion destroys the audit chain. `is_compliance_asset=true` assets cannot be
excluded by any PRE level below L1. If a compliance asset is removed from a Playlist, the
Playlist validation layer rejects the change.

---

### 4.2 Playlist

**Description:** An ordered sequence of ContentAssets tied to a resolution level and context.
Playlists are the direct content output associated with a Campaign, Override, Emergency, or
Sponsorship. The PRE resolves to a Playlist ID and then evaluates the Playlist's items.
Playlist identity is captured by the `playlist_checksum` (FNV-1a of canonical serialization).

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `playlist_id`         | UUID       | Immutable                                                         |
| `org_id`              | UUID       | Owning organization                                               |
| `venue_id`            | UUID\|null | If set: venue-local playlist                                      |
| `name`                | string     | Display name                                                      |
| `resolution_level`    | enum       | The PRE level this playlist is designed for: `L0`, `L1`, `L2`, `L3`, `L4`, `L5` |
| `items`               | array      | Ordered list of `{ asset_id, duration_ms, weight }`. Order is canonical and deterministic. |
| `playlist_checksum`   | string     | FNV-1a hash of canonical item serialization. Recomputed on any item change. |
| `total_duration_ms`   | integer    | Sum of all item `duration_ms`. Derived.                           |
| `has_compliance_gap`  | boolean    | True if compliance profile requires assets not present in this playlist |
| `created_at`          | timestamp  | Immutable                                                         |
| `last_modified_at`    | timestamp  | Updated on any item change; triggers checksum recomputation       |
| `status`              | enum       | `DRAFT`, `ACTIVE`, `ARCHIVED`                                     |

**Owned by:** Organization or Venue
**Created by:** Campaign/Override/Emergency owner role

**Lifecycle states:**

- `DRAFT`: Playlist being assembled. Not yet bound to any active Campaign or Override.
- `ACTIVE`: Bound to at least one active Campaign, Override, Emergency, or Sponsorship.
- `ARCHIVED`: All parent bindings have completed or been cancelled. Playlist preserved for audit.

**Constitutional implications:** `playlist_checksum` is the identity fingerprint used in all
audit records. If a Playlist is modified after being bound to an active Campaign, the
checksum changes and the PRE produces a different output on next invocation — this is correct
behavior and does not require a Campaign state change. Playlists may not be deleted while
referenced by any non-ARCHIVED Campaign or Override.

---

## Section 5 — Commercial Entities

---

### 5.1 Sponsorship

**Description:** A commercial agreement binding a sponsor to specific screen zones and time
windows. Sponsorships operate at L4 (Sponsorship Injection) in PRE resolution. L4 is additive
— it injects sponsor content into the playlist produced by L3, subject to SOV (Share of Voice)
constraints. A Sponsorship does not replace campaign content; it augments it.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `sponsorship_id`      | UUID       | Immutable                                                         |
| `org_id`              | UUID       | Owning organization                                               |
| `sponsor_name`        | string     | Sponsor display name                                              |
| `stakeholder_user_id` | UUID\|null | SPONSOR_STAKEHOLDER user with read access to this sponsorship     |
| `targeting`           | object     | `{ venue_ids?, zone_ids?, market_verticals? }` — eligible screens |
| `time_windows`        | array      | `[{ days_of_week, time_start, time_end }]` — when sponsorship is active |
| `playlist_id`         | UUID       | Sponsor content playlist                                          |
| `sov_target`          | float      | Target share of voice [0.0, SOV_MAX_EFFECTIVE=0.9999]            |
| `exclusivity_scope`   | enum\|null | `NONE`, `ZONE`, `VENUE`, `CATEGORY` — competitor exclusion scope  |
| `exclusivity_categories` | string[] | Competitor product categories excluded during active windows      |
| `valid_from`          | timestamp  | Sponsorship start                                                 |
| `valid_until`         | timestamp  | Sponsorship end                                                   |
| `created_at`          | timestamp  | Immutable                                                         |
| `status`              | enum       | `DRAFT`, `ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`             |

**Owned by:** Organization
**Created by:** ENTERPRISE_ADMIN or REGIONAL_MANAGER

**Lifecycle states:**

- `DRAFT`: Commercial terms being defined. Invisible to PRE.
- `ACTIVE`: Within `valid_from`/`valid_until` and eligible time windows. Injected at L4.
- `PAUSED`: Temporarily suspended. Invisible to PRE. Billing implications are external to the platform.
- `COMPLETED`: Past `valid_until`. Automatically transitioned. Record preserved.
- `CANCELLED`: Manually cancelled. Record preserved.

**Constitutional implications:** SOV is bounded at `SOV_MAX_EFFECTIVE=0.9999` — sponsor content
may never occupy 100% of a playlist. This is a constitutional invariant (INV-8). Exclusivity
rules do not affect L0–L2 resolution — an L1 override containing a competitor brand is valid
regardless of exclusivity agreements. Exclusivity is a commercial constraint evaluated only
at L4, not a constitutional protection.

---

## Section 6 — Audit and Observability Entities

---

### 6.1 EntropyReport

**Description:** Generated by the entropy scheduler when corpus drift is detected for a venue
— a discrepancy between what the PRE expects to find on devices and what is actually deployed.
Entropy reports are operational alerts requiring acknowledgment. An unacknowledged critical
entropy report elevates the venue's `entropy_alert_level` and is surfaced in the Venue
Workspace.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `report_id`           | UUID       | Immutable                                                         |
| `venue_id`            | UUID       | Affected venue                                                    |
| `generated_at`        | timestamp  | Immutable                                                         |
| `drift_type`          | enum       | `CORPUS_VERSION_MISMATCH`, `MISSING_ASSETS`, `CHECKSUM_FAILURE`, `OFFLINE_SCREENS` |
| `severity`            | enum       | `WARNING`, `CRITICAL`                                             |
| `affected_screen_ids` | UUID[]     | Screens exhibiting drift                                          |
| `expected_corpus_id`  | UUID       | CorpusVersion the PRE expects                                     |
| `observed_corpus_id`  | UUID\|null | CorpusVersion observed on affected screens; null if unreadable    |
| `divergence_detail`   | object     | Machine-readable drift summary                                    |
| `acknowledged_at`     | timestamp\|null | Time of operator acknowledgment                              |
| `acknowledged_by`     | user_id\|null | Who acknowledged                                              |
| `acknowledgment_note` | string\|null | Operator note on corrective action taken                      |
| `status`              | enum       | `OPEN`, `ACKNOWLEDGED`, `RESOLVED`                                |

**Owned by:** Venue (for read access); Platform (for generation authority)
**Created by:** Entropy scheduler (system-generated; not operator-creatable)

**Lifecycle states:**

- `OPEN`: Drift detected; operator not yet aware. Venue `entropy_alert_level` elevated.
- `ACKNOWLEDGED`: Operator has seen and acknowledged the report. Corrective action noted.
- `RESOLVED`: Drift corrected (re-deployment completed; screens confirmed in sync). Auto-transitioned by entropy scheduler on next clean scan.

**Constitutional implications:** EntropyReports are append-only. They cannot be deleted.
Acknowledging a report does not resolve it — resolution requires the underlying drift to
be corrected. A CRITICAL open entropy report in a venue with active emergency state is
an EMERGENCY_FREEZE precondition.

---

### 6.2 ReplayAuditRecord

**Description:** An immutable record of a single PRE invocation. Every call to PRE.resolve()
that produces a manifest generates a ReplayAuditRecord. Records are append-only and carry the
full resolution trace. The record is the foundation of the platform's explainability guarantee:
any operator can reconstruct exactly why a specific playlist played on a specific screen at a
specific time.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `record_id`           | UUID       | Immutable                                                         |
| `screen_id`           | UUID       | Screen being resolved                                             |
| `venue_id`            | UUID       | Venue of the screen                                               |
| `resolved_at`         | timestamp  | Exact timestamp of PRE invocation                                 |
| `resolution_level`    | enum       | `L0`–`L5`; level at which PRE terminated                         |
| `playlist_checksum`   | string     | FNV-1a checksum of resulting playlist                             |
| `reason_trace`        | object     | Full resolution trace: which rules were evaluated, why each level was or was not terminated, what content was selected |
| `input_hash`          | string     | Hash of PRE input state (used for determinism verification)       |
| `output_hash`         | string     | Hash of PRE output (used for corpus replay)                       |
| `is_fallback`         | boolean    | Whether PRE fell to L5 structural fallback                        |
| `confidence_score`    | float      | L6 annotation: PRE confidence that screen is displaying expected content |
| `chain_hash`          | string     | Hash-chain entry linking this record to previous record for this screen |
| `status`              | enum       | `COMMITTED` (only state; records are never modified or deleted)   |

**Owned by:** Platform (system-generated)
**Created by:** PRE invocation (not operator-creatable or operator-modifiable)

**Constitutional implications:** ReplayAuditRecords are the constitutional record of platform
operation. They may not be deleted, amended, or corrected. If an error occurred in a PRE
invocation, the error is recorded — not hidden. The `chain_hash` provides tamper-evidence
across the audit chain for a screen. Hash chain integrity is verified by the chaos harness
and CI stage 12.

---

### 6.3 ParityRecord

**Description:** A shadow comparison result. When the platform is in SHADOW or CANARY
operational mode, the PRE runs alongside the legacy system. For each screen poll, both systems
produce output; the ParityRecord records the comparison result. ParityRecords are append-only
and carry a `divergence_class` that triggers canary promotion gates.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `parity_id`           | UUID       | Immutable                                                         |
| `screen_id`           | UUID       | Screen being compared                                             |
| `evaluated_at`        | timestamp  | Immutable                                                         |
| `pre_checksum`        | string     | PRE output checksum                                               |
| `legacy_checksum`     | string     | Legacy system output checksum                                     |
| `is_match`            | boolean    | True if checksums are equal                                       |
| `divergence_class`    | enum\|null | `CLASS_1` (benign), `CLASS_2` (expected), `CLASS_3` (requires review), `CLASS_4` (blocks promotion); null if match |
| `divergence_detail`   | object\|null | Machine-readable divergence explanation                        |
| `reviewed_by`         | user_id\|null | For CLASS_3+: who reviewed                                   |
| `review_note`         | string\|null | For CLASS_3+: review outcome                                  |
| `status`              | enum       | `UNREVIEWED`, `REVIEWED`, `ESCALATED`                             |

**Owned by:** Platform (system-generated)
**Created by:** Shadow comparison subsystem (not operator-creatable)

**Constitutional implications:** CLASS_3 and CLASS_4 divergences block canary promotion and
must be reviewed by a human with ENTERPRISE_ADMIN+ authority. ParityRecords are never
modified — review notes are added as separate annotations, not edits to the original record.
AUDITOR role may read all ParityRecords. SPONSOR_STAKEHOLDER may never access ParityRecords.

---

## Section 7 — Operational Governance Entities

---

### 7.1 PreviewSession

**Description:** An ephemeral operator preview of future PRE output. PreviewSessions allow
operators to evaluate what the PRE will resolve for a given screen, timestamp, and hypothetical
state (e.g., "what will play next Tuesday at 14:00 if I activate this campaign?"). Preview
output is never canonical — it does not create audit records and does not affect manifests.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `session_id`          | UUID       | Session-scoped identifier; expires with session                   |
| `operator_id`         | user_id    | Who initiated the preview                                         |
| `screen_id`           | UUID       | Screen being simulated                                            |
| `hypothetical_state`  | object     | Overrides to apply to SystemState before resolution (e.g., pending campaign activations) |
| `preview_timestamp`   | timestamp  | The time to simulate PRE resolution at                            |
| `preview_result`      | object     | PRE output for the hypothetical state at preview_timestamp        |
| `preview_checksum`    | string     | Checksum of the preview result — carries `PREVIEW:` prefix to distinguish from canonical checksums |
| `created_at`          | timestamp  | Immutable                                                         |
| `expires_at`          | timestamp  | PreviewSession auto-expires; default 4 hours                      |
| `status`              | enum       | `ACTIVE`, `EXPIRED`                                               |

**Owned by:** Ephemeral (session-scoped; no organizational ownership)
**Created by:** Any operator role with venue access; SPONSOR_STAKEHOLDER may preview their own sponsorship outputs only

**Constitutional implications:** PreviewSession records are never promoted to canonical state.
`preview_checksum` carries a `PREVIEW:` prefix and may never be stored in a ReplayAuditRecord
field. The PRE invocation for a PreviewSession is identical in function to a live invocation
but the output is discarded after the session. No side effects. Preview does not count as
a PRE invocation for audit purposes.

---

### 7.2 Template

**Description:** A reusable schedule and campaign configuration. Templates allow enterprise
or venue administrators to define standard campaign structures that venue operators can
instantiate. Templates express the structure (schedule patterns, targeting scope, playlist
slots) without filling in the specific content — that remains for the instantiating operator.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `template_id`         | UUID       | Immutable                                                         |
| `org_id`              | UUID\|null | Owning org; null = platform template                              |
| `venue_id`            | UUID\|null | Venue-specific template; null = org or platform level             |
| `name`                | string     | Display name                                                      |
| `template_type`       | enum       | `CAMPAIGN`, `SCHEDULE`, `OVERRIDE`                                |
| `schedule_pattern`    | object     | Recurrence pattern (days_of_week, time windows, date range)       |
| `targeting_defaults`  | object     | Default targeting scope for campaigns created from this template  |
| `playlist_slots`      | array      | Named playlist slots; operator fills these at instantiation       |
| `required_compliance` | string[]   | Compliance assets that must be present in instantiated playlists  |
| `created_at`          | timestamp  | Immutable                                                         |
| `created_by`          | user_id    | Immutable                                                         |
| `status`              | enum       | `ACTIVE`, `DEPRECATED`                                            |

**Owned by:** Organization (enterprise templates) or Venue (venue templates)
**Created by:** ENTERPRISE_ADMIN (org templates); VENUE_OPERATOR (venue templates)

**Lifecycle states:**

- `ACTIVE`: Template available for instantiation.
- `DEPRECATED`: Template no longer recommended. Existing instantiations continue; new instantiations discouraged. No hard block — deprecation is informational.

**Constitutional implications:** A Campaign created from a Template inherits the Template's
`required_compliance` slot requirements. If an operator fills a compliance slot with a
non-compliance asset, Playlist validation rejects the instantiation. Templates reduce
entropy in campaign creation by enforcing structural correctness at the point of creation.

---

### 7.3 DeploymentGroup

**Description:** A set of screens that receive the same CorpusVersion. DeploymentGroups are
the delivery unit for corpus updates. All screens in a DeploymentGroup receive the same corpus
atomically — partial delivery within a group is not permitted. Groups enable staged rollouts
(canary groups, wave-based deployment) without requiring per-screen corpus management.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `group_id`            | UUID       | Immutable                                                         |
| `venue_id`            | UUID       | Owning venue                                                      |
| `group_name`          | string     | Display name                                                      |
| `screen_ids`          | UUID[]     | Screens in this group                                             |
| `active_corpus_id`    | UUID\|null | Currently deployed CorpusVersion                                  |
| `pending_corpus_id`   | UUID\|null | CorpusVersion queued for deployment (canary or wave)              |
| `rollout_state`       | enum       | `STABLE`, `PENDING_ROLLOUT`, `ROLLING_OUT`, `ROLLBACK_IN_PROGRESS` |
| `created_at`          | timestamp  | Immutable                                                         |
| `status`              | enum       | `ACTIVE`, `ARCHIVED`                                              |

**Owned by:** Venue
**Created by:** REGIONAL_MANAGER or VENUE_OPERATOR

**Constitutional implications:** A screen may belong to only one DeploymentGroup at a time.
Moving a screen between groups requires that the screen be removed from the source group
(generating an audit record) before being added to the destination group. Partial-group
deployment is constitutionally prohibited — the entropy subsystem would detect and report
the resulting corpus mismatch.

---

### 7.4 CorpusVersion

**Description:** A versioned, checksummed snapshot of the PRE input corpus for a venue. The
corpus is the complete set of PRE inputs — schedules, campaigns, content references, override
rules — compiled into a deployable artifact. When the corpus changes, a new CorpusVersion
is created. The previous version is archived, not deleted.

**Key attributes:**

| Attribute             | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `corpus_id`           | UUID       | Immutable                                                         |
| `venue_id`            | UUID       | Venue this corpus serves                                          |
| `version_number`      | integer    | Monotonically increasing per venue                                |
| `corpus_checksum`     | string     | FNV-1a hash of canonical corpus serialization                     |
| `input_hash`          | string     | SHA-256 of full corpus artifact for integrity verification        |
| `created_at`          | timestamp  | Immutable                                                         |
| `compiled_by`         | user_id\|null | Who triggered compilation; null if auto-compiled               |
| `deployment_status`   | enum       | `COMPILED`, `DEPLOYING`, `DEPLOYED`, `SUPERSEDED`, `ARCHIVED`    |
| `deployed_at`         | timestamp\|null | Time of first confirmed screen delivery                      |
| `superseded_at`       | timestamp\|null | Time a newer version replaced this one                       |
| `replay_vectors`      | integer    | Count of corpus replay vectors passing against this version       |
| `status`              | enum       | `ACTIVE`, `SUPERSEDED`, `ARCHIVED`                                |

**Owned by:** Venue (for scope); Platform (for generation authority)
**Created by:** Corpus compiler (system-generated on schedule or operator trigger)

**Lifecycle states:**

```
COMPILED ──────► DEPLOYING ──────► DEPLOYED ──────► SUPERSEDED ──────► ARCHIVED
```

- `COMPILED`: Corpus artifact generated and checksummed. Not yet on any device.
- `DEPLOYING`: OTA delivery in progress to DeploymentGroup screens.
- `DEPLOYED`: All screens in bound DeploymentGroups have confirmed delivery. Entropy scheduler will verify.
- `SUPERSEDED`: A newer CorpusVersion has been deployed. This version is archived but queryable.
- `ARCHIVED`: Retained for audit and replay. Not queryable by live PRE.

**Constitutional implications:** CorpusVersions are never deleted. Corpus replay (CI stages
04 and 07) verifies that past corpus versions continue to produce the same outputs as when
they were first deployed — this is the determinism guarantee. A `DEPLOYED` corpus that fails
replay verification triggers a CONSTITUTIONAL_RISK alert.

---

## Section 8 — Entity Relationship Summary

```
PLATFORM_OWNER
    └── Organization (ENTERPRISE_GROUP)
            └── Organization (REGIONAL_ORG)
                    └── Venue
                            ├── ScreenZone
                            │       └── Screen ──────────────────► DeploymentGroup
                            │                                              │
                            ├── Campaign                           CorpusVersion
                            │       ├── Schedule
                            │       └── Playlist ──► ContentAssets
                            │
                            ├── Override ──────────────────────────► Playlist
                            ├── Emergency ──────────────────────────► Playlist
                            ├── Sponsorship ─────────────────────────► Playlist
                            │
                            ├── EntropyReport
                            └── ReplayAuditRecord (append-only)

Cross-cutting (not owned by venue):
    ParityRecord (platform-generated, shadow mode)
    PreviewSession (ephemeral, operator-scoped)
    Template (org or venue-level)
```

---

## Appendix A — Entity Visibility by Role

| Entity               | PLATFORM_ADMIN | ENTERPRISE_ADMIN | REGIONAL_MANAGER | VENUE_OPERATOR | SPONSOR_STAKEHOLDER | AUDITOR    |
|----------------------|:--------------:|:----------------:|:----------------:|:--------------:|:-------------------:|:----------:|
| Organization         | R/W            | R/W (own)        | R (own)          | R (own)        | —                   | R          |
| Venue                | R/W            | R/W (own)        | R/W (own)        | R (own)        | —                   | R          |
| Screen               | R/W            | R/W (own)        | R/W (own)        | R/W (own)      | —                   | R          |
| ScreenZone           | R/W            | R/W (own)        | R/W (own)        | R/W (own)      | —                   | R          |
| Campaign             | R/W            | R/W (own)        | R/W (own)        | R/W (venue)    | R (sponsored)       | R          |
| Schedule             | R/W            | R/W (own)        | R/W (own)        | R/W (venue)    | —                   | R          |
| Override             | R/W            | R/W (own)        | R/W (own)        | R/W (venue)    | —                   | R          |
| Emergency            | R/W            | R/W (own)        | R/W (own)        | R/W (venue)    | —                   | R          |
| ContentAsset         | R/W            | R/W (own)        | R/W (own)        | R/W (venue)    | R (sponsored)       | R          |
| Playlist             | R/W            | R/W (own)        | R/W (own)        | R/W (venue)    | R (sponsored)       | R          |
| Sponsorship          | R/W            | R/W (own)        | R/W (own)        | R              | R (own)             | R          |
| EntropyReport        | R/W            | R (own)          | R (own)          | R (own)        | —                   | R          |
| ReplayAuditRecord    | R              | R (own)          | R (own)          | R (venue)      | —                   | R          |
| ParityRecord         | R              | R (own)          | R                | —              | —                   | R          |
| PreviewSession       | R/W            | R/W (own)        | R/W (own)        | R/W (venue)    | R/W (sponsored)     | —          |
| Template             | R/W            | R/W (own)        | R/W (own)        | R/W (venue)    | —                   | —          |
| DeploymentGroup      | R/W            | R/W (own)        | R/W (own)        | R/W (venue)    | —                   | R          |
| CorpusVersion        | R/W            | R (own)          | R (own)          | R (venue)      | —                   | R          |

*R = read; W = create/modify/archive; "own" = within their organizational scope*
