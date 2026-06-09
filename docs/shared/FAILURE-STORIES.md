# ClubHub TV — Failure Stories
# Shared Operational Intelligence Layer

**Document type:** Living canonical reference — append-oriented operational postmortems
**Authority:** Agent 2 (CMS/Operational Architecture)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design)
**Last updated:** 2026-05-22

---

## Purpose

This document records realistic narrative failures — operational postmortems of how things can and do go wrong in deployed content management systems. These are not engineering bug reports. They are human-system failure narratives that illuminate the gap between how systems are designed and how they are actually used under operational pressure.

Each story is written from the perspective of what the operator experienced, what the system was doing correctly (from a technical standpoint), and what the design failed to surface. The goal is to build empathy with operator experience and to identify design leverage points for preventing recurrence.

These stories are **plausible** rather than documented — they are derived from the entropy patterns, mental model failures, and operational profiles documented in this repository, combined with analogues from real-world digital signage, broadcast operations, and hospitality management systems.

---

## Story Format

Each failure story includes:
- **Venue type and context**
- **The setup** — what state the system was in before the failure
- **The event** — what happened
- **What the operator experienced** — the subjective experience of the failure
- **What the system was doing** — technically accurate account of system behavior
- **The gap** — where system design failed to surface critical information
- **Damage assessment** — operational, reputational, or contractual consequences
- **Design leverage points** — where intervention could have prevented or mitigated the failure
- **Constitutional implications** — where relevant

---

## Story 1: "The Campaign That Wasn't Showing"

**Venue type:** Licensed club (RSL club with 28 screens across gaming, bar, bistro, and function rooms)
**Date context:** Six weeks before a major community fundraising event

### The Setup

Over the preceding eight months, the club had operated under three different marketing coordinators (two had left the club, one was interim). Each had created schedule configurations. The last coordinator before the incident had inherited the system with 23 active overrides on specific screens, created by duty managers over the previous year. The coordinator didn't know the overrides existed — they were in a different section of the CMS than the campaign management screen she used.

In the bar area (8 screens), 5 of 8 screens had active per-screen operational overrides. These overrides showed a sponsor's beer brand content — created originally for a trivia night 4 months ago, never given an expiry date, never reviewed.

### The Event

The new marketing coordinator launched a major fundraising campaign: "Help Us Build the New Community Room." She published it with wide venue targeting (all bar and dining areas), verified it on the campaign list ("Active"), and confirmed the launch date. She walked past three screens in the bar, saw two of them showing the fundraising campaign, and concluded the campaign was running.

The three screens she happened to pass were the three without beer brand overrides.

### What the Operator Experienced

Two weeks later, a board member asked her how the fundraising campaign was going and whether the TVs were all showing it. She said yes. The board member mentioned that "the beer screens" — which is what staff called the five bar TVs showing beer brand content — still looked like they were showing beer ads.

The coordinator checked the CMS. The fundraising campaign showed "Active." She couldn't explain why those five screens weren't showing it.

She escalated to the duty manager on shift, who said "those screens have always shown that. It's our main sponsor." He didn't know there was an override in the system — from his perspective, "the system" was just showing the beer brand content on those screens. He'd never created the override himself; it predated his time at the club.

No one in the venue knew how to find or remove the override. The IT help line advised creating a "higher priority schedule" — which, for an LEVEL_3 schedule against a LEVEL_1 override, would have had no effect.

### What the System Was Doing

The PRE was resolving correctly. For five bar screens:
1. Check active emergency states — none.
2. Check active operational overrides (LEVEL_1) — FOUND. Beer brand content active, expires_at = NULL.
3. Resolution terminates at LEVEL_1. Campaign never evaluated.

The system had no obligation to alert the marketing coordinator that her campaign was not reaching those screens. Her campaign was published; the overrides predated and superseded it. Both were correct inputs to a correct resolution.

### The Gap

1. **No cross-layer visibility at campaign publish time.** When the coordinator published her campaign targeting the bar area, the system had information that 5 of 8 bar screens were under operational overrides that would prevent the campaign from resolving. This information was never surfaced.

