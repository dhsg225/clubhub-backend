# ClubHub TV — Sponsorship Governance

**Document type:** Business governance specification
**Authority:** Platform governance — constitutional layer
**Audience:** PLATFORM_ADMIN, ENTERPRISE_ADMIN, REGIONAL_MANAGER, VENUE_OPERATOR, legal/commercial teams
**Depends on:** ENGINEERING-CONSTITUTION-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md, docs/shared/SPONSORSHIP-OPERATIONS-UX-v1.md, docs/market-verticals/LICENSED-CLUBS.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Constitutional Position of Sponsorship

Sponsorship is a commercial service the ClubHub TV platform delivers on top of its constitutional infrastructure. This ordering is non-negotiable: the constitutional infrastructure exists first, and sponsorship operates within the space that infrastructure leaves open.

The PRE resolution hierarchy places sponsorship at **LEVEL_4**. This is not a configuration default — it is a constitutional assignment. No commercial arrangement, enterprise agreement, or platform upgrade can elevate sponsor content above LEVEL_4.

The practical consequence: sponsor content plays when no LEVEL_0 (emergency), LEVEL_1 (compliance), LEVEL_2 (venue schedule), or LEVEL_3 (campaign) content is actively resolving for a screen. Sponsor content fills the gaps. It does not compete with, displace, or delay higher-level content.

**This is the foundational promise of the platform to every operator:** their operational and compliance obligations are always satisfied before any commercial arrangement is fulfilled.

---

## 2. Sponsorship Authority Model

### 2.1 What Sponsors Control

Sponsors operate exclusively within the LEVEL_4 layer of the PRE. Within LEVEL_4, sponsors may configure:

- **Venue and zone targeting:** Which screens and zones their content appears on, subject to operator approval
- **Time windows:** Which hours of day and days of week their content is eligible to play
- **Rotation parameters:** Frequency and weighting within the LEVEL_4 slot pool
- **Content assets:** What creative assets are associated with their sponsorship
- **Exclusivity scope:** Whether they require no competing sponsor in their contracted zone/window (subject to conflict detection at activation time — see Section 5)

### 2.2 What Sponsors Cannot Control

The following are beyond sponsor authority. They cannot be granted by any commercial agreement, "premium tier" arrangement, or contractual obligation:

| Prohibited action | Why prohibited |
|---|---|
| Creating, modifying, or suppressing LEVEL_0 content | Emergency authority is reserved for VENUE_OPERATOR and above |
| Influencing LEVEL_1 compliance content in any way | L1 is a non-negotiable compliance floor; no commercial arrangement supersedes regulatory requirements |
| Creating or modifying LEVEL_2 schedule entries | Schedule authority belongs to venue operators |
| Creating or modifying LEVEL_3 campaigns | Campaign authority belongs to venue and enterprise admins |
| Elevating their content to LEVEL_0 through LEVEL_3 through any mechanism | Constitutional constraint — non-configurable |
| Triggering or preventing constitutional state transitions (EMERGENCY_FREEZE, circuit breakers) | Constitutional state machine is closed to commercial actors |
| Advancing canary deployment stages | Deployment authority requires ENTERPRISE_ADMIN or above |
| Accessing audit replay records, parity reports, or entropy data | Operational data is outside sponsor visibility scope |
| Modifying proof-of-play records | Records are append-only and tamper-evident — no actor can modify them |

### 2.3 The SPONSOR_STAKEHOLDER Role

The SPONSOR_STAKEHOLDER role is the system representation of a sponsor's operational access. It is designed to give sponsors the visibility they need to manage their relationship with the venue without granting any authority over platform operations.

**SPONSOR_STAKEHOLDER may:**
- Read their own sponsorship configuration (venues, zones, time windows, content assets)
- Preview their content as it will appear in context using the Preview system
- Download proof-of-play reports for their assigned venues and contract periods
- Configure report delivery preferences (email, API webhook) for their proof-of-play reports
- View SOV (share of voice) metrics for their contracted screens during their contract period

