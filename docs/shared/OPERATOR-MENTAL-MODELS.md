# ClubHub TV — Operator Mental Models
# Shared Operational Intelligence Layer

**Document type:** Living canonical reference — append-oriented
**Authority:** Agent 2 (CMS/Operational Architecture)
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design)
**Last updated:** 2026-05-22

---

## Purpose

This document models how different operator roles think about the ClubHub TV system: what they believe it does, how they expect it to behave, and where those beliefs diverge from the system's actual operation.

This is not a user research report. It is an operational intelligence model derived from:
- The five adversarial simulation scenarios documented in OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md
- The entropy patterns produced by those simulations
- The structural characteristics of each role's authority and workflow pressure
- Analogues from aviation (crew resource management), broadcast operations, and hospitality management systems

**The purpose is not to judge operators.** Every mental model documented here is rational given the information available to the person holding it. The purpose is to identify where systemic design can close the gap between the mental model and reality, before the gap produces entropy.

---

## How to Use This Document

**For UX design (Agent 3):** Every UX decision should be evaluated against the mental models in this document. Ask: "Which mental model does this design serve? Which does it reinforce? Which does it correct?" Design that reinforces incorrect mental models is a liability, even if it reduces short-term friction.

**For platform design (Agent 1):** When considering API design, response schemas, and error messaging, consult the mental models to understand what language operators will bring to the interface. An error message that uses system terminology without mapping to operator vocabulary produces confusion, not correction.

**For training and onboarding design:** The "dangerous misconceptions" sections of each role model are the highest-priority training targets. Closing these gaps at onboarding prevents months of accumulated entropy.

---

## Governing Philosophy

**Operators are not users; they are operators.** The aviation/industrial distinction matters. A user interacts with a system to accomplish personal goals. An operator manages a system on behalf of an organization that depends on correct outcomes. Operators have accountability for outcomes, not just preferences about experience. This changes what "good UX" means — operator UX must support correct outcomes, not just pleasant experiences.

**Local rationality is the enemy, not the operator.** Every behavior documented here, including the dangerous ones, is locally rational given incomplete information. The system design should provide more complete information, not blame operators for acting on incomplete information.

**Mental models drift.** A mental model that is correct at onboarding may become incorrect as the system evolves. Mental model maintenance is an ongoing obligation, not a one-time training event.

---

## Role Taxonomy

```
ROLE HIERARCHY (authority level, highest first)
├── Org Admin          — cross-venue authority, configuration depth
├── Venue Manager      — primary operational authority, high entropy source
├── Shift Manager      — time-pressured, override-centric, low configuration depth
├── Sales Rep          — campaign-creation authority, no deployment authority
└── Technician         — device and infrastructure authority, low content authority

POPULATION DISTRIBUTION (estimated typical venue)
├── Org Admin:      1–3 per organization
├── Venue Manager:  1–4 per venue
├── Shift Manager:  3–15 per venue (all staff with "duty manager" authority)
├── Sales Rep:      1–5 per organization
└── Technician:     1–2 per organization (shared across venues)
```

---

## Section 1 — Venue Manager Mental Model

### 1.1 Who They Are

The venue manager is the primary operational owner of the screen content system. They are responsible for keeping content current, managing promotional cycles, responding to complaints ("that TV is showing the wrong thing"), and ensuring sponsor commitments are met.

They are NOT, primarily, technology operators. They are venue operations professionals who use the CMS as one of many tools. Their attention is divided between: floor operations, staff management, event coordination, supplier relationships, and content management. CMS time is typically 10–30 minutes per day, often compressed into short bursts between other responsibilities.

**Competency distribution:** Most venue managers have a moderate-to-good intuition for what content they want on screens. Their technical understanding of how the system achieves that is highly variable — ranging from "I've built a solid mental model over time" to "I click things and check if it looks right."

### 1.2 Core Mental Model (correct elements)

- Schedules determine what plays during specific time windows.
- Campaigns are a way to organize promotional content for a period.
- If I want something to play on specific screens only, I target those screens.
- If I want something to stop immediately, there's an override or emergency option.
- The system runs automatically — I don't need to press "play" after setting things up.
- Changes take some time to appear on screens (though the exact time is often unknown).

### 1.3 Incorrect Mental Model Elements (high priority for correction)

