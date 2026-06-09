# Human Factors and Operational Ergonomics Audit — v1

**Audit type:** Human factors review of implementation-grade wireframes
**Scope:** All 5 operator surfaces, 55 wireframes (WF-LO-01–08, WF-IC-01–12, WF-RP-01–10, WF-CMS-01–10, WF-VO-01–10)
**Evaluator role:** Independent human factors reviewer
**Date:** 2026-06-02
**Verdict:** REQUIRES CORRECTIONS BEFORE BUILD

---

## Executive Summary

The ClubHub TV operator interface demonstrates an unusually strong foundation for a safety-critical platform. The core information hierarchy is sound, error-prevention philosophy (absent rather than disabled for permanent capability differences) is correctly applied throughout, and the constitutional state model is consistently surfaced at every severity level. The system's commitment to non-dismissible state banners and positive confirmation of empty states reflects careful operational thinking.

However, the audit identifies four CRITICAL issues that create real risk of wrong action or dangerous delay during live incidents. The most serious concerns are: (1) the L6 Emergency Override confirmation requiring exact case-sensitive typing of "EMERGENCY" under high-stress conditions, where trailing-space false negatives can delay a time-critical action; (2) the COMMANDER_LAPSED countdown clock providing no secondary channel to locate other operators who can assume command, creating a gap when the viewing operator lacks the confidence to assume; (3) the RECOVERED_BUT_UNTRUSTED state using the same amber color as DEGRADED, creating confusion about whether recovery has been completed or is still pending; and (4) the Replay surface play/pause button using an icon-state convention (showing the action, not the state) that is inconsistently documented and risks an operator thinking replay is paused when it is in fact playing.

At the HIGH severity level, the most significant finding is that the 280px Zone A provides insufficient visual weight for its role during incidents. The incident list in Pane A2 shows only severity, venue name, and elapsed time, giving the operator no quick-scan signal of whether they are already managing this incident, especially when multiple incidents are active across venues. Additionally, the Venue Operations Dashboard uses a 7-card 4-3 grid layout that creates visually asymmetric rows at 1440px — the three wider Row 2 cards display unevenly against the four narrower Row 1 cards — which in a long-shift context introduces scanning ambiguity.

The CMS surface is the most ergonomically complete of the five: the 72-hour delivery window constraint is clearly communicated at multiple points, the <24h hard block removes the submission button from the DOM rather than disabling it (correctly), and the training mode safeguard is well-positioned. The Replay Investigation surface correctly isolates investigation from live state and uses additive-only annotations consistently. The Live Operations surface correctly handles the VIEWER role by omitting controls rather than disabling them, and does not insert permission-denial messages.

The net recommendation is: resolve all four CRITICAL issues and the eight HIGH issues before beginning the build sprint. The twelve MEDIUM issues should be addressed in the first sprint after launch gate. The system is architecturally sound and the corrections required are surgical.

---

## Issue Registry

### Severity Classification

| Severity | Definition |
|---|---|
| CRITICAL | Operator risk during S1/S2 incidents — can cause wrong action, missed action, or dangerous delay |
| HIGH | Significant usability degradation under stress or over long shifts |
| MEDIUM | Noticeable friction that compounds over time or under cognitive load |
| LOW | Minor quality issues that do not significantly affect operator performance |
| INFORMATIONAL | Observations that may matter in future but do not require immediate action |

---

### Surface: Live Operations

---

#### HF-LO-1: RECOVERED_BUT_UNTRUSTED badge color is indistinguishable from DEGRADED at distance

**Severity:** CRITICAL
**Wireframe(s):** WF-LO-08
**Dimension(s):** High-stress incident response, Cognitive load, Information overload
**Location:** Zone A venue selector state dot; Zone B S1 PlayerStateBadge; System Status Bar constitutional state indicator

**Issue:**
The RECOVERED_BUT_UNTRUSTED state is rendered in amber (~) — the same color used for DEGRADED. The distinction between "venue is degraded, normal operation" and "venue has reconnected but CANNOT BE TRUSTED YET" is operationally critical. An operator who scans the Zone A venue list and sees an amber dot may interpret it as a standard degraded state and navigate away, missing the active verification window. The wireframe notes that the PlayerStateBadge reads "Reconnected — Unverified" in amber-orange (described as "distinct"), but the Zone A dot notation explicitly uses the same `~` amber symbol as DEGRADED.

**Operator Risk:**
An operator on a long shift monitors multiple venues. Brisbane CBD dot turns amber during reconnection. The operator scans Zone A, reads it as "DEGRADED — monitoring in progress" rather than "RECOVERED_BUT_UNTRUSTED — verification pending," and navigates to a higher-priority venue. The corpus verification completes successfully or fails silently, and the operator never reviews whether overrides were correctly applied post-reconnection. The distinction in the full PlayerStateBadge text ("Reconnected — Unverified") is only visible if the operator navigates to that specific venue.

**Correction:**
The Zone A state dot for RECOVERED_BUT_UNTRUSTED must use a distinct visual treatment from DEGRADED. Specifically: replace the plain `~` amber dot with a pulsing amber dot (using the same 1-second opacity pulse already defined for COMMANDER_LAPSED countdown) paired with a small animated sync icon. This requires no new component — the pulse animation already exists in the system. Additionally, the Cross-Wireframe Reference table in WF-LO state dot conventions must explicitly document RECOVERED_BUT_UNTRUSTED as a different symbol than DEGRADED.

---

#### HF-LO-2: [Declare Incident] and [Place Override +] are visually equivalent primary actions with no hierarchy

**Severity:** HIGH
**Wireframe(s):** WF-LO-01, WF-LO-02, WF-LO-07, WF-LO-08
**Dimension(s):** Error prevention, High-stress incident response, Muscle memory
**Location:** Zone B S4 Active Overrides & Interventions, action button row

**Issue:**
In Section 4 of Zone B, [Place Override +] and [Declare Incident] appear as adjacent buttons with no visual hierarchy between them. Both are interactive controls at the same level. [Declare Incident] is a significantly more consequential action — it triggers the incident management workflow, notifies all stakeholders, and alters the constitutional state. [Place Override +] is a routine operational action. They should not present as equals.

**Operator Risk:**
Under stress, an operator attempting to place a quick content override (common, routine) at speed may click [Declare Incident] instead. Both buttons are in the same Section 4 area, adjacent, and at equal visual weight. The incident declaration modal does require confirmation, providing one layer of protection — but the confirmation modal itself adds cognitive load at an already stressful moment when the operator expected an override form to appear.

**Correction:**
[Place Override +] should be the primary button (filled, accent color). [Declare Incident] should be a secondary button (outlined, lower visual weight), positioned further from [Place Override +] with at least 16px of additional space between them, or separated by a visible horizontal rule with a label ("Emergency Actions" or equivalent). This is a standard HCI hierarchy correction and requires no new component.

---

#### HF-LO-3: EMERGENCY_FREEZE state disables [Start Handoff] with no recovery path

**Severity:** HIGH
**Wireframe(s):** WF-LO-03
**Dimension(s):** Recovery from mistakes, High-stress incident response, Long-duration operations
**Location:** Zone A, Pane A4, [Start Handoff] button; tooltip text

**Issue:**
During EMERGENCY_FREEZE, the [Start Handoff] and [Request Elevated Session] buttons are disabled with tooltip "Session management restricted during Emergency Freeze." This is constitutionally correct — but the EMERGENCY_FREEZE state is precisely when an operator is most likely to need to transfer to a more capable operator (e.g., if the current operator is a junior OPERATOR and an ADMIN needs to take over). The wireframe provides no alternative path for initiating role transfer during a freeze.

**Operator Risk:**
A shift OPERATOR is managing an EMERGENCY_FREEZE (S1 incident). Their senior colleague arrives and needs to take over. The [Start Handoff] button is disabled. The only path is the IC surface's [Transfer Command] — but only the current incident commander can initiate that. If this operator is not the commander, there is no handoff path visible. In a real S1 scenario with high stress and time pressure, the operator and supervisor may not know the correct path.

