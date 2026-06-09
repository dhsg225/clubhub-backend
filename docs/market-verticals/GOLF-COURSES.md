# ClubHub TV — Market Vertical: Golf Courses

**Document type:** Operational profile
**Vertical:** Golf courses — private clubs, resort courses, public courses, tournament venues
**Status:** Reference
**Last updated:** 2026-05-26

---

## 1. Vertical Overview

Golf courses present a screen deployment environment that is physically distributed, operationally time-sensitive, and subject to weather-driven emergencies with no advance notice. Screens exist indoors (clubhouse, pro shop, 19th hole, range) and outdoors (first tee, between-hole signage, cart-mounted if applicable). These two populations have fundamentally different operational characteristics: indoor screens have reliable network connectivity and the full CMS feature set; outdoor screens must be engineered for offline resilience and simplified content.

The most operationally critical scenario in this vertical is not a content failure — it is the weather emergency. A lightning warning requires immediate override of all outdoor screen content and must be triggerable by a course marshal in the field, not only a desk-bound operator. This sets a design requirement that propagates through the entire operator experience for this vertical.

Tournament operation adds a second distinct operational mode with its own state machine (PRE_TOURNAMENT → TOURNAMENT_ACTIVE → WEATHER_HOLD → ROUND_COMPLETE → TOURNAMENT_COMPLETE). Each transition involves coordinated corpus changes across multiple screen zones, and the transitions must be atomic from the operator's perspective.

---

## 2. Operational Priorities

### 2.1 Tee Sheet Pacing

The first tee screen is the single most operationally critical screen in a golf course deployment. It shows:
- Current booking status (tee time occupancy, next group up)
- Next tee time and the group name
- Pace of play indicator (current group vs. par pace)
- Course conditions relevant to the next group (cart restrictions, temporary local rules)

Tee sheet data is dynamic — tee times process every 8–10 minutes on a busy course. The corpus variable for tee sheet status is updated each time a group tees off. Entropy detection for the first tee screen uses an aggressive threshold: if the tee sheet data is more than 15 minutes stale, this is a HIGH entropy event. A stale first tee screen is operationally embarrassing and can cause pace-of-play problems.

PRE resolves tee sheet content from the L2 venue schedule zone (first_tee area) with tee sheet data injected as corpus variables. The resolution is deterministic: given the tee sheet state at a timestamp, PRE always produces the correct display.

### 2.2 Course Conditions

Course conditions are venue-managed content that changes daily or intra-day:
- Cart path only (wet conditions) or cart restrictions (specific holes)
- Temporary local rules (ground under repair, preferred lies)
- Hole-specific conditions (aeration work, pin placement notes)
- Winter rules active/inactive

Conditions are typically entered by the course superintendent or head pro at the start of each day and updated as conditions change. They live in the corpus as L2 venue schedule entries with explicit activation and deactivation times. A `cart_path_only` condition entry has `venue_id`, an active time window, and a content asset reference. When PRE resolves a screen in the first_tee or course signage zone, the active conditions are included in the resolved content.

Condition changes must propagate to displayed screens within 5 minutes of entry. This is not a technical constraint of PRE (resolution is near-instant) but a practical requirement the polling interval must satisfy: screens polling at 2-minute intervals will pick up condition changes within 2 poll cycles.

### 2.3 Tournament State

Tournaments operate as a distinct operational mode. The tournament state is declared by the head pro or tournament director and transitions through defined phases. Each phase change triggers a corpus-wide shift in how PRE resolves screens for the venue:

| Phase | Screen behavior |
|---|---|
| PRE_TOURNAMENT | Draw sheet, pairings, course setup, practice round schedule |
| TOURNAMENT_ACTIVE | Live leaderboard (data-driven), round status, weather, pairings |
| WEATHER_HOLD | Lightning warning / suspension messaging on all outdoor screens |
| ROUND_COMPLETE | Round scoring summary, next-round preview, leaderboard |
| TOURNAMENT_COMPLETE | Final results, prize ceremony information, sponsor recognition |