**"Published = playing."**
The most common incorrect belief. When a venue manager publishes a campaign, they believe all targeted screens will display that campaign's content. In reality: screens with active overrides, screens in areas under area-level locks, and screens where the new campaign loses priority to an existing schedule will all continue showing existing content. The campaign UI says "published" — the screen may not show it.

**"The schedule list is the truth."**
Venue managers review the schedule list to understand what's playing. They rarely account for the fact that overrides, which appear in a different section, are silently winning resolution for 20–30% of screens. The schedule list is one input to resolution — not the output.

**"Priority controls what plays."**
Venue managers escalate priority numbers when content doesn't appear frequently enough. They believe that a schedule at priority 100 will definitively beat a schedule at priority 10. This is true for two schedules at the same level and specificity. It is false when an override at LEVEL_1 exists — the override wins regardless of any priority number on a LEVEL_3 schedule.

**"If nothing else is scheduled, my content plays."**
This is almost correct but fails when: (a) a higher-specificity rule exists, (b) an override from a previous shift manager hasn't been cleared, or (c) a sponsorship contract injects content that changes the relative frequency.

**"Emergencies are for emergencies and I'd never misuse them."**
Venue managers who have never seen an actual emergency treat the feature correctly. However, once they discover that emergency activation is the fastest, most reliable way to immediately change content on all screens, their model shifts. The feature becomes a high-priority tool, not a crisis response tool.

**"Expired things go away."**
Venue managers believe that overrides or schedules with `expires_at` in the past automatically become inactive. This is correct. What they don't account for: overrides with `expires_at = NULL` (permanent) that they or someone else created, often long ago, remain active indefinitely. "That screen has always shown X" — yes, because of a permanent override from 18 months ago that nobody knows to remove.

### 1.4 Dangerous Misconceptions

**Misconception: "I can tell what's playing by looking at the schedule."**
Danger level: HIGH
Impact: Venue managers make content decisions based on an incomplete view of resolution state. They publish campaigns and believe they're active when screens are under override. They delete schedules thinking it will change what plays when an override is the active rule.

**Misconception: "The CMS reflects what's on the screen right now."**
Danger level: MEDIUM
Impact: Venue managers look at the CMS and interpret it as a mirror of the current screen state. The CMS shows configuration (inputs to resolution). The screen shows resolution outputs. There is always a potential gap, visible only through the preview system.

**Misconception: "More active schedules = more coverage."**
Danger level: MEDIUM
Impact: Managers add schedule rows to increase content coverage, creating Shadow Scheduling entropy. The PRE correctly interleaves all active schedules, but the resulting mix is not what any single person intended.

**Misconception: "The system tells me if something is wrong."**
Danger level: HIGH
Impact: Venue managers assume the system will alert them if content stops playing or if entropy accumulates. The system resolves correctly at all times — it has no mechanism to detect "this isn't what the manager wanted." Entropy accumulates silently. Without proactive entropy surfacing, the system never alerts.

### 1.5 Workflow Patterns

