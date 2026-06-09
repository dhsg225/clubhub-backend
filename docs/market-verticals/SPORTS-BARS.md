# ClubHub TV — Market Vertical: Sports Bars

**Document type:** Operational profile
**Vertical:** Sports bars — standalone venues and chains
**Status:** Reference
**Last updated:** 2026-05-26

---

## 1. Vertical Overview

Sports bars are high-energy, sport-schedule-driven venues where content timing is tied directly to fixture events. The operational rhythm of a sports bar is set by the fixture calendar — not the clock, not the season. On a Thursday with no fixtures, the bar is quiet and promotional content dominates. On a Saturday with three simultaneous major sporting events, every screen matters and every minute of pre-game promotion is commercially valuable.

A critical architectural boundary: ClubHub TV does NOT manage sports broadcast content. The live television broadcast (AFL, NRL, Premier League, Champions League, Formula 1) is managed by the venue's AV switching infrastructure — an entirely separate system. PRE manages all non-broadcast screens: fixture lists, game day promotions, food and drink specials, menu boards, foyer screens, and bar-top informational displays. This boundary must be understood clearly by operators and must be stated clearly in operator onboarding materials.

The operational simplicity of sports bars is both a strength and a risk. Compared to licensed clubs (compliance-heavy) or hotels (conference complexity), sports bars have relatively straightforward content requirements. The risk is that operators in this vertical may be less disciplined about corpus hygiene — fixture data gets stale, old campaigns persist, outdated specials appear on menu boards. Entropy monitoring must be configured assertively for this vertical even though the stakes are not regulatory.

---

## 2. Operational Priorities

### 2.1 Fixture Schedule

The fixture list is the primary informational content the venue's screens must display accurately. Patrons use the fixture screens to determine which sport is showing on which screen and at what time. An inaccurate fixture list (showing a game that has been rescheduled, missing a late addition) degrades the patron experience directly.

Fixture data integration:
- Fixture data is updated in the corpus when schedules are confirmed or change
- The update may be manual (operator enters fixtures) or via feed integration (fixture data API → corpus variable update)
- Entropy detection threshold for fixture data: if the fixture list has not been updated within 48 hours for a venue that has screens actively showing fixtures, this is a MEDIUM entropy event
- Rescheduled fixtures: the operator must update the corpus manually or via the feed integration when a fixture is rescheduled. This is the most common source of entropy in this vertical.

### 2.2 Game Day Mode

When a major fixture is approaching, the venue's content shifts to a higher-energy promotional mode:
- "Game Day" L3 campaign activates 3–4 hours before kickoff
- Bar-top and feature screens emphasize the upcoming game
- Food and drink specials tied to the fixture (game day combo deals) activate on menu boards
- Post-game content (score/result follow-up) is pre-built and activated by the operator after the final whistle

Game Day mode is not automatic — the operator must activate the appropriate campaign. This is deliberate: fixture schedules change, games get cancelled, and the venue may want to customize which fixtures get Game Day treatment versus which are treated as regular programming. A Champions League final gets full Game Day activation; a Thursday night Bundesliga match may not.

### 2.3 Food and Drink Specials

Happy hour, game day combo deals, and weekly specials are L3 campaign content for menu board screens and promotional displays. Time-of-day constraints are applied via L2 schedule entries (happy hour: 4pm–6pm Monday–Friday). The shift manager activates game day specials manually as needed.

Menu board accuracy is important but not at the regulatory level of a QSR restaurant (see RESTAURANTS.md). A sports bar menu board that shows an expired special is an operational nuisance; it is not a regulatory compliance failure. Entropy monitoring flags stale menu board content as MEDIUM rather than HIGH.

### 2.4 Crowd-Oriented Content

Sports bars operate with high ambient noise, patron movement, and divided attention. Content must be:
- Readable at distance (high contrast, large text)
- Short-duration (patron attention is not sustained)
- Emotionally congruent with the sporting context (high energy before a big game, celebratory after a home team win)

The content design principles are outside PRE's scope, but the corpus management implications are not: the vertical needs assets designed for this environment, and the corpus must be reviewed to ensure that brand/default content (L5) at rest periods is appropriate for a sports bar environment — the L5 fallback should not be hotel-lobby-style ambient video.

---

## 3. Screen Zones and Behavior Profiles

| Zone | Content profile | Primary resolution levels |
|---|---|---|
| Bar-top / feature screens | Fixture lists, upcoming games, promotions, game day content | L2, L3, L4, L5 |
| Menu boards | Food/drink items, specials, game day deals | L2, L3, L5 |
| Foyer / entrance | Today's games, booking info, promotions, draw-in content | L3, L5 |
| Outdoor / window | Big match tonight, promotions, brand draw-in | L3, L5 |

Note: live sports broadcast screens (TVs showing the actual game) are AV switching infrastructure, not ClubHub-managed screens. Operators must not confuse these two populations of screens.

### 3.1 Broadcast vs. PRE-Managed Screens