The tournament context is declared as a venue-level L2 schedule override. PRE sees the tournament context in SystemState and resolves appropriately for each screen zone. Screens in the clubhouse bar show tournament leaderboard; screens in the pro shop show tournament sponsor and merchandise content; outdoor course signage shows relevant tournament information.

### 2.4 Clubhouse Programming

Standard hospitality content (food and beverage specials, pro shop promotions, lesson booking, member events) operates as L3 campaign content for clubhouse zones. This is managed separately from course and tournament content. The F&B manager may update restaurant specials without any knowledge of or interaction with the tournament operational state. The PRE resolves both simultaneously: a screen in the 19th hole lounge may show a leaderboard widget (from tournament context at L2) alongside a dinner specials overlay (from F&B campaign at L3).

### 2.5 Weather Emergency (L0 Equivalent)

Lightning warnings are the highest-priority content transition in this vertical. When a lightning warning is issued for the course area, all outdoor screen content must immediately switch to a lightning warning message. This is implemented as an L0 context override — it supersedes all other content at every resolution level.

The key operational requirement is who can trigger it: the lightning warning must be triggerable by any authenticated operator, including a course marshal with a mobile device on the course. This is not a desk-bound operation.

The trigger mechanism:
1. Course marshal or pro shop opens ClubHub operator app on mobile
2. Single-action trigger: "Activate Lightning Warning"
3. System creates L0 emergency context for the venue
4. PRE resolves all outdoor screens to lightning warning content immediately
5. Indoor screens: advisory message appears but standard content continues
6. All-clear signal: explicit operator action required to lift warning

The clear-all path must be equally fast. If a marshal hit "lightning warning" and the storm has passed, they must be able to lift it from the same mobile interface in one action.

---

## 3. Screen Zones and Behavior Profiles

| Zone | Indoor/Outdoor | Content profile | Offline resilience requirement |
|---|---|---|---|
| First tee | Outdoor | Tee sheet, pace of play, conditions, weather | HIGH — must show last valid state if network drops |
| Clubhouse bar | Indoor | Social content, F&B specials, tournament coverage | STANDARD |
| 19th hole / lounge | Indoor | Tournament leaderboard, post-round, sponsor recognition | STANDARD |
| Pro shop | Indoor | Equipment, lessons, fitting, club merchandise | STANDARD |
| Range | Indoor/Covered | Training tips, pro instruction, equipment content | STANDARD |
| Between-hole signage | Outdoor | Course branding, sponsor content, hole information | HIGH |
| Cart-mounted screens | Outdoor (mobile) | Hole preview, local rules, sponsor content | HIGHEST — no reliable connectivity |

### 3.1 Outdoor Screen Corpus Design

Outdoor screens and cart-mounted screens must carry a complete L6 (device local cache) corpus sufficient to operate the screen for an entire round (4.5 hours) without any network contact. The L6 cache is loaded during overnight sync. During a network outage, PRE resolution falls back to L6: the screen continues showing relevant content (hole information, local rules, sponsor content) without degrading to blank.

Entropy detection for outdoor screens uses a modified threshold: a missed poll on an outdoor screen during a rain event is not elevated to CRITICAL. The context field `outdoor: true` on the area record modifies entropy scoring. A sequence of missed polls during declared weather conditions is treated as expected degradation, not entropy failure.

---

## 4. Tournament State Machine

### 4.1 State Transitions

```
PRE_TOURNAMENT
     |
     | [Tournament director declares "Day 1 start"]
     v
TOURNAMENT_ACTIVE
     |
     |--- [Lightning warning issued] --> WEATHER_HOLD
     |                                       |
     |                                       | [All-clear]
     |                                       v
     |                               TOURNAMENT_ACTIVE (resumed)
     |
     | [Round completed]
     v
ROUND_COMPLETE
     |
     | [Next round begins] --> TOURNAMENT_ACTIVE
     |
     | [Final round complete]
     v
TOURNAMENT_COMPLETE
```