2. **Override discovery required navigating to a separate CMS section.** The coordinator checked "Campaigns" and saw her campaign as Active. The overrides were in "Overrides" — a different section she had no reason to visit.

3. **No delivery verification for the campaign.** The campaign was "Active" in the system but had zero delivery events on the five affected screens. This zero-delivery signal was not surfaced.

4. **Override rationale was lost.** The beer brand override had no attached rationale, no creator context beyond a user ID (a former employee), and no expiry. It had become orphaned institutional state.

### Damage Assessment

- Fundraising campaign significantly underdelivered to venue patrons for the first two weeks.
- Board member confidence in marketing coordinator reduced.
- Potential sponsor relationship complication (beer brand override was a sponsor commitment — removing it abruptly without communication would have been a separate problem).

### Design Leverage Points

1. **Campaign publish: "Coverage gap" warning.** At publish time, surface: "X of Y screens in the targeted areas are under active overrides and will not receive this campaign. [View affected screens]." Operator can decide to proceed or resolve overrides first.

2. **Override permanence indicator.** On the campaign/area view, visually mark screens with permanent overrides differently from screens receiving the campaign.

3. **Zero-delivery advisory.** If a published campaign has zero delivery events for targeted screens after 2+ poll cycles, surface an advisory: "This campaign has not been delivered to X screens yet."

4. **Override discovery from campaign view.** When an operator opens a campaign and sees that it has coverage gaps, they should be able to navigate directly from the affected screen indicator to the override record, not need to know to look in a separate section.

### Constitutional Implications

None — the PRE resolved correctly. This is a pure UX and operational visibility failure. The Engineering Constitution §2.2 (Explainability outranks optimization) is relevant: "An operator MUST always be able to answer: why is that screen showing that content right now?" The operator could not answer this question. The system had the information required to surface the answer; it did not.

---

## Story 2: "The Emergency That Wasn't"

**Venue type:** Sports bar (32 screens, licensed venue, peak weekend operation)
**Date context:** AFL Grand Final day

### The Setup

The venue manager had learned eighteen months ago that the fastest way to get the same content on all screens simultaneously was to activate an emergency override with the desired content as the emergency content. She had first done this for a NYE event — "I need our NYE graphics everywhere NOW" — and it had worked perfectly. Since then, she had used emergency activation approximately twice a month for event-specific content pushes.

The venue's emergency activation count for the previous 12 months: 24 activations. Of these, 23 were operational (events, promotional pushes, "promo week"). One was a genuine incident — a fight in the venue that required all screens to show "Incident in progress — please remain calm."

That one genuine incident had occurred six months ago. The manager had activated emergency. The incident was resolved in 11 minutes. She deactivated emergency. She later received no communication from anyone about the emergency activation — it had been logged in the system but no one reviewed the log.

### The Event

On AFL Grand Final day, the venue was operating at maximum capacity. At half-time, the manager wanted to push their special half-time offers (beer + pie deal) to all screens. Standard procedure: activate emergency with the half-time promo as emergency content.

What she didn't know: the org admin, in preparation for an important regulatory compliance audit the following week, had enabled enhanced emergency logging and an alert sink that sent an emergency activation notification to the state liquor authority compliance system. This was a new configuration, applied that morning.

The half-time emergency activation triggered an automated compliance notification to the liquor authority: "Emergency override activated at [venue name]." The liquor authority, assuming a genuine venue incident, sent an inspector who arrived 25 minutes later.

### What the Operator Experienced

A liquor authority inspector arrived during the third quarter, asked to speak to the manager, and requested an explanation for the "emergency override notification." The manager, unaware that emergency activations were now being reported externally, was confused. She explained that she uses the emergency feature "to push content quickly." The inspector flagged the venue for potential misuse of emergency protocols in the licensing system.

### What the System Was Doing

The PRE resolved correctly throughout. Emergency activation produced LEVEL_0 resolution on all screens — correct behavior. The compliance notification was triggered correctly by the new alert sink configuration — also correct behavior. The 23 previous "false emergency" activations had not triggered notifications because the alert sink wasn't configured yet.

