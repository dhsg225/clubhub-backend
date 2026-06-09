# ClubHub TV — Revenue Conflict Models

**Document type:** Business governance specification
**Authority:** Platform governance — constitutional layer
**Audience:** PLATFORM_ADMIN, ENTERPRISE_ADMIN, legal/commercial teams, VENUE_OPERATOR
**Depends on:** SPONSORSHIP-GOVERNANCE.md, ENGINEERING-CONSTITUTION-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Revenue Conflict Philosophy

Commercial conflicts in media platforms are typically resolved by whoever applies the most pressure. ClubHub TV rejects this model. Conflict resolution is deterministic, defined in advance, and immune to commercial pressure. The resolution hierarchy is the same hierarchy that governs all PRE resolution: constitutional obligations first, commercial arrangements last.

This document defines the five categories of revenue conflict that occur in practice, the rules that resolve each category, and the boundaries that commercial arrangements may not cross.

**Governing principle:** Any conflict that can be resolved by the PRE resolution hierarchy is not a system conflict — it is expected behavior. The PRE resolving LEVEL_3 content over LEVEL_4 sponsor content is not a "conflict" — it is correct operation. Revenue conflict only exists when two commercial interests compete within the same resolution layer.

---

## 2. Conflict Type 1 — Sponsorship Exclusivity Conflict

**Definition:** Two sponsors claim exclusive rights to the same screen zone and/or time window.

**Example:** Sponsor A holds exclusive rights to the bar zone Monday–Sunday 18:00–22:00 for Brand Category "Beer." Sponsor B attempts to activate a beer brand sponsorship targeting the same zone and overlapping time windows.

**Resolution rule:**

The system detects this conflict at activation time (not runtime) using the exclusivity conflict detection described in SPONSORSHIP-GOVERNANCE.md §5. The second sponsor's activation is blocked until the conflict is resolved.

