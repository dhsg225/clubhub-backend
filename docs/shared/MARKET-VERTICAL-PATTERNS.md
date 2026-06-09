# ClubHub TV — Market Vertical Patterns
# Shared Operational Intelligence Layer

**Document type:** Living canonical reference — append-oriented
**Authority:** Agent 2 (CMS/Operational Architecture)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design)
**Last updated:** 2026-05-22

---

## Purpose

This document provides detailed operational profiles for each market vertical where ClubHub TV operates. Each vertical has distinct content rhythms, operational urgency models, update expectations, sponsorship pressures, screen density requirements, and entropy patterns.

This document is NOT marketing analysis. It is operational intelligence for:
- Understanding why operators in each vertical behave as they do
- Designing UX that fits the operational context, not a generic CMS paradigm
- Understanding what PRE resolution behaviors matter most in each vertical
- Anticipating entropy patterns specific to each vertical's workflow

---

## Governing Philosophy

**Context shapes behavior.** A golf club operator and a sports bar operator are solving completely different problems with the same system. A UX designed for one context will produce entropy in the other. The vertical profiles in this document are the primary input to context-sensitive design decisions.

**Operational urgency is not uniform.** Some verticals (sports bars during live events, licensed clubs during special events) have high-urgency content workflows where minutes matter. Others (hotel lobbies, resort pools) have low-urgency workflows where content is set weekly or monthly. Design for the urgency profile of the operator, not the urgency profile of the most demanding case.

**Screen density is not uniform.** A sports bar may have 30 screens in a single room. A boutique hotel lobby has 1. The configuration model must support both without privileging either.

---

## Section 1 — Licensed Clubs

### 1.1 Operational Profile

**Vertical description:** Member clubs (golf clubs, RSL/veterans clubs, bowling clubs, racing clubs, football clubs) with gaming areas (EGMs/pokies), hospitality (bar, bistro, dining), and event spaces. Highly regulated. Strong member loyalty. Mix of entertainment, information, compliance, and promotional content.

**Regulatory context:** Licensed clubs operate under strict gaming and liquor regulations that require specific compliance signage in gaming areas. Content on screens adjacent to EGMs is subject to legal constraints in many jurisdictions. This creates a content zone where some content types are prohibited — a constraint the CMS must understand.

**Operator profile:**
- Venue manager: Often an experienced hospitality professional, not technology-first. High operational responsibility.
- Marketing coordinator: Sometimes dedicated to content management, sometimes a shared role.
- Gaming manager: Has authority over gaming area screens; may operate independently of general venue content team.
- Shift managers: High turnover, variable CMS competency.

**Screen count:** 10–120 screens per venue, across multiple distinct zones.

### 1.2 Zone Profiles

**Gaming zone (EGM area)**
- Content: Jackpot promotions, responsible gambling messages (legally mandatory), gaming product promotions, local events.
- Regulatory constraint: Responsible gambling messages must appear with mandated frequency (jurisdiction-specific, typically 30–60 minutes). Content promoting other venues' gaming is often prohibited.
- Attention model: LOW — patrons are focused on machines, not screens. Screens are ambient.
- Update frequency: Weekly for promotional content; real-time for jackpot values (if integrated).
- Entropy risk: HIGH — gaming managers often run separate content workflows, creating venue-level configuration inconsistency.

**Bar area**
- Content: Promotions, sports, upcoming events, member benefits, local community notices.
- Attention model: MEDIUM — social environment, intermittent attention.
- Update frequency: Daily to weekly.
- Entropy risk: MEDIUM — high shift manager override usage for "tonight's specials."

**Bistro / dining**
- Content: Menu, specials, upcoming dining events, soft promotional content.
- Attention model: MEDIUM — seated patrons have sustained but low-engagement attention.
- Update frequency: Weekly, with daily specials updates.
- Entropy risk: LOW — stable content with predictable update cycles.

