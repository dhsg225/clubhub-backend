# ClubHub TV — Operator Cognitive Models v1
# Foundational Operational Anthropology

**Document type:** Canonical operational anthropology
**Authority:** Agent 3 (UX/Design), with Agent 2 (CMS) review authority on operational workflow accuracy
**Audience:** Agent 1 (Platform), Agent 2 (CMS), Agent 3 (UX/Design), future UX and product contributors
**Depends on:** OPERATOR-MENTAL-MODELS.md, FAILURE-STORIES.md, REAL-WORLD-OBSERVATIONS.md, MARKET-VERTICAL-PATTERNS.md, DESIGN-PRINCIPLES-FOR-OPERATIONS.md, OPERATIONAL-INSIGHTS-LOG.md
**Version:** 1.0
**Status:** CANONICAL — grounded in structural inference and analogous evidence; field validation pending

---

## Part 1 — Purpose and Framing

---

### 1.1 Why This Document Exists

The ClubHub TV system is operationally deterministic. Given the same inputs, the PRE always produces the same output. The operators of ClubHub TV venues are not deterministic. They carry mental models, assumptions, urgency pressures, trust states, and cognitive habits that diverge systematically from the system's actual behavior.

This divergence is the primary source of entropy.

Understanding how operators think — not how they should think, but how they actually think given their role, context, training level, and operational pressure — is a prerequisite for designing a system that reduces entropy rather than creating it.

This document is the foundational operational anthropology of the ClubHub TV platform. It describes the cognitive realities of the human operators who interact with the system, organized into five areas:

1. Operator types and their cognitive profiles
2. How operators' thinking diverges from PRE structural reality
3. Common misconceptions that produce dangerous operational behavior
4. How operator cognition changes under stress
5. How workarounds originate and persist

---

### 1.2 Knowledge Status

The contents of this document are grounded in:
- **STRUCTURAL_INFERENCE:** Reasoning from documented system properties and known failure patterns
- **ANALOGOUS:** Research from analogous domains (aviation CRM, broadcast operations, industrial control systems, casino floor operations)
- **OBSERVED:** Operational insights from OPERATIONAL-INSIGHTS-LOG.md and REAL-WORLD-OBSERVATIONS.md

No claim in this document is presented as field-validated unless explicitly marked OBSERVED with a source citation. Where evidence is inferential, it is marked accordingly.

**Classification per KNOWLEDGE-CLASSIFICATION-SYSTEM.md:** OPERATIONAL (strong structural inference; requires field validation to elevate to CANONICAL field-evidence tier).

---

## Part 2 — Operator Types and Cognitive Profiles

---

### 2.1 The Floor Operator

**Role definition:** The person physically present in the venue who manages day-to-day content operations. May be a bar manager, pro shop attendant, club events coordinator, front desk manager, or general operations staff.

**Cognitive profile:**

*Attention model:* Intermittent and reactive. The Floor Operator does not monitor the CMS continuously. They access it when something needs to change or when something is visibly wrong. Between interventions, the system is expected to run autonomously.

*Mental model of "how it works":* The Floor Operator typically holds one of two models:
- **Model A (Correct):** "I set up campaigns and the system shows the right content at the right times."
- **Model B (Incorrect, but common):** "Whatever I last configured is what's showing. The screen reflects my most recent action."

Model B is dangerous because it causes operators to underestimate the persistence of old configurations. An override created six months ago by a different operator is invisible in Model B thinking — the Floor Operator assumes only their recent actions are affecting the screen.

*Urgency response:* Floor Operators encounter urgency in real time — a screen is showing wrong content moments before an event, a sponsor is in the room and their content isn't visible, a compliance officer is on-site. They respond immediately, with the tools most accessible, without research. The accessible tool is usually "create an override." This is Entropy Pattern A genesis.

*Risk profile:*
- Primary risk: Override accumulation from urgency responses
- Secondary risk: Shadow scheduling (creating direct schedules instead of using campaigns) when campaign creation seems complex
- Tertiary risk: Misunderstanding of expiry — not setting expiry dates on operational overrides

*Design implications:*
- The Floor Operator's entry path into the CMS during urgency is the most dangerous moment in the system. The UX must surface the impact of a new override before it is created, while providing a fast path for legitimate urgent changes.
- The Floor Operator's default experience should surface active overrides prominently — they often don't realize what was configured before them.

---

### 2.2 The Venue Manager

**Role definition:** The venue-level authority who oversees content strategy for a specific location. May be a general manager, club secretary, venue director, or equivalent. Has broader authority than the Floor Operator and takes accountability for venue-level outcomes.

**Cognitive profile:**

*Attention model:* Periodic and strategic. The Venue Manager reviews content and configuration on a weekly or monthly cadence, not daily. They assess whether content strategy is working, respond to complaints from staff or guests, and make configuration changes with longer time horizons in mind.

