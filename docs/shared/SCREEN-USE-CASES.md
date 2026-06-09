# ClubHub TV — Screen Use Cases
# Shared Operational Intelligence Layer

**Document type:** Living canonical reference — append-oriented
**Authority:** Agent 2 (CMS/Operational Architecture)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design)
**Last updated:** 2026-05-22

---

## Purpose

This document catalogs canonical screen use cases — the specific operational contexts in which a physical display screen operates. Each use case defines what the screen is for, who is looking at it, what they expect to see, how often content needs to change, and what failure looks like.

This is the bridge between the environmental analysis (ENVIRONMENTAL-CONTEXTS.md), the market vertical profiles (MARKET-VERTICAL-PATTERNS.md), and the playout patterns (PLAYOUT-PATTERN-LIBRARY.md). Screen use cases define the unit of operational context that content, configuration, and UX decisions must serve.

---

## Use Case Structure

Each use case contains:
- **Primary purpose** — what the screen is fundamentally for
- **Viewer profile** — who is looking and in what mode
- **Content requirements** — what content works in this context
- **Update expectations** — how often content must change
- **Failure definition** — what "broken" looks like to a viewer or operator
- **PRE considerations** — which resolution behaviors matter most
- **Entropy risk profile** — which entropy patterns this use case is prone to
- **Configuration recommendations** — how this use case should be configured

---

## Use Case 1: Bar / Beverage Ambient Display

**Context:** Screens mounted in a bar or beverage service area, typically high on walls, visible across the bar.
**Primary purpose:** Atmosphere reinforcement, promotional content delivery (specials, events), sponsor display.
**Viewer profile:** SOCIAL-DISTRACTED — patrons in conversation, intermittent glances of 1–3 seconds.

### Content Requirements
- Single-idea content items: one message per slide.
- Short duration: 10–20 seconds maximum per item.
- Large type: Headline-only or headline + 3-word supporting text.
- High visual contrast.
- Brand-consistent aesthetic.
- Specials prominently featured but not exclusively — pure promotional content creates "ad channel" perception.
- Event promotion mixed with atmosphere content.

### Update Expectations
- Base rotation: Weekly.
- Daily specials: Updated same-day or night before.
- Event-specific content: Updated 1–24 hours before event.
- Live event interruption: Within minutes.

### Failure Definition
- Screen showing fallback content (system default slide visible to bar patrons).
- Out-of-date promotions (yesterday's specials, last week's events).
- Wrong content for the time of day (late-night content running during family lunch service).
- Screens under different overrides showing different content when they should look consistent.

### PRE Considerations
- LEVEL_3 (area schedule) is the expected primary resolution level.
- LEVEL_1 (operational override) expected for event-specific changes.
- Confidence score monitoring important — bar screens are common targets for HDMI switch to sports TV input.
- Timezone-correct time-of-day scheduling for daypart transitions.

### Entropy Risk Profile
- HIGH override accumulation (shift managers use overrides for daily specials).
- HIGH campaign fragmentation (direct scheduling for quick additions).
- MEDIUM staleness (content may not be updated at end of promotional period).

### Configuration Recommendations
- Base ambient campaign: area-targeted, low priority, runs continuously.
- Daily specials template: standard campaign with daily expiry.
- Event content: LEVEL_2 scheduled override with event-time expiry.
- Emergency: venue-wide, reserved for genuine incidents only.
- Regular content audit: Weekly sweep to remove expired direct schedules.

---

## Use Case 2: Dining Menu Board

**Context:** Screen positioned to be readable from a queue, table, or counter. Content is functional — patrons are making decisions based on it.
**Primary purpose:** Menu display, specials communication, order assistance.
**Viewer profile:** TASK-ENGAGED — actively seeking information to make a purchase decision.

### Content Requirements
- Readable at viewing distance (minimum 36pt type at 5m).
- Accurate above all else — menu items, prices, allergen information must be current.
- Organized and scannable — not a marketing poster.
- Photo-realistic food imagery effective in this context (unusually high-attention viewing).
- Specials clearly differentiated from regular menu.
- Seasonal variation expected (breakfast menu in morning, lunch menu at midday).

### Update Expectations
- Menu: Infrequent (weekly or when menu changes).
- Daily specials: Daily, before service opening.
- Pricing: Immediate when prices change (accuracy is a consumer protection concern in some jurisdictions).

### Failure Definition
- Showing items no longer available.
- Incorrect prices.
- Missing items.
- Out-of-date seasonal menu (winter menu in summer, etc.).
- System fallback instead of menu content.

**Note:** Accuracy failure on a menu board is significantly more damaging than on an ambient screen. A patron who orders based on an incorrect menu board has a concrete negative experience. This use case has the highest content accuracy requirement of any standard use case.