**High-frequency pattern: "Quick promo push"**
Trigger: Manager wants to add a promotional piece quickly (new menu item, event tonight, last-minute special).
Action: Creates a schedule directly (skips campaign creation because it's faster), targets the main bar area, sets priority high, sets no expiry.
Entropy risk: HIGH. Creates campaign-orphaned schedule (M-03 signal). No expiry means it persists after the promo ends. High priority may accidentally suppress other content.

**High-frequency pattern: "Fix that screen"**
Trigger: A specific screen is "showing the wrong thing" (or showing fallback content, or looks different from neighboring screens).
Action: Creates a per-screen override with the correct content.
Entropy risk: HIGH. Override accumulates (M-01 signal). Root cause (why was the screen showing fallback?) is not investigated. Override may persist indefinitely.

**High-frequency pattern: "Content audit"**
Trigger: Periodic review, often driven by a complaint or seasonal transition.
Action: Reviews schedule list, deletes old entries, creates new ones.
Entropy risk: MEDIUM. Audit typically covers only the schedule layer. Overrides from previous operators, org-level campaigns, and sponsorship contracts are usually not reviewed. Audit creates a false sense of clean state.

**Low-frequency pattern: "Event takeover"**
Trigger: Large event (sports night, member function, live entertainment).
Action: Either creates a campaign with an event schedule OR activates emergency/override for all screens.
Entropy risk: MEDIUM-HIGH. If emergency is used, semantic collapse risk. If override is used without expiry, accumulation risk. If campaign is used properly, lower risk.

### 1.6 Mental Model Drift Over Time

**Month 1–3:** Venue manager learns the system through training and trial and error. Mental model is malleable. Correct mental models formed here tend to persist. Incorrect ones also persist.

**Month 3–12:** Mental model solidifies. Operator develops habits around specific tools. Often develops "override as default escalation" habit. Campaign system usage may decline as direct scheduling proves faster for quick needs.

**Year 1+:** Mental model is fixed. Operator has learned a stable set of actions that "work." May have strong misconceptions about priority and resolution that feel validated by experience (because the system resolves correctly even with wrong mental models, confirming the wrong model in some cases).

**Staff turnover:** New operators inherit the venue's existing configuration but not the rationale for it. They develop mental models to explain the state they find. Those models often incorporate mythology ("we always have that override because of an incident last year") rather than accurate history.

---

## Section 2 — Shift Manager Mental Model

### 2.1 Who They Are

Shift managers have narrower authority but operate under more time pressure than venue managers. They are on the floor, managing a live venue, and need to make content changes quickly and reliably. They have minimal patience for multi-step workflows.

They operate the CMS primarily for three purposes: immediate content changes, checking what's showing on a specific screen, and responding to in-venue instructions ("put the game on," "show the event poster now").

### 2.2 Core Mental Model

- I can change what's showing on individual screens quickly.
- Override = "this plays now on that screen."
- Once I create an override, that screen shows what I told it to.
- When I'm done with my shift, the system takes care of itself.

### 2.3 Incorrect Mental Model Elements

**"I set it, they can change it."**
Shift managers create overrides believing that when they leave, the next shift manager or venue manager will "clear it up" if needed. In practice, nobody clears overrides they didn't create — because they don't know the rationale for the override, and deleting it feels risky. Shift manager overrides accumulate into a permanent background of unknown-rationale locks.

**"Override duration = my shift."**
Shift managers intend overrides to last for their shift. The system has no concept of "shift." `expires_at` must be set manually. Under time pressure, it often isn't. The override persists past the shift end.

**"The screen I'm looking at is the screen the Pi is driving."**
Shift managers may verify their change by checking the Pi URL in a browser on their phone. They may be looking at a cached version, a different screen, or a preview endpoint that doesn't reflect the live resolution. They conclude the override is active when the screen may not have polled yet.

### 2.4 Dangerous Misconceptions

**Misconception: "If I lock it, it stays locked until I unlock it."**
Danger level: MEDIUM
Impact: Shift managers believe they have full control over override state. In reality, a venue manager or org admin can deactivate their override from elsewhere. More commonly: nobody deactivates it, and it persists — which the shift manager would consider correct ("I locked it, it should stay locked") even though they didn't intend it to be permanent.

**Misconception: "Emergency = fast override."**
Danger level: HIGH
Impact: Shift managers discover that emergency activation is faster and more reliable than creating an override (one action vs multiple steps, absolute guarantee vs potential resolution conflict). They begin using emergency as a fast override tool. This is the Emergency Semantic Collapse pattern — the emergency audit trail becomes operationally meaningless.

### 2.5 UX Design Implications

Shift manager UX must prioritize:
- Speed above all else (they are on the floor, often managing other things simultaneously)
- Expiry setting made prominent, not buried — "how long should this last?" must be the first question, not an optional field
- Confirmation of what the screen will show AFTER the action, not just confirmation that the action was recorded
- Clear indication that the override will persist after their shift unless they set an expiry
- A simple "end of shift" override-review workflow that surfaces all active overrides they created this shift

---

## Section 3 — Marketing Manager / Venue Manager (Marketing Focus) Mental Model

### 3.1 Who They Are

In venues with dedicated marketing roles, the marketing manager is responsible for campaign creation, brand consistency, and promotional calendar management. They think in campaigns, not schedules. They understand brand, targeting, and promotional timing. They are the most likely to use the campaign system correctly — and also the most likely to be confused by the gap between "campaign published" and "content playing."

### 3.2 Core Mental Model

- Campaigns are the right way to organize promotional content.
- Publishing a campaign sends it to the screens.
- I can target campaigns to specific areas.
- Campaign start/end dates determine when content plays.
- If a campaign is active, the content is playing.

### 3.3 Incorrect Mental Model Elements

**"Targeting = delivery guarantee."**
Marketing managers set area targeting on campaigns and believe all screens in those areas will receive the campaign. They don't know about per-screen overrides at higher resolution levels, or about tv_group targeting that might create subzone exceptions.

**"Start date = when it starts."**
Marketing managers publish campaigns with a future start date expecting them to begin exactly at that date. The campaign start is a schedule constraint that the PRE evaluates — but if a higher-level override or emergency is active at that moment, the campaign won't be the resolved content. The campaign will "start" in the system sense (its time window opens) but not in the visible sense (it won't be on screen yet).