*Mental model of "how it works":* The Venue Manager typically holds a campaign-centric model. They think in terms of "what campaigns are active" rather than "what overrides are active." This creates a systematic blind spot: overrides created by Floor Operators may be suppressing campaigns, but the Venue Manager is reviewing campaigns and seeing them as "Active" — and not connecting that to the screen not showing the expected content.

*Organizational accountability:* The Venue Manager is accountable for sponsor obligations, compliance content, and brand standards. They are the person who gets the call from a sponsor whose content isn't showing, or from a compliance officer noting that mandatory content wasn't playing during the audited window.

*Risk profile:*
- Primary risk: Campaign-centric blind spot causes the Venue Manager to miss override-driven suppression
- Secondary risk: Escalation response — when content isn't showing and they can't diagnose it, they escalate to operational overrides themselves ("I need to know this will show, so I'm forcing it"), which compounds the problem created by the Floor Operator
- Tertiary risk: Knowledge gap handoff — they are accountable for outcomes produced by configurations they didn't create and may not understand

*Design implications:*
- The Venue Manager's primary view should be a venue health dashboard that surfaces active overrides alongside active campaigns — not a campaigns-only view
- Suppression visibility must be surfaced at the campaign level: "This campaign is active but not winning on 3 screens — [see why]"
- The Venue Manager must be able to see the difference between "screen showing campaign content" and "screen showing override content" without navigating to each screen individually

---

### 2.3 The Sponsorship Manager

**Role definition:** Manages sponsor relationships and is accountable for delivering contracted share-of-voice on specific screens or zones. May be internal (venue staff) or external (sponsor representative with CMS access).

**Cognitive profile:**

*Attention model:* Output-focused and contractual. The Sponsorship Manager cares about one thing: is the sponsor content running on the screens it is supposed to run on, at the expected frequency? Everything else is noise.

*Mental model of "how it works":* The Sponsorship Manager tends to hold a simple model: "I configure sponsor content, it shows, done." They often do not understand the resolution hierarchy or the fact that an override at LEVEL_1 can suppress their LEVEL_4 sponsor injection. This leads to escalation behavior when content isn't showing — they try to increase content frequency or add more instances, neither of which addresses the real suppressor.

*Key operational misconception:* Sponsor content at LEVEL_4 is below operational and scheduled overrides (LEVEL_1 and LEVEL_2). A venue in heavy override use may have sponsor content consistently suppressed without any obvious CMS signal to the Sponsorship Manager.

*Risk profile:*
- Primary risk: Invisible SOV shortfall due to override suppression — the sponsor is not getting their contracted exposure but neither the Sponsorship Manager nor the venue is aware
- Secondary risk: Priority escalation — when sponsor content isn't showing, Sponsorship Managers may request that their content be given "higher priority," pushing for LEVEL_1 treatment of what should be LEVEL_4 content

*Design implications:*
- SOV reporting must show actual delivered share vs contracted share, with delta flagging
- When LEVEL_4 content is being suppressed by higher-level rules, this must be surfaced in the Sponsorship Manager's view
- The explainability surface for sponsor content must explain the resolution hierarchy in terms that make sense to a non-technical manager: "Your sponsor content is being blocked by an operational override on 2 screens. The override expires Friday."

---

### 2.4 The Network Operations Operator

**Role definition:** Manages content and configuration across multiple venues, typically at the organization level. May be a marketing director, content manager, or regional operations manager.

**Cognitive profile:**

*Attention model:* Aggregate and exception-focused. The Network Operations Operator cannot monitor individual screens at scale. They look for patterns and exceptions: which venues are underperforming, which campaigns are not delivering expected reach, which venues have entropy issues.

*Mental model of "how it works":* The Network Operations Operator typically has the most accurate mental model of the system structure — they have seen more failure modes, worked with more venues, and understand that venue-level override accumulation is a common pattern. However, this broader understanding does not necessarily translate to accurate expectations for any specific venue.

*Key challenge:* The Network Operations Operator is accountable for outcomes at scale but cannot directly observe the configuration state of each venue. They rely on aggregate reports and exception signals. If those signals don't surface individual venue entropy, they cannot intervene.

*Risk profile:*
- Primary risk: Entropy blindness — individual venue entropy is invisible at the aggregate view; the Network Operations Operator doesn't know to investigate a specific venue until something breaks visibly
- Secondary risk: Org-level overrides that affect multiple venues without per-venue impact review

*Design implications:*
- The Network Operations view must provide entropy signals at the venue level in the aggregate dashboard — not just content delivery statistics
- Org-level configuration changes must surface per-venue impact preview before confirmation
- The Network Operations Operator needs a "venues needing attention" view, not just a "venues with problems" view — surfacing entropy before it produces visible failures

---

### 2.5 The Emergency Operator