**Function/event space**
- Content: Event-specific — can range from completely custom (wedding screen) to default venue promotional.
- Attention model: HIGH during events, ZERO when not in use.
- Update frequency: Event-driven — sometimes requires same-day change.
- Entropy risk: HIGH — emergency/override misuse common for event activation.

**Member lobby / foyer**
- Content: Member welcome, upcoming events, club achievements, community notices.
- Attention model: LOW — transient environment, brief dwell time.
- Update frequency: Weekly.
- Entropy risk: LOW.

### 1.3 Content Rhythms

**Daily cycle:**
- Morning (before 11am): Bistro breakfast/brunch menu. Low gaming promotional content.
- Midday: Lunch specials, upcoming evening events.
- Afternoon (2pm–5pm): Gaming promotion peak. Happy hour specials. Tomorrow's events.
- Evening (5pm–close): Maximum operational intensity. Sports content (if live events). Dinner specials. Live entertainment promos. Raffle promotions (typically 7pm–9pm).

**Weekly cycle:**
- Monday: Weekend event summary, week-ahead calendar.
- Wednesday: Mid-week promotion push (typically quietest night, needs traffic driver content).
- Friday: Weekend event promotion peak.
- Saturday: Live sport priority (if applicable). Event coverage.
- Sunday: Weekly member specials. Next week preview.

**Seasonal cycle:**
- School holidays: Family content, daytime family event promotion.
- Winter: Comfort food specials, indoor event promotion.
- Sporting seasons (football, racing): Sport-specific content priority, sponsor activation.
- End of financial year: Member benefit promotion, membership renewal content.

### 1.4 Sponsorship Pressure

**High.** Licensed clubs often have significant local business sponsor relationships (beer suppliers, food suppliers, gaming machine suppliers, local businesses). Sponsor content requirements:
- Regular rotation of brand-mandated supplier content (beer/food brands often have contractual display requirements).
- Local business sponsors expecting visible placement.
- Gaming machine suppliers expecting product content in gaming areas.
- SOV creep risk is HIGH — individual sponsor commitments accumulate.

### 1.5 Operational Urgency Model

**High for event activation, low for routine content.**
The urgency spikes are: pre-event content changes (same-day), raffle announcement integration (if digital), jackpot promotion (if integrated), and emergency/incident response.

Routine content (menus, weekly promotions) has a 24–72 hour planning window. Operators in this vertical are not accustomed to real-time content management outside of event contexts.

### 1.6 Characteristic Entropy Patterns

- **Override accumulation:** High. Shift managers use overrides extensively for same-night specials. Overrides from previous events persist.
- **Emergency misuse:** Medium. Emergency activation used for "member announcements" and event countdowns.
- **Campaign fragmentation:** Medium-High. Marketing coordinators often work independently of shift managers, creating parallel scheduling tracks.
- **Priority escalation:** Medium. Gaming managers create high-priority gaming content that persists past its intended promotional window.
- **Zone ownership conflict:** Unique to this vertical — gaming managers and general venue managers may both have authority over certain areas, creating conflicting schedules.

### 1.7 PRE Resolution Behaviors That Matter Most

- LEVEL_0 (Emergency) — used for genuine venue incidents (fire alarm, evacuation) AND misused for event activation.
- LEVEL_1 (Operational Override) — primary tool for shift managers.
- LEVEL_3 (Campaign) — the intended mechanism for weekly promotional cycles; often bypassed.
- Specificity targeting — screen-level targeting common (gaming zone screens vs bar screens must show different content).

---

## Section 2 — Golf Courses / Golf Clubs

### 2.1 Operational Profile

**Vertical description:** Golf clubs and courses with clubhouse facilities (pro shop, bar, dining, function space), course-facing display opportunities, and often tournament infrastructure. Content is a mix of operational information (tee times, weather), promotional, social, and tournament-specific.

**Operator profile:**
- Club manager / general manager: Sets content policy. Often not a regular CMS user.
- Pro shop manager: Manages tee time and course information content. Has specific operational needs around tee time pacing.
- Events coordinator: Manages tournament content. High urgency during tournament days.
- F&B manager: Manages restaurant/bar content independently.

