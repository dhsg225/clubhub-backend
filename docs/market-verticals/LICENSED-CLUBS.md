# ClubHub TV — Market Vertical: Licensed Clubs

**Document type:** Operational profile
**Vertical:** Licensed clubs — social clubs, football supporter clubs, RSL/leagues clubs, members clubs
**Status:** Reference
**Last updated:** 2026-05-26

---

## 1. Vertical Overview

Licensed clubs are among the most operationally demanding environments the ClubHub TV platform serves. They combine strict regulatory compliance requirements (responsible gambling, liquor licensing, minor exclusion) with high-frequency dynamic content (jackpot amounts, raffle countdowns, race fields) and conventional promotional programming. The consequence of content failure in this vertical is not merely aesthetic — displaying non-compliant content or failing to display required compliance messaging during trading hours is a licensing risk.

PRE's constitutional guarantees are particularly load-bearing here. Compliance slots at L1 must appear with certainty. The fact that PRE.resolve() is a pure function means compliance content cannot be crowded out by a campaign override or a sponsor slot that was misconfigured at a lower level. The resolution hierarchy is not advisory in this vertical; it is the enforcement mechanism.

---

## 2. Operational Priorities

### 2.1 Compliance Messaging (L1 — Non-Negotiable)

Responsible gambling messaging, liquor license condition notices, minor exclusion notices, and venue conditions of entry operate exclusively at L1 in the PRE resolution hierarchy. L1 slots are evaluated before all campaign (L3), sponsor (L4), and default (L5/L6) content. No operator action at the venue level can suppress L1-resolved content during trading hours.

Operational requirements:

- **Minimum display frequency:** Responsible gambling messages appear at least once every third rotation slot on all screens accessible to patrons while gaming machines are operational. This is a venue license condition in most Australian states, not a platform design choice.
- **Cannot be skipped:** L1 slots do not participate in the skip/suppress logic available to L3-L6 content. A VENUE_OPERATOR cannot remove or defer a responsible gambling message. An ENTERPRISE_ADMIN cannot remove it fleet-wide. Only a schema-level corpus revision with explicit compliance officer approval can modify L1 slot frequency.
- **Asset completeness is mandatory:** A missing L1 compliance asset is a CRITICAL entropy condition. The entropy scanner MUST flag it immediately. If no valid L1 asset is available for a screen and the venue is in trading hours, the screen MUST fall back to a static compliance message from the system fallback corpus, not proceed with L5/L6 content.
- **State/territory variance:** Responsible gambling message text, minimum display durations, and required visual formats vary by jurisdiction. New South Wales, Victoria, Queensland, and South Australia each have different regulatory requirements. Corpus configuration must reflect the correct jurisdiction for each venue. Venue jurisdiction is set at the venue record level and propagates to all screens in that venue through PRE's venue-targeted specificity resolution.

### 2.2 Jackpot and Raffle State

Jackpot and raffle displays are among the highest-frequency corpus updates in any vertical. A licensed club may have jackpot amounts updating several times per hour as patrons play machines, and raffle state transitions (ticket-on-sale → countdown → live draw → winner announcement → reset) are time-critical sequences.

- Jackpot amount is a data-driven corpus variable. The corpus record for jackpot screens carries the current jackpot value and the timestamp of last update. Entropy detection targets this: if the displayed jackpot diverges from the current system value by more than the configured threshold (typically 10 minutes for jackpot data), this is a MEDIUM entropy event.
- Raffle draw sequence is a coordinated PRE context. The raffle draw timeline is a venue schedule entry (L2). PRE resolves the correct content phase (ticket-on-sale, countdown, live-draw, winner-announcement) by evaluating the schedule's active segment against the current venue-local timestamp. The sequence is fully replayable from PRE state: given the draw schedule and the timestamp, the correct phase is deterministically resolved.
- **Jackpot suspension:** When a VENUE_EMERGENCY context is active, jackpot and raffle displays are suppressed. The L0 emergency override crowds out all lower-level content including jackpot screens. This is the correct constitutional behavior — a venue incident is not the time to advertise prize pools.

### 2.3 Event Promotion

Member events, functions, and ticketed nights are campaign-level content (L3). The campaign specifies the screen zones it applies to, the date range, and the promotional assets. Standard campaign lifecycle applies: created by VENUE_OPERATOR or ENTERPRISE_ADMIN, activated, canary-promoted if applicable, and deactivated after the event. Post-event content (race results, raffle winner) is a separate short-lived campaign.