In a typical sports bar deployment:
- 12 large TVs along the bar and feature wall: AV switching, not PRE-managed
- 4 bar-top screens (embedded in bar furniture): PRE-managed (fixture info, promotions)
- 2 menu board screens above bar: PRE-managed
- 1 foyer screen: PRE-managed
- 1 window-facing screen: PRE-managed

The venue configuration must clearly mark AV-managed screens as outside PRE scope. Operators must understand this distinction during onboarding.

---

## 4. The "Game Day" Campaign Pattern

Game Day is the signature operational pattern for this vertical. A well-run sports bar has a library of pre-built Game Day campaigns ready to activate — not just one generic campaign, but sport-specific and event-specific campaigns:

| Campaign | Trigger | Duration |
|---|---|---|
| AFL Finals Game Day | Operator activation 4h before bounce | Until 30 min after final siren |
| NRL State of Origin Game Day | Operator activation 4h before kickoff | Until 30 min after final siren |
| Champions League Final Game Day | Operator activation 4h before kickoff | Until 30 min after final whistle |
| Generic Game Day (fallback) | Operator activation any time | Operator-specified duration |
| Post-Game Win | Operator activation at final whistle | 45 minutes |
| Post-Game Loss | Operator activation at final whistle | 30 minutes |

Pre-and-post-game templates are the operational efficiency win for this vertical. An operator who has to design result content after a 90-minute game at 11pm will not do it well. Templates built in advance, activated with one tap, are the correct approach.

Campaign library management is an ENTERPRISE_ADMIN or REGIONAL_MANAGER responsibility for chains. For independent sports bars, the owner-operator builds and maintains their own library. The platform should not require operators to recreate the same campaign structure repeatedly — saved campaign templates with variable substitution (team name, kickoff time) are the correct UX pattern.

---

## 5. Entropy Risk Patterns

| Content type | Entropy risk level | Detection threshold | Escalation |
|---|---|---|---|
| Fixture data stale | MEDIUM | 48 hours without update | Advisory to venue operator |
| Expired Game Day campaign still active | MEDIUM | Campaign `valid_until` + 30 minutes | Advisory to shift manager |
| Menu board prices mismatched (if POS integration active) | MEDIUM | At sync cycle | Advisory to venue operator |
| Fixture data shows cancelled fixture | MEDIUM | Flag if fixture marked cancelled in feed | Operator notified to update |
| Post-game campaign not activated (major fixture) | LOW | Advisory only — system cannot know outcome | No automated escalation |

### 5.1 Fixture Data Freshness

The 48-hour entropy threshold is a starting point. A venue that receives fixtures from a live API integration may have a much tighter threshold (6–12 hours). A venue that updates fixtures manually may need more tolerance. The threshold is configurable per venue.

### 5.2 Campaign Expiry Drift

Game Day campaigns sometimes get left active after the game ends because the shift manager is busy. The `valid_until` timestamp on the campaign handles automatic deactivation — but only if the operator set it correctly. If the campaign was created without a `valid_until`, it persists indefinitely. The entropy scanner detects campaigns that appear to be stale based on their content metadata (game day content for a game that has already been played, based on the fixture timestamp embedded in the asset). This is a heuristic, not a hard rule — it generates an advisory for the operator to review.

---

## 6. Operator Patterns

### 6.1 Shift Manager (Day-to-Day Operations)

The shift manager is the primary operator for sports bars. Responsibilities:
- Activating happy hour and daily specials at the correct times
- Activating Game Day campaigns before major fixtures
- Updating the fixture list when schedules change
- Activating post-game result content
- Handling venue emergencies (patron incidents)

The shift manager is typically not a technical user. The operator interface must be optimized for single-purpose workflows: "Activate Game Day for X fixture" should be one or two actions, not a multi-step campaign configuration flow.

### 6.2 Marketing (Campaign Management)

In chain venues, a marketing team manages the campaign library at the ENTERPRISE_ADMIN or REGIONAL_MANAGER level. They create Game Day templates, seasonal campaigns, promotional content, and sponsor materials. The shift manager activates from this library — they do not create content.

For independent sports bars, the owner-operator typically wears both hats. The platform must be operable by a single person managing everything.

### 6.3 Owner/Operator (Independent Venues)

Independent sports bars have one person responsible for everything: content creation, campaign management, operational activation, and IT troubleshooting. The platform must minimize the cognitive overhead for this operator. Templates, pre-built campaign patterns, and simple activation workflows are more important in this vertical than in chains with dedicated marketing teams.

---

## 7. Campaign Cadence

| Cadence | Typical content |
|---|---|
| Weekly (fixture-driven) | Weekly fixture list update, upcoming big matches, weekly specials |
| Event-driven | Game Day activation for major fixtures, post-game result content |
| Seasonal | Footy season opener campaigns, finals campaigns, international tournament campaigns |
| Promotional | Broadcast rights campaigns ("Watch the Champions League here"), new menu launches |
| Annual | Christmas/NYE programming, major annual sporting event campaigns (World Cup, Olympics) |

