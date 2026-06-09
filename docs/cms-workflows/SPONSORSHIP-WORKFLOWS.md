# Sponsorship Workflows

**Document type:** Operational workflow specification
**Audience:** ENTERPRISE_ADMIN (primary), REGIONAL_MANAGER, VENUE_OPERATOR, SPONSOR_STAKEHOLDER (read guidance), platform engineers
**Depends on:** PRE-REFERENCE-IMPLEMENTATION-v1.md, CAMPAIGN-LIFECYCLE.md, OVERRIDE-LIFECYCLE.md, SPONSORSHIP-OPERATIONS-UX-v1.md, REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Overview

A sponsorship in ClubHub TV is a commercial contract, not a content configuration. This distinction is operational: a content configuration can be changed or removed without accountability; a contract has fulfillment obligations. The platform models sponsorships as contracts and enforces the obligations through the PRE resolution hierarchy, proof-of-play audit, and SOV tracking.

Sponsor content resolves at PRE level L4 — below emergency (L0), operational overrides (L1), scheduled overrides (L2), and campaigns (L3). This resolution position is not a limitation; it is the stated commercial structure. The constitutional floor ensures that L0-L3 content cannot be displaced by L4 content regardless of commercial agreement, and the proof-of-play system provides verifiable accountability for any displacement that occurs.

---

## 2. Sponsorship States

```
DRAFT → CONTRACTED → SCHEDULED → ACTIVE → FULFILLED → EXPIRED
```

| State      | Description                                                                                   |
|------------|-----------------------------------------------------------------------------------------------|
| DRAFT      | Sponsorship terms being defined. No corpus binding. No delivery tracking.                    |
| CONTRACTED | Terms confirmed and signed off. Corpus slot reserved. Content delivery path established.      |
| SCHEDULED  | Content loaded into corpus. PRE will begin resolving L4 at contract start_time.             |
| ACTIVE     | PRE is resolving sponsor content at L4. Delivery tracking and SOV measurement active.        |
| FULFILLED  | Contract end_time reached. Proof-of-play report generated. Sponsor stakeholder notified.     |
| EXPIRED    | Post-fulfillment administrative close. Corpus slot released. Audit records retained.          |

### 2.1 State Transitions

**DRAFT → CONTRACTED:** ENTERPRISE_ADMIN records contract terms. Requires: zone targeting defined, time window defined, SOV percentage contracted, CONTRACTED state requires explicit `contracted: true` flag set.

**CONTRACTED → SCHEDULED:** ENTERPRISE_ADMIN confirms content delivery. Sponsor assets loaded into corpus and compliance check passed. CorpusVersion updated for the L4 slot.

**SCHEDULED → ACTIVE:** Automatic at `contract_start_time`. PRE begins L4 resolution for contracted screens.

**ACTIVE → FULFILLED:** Automatic at `contract_end_time`. Proof-of-play report generated immediately. SOV report sent to SPONSOR_STAKEHOLDER.

**FULFILLED → EXPIRED:** ENTERPRISE_ADMIN administrative close. Corpus slot released. Typically 30 days post-fulfillment.

---

## 3. Sponsorship Creation

### 3.1 Who Creates Sponsorships

ENTERPRISE_ADMIN creates all sponsorships. REGIONAL_MANAGER may create sponsorships for venues within their region if delegated by ENTERPRISE_ADMIN. VENUE_OPERATOR cannot create sponsorships — this is intentional. Sponsorships are commercial agreements that require enterprise-level accountability.

### 3.2 Required Fields at Creation

| Field                    | Description                                                                              |
|--------------------------|------------------------------------------------------------------------------------------|
| `sponsor_name`           | Legal entity name of the sponsor                                                         |
| `contract_reference`     | External contract ID (CRM, billing system, or manual reference)                         |
| `venue_scope`            | Which venues are covered (specific venue, region, or fleet subset)                      |
| `zone_targeting`         | Which screen zones within covered venues (e.g., bar_zone, entrance_zone)                |
| `time_window`            | `contract_start_date`, `contract_end_date`, `eligible_hours` (e.g., 09:00-22:00)       |
| `sov_contracted`         | Contracted share-of-voice percentage within the eligible time window and zone           |
| `content_category`       | What type of content the sponsor is permitted to display (governs compliance review)     |
| `exclusivity_scope`      | Whether sponsor has exclusivity in their category within the contracted zones            |

### 3.3 Compliance Pre-Check at Creation

Before a sponsorship can move from DRAFT to CONTRACTED, the system performs a compliance pre-check:
- Content category checked against venue jurisdiction restrictions
- Alcohol/gambling/pharmaceutical categories checked against specific club license types
- If pre-check fails, ENTERPRISE_ADMIN sees the specific restriction and must either change the content category or not proceed

This pre-check is not the full compliance review (that happens at CONTRACTED → SCHEDULED when actual content is loaded). It is a category-level gate to prevent obviously non-compliant sponsorships from being created.

---

## 4. Exclusivity Enforcement

### 4.1 Category Exclusivity

If a sponsorship has `exclusivity_scope` set (e.g., "exclusive in beer category for bar_zone"), the system prevents any other sponsorship from being created or activated for the same category, zone, and overlapping time window.