### 2.4 Sports Schedules

What fixtures are showing, on which screens, and at what time is published by the venue's broadcast coordinator and entered as schedule data (L2). PRE resolves sports schedule information for display screens (typically bar area) from the L2 schedule. Note: the actual sports broadcast content on TV screens is managed by AV switching infrastructure entirely outside PRE. PRE manages screens showing the fixture list, timing, and programming guide.

### 2.5 Sponsor Rotation (L4)

Club sponsors and product sponsors (beer brands, gaming brands, event sponsors) are managed at L4. Sponsor contracts specify screen zones, time windows, and rotation frequency. A beer brand sponsor may have L4 priority during bar trading hours; a gaming machine brand may have L4 priority in the gaming room. PRE enforces L4 above L5/L6 but below L0-L3, so compliance content always wins.

---

## 3. Screen Zones and Behavior Profiles

| Zone | Screen behavior | Primary resolution levels active |
|------|-----------------|----------------------------------|
| Lounge | Member content, jackpot display, upcoming events, responsible gambling (L1 slots) | L1, L2, L3, L4, L5 |
| Bar | Sports schedule, race fields, jackpot display, responsible gambling (L1 slots) | L1, L2, L3, L4, L5 |
| Entry/Foyer | Welcome, today's specials, upcoming events, venue conditions of entry | L1, L2, L3, L5 |
| Gaming room | Responsible gambling ONLY — L1 dominant; no sponsor, no campaign override | L1 only (all other levels suppressed by zone configuration) |
| Notice board | Compliance messaging, community notices, minor exclusion notices | L1, L2, L5 |

The gaming room zone configuration is the most restrictive in the vertical. A zone_config flag on the area record (`compliance_only: true`) instructs PRE to evaluate only L1 content for screens in this area. Attempts to schedule L3/L4 content targeted at the gaming room area will be blocked at ingestion time, not silently overridden at resolution time. This is enforced at the contract layer, not as a PRE runtime guard.

---

## 4. Compliance Requirements in Detail

### 4.1 Responsible Gambling

**Regulatory basis:** Venue licensing conditions across Australian states mandate that gaming venues display responsible gambling information. The specific requirements differ by state.

**PRE enforcement:** Responsible gambling message assets are corpus entries at L1. The L1 slot appears in every third position in the resolved playlist for all patron-accessible screens while the venue's gaming hours schedule is active. The gaming hours schedule is a venue-level L2 entry. When gaming hours are inactive (venue is closed or has restricted gaming), the L1 slot frequency drops to a configured minimum (typically one per ten slots) rather than zero — the messaging remains present but at reduced frequency.

**Asset requirements:** Each responsible gambling corpus asset must carry:
- `jurisdiction`: the state/territory code (NSW, VIC, QLD, SA, WA, ACT, TAS, NT)
- `format_version`: regulatory version of the message format (regulations update periodically)
- `valid_until`: expiry date (regulatory message formats have fixed validity periods)

An asset with an expired `valid_until` is treated as absent for entropy purposes. The entropy scanner evaluates this and escalates to CRITICAL if no valid replacement exists.

### 4.2 Liquor License Conditions

Venue liquor license conditions (no service after midnight, no takeaway sales, responsible service of alcohol notices) are displayed during trading hours. These are also L1 content. The license condition asset is venue-specific and must be updated when the venue's license conditions change (e.g., after a licensing review). An ENTERPRISE_ADMIN action is required to update a license condition asset — this is not a self-service VENUE_OPERATOR operation.

### 4.3 Minor Exclusion Notices

Venues that exclude minors from certain areas (gaming rooms, sports bars, certain function areas) must display minor exclusion notices at area entry points. These are L1 assets targeted at specific area zones. The zone configuration for affected areas includes `minor_exclusion: true`, which triggers the mandatory L1 slot for that area.

---

## 5. Entropy Risk Patterns

| Content type | Entropy risk level | Detection threshold | Escalation |
|---|---|---|---|
| Responsible gambling asset missing | CRITICAL | Immediate — checked at corpus load | EMERGENCY_FREEZE candidate if venue is in gaming hours |
| Jackpot amount stale | MEDIUM | 10 minutes divergence from source | Advisory alert, VENUE_OPERATOR notified |
| Raffle countdown sequence drift | HIGH | 5 minutes from scheduled draw time | Immediate alert, duty manager notified |
| License condition asset expired | HIGH | At asset `valid_until` boundary | ENTERPRISE_ADMIN alert |
| Sports schedule stale | LOW | 60-minute venue scan threshold | Advisory alert |