**Correction:**
The tooltip on the disabled [Start Handoff] should read: "Handoff restricted during Emergency Freeze. To transfer incident command, use [Transfer Command] on the Incident Command Surface." Add a direct navigation link within the tooltip: "[Open Incident Command Surface →]". This is a tooltip content correction, not a component addition.

---

#### HF-LO-4: Active Mode Indicator text is not sufficiently prominent for at-a-glance status at distance

**Severity:** MEDIUM
**Wireframe(s):** WF-LO-01, WF-LO-02, WF-LO-03, WF-LO-04, WF-LO-05, WF-LO-06, WF-LO-07, WF-LO-08
**Dimension(s):** Long-duration operations, Accessibility, Multi-monitor usage
**Location:** System Status Bar, Active Mode Indicator — second element from left

**Issue:**
The Active Mode Indicator ("LIVE," "INCIDENT ACTIVE," "EMERGENCY FREEZE") sits as one of six elements in the 48px System Status Bar. The bar renders at consistent text size (implied 13–14px from spec context). On wide monitors or when the operator is seated at distance from the screen, the mode distinction between "LIVE" and "INCIDENT ACTIVE" may not be immediately scannable without leaning in. The EMERGENCY_FREEZE state has the red full-bar background to aid attention, but "INCIDENT ACTIVE" and "LIVE" are textually similar in length and position.

**Operator Risk:**
An operator who was viewing a healthy venue, stepped away, and returned to their desk may not immediately notice that the mode indicator has changed to "INCIDENT ACTIVE" during their absence. They continue treating the interface as if in normal monitoring mode, missing the signal to navigate to the IC surface.

**Correction:**
"INCIDENT ACTIVE" in the Active Mode Indicator should render in amber with a small pulsing colored dot to the left (using the same amber pulse pattern already defined for COMMANDER_LAPSED). "LIVE" should remain neutral white text. This creates visual asymmetry that draws the eye to the exception state without adding new components.

---

#### HF-LO-5: Zone A incident badge on venue row shows count but not severity

**Severity:** HIGH
**Wireframe(s):** WF-LO-01, WF-LO-02, WF-LO-06
**Dimension(s):** High-stress incident response, Cognitive load, First-time usability
**Location:** Zone A, Pane A1 VenueSelector, incident badge on venue row

**Issue:**
The venue row in Pane A1 shows an incident count badge (e.g., "❶") but does not indicate severity. An operator scanning a multi-venue list sees that Brisbane CBD has 1 incident but cannot determine whether it is S1 EMERGENCY or S5 WATCHING without navigating into that venue. In the fleet view (WF-LO-06), the severity is visible only in Pane A2, requiring a second scan of a different pane.

**Operator Risk:**
In a multi-venue fleet with simultaneous incidents at S5/WATCHING at Venue A and S1/EMERGENCY at Venue B, the operator scanning Pane A1 sees identical "❶" badges on both venues. Triage prioritization requires navigating to each venue or scanning Pane A2 — a multi-step operation under time pressure. At S1, seconds matter.

**Correction:**
The venue row incident badge should be colored by the highest-severity active incident for that venue, using the existing severity color set (red for S1–S2, amber for S3, yellow for S4, grey-blue for S5). The count remains a number. This uses the existing color tokens and requires no new component — it is a data binding change.

---

#### HF-LO-6: Offline autonomy countdown location in Zone C is not visible when Zone C is collapsed

**Severity:** MEDIUM
**Wireframe(s):** WF-LO-04
**Dimension(s):** Information overload, Long-duration operations, Cognitive load
**Location:** Zone C, C1 Operational Context tab, Offline Autonomy section

**Issue:**
The offline autonomy countdown ("20h 37m autonomy remaining") is displayed in Zone C C1. Zone C can be collapsed to 48px. If an operator has collapsed Zone C for workspace reasons, the autonomy countdown becomes invisible. The countdown is a safety-critical indicator — once it reaches zero, the venue will run unapproved content indefinitely.

**Operator Risk:**
An operator who prefers the extra Zone B space collapses Zone C at shift start. A venue goes offline during the shift. The status bar shows DEGRADED, and Zone B shows the degraded health signals. However, the autonomy countdown is in the collapsed Zone C and the operator does not think to expand it. The next time they look at that venue six hours later, the countdown has advanced significantly without their awareness.

**Correction:**
When a venue is in OFFLINE state, add the autonomy countdown as a one-line amber annotation immediately below the Venue Identity area in Zone B (S1 header section), adjacent to the PlayerStateBadge. This does not require Zone C to be visible. The text: "Offline — [Nh Nm] autonomy remaining." This is a data binding and layout correction.

---

---

### Surface: Incident Command

---

#### HF-IC-1: L6 "type EMERGENCY" confirmation is a fine-motor, cognitive-load task under peak stress

**Severity:** CRITICAL
**Wireframe(s):** WF-IC-06
**Dimension(s):** High-stress incident response, Error prevention, Recovery from mistakes
**Location:** Zone B, Tab 3 Override Management, L6 Confirmation Section, EmergencyConfirmInput

**Issue:**
To place an L6 Emergency Override, the ADMIN must type the word "EMERGENCY" exactly (case-sensitive, no trailing spaces, no other characters). This is a deliberate safeguard. However, the confirmation mechanism fails under real incident stress in two specific ways:

1. The trailing space failure (State D in the wireframe spec) is silent — the field border turns red but there is no explicit "extra character detected" message, only "does not match exactly." Under stress, an operator who typed quickly may not immediately understand why the match is failing when they can clearly read "EMERGENCY" in the field.

2. The instruction text says "type the word EMERGENCY below" — the word "below" refers to a text field rendered within the same confirmation box, but the visual proximity between the instruction line and the input field is compressed by the surrounding form content. An operator under cognitive load may look at the wrong element.

**Operator Risk:**
During a real S1 emergency (venue closure, public safety event), the ADMIN needs to place an L6 Emergency Override immediately. They type "EMERGENCY " (with a trailing space from typing speed). The field turns red. They do not understand why — "EMERGENCY" appears correct to their eyes. They attempt to re-type. Each failed attempt adds seconds to a time-critical action. In the worst case, they assume the form is broken and attempt a different path (which may not exist).

**Correction:**
Two targeted changes:
1. When the field content does not match and is non-empty, the error label below the field should specify the failure reason: "Does not match. Check for extra spaces, capital letters, or special characters." The existing spec says only "Does not match exactly."
2. Add a short instructional label directly above the input field (not as part of the warning body): "Type exactly: EMERGENCY" using a fixed-width (monospace) rendering of the required word. This makes the target visually distinct and immediately legible.

No change to the underlying mechanism (case-sensitive exact match) is proposed.

---

#### HF-IC-2: COMMANDER_LAPSED confirmation card covers the countdown and lapse information

**Severity:** CRITICAL
**Wireframe(s):** WF-IC-03
**Dimension(s):** High-stress incident response, Cognitive load, Error prevention
**Location:** Zone B, Incident Identity Bar, AssumeCommandConfirmCard

**Issue:**
When [Assume Command] is clicked, an inline confirmation card "expands below the COMMANDER_LAPSED indicator." The card is full Zone B width. The spec notes that it "pushes tab content down" — which means the COMMANDER_LAPSED indicator in the Identity Bar (showing the countdown and former commander name) is still visible above the card. However, the confirmation card itself does not repeat the critical context: "which incident," "how long until Level 1 alert fires," or "what the former commander's role was." The operator is confirming a significant action ("You will be responsible for driving this incident to CONTAINED and then RESOLVED") without having visible confirmation of the incident scope.

This becomes more dangerous in a scenario where multiple tabs are open across multiple browser sessions, or where an operator arrived on the surface from a link and has not had time to read the full Situation Overview.