**Role definition:** Any operator (typically Venue Manager or above) who has authority to activate emergency content. Emergency operators are not a separate role — they are any operator acting in emergency response mode.

**Cognitive profile:**

*Attention model:* Focused and time-pressured. The Emergency Operator is responding to a specific event with specific urgency. They are not reviewing the full system state — they are executing a specific action to handle a specific situation.

*Mental model of "how it works":* During emergency activation, the operator's mental model simplifies drastically. They understand: "Emergency content will show on [screens]." They do not necessarily think about: "This emergency will remain active until I explicitly clear it."

*The critical cognitive gap:* Emergency deactivation requires a deliberate, subsequent action. Emergency activation is urgent and reactive. Emergency deactivation is calm and procedural. The emotional state during activation is incompatible with careful expiry planning. This produces the failure mode documented in FAILURE-STORIES.md Story 2 — emergencies that persist long after the triggering event because no one explicitly cleared them.

*Cognitive pressure during emergencies:* Operators in genuine emergency mode (fire alarm, safety incident, regulatory action) are experiencing acute stress. Decision quality degrades under acute stress. The UX for emergency activation must be designed for degraded decision-making capacity — the path to the correct action (scoped emergency with expiry, not global emergency with no expiry) must be the path of least resistance.

*Risk profile:*
- Primary risk: No-expiry emergency creation — emergency remains active indefinitely
- Secondary risk: Semantic drift — operators use emergency-level tools for non-emergency operational urgency, producing Emergency Semantic Collapse (Entropy Pattern)
- Tertiary risk: Scope creep — activating global emergencies when screen-specific emergencies are sufficient

*Design implications:*
- Emergency activation flow must require explicit expiry selection or explicit "no expiry — I understand this will remain until manually cleared" acknowledgment
- Emergency activation scope must default to the minimum required scope, not global
- Post-emergency: automatic notification to venue managers when emergencies have been active for >4 hours with no update
- The emergency management view must prominently show emergency duration and the operator who activated it

---

### 2.6 The Executive

**Role definition:** C-level or senior management visibility consumer. Rarely interacts with the CMS directly. Reviews reports, receives summaries, and makes decisions about content strategy and sponsor relationships.

**Cognitive profile:**

*Attention model:* Summary and outcome-focused. The Executive does not monitor individual screens or campaigns. They review KPIs: is content performing, are sponsors satisfied, is the venue compliant.

*Mental model of "how it works":* The Executive often does not understand the PRE or resolution hierarchy. Their mental model is essentially: "Screens show what we configured. If something is wrong, operations should fix it."

*Risk profile:* Low direct risk to system entropy (Executives rarely create overrides). High risk through resource decisions: if Executives believe the system is "unreliable" based on incomplete information, they may mandate operational changes (more overrides, simpler configurations) that increase entropy.

*Design implications:*
- Executive-facing reports must translate system health into business language: "X% of contracted sponsor impressions delivered," "N screens operating with outdated configurations," "Content compliance rate"
- Executive communication must never use technical language without translation

---

## Part 3 — How Operators Think vs PRE Structural Reality

---

### 3.1 The Last-Action Fallacy

**The operator's assumption:** The screen reflects my most recent action.

**The PRE reality:** The screen reflects the current highest-priority winning rule, which may have been created by anyone at any time.

**Gap:** Operators mentally model the CMS as a direct-input system: "I set X, X shows." The PRE is a resolution system: "The highest-priority rule matching this screen at this time shows."

**Behavioral consequence:** Operators who believe in the last-action fallacy do not look for older, higher-priority rules that might be suppressing their recent action. When their action doesn't take effect, they assume there was a technical failure and repeat the action, or escalate to a higher-authority action (override when campaign doesn't work, emergency when override doesn't seem to work).

**This is Entropy Pattern E (Priority Escalation) in its pure cognitive form.** The escalation is not malicious — it is a rational response to an incorrect mental model.

---

### 3.2 The Priority-as-Number Fallacy

**The operator's assumption:** "Priority" is a number that I can increase to make content show more prominently or take precedence.

**The PRE reality:** "Priority" in the context of content items refers to weight within a SWRR playlist. It does not affect which rule wins resolution — resolution is determined by resolution level (LEVEL_0 through LEVEL_6) and specificity, not by content weight.

**Gap:** Operators who see a "priority" field in the content configuration attempt to solve resolution conflicts by increasing the number. This has no effect on whether the content plays — SWRR weight only affects frequency within a playlist, not playlist selection.

**Behavioral consequence:** Priority escalation attempts that don't work lead to further escalation — eventually to creating overrides or requesting elevated permissions. The system appears broken ("I set priority to maximum and it still doesn't show") when it is working exactly as designed.