### The Gap

1. **No semantic signal on emergency activation frequency.** The system had 23 non-genuine emergency activations in 12 months. This should have been a clearly visible advisory signal long before the compliance integration was added. The Emergency Semantic Collapse metric (M-06) should have escalated to ADVISORY after 5+ activations per month, and to REVIEW after patterns showing business-hours clustering.

2. **Emergency feature offered no friction for non-genuine use.** The UI for emergency activation was identical in the genuine and non-genuine case. No guidance, no consequence, no review prompt. It worked exactly the same way whether used for a real emergency or a half-time promo.

3. **No operator notification when system configuration changes affect emergency behavior.** The org admin who added the compliance integration had no mechanism to notify venue managers that emergency activations now had external reporting consequences.

4. **No reason field required.** Emergency activations without a reason field should have triggered stronger advisory signals. A "reason required" mechanism would have created friction that either (a) caused the manager to enter "half-time promo" (obviously non-genuine), surfacing the misuse, or (b) caused her to use an operational override instead.

### Damage Assessment

- Liquor authority compliance flag on venue record.
- Operational disruption on one of the year's highest-revenue trading days.
- Management time spent on compliance response.
- Potential impact on license renewal.

### Design Leverage Points

1. **Emergency reason field — REQUIRED.** No emergency activation without a reason field. Minimum 10 characters. This creates a paper trail that distinguishes genuine emergencies from operational misuse and creates sufficient friction to discourage casual use.

2. **Emergency frequency advisory.** Surface on emergency activation: "This venue has activated emergency X times in the past 30 days. For non-emergency content changes, consider using Operational Override." Show the count prominently.

3. **Emergency misuse pattern detection.** If business-hours clustering is detected (>60% of activations during business hours with short duration <2 hours), surface an advisory to the org admin: "Emergency activations may be used for operational purposes at this venue. Review emergency usage audit."

4. **Org admin → venue manager communication channel for configuration changes.** When org admins make changes that affect emergency behavior (adding alert sinks, changing compliance reporting), a notification should reach venue managers before the change takes effect.

### Constitutional Implications

INV-7 (Emergency Absoluteness) was correctly applied in every case — the PRE resolved to LEVEL_0 correctly. The failure is entirely in the human-system semantic layer, not in the technical resolution layer. This is a pure operational governance failure.

---

## Story 3: "The Stale Golf Club"

**Venue type:** Regional golf club (6 screens — pro shop, clubhouse bar, dining room, member lounge, function room, entrance foyer)
**Date context:** Eight months after initial deployment

### The Setup

The golf club's pro shop manager had spent two days with the implementation team setting up the ClubHub system eight months ago. He created schedules for the upcoming season, set up a sponsor rotation, and configured the weekly competition display. He was pleased with how it looked.

Over the following months: the season progressed, the club hosted three tournaments (only one of which was properly updated in the CMS), and the pro shop manager left the club in month 4. His replacement, hired from outside the club, received no CMS training and no access to the system for his first two months.

By month 8, the screens were displaying:
- **Foyer screen:** "Welcome to the Spring Invitational" (a tournament held 5 months ago)
- **Bar:** "Winter specials" including a soup promotion (it was now spring)
- **Dining:** Menu from the previous format (the dining room had restructured its menu in month 3)
- **Pro shop:** Equipment promotions from previous season; a "new arrivals" campaign for products no longer available
- **Member lounge:** Club president's message from 8 months ago (a different president was now serving)
- **Function room:** Correct — hadn't been configured and was showing system fallback

Members had noticed and raised it at a committee meeting. The incoming president was embarrassed. An emergency committee meeting was called to "fix the screens."

### What the System Was Doing

The PRE resolved correctly at every moment. The schedules were active (no expiry dates on most of them). The content items existed. The system was doing exactly what it was configured to do — showing content that had been configured 8 months ago.

There were zero system errors. Zero alerts. Zero advisory signals. The system's job was to serve the configured content, and it was serving it correctly.

### The Gap

