# ClubHub TV — Market Vertical: Hotels and Resorts

**Document type:** Operational profile
**Vertical:** Hotels and resorts — boutique to 5-star, resort complexes
**Status:** Reference
**Last updated:** 2026-05-26

---

## 1. Vertical Overview

Hotels and resorts represent the highest-complexity screen environment in terms of content coherence requirements. The guest experience expectation is that every screen in the property feels like it belongs to the same place, at the same time of year, for the same guest demographic. A 5-star resort that shows generic screensaver content in its lobby while its restaurant screen is running a campaign for a departed conference group has a coherence problem — the platform should make this impossible by design.

The distinctive operational challenge here is multiplicity of contexts running simultaneously without conflict:
- The hotel brand context (always present, enterprise-governed)
- The seasonal context (summer leisure versus winter conference season)
- The event/conference context (specific group, specific dates, specific branding)
- The time-of-day context (breakfast programming versus dinner programming)
- The zone context (lobby versus pool versus conference versus gym)

PRE's resolution hierarchy handles this naturally. Each context maps to a resolution level. The brand context is L5 default. The seasonal context is an L3 enterprise campaign. The conference context is an L2 venue schedule override for conference zones. Time-of-day is a schedule constraint on L2 entries. Zone separation is handled by PRE's area-targeted specificity. An operator does not need to manually coordinate these — PRE resolves the correct intersection for each screen at each moment.

The second distinctive challenge is multilingual content. A resort with a significant international guest demographic may need to deliver content in three languages across multiple screen zones, with language priority varying by zone and season.

---

## 2. Operational Priorities

### 2.1 Guest Experience Coherence