**Screen count:** 4–30 screens in most clubs; larger facilities or tournament venues may have temporary additional screens.

### 2.2 Zone Profiles

**Clubhouse entrance / reception**
- Content: Welcome, tee time availability (if integrated), upcoming events, competition results.
- Attention model: MEDIUM — arriving golfers are purposeful but have a moment to check information.
- Update frequency: Daily during season; weekly off-season.

**Pro shop**
- Content: Equipment promotions, club merchandise, lesson offerings, tee time display (if integrated).
- Attention model: HIGH — transactional environment, engaged customers.
- Update frequency: Weekly for promotions; real-time for tee times (if integrated).

**19th hole bar / spike bar**
- Content: Post-round casual. Results display, sports, social content, upcoming club events.
- Attention model: MEDIUM-HIGH — social, relaxed, sustained attention.
- Update frequency: Weekly base; daily specials.

**Dining room**
- Content: Menus, specials, upcoming functions.
- Attention model: MEDIUM — seated, sustained low engagement.
- Update frequency: Weekly; special menu boards for events.

**Function room**
- Content: Event/tournament specific. Often custom per event.
- Attention model: HIGH during events.
- Update frequency: Event-driven.

**Course-facing screens (cart barn, halfway house, par 3 shelter)**
- Content: Sponsor branding, course rules, promotional, weather advisory.
- Attention model: VERY LOW — outdoor, transient, bright environment.
- Update frequency: Weekly to monthly. Weather integration desirable but not required.
- Technical constraint: Outdoor displays have brightness, weatherproofing, and network availability constraints.

### 2.3 Content Rhythms

**Competition days (typically weekends):**
- Pre-competition: Tee sheet display, competition format reminder, sponsor activation.
- During competition: Live leaderboard (if integrated), current leader display.
- Post-competition: Final results, nearest-the-pin/longest-drive results, prize presentation schedule.

**Non-competition days:**
- General operational information, upcoming event promotion, seasonal content.

**Tournament weeks:**
- Full content takeover for major tournaments. Custom branding, sponsor heavy rotation, leaderboard priority.
- Results update urgency is HIGH — golfers finishing 18 holes want results immediately.

**Seasonal patterns:**
- Peak season (spring/summer in temperate climates): Maximum operational intensity.
- Off-season: Minimal content management. Evergreen content with infrequent updates.
- Daylight saving transitions: Direct impact on morning tee time scheduling.

### 2.4 Sponsorship Pressure

**Medium-High.** Golf has significant sponsor culture — hole sponsors, major sponsors, equipment sponsors, food/beverage sponsors. Tournament sponsors expect prominent display.