Each transition is a VENUE_OPERATOR or ENTERPRISE_ADMIN action that creates a L2 schedule phase entry with an explicit timestamp. The transition is auditable: who triggered it, when, and what the resulting corpus state was.

### 4.2 Leaderboard Integration

Tournament leaderboards are data-driven corpus content. The leaderboard data source (typically a tournament management system or manual scoring input) pushes updates to corpus variables on a per-group, per-hole basis. PRE resolves the leaderboard display from these corpus variables. The resolution is deterministic: given the scoring state at a timestamp, PRE produces the correct leaderboard display.

Leaderboard corpus variables: `current_leader`, `leading_score`, `top_5_scores`, `cut_line` (if applicable), `round_status`, `holes_completed_by_leader`.

If the leaderboard data feed fails during TOURNAMENT_ACTIVE state, the screen continues showing the last valid leaderboard. This is a MEDIUM entropy event (data feed failure) but not a constitutional crisis — the last valid leaderboard is better than a blank screen. The entropy alert notifies the tournament director who can arrange manual scoring updates.

### 4.3 WEATHER_HOLD Transition

When WEATHER_HOLD is declared:
- All outdoor screens: immediate transition to lightning warning content (L0 override)
- All indoor screens: advisory banner appears ("Course suspended — lightning in area") but normal content continues
- Pace-of-play information is suspended (moot during a hold)
- Tournament leaderboard continues updating if scoring is continuing
- Duration: until explicit all-clear by operator

WEATHER_HOLD transition latency requirement: outdoor screens must show lightning warning within one polling cycle (≤2 minutes) of the L0 context being set. For outdoor screens in areas with unreliable connectivity, the L6 cache must include a lightning warning asset that can be activated from the cached manifest if the screen cannot reach the backend.

---

## 5. Entropy Risk Patterns

| Content type | Entropy risk level | Detection threshold | Escalation |
|---|---|---|---|
| Tee sheet data stale | HIGH | 15 minutes | Alert to pro shop, head pro |
| Leaderboard data stale (tournament active) | MEDIUM | 20 minutes | Alert to tournament director |
| Lightning warning asset missing from outdoor cache | CRITICAL | Detected at overnight sync | Block screen deployment until resolved |
| Course conditions not updated by 8am | MEDIUM | 8am venue-local time on any operating day | Advisory to course superintendent |
| Cart screen battery/connectivity failure | MEDIUM | Standard outdoor missed-poll threshold | Advisory, field follow-up |
| Tournament context phase mismatch (active phase ≠ clock) | HIGH | Tournament schedule ± 30 minutes | Alert to head pro |

The most unusual entropy risk in this vertical is the lightning warning asset in cart and outdoor screen L6 caches. If the overnight sync fails to deliver the current lightning warning asset to outdoor screens, those screens cannot display the emergency content reliably during a weather event. The entropy scanner must explicitly verify lightning warning asset presence in outdoor screen L6 caches as part of the daily sync validation.

---

## 6. Operator Patterns

### 6.1 Head Pro

Manages tournament content workflow: announces tournament context phases, approves pairings and draw sheet content, manages result entry and leaderboard corrections. Typically operates from the pro shop terminal. During tournaments, the head pro is the primary operator for tournament state transitions.

### 6.2 F&B Manager

Manages clubhouse and restaurant screens: daily specials, dining promotions, bar content, event programming. Operates independently from tournament content workflow. A well-configured system means the F&B manager never needs to think about the tournament state — PRE handles the zone separation.

### 6.3 Course Superintendent

Manages course condition content: cart restrictions, temporary local rules, ground-under-repair notices. Typically enters conditions once per day at course opening and updates as needed. Does not need to understand the broader content system — condition entry is a single-purpose workflow.