The 60-minute venue corpus scan runs continuously. The 6-hour fleet scan aggregates across all venues in the enterprise. Compliance-class entropy (L1 asset missing or expired) bypasses the standard scan interval and is evaluated in real-time at resolution time.

---

## 6. Operator Cognitive Load Model

Licensed club operators face the highest operator cognitive load of any vertical. The duty manager is responsible for all of the following simultaneously:

- **Jackpot state management:** Monitoring jackpot display accuracy, coordinating with gaming system for live amounts, triggering manual overrides for progressive jackpot events.
- **Raffle coordination:** Entering draw time, confirming countdown start, triggering live draw content, entering winner announcement, resetting state.
- **Sports schedule coordination:** Updating screen fixture lists as broadcast schedules change, adding late additions, removing cancelled fixtures.
- **Event promotion:** Managing campaigns for upcoming events, activating last-minute specials.
- **Emergency readiness:** Knowing how to trigger VENUE_EMERGENCY quickly when needed.

The operator interface for this vertical must surface these workflows in priority order. A duty manager at 7pm on a Friday night should not need to navigate three screens to suspend jackpot display during an incident.

### 6.1 Emergency Trigger Requirements

VENUE_EMERGENCY must be triggerable from any VENUE_OPERATOR-authenticated terminal in the venue. The trigger path must be no more than two actions from the operator's current screen. This is a UX requirement, not a preference — venue incidents move fast.

Emergency content when triggered:
- All patron screens: venue emergency messaging (contact, next steps)
- Evacuations: evacuation route content loaded from the L0 emergency corpus
- Jackpot and raffle: suspended immediately (L0 takes precedence)
- Duration: emergency state persists until explicitly cleared by VENUE_OPERATOR or ENTERPRISE_ADMIN

---

## 7. Campaign Cadence

| Cadence | Typical content |
|---|---|
| Weekly | Weekly specials, happy hour changes, upcoming race meetings |
| Monthly | Member events, club functions, ticketed nights |
| Quarterly | Major promotions, loyalty program events |
| Seasonal | Footy season (football clubs: pre-season, finals campaigns), Racing carnival, Christmas/NYE |
| Annual | Anniversary promotions, major jackpot events |

Campaign creation for this vertical is typically VENUE_OPERATOR for weekly/monthly content and ENTERPRISE_ADMIN for seasonal/annual. Regional chains of clubs may use REGIONAL_MANAGER to coordinate cross-venue seasonal campaigns.

---

## 8. Live Event Sequences

### 8.1 Race Day Sequence

1. **Morning (race day):** Sports schedule updated with that day's race meetings. Race fields available by 10am for most metropolitan meetings.
2. **Pre-race:** Bar and lounge screens show race field, race time, TAB information. Schedule (L2) activates race content for bar zone.
3. **Race running:** No PRE action required — live race broadcast is AV infrastructure. PRE manages the race schedule display screens.
4. **Post-race:** Results content loaded as short-duration L3 campaign. Duration: 15 minutes per race.
5. **Final race of day:** Results summary, tomorrow's meetings preview.

### 8.2 Major Sporting Event Sequence

1. **Fixture announced:** Event added to sports schedule. Promotional campaign created (L3) for the days leading up to the event.
2. **Game day:** High-energy pre-game content on bar and lounge screens. Fixture schedule displayed prominently.
3. **Game time:** AV infrastructure handles broadcast. PRE screens show match information, sponsor content.
4. **Post-game:** Result content loaded as short-duration L3 campaign (30 minutes). Winner/loser response templates prepared in advance.

### 8.3 Jackpot Draw Sequence

This is the most time-critical sequence the platform manages for this vertical.

1. **T-2 hours:** Raffle ticket-on-sale content activates. L2 schedule entry for this phase starts.
2. **T-30 minutes:** Countdown phase activates. All relevant screens switch to countdown display. PRE resolves this from L2 schedule evaluation.
3. **T-5 minutes:** High-intensity countdown content. Operator confirms draw setup is ready.
4. **T-0 (draw):** VENUE_OPERATOR triggers live-draw override. This is a SPECIFICITY_2 (venue-targeted) L2 override with immediate activation. All applicable screens switch to live draw content.
5. **Winner announced:** Operator enters winner name/ticket number. Winner announcement campaign (L3, 30-minute duration) activates.
6. **Reset:** Operator clears draw state. New jackpot accumulation phase begins. Ticket-on-sale content for next draw period activates per schedule.