**Specific sponsor challenge:** Hole sponsorship display at course-facing screens. Each hole sponsor expects their signage on the screen nearest their hole. This creates a per-screen specificity requirement (each screen nearest a hole must show that hole's sponsor) that is technically correct via screen-level targeting but operationally complex to manage across an 18-hole course.

### 2.5 Operational Urgency Model

**Bimodal:** Low urgency for routine content (weekly updates are fine), but HIGH urgency during competition and tournament operations. The events coordinator managing a tournament has real-time urgency — results, leaderboard, announcement content — while the general operations team has a relaxed weekly rhythm.

**Critical: tee time pacing.** If tee sheet integration is not available, operators manually display approximate pacing information ("Tee 1 at approximately 45 minutes — faster/on pace/slower"). This requires intra-day content updates that are operationally urgent in a low-urgency environment. The gap between the system's weekly-update rhythm and the pacing update need is significant.

### 2.6 Characteristic Entropy Patterns

- **Seasonal configuration abandonment:** Golf clubs may configure screens carefully at season start and make no changes for months. Configuration that was correct in spring may be incorrect by mid-summer.
- **Tournament override accumulation:** Tournament-day overrides (leaderboard, sponsor activation) are created for the tournament day and not removed. They persist into the following week.
- **Pro shop / F&B independence:** Pro shop and F&B operations often manage screen content independently, creating inconsistent zone coverage and occasional conflicts.
- **Unused campaign system:** Golf clubs tend to manage content directly (direct schedules) because their content team is small and campaign workflow has too many steps for occasional users.

### 2.7 PRE Resolution Behaviors That Matter Most

- LEVEL_3 (Campaign/Schedule) — primary resolution mechanism; override use is lower than in licensed clubs.
- Specificity targeting — per-screen targeting important for hole-specific sponsorship and zone differentiation.
- Seasonal schedule windows — time-bounded schedules for seasonal content transitions.
- Confidence score — important for tournament days where content must be verifiably correct.

---

## Section 3 — Hotels

### 3.1 Operational Profile

**Vertical description:** Accommodation properties ranging from budget to luxury, with lobby, dining, conference, pool, gym, and corridor screen opportunities. Content must serve multiple guest demographics simultaneously, often in multiple languages. Premium visual tone is non-negotiable in higher classifications.

**Operator profile:**
- Guest experience manager / marketing manager: Primary CMS operator. Thinks in terms of guest journey and brand standards.
- Front desk / concierge: May need to make urgent content changes (event announcements, weather alerts, local information). Often not CMS-trained.
- Conference/events coordinator: Manages conference room screens independently. High urgency during conferences.
- F&B manager: Manages restaurant/bar screens.

**Screen count:** 2–30 screens in typical hotel; large conference hotels may have 50+.

### 3.2 Zone Profiles

**Lobby / reception**
- Content: Welcome, property information, local area highlights, dining recommendations, event announcements, weather (if integrated), luxury brand content.
- Attention model: LOW — transient, guests focused on check-in process.
- Update frequency: Weekly for core content; daily for event/weather integration.
- Tone requirement: Premium, calm, brand-consistent. No aggressive promotional content.

**Elevator lobbies / corridors**
- Content: Property amenities, local area information, F&B promotions.
- Attention model: VERY LOW — brief dwell, passing attention only.
- Update frequency: Monthly.

**Restaurant / bar**
- Content: Menus, wine list, daily specials, local experiences, events.
- Attention model: MEDIUM — seated, relaxed.
- Update frequency: Weekly; daily specials.

**Gym / pool area**
- Content: Motivational, property information, local experiences, class schedules.
- Attention model: LOW — activity-focused, intermittent glances.
- Update frequency: Weekly.

**Conference rooms**
- Content: Client's custom content, event agenda, sponsor branding, property Wi-Fi information.
- Attention model: HIGH — meeting context, active attention.
- Update frequency: Per-event. Real-time urgency during conferences.
- Technical note: Conference rooms often run independently of the main content system, with clients providing their own display content. The ClubHub system may manage "between meetings" or "welcome" states.

### 3.3 Content Rhythms

**Daypart model:**
- 6:00–10:00 (Breakfast): Breakfast menu dominant. Morning news integration desirable. Warm, welcoming tone.
- 10:00–12:00 (Late morning): Activity recommendations, tour promotions, property amenities.
- 12:00–15:00 (Lunch): Lunch menu, local area highlights, afternoon activity options.
- 15:00–18:00 (Afternoon): Check-in window — lobby content peaks. Welcome messaging.
- 18:00–22:00 (Evening): Dinner recommendations, evening entertainment, property bar promotion.
- 22:00+ (Late): Minimal content. Ambient/brand-consistent.

**Seasonal patterns:**
- Peak season: Tourism-focused content. Local events and attractions prominent.
- Off-season: Business travel focus. Conference capabilities, loyalty program.
- Holidays: Festive tone, special packages.
- Local events (festivals, sports, conferences): Guest-relevant content around local events.

### 3.4 Multilingual Requirements

Hotels serving international guests have multilingual content needs that the current ClubHub model doesn't natively support. This is an important design gap:

**Current state:** Content items are single-language. Multilingual display requires either (a) separate content items per language with manual scheduling, or (b) content items that are designed to be multilingual (e.g., animated slides with multiple language panels).

**Operator expectation:** "Show this in English, French, and Japanese, rotating every 10 seconds." The current model requires three separate content items and schedule configuration to achieve this — significantly more complex than operators expect.

**UX implication:** Multilingual content management is a gap that will cause significant operator frustration in hotel deployments. This must be addressed in future platform design or clearly documented as a limitation requiring workaround workflows.

### 3.5 Sponsorship Pressure

**Low.** Hotels are generally resistant to third-party advertising that conflicts with brand standards. Sponsorship is more likely to appear as: local experience partners (tour operators, restaurants, activities), loyalty program partner brands, and conference sponsor content (managed per-event, not via ongoing contracts).

### 3.6 Operational Urgency Model

**Low baseline, HIGH for conference/events.**
Routine hotel content has a 1-week planning horizon. Conference content can be event-day urgent — the conference coordinator may need to update room screens an hour before a session starts. This creates a workflow that requires simple, fast, device-level content management for conference coordinators who are not CMS-trained.

### 3.7 Characteristic Entropy Patterns

- **Low active management:** Hotel operators often set content and return infrequently. Staleness (M-11/M-12) accumulates rapidly — screens may show out-of-date event information, expired F&B promotions, or seasonal content past its end date.
- **Conference room independence:** Conference rooms operated outside the main CMS create configuration islands — screens that may not reflect venue-wide emergency states or brand standards.
- **Multilingual schedule explosion:** Attempting multilingual content via multiple schedules creates severe campaign fragmentation and shadow scheduling.

---

## Section 4 — Restaurants and Bars

### 4.1 Operational Profile

**Vertical description:** Independent restaurants, bar venues, and food/beverage-primary operations. Content is primarily F&B promotional, entertainment, and atmosphere-building. Often high-energy environments with demanding immediacy expectations.

**Operator profile:**
- Owner/manager: Often the primary CMS operator. May be the only operator. Strong opinions about content. Low tolerance for complexity.
- Bar manager: May manage bar screens independently. Prioritizes entertainment content.
- Marketing assistant: Sometimes exists in larger operations.

**Screen count:** 1–15 screens.

### 4.2 Content Rhythms

**Daily cycle:**
- Lunch service: Lunch specials dominant.
- Mid-afternoon: Happy hour buildup. Specials countdown content if applicable.
- Evening service: Dinner specials, cocktail menu, live entertainment (if applicable), sports (if sports bar).
- Late night: Entertainment dominant, minimal food content.

**Weekly cycle:**
- Weekly specials change is the primary configuration event.
- Events (trivia nights, live music, sports broadcasts) drive temporary content changes.

### 4.3 Critical Operational Need: Speed

Restaurants and bars need to change content FAST. "We just got a delivery of fresh barramundi — I need to add a special right now" is a real workflow. The CMS must support a 60-second workflow from "I have a new special" to "it's on screen." Multi-step campaign creation is a significant barrier here.

### 4.4 Characteristic Entropy Patterns

- **Highest direct-schedule usage of any vertical** — campaign system is almost universally bypassed.
- **Highest override frequency of any vertical** — override is the default tool.
- **Permanent overrides universal** — no expiry dates set as standard practice.
- **Single operator, no review** — no second person to catch configuration errors.
- **Seasonal staleness** — promotional content from previous seasons persists.

---

## Section 5 — Sports Bars

### 5.1 Operational Profile

**Vertical description:** Venues with sport as the primary entertainment driver. Content must be reactive to live events. Screen experience is part of the venue's core value proposition — poor content management directly affects revenue.

**Screen count:** 10–50+.

### 5.2 Live Event Content Requirements

Sports bars have a content management workflow that no other vertical requires: **live event content coordination.**

This involves:
- Pre-game: Matchup information, betting odds (where legal), sports news.
- During game: Live broadcast on primary screens (typically not ClubHub-managed — direct TV input), promotional content on secondary/peripheral screens.
- Half-time/breaks: Maximum promotional intensity (food, beverage specials, competition entry).
- Post-game: Results, highlights, next event preview.

The ClubHub system manages the peripheral and secondary screens, not the primary live broadcast screens. The coordination between live broadcast screens and ClubHub-managed screens is an operational gap that must be addressed.

### 5.3 Operational Urgency Model

**Highest urgency of any vertical.** Sports bars operate in real-time. Content must change at half-time, at the final whistle, when a team scores, when a match is over-running. The 15-second poll cycle is adequate for most operational changes, but operators perceive it as "delay."

### 5.4 Characteristic Entropy Patterns

- **Extreme override usage** — operators override for every event. No expiry dates.
- **Priority escalation** — live content always gets maximum priority. Historic schedules never get cleaned up.
- **Emergency misuse peak** — emergency activation is the de facto "broadcast now" tool.
- **Sponsor saturation** — sports rights sponsors and betting brands accumulate aggressively.

### 5.5 PRE Considerations

Specificity targeting is critical — screens in "game zone 1" show different content from screens in "family dining section" even during the same live event. Per-screen and per-group targeting must be fast and reliable.

---

## Section 6 — Resorts and Multi-Venue Properties

### 6.1 Operational Profile

**Vertical description:** Large resort complexes with multiple distinct operational areas: pool, beach, gym, restaurant, bar, lobby, spa, activity center. Often internationally staffed, mixed-language environment.

**Screen count:** 20–200+.

### 6.2 Key Operational Challenge: Zone Sovereignty

Resort operations have clear zone ownership — the pool bar manager owns the pool bar screens, the spa director owns the spa screens. This creates a genuine case for decentralized content management where each zone manager has authority over their zone, without affecting others.

The ClubHub area/venue hierarchy supports this model but requires careful configuration. The entropy risk is high when zone managers operate independently without coordination — sponsorship contracts, org-level campaigns, and emergency activations must all be understood by zone managers to avoid conflicts.

### 6.3 Operational Urgency by Zone

- **Front entrance / lobby:** LOW urgency. Set weekly or monthly.
- **Pool / beach:** MEDIUM urgency. Daily specials, weather-reactive content.
- **Restaurant / bar:** MEDIUM-HIGH urgency. Meal-period content changes.
- **Event spaces:** HIGH urgency. Event-specific content may change hourly.
- **Activity center:** LOW urgency. Program schedules updated weekly.

### 6.4 Characteristic Entropy Patterns

- **Zone isolation divergence** — zone managers create independent configurations that are consistent within each zone but inconsistent with the venue-wide org-level campaigns.
- **High priority range width** — different zones escalate priorities independently, producing venue-wide priority inflation.
- **Multilingual complexity** — resorts serving international guests have the highest multilingual content management burden.

---

## Section 7 — Community Venues and Waiting Areas

### 7.1 Operational Profile

**Vertical description:** Community centers, libraries, medical waiting rooms, council buildings, sports club changerooms, and similar public-interest venues. Content is primarily informational — community announcements, service information, health information.

**Operator profile:** Often volunteers or part-time staff with minimal technical training. High staff turnover. CMS operated infrequently.

**Screen count:** 1–10.

### 7.2 Operational Characteristics

**Lowest commercial urgency of any vertical.** Content may be set once and not changed for weeks. Entropy accumulates through inaction, not misuse — staleness (M-11/M-12) is the dominant pattern.

**Highest staff turnover of any vertical.** The original CMS operator often leaves without training a replacement. The next person to operate the system learns by trial and error, often reinforcing incorrect mental models.

**Highest importance of training materials.** Simple, step-by-step guides are the primary support mechanism.

### 7.3 Specific Content Requirements

- Community event announcements with date/time critical expiry.
- Service hours and contact information (high accuracy requirement).
- Emergency/public health messages (during community incidents).
- Accessibility information (often a legal requirement).

### 7.4 Characteristic Entropy Patterns

- **Highest staleness rate of any vertical** — screens frequently display outdated information (past event dates, expired service hours, seasonal content out of season).
- **Single operator, no oversight** — no peer review of content.
- **Lowest CMS usage frequency** — changes made months apart.

### 7.5 PRE Considerations

Staleness detection (M-11, Screen Staleness Rate) is the most critical entropy signal for this vertical. A community venue showing an event announcement from six months ago is a real operational failure that goes unnoticed because nobody is actively managing the system.

---

## Section 8 — Cross-Vertical Comparison Matrix

### 8.1 Content Urgency Matrix

```
Vertical              | Routine Urgency | Peak Urgency | Peak Trigger
──────────────────────┼─────────────────┼──────────────┼─────────────────────
Licensed Club         | Low             | HIGH         | Live events, raffles
Golf Club             | Low             | HIGH         | Tournament days
Hotel                 | Low             | HIGH         | Conference events
Restaurant/Bar        | MEDIUM          | HIGH         | New specials, bookings
Sports Bar            | HIGH            | CRITICAL     | Live sport
Resort                | Low-Medium      | HIGH         | Activity events
Community Venue       | Very Low        | Medium       | Community incidents
```

### 8.2 Override Usage Propensity

```
Vertical              | Override Frequency | Emergency Misuse Risk
──────────────────────┼────────────────────┼─────────────────────
Licensed Club         | HIGH               | MEDIUM
Golf Club             | LOW                | LOW
Hotel                 | LOW                | MEDIUM (conference)
Restaurant/Bar        | VERY HIGH          | LOW
Sports Bar            | VERY HIGH          | HIGH
Resort                | MEDIUM             | LOW
Community Venue       | VERY LOW           | VERY LOW
```

### 8.3 Campaign System Adoption Likelihood

```
Vertical              | Campaign Adoption | Reason for Adoption/Bypass
──────────────────────┼───────────────────┼───────────────────────────────
Licensed Club         | MEDIUM            | Marketing coordinator drives adoption
Golf Club             | LOW               | Infrequent operator, too many steps
Hotel                 | MEDIUM            | Guest experience team follows process
Restaurant/Bar        | VERY LOW          | Speed requirement drives direct schedule
Sports Bar            | VERY LOW          | Urgency drives direct schedule and override
Resort                | MEDIUM            | Multiple zone managers, some follow campaign
Community Venue       | VERY LOW          | Infrequent operator, minimal training
```

### 8.4 Sponsor Saturation Risk

```
Vertical              | SOV Risk Level | Primary Sponsor Pressure
──────────────────────┼────────────────┼──────────────────────────────
Licensed Club         | HIGH           | Supplier contracts, gaming, local biz
Golf Club             | MEDIUM-HIGH    | Hole sponsors, equipment sponsors
Hotel                 | LOW            | Experience partners only
Restaurant/Bar        | MEDIUM         | Food/beverage supplier deals
Sports Bar            | HIGH           | Sports rights sponsors, betting
Resort                | MEDIUM         | Pooled experience/activity partners
Community Venue       | VERY LOW       | Grant-funded messaging only
```

### 8.5 Entropy Dominant Pattern by Vertical

```
Vertical              | Primary Entropy Pattern
──────────────────────┼──────────────────────────────────────────────────
Licensed Club         | Override accumulation + emergency semantic collapse
Golf Club             | Seasonal staleness + tournament override persistence
Hotel                 | Staleness + multilingual complexity + zone isolation
Restaurant/Bar        | Override permanence + campaign bypass + staleness
Sports Bar            | Emergency misuse + priority escalation + SOV saturation
Resort                | Zone isolation + priority divergence + multilingual
Community Venue       | Staleness (dominant, often severe)
```

---

*End of MARKET-VERTICAL-PATTERNS.md v1.0*
*Append new vertical profiles and update existing profiles as deployment experience accumulates.*
*Each vertical profile should be reviewed after the first 3 deployments in that vertical.*