### 6.4 Course Marshal

Field operator. Primary responsibility: lightning warning activation. Must be able to activate the weather emergency from a mobile device at any point on the course. This is the most latency-sensitive operator workflow in the vertical. The marshal is not a trained technical operator — the lightning warning UI must work on a first attempt, under pressure, in poor weather conditions.

---

## 7. Campaign Cadence

| Cadence | Typical content |
|---|---|
| Per-tournament | Tournament draw, pairings, sponsor recognition, prize schedule |
| Monthly | Member events, club socials, Sunday competition formats |
| Seasonal | Golf packages (summer twilight, winter green fee deals), membership drives |
| Equipment campaign | Pro shop promotions aligned with manufacturer product launches (typically spring/autumn) |
| Annual | Club championship, regional pennant, interclub competition schedule |

Tournament sponsors have L4 priority during tournament context. Manufacturer product campaigns (e.g., a new driver launch) are L3 campaigns in the pro shop zone and range zone. Member event campaigns are L3 for clubhouse and 19th hole zones.

---

## 8. Operational Examples

### Example A: Club Championship Day 2 (Private Club)

**Context:** Riverside Golf Club, member-owned private club. Club Championship, 54-hole stroke play. Day 2 of 3. 80 competitors, 8am shotgun start.

**7:00am — Pre-round setup:**
The head pro reviews the Day 2 draw (pre-entered on Day 1) and confirms it is displaying correctly on the 19th hole screen. Day 2 pairings asset is active. The previous day's final leaderboard is displayed alongside.

**7:30am — Course conditions entered:**
The course superintendent logs in and enters Day 2 conditions: "Ground under repair areas — yellow stakes mark GUR; preferred lies in own fairway." These appear immediately on the first tee screen and between-hole signage via PRE corpus variable update.

**8:00am — Shotgun start:**
Head pro transitions tournament context from PRE_TOURNAMENT Day 2 to TOURNAMENT_ACTIVE. First tee screen shifts from pairing display to pace-of-play and live conditions display. Leaderboard screens go live as scoring is entered group by group.

**10:15am — Lightning warning:**
Duty pro on course activates lightning warning from the ClubHub marshal app. All 12 outdoor screens (including 6 between-hole signs and 2 cart-mounted screens that are in coverage) transition to lightning warning content. Indoor screens show "Course suspended — lightning in area" advisory. The bar continues its normal F&B content with the advisory banner.

**10:45am — All-clear:**
Weather clears. Duty pro lifts the warning from the marshal app. Outdoor screens return to their resolved content (conditions, leaderboard). Play resumes. The 30-minute suspension is logged in the audit trail with operator ID, activation time, and lift time.

**4:30pm — Round complete:**
Head pro transitions tournament context to ROUND_COMPLETE. Leaderboard freezes at final round 2 scores. 19th hole screen shifts to Round 2 summary and Day 3 preview. Pro shop screens shift to Day 3 tee time information. Round 3 pairings are published — the head pro had pre-loaded them the previous day.

---

### Example B: Resort Course Daily Operations (Public Resort Course)

**Context:** Dunes Resort Golf Course, public resort course attached to a 4-star hotel. Mixed clientele: hotel guests, day visitors, society groups. No tournaments scheduled this week.

**7:30am — Daily corpus update:**
Overnight sync delivered updated tee sheet template, today's specials from F&B, and confirmed weather forecast (fine). Course superintendent enters today's conditions: all fairways open, cart path only on holes 3 and 7 (irrigation work). Conditions propagate to the first tee screen and between-hole signs for holes 3 and 7.

**8:00am — First group tees off:**
First tee screen updates: next group is the Morrison party (8:08 tee time). Pace indicator shows par pace. The resort F&B campaign (19th hole lunch special, two-course $45) is active on clubhouse screens. Pro shop screens show this week's equipment promotion (golf bag trade-in campaign).

