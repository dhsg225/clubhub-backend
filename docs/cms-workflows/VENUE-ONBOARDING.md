# Venue Onboarding

**Document type:** Operational workflow specification
**Audience:** ENTERPRISE_ADMIN (primary), REGIONAL_MANAGER, VENUE_OPERATOR (steps 3+), platform engineers
**Depends on:** SCREEN-COMMISSIONING.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, CLUBHUB_SYSTEM_CONTRACTS.md, ENTROPY-REVIEW-WORKFLOWS.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Overview

Venue onboarding is the structured process by which a new physical venue is admitted to the ClubHub TV platform and transitions from "record exists" to "PRE is authoritative." The process is sequential — each phase gate must pass before the next phase begins — and each phase produces audit records that are retained permanently.

A venue is not considered "live on PRE" until it reaches the OPERATIONAL phase. Until then, PRE runs alongside legacy (or is not running at all), and any divergence is handled as part of the onboarding process rather than as an incident.

This document covers operational workflow. For the technical details of corpus seeding and PRE initialization, refer to PRE-REFERENCE-IMPLEMENTATION-v1.md.

---

## 2. Onboarding Phases

### Phase Overview

```
VENUE_CREATED → CORPUS_INITIALIZED → SCREENS_COMMISSIONED → SHADOW_VERIFICATION → CANARY_ELIGIBLE → OPERATIONAL
```

Each phase is a distinct state in the venue record. A venue cannot skip a phase. A venue can be held indefinitely at any phase. The only path backward is not a state rollback — it is an explicit "pause onboarding" action that stops progression while retaining the current phase state.

---

### Phase 1: VENUE_CREATED

**Description:** Basic venue record created. No screens exist. No corpus. PRE has no data for this venue.

**What exists:**
- Venue record: `venue_id`, `name`, `address`, `organization_id`, `market_vertical` (golf/club/hotel), `region_id`
- Organization relationship (venue assigned to an enterprise)
- Billing provisioning reference (out of platform scope, but recorded as `billing_reference_id`)

**Who can create:**
- ENTERPRISE_ADMIN creates the venue record
- REGIONAL_MANAGER can create venues within their region if granted by ENTERPRISE_ADMIN

**Audit record:** `venue.created` with `venue_id`, `created_by`, `organization_id`, `market_vertical`, `region_id`

**Nothing works at this phase:** No content can be assigned, no screens can be commissioned, no PRE invocation is possible.

---

### Phase 2: CORPUS_INITIALIZED

**Description:** PRE corpus loaded for this venue. Schedule templates applied. Market vertical configuration complete.

**What happens in this phase:**

1. **Corpus seeding** (see §4): Initial corpus built from enterprise template and vertical defaults. The corpus is a snapshot — it reflects the content and schedule structure expected for this venue.

2. **Market vertical configuration** (see §5): Vertical-specific corpus slots initialized. Golf venues get golf-specific defaults; club venues get club defaults; hotel venues get hotel defaults. Cross-vertical configurations are not permitted without ENTERPRISE_ADMIN explicit authorization.

3. **Compliance slot population:** L1 compliance slots for this venue's jurisdiction and license type are loaded. These are non-removable by venue-level operators.

4. **Emergency content slot population:** The `emergency_content` corpus slot is loaded. This MUST be complete before phase 3 begins (screen commissioning requires emergency content — see SCREEN-COMMISSIONING.md §2).

5. **CorpusVersion v1 established:** The initial corpus state is snapshotted as CorpusVersion v1 for this venue. All subsequent PRE operations reference a corpus version.

**Who can execute:**
- ENTERPRISE_ADMIN configures and confirms corpus initialization
- Platform engineer may execute corpus seeding scripts; ENTERPRISE_ADMIN must confirm

**Gate check before phase 3:**
- Emergency content slot populated: REQUIRED
- At least one valid schedule template loaded: REQUIRED
- Compliance slots populated per venue jurisdiction: REQUIRED
- CorpusVersion v1 established: REQUIRED

**Audit record:** `venue.corpus_initialized` with `venue_id`, `corpus_version_id`, `market_vertical`, `compliance_slots_loaded`, `emergency_content_slot_populated`, `template_source`

---

### Phase 3: SCREENS_COMMISSIONED

**Description:** Physical devices registered and baseline entropy established. Venue has at least one commissioned screen.

**What happens in this phase:**