**"Active = on every screen in the target."**
The campaign says "Active." The marketing manager believes all targeted screens are showing the campaign. The reality is that active means the campaign is in a state where its schedules can influence resolution for targeted screens — but resolution depends on the full system state.

### 3.4 Dangerous Misconceptions

**Misconception: "If I can see the preview, all screens will look like that."**
Danger level: HIGH (after preview is implemented)
Impact: The preview endpoint shows PRE resolution for a specific screen at a specific time. It does not preview all screens simultaneously. A marketing manager who sees the preview for screen "bar-01" and confirms it looks right may not realize that "bar-02" through "bar-08" have per-screen overrides and look completely different.

**Misconception: "Campaign rollback restores previous content immediately."**
Danger level: MEDIUM
Impact: Marketing managers may use rollback under the expectation of immediate reversion. The rollback materializes the previous schedule state — but the 15-second poll cycle means screens change within 15 seconds, not instantly. And screens with overrides will not revert to the rolled-back schedule.

### 3.5 Specific Workflow Patterns

**Pattern: "Seasonal transition"**
Trigger: End of one promotional season, beginning of another.
Action: Archive previous campaigns, publish new campaigns.
Risk: Archived campaigns may have schedule rows that weren't properly cleaned up. New campaigns may conflict with existing overrides. Marketing manager checks one or two screens to confirm the transition, not all of them.

**Pattern: "Sponsor content launch"**
Trigger: New sponsorship contract signed, sponsor content needs to go live.
Action: Creates sponsorship contract, uploads sponsor content, sets SOV percentage, activates.
Risk: Marketing manager may not understand that SOV is cumulative. Adding a 20% contract when existing contracts total 40% creates a 60% sponsor saturation. The system will warn — but if warnings have been ambient for weeks, the signal is lost.

---

## Section 4 — Org Admin Mental Model

### 4.1 Who They Are

Org admins are typically technical-ish staff or executives with broad system authority. They set up the system, manage access, and handle cross-venue policy. They interact with the CMS less frequently than venue managers — but when they do, their actions have broad impact (org-level campaigns, org-level overrides, venue creation, user management).

### 4.2 Core Mental Model

- I control the system at the highest level.
- Org-level settings apply to all venues.
- I can push things to all screens across all venues simultaneously.
- Venue managers manage the details; I set policy.

### 4.3 Incorrect Mental Model Elements

**"I can see what's happening everywhere."**
Org admins believe their elevated access gives them visibility into all venue states. In practice, without a cross-venue entropy dashboard, they see configuration — not resolution state. A venue with severe override accumulation is invisible to an org admin who only reviews the campaign schedule list.

**"My org-level rules are baseline; venue managers customize within them."**
The specificity model means venue managers can create higher-specificity rules that shadow org-level rules entirely. A venue manager with persistent per-screen overrides has effectively decoupled 30% of their screens from org policy. The org admin may not know.

### 4.4 Dangerous Misconceptions

**Misconception: "Setting an org-level campaign ensures brand consistency across all venues."**
Danger level: HIGH
Impact: An org admin creates an org-level campaign for brand consistency. At LEVEL_3 org specificity (SPEC_1), this campaign will lose to any venue-level (SPEC_2), area-level (SPEC_3), or higher-specificity schedule. And it will lose entirely to any override (LEVEL_1/2). A venue that has significant override accumulation will largely ignore org-level campaigns.

