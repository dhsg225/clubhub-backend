# ClubHub TV — Market Vertical: Community Venues

**Document type:** Operational profile
**Vertical:** Community venues — recreation centers, community clubs, bowling clubs, civic venues
**Status:** Reference
**Last updated:** 2026-05-26

---

## 1. Vertical Overview

Community venues are the most operator-constrained environment in the ClubHub TV platform's market. The defining characteristic is not content complexity — it is operator capacity. A recreation center with twelve screens may be managed by a single person who is also responsible for reception, facility booking, event coordination, and staff scheduling. A bowling club's screens may be configured by a volunteer committee member who has limited technical confidence.

The platform's obligations in this vertical are different from those in licensed clubs or hotel chains. The system must be trustworthy without requiring the operator to understand it. A community venue operator who is not engaging with the platform regularly — who updates content once a week or less — must be able to trust that the system is running correctly in between. This means:

- Robust L5 defaults that are always appropriate for the venue context
- Low-maintenance scheduling (weekly recurring patterns, not daily configuration)
- Entropy monitoring that surfaces problems clearly without requiring technical interpretation
- Emergency workflows that work for a non-technical operator under pressure
- Template-driven content that requires minimal local customization

The constitutional guarantees of the platform (deterministic resolution, auditable state, no silent failures) are particularly valuable in this vertical precisely because operator oversight is infrequent. The operator doesn't check the screens every hour — but they need to know that the screens are running correctly when they don't.

---

## 2. Operational Priorities

### 2.1 Program Schedule

The activity schedule is the primary informational content at most community venues. Patrons arrive wanting to know: what is on today, in which space, at what time. The schedule display must be accurate. Inaccuracy (an activity shown as active when it has been cancelled, or a room booking shown as available when it is occupied) erodes patron trust and generates reception queries.

Program schedule is L2 content: venue schedule entries for each activity type, space, and time slot. For a recreation center:
- Pool lane schedule: lap swimming sessions, squad training, learn-to-swim classes, aqua aerobics
- Gym: class schedule (yoga, Pilates, circuit, spin)
- Courts: court hire bookings, club training sessions
- Main hall: functions, events, community meetings

These schedules are typically entered weekly. The operator sets up the recurring weekly template once and updates exceptions (public holiday changes, cancelled sessions, special events) as they arise.

### 2.2 Community Notices

Community notices are a distinct content type from the program schedule. They include:
- Local council announcements
- Club committee notices (AGM dates, fee changes, rule changes)
- Lost and found
- Upcoming community events (fete, school holidays program, holiday closure)
- Sponsorship acknowledgments

Community notices are L3 campaign content: the operator creates a notice with a start date and end date, and it appears in the rotation until it expires. The operator does not need to manually remove notices — the `valid_until` timestamp handles deactivation.

The notice board screen zone is the primary home for this content. Other zones (reception, cafe) may show notices in their rotations at lower priority.

### 2.3 Booking / Space Availability

Many community venues show space availability information on screens near activity areas: "Court 3 — Available until 4pm | Booked from 4pm." This is a corpus variable driven by the venue's booking system (if integrated) or by manual operator update.

Accuracy requirements: space availability information must be current within 30 minutes. A patron who sees "Court 3 — Available" and walks to Court 3 to find it occupied has had a bad experience and will return to reception to complain. This is a MEDIUM entropy event if the booking data is stale by more than the configured threshold.

### 2.4 Low Operational Complexity Design

The primary design constraint for this vertical is reducing operator cognitive overhead:

- **Template-heavy:** The enterprise or regional body maintains master templates for each venue type. A recreation center gets a recreation center template; a bowling club gets a bowling club template. The operator customizes within that template — they do not design content from scratch.
- **Recurring patterns:** Schedule entries use weekly recurrence rules rather than daily entry. The operator sets up Monday's pattern once; it recurs automatically.
- **Sensible defaults:** L5 default content is community-appropriate — facility information, safety notices, community organization branding — not generic stock photography.
- **Minimal required actions:** The operator should need to do something in the platform no more than once a week for routine operations. Exceptions (cancelled session, special event) take five minutes each.