1. **No staleness detection.** The system had delivered the same manifest version to most screens for 4–6 months without change. This was not flagged as unusual. The confidence score on those screens was likely low (no delivery log updates from a device that may have rebooted since configuration) but wasn't surfaced to anyone.

2. **No content expiry advisory.** Schedule rows with `expires_at = NULL` and creation dates of 8+ months ago should surface an advisory: "This schedule has been active for X months with no updates. Consider reviewing whether the content is still current."

3. **No operator activity monitoring.** The previous operator's account became inactive (they left). No new operator had CMS access for 2 months. An advisory: "No operator has made configuration changes at this venue in X days" would have surfaced the gap.

4. **No content freshness signal.** Content items from 8+ months ago, referenced by active schedules, with no updates — a staleness indicator on the content library would have surfaced the accumulation.

5. **No onboarding/offboarding protocol.** When the pro shop manager left, there was no system trigger to prompt access review or knowledge transfer. The CMS continued working as if nothing had changed.

### Damage Assessment

- Member satisfaction and board confidence significantly reduced.
- Brand damage — a club that can't keep its own screens updated looks poorly managed.
- Wasted committee time (emergency meeting).
- Scramble to update all screens at once, creating additional entropy through rushed changes.

### Design Leverage Points

1. **Screen staleness metric (M-11/M-12).** Actively surface: "Screens at this venue have not had manifest changes in X days." Escalate to advisory at 14 days, review at 30 days.

2. **Content item age advisory.** When content items are more than 90 days old and referenced by active schedules, surface them in a "Content that may need review" list.

3. **Operator inactivity advisory.** If no operator has made changes in X days (configurable threshold, e.g., 14 days for a golf club), surface an advisory to the org admin.

4. **Knowledge transfer prompt on user account deactivation.** When a user account is deactivated or hasn't logged in for 30+ days, prompt the org admin: "Consider reviewing content management ownership for this venue."

5. **Scheduled content expiry defaults.** When creating schedules, prompt operators to set an expiry date. Optionally, make `expires_at` a required field with a maximum duration (e.g., 6 months default) that forces periodic review.

### Constitutional Implications

None — the PRE was correct at all times. The Engineering Constitution §2.3 (Visibility outranks automation) is the governing principle: making the staleness visible is the correct intervention, not auto-archiving old content.

---

## Story 4: "The Priority Wars"

**Venue type:** Licensed club (45 screens, multiple venue managers over time)
**Date context:** 18 months of operation

### The Setup

The venue had been operational for 18 months. During that time, four different venue managers had made scheduling decisions. The current priority range for active schedule rows in the bar area:

```
Max priority: 890
Min priority: 5
Median priority: 340
Active rows: 67
```

The original schedule design had used priorities in the range [1–20]. By month 18, the effective range was [300–890] for any content that needed to "actually show."

What had happened: each time a venue manager noticed that content "wasn't showing enough," they created a new version of the schedule at a higher priority. The old version was usually not deleted ("just in case"). By month 18, the bar area had:
- 12 schedule rows showing content that no longer existed (deleted content items — the schedule rows remained).
- 15 schedule rows for promotional content that had ended 3–6 months ago.
- 8 schedule rows that were exact duplicates (same content, different priorities).
- 32 schedule rows that were theoretically active and relevant.

The current venue manager spent 40 minutes every Monday "trying to sort out the schedule," understood none of the historic rows, and routinely created new rows at priority 800+ to "make sure it shows."

### What the System Was Doing

The PRE resolved correctly. The SWRR algorithm applied weights according to the active schedules. Many of the 32 "theoretically active" rows produced content that was legitimately scheduled. Many of the 47 "dead" rows (for ended content) still referenced active schedules — some content items referenced were still in the library, just no longer intended. The resolution produced a technically correct but operationally incomprehensible mix.

### The Gap

1. **No priority range advisory.** Priority range width (M-04) of 885 (890-5) should have triggered a REVIEW-level advisory long before reaching this state. At 20 active rows with max priority >100, an advisory should have surfaced: "Schedule priorities at this venue have escalated significantly. Consider reviewing and consolidating the schedule table."

