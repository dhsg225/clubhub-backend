# ClubHub TV — Content Relationships
# Information Architecture Layer

**Document type:** Content dependency and ownership model — authoritative relationship rules
**Authority:** CMS Architecture
**Audience:** Backend engineers, CMS implementation, UX, agent phases 3–7
**Last updated:** 2026-05-26
**Status:** CANONICAL — all content lifecycle and dependency logic must conform to this model

---

## Purpose

This document defines the ownership hierarchy, dependency relationships, and lifecycle rules
between all content entities in ClubHub TV. These rules govern what happens when entities
change state, when content is deleted or archived, and when entities from different tiers
interact. Every relationship rule here has a direct consequence in PRE resolution behavior —
relationship violations are not cosmetic errors, they are resolution errors.

---

## Governing Philosophy

**Relationships flow downward from the hierarchy.** An entity at tier N governs entities at
tier N+1. Enterprise-level campaigns may target venue-level screens. Venue-level campaigns
may not target enterprise-level screens (the scope boundary is a ceiling, not a floor).

**Deletion is prohibited for active dependencies.** Content that is actively referenced by a
live resolution path may not be deleted — only archived. The audit chain requires that any
content that ever appeared in a ReplayAuditRecord is retrievable in its original state. This
is a constitutional requirement, not a policy preference.

**Compliance content is unconditional.** Content flagged as compliance (`is_compliance_asset=true`)
cannot be excluded, suspended, or overridden below L1. This is an invariant, not a
configurable setting. Market-specific compliance requirements (responsible gambling,
duty-of-care messaging) are examples. The L1 Operational Override is the only resolution
level with authority to alter compliance content.

---

## Section 1 — Organizational Hierarchy

```
Organization (ENTERPRISE_GROUP)
    └── Organization (REGIONAL_ORG)
            └── Venue
                    ├── ScreenZone
                    │       └── Screen
                    ├── Campaign (venue-local)
                    ├── Override
                    ├── Emergency
                    └── Sponsorship (venue-scope)

Organization (ENTERPRISE_GROUP)
    ├── Campaign (enterprise-scope)
    ├── Sponsorship (enterprise-scope)
    └── Template
```

### 1.1 Ownership Direction

Ownership is always from parent to child:
- An Organization owns Venues within it. A Venue cannot be moved between Organizations without PLATFORM_ADMIN action (generates audit record).
- A Venue owns Screens, ScreenZones, venue-local Campaigns, Overrides, Emergencies, and venue-scoped Sponsorships.
- An Organization owns enterprise-scope Campaigns and Sponsorships that may target venues it owns.
- Screens belong to exactly one ScreenZone. Screens cannot exist without a zone assignment.

### 1.2 Scope Boundary Rules

**Scope ceiling:** An entity may target any entity at its level or below in its ownership tree.
An enterprise Campaign may target all venues in the enterprise, a specific regional org's venues,
specific venues, or specific zones. It may not target screens in a different enterprise.

**Scope floor:** A venue-local Campaign targets screens within that venue only. A venue Campaign
cannot be promoted to enterprise scope by the VENUE_OPERATOR — promotion requires ENTERPRISE_ADMIN.

**Targeting validation:** The API validates targeting scope at creation and at activation. A Campaign
targeting `venue_id` values outside the owning organization is rejected at creation time with a
validation error that names the out-of-scope venue IDs.

---

## Section 2 — Campaign and Schedule Binding

### 2.1 Campaign → Schedule

A Campaign may have one or more Schedules. The relationship rules are:

- A Campaign with zero Schedules is never active in PRE resolution (no time windows = never matches). This is a valid state (DRAFT campaigns often have no schedules yet).
- A Campaign with multiple Schedules is active during the union of all schedule windows. Schedules do not conflict — they are additive.
- A Schedule belongs to exactly one Campaign. Schedules are not shared between campaigns. If two campaigns need the same time window, each gets its own Schedule with the same parameters.
- Deleting a Campaign deletes its Schedules (cascade). Schedules have no independent lifecycle outside their campaign.
- Pausing a Schedule (status: PAUSED) removes it from PRE consideration without affecting the Campaign or its other Schedules.

### 2.2 Campaign → Playlist

A Campaign references one or more Playlists. The Playlist provides the content the Campaign
delivers when resolved.