---

## 3. Screen Zones and Behavior Profiles

| Zone | Typical location | Content profile | Primary resolution levels |
|---|---|---|---|
| Reception / Entry | Front entrance | Welcome, today's program, facility info, community notices | L2, L3, L5 |
| Activity areas | Poolside, gym floor, court entry | Area-specific schedule (pool schedule, class schedule), safety notices | L2, L5 |
| Cafe / Canteen | Cafe seating or counter | Menu board, specials, community notices | L3, L5 |
| Notice board screens | Common areas, corridors | Community announcements, local events, club notices | L3, L5 |

### 3.1 Activity Area Screen Requirements

The activity area screen must show content relevant to that specific space. A screen at the pool entrance must show the pool schedule, not the gym class schedule. This is managed by area targeting in PRE: the pool area ID is associated with pool-schedule L2 content; the gym area ID is associated with gym-schedule L2 content. When an operator creates the weekly pool schedule, they target it at the `pool` area. It never appears on gym or court screens.

This zone separation is a critical safety property: a "POOL CLOSED — Maintenance" notice that appears on the gym screen instead of the pool entrance screen is worse than useless.

---

## 4. Constitutional Implications for This Vertical

### 4.1 Simplified Resolution Stack

Most community venues do not use the full PRE resolution hierarchy. Active levels for a typical community venue:

| Level | Usage |
|---|---|
| L0 | Emergency (required — always active potential) |
| L1 | Typically not active (no gambling, liquor license conditions, or regulatory compliance requirements for most community venues) |
| L2 | Venue schedule (activity schedule, special events) |
| L3 | Community notices, cafe specials, seasonal campaigns |
| L4 | Sponsor acknowledgments (local business sponsors, if applicable) |
| L5 | Default programming (venue branding, community organization content) |
| L6 | Local cache (offline resilience — important for venues with unreliable connectivity) |

The L1 compliance level is typically inactive for this vertical. This simplifies the operator's mental model: there are no mandatory compliance slots to manage, no jurisdiction-specific regulatory content to maintain, no compliance corpus to review.

Some community venues with licensed bars may have L1 content requirements for responsible gambling or liquor license conditions. These venues inherit the compliance requirements from the Licensed Clubs vertical for their licensed areas. The scope of the compliance requirement is limited to the licensed area — the rest of the venue operates without L1 constraints.

### 4.2 Emergency Workflows for Non-Technical Operators

The VENUE_EMERGENCY trigger must be reachable by a non-technical operator with no prior training with the platform. Requirements:
- Available from any authenticated operator device in the venue (including mobile)
- Prominent placement in the operator interface — not buried in menus
- Maximum two taps/clicks from any screen to activation
- Clear visual confirmation that the emergency is active
- Equally simple clearance path

For community venues, the operator is unlikely to have practiced the emergency workflow. The design must assume the operator has never done this before and is under stress when they need to do it.

### 4.3 Entropy Tolerance

Community venues operate with a modified entropy tolerance model. The standard entropy detection thresholds (60-minute venue scan, 6-hour fleet scan) are calibrated for venues with dedicated operators. A community venue that is managed by a volunteer checking in twice a week may reasonably have content that is 48 hours stale without this representing a failure.

Venue-level entropy tolerance is configurable: `entropy_tolerance_level` on the venue record can be set to `LOW`, `STANDARD`, or `HIGH`. Community venues default to `HIGH` tolerance:
- Staleness alerts are suppressed for content that is within the operator's expected update cadence
- CRITICAL entropy events (missing emergency assets, broken screen) are still escalated immediately
- MEDIUM and LOW entropy events are batched into a weekly digest for the operator rather than real-time alerts

The operator receives one weekly summary rather than a stream of advisory alerts. The summary highlights any CRITICAL items (requiring immediate action) and a list of LOW/MEDIUM items for their review.

---

## 5. Entropy Risk Patterns