2. **No orphaned schedule detection.** Schedule rows referencing content items that no longer exist, or content items that haven't been updated in 6+ months while the schedule continues, should surface as advisories.

3. **No duplicate detection.** Eight schedule rows with identical content_id in the same scope and time window should surface as a shadow scheduling advisory (M-07).

4. **No dead content pruning guidance.** Content items for ended campaigns whose schedule rows remain active should surface as "ended campaign content still scheduled."

5. **No schedule health overview.** The venue manager's weekly "sorting out" session had no starting point, no guidance, no priority-ordered list of what to review. They were navigating a raw list of 67 rows.

### Damage Assessment

- Venue manager spending 40 minutes/week on unproductive schedule maintenance.
- Content mix on bar screens was technically correct but not what any operator had consciously designed.
- High risk of sponsor saturation (sponsor content in old high-priority rows competing with editorial content).
- New content created at maximum priority to "guarantee visibility" — the priority escalation pattern will continue indefinitely without intervention.

### Design Leverage Points

1. **Priority health indicator.** When the priority range width exceeds a threshold (M-04), show a "Schedule Health" banner: "This area has schedules spanning a priority range of 885. Many schedules may be competing at similar priorities. [Review schedule table]."

2. **Schedule table health view.** A dedicated "Schedule Health" view that groups schedules by: active and likely needed / active but possibly stale / active but duplicating other content / active but referencing old content. This view gives the venue manager a starting point for cleanup.

3. **Duplicate content advisory.** "3 schedules in Bar Area are showing the same content as another active schedule. This may produce unintended frequency." With a link to review.

4. **Priority escalation intervention.** When creating a new schedule with priority > (max_active_priority - 20), surface: "This schedule is near the top of the current priority range. If you're creating this because existing content isn't showing enough, consider reviewing the existing schedule configuration instead."

### Constitutional Implications

The priority escalation pattern demonstrates Engineering Constitution §3.6 (Priority Escalation Pattern): it is the PRE behaving correctly on incorrect inputs. The resolution is always correct. The inputs have been degraded by operator behavior that the system had no mechanism to surface or discourage.

---

## Story 5: "The Sponsor Who Owned the Screen"

**Venue type:** Golf club (12 screens, high-end metropolitan club)
**Date context:** Tournament season, 3 years after deployment

### The Setup

Three years in, the golf club's sponsor situation had evolved. In year 1: two hole sponsors (15% SOV each), one equipment supplier (10% SOV). Total SOV: 40%.

Year 2: A major tournament sponsor joined at 20% SOV. A beverage sponsor at 15% SOV. Total SOV: 75%. The SOV warning threshold was crossed and had been active for 14 months. Warning was visible in the system but had become ambient noise — the marketing manager saw it every time she logged in and had learned to dismiss it.

Year 3: A new club president negotiated an "exclusive digital presence" deal with a property developer. 35% SOV across all clubhouse screens. This was presented to the marketing manager as a done deal. She added the contract. Total SOV: 110%.

The PRE could not achieve 110% SOV (by definition, shares of voice cannot sum to more than 100%). The SWRR algorithm would normalize the weights, resulting in each sponsor receiving less than their contracted SOV. Sponsor content dominated the screens — editorial content was effectively crowded out.

### What the System Was Doing

The PRE continued to resolve correctly — it applied the contractual weights as inputs and used SWRR to interleave content. When contracts exceed 100% combined SOV, the normalization produces proportional distribution (each sponsor gets their contracted percentage of the non-editorial content). Editorial content, having no contract weight, received minimal resolution wins.

The system had the SOV warning active at the REVIEW level. It had never been blocking — because the Engineering Constitution is clear that advisory signals cannot block action.

### What the Operator Experienced

Six months into year 3: a long-standing member complained that "the screens now just show ads." The marketing manager investigated. The screens in the bar area were showing editorial content approximately 8% of the time, with 92% sponsor content.

She realized the 110% SOV situation and tried to explain it to the club president. He had already signed a 3-year contract with the property developer. There was no clean resolution.

### The Gap