- A Campaign must have at least one ACTIVE Playlist at activation time. A Campaign with no playlists is rejected at the DRAFT → SCHEDULED transition.
- A Campaign may reference multiple Playlists to express content variation (e.g., different playlists for different time windows via separate schedule-to-playlist bindings). The specific binding model between schedules and playlists within a campaign is defined by the Campaign Type.
- Playlist changes (item edits) take effect on the next PRE invocation. There is no versioning gate between a Playlist edit and its reflection in resolution — this means an in-production Playlist edit immediately affects what screens show. This is intentional: operators who need safe preview must use PreviewSession first.
- A Playlist referenced by an ACTIVE Campaign may not be deleted. It may be modified (with immediate effect) or archived only if the Campaign is first cancelled.

### 2.3 ContentAsset → Playlist

A Playlist contains an ordered list of ContentAsset references. The relationship rules are:

- A ContentAsset appears in a Playlist as a reference (by `asset_id`). The asset's media file is not embedded in the Playlist.
- A ContentAsset in QUARANTINED state is immediately removed from all Playlist references. Playlists that lose an asset to quarantine are flagged `has_compliance_gap=true` if the quarantined asset was compliance-required.
- A ContentAsset in ARCHIVED state cannot be added to new Playlists. Existing references in ARCHIVED Playlists are retained for audit. If an archived asset is referenced by an ACTIVE Playlist, the system surfaces a validation warning at the Campaign level (asset availability degraded) but does not automatically cancel the Campaign.
- `playlist_checksum` is recomputed any time the Playlist's items change (additions, removals, reordering, duration changes). Checksum changes are propagated to all downstream audit records.

---

## Section 3 — Sponsorship → Campaign Conflict Resolution

### 3.1 Sponsorship Position in Resolution

Sponsorships operate at L4 (additive injection). They do not compete with Campaigns at L3.
The resolution sequence is:

```
L3 resolves campaign content (the base playlist)
          ↓
L4 evaluates active sponsorships for this screen/time
          ↓
L4 injects sponsor content into the L3 playlist, subject to SOV constraints
          ↓
Final playlist = L3 content + L4 injections
```

The Sponsorship does not "override" a Campaign. It adds to it. A venue with an active Campaign
and an active Sponsorship will show both — with the Sponsorship's SOV target determining the
proportion of sponsor content in the final playlist.

### 3.2 SOV Conflict When Multiple Sponsorships Are Active

When multiple Sponsorships are simultaneously active for the same screen:

- SOV is divided proportionally across active Sponsorships, subject to each sponsorship's `sov_target`.
- If the sum of all `sov_target` values exceeds `SOV_MAX_EFFECTIVE` (0.9999), the PRE normalizes them proportionally. No sponsorship is dropped — all are included at reduced proportion.
- Campaign content receives the remaining SOV share after all sponsor injections. Campaign content cannot be reduced to zero share through sponsorship accumulation (the `SOV_MAX_EFFECTIVE` cap ensures at least 0.01% campaign share, which is functionally a constitutional guarantee that campaign content always appears).

### 3.3 Exclusivity Conflict Resolution

When a Sponsorship carries `exclusivity_scope` and `exclusivity_categories`:

- The exclusivity constraint is evaluated at L4 only. It does not affect L1–L3 resolution.
- If a competing Campaign (whose content references products in the excluded categories) is active at L3, the Campaign content is not excluded from the playlist — the exclusivity constraint applies to L4 injection decisions, not to L3 campaign eligibility.
- To exclude a competitor at L3, an Override must be used — which requires operator action and audit. Exclusivity is a commercial agreement managed at L4, not a constitutional authority.
- Exclusivity constraint violations (two competing sponsorships with conflicting exclusivity on the same screen at the same time) are detected at Sponsorship activation. The activating user is warned. ENTERPRISE_ADMIN+ can force activation. Forced activation generates an escalated audit record.

---

## Section 4 — Override → Campaign Precedence

### 4.1 Override as Level Termination

An Override does not "compete" with a Campaign at the same level. An Override at L1 or L2
causes the PRE to terminate before reaching L3. This means:

- An active L1 Override: PRE terminates at L1. L2, L3, L4, L5 do not run. No campaign content appears.
- An active L2 Override: PRE terminates at L2. L3, L4, L5 do not run. No campaign content appears.
- No campaign has a "priority" high enough to survive an active override at L1 or L2 at its scope.

This is constitutional, not configurable. Operators who are surprised by this behavior have
misunderstood the resolution hierarchy. The Venue View override stack surface exists to make
this precedence visible before it causes unexpected behavior.

### 4.2 Override Scope and Screen Eligibility

An Override's scope (`venue_id` required; `zone_id` and `screen_id` optional) determines which
screens it affects:

- Venue-scoped Override: All screens in the venue. All zones. All screen types.
- Zone-scoped Override: All screens in the specified zone.
- Screen-scoped Override: Exactly the specified screen.

An active Campaign may continue running on unaffected screens simultaneously. If a venue has
a zone-scoped L2 Override on the gaming floor, the bar screens continue resolving at L3 normally.
The override's scope boundary is precise.

### 4.3 Override Content and Campaign Content Interaction

Override content (its Playlist) is served exclusively during the override period. The overridden
Campaign's Playlist is not visible during the override. When the override expires or is cleared:
- The PRE immediately re-evaluates from L0. If the Campaign's schedule is still active, the Campaign resumes at L3 on the next invocation.
- There is no "resume" state — the Campaign simply becomes eligible again at L3 on the next resolution.

---

## Section 5 — Emergency → All Content Relationships

### 5.1 Emergency Absoluteness

An active Emergency at L0 supersedes all other content relationships. This is unconditional:

- L1 Overrides: Suspended for screens in emergency scope
- L2 Overrides: Suspended
- L3 Campaigns: Suspended
- L4 Sponsorships: Suspended (sponsor content does not appear during emergency)
- L5 Structural fallback: Not reached (L0 terminates first)

The only content that appears during an active Emergency is the Emergency's own Playlist.
No other entity relationship affects this behavior.

### 5.2 Emergency Content Requirements

An Emergency Playlist must satisfy:
- All assets in the playlist are in ACTIVE status (no QUARANTINED assets).
- If the venue has compliance-required content, the Emergency Playlist must include those compliance assets. The emergency is not exempt from compliance requirements.
- Emergency Playlists are pre-approved at the time the Emergency is configured (not at activation time). Operators cannot create a new playlist in the moment of emergency activation — the playlist must already exist.

### 5.3 Emergency Scope Inheritance

Emergency scope bubbles down the hierarchy but not up:

- A PLATFORM-scoped Emergency: affects all screens on the platform.
- An ORG-scoped Emergency: affects all screens in all venues of that organization.
- A VENUE-scoped Emergency: affects all screens in the venue. All zones.
- A ZONE-scoped Emergency: affects only screens in the specified zone.

A venue with a zone-scoped emergency in one zone continues normal L3 resolution in other zones.

### 5.4 Overlapping Emergencies

If multiple overlapping Emergencies are active (e.g., a VENUE-scoped and a ZONE-scoped):
- The more specific scope takes precedence for screens in the overlapping scope.
- For zone-scoped screens: the ZONE emergency's playlist plays.
- For non-zone screens: the VENUE emergency's playlist plays.
- PLATFORM-scoped always wins for all screens.

The PRE resolves emergency precedence by specificity (most specific scope wins) within L0.

---

## Section 6 — Template → Campaign Inheritance

### 6.1 Template Relationship

Templates define campaign structure; Campaigns fill values. A Campaign created from a Template:
- Inherits the Template's `schedule_pattern` (which the operator may modify before activation)
- Inherits the Template's `targeting_defaults` (which the operator may adjust within their scope ceiling)
- Inherits the Template's `required_compliance` list (which the operator may not remove)
- Inherits the Template's `playlist_slots` (named slots that the operator must fill with content)

### 6.2 Template Inheritance Immutability

Template inheritance is evaluated at Campaign creation time. After a Campaign is created from
a Template, the Campaign is an independent entity. Subsequent Template changes do not propagate
to existing Campaigns derived from that Template. This is intentional: in-flight campaigns must
not be altered by template updates. Template deprecation is the signal that new campaigns should
use a different template; existing campaigns are unaffected.

### 6.3 Compliance Slot Enforcement

If a Template specifies `required_compliance` slots, the Campaign instantiation validation enforces:
- All required slots must be filled before the Campaign can transition from DRAFT to SCHEDULED.
- Required compliance slots must be filled with ContentAssets that have `is_compliance_asset=true` and carry the required compliance_flags.
- Filling a compliance slot with a non-compliance asset produces a validation error at the slot level (not at the campaign level — operators see exactly which slot is invalid and why).

---

## Section 7 — CorpusVersion → DeploymentGroup Binding

### 7.1 Binding Model

A CorpusVersion is bound to a DeploymentGroup at the time of deployment. The binding
establishes which screens receive the corpus and when.