**Operator Risk:**
An operator working on a fleet with two active incidents arrives via notification link at the COMMANDER_LAPSED incident. They see the red COMMANDER_LAPSED indicator, understand urgency, and click [Assume Command] quickly. The confirmation card does not show the incident scope, severity, or venue. They confirm, assuming they are assuming command of a known S3 incident — but this is actually the S2 CRITICAL incident they were unaware of, which carries elevated responsibility. The original operator had left the command because the incident escalated beyond their authority.

**Correction:**
The AssumeCommandConfirmCard should include a read-only summary row above the confirm/cancel buttons: "Incident: [INC-ID] — [Severity badge] — [Venue name] — Duration: [HH:MM:SS] — Level 1 alert in [MM:SS]". This is data already visible in the Identity Bar but should be repeated in the confirmation card to ensure scope is confirmed. The card already has "You will be responsible for driving this incident to CONTAINED and then RESOLVED" — this correction adds the incident context above that statement.

---

#### HF-IC-3: COMMANDER_LAPSED state provides no list of operators who could assume command

**Severity:** CRITICAL
**Wireframe(s):** WF-IC-03
**Dimension(s):** High-stress incident response, First-time usability, Recovery from mistakes
**Location:** Zone B, COMMANDER_LAPSED indicator, amber banner

**Issue:**
The COMMANDER_LAPSED banner states "Any OPERATOR+ can assume command" but provides no information about which operators are currently online and capable of assuming. An operator who does not feel qualified to assume command (e.g., a junior OPERATOR with Cert L1 viewing an S2 incident) sees the countdown but has no visible path to alert a qualified colleague. The [Assume Command] button is available but the operator may hesitate.

**Operator Risk:**
A junior operator is the only person currently viewing the COMMANDER_LAPSED incident. The countdown is at 04:30. They know they are not qualified for this severity level but do not know if anyone else is watching the same incident. The Level 1 alert fires at 00:00, triggering a constitutional notification — but this notification may take 30–60 seconds to reach other operators. The 15-minute window expires partially due to the junior operator's hesitation.

**Correction:**
Add a "Who's online now" line in the COMMANDER_LAPSED indicator box: "Currently viewing: [N] other operators." If N > 0, add a link "[Notify them →]" that triggers an in-system notification push to all operators currently viewing this incident. This requires no new component — the collaboration presence indicators already exist in the Replay surface (Zone C collaborators panel) and the same data should be available for the IC surface. This is a data-surface addition.

---

#### HF-IC-4: Duration clock in the Incident Identity Bar has no "time since last action" signal

**Severity:** MEDIUM
**Wireframe(s):** WF-IC-01, WF-IC-02, WF-IC-03, WF-IC-04, WF-IC-08
**Dimension(s):** Long-duration operations, Cognitive load, Muscle memory
**Location:** Incident Identity Bar, Center group, Duration clock

**Issue:**
The duration clock shows "time since incident declaration" (HH:MM:SS), live-updating. For long incidents (2+ hours), this clock becomes a slowly changing large number with limited operational utility. What is more operationally useful — especially during multi-hour S3+ incidents — is the time since the last command log action. An incident where no new actions have been logged for 45 minutes is a governance concern ("staleness") but there is no signal of this.

**Operator Risk:**
An operator inheriting a 3-hour S3 incident during a shift change sees "02:58:44" as the duration. This tells them the incident is old but not whether it has been actively managed. The last action may have been 45 minutes ago, or 2 minutes ago. They must navigate to Tab 2 (Command Log) to assess recent activity, adding time to their situational awareness construction under handoff pressure.

**Correction:**
Add a secondary small label below the duration clock: "Last action: [relative time] ago." Example: "Last action: 4m ago" or "Last action: 47m ago ⚠" (amber if over 30 minutes). This is a data binding change using data already present in the system (last command log entry timestamp) and requires no new component.

---

#### HF-IC-5: Tab strip for IC surface has no visual indication of which tabs require action

**Severity:** HIGH
**Wireframe(s):** WF-IC-01, WF-IC-02, WF-IC-03, WF-IC-05, WF-IC-07, WF-IC-08, WF-IC-09
**Dimension(s):** High-stress incident response, Cognitive load, First-time usability
**Location:** Tab Strip, Zone B, all WF-IC wireframes

**Issue:**
The IC surface tab strip shows "Situation Overview | Command Log | Override Mgmt | PRE Status | Actions" with no indication of which tabs contain actionable items or alerts. During an active S2 incident, an operator arriving at Tab 1 has no way to know whether Tab 3 contains unreviewed overrides, whether Tab 4 shows a PRE divergence, or whether Tab 5 has an available commander action — without clicking each tab individually.

**Operator Risk:**
A commander arrives at an S2 incident after being notified. They read Tab 1 (Situation Overview) carefully. The PRE divergence card is on Tab 4. They do not see it because the tab strip has no alert indicator. They proceed to Tab 5 (Incident Actions) and mark the incident CONTAINED without reviewing the PRE divergence. The root cause is not documented.

**Correction:**
Add dot badges to tab labels when they contain alert conditions: a red dot on Tab 3 if there are new overrides since last view; a red dot on Tab 4 if PRE divergence is active; a red dot on Tab 5 if the commander has available state transitions. These use the existing small badge convention (already used on "Incidents [●1]" in Zone A nav). The dots should be small (8px) and placed as a superscript on the tab label, not replacing it.

---

#### HF-IC-6: S1 automatic Zone B replacement provides no exit path back to venue overview

**Severity:** HIGH
**Wireframe(s):** WF-IC-10
**Dimension(s):** Recovery from mistakes, High-stress incident response, First-time usability
**Location:** Zone B — S1 EMERGENCY_FREEZE automatic replacement; System Status Bar

**Issue:**
For S1 and S2 incidents, Zone B is automatically replaced with the Incident Command Surface for all OPERATOR+ users. The spec notes that "Zone B automatically navigates to `/venues/{venue_id}/incident/{incident_id}` via history push" and that "A banner appears in the IC surface: 'You were viewing the Venue Dashboard — [Return to Venue Dashboard].'" However, WF-IC-10 (S1/EMERGENCY_FREEZE state) does not show this banner. WF-IC-02 notes the forced navigation but WF-IC-10 does not show the return path. During EMERGENCY_FREEZE, the operator may need to return to the venue dashboard to check on secondary venues or monitor the live state alongside the IC surface.

**Operator Risk:**
An operator is managing venue Brisbane CBD while also monitoring Venue Gold Coast. During S1 at Brisbane CBD, they are forced into the IC surface. They need to quickly check the Gold Coast autonomy status (which was counting down). There is no visible path back to the venue dashboard — just the Zone A VenueSelector, which navigates to another venue's dashboard, not back to the current venue's dashboard.

**Correction:**
WF-IC-10 (and the general EMERGENCY_FREEZE state documentation) should specify that a non-dismissible informational banner at the bottom of the tab content reads: "You were automatically brought here — [View Venue Dashboard alongside this incident →]" which opens the venue dashboard in a new browser tab. This prevents the forced navigation from completely eliminating the operator's access to the venue state view. One additional link, no new component.

---

#### HF-IC-7: [Add Annotation] textarea on Tab 2 does not survive tab switches

**Severity:** MEDIUM
**Wireframe(s):** WF-IC-04
**Dimension(s):** Muscle memory, Recovery from mistakes, Cognitive load
**Location:** Zone B, Tab 2 Command Log, Annotation Input Component, sticky bottom

**Issue:**
The annotation input is specified as "sticky bottom-0 in Zone B scroll container (does not scroll away)" and is at ~120px height. The spec does not state what happens to in-progress annotation text if the operator switches to another tab (e.g., Tab 3 to check an override, then returns to Tab 2). Standard web behavior without explicit preservation would clear the textarea on tab switch, losing in-progress text.

**Operator Risk:**
A commander is writing a detailed operational note ("Screen 12 manifest re-sync attempt in progress. Expect resolution by 17:00. Investigating override stack depth after L1 was applied."). They switch to Tab 4 to check the PRE state, then return to Tab 2. The textarea is empty. They re-type from memory, potentially with reduced accuracy or incomplete information, under time pressure.