1. **SOV warning had lost signal value.** 14 months of continuous ADVISORY warning had habituated the marketing manager to dismiss it. The warning had been correct for 14 months. This is the signal degradation problem — correct, persistent warnings become noise.

2. **No projection capability.** When the year 3 property developer contract was added, the system showed "SOV Warning Active" — the same warning that had been visible for 14 months. There was no signal that said "adding this contract will push total SOV to 110%, at which point editorial content will receive effectively zero planned screen time."

3. **No blocking mechanism for constitutional SOV violations.** The Engineering Constitution is clear that advisory signals cannot block — but there may be a design question about whether 110%+ total SOV should have a stronger blocking signal. (Constitutional question — the current constitution's position on this is advisory-only. This story tests that position.)

4. **No sponsor saturation impact visualization.** The marketing manager could not see a prediction of what "92% sponsor content, 8% editorial content" would look like as a consequence of adding the property developer contract. If she could have seen that projection before adding the contract, she might have escalated the concern to the president with evidence.

### Damage Assessment

- Member experience significantly degraded — screens feel like advertising boards.
- Three-year contract with contractually embedded conflict.
- Editorial content (which drives member engagement, event promotion, and club culture) effectively eliminated.

### Design Leverage Points

1. **SOV impact projection.** Before adding a sponsor contract, show: "Adding this contract will bring total SOV to X%. At this level, editorial content will receive approximately Y% of screen time." Concrete, visual, prospective.

2. **Escalating advisory tier for SOV thresholds.** The advisory should escalate from ADVISORY → REVIEW → BLOCK (with administrative override) as SOV approaches and passes specific thresholds. 100%+ SOV should be a hard block requiring org admin override with a confirmed acknowledgment of consequences.

3. **SOV warning decay management.** If an advisory has been continuously active for more than 30 days, escalate the visual treatment (color intensity, prominence). Warnings that persist without resolution should become more urgent, not fade into background.

4. **Sponsor saturation dashboard.** A separate "Sponsorship Health" view showing current SOV by contract, combined total, projected timeline for each contract's end date, and editorial content percentage as a function of SOV.

### Constitutional Implications

This story raises a genuine constitutional tension. The Engineering Constitution §2.3 (Visibility outranks automation) states that advisory signals inform but do not block. At 110% total SOV, the system is producing a state where editorial content is effectively eliminated. This may warrant an amendment to permit blocking for clearly unconstitutional configurations — not for the PRE resolution (which is still correct) but for the configuration inputs. This is an open constitutional question.

---

## Story 6: "The Screen Nobody Remembered Existed"

**Venue type:** Community venue (council library, 3 screens)
**Date context:** 2 years after initial deployment

### The Setup

The library had three screens: one at the front entrance, one in the children's area, one in the reading room. The original system was configured by a council IT contractor who spent a day setting up all three screens with a mix of council service information, library events calendar, and community notices.

The contractor left a printed guide for the library manager. The library manager retired 8 months later. The printed guide was not passed on. The replacement manager used the screens occasionally — she knew how to get to the content screen in the CMS but had never changed anything; she just checked that "something was showing" when she walked past.

By month 24, all three screens were showing content from 2 years ago:
- The front entrance screen showed "Welcome to the 2024 Summer Reading Challenge" (it was 2026).
- The children's area showed a story-time schedule for a program that had been discontinued in 2024.
- The reading room screen showed community event flyers from 2024, including events at organizations that no longer existed.

A patron photographed the "discontinued" story-time schedule and posted it on social media. The council received a complaint about misinformation.

### What the System Was Doing

The PRE resolved correctly at every moment. The content items existed. The schedule rows were active with no expiry dates. Delivery was confirmed on each poll. From the system's perspective, everything was working perfectly.

The confidence score on the reading room screen was degraded — the Pi had rebooted at some point and the delivery log was stale — but this was not surfaced to anyone.

### The Gap

1. **No content age advisory.** Content items 24 months old, referenced by active schedules, with no updates, should surface as a staleness advisory. This was not detected.

2. **No operator activity monitoring.** The council IT administrator had access to the system but had not logged in for 20 months. An advisory: "No configuration changes at this venue in 90+ days" was never sent to any administrator.

3. **No content accuracy verification mechanism.** The system can detect configuration state but cannot detect content accuracy. However, the presence of time-sensitive content (event dates, program schedules) in content items that haven't been updated in 2 years is a strong staleness signal.

4. **No stale delivery signal surfacing.** The reading room Pi had a degraded confidence score (stale delivery log). This signal was in the system but not surfaced to any operator.

### Damage Assessment

- Council reputational damage (misinformation on public screens).
- Staff time spent responding to complaint.
- Social media amplification of failure.
- Patron trust erosion.

### Design Leverage Points

1. **Automated staleness advisory to org admin.** If screens at a venue show content items older than 90 days with no updates, and no operator has logged in for 30 days, send an advisory email to the org admin: "Content at [venue] has not been updated in X days. Consider reviewing for accuracy."

2. **Content item creation — expiry prompt.** When creating content items that appear to be time-sensitive (containing dates, event references, program names), prompt for an expiry date: "This content appears to be time-sensitive. Would you like to set an automatic expiry date?"

3. **Schedule health email digest.** A weekly or monthly email digest to venue operators showing: active schedules, content ages, last update date, and any advisories. Requires no login — brings information to the operator rather than requiring them to seek it.

---

## Story 7: "The Preview That Lied"

**Venue type:** Licensed club (new deployment — preview system not yet available)
**Date context:** First month of live operation

### The Setup

Before the preview system was available, the venue manager developed a personal verification method: she would create her schedule changes in the CMS, then walk to a specific screen (the bar TV nearest the manager's office) and watch for 2 minutes. If the content appeared, she concluded the change had worked across all bar screens.

This verification method was not wrong in the specific — the PRE was deterministic, and if the content appeared on bar-01, a schedule targeting the "bar area" was resolving correctly for bar-01. But bar-01 was one of the three screens without active per-screen overrides. It was not representative of the bar area.

### The Event

She published a new summer drinks menu campaign targeting the bar area. Verified on bar-01 — campaign appeared. She concluded all 8 bar screens were showing the summer menu.

At a Friday evening service, a customer asked for an "old-fashioned cocktail" that was on the "cocktail menu on the TV." The cocktail menu was from the winter campaign — showing on five bar screens that remained under override. The summer menu was not visible on those screens.

### What the System Was Doing

Correct. Five screens with LEVEL_1 overrides showed winter cocktail menu. Three screens without overrides showed summer drinks campaign.

### The Gap

**Preview absence.** Without a preview system that shows the PRE resolution for any screen at any time from the CMS, the operator has no mechanism to verify that content changes are producing the expected result without physically visiting each screen.

**The verification habit was reinforced** — it "worked" in most previous cases because most bar screens were not under override, so verifying on bar-01 usually produced correct inferences. This made the failure mode invisible until the override divergence reached a level where verification was meaningless.

### Design Leverage Points

1. **Preview system — per-screen resolution display.** The CMS must show what the PRE will resolve for any individual screen at any moment. This is the most important single operator-facing feature for closing the "I published it, why isn't it showing?" gap.

2. **Area coverage map.** A visual map of all screens in an area showing: which are receiving the active campaign (green), which are under override (amber), which are showing system fallback (red). Visible without navigating to individual screen records.

3. **"Verify across area" workflow.** After publishing a campaign, offer: "Verify delivery across Bar Area." Shows a grid of all 8 bar screens with their current PRE resolution — the operator can confirm at a glance whether their intent is being realized.

### Constitutional Implications

The preview endpoint is constitutionally anticipated in OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §8 (Preview Surfaces) and §9 (PRE Preview Endpoint Specification). Its absence is not a constitutional violation — but its presence is the most effective operational tool for reducing the most common class of operator confusion.

---

*End of FAILURE-STORIES.md v1.0*
*Append new failure stories as they are identified from field deployment experience or adversarial simulation.*
*Each story should be independently searchable by venue type, failure class, and design leverage point.*
*Failure stories are not incidents — they do not track resolution; they track design learning.*