**Misconception: "Emergency activation at org level locks all venues simultaneously."**
Danger level: HIGH (if true) / MEDIUM (if this feature doesn't exist)
Impact: Org admins may expect org-level emergency activation to affect all venues. Depending on system design, this may not be the mechanism. This expectation must be clearly addressed in UX for org admins.

---

## Section 5 — Sales Representative Mental Model

### 5.1 Who They Are

Sales reps use the CMS to create campaign drafts for client presentations and to deliver on client commitments. They understand content from a marketing angle but have no interest in the scheduling mechanics. They are often the first point of contact when a client asks "is our ad playing?"

### 5.2 Core Mental Model

- I create campaigns for clients.
- Once created, the campaign goes to whoever approves it.
- If the client says the ad isn't playing, I need to check the system.
- The system shows me what's scheduled; that's what's playing.

### 5.3 Incorrect Mental Model Elements

**"Draft = created = will play after approval."**
Sales reps believe that creating a campaign in draft and submitting for approval creates a clear pipeline to deployment. They don't know about the scheduling mechanics that happen after publication, or that publication doesn't guarantee resolution.

**"Viewing the campaign proves it's delivering."**
Sales reps check the CMS to answer client questions about delivery. Seeing an "active" campaign with a date range that covers today satisfies them — and satisfies the client in the short term. They don't check actual delivery logs, resolution traces, or screen-level states.

### 5.4 UX Design Implications

Sales rep UX must provide:
- Clear proof-of-play data that is legible without system knowledge ("Your client's content played 847 times across 12 screens between Monday and Friday")
- Simple campaign creation with clear handoff workflow ("Draft submitted for venue manager review")
- Explicit communication of the draft→published gap ("This campaign will not appear on screens until a venue manager publishes it")

---

## Section 6 — Technician Mental Model

### 6.1 Who They Are

Technicians install and maintain the physical infrastructure: Pi appliances, TV mounts, network connections, kiosk mode configuration. They have minimal interest in content — their concern is "is the screen showing something?" rather than "is the right thing showing?"

### 6.2 Core Mental Model

- If the screen is showing content, it's working.
- If the screen is black or showing an error, it's broken.
- The Pi polls the server and shows whatever comes back.
- If a screen is showing the wrong thing, that's a content management problem, not a hardware problem.

### 6.3 Incorrect Mental Model Elements

**"Content issues are not my problem."**
Technicians correctly identify that content configuration is not their domain. However, they sometimes encounter symptoms that appear hardware-related but are actually configuration-related (e.g., a screen showing system fallback content because its area has no active schedules). Without basic system knowledge, they may investigate hardware when the issue is in the CMS.

**"The server is the source of truth; what it says is what's showing."**
Technicians trust the server manifest. If the server says a screen should be showing content X, they believe the screen is showing X. Cache staleness, Pi reboot loops, and Chromium crashes can create divergence between server state and screen state that a technician needs to diagnose.

### 6.4 UX Design Implications

Technician tools (separate from main operator CMS) should provide:
- Per-device status (last poll time, current manifest version, cache state, connectivity indicator)
- Simple divergence detection ("Server says version 47, device last reported version 43 — 4 updates behind")
- Remote reboot and cache clear capabilities
- Screen registration and hardware assignment workflow

---

## Section 7 — Cross-Role Mental Model Failure Patterns

### 7.1 "Fix by Override" Cascade

**Pattern:** Any operator at any level discovers that creating a per-screen override reliably produces the desired immediate result. This becomes their learned response to any content dissatisfaction.

**Why it's locally rational:** Override at LEVEL_1 is the highest non-emergency control. It always wins. It always works. It produces the correct result immediately (within 15 seconds).

**Why it's systemically damaging:** Override accumulation (Pattern A from OPERATIONAL-ENTROPY) means that 6 months later, a venue manager publishing a "for all screens" campaign discovers that 35% of screens are under override and won't receive it. The campaign layer is effectively disabled for a significant portion of the fleet.

**Design implication:** Every override creation must surface: "This override will prevent this screen from receiving area or venue schedule updates. Set an expiry date to ensure it clears automatically." The friction of this warning must be calibrated — too intrusive and operators bypass it; too subtle and it doesn't change behavior.

### 7.2 "Someone Else's Configuration" Confusion

**Pattern:** Operator encounters unexpected screen behavior. Investigates. Finds a schedule or override they didn't create and don't understand. Either (a) leaves it alone (risk: accumulation), or (b) deletes it (risk: removes a needed configuration without understanding consequences), or (c) creates a new rule to override it (risk: layering).

**Why it's locally rational:** Without rationale attached to configuration records, all three responses are reasonable. The operator doesn't know what they don't know.

**Design implication:** Every configuration record must carry: creator identity, creation timestamp, optional rationale/note field, and source (campaign vs direct vs override). The audit trail must be visible in the configuration UI, not hidden in a separate audit log.

### 7.3 Priority Escalation as Competence Signal

**Pattern:** When content isn't appearing frequently enough, operators increase the priority number. This action feels like "doing something" and signals competence. The escalation is visible in the record ("I raised priority to 75"). Peers learn from this as the correct response.

**Why it's locally rational:** Priority does affect resolution (within LEVEL_3, within the same specificity). The escalation sometimes works. When it doesn't work (because the screen is under override or the competing schedule is at higher specificity), the explanation is invisible.

**Design implication:** When an operator increases a schedule priority, the system should immediately check: "Are there any active overrides or higher-specificity rules affecting the same screens? If so, warning: this priority change will have no effect on those screens."

### 7.4 Emergency as Institutional Knowledge Loss Risk

**Pattern:** Operators who have used emergency as an operational tool train their replacements to do the same. Within 12 months, the emergency feature is institutionally understood as "the fast flush button." New staff are never taught the intended semantics.

**Why it's locally rational:** The training is accurate in terms of mechanism — emergency does produce immediate results. The knowledge that it degrades the audit trail is never visible to the trainer.

**Design implication:** Emergency activation must require a reason field. The UI should display the emergency usage count for the past 30 days at activation time: "This venue has activated emergency 8 times in the past 30 days. Consider using an operational override for non-emergency content changes." This creates friction for misuse without blocking legitimate use.

### 7.5 The Preview Absence Problem

**Pattern (pre-preview):** Operators cannot verify what the PRE will resolve for a screen without walking to the physical screen and watching it. Under time pressure, they assume their configuration change worked. They discover it didn't when a client or manager complains hours later.

**Why this produces entropy:** Without preview verification, the feedback loop between "I changed configuration" and "I verified the result" is broken. Operators don't verify changes they can't easily verify. Incorrect configuration persists because nobody knows it's incorrect.

**Design implication:** The preview system is not a convenience feature — it is an entropy reduction mechanism. Without preview, operators are flying blind on every configuration change. The preview endpoint should be accessible from every configuration surface that affects playout (schedule create, override create, campaign publish).

---

## Section 8 — Mental Model Drift and Recovery

### 8.1 How Mental Models Drift

**Stage 1 — Initial correct model:** Operator learns system through training. Mental model is close to correct. Uses campaign system, sets expiry dates on overrides, understands the poll cycle.

**Stage 2 — Discovery of shortcuts:** Under time pressure, discovers that direct scheduling is faster than campaigns. Discovers that overrides always work. Stops setting expiry dates when time is tight. Mental model begins diverging from correct model.

**Stage 3 — Shortcut becomes norm:** The shortcut behavior becomes habitual. The "correct" behavior (campaign creation, expiry dates) becomes the exception, done only when there is time. Mental model now treats shortcuts as the intended behavior.

**Stage 4 — Teaching the wrong model:** When training new staff, operator teaches their normalized model — including the shortcuts. The incorrect mental model propagates. The "correct" model is now known only to the system designers.

### 8.2 Mental Model Recovery Strategies

**Advisory-based correction:** Surfacing entropy signals (M-01 through M-12) helps operators see the systemic consequences of their behaviors without accusation. "This venue has 34% of screens under override" is data, not judgment. Data-driven correction is more durable than rules-based correction.

**In-context friction:** When an operator takes an action that typically contributes to entropy (creating a direct schedule without a campaign, creating an override without an expiry), the system surfaces gentle, contextual guidance: "This schedule isn't attached to a campaign. Add it to a campaign for better management visibility." Not blocking — informational. Repeated exposure builds correct model over time.

**Visual consequence surfacing:** Show operators what a screen "looks like" from the PRE's perspective before they make a change and after. If a venue manager publishes a campaign and can see "8 of 12 screens in Bar Area will receive this campaign; 4 are under override" — the override accumulation is visible and the mental model is corrected in the moment of action.

**Role-specific mental model anchoring:** Onboarding for each role should explicitly address the dangerous misconceptions for that role. Not as "here is what you're doing wrong" but as "here is the most important thing to understand about how the system works that surprises most people in your role."

---

*End of OPERATOR-MENTAL-MODELS.md v1.0*
*Append new sections as operator research and field observations accumulate.*
*Do not delete or overwrite existing sections — mark them as updated with a timestamp if they require revision.*
