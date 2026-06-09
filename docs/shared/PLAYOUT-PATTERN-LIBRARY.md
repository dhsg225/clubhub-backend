# ClubHub TV — Playout Pattern Library
# Shared Operational Intelligence Layer

**Document type:** Living canonical reference — append-oriented
**Authority:** Agent 2 (CMS/Operational Architecture)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design)
**Last updated:** 2026-05-22

---

## Purpose

This document catalogs canonical playout archetypes — the fundamental patterns by which content resolves and appears on screens. Each pattern has a distinct operational profile: how it is configured, how the PRE resolves it, what operators expect from it, and what entropy risks it carries.

These archetypes are the building blocks from which all real-world venue deployments are constructed. Understanding them enables:
- **Platform design (Agent 1):** Ensuring the PRE resolution model supports each pattern correctly and efficiently.
- **CMS design (Agent 2):** Building configuration workflows optimized for each pattern's creation and management.
- **UX design (Agent 3):** Designing preview, monitoring, and advisory surfaces that make each pattern's behavior transparent to operators.

---

## Pattern Classification Dimensions

Each pattern is characterized across:

| Dimension | Description |
|-----------|-------------|
| **Resolution path** | Which PRE levels activate and in what order |
| **Configuration mechanism** | How the pattern is typically created by operators |
| **Temporal behavior** | How content timing and transitions work |
| **Update frequency** | How often operators need to modify the pattern |
| **Operator urgency** | How time-sensitive changes to this pattern typically are |
| **Entropy risk** | Which entropy patterns this archetype is prone to generate |
| **Venue suitability** | Which venue types typically use this pattern |
| **Attention profile** | The viewer attention model this pattern serves |

---

## Pattern 1: Passive Ambience

### Description

Content plays in a continuous, low-urgency background loop. The primary purpose is atmosphere and brand reinforcement, not information delivery. Viewers are not expected to read or engage — they absorb ambient visual presence.

### Configuration Mechanism

- Single area-level campaign schedule targeting all screens in a zone.
- Content items: 15–30 seconds each, visual-first, minimal text.
- No time-of-day restrictions. Runs continuously.
- Priority: Low to medium (this content is the "base layer," expected to yield to higher-priority content).
- Campaign coverage: High — this is the canonical use case for the campaign system.

### PRE Resolution Path

Typically resolves at LEVEL_3 (Campaign) with SPEC_3 (area-targeted) or SPEC_2 (venue-targeted). SWRR interleaving produces smooth rotation. In absence of overrides or emergency, this is the steady-state resolution for most screens most of the time.

### Temporal Behavior

- Content cycle: 5–20 items, 15–30 seconds each, repeating continuously.
- Full loop duration: 2–10 minutes.
- Update cadence: Weekly to monthly.
- Expected viewer interaction with full cycle: Low — most viewers see 1–3 items during any visit.

### Operator Urgency

LOW. Operators update ambient content on their own schedule. There is no urgency for changing ambient content during live operation.

### Entropy Risk

**Priority escalation:** When operators want specific content to appear "more often," they create higher-priority schedules that compete with the ambient layer. The ambient layer accumulates low-priority rows from previous periods.

**Shadow scheduling:** Operators add more content items to increase variety, creating a proliferating schedule without removing old content.

**Staleness:** Without regular review, ambient content becomes outdated while appearing "fine" (it's playing, the screen isn't black, nobody is watching closely).

### Venue Suitability

Hotel lobbies, resort common areas, spa areas, golf club dining, community venue entrance. Any area where background visual presence is the primary goal.

### Attention Profile

PASSIVE-AMBIENT. Screen is decoration. Communication value is brand impression, mood setting.

---

## Pattern 2: Daypart Scheduling

### Description

Different content plays at different times of day, managed through time-windowed schedules. The operational model is: breakfast content from 7–11am, lunch content from 11am–2pm, afternoon content from 2–5pm, evening content from 5pm–close.