**12:30pm — Busiest period (lunch rush at 19th hole):**
Restaurant screens are showing the lunch special campaign. Three society groups are finishing their rounds and arriving at the 19th hole simultaneously. The 19th hole screen shows: current leaderboard (society group scoring, entered manually by the pro shop), lunch special, and a happy hour teaser (starts 3pm). All three are active simultaneously — PRE resolves them into the rotation correctly.

**2:45pm — Weather deteriorates:**
A thunderstorm cell approaches. The course marshal activates lightning warning from the marshal app. All outdoor screens switch immediately. The first tee display (showing a group about to tee off) switches to lightning warning. Inside, the 19th hole advisory banner appears. The club pro makes a PA announcement. Groups shelter.

**3:30pm — Weather clears. All-clear lifted.**
The marshal lifts the warning. Outdoor screens resume. Several groups complete their rounds through the afternoon. By 5pm, the final groups have teed off. The first tee screen transitions to its after-hours state (club closed today at 6pm notice) automatically per the venue schedule.

---

### Example C: Pro-Am Tournament at Public Course (Tournament Sponsor Integration)

**Context:** Shoreline Golf Course, public course. Annual Pro-Am tournament. 20 professional and 60 amateur competitors. Tournament sponsor: Renault (automotive). Three-day event.

**Sponsor content setup (3 days prior):**
Enterprise admin uploads Renault sponsor assets. Sponsor contract at L4 targets tournament zones (19th hole, clubhouse bar, pro shop) for the three tournament days. Sponsor content includes branded leaderboard headers, Renault car display imagery for the 19th hole, and pro shop display content.

**Day 1, Tournament morning:**
Head pro activates PRE_TOURNAMENT context. Screens show Pro-Am draw, format information, and Renault branding in sponsor slots. Entry and foyer screens: tournament welcome and Renault partner recognition. Clubhouse bar: tournament draw and sponsor content.

**Day 1, 8am — Tournament active:**
TOURNAMENT_ACTIVE context declared. Leaderboard begins populating as scoring is entered. Renault sponsor content rotates in L4 slots on applicable screens. The sponsor sees their branding on all applicable screens throughout the event. The head pro has not needed to think about sponsor slot placement — the L4 contract specifies zones, times, and rotation frequency.

**Day 1, 5pm — First round complete:**
ROUND_COMPLETE declared. Day 1 leaderboard freezes. 19th hole screen: post-round leaderboard, Renault branding, prize fund information. The next day's order of play (pre-entered by head pro) is scheduled to activate at 7am tomorrow automatically.

**Day 3, 4pm — Tournament winner announced:**
TOURNAMENT_COMPLETE context declared. All applicable screens: final leaderboard, winner recognition, Renault partnership acknowledgment. Prize ceremony content plays on 19th hole screens. A post-event campaign (professional photos to be available tomorrow) is pre-scheduled to activate 24 hours later automatically. The Renault L4 contract expires at the end of the tournament day — sponsor content stops appearing in sponsor slots when the contract's `valid_until` timestamp passes.

---

## 9. Integration Points Outside PRE

| System | Interaction | Interface |
|---|---|---|
| Tournament management system | Scoring → leaderboard corpus variable updates | API push or corpus variable poll |
| Tee sheet / booking system | Tee time state → corpus variable updates | API integration, typically REST or webhook |
| Weather service / lightning detection | Lightning alert → operator notification (operator triggers warning manually) | Advisory only — operator is the trigger |
| AV broadcast infrastructure | Tournament broadcast (independent of PRE) | Independent system |
| POS / restaurant system | F&B specials (informational, manual entry) | Manual operator input |

Note: the weather integration is advisory. The system does not automatically activate a lightning warning based on a data feed — a human operator must make that call. This is intentional. Automated lightning warnings based on unreliable sensor data could cause unnecessary play suspension. The operator is the trigger; the platform makes the trigger fast and reliable.