| Content type | Entropy risk level (STANDARD) | Community venue threshold | Escalation |
|---|---|---|---|
| Activity schedule not updated for current week | MEDIUM | Advisory after 8 days without update | Weekly digest |
| Expired community notice still displaying | LOW | Advisory after `valid_until` + 48 hours | Weekly digest |
| Emergency asset missing | CRITICAL | Immediate | Operations team |
| Cafe menu board stale | LOW | Advisory after 14 days | Weekly digest |
| Screen offline / not polling | MEDIUM | Immediate (screen health) | Operations team |

### 5.1 The Weekly Digest Pattern

The weekly digest for community venues is generated automatically every Monday morning and sent to the venue operator (email or in-app notification). It contains:
- CRITICAL items: any issues requiring immediate attention (formatted for action, not for information)
- This week's schedule: confirmation that the current week's program schedule is loaded and active
- Items to review: expired notices to confirm removal, content to update if stale

The digest format is non-technical. It does not reference corpus versions, PRE resolution levels, or entropy scores. It says: "Your pool schedule was last updated 9 days ago — is it current?" and "The school holiday notice expired 3 days ago — it is no longer showing."

---

## 6. Operator Patterns

### 6.1 Primary Venue Operator

Typically one person with multiple responsibilities. Interacts with the platform for:
- Weekly schedule updates (primary task)
- Adding community notices (as they arise)
- Responding to the weekly digest (reviewing and clearing stale items)
- Activating specials for the cafe screen
- Emergency management (rare)

This operator is not a trained content professional. They are effective at the platform because the template system means they only need to change specific elements (time slots, activity names) within a pre-defined structure. They do not design screens.

### 6.2 Regional Body / Enterprise Coordinator

The regional body or enterprise organization (e.g., a local council managing multiple community centers, or a sporting association with multiple affiliated clubs) manages the master template library and enterprise-level campaign content. They are ENTERPRISE_ADMIN or REGIONAL_MANAGER.