Screens are commissioned following SCREEN-COMMISSIONING.md. The SCREENS_COMMISSIONED phase is complete when:
- At least one screen has passed the full 8-step commissioning sequence
- At least one screen has a confirmed entropy baseline
- At least one screen has a valid `screen.determinism_check_passed` audit record

A venue can have partially commissioned screens (some screens in commissioning, some complete) and still be in SCREENS_COMMISSIONED phase. The phase transitions when the minimum viable set of screens is complete. "Minimum viable" is defined by the ENTERPRISE_ADMIN at venue creation — typically the primary screen zones required for the venue to serve content.

**Entropy baseline implication:** The entropy baseline established at first commissioning is the founding reference for this venue's entropy health. All future entropy scans compare against this baseline (or against the current CorpusVersion — the baseline tracks CorpusVersion changes).

**Audit record:** `venue.screens_commissioned` with `venue_id`, `commissioned_screen_count`, `total_planned_screens`, `first_entropy_baseline_established_at`

---

### Phase 4: SHADOW_VERIFICATION

**Description:** PRE running alongside legacy system. Minimum observation period required. Parity thresholds must be met.

**What happens in this phase:**

PRE is activated in SHADOW_ONLY mode for this venue:
- PRE resolves content for each commissioned screen at each tick
- Legacy system also resolves content (or if no legacy, a reference implementation is used)
- Shadow orchestrator compares PRE output vs. legacy output for each screen tick
- Parity metric tracked: `parity_percentage` = (matching ticks / total ticks) × 100

**Minimum observation period:** 72 hours at minimum. Extended to 168 hours (7 days) if:
- Market vertical is golf (higher complexity due to tournament scheduling)
- Venue has more than 20 screens
- Enterprise requires extended validation (ENTERPRISE_ADMIN can set custom minimum)

**Parity threshold for CANARY_ELIGIBLE:** Default ≥99.5% parity over the observation period. Threshold is configurable per enterprise.