**SPONSOR_STAKEHOLDER may NOT:**
- View any other sponsor's data, configuration, or reports
- Access audit replay logs (raw operational audit records)
- Access parity reports or shadow comparison data
- Access entropy reports or entropy alert history
- View constitutional state history or current constitutional state
- See any venue's operational configuration beyond whether their own content is active
- Take any action that changes system state

**The SPONSOR_STAKEHOLDER role carries zero mutation authority and zero emergency authority.** It is a read-and-download role only.

---

## 3. Sponsorship Agreement Structure

### 3.1 What Lives Outside the System

Commercial sponsorship agreements — contract terms, pricing, liability clauses, payment schedules, dispute resolution procedures — are external to the ClubHub TV platform. The system has no knowledge of:

- Dollar amounts, pricing tiers, or payment terms
- Legal obligation or liability language
- Penalty clauses or SLA compensation terms
- Contract renewal or termination conditions

These are managed by the venue's commercial team using external contract management systems. The ClubHub TV platform is not a contract management system.

### 3.2 What the System Records

The system records **operational parameters** derived from the commercial agreement. These are the configuration values that govern how sponsor content behaves within the platform:

| Parameter | Type | Description |
|---|---|---|
| `venue_scope` | List of venue IDs | Which venues the sponsorship applies to |
| `zone_scope` | List of zone IDs | Which screen zones within those venues |
| `time_windows` | Recurring schedule | Days of week and hours eligible for sponsor content |
| `exclusivity_scope` | Zone + category | Whether sponsor has exclusive rights in a zone/category combination |
| `minimum_sov_commitment` | Percentage | The SOV commitment the venue is obligated to deliver (for tracking and alerting — not enforceable by system) |
| `contract_start` | Date | When sponsor content is eligible to begin playing |
| `contract_end` | Date | When sponsor content eligibility expires |
| `compliance_metadata` | Key-value set | Compliance flags on content assets (age ratings, license conditions, jurisdiction) |

The system does not enforce commercial commitments. It tracks delivery against commitments and surfaces gaps. The commercial resolution of any gap is outside the system.

### 3.3 Minimum SOV Commitment

The `minimum_sov_commitment` parameter represents the SOV the venue has committed to deliver to the sponsor. The system:

- Tracks delivered SOV against this commitment in real time
- Alerts ENTERPRISE_ADMIN and VENUE_OPERATOR when delivered SOV falls below commitment threshold
- Generates proof-of-play reports that show actual delivered SOV vs committed SOV
- Does NOT take any automated action to increase sponsor airtime to meet commitment (that would require overriding operational content, which is constitutionally prohibited)

**The minimum SOV commitment is a commercial tracking parameter, not an operational authority grant.**

---

## 4. Proof-of-Play System

### 4.1 What Proof-of-Play Demonstrates

A proof-of-play report answers one question: "What content actually played on contracted screens during the contract period?"

The report is generated from two sources:
1. **PRE deterministic reconstruction:** For any historical timestamp, given the preserved system state (corpus, schedule, operator actions), PRE.resolve() produces an identical output to the original live computation. This is guaranteed by INV-3 (determinism). The configured playlist is reconstructed, not approximated.
2. **Delivery log cross-reference:** Device manifest confirmation logs record what was actually delivered to each screen. The delivery log is append-only and tamper-evident. No actor can modify delivery log entries.

The combination of PRE reconstruction (what the system intended) and delivery log (what devices confirmed) provides a complete, cryptographically verifiable record of sponsor content delivery.

### 4.2 Proof-of-Play Report Contents

A proof-of-play report contains:

- `screen_id`: the specific screen the report covers
- `contract_period`: the date range of the report
- `time_windows_evaluated`: the specific hours and days within the contract period that count toward SOV
- `contracted_sov`: the committed SOV percentage
- `configured_sov`: the SOV the PRE was configured to deliver (PRE reconstruction)
- `confirmed_sov`: the SOV confirmed by device delivery logs
- `playlist_checksum`: the corpus hash from each resolution interval, confirming which content was present in the resolved playlist
- `suppression_events`: any periods where LEVEL_0 through LEVEL_3 content suppressed sponsor content, with timestamps and suppressor type
- `divergence_accounting`: where configured SOV and confirmed SOV differ, and the reason (device offline, connectivity event, AV switch)