Their responsibilities:
- Maintaining venue templates (updated seasonally or when the organization's branding changes)
- Creating region-wide campaigns (e.g., regional sporting competition announcements, council events)
- Reviewing fleet entropy for all managed venues
- Supporting venue operators with technical questions

The regional coordinator is more technically capable than the venue operator. They engage with the platform at the governance and fleet management level rather than the daily operational level.

### 6.3 Volunteer / Casual Operators

Some community venues are managed partly by volunteers who may have no prior ClubHub experience and irregular access. The platform must be functional for this use case:
- The login and navigation must work for someone who logged in two months ago and has forgotten the workflow
- The most common actions (update schedule, add notice) must be findable without help
- The emergency trigger must work for someone who has never used it

---

## 7. Campaign Cadence

| Cadence | Typical content |
|---|---|
| Weekly | Activity schedule update, cafe specials |
| Monthly | Committee notices, upcoming events, monthly program changes |
| Seasonal | Holiday program (school holiday special activities), seasonal schedule changes (winter pool hours vs summer pool hours) |
| Annual | Membership renewal notices, AGM announcements, annual event promotion |
| As needed | Community announcements, local event promotion, special bookings |

Seasonal schedule changes are the most impactful regular update for this vertical. When winter hours begin (e.g., pool closes at 6pm instead of 8pm, outdoor facilities unavailable), the schedule must be updated before the season change, not after patrons have arrived to find the facility closed.

The enterprise template approach helps here: the regional body maintains "summer schedule template" and "winter schedule template." The venue operator activates the appropriate template at the season boundary. Template activation is a single action — much lower risk than manually updating every schedule entry.

---

## 8. Operational Examples

### Example A: Council Recreation Center — Weekly Operations

**Context:** Eastfield Recreation Centre, council-operated. Managed by a recreation coordinator who divides her time between ClubHub management and other facility management responsibilities. She spends about 20 minutes per week on screen content.

**Monday morning (15 minutes):**
The coordinator logs in and reviews Monday morning's weekly digest. This week's digest:
- "Pool schedule updated 6 days ago — please confirm current." She checks: the schedule is correct for this week (it's a recurring template with no changes needed). She marks it confirmed.
- "Community notice 'Swim Club AGM — July 12' expired yesterday — no longer displaying." She notes it has been removed automatically; no action needed.
- No CRITICAL items.

She checks the upcoming week: the school holiday program starts next Monday. She activates the pre-built "School Holidays — Summer Program" template (prepared by the regional body last month). This template changes the pool schedule on the activity area screens, adds the holiday program schedule to the reception display, and activates the "School Holiday Activities" notice on the notice board screen.

Activation: one action (select template, apply, confirm). The coordinator's 15 minutes this Monday is split between reviewing the digest and activating the holiday template. Done.

**Tuesday (unplanned — 5 minutes):**
The coordinator receives a call from the aqua aerobics instructor: Thursday's class has been cancelled. She opens the operator app on her desktop, finds Thursday's aqua aerobics entry in the pool schedule, marks it cancelled. The pool schedule screen updates within two minutes. A "Cancelled — Please check with reception for rebooking" overlay appears in the cancelled slot.

**Wednesday (no action needed):**
The screens are running on the weekly template. No operator engagement required.

**Following Monday:**
School holiday program is fully active on all relevant screens. Receipts from the previous week show the standard program schedule correctly replaced. No entropy events during the week.

---

### Example B: Bowling Club — Seasonal Transition and Notice Management

**Context:** Riverside Bowling Club, volunteer-operated. The club's secretary manages the screens with help from the entertainment committee. They operate the platform infrequently — typically twice a week.

**April — Summer/Winter transition:**
The secretary receives a seasonal transition reminder from the regional bowls association (REGIONAL_MANAGER for the association's 8 affiliated clubs). The reminder includes: "Activate winter schedule by April 30."

The secretary logs in, selects "Winter Schedule 2026" from the enterprise template library, previews it on the dashboard (confirms winter pennant schedule, greens opening/closing times, indoor bowls availability are correct), and activates it. Screens update within minutes. The transition from summer to winter programming — which affects the reception screen, the greens-side screen, and the notice board screen — required less than 5 minutes of operator time.

**May — AGM Notice:**
The secretary adds an AGM notice: "Annual General Meeting — Tuesday 21 May, 7pm — Clubhouse Main Room." She creates a community notice in the platform, sets it to appear from now until May 22 (the day after the AGM). The notice appears on all notice board screens and in the reception screen rotation.

**May 22:**
The AGM notice expires automatically. The secretary does not need to remove it. The week's digest (delivered May 25) confirms: "AGM notice expired May 22 — no longer displaying."

**June — Pennant competition announcement:**
The regional body creates a region-wide campaign: "Central Region Pennant — Season Starts June 14." As an affiliated club, Riverside Bowling Club's screens automatically receive this regional campaign (L3 regional campaign, REGIONAL_MANAGER created). The secretary did not need to do anything. The screens are showing the correct regional competition information without any operator action at the club level.

---

## 9. Platform Design Requirements for this Vertical

The following requirements should inform operator experience and deployment architecture decisions for community venues:

1. **Single-operator mode:** The platform must be fully functional when accessed by a single non-technical operator. No workflow should require more than one person.

2. **Template-first UX:** The primary operator experience should be "select a template and customize" rather than "create from scratch." The community venue template library must be comprehensive enough that an operator rarely needs to start from a blank screen.

3. **Digest reporting:** Weekly digest email/notification is the primary async communication channel. Real-time alerts are reserved for CRITICAL events. Operators in this vertical should not feel surveilled or overwhelmed by system notifications.

4. **Offline resilience:** Many community venues (outdoor courts, rural recreation centers) have unreliable network connectivity. Screens must operate from L6 cache for extended periods (4+ hours) without degrading to blank. The L6 cache for community venues should include the full weekly schedule template so that schedule information remains accurate even during connectivity loss.

5. **Emergency prominence:** The emergency trigger must be the most accessible operation in the operator interface, even for an operator who uses the platform infrequently. If the operator hasn't logged in for two weeks and there is an incident, they must be able to find and activate the emergency response without help.

6. **Minimal required configuration:** A freshly enrolled community venue should reach a "good enough" operational state from the enterprise template alone, without the venue operator needing to configure screens. The operator's first week of experience should be "this works; I just need to add my schedule."