The entire sequence is auditable: each state transition is a PRE state change with a timestamp, operator ID, and corpus hash. A dispute about whether the draw was displayed correctly at T-3 minutes can be resolved by replaying PRE state for that timestamp.

---

## 9. Localization Requirements

### 9.1 Jurisdictional Compliance Variance

Australian states have materially different responsible gambling message requirements:

| State | Key variances |
|---|---|
| NSW | ClubSafe messaging format; specific color requirements for gambling help messages |
| VIC | GameSafe Victoria format; BetSafe branding for sports betting contexts |
| QLD | Responsible gambling message wording set by OLGR; venue-specific conditions may differ |
| SA | Consumer and Business Services requirements; specific time-of-day display rules |
| WA | More restrictive — casino venues have different requirements from clubs |
| ACT | ORS messaging requirements |

Venue records carry their `jurisdiction_code`. The PRE corpus is segmented by jurisdiction: L1 assets with a matching `jurisdiction_code` are selected over generic assets for a given venue. A venue with `jurisdiction_code: NSW` will never display a VIC-format responsible gambling message.

### 9.2 Multilingual Requirements

Most licensed clubs operate in English. Exceptions:
- Multicultural clubs (Vietnamese-Australian clubs, Greek-Australian clubs, Italian-Australian clubs, etc.) may require dual-language displays for some screens.
- Language priority is configured at the screen_zone level: `language_priority: [EN, VI]` for a venue with a significant Vietnamese-speaking membership.
- Compliance messaging must be available in the configured primary language. If a compliance asset is not available in the configured language, the system falls back to English and logs an entropy warning. The fallback is explicit and auditable — it does not silently succeed.

---

## 10. Operational Examples

### Example A: Friday Night at Northgate RSL (High-Traffic Event Night)

**Context:** Northgate RSL, NSW. Friday evening. Gaming machines operational 10am–midnight. Raffle draw at 8pm. State of Origin broadcast on bar screens.

**5:00pm — Happy hour activates:**
PRE resolves L3 campaign (happy hour drinks specials) for bar and lounge zones. The L3 campaign was scheduled by VENUE_OPERATOR on Monday with a recurring Friday 5pm–7pm schedule. No operator action required at 5pm.

**6:45pm — Raffle countdown begins:**
The L2 raffle schedule entry transitions from `ticket_sale` to `countdown` phase. All lounge and bar screens not showing the sports fixture schedule switch to countdown display. The duty manager glances at the screen preview dashboard and confirms the transition happened correctly.

**7:30pm — State of Origin pre-game:**
VENUE_OPERATOR activates a pre-loaded `state_of_origin_pregame` L3 campaign for bar screens. The campaign was uploaded on Wednesday with team assets. It activates immediately and shows on bar zone screens alongside the existing fixture schedule. Sponsor content (L4 — beer brand) continues to rotate in sponsor slots on the same screens.

**7:55pm — Responsible gambling slot appears:**
PRE resolves the L1 slot in the bar screen rotation. The `ClubSafe NSW` responsible gambling message plays for its required 30-second minimum duration. No operator involvement. This happens every third rotation slot for the duration of gaming hours.

**8:00pm — Raffle live draw:**
VENUE_OPERATOR taps "Start Draw" in the operator panel. This creates a venue-targeted L2 override with immediate activation. All applicable screens switch to live draw content. The announcer calls the draw. Winner is ticket #4471.

**8:02pm — Winner announcement:**
VENUE_OPERATOR enters winner details. The system activates a pre-configured winner announcement template (L3 campaign, 20-minute duration) with the ticket number. Screens return to normal rotation after 20 minutes automatically — no operator action required.

**10:15pm — Patron incident:**
Duty manager activates VENUE_EMERGENCY from the front-of-house tablet. All patron screens immediately switch to venue emergency messaging. Jackpot display is suspended. The incident is managed. After 12 minutes, the duty manager clears the emergency state from the same tablet. Screens return to normal resolution.