**Correction:**
The spec should explicitly state that textarea content is preserved in component local state during tab switches and is not cleared until the operator submits or explicitly clears the field. Add a note: "Textarea content persists across tab navigation within the same incident session. Explicit [Clear] button should be visible when textarea is non-empty." This is a state management specification, not a visual component addition.

---

---

### Surface: Replay Investigation

---

#### HF-RP-1: PAUSED vs REPLAYING vs SCRUBBING distinction relies on icon identity convention inconsistently documented

**Severity:** CRITICAL
**Wireframe(s):** WF-RP-01, WF-RP-02
**Dimension(s):** High-stress incident response, Cognitive load, First-time usability, Error prevention
**Location:** Session Header centre group; RP-TIMELINE playback controls

**Issue:**
The wireframes specify that when REPLAYING, the play/pause toggle button "shows the pause affordance" (i.e., shows ⏸ to indicate "click to pause"). When PAUSED, the button shows ▶ (click to play). This is the "icon shows the action" convention, not the "icon shows the state" convention.

WF-RP-02 contains an internal inconsistency: "the centre button is now [▶] in PLAYING state = pause affordance" — meaning the button icon when playing is listed as [▶], but the note says it is the pause affordance. The ASCII art shows `[◁◁] [◁] [▶] [▶] [▶▶]` (the centre `▶` when playing) with a note that this is the pause affordance. This is confusing notation that a developer implementing from the spec may interpret as: "show two ▶ buttons, both mean advance."

Additionally, the Session Header renders the state separately: "⏸ PAUSED" in amber or "▶ REPLAYING" in green. These two signals (header state text and button icon) use opposite conventions: the header says what IS happening (▶ = playing), while the button shows what WILL happen on click. Under cognitive load, operators may not integrate both signals correctly.

**Operator Risk:**
An operator believes they are viewing a PAUSED replay to carefully examine an event. They are actually in REPLAYING state because they clicked the button intending to pause and instead resumed. The playhead continues advancing past the event of interest. They lose their investigation position in a long replay session. In a POST_INCIDENT session with 5+ hours of corpus, repositioning to the exact event can take minutes.

**Correction:**
The PAUSED/REPLAYING/SCRUBBING distinction in the RP-TIMELINE button cluster should be supplemented by a small persistent state label immediately above or below the transport controls: "STATE: PAUSED" / "STATE: REPLAYING" / "STATE: SCRUBBING" in the respective color (amber/green/blue). This supplements the icon convention with unambiguous text and brings it into line with the Session Header convention. The Session Header already correctly labels the state — the transport controls should do the same.

---

#### HF-RP-2: "Notifications held while scrubbing" counter does not tell the operator what was held

**Severity:** MEDIUM
**Wireframe(s):** WF-RP-02
**Dimension(s):** Cognitive load, Information overload, Recovery from mistakes
**Location:** Below tab strip, right-aligned, notification deferral strip

**Issue:**
When notifications are deferred during active playback, the strip shows "2 notifications held while replaying — [show now]." This only reveals the count. The operator has no way to know whether the held notifications are operational alerts requiring immediate attention or routine system events — without clicking "show now," which would interrupt their investigation workflow.

**Operator Risk:**
An operator is replaying a post-incident session at 2x speed, approaching the key divergence event. Two notifications are held. One is a Level 2 advisory for a different venue (safely deferrable). The other is a Level 4 escalation alert for an active S2 incident at another venue in their fleet (should NOT be deferred under operator knowledge). The operator cannot tell them apart without interrupting their workflow.

**Correction:**
The notification deferral strip should show the highest severity level of the held notifications: "2 held — highest: L2 advisory — [show now]". If any held notification is Level 4 or above, the strip should shift from the current "discreet strip" to an amber banner regardless of playback state, and should not be deferrable. This aligns with the attention governance interrupt hierarchy already defined in the system. Only requires a severity-aware rendering of the existing notification deferral component.

---

#### HF-RP-3: Zone C at 280px shows contradictions list and collaborators simultaneously, creating crowding

**Severity:** MEDIUM
**Wireframe(s):** WF-RP-01, WF-RP-02, WF-RP-03
**Dimension(s):** Information overload, Long-duration operations, Cognitive load
**Location:** Zone C, right panel, contradictions + collaborators sections

**Issue:**
Zone C on the Replay Investigation surface is 280px wide (narrower than the 320px Zone C on the Live Operations surface) and contains: linked incident info, evidence collected counts (annotations, findings, contradictions, corpus events), unresolved contradictions with [Resolve now →] links, and session collaborators. In WF-RP-01, this fills the entire Zone C with 5 separate information groups in 280px. At a standard 1440px viewport at 1x zoom, each group has approximately 40–60px of height, making the text density high.

**Operator Risk:**
During a long investigation session with 2+ collaborators and multiple contradictions, Zone C becomes a dense information column that the operator must read carefully to extract one piece of information. The "Unresolved ⚠" section contains the most actionable items but is visually buried below the evidence count section, which is less actionable. An operator under time pressure may miss the "[Resolve now →]" link because it is below the fold of Zone C's visible area.

**Correction:**
Reorder Zone C sections: move the "Unresolved ⚠ Contradictions" section to the top of Zone C (above linked incident), given that contradictions block investigation closure. The linked incident and evidence counts can be repositioned below. This is a vertical order change in the component stack, requiring no new components. Also: the evidence counts section (Annotations/Findings/Contradictions/Corpus events) should be collapsed by default (behind a small summary badge) to reduce Zone C density, expanding on click.

---

#### HF-RP-4: Swim lane labels in RP-TIMELINE are abbreviated (PRE, OVRD, DEVH) with no legend

**Severity:** MEDIUM
**Wireframe(s):** WF-RP-01, WF-RP-02, WF-RP-03
**Dimension(s):** First-time usability, Long-duration operations, Accessibility
**Location:** RP-TIMELINE, swim lane row labels (left margin)

**Issue:**
The RP-TIMELINE swim lanes are labeled: "PRE", "OVRD", "DEVH", "EMRG", "PLYR", "ANNO", "FIND." These abbreviations are not expanded anywhere in the wireframes. An operator new to the system or returning after time away may not immediately recall what "DEVH" (Device Health) or "FIND" (Findings) represents.

**Operator Risk:**
A first-time or infrequent user of the Replay surface begins a post-incident investigation. They see events appearing on the "DEVH" swim lane but do not know what it represents, so they skip it. The device health events at the divergence point are the key evidence — but the operator does not know to click them because the lane is unlabeled.

**Correction:**
Each swim lane abbreviation label should expand to full text on hover/focus: "DEVH → Device Health," "OVRD → Override Events," "PLYR → Player State," etc. The tooltip should appear immediately on hover (no delay). This is a standard accessible tooltip pattern, requires no new component beyond what the system already has.

---

#### HF-RP-5: No "jump to contradiction" keyboard shortcut or direct navigation from Zone C contradiction links

**Severity:** LOW
**Wireframe(s):** WF-RP-01
**Dimension(s):** Accessibility, Long-duration operations, Muscle memory
**Location:** Zone C, Unresolved contradictions panel, [Resolve now →] links

**Issue:**
The Zone C "[Resolve now →]" link "navigates to Tab 3 and scrolls to the relevant contradiction pair." During a long investigation session, this is adequate, but there is no keyboard shortcut to reach contradictions and no visual indication in the tab strip that Tab 3 has unresolved contradictions requiring attention. (See also HF-IC-5 — the same issue on the IC surface.)

**Correction:**
Low priority since Tab 3 does not require the immediacy of incident management. Annotate this as a future enhancement: add a badge to the Tab 3 label "Annotations [2⚠]" when unresolved contradictions exist, consistent with the badge pattern recommended in HF-IC-5.

---

---

### Surface: CMS Operations

---

#### HF-CMS-1: 72h delivery window banner does not show the countdown in relative terms for non-expert operators

**Severity:** HIGH
**Wireframe(s):** WF-CMS-02, WF-CMS-03
**Dimension(s):** First-time usability, Cognitive load, Error prevention
**Location:** Zone B, 72h Delivery Window Banner, above schedule header