**FAILURE-STORIES.md Story 4 ("The Priority Wars")** directly documents this failure. Four operators independently increased their content priorities to "maximum" over three months. The SWRR weights became meaningless as all content was at equivalent priority, but none of them understood that the actual conflict was at the resolution level (a campaign vs an operational override), not at the content weight level.

---

### 3.3 The Schedule-as-Command Fallacy

**The operator's assumption:** When I schedule content to play at a time, it will play at that time.

**The PRE reality:** Content plays at a time only if: the rule containing that content is the highest-priority winning rule for that screen at that time. Scheduling content at a time is a necessary condition, not a sufficient condition.

**Gap:** Operators who schedule content expect a guaranteed outcome. They do not think about what else might be scheduled for the same screen at the same time, or whether an operational override will suppress it.

**Behavioral consequence:** When scheduled content doesn't play, operators assume the schedule is "broken" or that it "didn't save." They reschedule it, or they add an override "to make sure." Both responses add entropy.

---

### 3.4 The Configuration-as-State Fallacy

**The operator's assumption:** If I created a configuration and it was saved successfully, it is affecting the screen.

**The PRE reality:** A saved configuration affects a screen only if it is the winning rule for that screen at the relevant time. A correctly saved campaign that is suppressed by an active override is "affecting nothing" despite being correctly configured.

**Gap:** Operators perform a save action and receive a success confirmation. In their mental model, the work is done — the content will play. The success confirmation confirms save, not win. These are structurally different outcomes with different verification requirements.

**Behavioral consequence:** Operators who save a configuration and move on do not verify that the configuration is actually winning on the target screens. They only discover the problem when someone notices the screen is showing wrong content — often days or weeks later.

---

### 3.5 The Recency-as-Priority Fallacy

**The operator's assumption:** The most recently created override or campaign takes precedence over older ones.

**The PRE reality:** Precedence is determined by resolution level and specificity, not by creation time. An older, higher-level or more specific rule always beats a newer, lower-level or less specific rule.

**Gap:** Operators who hold this model attempt to "overwrite" existing configurations by creating new ones. When the new configuration doesn't take effect (because the old one is at a higher resolution level), they create another new one. This is direct entropy generation.

---

### 3.6 The Isolated-Screen Fallacy

**The operator's assumption:** Changes I make to a screen affect only that screen.

**The PRE reality:** Override and campaign scope can be broader than a single screen. An operational override scoped to a zone affects every screen in that zone. An emergency override with global scope affects every screen in the venue.

**Gap:** Operators who manage individual screens may not realize that configuration objects affect multiple screens. When they create an override to fix "this screen," they may unknowingly affect ten others.

**Behavioral consequence:** Unintended scope creates unintended suppression across screens the operator wasn't thinking about. This is a common source of "mystery content" on screens the operator never intended to touch.

---

## Part 4 — Six Named Misconceptions

---

The fallacies in Section 3 manifest as six specific, nameable misconceptions that appear consistently across operator types and venues. These are not individual errors — they are structural mismatches between the system's design and the natural cognitive model operators form from CMS interactions.

---

### M-01: "Active means showing"

**Misconception:** If a campaign shows "Active" status in the CMS, it is showing on the screens it targets.

**Reality:** "Active" means the campaign configuration is live and valid. It does not mean the campaign is winning the resolution decision on any screen. A campaign can be Active and not showing on any screen if it is suppressed at all LEVEL_3 placements by higher-level rules.

**Where this misconception forms:** The campaign list view, which shows status as "Active / Paused / Ended." There is no status for "Active but suppressed."

**Fix (UX):** The campaign list must show per-screen winning status, or an aggregate "winning on N of M targeted screens" indicator. "Active" is insufficient status information.

---

### M-02: "I can fix it by adding more"

**Misconception:** If content isn't showing, adding another rule (override, campaign, schedule) will fix it.

**Reality:** Adding more configuration objects rarely fixes a suppression problem. If the screen is suppressed by an LEVEL_1 override, adding more LEVEL_3 campaign content does not change the outcome. The only fix is modifying or removing the suppressing rule.

**Where this misconception forms:** The absence of visible suppression information. Operators who cannot see the suppressor assume the problem is in their own configuration (not enough rules, not specific enough, not high enough priority). They add more.

**Fix (UX):** Suppression visibility (Section 3.2 of EXPLAINABILITY-UX-SPEC-v1.md) is the primary mitigation. When operators can see what is suppressing their content, they stop adding more content and instead address the suppressor.

---

### M-03: "The screen shows what I last did"

**Misconception:** The screen state reflects the operator's most recent action. If I added a campaign this morning, the screens are showing that campaign.

**Reality:** The screen shows the current winning rule, which may have been created by anyone at any time. The operator's most recent action may be suppressed by an older, higher-priority rule they are not aware of.

**This is the Last-Action Fallacy from Section 3.1.** Named separately because it is so common and so consequential.