Resolution options (presented to ENTERPRISE_ADMIN or VENUE_OPERATOR):
1. Adjust the second sponsor's time windows to avoid overlap with the first sponsor's exclusivity window
2. Exclude the conflicting zones from the second sponsor's scope
3. Negotiate a shared allocation within the zone/window (requires removing exclusivity from the first sponsor's agreement, which is a commercial matter outside the system)
4. Reject the second sponsor's contract entirely

**System behavior:** The system enforces whichever resolution is entered as the operational parameters. It cannot decide between these options — that is a commercial decision.

**What the system will not do:** Activate both sponsors in the same zone/window if an exclusivity clause is recorded. Activation failure is hard — it is not a warning that can be dismissed.

---

## 3. Conflict Type 2 — Campaign vs Sponsorship Conflict

**Definition:** An active LEVEL_3 campaign displaces LEVEL_4 sponsor content on contracted screens during contracted windows.

**Critical framing: this is not a conflict. This is correct constitutional behavior.**

LEVEL_3 content resolves before LEVEL_4 content. This is the PRE resolution hierarchy. A campaign at LEVEL_3 always takes priority over sponsor content at LEVEL_4. No commercial arrangement changes this.

**Implications for sponsor SLA management:**

When a LEVEL_3 campaign is active on screens contracted to a sponsor:
- The sponsor's content is suppressed for the duration of the campaign
- The delivered SOV for the sponsor falls below configured SOV during the campaign window
- This is recorded in the proof-of-play report as a suppression event, with the suppressor type identified as `LEVEL_3_CAMPAIGN`
- The commercial implications (whether the SOV shortfall triggers SLA remediation) are a matter between the venue and the sponsor, resolved outside the system

**System obligations during campaign/sponsorship overlap:**
- Surface the suppression event clearly in the Sponsorship Operations Workspace (SPONSORSHIP-OPERATIONS-UX-v1.md §4.1)
- Alert the VENUE_OPERATOR and ENTERPRISE_ADMIN when projected campaign duration will cause the sponsor's cumulative SOV to fall below minimum commitment threshold
- Record the suppression accurately in proof-of-play records

**What the system will not do:** Reduce campaign priority or scope to preserve sponsor SOV. Campaign authority (LEVEL_3) is constitutionally above sponsorship authority (LEVEL_4).

---

## 4. Conflict Type 3 — Sponsorship vs Compliance Conflict

**Definition:** A sponsor's content configuration, if executed as requested, would crowd out or suppress LEVEL_1 compliance content.

**Critical framing: this conflict cannot exist at runtime if the platform is operating correctly.** The PRE resolution hierarchy makes it constitutionally impossible for LEVEL_4 content to suppress LEVEL_1 content. L1 resolves first; L4 fills remaining time.

However, compliance conflicts can arise at the configuration level:

**Configuration conflict scenario:** A venue's L1 slot frequency is set to "every third slot" (the regulatory minimum for their gaming hours). A sponsor requests a rotation that would effectively give them 80% of the remaining 2/3 of slots, with editorial content receiving only the remainder. While technically compliant at the L1 level, the sponsor rotation may violate the spirit of responsible content obligations or other editorial content commitments the venue has made.

**Resolution rule:**

L1 slot frequency is determined by regulatory requirements and venue compliance configuration. It cannot be reduced by any sponsorship configuration. The system enforces this mechanically.

Beyond L1 minimums, editorial content ratios (the proportion of L3–L5 content that is editorial vs sponsor) are an operator governance decision. Platform-level guidance:
- Sponsor content should not exceed 40% of non-L1 editorial time on any screen in a licensed venue context without explicit ENTERPRISE_ADMIN review
- In gaming room zones, sponsor content is constitutionally excluded regardless of any commercial arrangement

**In licensed venues with gambling-adjacent sponsors:** Responsible gambling messaging (L1) and gambling brand sponsor content (L4) must not be configured in immediately adjacent rotation slots. This is a content adjacency requirement enforced by operator review, not by the system automatically. The preview system surfaces the adjacency for review before activation.

---

## 5. Conflict Type 4 — Revenue vs Operational Override Conflict

**Definition:** A sponsor has a contracted minimum SOV commitment, but the venue's operational requirements (event management, emergency, compliance) cause override conditions that suppress sponsor airtime below that commitment.

**Resolution rule: operational authority is unconditional.**

No commercial arrangement grants a sponsor the right to prevent operational overrides. When a VENUE_OPERATOR creates an override at LEVEL_0, LEVEL_1, or LEVEL_2, that override takes effect immediately. The system does not warn "this override will suppress a sponsor's contracted airtime" as a blocking condition — it may surface this as an informational alert, but the override is not gated on sponsor SLA implications.

**Specific scenarios:**

| Operational event | System behavior | Commercial implication |
|---|---|---|
| VENUE_EMERGENCY (LEVEL_0) | Sponsor content immediately suppressed on affected screens | Commercial matter — sponsor SLA missed; outside system resolution |
| EMERGENCY_FREEZE (constitutional state) | All non-emergency content suppressed fleet-wide | Commercial matter — all sponsor SLAs impacted; outside system resolution |
| LEVEL_1 operational override (e.g., event coverage) | Sponsor content suppressed during override window | System alerts if cumulative SOV shortfall threshold exceeded; commercial resolution outside system |
| LEVEL_2 scheduled override (e.g., venue function) | Sponsor content suppressed during scheduled window | Logged as suppression event in proof-of-play; no system-level commercial action |

**System obligations in operational override scenarios:**
- Record all override suppression events accurately in proof-of-play reports
- Alert ENTERPRISE_ADMIN when operational overrides have caused cumulative SOV to fall below minimum commitment threshold
- Provide impacted airtime data (hours suppressed, SOV percentage impact) from audit records for commercial resolution purposes

**What the system will not do:** Modify, delay, scope-reduce, or block an operational override to preserve sponsor airtime. Operational authority is always prior to commercial authority.

---

## 6. Conflict Type 5 — Cross-Venue Sponsor Conflict

**Definition:** An enterprise-level sponsor (contracted across multiple venues) and a venue-local sponsor both have L4 content targeted at the same screen zone at the same venue.

**Resolution rule:**

Cross-venue and venue-local sponsor conflicts are resolved within the LEVEL_4 slot pool using the following priority order:

1. **Exclusivity clause:** If either sponsor has a recorded exclusivity clause for the zone/window, that sponsor's content takes the exclusive slot. The conflicting sponsorship activation is blocked.
2. **Booking order:** Where no exclusivity exists, the sponsor whose contract was activated first (chronologically) has priority in the L4 slot pool.
3. **Negotiated allocation:** Where the venue has explicitly configured a time-allocation split between two sponsors at the same level, the system honors that configuration.

**ENTERPRISE_ADMIN authority in cross-venue conflicts:**

ENTERPRISE_ADMIN may override venue-local sponsor slot allocation to give enterprise-level sponsors guaranteed slot weighting. This is a configuration authority, not a constitutional one — ENTERPRISE_ADMIN is adjusting LEVEL_4 allocation parameters, not changing the resolution level of any content.

**What does not change in this conflict:** Neither sponsor's content moves above LEVEL_4. Both remain subject to suppression by LEVEL_0 through LEVEL_3 content, regardless of which sponsor has priority within LEVEL_4.

---

## 7. Commercial vs Operational Authority — The Definitive Boundary

This section states, without qualification, the boundary between what commercial arrangements can and cannot do to the operational system.

### 7.1 Commercial Arrangements CAN

- Configure the parameters within which LEVEL_4 content is delivered (zones, windows, rotation weights)
- Record exclusivity claims that the system enforces at activation time
- Set minimum SOV commitments that the system tracks and alerts against
- Grant SPONSOR_STAKEHOLDER access for read and proof-of-play reporting
- Request preview access to see how content will appear in context
- Configure proof-of-play delivery preferences

### 7.2 Commercial Arrangements CANNOT

- Elevate content from LEVEL_4 to any higher resolution level
- Prevent or delay operational overrides at LEVEL_0 through LEVEL_2
- Prevent or delay EMERGENCY_FREEZE or constitutional state transitions
- Suppress or shorten L1 compliance content
- Accelerate canary stage promotion (deployment gates are constitutional, not commercial)
- Modify or selectively report proof-of-play data
- Override entropy acknowledgment authority requirements
- Compress EMERGENCY_FREEZE exit timelines
- Grant mutation authority to any SPONSOR_STAKEHOLDER user

These are absolute constraints. They are not configurable by PLATFORM_ADMIN. They are not overridable by contract language. Commercial agreements that purport to grant any of these capabilities are unenforceable within the system.

### 7.3 SLA Misses Due to Constitutional Events

When a constitutional event (EMERGENCY_FREEZE, circuit breaker activation, LEVEL_0 emergency) causes sponsor airtime to be missed:

1. The system records the event and the duration of sponsor suppression with full precision
2. The proof-of-play report for the affected period accurately shows the suppression event and its type
3. ENTERPRISE_ADMIN is notified of the suppression impact
4. Commercial resolution — whether the SLA miss triggers compensation — is a matter entirely outside the system

The platform provides accurate evidence (suppression type, duration, affected screens). It does not take any action to compensate for the SLA miss, restore airtime retroactively, or modify reporting to reduce the apparent impact.

---

## 8. Revenue Pressure and Entropy Risk

### 8.1 Rapid Sponsor Roster Changes Increase Entropy Risk

The entropy system (OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md) measures the rate and volume of corpus changes. Frequent sponsor content changes — new assets uploaded, zone configurations changed, new sponsorships activated — are corpus change events. High-frequency commercial activity generates entropy.

The relationship is direct: faster commercial change = higher entropy risk.

**Mechanisms by which sponsorship activity generates entropy:**
- New sponsor content assets uploaded to the corpus increase corpus delta
- Changing zone or time window configuration for active sponsorships changes resolution state
- Activating or deactivating sponsorships changes the LEVEL_4 slot pool composition
- Exclusivity conflict resolution changes that modify existing sponsorship parameters re-trigger entropy evaluation

### 8.2 ENTERPRISE_ADMIN Awareness of Commercial Entropy

ENTERPRISE_ADMIN users who are managing active commercial relationships should understand that their commercial decisions have operational entropy consequences. The platform surfaces this:

- The entropy dashboard shows corpus change rate, including a breakdown by change type that identifies sponsorship-originated changes
- When a sponsorship configuration change would push corpus change rate above a configured threshold, the system alerts the ENTERPRISE_ADMIN before completing the change
- Entropy state is always visible to ENTERPRISE_ADMIN — commercial activity cannot obscure operational health

### 8.3 Rate Limiting for Corpus Change Frequency

ENTERPRISE_ADMIN may configure a maximum corpus change rate (changes per 24-hour window) for each venue. This rate limit applies to all corpus changes, including sponsorship-originated ones.

If a rate limit is configured and a sponsorship change would exceed it:
- The change is queued, not blocked
- ENTERPRISE_ADMIN is notified that the change is queued
- The change executes when the rate window resets
- Urgent operational changes (LEVEL_0 through LEVEL_2) bypass the rate limit; only LEVEL_4 and below changes are queued

This mechanism allows venues with high commercial activity to protect their operational stability without manual change management.

---

## 9. Conflict Detection Architecture

### 9.1 Detection at Activation, Not at Runtime

All conflict detection runs at sponsorship activation time. This is a deliberate architectural decision:

**Why activation-time detection:**
- Conflicts discovered at runtime cause operational disruption and have already affected delivery records
- Activation-time detection surfaces conflicts before they affect any sponsor's airtime
- ENTERPRISE_ADMIN and VENUE_OPERATOR have time to resolve the conflict before the sponsorship goes live
- Proof-of-play records are clean — they do not contain partial-delivery artifacts from runtime conflict resolution

**What activation-time detection cannot catch:**
- Conflicts that arise from changes to existing sponsorships after activation (e.g., an existing sponsor's time window is expanded to overlap with another sponsor). These modifications re-trigger conflict detection.
- Conflicts arising from operational changes that reduce sponsor airtime (overrides, campaigns) — these are not exclusivity conflicts; they are correct PRE operation.

### 9.2 Conflict Presentation to Operators

When a conflict is detected, the operator is presented with:
- The specific nature of the conflict (exclusivity type, affected zone, affected time window)
- Which existing sponsorship the new sponsorship conflicts with (note: competing enterprise's sponsor identity is visible to ENTERPRISE_ADMIN and VENUE_OPERATOR, not to SPONSOR_STAKEHOLDER)
- Resolution options ranked by simplest-to-implement
- The ability to save the new sponsorship as a draft for commercial review before discarding it

Conflict presentation is a blocking gate. The new sponsorship cannot be activated until the conflict is resolved or the sponsorship is discarded.

---

*End of REVENUE-CONFLICT-MODELS.md*
*Conflict detection implementation: src/sponsorship/conflict-detection. PRE resolution hierarchy: PRE-REFERENCE-IMPLEMENTATION-v1.md.*