**What counts as a parity match:** PRE and legacy produce the same `playlist_checksum` for the same `screen_id` at the same `tick_timestamp`. Expected divergence (emergency content, scheduled overrides that legacy doesn't model) is categorized as `EXPECTED_DIVERGENCE` and excluded from the parity calculation.

**Who monitors:**
- Shadow comparison dashboard visible to REGIONAL_MANAGER+ for this venue
- Automatic alerts to ENTERPRISE_ADMIN if parity drops below 99% for more than 15 minutes

**Rollback in shadow phase:** If parity never reaches threshold, the venue stays in SHADOW_VERIFICATION indefinitely. There is no automatic timeout that fails the venue — a venue can remain in shadow mode for months if needed. ENTERPRISE_ADMIN must explicitly declare the venue "onboarding paused" to stop the observation period. See §7 (Rollback Path) for handling.

**Audit records:**
- `venue.shadow_verification_started` with `venue_id`, `shadow_start_at`, `observation_period_hours`, `parity_threshold`
- `venue.shadow_parity_report` (emitted every 24 hours) with `venue_id`, `parity_percentage`, `observation_hours_elapsed`, `expected_divergence_count`, `unexpected_divergence_count`

---

### Phase 5: CANARY_ELIGIBLE

**Description:** Parity thresholds met. Human approval required to proceed to canary promotion.

**Entry conditions:**
- Minimum observation period elapsed
- Parity percentage ≥ threshold for entire observation period (not just end of period)
- No unresolved CRITICAL entropy reports for this venue
- No active VENUE_EMERGENCY or FLEET_EMERGENCY affecting this venue
- ENTERPRISE_ADMIN attestation that venue is ready for canary

**What CANARY_ELIGIBLE means:**

The venue is cleared to begin the canary promotion sequence defined in the shadow/canary governance (STEP 8). This is not automatic — a human must approve the transition from CANARY_ELIGIBLE to the first canary stage.

The canary stages are: SHADOW_ONLY → INTERNAL_CANARY → SINGLE_VENUE → MULTI_VENUE → FLEET_WIDE → AUTHORITATIVE

CANARY_ELIGIBLE means the venue is ready to exit SHADOW_ONLY toward INTERNAL_CANARY. ENTERPRISE_ADMIN must approve this transition.

**Audit record:** `venue.canary_eligible` with `venue_id`, `parity_achieved_at`, `parity_percentage`, `observation_period_hours`, `approved_by`

---

### Phase 6: OPERATIONAL

**Description:** PRE is authoritative for this venue. Legacy system is no longer consulted. Venue is live on the platform.

**Entry conditions:**
- Venue has completed the full canary promotion sequence (AUTHORITATIVE canary stage reached)
- ENTERPRISE_ADMIN final approval recorded
- All screens in venue are commissioned and HEALTHY
- No unresolved entropy reports above ADVISORY severity
- Canary promotion has been in AUTHORITATIVE stage for minimum 24 hours without rollback

**What changes at OPERATIONAL:**
- PRE.resolve() is the sole authority for content on this venue's screens
- Legacy system is disabled for this venue
- Full monitoring activated (incident response paths, entropy SLAs, all circuit breakers)
- Venue included in fleet health aggregation

**Audit record:** `venue.operational` with `venue_id`, `operational_since`, `approved_by`, `total_onboarding_duration_days`, `screen_count`, `final_parity_percentage`

---

## 3. Pre-Onboarding

### 3.1 Organization Existence Check

Before a venue can be created, the organization (enterprise) must already exist in the platform. A venue cannot be created for a non-existent organization. The organization record includes:
- `organization_id`
- Enterprise tier (determines feature availability and compliance requirements)
- Regional structure (which regions are defined under this enterprise)
- Billing provisioning status (out of platform scope; recorded as reference only)

If the organization does not exist, PLATFORM_ADMIN must create it before onboarding can begin. Organization creation is not a venue-level or enterprise-level operation.

### 3.2 Enterprise Assignment

Every venue is assigned to exactly one enterprise. The assignment is immutable after venue creation — a venue cannot be transferred between enterprises without a full decommission and re-onboard (which creates a new venue record and new screen registrations).

---

## 4. Corpus Seeding

### 4.1 Sources

Initial corpus comes from:

1. **Enterprise template (primary source):** ENTERPRISE_ADMIN maintains a master corpus template for their enterprise. This template defines content categories, schedule structure, and default slot assignments. New venues inherit the enterprise template as their starting corpus.

2. **Vertical-specific defaults (layered on top):** Market vertical defaults provide content and schedule structure specific to the venue type. These are maintained at the platform level and are updated when vertical requirements change.

3. **Venue-specific customization (applied last):** ENTERPRISE_ADMIN or REGIONAL_MANAGER may apply venue-specific content on top of the template. This is optional and requires the same approval workflow as campaign creation.

### 4.2 Template Inheritance Rules

- Enterprise template slots that are marked `inherited: true` cannot be overridden at the venue level
- Compliance slots inherited from the enterprise template cannot be removed by any sub-enterprise role
- Vertical defaults that conflict with enterprise template are resolved in favor of enterprise template (template takes precedence)
- Venue-specific customization cannot remove inherited or vertical-mandated slots

### 4.3 Corpus Version v1

The initial corpus seeding produces CorpusVersion v1. This version is the entropy baseline anchor — all entropy scans compare device state against the current CorpusVersion (not v1 specifically, but v1 is the starting point). Subsequent campaign publishes, sponsorship activations, and content updates create new CorpusVersions (v2, v3, etc.).

---

## 5. Market Vertical Configuration

### 5.1 Golf

Golf venues initialize with:
- Tournament schedule template slots (weekly cadence by default)
- Leaderboard content zones (integrated with third-party scoring feeds if configured)
- Pro shop promotion slots (L4 by default)
- Club membership content (L3 default)
- Seasonal campaign structure (pre-season, in-season, off-season)
- Extended compliance slot set (alcohol advertising restrictions apply in most jurisdictions)

### 5.2 Club (Non-Golf)

Club venues initialize with:
- Events calendar template slots
- F&B promotion zones (L3-L4)
- Membership and loyalty content slots
- Seasonal campaign structure (leaner than golf — typically quarterly)
- Standard compliance slot set

### 5.3 Hotel

Hotel venues initialize with:
- Guest-facing information slots (wayfinding, amenity promotion)
- Seasonal campaign structure (travel seasonality — not sporting)
- External brand compliance slots (hotel brand standards as L1 slots if brand-managed property)
- Advertising slots for third-party content (L4 — lower density than golf/club)

### 5.4 Cross-Vertical

A venue cannot be assigned to multiple verticals simultaneously. Mixed-use facilities (e.g., a golf resort with a hotel) are modeled as two separate venue records — one golf, one hotel — each with its own corpus, commissioning, and onboarding process.

---

## 6. Onboarding Authority

| Action                              | Minimum Role        | Notes                                                         |
|-------------------------------------|---------------------|---------------------------------------------------------------|
| Create venue record                 | ENTERPRISE_ADMIN    | Or REGIONAL_MANAGER if delegated                             |
| Initialize corpus                   | ENTERPRISE_ADMIN    | Template selection and compliance slot population            |
| Commission individual screens       | VENUE_OPERATOR      | Within their assigned venue only                             |
| Approve CANARY_ELIGIBLE transition  | ENTERPRISE_ADMIN    | Required human approval gate                                 |
| Approve OPERATIONAL transition      | ENTERPRISE_ADMIN    | Required; PLATFORM_ADMIN notified                            |
| Pause onboarding                    | ENTERPRISE_ADMIN    | Stops phase progression; reason required                     |
| Abandon onboarding                  | ENTERPRISE_ADMIN    | Venue stays in current phase; not deleted                    |

---

## 7. Rollback Path

### 7.1 Parity Never Reaches Threshold

If shadow verification parity does not reach threshold within a reasonable time:

1. ENTERPRISE_ADMIN reviews shadow comparison logs to identify the source of divergence
2. If divergence is caused by known legacy behavior that PRE correctly does not replicate: ENTERPRISE_ADMIN can approve an exception (documented justification required) and grant CANARY_ELIGIBLE despite below-threshold parity
3. If divergence is caused by a PRE resolution bug: engineering investigation required; venue remains in SHADOW_VERIFICATION until bug is fixed
4. If divergence is caused by corpus mismatch: corpus update, re-scan, observation period restarts
5. If no resolution path: ENTERPRISE_ADMIN declares "onboarding paused"; venue remains in SHADOW_VERIFICATION indefinitely; legacy system continues to serve the venue

**The platform does not forcibly remove venues from shadow mode.** A venue can stay in shadow for as long as needed without impacting the rest of the fleet.

### 7.2 Canary Rollback During Onboarding

If a canary stage rollback is triggered during the onboarding canary sequence:
- Venue returns to SHADOW_ONLY canary stage
- Phase in the venue record remains CANARY_ELIGIBLE (the canary stage and the onboarding phase are separate dimensions)
- ENTERPRISE_ADMIN must re-approve INTERNAL_CANARY transition after the rollback cause is investigated and resolved

### 7.3 Emergency During Onboarding

If a VENUE_EMERGENCY or FLEET_EMERGENCY is declared while a venue is in SHADOW_VERIFICATION:
- Shadow comparison is paused for the emergency duration
- Emergency ticks are marked as `EXPECTED_DIVERGENCE` and excluded from parity calculation
- Observation period clock continues (the emergency hours count toward minimum observation period)
- After emergency clearance, shadow comparison resumes automatically

---

## 8. Onboarding Audit Record Reference

| Event                         | Emitted At                   | Required Fields                                                              |
|-------------------------------|------------------------------|------------------------------------------------------------------------------|
| `venue.created`               | Phase 1 entry                | venue_id, created_by, organization_id, market_vertical, region_id           |
| `venue.corpus_initialized`    | Phase 2 complete             | venue_id, corpus_version_id, compliance_slots_loaded, emergency_slot_populated |
| `venue.screens_commissioned`  | Phase 3 minimum complete     | venue_id, commissioned_screen_count, first_entropy_baseline_established_at  |
| `venue.shadow_verification_started` | Phase 4 entry         | venue_id, shadow_start_at, observation_period_hours, parity_threshold       |
| `venue.shadow_parity_report`  | Every 24h in Phase 4         | venue_id, parity_percentage, observation_hours_elapsed, divergence_counts   |
| `venue.canary_eligible`       | Phase 5 entry                | venue_id, parity_achieved_at, parity_percentage, approved_by               |
| `venue.canary_stage_advanced` | Each canary stage transition | venue_id, from_stage, to_stage, approved_by, stage_duration_hours           |
| `venue.operational`           | Phase 6 entry                | venue_id, operational_since, approved_by, total_onboarding_duration_days   |
| `venue.onboarding_paused`     | Pause action                 | venue_id, paused_by, current_phase, pause_reason                            |

All records append-only. Immutable after write.