Exclusivity conflict detection runs at:
- CONTRACTED transition (when the exclusivity claim is formally established)
- SCHEDULED transition (before PRE indexes the content at L4)

If an exclusivity conflict is detected at SCHEDULED transition (because a conflicting sponsorship was added after CONTRACTED), the newer sponsorship is blocked from SCHEDULED until the conflict is resolved. Resolution options:
1. Modify the zone or time window of the conflicting sponsorship (no exclusivity overlap)
2. ENTERPRISE_ADMIN explicitly waives the exclusivity claim for the specific overlap period (recorded as `exclusivity_waiver` with justification)

### 4.2 Revenue Conflict Detection

Overlapping sponsorships (same zone, same time window, different categories, no exclusivity claim) are permitted but generate a WARNING at CONTRACTED transition. The warning surfaces:
- Projected SOV for each sponsorship given the overlap
- Estimated impact on each sponsor's ability to meet contracted SOV

If projected SOV for any sponsorship falls below contract threshold due to the overlap, ENTERPRISE_ADMIN must acknowledge this and either:
1. Modify the SOV contract for one or more sponsorships to reflect the realistic projection
2. Acknowledge that SOV may not be met and document the commercial decision

This acknowledgment is recorded and visible in the proof-of-play report for each affected sponsorship.

---

## 5. Sponsorship Content Delivery

### 5.1 Content Loading

Sponsor assets (video, images, feeds) are loaded into the corpus L4 slot for the contracted venues and zones. This is done by ENTERPRISE_ADMIN after the sponsor delivers assets.

Loading process:
1. Assets uploaded to platform (video transcoded to delivery format, images resized for target screen specs)
2. Asset checksums computed and recorded
3. Compliance content review: assets reviewed against content category rules (see §6)
4. On compliance pass: assets written to corpus L4 slot; CorpusVersion updated for affected venues
5. `sponsorship.content_loaded` audit record: `sponsorship_id`, `asset_ids[]`, `asset_checksums[]`, `corpus_version_updated_to`, `compliance_review_passed`

### 5.2 PRE L4 Assignment

Once assets are in the corpus, the L4 slot for each contracted screen and time window is populated. PRE resolves this at L4 during the contract window when no L0-L3 content occupies the slot.

The L4 slot assignment is deterministic: given the same `at` timestamp, `screen_id`, and corpus version, PRE will always produce the same result. If a sponsor content update changes the corpus, a new CorpusVersion is created and all PRE resolutions from that point forward use the new version.

---

## 6. Compliance Review

All sponsor content must pass compliance review before SCHEDULED transition:

### 6.1 Automated Compliance Checks

- Video duration within allowed slot length
- No prohibited content categories in metadata (automated content tagging)
- Asset format meets delivery specification
- No embedded third-party tracking that violates platform policy

### 6.2 Manual Compliance Review

For content in sensitive categories (alcohol, gambling, pharmaceutical, political):
- ENTERPRISE_ADMIN reviews content against venue jurisdiction restrictions
- For licensed clubs: REGIONAL_MANAGER attests content is compliant with club license terms
- Review recorded: `compliance_review_id`, `reviewed_by`, `reviewed_at`, `category`, `jurisdiction`, `result`

Compliance review failure returns the sponsorship to CONTRACTED state. ENTERPRISE_ADMIN must work with sponsor to resolve content issues before re-attempting SCHEDULED transition.

---

## 7. Proof of Play

### 7.1 What Proof of Play Is

Proof of play is the verifiable record of sponsor content delivery. In ClubHub TV, proof of play is derived from the replay audit log — specifically, the ReplayAuditRecords generated by PRE when sponsor content resolved at L4.

Each proof-of-play record includes:
- `screen_id` where content played
- `tick_timestamp` when content played
- `playlist_checksum` (cryptographic proof of what played)
- `sponsorship_id` and `asset_id`
- `pre_level` at which content resolved (always L4 for uncontested sponsor content)
- Suppression events: ticks where the sponsorship would have resolved at L4 but was displaced by L0-L3 content

### 7.2 SOV Calculation

SOV (share-of-voice) is calculated as:
```
SOV_actual = (ticks_delivered / ticks_eligible) × 100
```

Where:
- `ticks_eligible`: All resolution ticks within the contracted time window and zone where the screen was operational and no constitutional override was in effect
- `ticks_delivered`: Of eligible ticks, those where sponsor content resolved at L4

Suppressed ticks (displaced by L0-L3 content) are categorized:
- `suppressed_by_emergency`: Excluded from denominator (force majeure — does not count against SOV)
- `suppressed_by_override`: Included in denominator (counts against SOV; disclosed in proof-of-play report)
- `suppressed_by_campaign`: Included in denominator (counts against SOV)

### 7.3 Proof-of-Play Report

Generated automatically at ACTIVE → FULFILLED. Contains:
- Total ticks delivered
- SOV actual vs. SOV contracted
- Suppression breakdown by category
- Per-screen delivery summary
- Cryptographic audit trail reference (replay_audit_record_ids[])
- Compliance attestation