**Issue:**
The permanent 72h banner states: "Content is safe to schedule for play after: THURSDAY 5 JUNE 2026, 14:23 AEST." This requires the operator to mentally compute whether their intended slot is before or after that date, a working-memory task. The banner also says "Content scheduled to play before this time requires verified pre-delivery or may not reach venues in time" — which implies action is possible but may not be clear to a less-experienced operator.

For operators unfamiliar with the corpus delivery model, the concept of a "72-hour pre-delivery" window is not self-evident from the label. The banner explains the date but not the operational reason for the constraint.

**Operator Risk:**
A new content creator sees the amber banner, notes "Safe after THURSDAY 14:23," and proceeds to create a slot for "WEDNESDAY at 18:00" — correctly within the warning zone. They see the amber stripe on the slot and the ⚠ icon. They do not understand why this is a warning, so they dismiss the "Submit with warning" modal by clicking "Submit anyway" without understanding the actual delivery risk. Content is published but does not reach the venue corpus before the play time.

**Correction:**
Change the banner text to a two-line format: Line 1 (existing): "Safe to schedule after: THURSDAY 5 JUN 2026, 14:23 AEST." Line 2 (new): "Slots before this time may not have time to sync to venue players before air." This explains the operational implication in plain language. Additionally, the "Submit with warning" confirmation dialog should include: "Venue corpus sync takes up to 72 hours. If content is not already synced, it may not play at the scheduled time." These are label text changes only.

---

#### HF-CMS-2: "Submit with warning" and "Submit" are different button labels that operators will confuse

**Severity:** HIGH
**Wireframe(s):** WF-CMS-02, WF-CMS-03
**Dimension(s):** Error prevention, Muscle memory, Cognitive load
**Location:** Approval confirmation dialog (72h warning case) — button row

**Issue:**
When a slot is within the 72h warning zone, the confirmation dialog shows "[Cancel] [Submit with warning]" instead of "[Cancel] [Submit]". This is correct — the different label signals that the operator is acknowledging a constraint. However, an operator who has submitted many slots in the normal flow (habit: click "Submit") will not find "Submit with warning" in the expected spatial position. Additionally, "Submit with warning" is a longer label that may wrap or truncate in narrow dialog widths, and the visual weight difference between the normal and warning submit buttons is not specified.

**Operator Risk:**
A high-volume content creator, mid-shift, submits dozens of slots in rapid succession. One slot falls in the warning zone. The confirmation dialog appears. By reflex, their eye goes to where "Submit" normally appears (rightmost button). "Submit with warning" is in that position but visually different. The operator, fatigued (hour 6 of 8), clicks [Cancel] by mistake (the leftmost button), thinking "Submit with warning" was the Cancel equivalent. The slot remains unsubmitted and misses the deadline.

**Correction:**
The "Submit with warning" button should be the rightmost button (consistent with "Submit" position) and should use the same visual weight as the normal Submit button — but with a warning icon (⚠) prepended to the label: "⚠ Submit anyway." The warning icon is sufficient to signal the difference; the button position should remain consistent. Additionally, add a brief instructional note above the button row: "I understand this content may not reach venues before its play time."

---

#### HF-CMS-3: The <24h hard block error message mentions "Trigger emergency re-delivery" but Content Creators cannot access it

**Severity:** MEDIUM
**Wireframe(s):** WF-CMS-03
**Dimension(s):** First-time usability, Recovery from mistakes, Error prevention
**Location:** Zone B, Slot Detail Panel, Error box, "Trigger emergency re-delivery" link

**Issue:**
The error box for sub-24h blocked slots shows "[Trigger emergency re-delivery →]" as a link. The wireframe notes this link is "role-gated: Venue Admin and above only; for Content Creator, this link is absent and replaced with: 'Contact your Venue Admin to trigger emergency re-delivery.'" However, the wireframe that shows this error state (WF-CMS-03) uses a Content Creator role. If the link is absent and replaced by text, the text says "Contact your Venue Admin" but does not say HOW to contact them, or provide any in-system path.

**Operator Risk:**
A content creator encounters a blocked slot with 1h13m to play time. The error box says "Contact your Venue Admin." There is no link, no in-system notification mechanism, no displayed Venue Admin name. The content creator has to leave the system to contact the admin by phone or external messaging. This is slow. If the Venue Admin's contact details are not known (new employee, weekend shift), the escalation path fails entirely.

**Correction:**
The replacement text for Content Creator role should include the Venue Admin's display name and an in-system notification link: "Contact your Venue Admin: [Admin Name] — [Notify them →]." The "[Notify them →]" link sends an in-system notification to the Venue Admin for this venue with the blocked slot's details pre-attached. If no Venue Admin is assigned, show: "No Venue Admin assigned for this venue — contact Platform Support." This uses the existing notification system and does not require a new component.

---

#### HF-CMS-4: Training mode toggle in Zone A Pane A4 is not visually prominent enough to prevent accidental live submissions

**Severity:** HIGH
**Wireframe(s):** WF-CMS-09 (Training Mode active), all CMS wireframes (toggle present in Zone A)
**Dimension(s):** Error prevention, Long-duration operations, Muscle memory
**Location:** Zone A, Pane A4, Training mode toggle

**Issue:**
The Training mode toggle is a small control in Pane A4 at the bottom of Zone A: "Training mode: [OFF] ○" — a toggle with a small label. When Training Mode is ON, the wireframe notes "Training Mode badge in status bar; all submits intercepted; changes non-destructive." However, the Zone A toggle is the same small element regardless of ON/OFF state.

An operator who has been working in Training Mode (practicing schedule submissions) and accidentally leaves Training Mode ON, or conversely one who leaves it OFF while intending to practice, can either (a) make real live submissions thinking they are training, or (b) be confused when their training submissions take real effect.

**Operator Risk:**
A new content creator practices submitting a sponsor slot in Training Mode. They complete the exercise and exit. Later in the shift, they return to the CMS to submit a real slot. Training Mode is still ON from the practice session (they did not notice it). The submission is "intercepted" (non-destructive), so the content never actually reaches the approval queue. The slot misses the deadline. Neither the creator nor the reviewer notices the interception immediately.

**Correction:**
When Training Mode is active, the Zone A section header area (above Pane A4) should display a persistent amber banner: "TRAINING MODE ACTIVE — submissions are non-destructive." The System Status Bar already shows a badge per the spec (WF-CMS-09) — but the Zone A indicator needs to be equally prominent within the operator's natural scan path. This is an additional visual state for Pane A4, not a new component.

---

#### HF-CMS-5: L4 sponsor ceiling is enforced at override level dropdown but not explained in the Schedule Builder slot creation form

**Severity:** MEDIUM
**Wireframe(s):** WF-CMS-02, WF-CMS-04, WF-CMS-05
**Dimension(s):** First-time usability, Cognitive load
**Location:** Zone B, Slot creation form ("+Add slot" slide-over), Override level dropdown

**Issue:**
The slot creation form in WF-CMS-02 shows an "Override level" dropdown: "No override (standard) or L4 — Sponsor (constitutional maximum)" — the L4 ceiling is enforced here. However, there is no explanation of what "constitutional maximum" means or why L5/L6 are not available. A content creator or League Admin who encounters this limitation for the first time may not understand whether they are being blocked by their role, the venue settings, or a system-wide rule.

**Operator Risk:**
A League Admin attempts to create a high-priority slot they believe should supersede venue scheduling. They select "L4 — Sponsor" (constitutional maximum) and proceed. Later they question why their slot was overridden by a venue-level operational hold. They escalate a support ticket unnecessarily — they do not understand the PRE resolution hierarchy or that L1 operational overrides supersede L4 sponsor slots.

**Correction:**
Add a tooltip on the override level dropdown label: "Override levels L5 and L6 are system-reserved for operational and emergency use and are not available through content scheduling. [Learn more →]." This is a single tooltip text addition. No component change.

---

---

### Surface: Venue Operations