**12:00am — Gaming hours end:**
The gaming hours L2 schedule entry expires. PRE resolution shifts: L1 responsible gambling slot frequency drops to the configured non-gaming-hours rate. The gaming room screens enter their post-trading-hours configuration (static venue branding, closed notice).

---

### Example B: Cup Day at Melburnian Sporting Club (Racing Day)

**Context:** Melburnian Sporting Club, VIC. Melbourne Cup day. Racing is the primary programming event. The venue has 8 bar screens showing racing content.

**8:00am — Race fields available:**
The morning operator logs in and reviews the day's race field data. The corpus has been pre-loaded by the enterprise coordinator with template race field assets for the major Cup races. The operator confirms the fields are displaying correctly on bar screens.

**10:00am — Specials menu activates:**
The Cup Day menu campaign (L3, pre-created last week) automatically activates. Lounge and restaurant screens display the Cup Day set menu. No operator action required.

**2:45pm — Race 7 (Melbourne Cup) approach:**
VENUE_OPERATOR activates the `cup_race_focus` L3 override, pre-built and waiting in the campaign library. Bar and lounge screens shift to high-intensity pre-race content. The AV infrastructure handles the actual Channel 10 broadcast independently.

**3:00pm — Race running:**
PRE continues resolving race information screens. Responsible gambling (L1, VIC GameSafe format) continues to rotate every third slot on all patron-accessible screens through the race broadcast. Sponsor content (L4 — Spring Carnival sponsor) rotates in sponsor slots.

**3:07pm — Race result:**
Result content is pre-loaded for quick activation. The operator taps the result — winner name auto-populated from the racing data feed — and activates the result campaign (L3, 30-minute duration). Screens show result and dividend information.

**5:00pm — Evening entertainment:**
The venue's Friday evening entertainment campaign activates automatically per schedule. The operator does nothing. PRE transitions the corpus from race content to evening entertainment content according to the pre-configured L2 schedule.

---

### Example C: Compliance Audit at Crestwood Leagues Club (QLD)

**Context:** Crestwood Leagues Club, QLD. An OLGR compliance officer is conducting a scheduled inspection. The operator needs to demonstrate that compliance requirements are being met.

**Compliance officer arrives at gaming room:**
The gaming room screens are showing exclusively responsible gambling content — no sponsor, no campaign, no jackpot. The `compliance_only` zone flag on the gaming room area is working as expected. The compliance officer asks to see the display history.

**Operator pulls PRE replay:**
The operator opens the audit log view and requests a replay of the gaming room screen's resolved playlist for the past 4 hours. The replay is generated by running PRE.resolve() over the recorded state snapshots for each 10-minute interval. Every 10-minute window shows responsible gambling content as the resolved output. The audit trail is a deterministic reconstruction, not stored footage.

**Compliance officer checks message format:**
The displayed responsible gambling message is in the OLGR-approved format for QLD venues. The corpus asset carries `jurisdiction_code: QLD` and `format_version: OLGR-2024-Q3`. The asset's `valid_until` date is 2027-01-31 — still valid.

**Officer asks about responsible gambling frequency:**
The operator pulls the slot frequency analysis from the entropy dashboard. The analysis confirms that over the past 30 days, the L1 slot has appeared in position 3, 6, 9... (every third slot) on all gaming-accessible screens during recorded gaming hours. The entropy scanner has raised zero CRITICAL alerts for this venue's L1 content in that period.

**Inspection passed.** The officer notes that the platform's deterministic audit capability is significantly better than what they typically see from venues using ad-hoc media player setups.

---

## 11. Integration Points Outside PRE

The following systems interact with the ClubHub TV platform for this vertical but are not managed by PRE:

| System | Interaction | Interface |
|---|---|---|
| Gaming management system | Jackpot amount feed → corpus variable updates | API push or corpus variable poll |
| Broadcast AV infrastructure | Live TV switching (not PRE-managed) | Independent AV infrastructure |
| TAB/Wagering terminal network | Race field and odds data → corpus variable updates | Data feed → corpus update |
| POS system | Specials and menu data (informational) | Manual operator input or API sync |
| Venue security system | Patron incident alert → may trigger VENUE_EMERGENCY | Manual duty manager action (not automated) |

The gaming management system integration is particularly important: jackpot amounts must flow from the GMS to the corpus accurately and frequently. A broken GMS integration is the most common cause of jackpot display entropy in this vertical.