The brand promise of a hotel is carried partly by its physical environment and partly by its content screens. A screen in the lobby of a luxury resort should never show:
- Mismatched branding (wrong season's imagery, departed campaign)
- Outdated information (yesterday's events, expired offers)
- Broken content (black screens, looping single frames)
- Content that belongs to another property's context

PRE's constitutional guarantees address all but the second risk (outdated information is an entropy problem). Entropy monitoring for hotel screens focuses on content recency: content assets with `valid_until` metadata are flagged when their validity window approaches. A resort that rotates seasonal imagery must have a transition schedule — the system will not automatically switch from summer to winter imagery without an operator action or a scheduled campaign transition.

### 2.2 Conference and Event Programming

When a conference group is in-house, the conference areas of the property (ballroom, breakout rooms, pre-function areas, dedicated corridors) display event-specific content: conference branding, agenda, sponsor logos, directional signage for sessions. This content is high-visibility and directly reflects on the hotel's service quality — a breakout room showing the wrong conference name is an embarrassing failure.

Conference content management:
- Content is loaded 24 hours in advance by the conference coordinator
- A conference-zone L2 schedule override activates at the conference start time for the applicable area IDs
- The override specifies which screens (by area: `conference_zone`) are affected
- Event-specific content supersedes all lower-level content in conference zones for the duration
- After the conference ends, the L2 override expires and screens return to standard hotel programming

Multiple concurrent conferences (common in large properties) are managed as separate L2 overrides targeting different area IDs. PRE resolves each screen against the override applicable to its area. A screen in Ballroom A shows Conference A content; a screen in Ballroom B shows Conference B content simultaneously.

### 2.3 Multilingual Content

Multilingual requirements in hospitality are driven by guest demographics. A ski resort in the Alps with primarily German and French guests needs different language priority than a Singapore business hotel with primarily Mandarin-speaking business travelers.

Implementation:
- `language_priority` is configured at the screen_zone (area) level
- A pool area at a resort with German guests might be `[DE, EN, FR]`
- Lobby screens might be `[EN, DE, FR, ZH]` for a mixed-demographic property
- Campaign assets must be submitted with language variants; the corpus selects the highest-priority available language for each screen zone
- If no matching language variant exists for an asset, the system falls back to English and logs a MEDIUM entropy advisory
- The fallback is explicit in the operator preview — "this asset will display in English for German-priority screens because no DE variant was uploaded"

Language variant validation at campaign ingestion: the system should warn (not block) when an asset submitted for a multilingual campaign does not include all configured language variants for the targeted zones. This allows operators to submit partial campaigns during the preparation phase while ensuring the gap is visible before the campaign goes live.

### 2.4 Time-Sensitive Programming

Hotel programming changes throughout the day in ways that require schedule precision:
- Breakfast service: restaurant screens shift to breakfast menu at 6:30am, revert to all-day menu at 10:30am
- Lunch service: lunch specials activate at 11:30am
- Happy hour: bar screens activate promotional content at 5pm
- Pool hours: pool screens show "pool now closed" after 10pm
- Spa treatment availability: changes based on therapist schedules (typically static daily configuration)

These are all L2 schedule entries with time-of-day constraints evaluated against venue-local time. The operator sets these schedules once (or weekly for recurring patterns) and PRE manages the transitions automatically. A hotel operator who has to manually switch screens from breakfast to lunch programming every day has a misconfigured system.

### 2.5 Emergency Behavior

Fire evacuation and security incidents are L0 emergency overrides. The duty manager activates the emergency context from the front-desk terminal. All screens in the property switch to evacuation or incident-appropriate content.

Emergency content requirements:
- Evacuation: assembly point information, route guidance, emergency contact numbers
- Assembly point content may need to be zone-specific (different assembly points for different wings of the property)
- Security incident: shelter-in-place or evacuation instructions depending on incident type
- The duty manager selects the emergency type at activation; the system loads the appropriate L0 content

Emergency clearance: the general manager or duty manager explicitly lifts the emergency. Screens return to normal PRE resolution.

---

## 3. Screen Zones and Behavior Profiles

| Zone | Content profile | Multilingual priority | Conference override |
|---|---|---|---|
| Lobby / Reception | Welcome, local info, weather, today's events, brand imagery | [CONFIGURED] | No — lobby stays branded |
| Corridors / Lifts | Brand content, directional, event signage | [CONFIGURED] | Yes — conference direction overlays |
| Restaurant / Bar | Dining specials, menu preview, happy hour, entertainment | [CONFIGURED] | No (unless private dining event) |
| Conference / Ballroom | Event branding, agenda, sponsor logos, directional | Event-specific | YES — primary override target |
| Pre-function areas | Event wayfinding, guest information | Event-specific | Yes |
| Pool / Spa | Leisure content, spa promotions, weather, safety | [CONFIGURED] resort languages | No |
| Gym | Fitness content, class schedule, wellness | Minimal — primarily English | No |
| Outdoor terraces | Brand content, weather, ambient | [CONFIGURED] | No |

### 3.1 Lobby Screen Design Requirements

The lobby screen is the guest's first and last content impression. It must:
- Always show the correct date and time in the property's local timezone
- Show today's weather from a reliable data source (corpus variable)
- Show today's key events at the property (from L2 schedule)
- Never show an expired campaign (entropy monitoring enforces this)
- Transition seasonally without abrupt changes (campaign fade-in/fade-out scheduling)

A hotel brand that has four distinct seasonal content packages (spring, summer, autumn, winter) should have those packages as pre-built L3 campaigns with overlapping validity windows: the summer campaign's `valid_until` overlaps by one week with the autumn campaign's `valid_from`, giving the property a graceful transition zone.

---

## 4. Seasonal Campaign Layering

Hotels operate with layered seasonal content that must compose correctly:

| Layer | Level | Example |
|---|---|---|
| Base brand imagery | L5 default | Year-round hotel photography |
| Seasonal template | L3 enterprise campaign | Summer leisure package imagery |
| Local event overlay | L3 venue campaign | Regional festival occurring this week |
| Conference overlay | L2 schedule override | Conference in house this week |
| Emergency | L0 | Fire evacuation |

PRE resolves these layers by priority. The conference overlay (L2) supersedes the seasonal template (L3) in conference zones but not in lobby or restaurant zones — the area targeting of the L2 override is precise. The lobby continues showing seasonal branding while the conference ballroom shows conference content simultaneously.

Campaign lifecycle for seasonal transitions:
1. ENTERPRISE_ADMIN creates the next season's campaign 4–6 weeks in advance
2. Campaign enters SHADOW_ONLY canary stage — verified against a small set of screens
3. At SINGLE_VENUE canary stage, a pilot property runs the seasonal content for a week for internal review
4. After approval, FLEET_WIDE promotion — all properties transition to the seasonal content on the configured activation date
5. The outgoing seasonal campaign expires automatically at its `valid_until` timestamp

---

## 5. Conference/Event Operational Workflow

### 5.1 Pre-Event Setup (24 hours before)

The conference coordinator:
1. Creates or selects the conference content package (logo, branding, agenda template, sponsor list)
2. Uploads event-specific assets (today's agenda PDFs converted to screen assets, sponsor logos in correct format)
3. Creates an L2 venue schedule override for the conference area IDs, specifying start and end times
4. Previews the content on the operator dashboard — sees exactly what each screen in the conference area will show at the event start time
5. Confirms the content package is correct and schedules the override

The system validates:
- All required conference assets are present and display-ready
- The override targets only conference-zone area IDs (not lobby or restaurant zones)
- The time window is correct (start time aligns with the group's arrival)
- No conflicting L2 overrides exist for the same area/time combination

### 5.2 During the Event

Conference content is active. The coordinator may need to make intra-event updates:
- Session changeover: update the current session on agenda screens
- Speaker change: update speaker name/headshot asset on podium screens
- Ad-hoc notice: add an announcement to all conference-zone screens immediately

The ad-hoc announcement is a SPECIFICITY_4 (tv_group-targeted) override for the conference TV group, activated immediately by the coordinator. It appears on all conference screens, overrides existing conference content for the announcement duration (e.g., 5 minutes), then expires and the conference content resumes. The operator does not need to understand the underlying PRE mechanics — the workflow is "post announcement → select duration → confirm."

### 5.3 Post-Event Teardown

When the conference ends:
- The L2 schedule override reaches its `valid_until` timestamp and expires automatically
- Conference screens return to standard hotel programming
- Conference-specific corpus assets are archived (not deleted — they are auditable records)
- If the group has a second day, the coordinator extends the override's `valid_until` rather than creating a new override

Simultaneous events: if the property has two conferences running (Ballroom A and Ballroom B), each has its own L2 override targeting its respective area IDs. PRE resolves each independently. A screen in Ballroom A's pre-function area shows Conference A content; a screen in the shared main corridor shows the higher-priority directional content.

---

## 6. Entropy Risk Patterns

| Content type | Entropy risk level | Detection threshold | Escalation |
|---|---|---|---|
| Conference content asset missing at T-24h | HIGH | At content package validation | Conference coordinator, GM |
| Seasonal campaign gap (no campaign active) | MEDIUM | At L5-only resolution detection | ENTERPRISE_ADMIN |
| Dynamic data stale (weather, local events) | LOW | 60-minute venue scan | Advisory to front-of-house manager |
| Language variant missing for multilingual zone | MEDIUM | At campaign ingestion | Advisory to content coordinator |
| Conference zone still in conference mode after event end | LOW | At override expiry + 30 minutes | Advisory to coordinator |
| Emergency content asset unavailable | CRITICAL | At overnight health check | Operations team, GM |

The conference asset validation at T-24h is a proactive entropy check. The system evaluates the upcoming conference content package against the conference area screens and confirms all assets are present and correctly formatted before the event begins. A missing asset discovered at 7pm for a 9am conference is recoverable; one discovered at 8:55am is not.

---

## 7. Operator Patterns

### 7.1 Front-of-House Manager

Manages lobby and reception screens. Responsible for ensuring the lobby presents correctly for current occupancy. Typical tasks: updating today's events from the property management system, confirming seasonal campaign is correct, managing any ad-hoc welcome messages for VIP arrivals.

### 7.2 F&B Manager

Manages restaurant and bar screens. Responsible for daily specials, happy hour schedules, dining promotions, and seasonal F&B campaigns. Operates entirely within the restaurant and bar screen zones. Does not interact with conference or lobby content.

### 7.3 Conference Coordinator

Manages event-specific screen content for conferences and banquets. Responsible for the pre-event setup workflow, intra-event updates, and post-event teardown. Uses the conference screen management workflow. Does not need access to lobby or F&B screen management.

### 7.4 General Manager

Approval authority for enterprise-level campaigns affecting the entire property. Manages emergency scenarios. Has visibility into fleet health (for multi-property groups). Typical engagement with the platform: weekly review of campaign schedule, approval of seasonal campaign promotions, emergency management.

### 7.5 Enterprise / Group Marketing

For hotel chains and resort groups: ENTERPRISE_ADMIN manages brand-level campaigns, seasonal templates, and language configuration. Individual properties (VENUE_OPERATOR) customize within the enterprise boundaries — they can add local event campaigns but cannot override brand imagery or enterprise-mandated content.

---

## 8. Operational Examples

### Example A: International Conference at City Business Hotel

**Context:** Meridian Business Hotel, 250-room city hotel. Annual technology conference, 350 delegates, two-day event. Sponsors: two software companies. Language configuration: lobby [EN, ZH, JA] (Tokyo market), conference zone event-specific [EN].

**Day before (4pm):**
Conference coordinator uploads the conference content package: company logo, two-day agenda as screen assets, two sponsor logos (tech company A and tech company B), breakout room direction assets. System validates: all assets present, format correct. Coordinator previews on dashboard — sees the conference ballroom screen showing the conference logo, agenda Day 1, and sponsor logos in rotation. Correct.

**Conference Day 1, 8:00am — Activation:**
The L2 conference override activates. Ballroom, breakout rooms, and pre-function area screens transition to conference content. Lobby screens: unchanged — still showing hotel branding in EN/ZH/JA rotation with today's weather and the conference welcome listing in today's events. Restaurant screens: showing breakfast specials campaign (L2 schedule, 7am–10:30am). Three contexts operating simultaneously without conflict.

**9:00am — Sponsor logo correction:**
Conference coordinator receives a call from Tech Company B's marketing contact — they've sent the wrong logo version. Coordinator uploads the corrected asset and replaces it in the conference content package. The corrected asset propagates to screens within two poll cycles. The bad logo played for approximately 90 minutes; the coordinator logs a note in the audit record.

**10:30am — Morning tea break:**
Pre-function area screens switch to "Morning Tea — Level 2 Foyer" directional content (a pre-configured session break overlay). This was set up in the conference sequence schedule. Breakout room screens switch to "Break — Returns 11:00am" message. At 11:00am, the session indicators update automatically to show the afternoon session title.

**Conference Day 2, 5:30pm — Event closes:**
The L2 conference override's `valid_until` timestamp passes. Conference ballroom and breakout room screens return to standard hotel programming (brand imagery, current season template). The coordinator notices that one screen in the pre-function area is still showing conference directional content. Investigation: that screen is assigned to an area that was accidentally included in both the conference override AND a persistent venue schedule entry. PRE correctly resolved the conflict in favor of the L2 override during the conference; now the L2 has expired, the venue schedule entry is taking effect. Coordinator identifies the venue schedule entry and deactivates it. Screen corrects. This is an entropy event: accumulated configuration from a prior event was still active.

---

### Example B: Resort Seasonal Transition (Summer to Autumn)

**Context:** Pacific Crest Resort, luxury resort. Transitioning from Summer 2026 to Autumn 2026 seasonal campaign. The resort operates with four enterprise-managed seasonal templates. Enterprise marketing manages seasonal transitions across three resort properties.

**4 weeks before transition:**
ENTERPRISE_ADMIN creates the Autumn 2026 campaign: new lifestyle photography (warm tones, vineyard/harvest themes), updated package descriptions (wine weekend packages, slower-paced messaging), language variants in EN and DE (primary resort demographics). Campaign is set to activate March 1, 2026. Current Summer 2026 campaign's `valid_until` is set to March 2.

**2 weeks before:**
Canary promotion: SHADOW_ONLY → INTERNAL_CANARY. The enterprise coordinator reviews the Autumn imagery on a test screen set. Content looks correct.

**1 week before:**
SINGLE_VENUE canary: the primary resort property activates the Autumn campaign one week early on lobby screens (only). Management reviews in person. The warm autumn imagery looks appropriate. Approved.

**March 1:**
FLEET_WIDE promotion. All three resort properties activate the Autumn 2026 campaign simultaneously. The Summer 2026 campaign expires on March 2 (the one-day overlap ensures no gap if there is a timing issue). PRE resolves: on March 1, both Summer and Autumn campaigns are technically active; Autumn has higher specificity (more recent creation timestamp at the same L3 level). After March 2, only Autumn is active. Screens across all three properties show consistent autumn imagery and messaging.

**Language validation:**
At fleet promotion, the entropy scanner checks all multilingual zones. DE variants were uploaded for all assets. The German-language pool area at Resort 2 shows the DE autumn copy. No language fallback alerts generated.

---

### Example C: Emergency Response at Boutique Hotel

**Context:** Harrington House, boutique 45-room hotel. Evening. 7:45pm. A small kitchen fire triggers the evacuation alarm. Twenty-eight guests are in the building.

**7:46pm — Emergency activated:**
Duty manager activates VENUE_EMERGENCY from the front-desk terminal. Selects: "Fire Evacuation — Assembly Point: Front Car Park." L0 context activates immediately.

**7:46pm–7:48pm (within 2 polling cycles):**
All screens in the property transition to fire evacuation content: assembly point direction (Front Car Park), emergency contact number, "Please follow staff instructions" message. Restaurant screens (where guests are dining): evacuation route graphic. Lobby screens: assembly point confirmation. Corridor screens: "Exit via nearest stairwell" directional content.

The system serves zone-specific evacuation routes: screens on the first floor east wing show "Exit via East Stairwell — Front Car Park"; screens on the second floor west wing show "Exit via West Stairwell — Front Car Park." This is not dynamically computed — it is pre-configured content per area. The L0 corpus includes zone-specific evacuation assets matched to area IDs.

**8:05pm — Fire brigade clears the building:**
False alarm (minor kitchen smoke, no structural fire). Duty manager lifts emergency from the same terminal. All screens return to normal programming. Dinner service resumes.

**Next morning — Post-incident review:**
The GM pulls the audit log for the emergency: activation timestamp (7:46:14pm), operator ID (duty manager username), emergency type, screens affected (all 18 screens in the property), lift timestamp (8:05:43pm). Duration: 19 minutes 29 seconds. All screens confirmed to have transitioned within 2 minutes of activation. The audit trail is complete and exportable for incident reporting.

---

## 9. Integration Points Outside PRE

| System | Interaction | Interface |
|---|---|---|
| Property management system (PMS) | Occupancy profile → language priority advisory (manual input to corpus config) | Manual update or API advisory |
| Conference/event booking system | Conference schedule → operator prompted to create L2 override | Workflow integration, not automatic |
| Weather service | Current weather data → lobby corpus variable | API pull, corpus variable update |
| Restaurant POS | Daily specials (informational) | Manual F&B operator input |
| Building management / fire system | Fire alarm → emergency notification to duty manager (operator triggers L0 manually) | Advisory only |

The PMS and conference booking system integrations are workflow integrations, not automatic corpus integrations. The platform does not automatically create conference content overrides when a conference is booked in the PMS — the conference coordinator must take an explicit action in the ClubHub operator UI. This is a deliberate design choice: automatic conference activation based on PMS booking data would mean the system could activate content for a conference that was cancelled or modified without the coordinator's knowledge. The operator is the authority; the PMS is a data source, not a command source.