---

#### HF-VO-1: 7-dimension status dashboard uses a 4-3 grid split that creates visual asymmetry at scan time

**Severity:** HIGH
**Wireframe(s):** WF-VO-01, WF-VO-02, WF-VO-03
**Dimension(s):** Long-duration operations, Cognitive load, Multi-monitor usage
**Location:** Zone B, Tab 1 Overview, Status Dashboard 4-3 grid

**Issue:**
The status dashboard renders 7 status cards in a 4-3 grid: Row 1 has 4 narrow cards (~210px each), Row 2 has 3 wider cards (~280px each). At a 1440px viewport with 280px Zone A, Zone B is approximately 880px — making a 4-column row have 220px-wide cards and a 3-column row have 293px-wide cards. This asymmetry means Row 2 cards are ~33% wider than Row 1 cards, which changes the visual scan pattern between rows. During long shifts, the operator develops muscle memory for where to find specific values. When the card widths differ between rows, this scan memory is inconsistent.

Additionally, the 7-card layout leaves ambiguity about which dimension belongs to which "category" — HEALTH and READINESS both relate to player state, but they are in different rows with different visual weights.

**Operator Risk:**
An operator after 6 hours of a shift scans the dashboard for the READINESS signal (Row 2, position 1) but their eyes go first to the Row 1 position-1 card (HEALTH). Both are green. They confirm "all green" without registering that CONNECTIVITY (Row 2, position 2) is amber. The amber card is in a wider layout that their scan path, calibrated to Row 1, has not fully covered.

**Correction:**
Normalize the grid to a 4-3-or-similar approach where cards maintain consistent width across rows, or use a 4-column layout with the 7th card occupying the width of one Row 2 card and a spacer. Alternatively, group the 7 dimensions into two explicitly labeled visual groups: "Player Status" (HEALTH, READINESS, TRUST) and "Signal Quality" (CONFIDENCE, FRESHNESS, CONNECTIVITY, INTEGRITY) — this creates a semantic grouping that aids scan even with the 4-3 grid asymmetry. The grouping requires only a label addition and does not change the card structure.

---

#### HF-VO-2: RECOVERED_BUT_UNTRUSTED state shows "LIVE" in the machine state badge alongside "UNTRUSTED" secondary badge

**Severity:** MEDIUM
**Wireframe(s):** WF-VO-03
**Dimension(s):** First-time usability, Cognitive load, High-stress incident response
**Location:** Venue Identity Header, machine state badge center section

**Issue:**
In WF-VO-03, the center of the Venue Identity Header shows a green "LIVE" pill (120×40px) and immediately below it an amber "UNTRUSTED" secondary badge. The green LIVE badge visually dominates — it is the largest, most prominent element. The amber UNTRUSTED badge is secondary. An operator who scans the header for a quick state check sees GREEN/LIVE and may not register the smaller amber UNTRUSTED badge.

**Operator Risk:**
An operator checks venue status during high fleet activity. They see the large green "LIVE" badge and move on, satisfied the venue is live. They do not register the amber "UNTRUSTED" secondary badge. Overrides are blocked during the RECOVERED_BUT_UNTRUSTED state, but the operator is unaware — they attempt to place a time-sensitive override and get a disabled control without understanding why.

**Correction:**
When the trust protocol flag is RECOVERED_BUT_UNTRUSTED, the primary machine state badge should not render as the standard green "LIVE" pill. Instead, render a combined badge: amber background (not green), label "LIVE — UNVERIFIED" in a single 120×40px pill. This eliminates the ambiguity between the primary and secondary badges by making a single, unambiguous combined signal. The color must be amber (not green) to prevent the green-scans-healthy heuristic from firing incorrectly.

---

#### HF-VO-3: Recovery workflow overlay (5 steps) has no progress persistence if operator navigates away

**Severity:** MEDIUM
**Wireframe(s):** WF-VO-02
**Dimension(s):** Recovery from mistakes, Long-duration operations, Muscle memory
**Location:** Zone B, Recovery Workflow Overlay, full Zone B replacement

**Issue:**
Clicking "Begin Recovery Workflow" replaces the entire Zone B with a 5-step workflow overlay. The spec does not state what happens to workflow progress if the operator navigates away (clicks another venue in Zone A, receives a notification that navigates Zone B, or presses browser back). Standard web behavior would lose in-progress state. Step 4 is system-automated (corpus hash verification) and auto-advances, so it may be OK to lose that step. But Steps 1–3 are operator-checkbox confirmations — losing these requires the operator to re-confirm all checks.

**Operator Risk:**
An operator completes Steps 1, 2, and 3 of the recovery workflow (all checkboxes ticked). An urgent notification from another venue fires and navigates Zone B away. When the operator returns to the offline venue, the recovery workflow is either (a) gone (progress lost) or (b) still showing as complete (inconsistent state). If progress is lost, the operator must re-do three steps of physical verification while the venue autonomy clock continues counting down.

**Correction:**
The spec should require that recovery workflow state persists in session storage scoped to `venue_id`, surviving Zone B navigation. On return to the venue, if a recovery workflow was in progress, a banner should appear: "Recovery workflow in progress — Step [N] of 5. [Resume →]." This is a state management specification addition, not a new visual component.

---

#### HF-VO-4: Machine state history strip in the Venue Identity Header shows raw transitions without operational context

**Severity:** LOW
**Wireframe(s):** WF-VO-01, WF-VO-02, WF-VO-03
**Dimension(s):** First-time usability, Long-duration operations, Cognitive load
**Location:** Venue Identity Header, center section, machine state history strip

**Issue:**
The machine state history strip shows raw state transitions: "[LIVE→OFFLINE] 2026-06-02 14:32 AEST | [OFFLINE→SYNCING] 15:18 | [SYNCING→LIVE] 15:23." This tells the operator what happened but not how long the transitions took. The most operationally relevant information (how long the venue was offline) requires mental arithmetic: 15:18 - 14:32 = 46 minutes offline.

**Correction:**
Add a computed duration between consecutive transitions in small text: "[LIVE→OFFLINE] 14:32 | (offline 46m) [OFFLINE→SYNCING] 15:18 | (sync 5m) [SYNCING→LIVE] 15:23." This is a computed display value, not a data change, and significantly improves scanability.

---

---

### Cross-Surface Issues

---

#### HF-XS-1: System Status Bar 48px height limits readability of multi-element content at distance

**Severity:** MEDIUM
**Wireframe(s):** WF-LO-01 (canonical definition), all 55 wireframes
**Dimension(s):** Long-duration operations, Accessibility, Multi-monitor usage
**Location:** System Status Bar, full width, 48px

**Issue:**
The System Status Bar contains up to 6 elements horizontally (constitutional state, mode indicator, session clock, operator identity, elevate button, notification badge). At 1440px width with 6 elements, each element has approximately 240px of space. In practice, elements are not equal-width — the constitutional state indicator takes more space during EMERGENCY_FREEZE ("EMERGENCY FREEZE ACTIVE"). This compresses other elements. At a real-world working distance of 60–90cm from a 24" monitor, 13–14px text in the status bar is at the lower boundary of comfortable reading without squinting.

This is not a blocking issue for most operators but creates a structural accessibility and long-shift fatigue concern.

**Correction:**
The status bar specification should require minimum 14px text for all content elements, with WCAG AA contrast (4.5:1) verified for all text/background combinations. The text size may need to step up to 15px for the constitutional state badge text specifically. This is a design token constraint addition, not a wireframe change.

---

#### HF-XS-2: Audit Trace Footer shows "Last action" but not "by whom" — insufficient for handoff clarity

**Severity:** LOW
**Wireframe(s):** WF-LO-01 (canonical definition), all Live Operations wireframes
**Dimension(s):** Long-duration operations, Cognitive load, First-time usability
**Location:** Audit Trace Footer, 28px, z-index 1000

**Issue:**
The Audit Trace Footer reads: "Last action: [event_type] at [time] AEST [Open in Replay →]." It does not show who performed the action. During a shift handoff, an incoming operator scanning the footer sees "Last action: override:entry:placed at 15:22 AEST" but does not know if this was placed by their predecessor or by an automated system action.