**Fix (UX):** The screen status view must show the active winning rule with attribution. The first thing a Floor Operator sees when they look at a screen in the CMS should be "Showing: [CONTENT] via [RULE] created by [OPERATOR]" — not just "Showing: [CONTENT]."

---

### M-04: "Emergencies end when the event ends"

**Misconception:** When the reason for an emergency is over, the emergency automatically clears.

**Reality:** Emergencies are cleared only by explicit operator action. An emergency created for a fire drill that ended 45 minutes ago is still active. An emergency created for a regulatory announcement that was rescinded last week is still active.

**This is precisely FAILURE-STORIES.md Story 2.** The emergency had been active for 18 days. No one remembered creating it. Everyone assumed someone else had cleared it.

**Fix (UX):** Emergency age must be prominently displayed wherever emergency status is shown. Automatic notification at +4 hours, +24 hours, +7 days if no operator action. Emergency management must be a primary navigation item, not buried in venue settings.

---

### M-05: "High priority means it will show"

**Misconception:** Setting high priority on content guarantees it will appear on screens.

**Reality:** "Priority" in the context of content items affects SWRR weight (how often the content appears within a playlist cycle) — it does not affect which rule wins the resolution decision. A "maximum priority" content item inside a campaign that is suppressed by an LEVEL_1 override will still not show.

**Fix (UX):** The "priority" or "weight" field for content items must be clearly labeled with its actual function: "Frequency weight — controls how often this item appears relative to others in this campaign." It must not be labeled "Priority" without qualification.

---

### M-06: "The CMS shows the current state of every screen"

**Misconception:** The CMS is a real-time view of what every screen is currently showing.

**Reality:** The CMS shows the current configuration state. Whether the configured content is actually being delivered depends on device connectivity, manifest polling cycle (15-second intervals), and delivery confirmation. A device that is offline may be showing stale content that differs from the current configuration.

**The confidence score is a trailing indicator** (INSIGHT-001 from OPERATIONAL-INSIGHTS-LOG.md). "Last known good" is not the same as "currently showing."

**Fix (UX):** The CMS must clearly distinguish between "configured to show" and "last confirmed showing." Confidence level indicators must use "last known good" language, not "currently showing" language. For screens with low or no recent delivery confirmation, an explicit indicator is required.

---

## Part 5 — Operator Behavior Under Stress

---

### 5.1 Event Pressure

**Context:** An operator is preparing for or managing a live event (tournament day, happy hour launch, compliance audit, sponsor visit). There is time pressure.