Report delivered to SPONSOR_STAKEHOLDER automatically. Also available to ENTERPRISE_ADMIN on demand for any period of an ACTIVE sponsorship (interim reports).

### 7.4 Replay Audit as Legal Record

The ReplayAuditRecords backing the proof-of-play report are immutable and append-only. They constitute the authoritative evidence of what played, when, and on which screens. This is the platform's response to "can you prove my content played?" — the answer is the audit record chain with cryptographic checksums, not a screenshot or verbal assurance.

---

## 8. Sponsor Portal Access (SPONSOR_STAKEHOLDER Role)

### 8.1 What SPONSOR_STAKEHOLDER Can See

- Live SOV tracking for their active sponsorships (near-real-time, updated every 15 minutes)
- Proof-of-play reports for current and past sponsorships
- Preview of their own content: POINT_IN_TIME preview showing when their content will appear in the next 24 hours
- Suppression log: when and why their content was displaced (no operational details exposed — only the category of displacement: emergency/override/campaign)
- Alert: notification when SOV drops below 90% of contracted threshold

### 8.2 What SPONSOR_STAKEHOLDER Cannot Do

- Cannot create, modify, or cancel any content configurations
- Cannot create overrides of any kind
- Cannot view content from other sponsorships (even at the same venue)
- Cannot view campaign or override details (only displacement category)
- Cannot trigger emergency or operational actions

### 8.3 SOV Alert to SPONSOR_STAKEHOLDER

When real-time SOV tracking shows that the current delivery rate projects to miss contracted SOV by the end of the contract window:
- SPONSOR_STAKEHOLDER receives an automatic alert when projected shortfall > 5%
- Alert includes: current SOV%, contracted SOV%, projected end-of-contract SOV% if current rate continues
- Alert does NOT include: operational details of what is displacing the content (this is internal)

The alert creates an accountability mechanism: if the sponsor sees they are projected to be under-delivered, they can contact the venue. The venue team (ENTERPRISE_ADMIN/REGIONAL_MANAGER) can review the suppression log and take operational action if warranted.

---

## 9. Override Restrictions on Sponsor Slots

### 9.1 Who Can Affect Sponsor Content

Any VENUE_OPERATOR+ who creates an override that displaces sponsor content during the contracted window must receive and acknowledge the SOV impact warning (see OVERRIDE-LIFECYCLE.md §4.3). The override is not blocked — operational priorities can legitimately displace sponsor content — but the displacement is recorded and accountable.

Sponsors cannot create overrides. SPONSOR_STAKEHOLDER has no ability to influence content resolution. Only VENUE_OPERATOR+ can create overrides, and only operators who understand the commercial implications of doing so (informed by the SOV impact warning) can proceed.

### 9.2 Constitutional Floor

The constitutional guarantee is absolute: L4 sponsor content cannot displace L0 (emergency), L1 (operational override), L2 (scheduled override), or L3 (campaign) content. No commercial agreement can override this hierarchy. A sponsorship contract that purports to guarantee "always-on" display is not fulfillable by the platform — the proof-of-play report will correctly reflect the actual delivery including any displacement.

This should be disclosed to sponsors at contract time. The ENTERPRISE_ADMIN is responsible for setting correct commercial expectations.

---

## 10. Sponsorship Audit Record Reference

| Event                           | Emitted At                    | Required Fields                                                                    |
|---------------------------------|-------------------------------|------------------------------------------------------------------------------------|
| `sponsorship.created`           | DRAFT created                 | sponsorship_id, sponsor_name, contract_reference, created_by                      |
| `sponsorship.contracted`        | DRAFT → CONTRACTED            | sponsorship_id, sov_contracted, zone_targeting, exclusivity_scope, contracted_by  |
| `sponsorship.exclusivity_conflict_detected` | CONTRACTED gate  | sponsorship_id, conflicting_sponsorship_id, conflict_type                         |
| `sponsorship.content_loaded`    | Asset delivery                | sponsorship_id, asset_ids[], compliance_review_id, corpus_version_updated_to      |
| `sponsorship.compliance_reviewed` | Content review               | sponsorship_id, reviewed_by, category, jurisdiction, result                       |
| `sponsorship.scheduled`         | CONTRACTED → SCHEDULED        | sponsorship_id, corpus_version_id, indexed_screen_ids[], contract_start_time      |
| `sponsorship.activated`         | SCHEDULED → ACTIVE            | sponsorship_id, activated_at, sov_tracking_started                                |
| `sponsorship.sov_alert`         | SOV threshold breach          | sponsorship_id, current_sov, contracted_sov, projected_end_sov                    |
| `sponsorship.suppression_event` | Each tick displaced           | sponsorship_id, screen_id, tick_timestamp, displaced_by_level, displaced_by_type  |
| `sponsorship.fulfilled`         | ACTIVE → FULFILLED            | sponsorship_id, sov_actual, sov_contracted, proof_of_play_report_id               |
| `sponsorship.expired`           | FULFILLED → EXPIRED           | sponsorship_id, expired_at, archived_by                                           |

All records append-only. Immutable after write. Hash-chained via workflow_traces.