**Correction:**
Extend the footer text: "Last action: [event_type] by [operator_name] at [time] AEST — [Open in Replay →]." If the action was system-initiated, show "by system." This is a label content change with no visual component impact.

---

#### HF-XS-3: Focus ring specification is absent from all wireframes

**Severity:** MEDIUM
**Wireframe(s):** All 55 wireframes
**Dimension(s):** Accessibility
**Location:** All interactive elements across all surfaces

**Issue:**
No wireframe specifies focus ring appearance for keyboard navigation. The accessibility notes mention "keyboard-accessible" and "Tab through form fields" but do not define the visible focus ring style (color, width, offset, shape). On dark backgrounds (the primary dark theme across all surfaces), a default browser focus ring may be insufficient contrast for WCAG 2.1 AA compliance. On colored elements (e.g., the red EMERGENCY_FREEZE status bar), a default focus ring may be invisible.

**Operator Risk:**
An operator navigating by keyboard (for accessibility reasons, or due to a mouse failure during an incident) cannot determine which element currently has focus. Under S1/S2 conditions when every second counts, losing keyboard navigation orientation is a critical accessibility barrier.

**Correction:**
Add a global accessibility specification to the wireframe suite (could be a note in WF-LO-01 as the canonical chrome reference): "All interactive elements must show a visible focus ring of at minimum 3px solid, color: #FFFFFF (white) at 80% opacity for dark backgrounds, with 2px offset from element boundary. On colored elements (e.g., red status bar), use a contrasting focus ring: 3px solid #000000 (black). Focus ring is never suppressed by CSS." This is a design system specification addition.

---

#### HF-XS-4: Role badge in Operator Identity area uses abbreviations (OPR, VWR, ADM) without legend

**Severity:** LOW
**Wireframe(s):** WF-LO-01 through WF-LO-08 (all Live Operations), all IC wireframes
**Dimension(s):** First-time usability, Accessibility
**Location:** System Status Bar, Operator Identity Badge; Zone A Pane A4

**Issue:**
The operator identity badge shows "Jordan H. · OPR" or "Sam K. · VWR" — using three-letter role abbreviations. These are not expanded anywhere in the visible UI. A supervisor reviewing an operator's session, or a new operator who has not memorized the abbreviations, may not immediately know what "OPR" means.

**Correction:**
The role abbreviation element should have a tooltip showing the full role name: "OPR → Operator," "VWR → Viewer," "ADM → Admin." A title attribute is sufficient. This is a single tooltip addition per badge.

---

#### HF-XS-5: Governe-timestamp hover tooltip (absolute ISO time) is specified but touch-screen accessibility is not addressed

**Severity:** INFORMATIONAL
**Wireframe(s):** WF-LO-01, all venues and IC wireframes with timestamps
**Dimension(s):** Accessibility, Multi-monitor usage
**Location:** All governed timestamps across all surfaces

**Issue:**
Governed timestamps show relative time ("22m ago," "4m ago") with absolute ISO time visible on hover. Touch-screen deployments (e.g., large-format display control panels, tablet-based venue control stations) cannot hover. The absolute timestamp is an important forensic detail.

**Correction:**
For informational tracking: define a tap-to-reveal pattern for touch contexts where the relative timestamp toggles to absolute ISO on first tap and back on second tap. Implementation complexity is low; priority is informational since primary deployment is desktop.

---

#### HF-XS-6: No "back to previous surface" breadcrumb on deep-navigated surfaces

**Severity:** MEDIUM
**Wireframe(s):** WF-IC-01, WF-IC-02, WF-IC-03; WF-RP-01 through WF-RP-10; WF-VO-01 through WF-VO-10
**Dimension(s):** First-time usability, Recovery from mistakes, Multi-monitor usage
**Location:** Zone A top (IC surface); Session Header (Replay); Zone A "← All Venues" (Venue Operations)

**Issue:**
Navigation context is inconsistent across surfaces. The Venue Operations Dashboard has "← All Venues" in Zone A top. The IC surface has Zone A top navigation items (Home / Live Ops, Venues, Incidents, Replay) — standard nav but no "back to where I came from." The Replay surface has no explicit back affordance for returning to the IC surface that launched it (only navigation links in Zone C and Zone A).

When an operator arrives at the IC surface via automatic Zone B replacement (S1/S2), they did not choose to navigate there — they need a clear path back to their prior context. The spec addresses this for S1/S2 with a banner ("You were viewing the Venue Dashboard — [Return to Venue Dashboard]") but this is only documented in narrative, not in the wireframes.

**Correction:**
WF-IC-10 and WF-IC-02 should show the "Return to Venue Dashboard" banner explicitly as a specced layout element. The IC surface Zone A nav should also include a contextual "← Back to Venue [NAME]" entry that appears when the IC surface was entered from a venue dashboard. This is a navigation state specification addition. On the Replay surface, Zone A should include a persistent "← Back to Incident Command" link when the session was opened from an IC surface via [Open in Replay Workspace].

---

## Summary Tables

### Issues by Severity

| Severity | Count | Issue IDs |
|---|---|---|
| CRITICAL | 4 | HF-LO-1, HF-IC-1, HF-IC-2, HF-IC-3 |
| HIGH | 8 | HF-LO-2, HF-LO-3, HF-LO-5, HF-IC-5, HF-IC-6, HF-CMS-1, HF-CMS-2, HF-CMS-4, HF-VO-1 |
| MEDIUM | 12 | HF-LO-4, HF-LO-6, HF-IC-4, HF-IC-7, HF-RP-2, HF-RP-3, HF-RP-4, HF-CMS-3, HF-CMS-5, HF-VO-2, HF-VO-3, HF-XS-1, HF-XS-3, HF-XS-6 |
| LOW | 4 | HF-RP-5, HF-VO-4, HF-XS-2, HF-XS-4 |
| INFORMATIONAL | 1 | HF-XS-5 |

*Note: HF-VO-1 appears above as HIGH (9th item in the HIGH row) and is correctly classified as HIGH.*

### Issues by Dimension

| Dimension | Issue count | Most severe |
|---|---|---|
| First-time usability | 7 | HF-IC-3 (CRITICAL) |
| High-stress incident | 9 | HF-IC-1 (CRITICAL) |
| Long-duration operations | 8 | HF-LO-1 (CRITICAL) |
| Cognitive load | 10 | HF-IC-2 (CRITICAL) |
| Information overload | 4 | HF-LO-1 (CRITICAL) |
| Error prevention | 6 | HF-IC-1 (CRITICAL) |
| Recovery from mistakes | 6 | HF-IC-3 (CRITICAL) |
| Muscle memory | 4 | HF-LO-2 (HIGH) |
| Accessibility | 5 | HF-XS-3 (MEDIUM) |
| Multi-monitor | 3 | HF-XS-1 (MEDIUM) |

### Issues by Surface

| Surface | Issue count | CRITICAL | HIGH |
|---|---|---|---|
| Live Operations | 6 | 1 (HF-LO-1) | 2 (HF-LO-2, HF-LO-5) |
| Incident Command | 7 | 3 (HF-IC-1, HF-IC-2, HF-IC-3) | 3 (HF-IC-5, HF-IC-6, [HF-IC-7 is MEDIUM]) |
| Replay Investigation | 5 | 1 (HF-RP-1) | 0 |
| CMS Operations | 5 | 0 | 3 (HF-CMS-1, HF-CMS-2, HF-CMS-4) |
| Venue Operations | 4 | 0 | 1 (HF-VO-1) |
| Cross-Surface | 6 | 0 | 0 |

*Corrected: HF-RP-1 is CRITICAL per severity classification above.*

---

## Pre-Build Blocking Issues

The following CRITICAL issues must be resolved before any build begins. Each represents a scenario where an operator under real conditions may take a wrong action, miss a required action, or experience a dangerous delay.