### 4.3 What Proof-of-Play Does Not Contain

Proof-of-play reports are designed for commercial accountability. They are intentionally separated from operational data:

- **No parity data:** Shadow comparison results and canary parity reports are operational, not commercial
- **No entropy data:** Entropy scores, entropy alerts, and entropy history are operational monitoring data
- **No constitutional state history:** EMERGENCY_FREEZE events, circuit breaker activations, and constitutional state transitions are operational records
- **No other sponsors' data:** Each proof-of-play report is scoped strictly to the requesting sponsor's content and contracted screens

This separation ensures sponsors receive the evidence they need for commercial accountability without gaining operational intelligence about the venue's platform configuration.

### 4.4 Proof-of-Play Integrity and Non-Disputability

Proof-of-play reports are non-disputable by design. Because the PRE is deterministic (INV-3) and the delivery log is tamper-evident, the report is a reconstruction of what happened — not an operator assertion.

Sponsors cannot dispute proof-of-play reports on the grounds that the system "got it wrong" — the report is the system's actual output, reconstructed from preserved state. If a discrepancy exists between the sponsor's expectations and the report, the investigation path is:
1. Was the sponsor content configured for the correct zones and windows? (Configuration audit)
2. Were higher-level overrides suppressing the sponsor slot? (Suppression events in report)
3. Was the device online and delivering? (Divergence accounting in report)

All three questions are answerable from the report and the configuration audit trail without manual adjustment.

### 4.5 Sponsor Access to Proof-of-Play

SPONSOR_STAKEHOLDER users can:
- Download proof-of-play reports for their assigned venues and contract periods
- Configure automated report delivery (periodic email, API webhook)
- Request on-demand reports for any completed date range within their contract period

SPONSOR_STAKEHOLDER users cannot:
- Request proof-of-play for venues not assigned to their sponsorship
- Request proof-of-play for contract periods belonging to other sponsors at the same venue
- Access the underlying audit records from which the report is generated

---

## 5. Exclusivity Conflict Detection

### 5.1 Types of Exclusivity

Sponsors may negotiate exclusivity in their commercial agreements. The platform records and enforces the operational dimension of exclusivity:

**Zone exclusivity:** No other sponsor in the same product/service category is active on the same screen zone during overlapping time windows.

**Category exclusivity:** No competing brand in the sponsor's product category (e.g., "beer," "insurance," "wagering") is active on any of the sponsor's contracted screens.

### 5.2 Conflict Detection at Activation Time

Exclusivity conflicts are detected at **sponsorship activation time**, not at runtime. When a new sponsorship is being configured:

1. The system evaluates the proposed zone scope, time windows, and category tags against all existing active sponsorships
2. If an exclusivity conflict is detected, the system:
   - Blocks activation of the conflicting sponsorship
   - Presents the conflict details to the ENTERPRISE_ADMIN or VENUE_OPERATOR completing the configuration
   - Suggests resolution options: adjust time windows, exclude conflicting zones, or negotiate allocation

Detecting conflicts at activation time — not at runtime — ensures the problem is surfaced before the contract is live, not after a sponsor discovers their exclusivity was violated.

### 5.3 What the System Cannot Enforce

The system enforces the operational parameters it has been given. It cannot:
- Verify that the commercial contract actually grants the exclusivity claimed
- Adjudicate disputes about whether a product category claim is valid (e.g., is a craft beer brand in the same "beer" category as a mass-market brand?)
- Enforce exclusivity across venues the sponsor is not contracted for

Category exclusivity is a tag-matching system. Human review of category classifications is required when the classification is ambiguous.

---

## 6. Compliance Interaction

### 6.1 Compliance Content Is Not Sponsor Airtime

In licensed venue environments (clubs, hotels with gaming, sports bars with wagering), L1 compliance content (responsible gambling messaging, liquor license conditions, minor exclusion notices) occupies mandatory slots in the PRE resolution sequence.