- One CorpusVersion may be bound to multiple DeploymentGroups (for multi-group deployments of the same corpus).
- One DeploymentGroup has exactly one `active_corpus_id` and at most one `pending_corpus_id` at any time.
- A CorpusVersion that is not bound to any DeploymentGroup has no effect on any screen.

### 7.2 Deployment Atomicity

Within a DeploymentGroup, corpus deployment is atomic:
- Either all screens in the group receive the new CorpusVersion, or none do.
- Partial delivery within a group (some screens updated, others not) is detected by the entropy scheduler as a corpus version mismatch and immediately generates a CRITICAL EntropyReport.
- Rollback of a partial deployment: the entropy scheduler flags the group, and the OTA system re-delivers the previous `active_corpus_id` to all screens in the group.

### 7.3 Corpus Supersession

When a new CorpusVersion is deployed to a DeploymentGroup:
- The previous CorpusVersion's `deployment_status` transitions to `SUPERSEDED`.
- The previous version is retained for audit and corpus replay.
- PRE corpus replay runs against the superseded version to verify that its historical outputs remain reproducible.

---

## Section 8 — ContentAsset Lifecycle and Active Campaign References

### 8.1 Asset Deletion Rules

ContentAsset deletion is prohibited while:
- The asset is referenced by any Playlist with status ACTIVE or DRAFT.
- The asset is referenced by any Playlist bound to a Campaign with status ACTIVE, SCHEDULED, or DRAFT.
- The asset was ever referenced by any Playlist that produced a ReplayAuditRecord (i.e., ever appeared in a live resolution). In this case, the asset may be ARCHIVED but never deleted.

The correct lifecycle for retiring a ContentAsset from production:
1. Set the asset to ARCHIVED.
2. Remove the asset from any ACTIVE Playlists.
3. If the removal causes `has_compliance_gap=true` on the Playlist, address the compliance gap before the Campaign re-activates.
4. Asset remains in ARCHIVED state permanently for audit chain integrity.

### 8.2 Asset Quarantine

Asset quarantine is triggered by compliance review or content policy violation:
- Quarantine is immediate and automatic. The API mutation that triggers quarantine also removes the asset from all Playlist item lists in the same transaction.
- Campaigns whose Playlists lose assets to quarantine are flagged at the Campaign level (CONTENT_DEGRADED flag). They continue to run with the remaining assets.
- If quarantine removes the only asset from a Playlist, the Playlist enters an invalid state and the Campaign is paused automatically, generating an audit record explaining the auto-pause.
- Quarantine clearance (reinstating an asset) requires ENTERPRISE_ADMIN+ action and generates an audit record.

### 8.3 Orphaned Content Detection

An orphaned ContentAsset is one in ACTIVE status with no Playlist references. This is not
an error state — assets may be uploaded in preparation for campaigns not yet created. However,
orphaned assets over a configurable age threshold (default: 90 days) are surfaced to
ENTERPRISE_ADMIN in a dedicated orphaned content report. They are not automatically archived.

Orphaned asset reports are informational, not operational alerts. They do not affect PRE
resolution. They are a governance tool for managing content library health.

---

## Section 9 — Cross-Venue Content Sharing

### 9.1 Enterprise-Level vs Venue-Local Assets

ContentAssets exist at three ownership levels:

**Platform assets** (`org_id=null`, `venue_id=null`)
- System assets (fallback content, compliance asset library)
- Available to all venues
- Managed by PLATFORM_ADMIN
- Cannot be modified or deleted by ENTERPRISE_ADMIN or below

**Enterprise assets** (`org_id=set`, `venue_id=null`)
- Owned by the enterprise organization
- Available to all venues within the enterprise
- Managed by ENTERPRISE_ADMIN+
- Venue-level operators can reference but not modify enterprise assets

**Venue-local assets** (`org_id=set`, `venue_id=set`)
- Owned by the venue
- Available only to that venue's Playlists
- Managed by VENUE_OPERATOR+
- Cannot be shared to sibling venues directly

### 9.2 Cross-Venue Sharing Mechanics

A venue-local asset cannot be directly referenced by another venue's Playlist. To share content
across venues:
- ENTERPRISE_ADMIN promotes the asset to enterprise-level (changes `venue_id` to null). This makes it available to all enterprise venues. Promotion generates an audit record.
- Alternatively, the asset is duplicated at the destination venue (creating a new asset record with the same media file, new `asset_id`). This is the correct approach when the sharing is one-time and the asset should remain under separate ownership.

### 9.3 Enterprise Campaign + Venue Asset