### Configuration Mechanism

- Multiple schedule rows with time-of-day constraints.
- One campaign per daypart OR multiple campaigns with non-overlapping time windows.
- All rows area-targeted or venue-targeted.
- Priority: All daypart rows at similar priority (they don't compete — time windows are mutually exclusive).

### PRE Resolution Path

LEVEL_3 resolution. At any given time, only the schedule(s) whose time-of-day window contains the current local time are active. The PRE evaluates time-of-day constraints using venue local time (venue.timezone, IANA format) — INV-9 governs this.

### Temporal Behavior

- Content changes at defined time boundaries.
- Change is instantaneous from the PRE's perspective — at 11:00:00 local time, lunch content is active; at 10:59:59, breakfast content is active.
- Player detects change within one poll cycle (15 seconds) of the boundary.
- Morning/evening transitions may span timezone boundaries if venue crosses midnight.

### Critical Design Point: Timezone Boundary

The PRE evaluates time-of-day using venue-local time. This means:
- A venue in Queensland (no daylight saving) and a venue in Victoria (daylight saving) with identical schedules will change content at different UTC moments.
- An operator who creates a schedule saying "lunch from 12:00-14:00" without understanding that this is local time, not UTC, may create unexpected behavior if they are in a different timezone from the venue.

**UX implication:** All time-of-day schedule inputs must clearly display the venue's local timezone to the operator at point of entry. "Lunch special from 12:00 PM (venue local time: AEST)"

### Operator Urgency

LOW-MEDIUM. Daypart content changes on a weekly cadence. Urgency spikes if "the lunch special is wrong today" — requiring an immediate override on the lunch content.

### Entropy Risk

**Time window drift:** Operators create overlapping time windows without realizing it. Two lunch schedules with slightly different start/end times compete in the overlap window.

**Daylight saving transitions:** In jurisdictions with daylight saving transitions, existing time-windowed schedules may shift by an hour relative to operational reality. Operators who don't review schedules at daylight saving changeover may have content "starting an hour early" or "starting an hour late."

**Urgency override accumulation:** When the daypart content is wrong "for today," operators create an override rather than fixing the daypart schedule. The override persists after the day.

### Venue Suitability

Restaurants, hotel dining, sports bars, licensed clubs (particularly for gaming vs non-gaming area transitions), resorts. Any venue with distinct operational rhythm across the day.

### Attention Profile

Varies by daypart — typically TASK-ENGAGED during F&B service periods (menu boards), SOCIAL-DISTRACTED during social periods.

---

## Pattern 3: Event-Driven Interruption

### Description

Normal ambient or scheduled content is temporarily displaced by event-specific content for the duration of an event. After the event, normal content resumes automatically.

### Configuration Mechanism

**Correct mechanism:** A time-windowed scheduled override (LEVEL_2) or a time-windowed campaign with higher specificity targeting, with `starts_at` and `expires_at` matching the event window.

**Common (incorrect) mechanism:** An operational override (LEVEL_1) created immediately before the event, with no expiry, manually deactivated after. Entropy risk: deactivation is forgotten.

**Emergency mechanism (misuse):** Emergency activation used for "immediate event takeover." Semantically incorrect, but produces the desired immediate visual result.

### PRE Resolution Path

**Correct path:** LEVEL_2 (Scheduled Override) — terminates base playlist for event duration, then allows LEVEL_3 to resume after event window closes.

**Override path:** LEVEL_1 — terminates until manually deactivated. Requires operator action to end.

**Emergency path:** LEVEL_0 — terminates all other resolution absolutely until manually deactivated.

### Temporal Behavior

**With time-windowed schedule/override:** Content transitions automatically at event start and end times. The PRE evaluates the time window continuously — at event start, event content wins; at event end, event content loses and normal resolution resumes. This is the cleanest temporal model.

**With permanent override:** Content transitions at override creation. Manual deactivation required. High risk of persistence past event end.

**With emergency:** Transitions at activation and deactivation. Manual deactivation required. High semantic risk.

### Operator Urgency

HIGH. Event-driven content changes are typically same-day or same-hour. Operators want content to appear "now" or "at exactly 7pm." The 15-second poll cycle is acceptable; multi-step campaign creation is not.

### Entropy Risk

**Override permanence:** This is the highest-risk entropy pattern for this archetype. An event override without an expiry becomes permanent. Every music night, every sports final, every Christmas party creates an orphaned override if expiry dates are not set.

**Emergency semantic collapse:** Repeated event-driven emergency activation destroys the emergency audit trail.

**Priority escalation:** If event content doesn't appear to "win" resolution reliably, operators escalate priorities on event schedules, leaving high-priority inert rows after events end.

### Venue Suitability

Sports bars (game day content), licensed clubs (event nights), golf clubs (tournament days), hotels (conference days), restaurants (special events).

### Attention Profile

Shifts from base pattern to EVENT-SPECIFIC during event. During the event: ENTERTAINMENT-WATCHING (if sports/entertainment) or TASK-ENGAGED (if event information).

---

## Pattern 4: Sponsor-Heavy Rotation

### Description

Sponsor content is interleaved with editorial content at a specified share-of-voice. This is the canonical use case for the Sponsorship Injection layer (LEVEL_4). The SWRR algorithm produces weighted rotation that delivers contractually specified frequency.

### Configuration Mechanism

- Sponsorship contracts configured in the sponsorship engine.
- Editorial content managed through LEVEL_3 schedules.
- LEVEL_4 injection is automatic — operators configure the contract, not the playlist insertion.
- Operators may not realize that sponsor content is being injected at LEVEL_4 separately from their LEVEL_3 schedules.

### PRE Resolution Path

LEVEL_3 computes the base playlist from schedules. LEVEL_4 injects sponsor content according to contracts. The SWRR algorithm at LEVEL_4 interleaves the combined content set with weights derived from contracted SOV percentages.

### Temporal Behavior

- Sponsor content appears continuously at the contracted rate within the SWRR interleaving.
- Sponsor contract time windows determine when injection is active.
- Multiple contracts with different time windows create variable sponsor density across the day.

### Operator Urgency

LOW for ongoing management. MEDIUM-HIGH when launching a new sponsor contract or when a sponsor raises concerns about visibility.

### Entropy Risk

**SOV saturation drift:** Multiple individually acceptable contracts accumulate to unacceptable combined SOV. Each addition is locally rational; the accumulation is systemically damaging.

**SOV warning desensitization:** After 30+ days of continuous SOV warning, operators treat the warning as ambient noise. New contracts are added despite active warnings.

**Sponsor content staleness:** Sponsor content items are uploaded once and never updated. After 6–12 months, the content is stale. The sponsor may not notice or may not have a content update process.

**LEVEL_4 invisibility:** Operators managing LEVEL_3 schedules may not know that LEVEL_4 sponsor injection exists. They may create redundant sponsor schedules at LEVEL_3, causing sponsors to appear at double the contracted frequency.

### Venue Suitability

Any venue with commercial sponsorship relationships: licensed clubs, golf clubs, sports bars, resorts, restaurants.

### Attention Profile

Typically PASSIVE-AMBIENT or SOCIAL-DISTRACTED — sponsor content is ambient in most contexts.

---

## Pattern 5: Live Data Augmentation

### Description

Screen content incorporates real-time data — live scores, jackpot values, weather, tee time availability, stock prices. Content changes dynamically as data changes, rather than on a fixed content item rotation.

### Current Platform Status

**NOT NATIVELY SUPPORTED.** The PRE operates on database state, not on real-time external data feeds. Live data augmentation requires either:
1. External integration that updates content items or schedule rows in the database as data changes (so the PRE sees updated state).
2. A specialized content item type that includes a data feed reference (future capability).

**Current workaround:** Operators manually update content items when live data changes (e.g., manually updating a "Current Jackpot: $47,000" content item when the jackpot changes). This is operationally impractical for frequently-changing data.

### Configuration Mechanism (Future Design)

- Content item type: `live_data` with a data source reference and template.
- Data source: A configured endpoint or database query that the content renderer fetches at display time.
- Template: A visual layout that incorporates the live data field.
- PRE behavior: Unchanged — PRE resolves content items by ID; the rendering layer handles live data substitution.
- Critical: PRE purity is preserved — the PRE does not access live data feeds. The content renderer does.

### PRE Resolution Path

Standard LEVEL_3 (or higher if override/emergency) resolution. The content item selected by the PRE has a type of `live_data`; the player's renderer fetches the current data value and displays it.

### Operator Urgency

HIGH. Live data content is, by definition, time-sensitive. Operators who have live data expect it to be current. Stale live data is immediately visible and damaging.

### Entropy Risk

**Integration failure:** If the live data source becomes unavailable, content either shows stale data (bad) or errors (worse). The system must have a graceful fallback for live data content items when the data source is unavailable.

**Operator confusion about "why is it showing old data?":** Operators may not understand the distinction between PRE resolution (which is correct) and content rendering (which may be failing due to data source issues). Debugging live data failures requires understanding both layers.

### Venue Suitability

Gaming venues (jackpot display), golf clubs (tee time, leaderboard), sports bars (live scores), hotels (weather), resorts (activity availability).

---

## Pattern 6: Emergency Interruption Dominance

### Description

An emergency state is active. All screens in the emergency scope show emergency content exclusively. No other content resolves. This is the constitutional LEVEL_0 behavior.

### Configuration Mechanism

- Emergency state activation via the Emergency Service.
- Content: The `emergency_states.content_id` field — preconfigured emergency content.
- Scope: The emergency state's target scope (screen/group/area/venue/org).
- Duration: Manual deactivation required.

### PRE Resolution Path

LEVEL_0 evaluation. If any active emergency state matches the screen's scope:
1. Emergency content is selected.
2. Resolution terminates. No other level is evaluated.
3. `is_fallback: false`, `resolution_level: 0`.

**INV-7 (Emergency Absoluteness):** CATASTROPHIC severity if active emergency does not produce LEVEL_0 resolution, or if non-emergency content appears during active emergency.

### Temporal Behavior

- Instantaneous on activation (within one poll cycle).
- Instantaneous on deactivation (within one poll cycle).
- No automatic deactivation — operator must manually deactivate.

### Operator Urgency

MAXIMUM. Emergency by definition is the highest urgency state. Operators activating genuine emergency need instant, reliable results.

### Entropy Risk

**Semantic collapse:** The primary entropy risk is the misuse of this pattern for non-emergency purposes. See Failure Story 2 and OPERATIONAL-ENTROPY §4.6 (Emergency Semantic Collapse).

**Forgotten activation:** Emergency states left active after the incident ends. Screens showing emergency content for hours or days after resolution of the underlying incident.

**Post-emergency configuration debt:** After emergency deactivation, the system returns to its pre-emergency state. If that state was already entropically degraded, the restoration may reveal problems that were hidden by the emergency.

### Venue Suitability

All venues — emergency capability is universal. Usage patterns vary dramatically by vertical (sports bars: high misuse; golf clubs: low misuse; hotels: moderate for conference/incident).

---

## Pattern 7: High-Frequency Update Surface

### Description

Content changes multiple times per day based on operational events (new specials, changing prices, competition results, event developments). Content must be current within minutes of the real-world event.

### Configuration Mechanism

**Option A: Direct override creation.** Most common. Operator creates an override for the target screen or area with the new content. Fast, reliable, entropy-prone.

**Option B: Content item update.** The content item referenced by an existing schedule is updated with new content. The schedule remains; the content changes. Less entropy-prone, but requires CMS access to the content library.

**Option C: Live data integration (future).** Data-driven content that updates automatically.

### PRE Resolution Path

Option A: LEVEL_1 (Override) resolution.
Option B: LEVEL_3 resolution with updated content item.

### Temporal Behavior

- Changes visible within 15 seconds (one poll cycle).
- Content item updates propagate on next manifest generation for affected screens.

### Operator Urgency

HIGH to CRITICAL. The defining characteristic of this pattern is that content must reflect current reality quickly.

### Entropy Risk

**Extreme override accumulation:** The highest-entropy pattern. Operators creating overrides for each update event produce a persistent override layer that blocks all other resolution.

**Content library sprawl:** Creating new content items for each daily special produces an ever-growing content library of mostly-obsolete items.

**Priority arms race:** Operators escalating priorities to ensure "today's special" beats "yesterday's special" (which they haven't removed).

### Venue Suitability

Restaurants/bars (daily specials), sports bars (event-specific content), gaming areas (jackpot promotions), golf clubs (tournament results).

### Design Consideration

This pattern has the highest operator urgency and the highest entropy risk. The CMS must provide a fast, clean workflow for high-frequency updates that does not require creating a new content item or override for each update. Possible approaches:
- "Quick update" workflow: update the content of an existing scheduled item without creating new configuration records.
- Template-based content: the operator updates a field (specials text, price) and the content item renders with the new data.
- Operational queue: a list of "today's items" that the operator manages independently from the long-term schedule.

---

## Pattern 8: Multi-Zone Differentiated Content

### Description

Different areas of the same venue show different content simultaneously, managed as a coordinated system. Zone A shows bar content, Zone B shows dining content, Zone C shows gaming content — all under a single venue-level campaign structure.

### Configuration Mechanism

- Multiple area-targeted campaigns, one per zone.
- Each campaign targets its specific area.
- Overall campaign lifecycle (draft/publish/archive) managed as a group.
- Screen-level or tv_group-level exceptions for specific screens within zones.

### PRE Resolution Path

LEVEL_3 resolution for each screen independently. Area-targeted (SPEC_3) campaigns resolve correctly per area. Screens in Zone A get Zone A content; screens in Zone B get Zone B content.

### Temporal Behavior

- Zone transitions happen simultaneously (all zones update together on campaign publish/archive).
- Zone A and Zone B content cycles are independent — no synchronization between zones unless explicitly configured.

### Operator Urgency

MEDIUM. Typically managed on weekly campaign publish cycles. Urgency spikes if a zone-specific event requires content change without affecting other zones.

### Entropy Risk

**Zone isolation divergence:** If zone managers operate independently (see Resort vertical), each zone develops its own entropy profile. The venue-level campaign structure becomes irrelevant as zones manage their own overrides.

**Specificity conflicts:** Org-level or venue-level content that should appear in all zones may be blocked by zone-level (area-level) schedules or overrides that have higher specificity.

**Zone definition drift:** Over time, a physical zone may change (bar area expanded, gaming area reconfigured) without the CMS area/tv_group definitions being updated. The system continues resolving based on the old zone definitions.

### Venue Suitability

All multi-zone venues: licensed clubs (gaming vs bar vs dining), golf clubs (pro shop vs bar vs dining), hotels (lobby vs restaurant vs conference), resorts.

---

## Pattern 9: Compliance-Constrained Content

### Description

Certain screens in certain locations must display legally mandated content at mandatory frequencies. Content scheduling must ensure compliance with regulatory requirements.

### Configuration Mechanism (Current)

No native compliance enforcement mechanism exists. Current approach: operators manually schedule compliance content (responsible gambling messages, etc.) and rely on schedule configuration to produce the required frequency.

**Risk:** Manual compliance scheduling is subject to the same entropy risks as any other schedule configuration. Compliance content can be crowded out by high-priority sponsor content or overrides.

**Design gap:** The system has no mechanism to enforce or verify regulatory compliance requirements. A screen in a gaming area that is required to show a responsible gambling message at least once every 30 minutes has no enforcement mechanism.

### PRE Resolution Path

Compliance content currently scheduled at LEVEL_3 (Campaign/Schedule). This means it can be superseded by LEVEL_1/2 overrides or LEVEL_0 emergency.

**Constitutional tension:** If compliance content must be displayed with guaranteed frequency, it should arguably resolve at a higher level than campaign scheduling. This may require a constitutional discussion about whether a "regulatory compliance" level should be defined, or whether compliance content should be protected from override.

### Operator Urgency

LOW for normal operation (compliance content is set once). CRITICAL in the event of compliance audit or citation.

### Entropy Risk

**Compliance content displacement:** High-priority sponsor content competing at LEVEL_3 with compliance content, causing compliance content to appear less frequently than mandated.

**Override displacement:** A LEVEL_1 override on a gaming screen displaces compliance content entirely for the override duration.

**Priority competition with compliance:** Gaming area managers creating high-priority promotional content that effectively wins resolution over lower-priority compliance schedules.

### Venue Suitability

Gaming venues (primary), licensed liquor venues, medical/health venues (health information requirements), public buildings.

### Constitutional Implications

This pattern creates a genuine design tension: the PRE's priority model does not distinguish between operator-intent content and compliance-mandated content. A future platform design consideration is whether compliance content should be elevated to a new resolution level between LEVEL_0 (Emergency) and LEVEL_1 (Operational Override), making it non-suppressible except by emergency. This would require a constitutional amendment.

---

## Pattern Cross-Reference Matrix

### Configuration Complexity vs. Entropy Risk

```
                    LOW CONFIG          MEDIUM CONFIG         HIGH CONFIG
                    COMPLEXITY          COMPLEXITY            COMPLEXITY
──────────────────┼────────────────────┼─────────────────────┼────────────────────
HIGH ENTROPY RISK │ Override-Only       │ Mixed Override+      │ Multi-Zone with
                  │ Deployments        │ Schedule             │ Independent Zones
──────────────────┼────────────────────┼─────────────────────┼────────────────────
MEDIUM ENTROPY    │ Passive Ambience   │ Daypart Scheduling   │ Sponsor-Heavy
RISK              │                    │                      │ Rotation
──────────────────┼────────────────────┼─────────────────────┼────────────────────
LOW ENTROPY RISK  │ (none — all low-   │ Event-Driven         │ Compliance-
                  │  config patterns   │ (with expiry)        │ Constrained
                  │  carry some risk)  │                      │ Content
```

### PRE Level Utilization by Pattern

```
Pattern                      │ L0 │ L1 │ L2 │ L3 │ L4 │ L5 │ L6
─────────────────────────────┼────┼────┼────┼────┼────┼────┼────
Passive Ambience             │    │    │    │ ●  │ ◐  │    │ ●
Daypart Scheduling           │    │    │    │ ●  │ ◐  │    │ ●
Event-Driven Interruption    │    │ ◐  │ ◐  │ ●  │ ◐  │    │ ●
Sponsor-Heavy Rotation       │    │    │    │ ●  │ ●  │    │ ●
Live Data Augmentation       │    │    │    │ ●  │ ◐  │    │ ●
Emergency Interruption       │ ●  │    │    │    │    │    │
High-Frequency Updates       │    │ ◐  │    │ ●  │ ◐  │    │ ●
Multi-Zone Differentiated    │    │    │    │ ●  │ ◐  │    │ ●
Compliance-Constrained       │    │    │    │ ●  │ ◐  │    │ ●

● = Primary resolution level for this pattern
◐ = Sometimes active in this pattern
```

---

*End of PLAYOUT-PATTERN-LIBRARY.md v1.0*
*Append new patterns as deployment experience reveals new canonical archetypes.*
*Update the cross-reference matrix when new patterns are added.*
*Compliance-Constrained pattern section should be revisited when first gaming venue goes live — regulatory details are jurisdiction-specific.*