Broadcast rights promotions deserve particular attention: when a venue acquires rights to show a major tournament (AFL rights, Premier League package), the marketing around it is a significant commercial opportunity. The campaign library should include ready-to-activate templates for each major broadcast rights package the venue holds.

---

## 8. Operational Examples

### Example A: NRL Grand Final Night at a Chain Sports Bar

**Context:** The Final Whistle (chain sports bar, 6 venues). NRL Grand Final Sunday. The chain's marketing team has prepared in advance.

**2 weeks prior:**
ENTERPRISE_ADMIN creates the "NRL Grand Final Game Day" campaign with placeholder team names (to be confirmed when finalists are known). When the finalists are confirmed 10 days before, REGIONAL_MANAGER updates the campaign assets with team logos and team-specific promo copy. The campaign is set as SHADOW_ONLY canary for review.

**Friday before:**
Campaign promotes to SINGLE_VENUE — one venue runs the Grand Final campaign in preview for 48 hours. Marketing reviews remotely via the preview dashboard. Looks correct. Approved for FLEET_WIDE.

**Grand Final Sunday, 12pm — 5 hours before kickoff:**
Shift managers at all 6 venues receive the notification in the operator app: "Grand Final Game Day campaign ready to activate. Kickoff: 5:00pm." Each manager activates in their venue at their discretion (some may wait until 2pm). The activation is a single-action operation.

**5pm — Game starts:**
AV switching infrastructure handles the NRL broadcast. PRE manages bar-top screens (live score updates from corpus variable, if integrated; otherwise static game branding), menu boards (Grand Final combo deals active), and foyer screens (Grand Final branding, parking/transport advisory).

**7:45pm — Final siren:**
The home team wins. Each shift manager activates the "Post-Game — Win" template (pre-built, stored in campaign library). This displays celebratory content on feature screens for 45 minutes. At two venues, the visiting team's fans are present — those shift managers activate the "Post-Game — Match Result" template instead (neutral tone). The enterprise campaign library includes both variants.

**8:30pm — Campaign expires:**
The Grand Final campaign's `valid_until` passes. Screens return to standard programming. The next day, ENTERPRISE_ADMIN reviews the campaign performance audit log: which venues activated at what time, how many screens were affected, any entropy events during the campaign.

---

### Example B: Independent Sports Bar — Weekly Operations

**Context:** The Stadium Bar, independent sports bar, owner-operated. The owner manages everything including ClubHub TV.

**Monday — Fixture update:**
The owner checks the week's fixture schedule. Three major fixtures this week: Wednesday night Champions League (two games), Friday NRL (two games), Saturday AFL (three games, one a local club game). The owner updates the weekly fixture list in the corpus — a form-based input that generates the fixture schedule asset. Takes 10 minutes.

**Monday — Weekly specials:**
The owner creates the weekly happy hour campaign (Tuesday–Thursday, 4–6pm: $5 schooners, $10 nachos) and the weekend game day combo deal (Saturday–Sunday: $18 parma + pint). These are built from templates he saved last month — he changes the dates and the prices, saves, and publishes.

**Wednesday, 1pm — Champions League setup:**
The owner activates the Champions League game day campaign from his library. Feature screens shift to Champions League branding, bar-top screens show the two match fixtures and kickoff times. He adds a menu board special (Champions League deal: garlic bread + pint $14, active 4pm–midnight).

**Wednesday, 10:30pm — Games end:**
The owner activates the results from his phone (the operator app). He enters the two match scores — the corpus variables update, and result content appears on bar-top screens for 30 minutes. He sets the Champions League campaign to expire at midnight.

**Saturday — AFL Day:**
The owner activates the AFL Game Day campaign at 10am (first bounce is noon). The local club game gets a special callout — the owner adds a custom overlay using a pre-built template: "Go [Club Name]! Game 2, 2:10pm." This is a VENUE_OPERATOR override at SPECIFICITY_4, targeting the feature screen TV group. The custom callout appears alongside the standard AFL Game Day content in the rotation.

After all three games, the owner activates the combined results summary — a template that shows all three scores. The AFL Game Day campaign expires at 8pm automatically.

---

## 9. Integration Points Outside PRE

| System | Interaction | Interface |
|---|---|---|
| Fixture data provider | Fixture schedule → corpus update | Manual entry or API feed integration |
| AV switching / smart TV infrastructure | Live sports broadcast (independent of PRE) | Independent AV system |
| POS system | Menu items and prices (optional integration) | Manual input or API sync |
| Broadcast rights management | Which packages the venue holds (informational) | Manual operator knowledge |

The fixture data integration is the most impactful optional integration in this vertical. Venues with a live fixture API integration have dramatically lower fixture entropy risk — the corpus updates automatically when schedules change. Venues relying on manual fixture entry have higher entropy risk and need more assertive entropy monitoring and operator reminders.