**Sponsor content does not count toward compliance airtime obligations.** A venue's compliance airtime requirement must be met by L1 content. Sponsor content at L4 fills time that remains after compliance, schedule, and campaign content has been resolved. These are separate obligations measured by separate metrics.

### 6.2 Sponsor Content in Compliance-Sensitive Zones

In licensed club environments, certain zones have elevated compliance requirements:

**Gaming room zones:** Configured with `compliance_only: true`. PRE resolves only L1 content for these screens. Sponsor content targeting a gaming room zone is **rejected at ingestion time**. No sponsor may configure content for compliance-only zones, regardless of commercial arrangement.

**L1-adjacent screens (lounge, bar):** Sponsor content is eligible but subject to the mandatory L1 slot frequency. Every third resolution slot is reserved for L1 compliance content. Sponsor content competes for the remaining slots alongside L3 campaign content. The PRE enforces this mechanically — no configuration can reduce L1 slot frequency below the regulatory minimum.

### 6.3 Alcohol Brand Sponsors in Licensed Venues

Sponsor content from alcohol brands in licensed venues is subject to venue license conditions. The system records compliance metadata on content assets:

- `age_rating`: the minimum audience age classification for the content
- `license_condition_tags`: applicable license conditions the content must respect
- `jurisdiction`: the jurisdiction whose regulations the asset was prepared for

ENTERPRISE_ADMIN is responsible for ensuring sponsor content assets carry correct compliance metadata before they are published. The system validates that compliance metadata is present; it does not validate that the metadata is accurate (that requires human review against the actual regulatory requirements for the venue's jurisdiction).

### 6.4 Responsible Gambling and Gambling-Adjacent Sponsors

A wagering or gambling brand sponsor operating in a licensed club cannot have their content configured to crowd out responsible gambling messaging. The L1 slot frequency is mechanically enforced by the PRE — no sponsor configuration can reduce it. But operators must also ensure that wagering brand content is not configured in patterns that create problematic content adjacency (gambling promotion immediately before or after responsible gambling messaging).

Content adjacency review is a human responsibility at the VENUE_OPERATOR level. The system surfaces the configured rotation pattern in the preview system; operators are responsible for reviewing it before activating the sponsorship.

---

## 7. Sponsor Portal Governance

### 7.1 Preview as the Primary Sponsor Engagement Surface

The Preview system (PREVIEW-SYSTEMS-SPEC-v1.md) is the primary channel through which sponsors engage with how their content will appear. Sponsors can:

- Preview their content as it will appear in the resolved rotation on contracted screens
- See the context in which their content appears (what resolution level it occupies, what comes before and after)
- Request adjustments to creative assets or configuration before the sponsorship goes live

**Preview for sponsors is context-specific:** sponsors see their content in the actual resolved context of the contracted screens. They do not see a decontextualized "your content would play" view.

### 7.2 What Preview Cannot Show Sponsors

Sponsor preview access is bounded by the SPONSOR_STAKEHOLDER role:

- Sponsors cannot preview "what would happen if my content displaced the campaign on this screen" — they cannot model LEVEL_3 and above
- Sponsors cannot view operator configuration (what overrides exist, what campaigns are active)
- Sponsors cannot see other sponsors' content in the preview context

Preview accurately shows the sponsor where their content resolves in the LEVEL_4 slot pool. It does not give sponsors tools to advocate for a higher resolution position.

### 7.3 Proof-of-Play Download Access

SPONSOR_STAKEHOLDER can download proof-of-play reports directly from the sponsor portal. Access is scoped to:
- Their assigned venues only
- Their contract period only
- Their content only (identified by content asset IDs associated with the sponsorship)

Proof-of-play downloads are logged in the audit trail. ENTERPRISE_ADMIN can see when and how often a sponsor has accessed reports.

---

*End of SPONSORSHIP-GOVERNANCE.md*
*Commercial terms are outside system scope. This document governs operational parameters only.*
*Role definitions: SECURITY_MODEL.md. PRE resolution levels: PRE-REFERENCE-IMPLEMENTATION-v1.md.*