**Cognitive changes under event pressure:**
- **Scope narrowing:** The operator's attention focuses tightly on the immediate problem ("this screen needs to show the right content right now") and narrows away from system-wide implications ("but what else will this override affect?")
- **Decision shortcuts:** The operator uses the fastest available path, not the correct path. Override creation is faster than campaign review, so they create an override.
- **Verification skipping:** Under time pressure, operators skip verification steps ("I'll check it in a minute" — and then don't).
- **Confirmation bias:** If the screen shows the right content after an action, the operator concludes the action worked correctly, even if the content is showing for the wrong reason.

**Design response:** Event pressure is predictable. The UX should not attempt to slow operators down during event pressure — they will bypass any friction they perceive as unnecessary. Instead:
- Make the correct path as fast as the shortcut path
- Surface impact information inline with the override creation form (not on a separate confirmation screen)
- Provide a "tournament mode" or "event mode" shortcut that gives a venue-state summary in 2 taps

---

### 5.2 Emergency Cognition

**Context:** A genuine emergency is occurring (fire alarm, safety incident, violent incident, regulatory action). The operator must activate emergency content immediately.

**Cognitive state:** High arousal, narrow attention, impaired planning. This is the highest-stress scenario the system must accommodate.

**Cognitive changes under emergency conditions:**
- **Action bias:** The operator takes action immediately. Review is not happening.
- **Scope overestimation:** Under high arousal, operators tend to activate more broadly than needed ("activate emergency everywhere" is simpler to think about than "which specific screens need emergency content?")
- **Future-blindness:** The operator does not think about what happens after the emergency. They are handling the immediate situation. Expiry planning is cognitively unavailable.

**Design response:** Emergency activation UX must be designed for acute stress:
- The emergency activation path must be fast — no more than 3 taps from any screen
- Default scope should be minimum viable (selected screens or current zone), with explicit opt-in to expand scope
- Expiry selection must be required, with sensible defaults (2 hours, 4 hours, end of today, until cleared)
- "Until cleared" should be visually distinct from time-bounded options — it requires acknowledgment that the operator understands it won't auto-clear
- Post-activation: an automatic follow-up notification at configurable intervals for no-expiry emergencies

---

### 5.3 Interruption Panic

**Context:** An operator discovers mid-event that something is wrong with the content on a screen. They didn't plan for this. They are being observed by guests or supervisors.

**Cognitive state:** Acute embarrassment + time pressure + observed performance. This is different from emergency cognition — it is social pressure rather than safety pressure.

**Cognitive changes under interruption panic:**
- **Fix-it urgency:** The operator wants the problem to be visibly gone immediately. They will use any tool that makes the problem disappear, regardless of long-term implications.
- **Low explainability tolerance:** The operator is not in a state to read explanation text. They will tap through any confirmation dialog to get to the action.
- **Attribution confusion:** If multiple things are wrong, the operator may fix the visible symptom (wrong content on this screen) without understanding the cause (override that is also affecting ten other screens).

**Design response:**
- In urgency contexts, surface the action first and the explanation second
- But: the action itself must be correctly scoped. The "fix this screen" action in interruption panic must not silently affect other screens.
- Status icons (Section 4.4 of EXPLAINABILITY-UX-SPEC-v1.md) that are visible from any screen view allow operators to quickly assess the situation without navigating away

---

### 5.4 Sponsor Escalation Pressure

**Context:** A sponsor calls or is on-site and reports that their content is not showing. The operator who receives this call is under immediate social and business pressure to fix it.

**Cognitive state:** Social accountability + system uncertainty. The operator may not understand why the content isn't showing. They are being held accountable for a technical outcome they cannot explain.

**Cognitive changes under sponsor escalation pressure:**
- **Authority bypass tendency:** Operators under sponsor pressure often seek to escalate content to higher resolution levels — "If I make this an override, it will definitely show." This is correct behavior as a short-term fix; it becomes entropy if not cleaned up.
- **Diagnosis skipping:** The operator doesn't diagnose the root cause — they apply the fastest remedy that makes the sponsor satisfied. The root cause (an orphaned override from three months ago that is suppressing the sponsor injection) remains.
- **Permanent-temporary confusion:** The "fix" created under sponsor pressure (an operational override for the sponsor content) is intended as temporary but often has no expiry date, making it permanent.

**Design response:**
- When an operator views sponsor content that is not winning, surface the suppressor immediately with a clear fix path
- When creating an override to "fix" sponsor content, require an explicit expiry or "temporary fix" acknowledgment with an expiry recommendation
- Sponsor content suppression visibility (Part 6.4 of EXPLAINABILITY-UX-SPEC-v1.md) is the primary mitigation

---

## Part 6 — Workaround Genesis

---

### 6.1 Shadow Scheduling

**Definition:** Creating direct schedules for content instead of using the campaign system, because direct scheduling feels faster, simpler, or more certain.

**Genesis pattern:**
1. Operator needs to schedule content for a specific time window.
2. Campaign creation flow appears complex (multiple steps, targeting configuration, etc.).
3. Operator discovers they can create a schedule directly on a screen.
4. Direct schedule is created. Content shows. Operator's goal achieved.
5. Operator now has a mental model: "Direct scheduling is faster and it works."
6. For every future scheduling need, operator uses direct scheduling.
7. The screen accumulates multiple direct schedules with different time windows.
8. No operator has visibility into all the direct schedules that are active.
9. When content needs to change across multiple screens, the operator must update each screen individually — there is no campaign-level change.

**The shadow scheduling pattern is ENTROPY PATTERN C.** It is generated by a perceived UX failing: campaign creation is more friction than the operator's need justifies.

**Design response:** The campaign creation flow must be fast for simple cases. If creating a campaign for a single screen for a single time window requires fewer steps than creating a direct schedule, shadow scheduling is eliminated at the source. The correct path must be competitive with the shortcut path.

---

### 6.2 Override Folklore

**Definition:** Operators develop and transmit beliefs about system behavior that are incorrect, based on observed outcomes rather than system documentation.

**Examples of override folklore documented in REAL-WORLD-OBSERVATIONS.md:**
- OBS-014: "You need a level-5 priority to override the default schedule" (incorrect — resolution levels don't work this way)
- OBS-016: "If you delete and recreate a campaign, it refreshes" (incorrect — the PRE state hasn't changed)
- OBS-019: "You should always set priority to 10 to make sure it shows" (incorrect — priority affects SWRR weight only)

**Genesis pattern:**
1. Operator observes outcome X after performing action Y.
2. Operator infers that Y caused X.
3. Operator tells other operators: "If you need X, do Y."
4. Other operators follow this "trick" and observe that X sometimes follows Y (because other conditions were also correct).
5. The belief is reinforced.
6. The folklore spreads across venue operators and across time.

**Design response:** Folklore is defeated by explainability. When operators can see exactly why something happened (the PRE reason trace), they do not need to develop folklore explanations. The explainability system is the primary folklore prevention mechanism.

---

### 6.3 Override Addiction

**Definition:** An operator pattern where operational overrides are used for all content changes, regardless of whether the campaign system would be more appropriate, because overrides feel certain and campaigns feel uncertain.

**Genesis pattern:**
1. Operator creates a campaign. Content doesn't show as expected (suppressed by an override they don't know about).
2. Operator creates an override. Content shows immediately.
3. Operator concludes: "Overrides work. Campaigns don't."
4. All future content changes use overrides.
5. Override count accumulates. Override cleanup does not happen. Entropy accumulates.

**The key insight:** Override addiction is not caused by operator laziness or malice. It is caused by a real experience: the campaign didn't work, the override did work. The operator drew a rational conclusion from incomplete information. The missing information was: why the campaign didn't work (suppression by another override).

**Design response:** The moment an operator's campaign fails to win on a screen, the system must surface the suppressor. "Your campaign is not showing on [SCREEN] because [OVERRIDE] is active. [Remove the override] [Leave it — override is intentional]." This gives the operator a path that doesn't lead to override creation and prevents the campaign-failure experience that generates override addiction.

---

### 6.4 Semantic Drift

**Definition:** Over time, operators use emergency-level tools for non-emergency operational needs, because emergency tools are the most accessible "high authority" tools available.

**Genesis pattern:**
1. A genuine emergency requires immediate all-screens content change. Emergency content is activated.
2. The operator observes that emergency content immediately appears on all screens with certainty.
3. A few weeks later, a non-emergency but urgent situation arises (sponsor arrives unexpectedly, important guest requires attention). The operator wants content to show immediately.
4. The operator activates emergency content because it worked the last time they needed immediate certainty.
5. Over time, emergency tools become the go-to for any urgent situation, regardless of severity.
6. Emergency content now includes sponsor greetings and sports scores, not just safety announcements.
7. When a genuine emergency occurs, the emergency tool is already associated with routine operations — operators do not treat it with the required gravity.

**This is Emergency Semantic Collapse — one of the five entropy degradation patterns.**

**Design response:**
- Emergency activation must require a reason field that describes the nature of the emergency
- The reason field must be reviewed in entropy monitoring for non-emergency language (e.g., entries containing "sponsor," "event," "welcome" are flagged for operator review)
- Emergency tools must be visually and architecturally distinct from operational override tools — they must not feel like "urgent override" but like "emergency response system"

---

### 6.5 Knowledge Transfer Decay

**Definition:** When the operator who built a venue's configuration leaves, their institutional knowledge leaves with them. Their successor inherits a configuration state with no explanation of why anything was set up the way it was.

**Genesis pattern:**
1. An experienced operator spends months configuring a venue's CMS correctly.
2. The operator leaves (promoted, resigned, role changed).
3. Their configurations persist — campaigns, overrides, direct schedules.
4. The new operator sees: active campaigns, active overrides, direct schedules, but no explanation of why any of it exists.
5. The new operator makes changes without understanding the implications.
6. Entropy begins.

**This is OPERATIONAL-INSIGHTS-LOG.md INSIGHT-014 and FAILURE-STORIES.md Story 3 ("The Stale Golf Club").**

**Design response:**
- Provenance attribution (created by, creation date, last modified by) must be visible on every configuration object
- The off-boarding workflow (deactivate account → review configurations → transfer knowledge) is documented in INSIGHT-014 as pending — it requires CMS support for a structured review flow
- "Orphaned configurations" (active configurations created by accounts that are no longer active) should be flagged in entropy monitoring

---

## Part 7 — Trust Formation and Degradation

---

### 7.1 How Operator Trust Is Built

Operator trust in the ClubHub system forms through a cycle of:
1. **Prediction** — the operator expects the system to do X
2. **Action** — the operator configures the system
3. **Verification** — the operator checks whether X happened
4. **Confirmation** — X happened as expected

Each successful cycle builds trust. Trust accumulates over consistent correct predictions.

The critical point: **trust in the UX is built by the UX enabling accurate prediction, not by the system producing correct output**. If the output is correct but the operator couldn't predict it, trust does not build — the operator feels lucky rather than in control.

**The explainability system is a trust-building system.** It enables prediction by explaining the model. When operators can predict what will happen, and then verify that their prediction was correct, trust builds reliably.

---

### 7.2 How Operator Trust Is Lost

Trust in the ClubHub system degrades through three primary mechanisms:

**Mechanism 1: Unexplained divergence**
The operator predicted X. The system produced Y. No explanation was offered.
Effect: The operator concludes the system is unpredictable. They respond by over-engineering configurations ("I'll add multiple rules to make sure one of them works").

**Mechanism 2: Confirmed folklore**
The operator's incorrect mental model led to an action that appeared to work (for the wrong reason).
Effect: The incorrect mental model is reinforced. The operator continues using the workaround. The workaround generates entropy.

**Mechanism 3: Preview failure**
The preview showed X. The screen showed Y. (FAILURE-STORIES.md Story 7)
Effect: This is the most catastrophic trust failure. It does not just erode trust in the preview — it erodes trust in all predictive features of the system. "The previews lie" becomes institutional knowledge at that venue.

**Design implication:** Trust, once lost for mechanism 3, is extremely difficult to recover. The preview system's non-negotiable accuracy requirement (PREVIEW-SYSTEMS-SPEC-v1.md §6.1 Safety Rule S-01) is not a technical standard — it is a trust preservation requirement.

---

### 7.3 How Operator Trust Is Recovered

When trust has degraded (operator is in over-override mode, using workarounds, not using campaigns correctly), recovery requires:

1. **Visible system diagnosis:** The operator must be able to see why the system has been behaving the way it has. "Your venue has 14 active overrides, 3 of which are over 90 days old. These are likely suppressing your campaigns." This surfaces the systemic issue.

2. **Successful accurate prediction:** The operator needs a low-stakes experience of using the correct workflow, making a prediction, and having it be correct. Once the correct workflow is experienced as reliable, trust begins to rebuild.

3. **Override cleanup with explanation:** Removing orphaned overrides requires understanding why they exist (or don't exist for any valid reason) and confirming it is safe to remove them. The UX must support this review-and-cleanup workflow.

Trust recovery is a workflow, not a design choice. See DESIGN-PRINCIPLES-FOR-OPERATIONS.md §9 (Onboarding and Training Principles) for related design guidance.

---

## Part 8 — Training Implications

---

### 8.1 Onboarding Needs by Role

**Floor Operators:** The most critical onboarding need is understanding the resolution hierarchy in plain language. Not as a technical diagram — as a mental model: "Things that take priority over your campaigns, in order." If a Floor Operator leaves onboarding without understanding that an operational override can suppress their campaign, every subsequent entropy pattern becomes possible.

**Venue Managers:** Critical onboarding need: understanding the difference between "configured" and "winning." The Venue Manager must understand that a campaign's "Active" status does not guarantee delivery. They must be able to navigate to the suppression view.

**Sponsorship Managers:** Critical onboarding need: understanding LEVEL_4 and what can suppress it. Sponsor content is at LEVEL_4 — below operational overrides (LEVEL_1) and scheduled overrides (LEVEL_2). If a venue has active overrides, sponsor content will not show during those override windows. This is expected system behavior, not a bug.

**Network Operations:** Critical onboarding need: entropy metrics and how to interpret them. Network Operations operators need to understand what the entropy signals mean and how to investigate specific venues.

---

### 8.2 Replay-Based Education

The PRE's determinism (INV-3) makes replay-based training possible: operators can observe the resolution trace for historical scenarios and work backwards from the outcome to understand why it happened.

**Replay-based training scenarios (proposed):**
- "The Campaign That Wasn't Showing" — operator diagnoses a suppression scenario using the resolution trace
- "The Emergency That Persisted" — operator investigates a 3-week-old emergency and clears it
- "The Priority Wars" — operator sees what happens when SWRR weights are all set to maximum

These scenarios can be run against production-like data with anonymization, or against purpose-built training fixtures. They teach diagnostic skills, not just configuration skills.

---

### 8.3 Simulation-Based Training

Before an operator makes their first real configuration change, they should have access to a sandbox environment where:
- All 7 resolution levels are represented
- They can create overrides and see their effect on campaigns in real time
- They can activate and clear emergencies
- They can see the PRE resolution trace for their changes

Simulation-based training reduces the cost of misconceptions — operators can experience the "I tried to change priority and nothing happened" failure in a safe environment where they can investigate rather than in a live venue where they will create a workaround.

---

### 8.4 Operational Literacy Framework

Operational literacy for ClubHub TV has three levels:

**Level 1 — Configuration literacy:** Can create campaigns, overrides, and emergency content. Understands how to use the CMS tools.

**Level 2 — Resolution literacy:** Understands the resolution hierarchy and can predict what will show on a screen. Can identify suppressors. Uses the preview system for verification.

**Level 3 — Entropy literacy:** Understands how operator behavior affects long-term system health. Can identify entropy signals. Actively cleans up orphaned configurations.

**Design goal:** The UX must enable Level 2 literacy for all operators, and make Level 3 literacy accessible for Venue Managers and above. Level 1 literacy is necessary but not sufficient for correct operations.

A Floor Operator who has only Level 1 literacy will reliably generate entropy. A Venue Manager who has Level 2 literacy but not Level 3 will not detect entropy accumulation. Only Level 3 literacy produces self-sustaining, low-entropy venue operations.

---

*End of OPERATOR-COGNITIVE-MODELS-v1.md*
*Document authority: Agent 3 (UX/Design)*
*Knowledge status: OPERATIONAL — structural inference and analogous evidence; field validation pending*
*Review required for operational workflow accuracy: Agent 2 (CMS)*
*Do not promote misconception descriptions to CANONICAL without field validation*