An enterprise-level Campaign targeting a venue may reference enterprise-level assets only.
It may not reference venue-local assets (because the Campaign is owned by the enterprise, and
venue-local asset access is restricted to the venue owner). The API validates this at campaign
playlist binding time.

A venue-local Campaign may reference both enterprise assets and venue-local assets in its Playlists.

---

## Section 10 — Compliance Content Special Rules

### 10.1 Compliance Content Definition

A ContentAsset with `is_compliance_asset=true` is compliance content. Compliance content is
required content: it must appear in the resolution output for any screen whose venue's
`compliance_profile` includes the content's `compliance_flags`.

Examples:
- `RESPONSIBLE_GAMBLING` flag: Required on all screens in licensed clubs and venues with gambling licenses
- `DUTY_OF_CARE` flag: Required on licensed venue gaming zone screens
- `AGE_RESTRICTION` flag: Required on venues with alcohol licensing requirements
- `TOURNAMENT_NOTICE` flag: Required during active TOURNAMENT_ACTIVE contexts (golf)

### 10.2 L1 Exclusivity

Compliance content may only be excluded by an L1 Operational Override. No operator below
REGIONAL_MANAGER authority may create an L1 Override. Venue-level overrides (L2) cannot
exclude compliance content — the Playlist validation layer rejects any L2 Override Playlist
that omits required compliance assets for the venue.

This means:
- A VENUE_OPERATOR cannot remove compliance content from screens, even temporarily.
- A REGIONAL_MANAGER creating an L1 Override that omits compliance content receives a validation warning and must explicitly confirm the override with an acknowledgment that they are aware compliance content will not display.
- PLATFORM_ADMIN creating an L0 Emergency that omits compliance content: permitted (emergency content requirements supersede normal compliance in genuinely emergency situations), but the Emergency activation generates a compliance-gap audit record.

### 10.3 Compliance Content in Templates

Templates with `required_compliance` fields inherit from the market vertical's compliance
profile. When a Template is instantiated into a Campaign:
- The Campaign Playlist validation enforces compliance slots at instantiation time.
- The Playlist validation runs again at DRAFT → SCHEDULED transition.
- The Playlist validation runs again at SCHEDULED → ACTIVE transition.

Triple-gate validation prevents a campaign with a compliance gap from reaching live resolution.

### 10.4 Compliance Gap Detection

A Playlist has `has_compliance_gap=true` when:
- The venue's `compliance_profile` requires one or more compliance asset categories.
- The Playlist does not contain an ACTIVE ContentAsset with the required `compliance_flags`.

A Campaign with a compliance-gapped Playlist:
- Cannot transition from DRAFT to SCHEDULED.
- If the gap appears after activation (due to asset quarantine), the Campaign is auto-paused and an audit record is generated.
- The Campaign detail page surfaces the specific missing compliance categories and links to the compliance asset library.

---

## Section 11 — Relationship Integrity Summary

The following invariants are enforced by the API and the corpus validation layer. Violations
are rejected at the point of mutation (not caught later by entropy or replay).

| Invariant | Rule |
|-----------|------|
| IR-1 | A Screen belongs to exactly one ScreenZone. Zone reassignment is audited. |
| IR-2 | A Screen belongs to exactly one DeploymentGroup. Group reassignment is audited. |
| IR-3 | A Campaign with no Schedules is always INACTIVE in PRE resolution (valid state, no error). |
| IR-4 | A Campaign must have at least one ACTIVE Playlist at SCHEDULED and ACTIVE states. |
| IR-5 | A Playlist referenced by an ACTIVE Campaign may not be deleted. |
| IR-6 | A ContentAsset that appeared in any ReplayAuditRecord may not be deleted. |
| IR-7 | A Playlist with `has_compliance_gap=true` may not be activated. |
| IR-8 | Compliance content (`is_compliance_asset=true`) cannot be excluded from a Playlist by any mechanism below L1. |
| IR-9 | An Emergency Playlist must contain all required compliance assets for the venue's compliance profile. |
| IR-10 | A DeploymentGroup may not have two different active CorpusVersions simultaneously. |
| IR-11 | A CorpusVersion may not be deleted. Archival only. |
| IR-12 | Sponsorship `sov_target` may not exceed `SOV_MAX_EFFECTIVE` (0.9999). |
| IR-13 | An Override `reason` field may not be empty. Empty string is treated as absent. |
| IR-14 | An Emergency `acknowledgment_note` is required at clearance. Cannot be empty. |
| IR-15 | A Campaign targeting entities outside its owning organization's scope is rejected at creation. |