### PRE Considerations
- Resolution reliability is paramount — this screen cannot show fallback content without immediate operator awareness.
- Confidence score monitoring essential.
- Time-of-day scheduling for daypart menu transitions (breakfast → lunch → dinner menu) should use the venue's local timezone (INV-9).

### Entropy Risk Profile
- LOW override accumulation (this screen rarely gets operational overrides — too visible).
- LOW campaign fragmentation (menus are managed intentionally).
- MEDIUM-HIGH staleness (menus updated infrequently; out-of-date content persists).

### Configuration Recommendations
- Menu content: Stable campaign, venue or area targeted, with explicit review reminders.
- Daypart transition: Time-of-day windowed schedules (7am–11am breakfast, 11am–3pm lunch, etc.).
- Specials: Short-duration campaign with daily expiry, or quick-update content item with daily review.
- No overrides except genuine replacement needs.

---

## Use Case 3: Waiting Room Information Display

**Context:** Screen in a space where people are waiting (medical, library, queue, pre-appointment).
**Primary purpose:** Reduce perceived wait time, deliver useful information, ambient comfort.
**Viewer profile:** IDLE-WAITING — sustained low-engagement attention. Highest text-reading propensity of any use case.

### Content Requirements
- Can carry more text than any other use case — IDLE-WAITING viewers actually read.
- Content sequencing acceptable — viewers may follow a 3-step sequence.
- Useful information prized: wait time estimates (if integrated), service information, health information, venue information.
- Longer content items acceptable (20–45 seconds).
- Low urgency on updates — weekly is acceptable.

### Update Expectations
- Low urgency: Weekly to monthly.
- Exception: Service hours, closures, urgent information — must be updated same-day.
- Accuracy is important — wrong service hours or contact information is damaging.

### Failure Definition
- Outdated service information (particularly closure notices, wrong hours).
- Seasonal content out of season.
- Content that feels irrelevant to the waiting context.

### PRE Considerations
- Staleness monitoring (M-11) most important signal for this use case.
- Low operational intensity — few overrides, low priority competition.

### Entropy Risk Profile
- LOW override accumulation.
- LOW campaign fragmentation.
- HIGH staleness (low operational pressure leads to infrequent updates).

### Configuration Recommendations
- Schedule with explicit expiry dates on all time-sensitive content.
- Monthly content review reminder (implemented via entropy advisory).
- No operational overrides expected — if content needs to change urgently, update the content item.

---

## Use Case 4: Sports / Entertainment Primary Screen

**Context:** Screen positioned as the primary viewing surface for live entertainment content (sports broadcast, live event, competition results).
**Primary purpose:** Entertainment delivery — the screen IS the attraction, not a background.
**Viewer profile:** ENTERTAINMENT-WATCHING — high attention, long dwell, social commentary around content.

### Content Requirements

**Critical distinction:** This use case frequently involves a switch to non-ClubHub input (live sport, live TV) during the entertainment event. ClubHub manages the "between events" state and peripheral content, not the primary live content.

Between-event content:
- Pre-match: Matchup information, expectation building, sponsor activation.
- Half-time/interval: Promotional content (highest-attention opportunity in venue).
- Post-match: Results, next event preview.

During-event: Typically NOT ClubHub content — direct TV input.

### Update Expectations
- Event-specific content: Hours before event.
- Half-time content: Prepared before match, available when needed.
- Post-match results: Within minutes of final result.