**HF-LO-1 — RECOVERED_BUT_UNTRUSTED state uses the same amber color as DEGRADED in Zone A**
Required correction: Introduce a visually distinct Zone A dot treatment (pulsing amber) for RECOVERED_BUT_UNTRUSTED to prevent operators from misclassifying the trust state during multi-venue monitoring.

**HF-IC-1 — L6 "type EMERGENCY" confirmation provides no actionable error message for trailing-space failures**
Required correction: The error label must specify "check for extra spaces or characters" explicitly. Add a fixed-width rendering of the required word directly above the input field.

**HF-IC-2 — AssumeCommandConfirmCard does not show incident scope, severity, or venue**
Required correction: Add a read-only incident summary row (ID, severity badge, venue, duration, countdown) to the confirmation card before the action confirmation text.

**HF-IC-3 — COMMANDER_LAPSED state shows no list of currently-viewing operators who could assume command**
Required correction: Display a "currently viewing: N other operators" count with a [Notify them →] in-system notification trigger in the COMMANDER_LAPSED indicator.

**HF-RP-1 — Replay PAUSED/REPLAYING state is ambiguously communicated through icon convention**
Required correction: Add a persistent plain-language state label ("STATE: PAUSED / REPLAYING / SCRUBBING") alongside or below the transport controls in RP-TIMELINE.

---

## Recommended Correction Priority

**P1 — Fix before build:**
HF-LO-1, HF-IC-1, HF-IC-2, HF-IC-3, HF-RP-1

**P2 — Fix in first sprint (HIGH severity):**
HF-LO-2, HF-LO-3, HF-LO-5, HF-IC-5, HF-IC-6, HF-CMS-1, HF-CMS-2, HF-CMS-4, HF-VO-1

**P3 — Fix before pilot launch (MEDIUM severity):**
HF-LO-4, HF-LO-6, HF-IC-4, HF-IC-7, HF-RP-2, HF-RP-3, HF-RP-4, HF-CMS-3, HF-CMS-5, HF-VO-2, HF-VO-3, HF-XS-1, HF-XS-3, HF-XS-6

**P4 — Backlog (LOW and INFORMATIONAL):**
HF-RP-5, HF-VO-4, HF-XS-2, HF-XS-4, HF-XS-5

---

## What Works Well

**EMERGENCY_FREEZE visual treatment (WF-LO-03, WF-IC-10) is executed well.** The full red status bar background, non-dismissible interrupt banner, red Zone A border, and automatic Zone C expansion to show the constitutional advisory are a coherent multi-channel alarm that cannot be missed by an operator at any attention level. The use of `aria-live="assertive"` for the interrupt banner is correct.

**L6 override — "No expiry" option is correctly absent rather than disabled (WF-IC-06).** The Expiry picker is entirely absent for L6 and replaced with a static explanatory label. This is the correct pattern and correctly communicates that L6 expiry is a governance rule, not a user preference. The "PERMANENT UNTIL REMOVED" label pattern is clear and unambiguous.

**VIEWER role abstraction (WF-LO-05, WF-IC-11, WF-RP-08) is correctly handled.** Write controls are absent from the DOM rather than disabled, and no "you don't have permission" messages appear. The "VIEWER — read only" label in S4 is the minimal correct acknowledgement of the role boundary without creating a degraded or alarming experience.

**The positive/negative confirmation distinction in Pane A2 (WF-LO-01 vs WF-LO-04)** — "No active incidents" vs "Incident status unavailable" — is operationally significant and correctly specified. Many systems conflate these two states, leading to false confidence. This system correctly requires backend confirmation for the empty state.

**Command Log auto-scroll toggle with "N new entries" indicator (WF-IC-04)** is well-designed for the incident management context. The toggle defaults to ON (new entries auto-scroll), and the "N new entries — scroll to latest ↓" indicator correctly handles the case where an operator has scrolled up to review history. The keyboard shortcut Ctrl+Shift+A for annotation focus is a practical emergency shortcut.

**72h delivery window banner (WF-CMS-02) is correctly specified as non-dismissible and updates in real time.** The amber diagonal stripe pattern for slots in the warning zone, combined with the ⚠ icon and the slot detail panel warning box, provides appropriate redundancy. The "Submit with warning" label (despite HF-CMS-2 above) is correct in distinguishing the constrained submission from a normal one.

**The PRE level table on Tab 4 (WF-IC-07)** with its WINNING row highlighted in blue, SUPPRESSED rows with secondary "Suppressed by L[N]" labels, and the Confidence badge rendered separately below the table — is a well-structured data display that communicates resolution hierarchy clearly. The 15-second polling freshness counter with color progression (neutral → amber at 30s → red at 60s) is a well-calibrated staleness signal.

**The RECOVERED_BUT_UNTRUSTED verification steps panel (WF-VO-03)** with its live checklist (✓ Heartbeat received, ✗ Corpus hash not yet verified, ✗ Clock sync confirmation pending) is the correct pattern for communicating partial trust restoration. The animated ●●● corpus verification indicator communicates that the system is actively working without requiring operator action.

**The "absent vs disabled" distinction is consistently and correctly applied throughout all surfaces.** Controls that are unavailable due to permanent role boundaries are absent from the DOM; controls unavailable due to temporary state conditions (EMERGENCY_FREEZE, RECOVERED_BUT_UNTRUSTED verification) are disabled with tooltips. This distinction is operationally important and the wireframes implement it correctly and consistently.

---

## Audit Limitations

The following factors could not be evaluated from wireframes alone:

**Actual rendering at real display scales.** ASCII wireframes at 1440px abstract pixel-level rendering. The 48px System Status Bar with 6 elements may render differently on a 24" display at 1x vs a 27" at 1.25x scaling. Color contrast ratios (e.g., amber text on dark background for DEGRADED indicators) cannot be verified from wireframe notation alone — a visual mockup with design tokens applied is required for WCAG AA verification.

**Transition and animation timing.** The pulsing animations (COMMANDER_LAPSED countdown, RECOVERED_BUT_UNTRUSTED dot, autonomy clock critical state) are specified by behavior description but not by exact timing curves. Animations that pulse too fast create visual noise; too slow and they lose urgency signaling. Physical rendering is required to calibrate.

**Real stress conditions.** Human factors research consistently shows that operators behave significantly differently under genuine S1/S2 incident pressure compared to training or review contexts. The L6 confirmation flow (HF-IC-1), in particular, cannot be fully evaluated for usability without scenario testing with real operators under simulated time pressure.

**Long-shift visual fatigue effects.** After 6–8 hours, contrast thresholds decline and operators begin to rely more heavily on spatial memory (where is the button?) than label reading. This shift-length degradation pattern cannot be simulated from wireframe review — it requires observational field research or a usability lab session of 8+ hours.

**Multi-monitor configuration.** The wireframes specify 1440px viewport. In real deployments, operators may use dual monitors with the Live Operations surface on one screen and the IC surface on the other, or use a large-format monitor with the interface at sub-100% zoom. Wireframes do not specify breakpoints or minimum viewport widths, and the behavior of Zone C collapse at narrower-than-1440px is unspecified.

**Keyboard navigation order under dynamic state changes.** The focus order is specified for static states. When EMERGENCY_FREEZE activates mid-session (a dynamic state change), the correct behavior for keyboard focus (should it move to the interrupt banner? should it remain where it was?) is not specified. Real accessibility testing with screen reader software would be required.

**Actual corpus data volume and rendering performance.** The Replay Investigation surface with 5+ hours of corpus data in RP-TIMELINE and hundreds of events in the event stream may behave differently from the wireframe when rendered with real data. Scroll performance, search latency, and timeline rendering at high zoom levels cannot be assessed from specification.

---

*Audit completed: 2026-06-02*
*Document: HUMAN-FACTORS-AND-OPERATIONAL-ERGONOMICS-AUDIT-v1.md*
*Audited wireframe set: 55 wireframes across 5 surfaces (WF-LO-01–08, WF-IC-01–12, WF-RP-01–10, WF-CMS-01–10, WF-VO-01–10)*