### Failure Definition
- ClubHub showing wrong content during active live sport (operator hasn't switched to TV input).
- ClubHub not resuming after operator switches back from TV input (HDMI switch forgotten).
- Half-time promotional content not ready when needed.

### PRE Considerations
- HDMI switch awareness: When this screen switches to TV input, delivery log will stop updating. Confidence score will degrade. This degradation is expected and should not generate false alerts during sporting events.
- Future consideration: Screen metadata flag `shares_display_input: true` would suppress false confidence alerts during known sporting events.

### Entropy Risk Profile
- HIGH emergency misuse (event takeover via emergency activation).
- HIGH override accumulation (event-specific overrides without expiry).
- HIGH priority escalation (sports content at maximum priority, never cleaned up).

### Configuration Recommendations
- Event content as scheduled override with event-time expiry (LEVEL_2).
- Quick-access half-time content workflow (accessible within 1 minute for shift managers).
- Post-event automatic return to ambient content via expiry-based override.

---

## Use Case 5: Gaming Area Compliance Screen

**Context:** Screen in or adjacent to an electronic gaming machine (EGM) area, subject to regulatory compliance requirements for responsible gambling messaging.
**Primary purpose:** Regulatory compliance — specific content must appear at mandated frequency — plus venue promotion.
**Viewer profile:** PASSIVE-AMBIENT — patrons focused on machines, not screens.

### Content Requirements
- Responsible gambling messages: Legally mandated, jurisdiction-specific frequency.
- Jackpot promotions (where permitted by regulation).
- Gaming product promotions.
- No content that is prohibited in gaming areas (jurisdiction-specific — may include external venue promotions, alcohol advertising adjacent to EGMs).

### Update Expectations
- Compliance content: Infrequent (set once, reviewed with regulatory changes).
- Jackpot promotions: Campaign-based, frequent.
- Regulatory content: Immediate when regulations change.

### Failure Definition
- Responsible gambling message not appearing at required frequency (regulatory violation).
- Prohibited content appearing on a gaming area screen (regulatory violation).
- System fallback on compliance screen (visually obvious failure in regulated environment).

### PRE Considerations
- Compliance content cannot be displaced by operational overrides — a LEVEL_1 override will supersede compliance schedules.
- This is a constitutional design gap: there is currently no mechanism to protect compliance content from override. See PLAYOUT-PATTERN-LIBRARY.md Pattern 9 and the constitutional tension noted there.
- Until resolved: Ops process must ensure gaming area operators do not create overrides on compliance screens.

### Entropy Risk Profile
- HIGH regulatory compliance risk if configuration is incorrectly managed.
- MEDIUM override displacement risk (gaming managers creating promotional overrides).
- MEDIUM staleness risk (compliance content reviewed infrequently — must be proactively monitored for regulatory changes).

### Configuration Recommendations
- Compliance content: Area-targeted schedule with no expiry, reviewed quarterly.
- Gaming promotions: Campaign-based, short-expiry schedules.
- Process control: Gaming area screens flagged in system (`is_compliance_screen: true`), subject to enhanced monitoring.
- Until constitutional compliance protection is designed: operational policy preventing LEVEL_1 overrides on compliance screens.

---

## Use Case 6: Golf Tournament Leaderboard

**Context:** Screen in golf club function room, scoring room, or high-visibility area displaying competition results during tournament day.
**Primary purpose:** Competition information delivery — results, standings, scoring.
**Viewer profile:** ENTERTAINMENT-WATCHING during active tournament, PASSIVE-AMBIENT between events.

### Content Requirements
- Leaderboard display: Real-time or near-real-time scoring (if data integration exists).
- Manual leaderboard update (if no integration): Operator-updated content items during competition.
- Sponsor branding integrated into leaderboard display.
- Post-competition: Final results, presentation schedule.

### Update Expectations
- During tournament: Continuous or per-hole update (if integrated), manual update frequency otherwise.
- Pre-tournament: Day-of configuration.
- Post-tournament: Within 30 minutes of completion.

### Failure Definition
- Leaderboard showing wrong scores.
- Previous competition results displayed when tournament is complete.
- System fallback showing during active competition.
- Tournament override persisting past tournament day.

### PRE Considerations
- Tournament day: LEVEL_2 scheduled override active during tournament hours, auto-expiring at end of day.
- Auto-expiry is critical for this use case — tournament overrides that persist into the next day are a common entropy source.

### Entropy Risk Profile
- MEDIUM tournament override persistence (if expiry not set).
- LOW campaign fragmentation.
- LOW staleness (tournament content is obviously outdated — operators notice).

### Configuration Recommendations
- Tournament content: Scheduled override with explicit end-of-tournament expiry.
- Leaderboard integration: Future capability — content item type `live_data` with scoring feed.
- Manual update workflow: Designated operator with quick-update access during tournament.

---

## Use Case 7: Hotel Lobby Ambient

**Context:** Screen in hotel lobby or common area. Guests are transitioning through the space.
**Primary purpose:** Brand impression, ambiance, useful information delivery.
**Viewer profile:** PASSIVE-AMBIENT to IDLE-WAITING depending on check-in queue length.

### Content Requirements
- Premium aesthetic — cheap-looking content in a quality hotel is brand-damaging.
- Local area information: Dining recommendations, activities, tourist attractions.
- Property information: Amenities, services, hours.
- Minimal promotional content — guests in a hotel lobby resent being advertised at.
- Multilingual consideration if international guest mix is significant.
- Daypart variation: Breakfast welcome in morning, evening dining recommendation at 5pm.

### Update Expectations
- Core rotation: Monthly or seasonal.
- Seasonal update: Quarterly.
- Local events: Weekly.
- Emergency/safety: Immediate.

### Failure Definition
- Outdated promotional content (closed restaurant, changed hours).
- Content that conflicts with premium brand positioning.
- Multilingual content missing for significant guest demographics.
- Out-of-season content.

### PRE Considerations
- Staleness monitoring critical (M-11) — hotels are prone to low-frequency management.
- Confidence score for lobby screens should be high — lobby is high-visibility.

### Entropy Risk Profile
- HIGH staleness (low operator activity frequency).
- LOW override accumulation.
- MEDIUM campaign fragmentation (marketing may have multiple indirect content managers).

### Configuration Recommendations
- Quarterly content review reminders.
- Explicit expiry dates on all time-sensitive content items.
- Season-based campaign structure (spring/summer/autumn/winter campaigns).

---

## Use Case 8: Staff-Facing Internal Screen

**Context:** Screen visible primarily to staff rather than customers — break room, back-of-house area, manager office, staff corridor.
**Primary purpose:** Staff communication, operational information, internal promotion.
**Viewer profile:** PASSIVE-AMBIENT to IDLE-WAITING — staff check screens during idle moments.

### Content Requirements
- Staff-relevant operational information: shift schedules, training announcements, policy updates.
- Internal promotions: Staff benefits, events.
- Safety information: Emergency procedures.
- Different tone from customer-facing content — less polished, more direct.

### Update Expectations
- Frequent: Weekly to daily.
- Urgent: Immediate for operational changes, safety updates.

### Failure Definition
- Customer-facing promotional content appearing on staff screens (wrong content targeting).
- Outdated operational information persisting.

### PRE Considerations
- Specificity targeting critical — staff screens must be correctly scoped to not receive customer campaigns.
- Area or screen targeting necessary to separate staff-facing from customer-facing.

### Configuration Recommendations
- Separate area designation for staff-facing screens.
- TV group or area-level targeting ensures staff content is isolated.
- No overlap with customer-facing area campaigns.

---

## Use Case 9: Outdoor / Beer Garden Display

**Context:** Screens in outdoor or partially-outdoor venue areas. Variable light, weather, and viewing conditions.
**Primary purpose:** Promotional, atmosphere, basic information.
**Viewer profile:** SOCIAL-DISTRACTED to PASSIVE-AMBIENT.

### Content Requirements
- High contrast: Essential for outdoor visibility.
- Large type: Critical for variable viewing distance and ambient light.
- Minimal text: Outdoor viewers do not read detailed information.
- Weather-resilient content: Content appropriate regardless of weather conditions (avoid content that references "beautiful weather" that may display on a rainy day).
- Short duration: 10–15 seconds maximum.

### Update Expectations
- Low urgency: Weekly.
- Weather-reactive: If weather integration added, content should adapt.

### Failure Definition
- Content invisible in bright sunlight (insufficient contrast/brightness).
- Text too small to read from outdoor viewing distance.
- Hardware failure (weather-related) — display shows nothing.

### PRE Considerations
- Confidence score monitoring — outdoor screens are more prone to device issues (heat, weather, network).
- Hardware watchdog recovery is critical for outdoor deployments.

### Configuration Recommendations
- Outdoor screen area designation with specific content requirements.
- Bright, high-contrast content items only — advisory on outdoor screens for content items that don't meet contrast requirements.
- Content type metadata flagging for outdoor-appropriate screening (future capability).

---

## Screen Use Case Summary Matrix

```
Use Case                    │ Attention  │ Update Freq  │ Accuracy  │ Entropy Risk
────────────────────────────┼────────────┼──────────────┼───────────┼─────────────
Bar/Beverage Ambient        │ Passive    │ Daily/Weekly │ Medium    │ HIGH override
Dining Menu Board           │ Task       │ Daily/Weekly │ HIGH      │ MEDIUM stale
Waiting Room Information    │ Idle-Wait  │ Weekly       │ High      │ HIGH stale
Sports/Entertainment Primary│ Entertain  │ Event-day    │ Medium    │ HIGH override/emergency
Gaming Compliance Screen    │ Passive    │ Infrequent   │ CRITICAL  │ HIGH compliance risk
Golf Tournament Leaderboard │ Entertain  │ Real-time    │ High      │ MEDIUM persistence
Hotel Lobby Ambient         │ Passive    │ Monthly      │ Medium    │ HIGH stale
Staff-Facing Internal       │ Idle       │ Weekly       │ Medium    │ LOW targeting risk
Outdoor / Beer Garden       │ Social     │ Weekly       │ Low       │ MEDIUM hardware
```

---

*End of SCREEN-USE-CASES.md v1.0*
*Append new use cases as new deployment contexts are identified.*
*Each use case should be validated against at least 3 real deployments before being considered stable.*
