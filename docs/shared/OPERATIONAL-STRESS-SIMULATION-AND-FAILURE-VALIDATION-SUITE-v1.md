# Operational Stress Simulation and Failure Validation Suite — v1

**Document type:** Simulation and failure validation suite
**Scope:** All 5 operator surfaces, 40 simulation scenarios
**Source documents:** Human Factors Audit v1, Cognitive Load Hardening Patch v1, all canonical surface specs
**Date:** 2026-06-03
**Status:** AUTHORITATIVE — defines pass/fail criteria for pre-pilot operator validation

---

## 1. Purpose and Scope

### 1.1 What This Suite Tests

This suite validates whether the ClubHub TV operator platform remains safe, legible, and operable under real-world degradation and stress conditions. It does not test whether the system is functionally correct (that is addressed by the engineering test harness). It tests whether a real human operator can correctly identify system state and take correct action under conditions that deviate from ideal.

The suite covers five stress categories:
1. High-stress incident conditions — rapid state changes, multi-alert overlap, time pressure
2. Partial system degradation — missing data streams, stale state, conflicting signals
3. Multi-operator conflict — simultaneous actions, role collisions, race conditions
4. Long-duration fatigue — 8+ hour shifts, alert desensitization, attention drift
5. Replay/live state confusion — mode switching, ambiguous overlays, mixed signals

### 1.2 What This Suite Does Not Test

- **Functional correctness** of backend systems (API responses, database consistency, event ordering)
- **Performance** (latency under load, WebSocket throughput)
- **Security** (authentication, authorization boundaries at the API layer)
- **Aesthetic design quality** (this is a safety test, not a design review)

### 1.3 How to Interpret Results

Each scenario produces a PASS or FAIL result based on observable, unambiguous criteria. There is no "partial pass." If the failure criteria are met, the scenario fails regardless of how close the operator came to correct behavior.

Scenario results aggregate to a deployment verdict defined in Section 9.

---

## 2. Failure Classification

| Class | Definition | Real-world consequence |
|---|---|---|
| CLASS-CRITICAL | Operator takes wrong action, misses a required action, or is unable to act — directly because of a UI representation failure | S1/S2 incident mismanaged; incorrect emergency content placed; governance violation |
| CLASS-HIGH | Operator experiences significant confusion, incorrect mental model, or excessive latency-to-correct-action | Incident duration extended; SLA breach; incorrect override placed and not caught |
| CLASS-MEDIUM | Operator friction, reduced efficiency, or cognitive load spike | Fatigue accumulation; slower diagnosis; minor errors requiring correction |
| CLASS-LOW | Inconvenience, visual noise, or non-critical ambiguity | No direct safety or governance consequence |

### 2.1 Definition of "System Failure"

A system failure occurs when:
- The UI displays a state that a reasonable operator would misinterpret as a different state (state confusion failure)
- A critical action is not executable by a role that should be able to execute it (capability access failure)
- A destructive action is executed without the operator understanding its consequences (consent failure)
- System state changes without any visible operator signal within 15 seconds (silent mutation failure)
- A REPLAY state is not distinguishable from a LIVE state within 2 seconds of observation (mode confusion failure)

A system failure is NOT:
- An operator choosing to ignore a visible warning
- An operator lacking domain knowledge independent of the UI
- A backend fault that the UI correctly represents as degraded

---

## 3. Simulation Catalog

### Category 1: High-Stress Incident Conditions

---

#### SIM-INC-01: Simultaneous S1 and S3 incidents — triage from Zone A

**Category:** 1 — High-stress incident conditions
**Surfaces tested:** Live Operations (fleet view), Incident Command
**Operator role under test:** OPERATOR with multi-venue assignment
**Setup conditions:**
- Operator is viewing `/fleet` (WF-LO-06), monitoring 6 venues
- All 6 venues in LIVE/HEALTHY state
- No active incidents
- Operator has been on shift for 2 hours

**Stress injection:**
- T+0s: S3 MAJOR incident declared automatically for Venue A (Riverside Golf Club). Zone A Pane A1 badge for Venue A turns amber (S3 color per PATCH-004). Pane A2 gains an S3 entry.
- T+8s: S1 EMERGENCY_FREEZE declared for Venue B (Brisbane CBD). Zone A Pane A1 badge for Venue B turns deep red (S1 color per PATCH-004). Pane A2 gains an S1 entry at top (severity-sorted above S3). Zone B is auto-replaced with IC surface for Venue B (S1 rule).
- T+8s: Active Mode Indicator shifts to "INCIDENT ACTIVE" with amber pulse (PATCH-005).
- T+8s: System Status Bar background shifts to full red (EMERGENCY_FREEZE for Venue B).

**Duration:** 90 seconds

**Expected operator behavior:**
1. At T+0s–T+8s: Operator sees Venue A amber badge in Pane A1. Reads Pane A2: S3 entry appears for Riverside Golf. Operator notes S3 but does not immediately respond (S3 does not require immediate commander action).
2. At T+8s: Operator's Zone B is auto-replaced with IC surface for Venue B. Operator reads Incident Identity Bar: "S1 EMERGENCY" deep red badge. Operator reads severity and venue name to confirm context.
3. Within 30 seconds of T+8s: Operator reads Tab 1 Situation Overview to assess S1 scope.
4. Operator does NOT navigate away to Venue A's S3 incident until S1 is either contained or handed off.

**Expected system behavior:**
1. Zone A Pane A1: Venue A badge = amber `#F57C00`, Venue B badge = deep red `#C62828` (PATCH-004)
2. Zone A Pane A2: S1 entry for Venue B appears ABOVE S3 entry for Venue A (severity-descending sort)
3. Zone B: Auto-replaced with IC surface for Venue B S1 incident. Return-path banner renders at bottom ("You were automatically brought here — [View Venue Dashboard →]") (PATCH-014)
4. System Status Bar: Full red background. "EMERGENCY FREEZE" text. Mode indicator: "INCIDENT ACTIVE" amber pulse (PATCH-005).

**Failure criteria (any one = scenario fails):**
- Operator navigates to Venue A S3 incident before Venue B S1 incident is reviewed (triage failure)
- Venue A and Venue B incident badges are visually identical in Zone A at T+8s (PATCH-004 not applied)
- Zone B does not auto-replace within 5 seconds of S1 declaration (constitutional rule failure)
- Pane A2 shows S3 above S1 at any point after T+8s (sort order failure)
- Operator cannot identify which venue the S1 incident belongs to within 10 seconds of T+8s

**Pass criteria:**
- Operator correctly opens S1 incident for Venue B within 30 seconds of T+8s
- Operator reads the Incident Identity Bar and confirms venue name before taking action
- Zone A badge colors are visually distinct for S1 vs S3 when shown to 5 separate operators (informal visual test)

**Observability hooks required:**
- Operator action log: which surface/route the operator navigated to and when
- Incident open event: `IC_SURFACE_OPENED` with `incident_id`, `severity`, `triggered_by: AUTO_REPLACE`
- Zone A badge render event: `ZONE_A_BADGE_RENDERED` with `venue_id`, `severity_color`
- Time-to-first-IC-action for the S1 incident (from T+8s to first operator tab interaction)

**Failure class if failed:** CLASS-CRITICAL
**Mapped patches:** PATCH-004, PATCH-005, PATCH-014
**Residual risk if patches applied:** LOW. PATCH-004 directly addresses severity-colored badges. Auto-replace is constitutional. Residual: if operator has ≥10 venues in Pane A1 and the list requires scrolling, the Venue B entry may not be immediately visible. Mitigation: Pane A2 sort order guarantees S1 is at the top of the incident list regardless of Pane A1 scroll position.

---

#### SIM-INC-02: COMMANDER_LAPSED countdown reaches zero while operator is on Tab 2

**Category:** 1 — High-stress incident conditions
**Surfaces tested:** Incident Command
**Operator role under test:** OPERATOR (non-commander, currently logged in)
**Setup conditions:**
- Active S3 incident at Riverside Golf Club, DECLARED state
- Original commander (Alex Rangi) has lapsed 12 minutes ago (COMMANDER_LAPSED state active)
- Countdown to Level 1 alert: 3 minutes remaining
- Operator is on Tab 2 (Command Log), reading prior entries
- Operator has NOT clicked [Assume Command]

**Stress injection:**
- T+0s: Operator is reading Tab 2 Command Log entries. COMMANDER_LAPSED indicator is visible in Incident Identity Bar above tabs.
- T+180s: Countdown reaches 00:00. Level 1 constitutional alert fires.
- T+180s: System emits `COMMANDER_LAPSED_ALERT_FIRED` event.
- T+180s: A distinguished log entry appears in Tab 2: full-width, `#C62828` red background at 15% opacity, red left border 6px, text "Level 1 constitutional alert fired. All OPERATOR+ users with venue access notified."
- T+180s: Push notification is sent to all OPERATOR+ with venue access.

**Duration:** 210 seconds (3.5 minutes)

**Expected operator behavior:**
1. During T+0s to T+180s: Operator sees COMMANDER_LAPSED indicator in Identity Bar. They observe the countdown decreasing.
2. At T+180s: If operator is still on Tab 2, the distinguished alert entry appears in the log (auto-scrolled to bottom if auto-scroll is ON). Operator reads the alert entry.
3. Operator must decide: assume command or wait for another operator to respond to the push notification.
4. If operator assumes command: they navigate to the Identity Bar [Assume Command] button or find it via Tab 2 upward scroll to Identity Bar.
5. System response: PATCH-012 "Currently viewing: N operators" indicator in the COMMANDER_LAPSED box informs whether other operators are available.

**Expected system behavior:**
1. COMMANDER_LAPSED indicator: countdown updates every second. When under 3 minutes: text pulses (opacity 100%→60% on 1s cycle).
2. At T+180s: Level 1 alert log entry appears in Tab 2 immediately. Auto-scroll brings it into view if auto-scroll is ON.
3. Identity Bar: COMMANDER_LAPSED indicator remains. [Assume Command] button remains visible and active.
4. PATCH-012 presence indicator: shows current operator count viewing the incident.

**Failure criteria:**
- Level 1 alert fires at T+180s but the Tab 2 distinguished entry does not appear within 5 seconds (silent mutation failure)
- Operator is on Tab 2 and does not notice the Level 1 alert entry because it is not auto-scrolled to visible area (attention failure — testable)
- [Assume Command] button is not reachable from Tab 2 without navigating away from the log (navigation failure)
- The countdown pulse animation does not begin within 3 minutes remaining (PATCH not applied)

**Pass criteria:**
- Level 1 alert entry appears in Tab 2 within 5 seconds of T+180s
- Operator notices the entry within 10 seconds of it appearing (observable via eye-tracking or action log)
- Operator reads the COMMANDER_LAPSED presence count (PATCH-012) before deciding to assume or wait

**Observability hooks required:**
- `COMMANDER_LAPSED_ALERT_FIRED` event timestamp vs. UI render timestamp for alert log entry
- Operator gaze position at T+180s (eye-tracking) or first click after T+180s
- `COMMAND_ASSUMED` or `COMMANDER_LAPSED_NOTIFY_SENT` event within 120 seconds of T+180s

**Failure class if failed:** CLASS-CRITICAL
**Mapped patches:** PATCH-012, PATCH-008 (tab content persistence)
**Residual risk if patches applied:** MEDIUM. Even with PATCH-012 showing operator count, a lone operator may still hesitate. The system cannot force assumption — it can only inform. This is an inherent limitation of the design that requires training protocols.

---

#### SIM-INC-03: S1 declared while operator is mid-action in CMS Tab 2

**Category:** 1 — High-stress incident conditions
**Surfaces tested:** CMS Operations, Incident Command, Live Operations
**Operator role under test:** OPERATOR (CMS-capable)
**Setup conditions:**
- Operator is on CMS `/cms/schedule` (Tab 2 Schedule Builder)
- Operator has partially completed a slot creation form: content selected, time selected, reason field filled (12 characters)
- No active incidents
- Venue scope: Brisbane CBD

**Stress injection:**
- T+0s: S1 EMERGENCY_FREEZE declared for Brisbane CBD (operator's scoped venue).
- T+0s: Zone B auto-replaces with IC surface for the S1 incident.
- T+0s: CMS navigation items in Zone A become visually disabled ("Unavailable during Emergency Freeze" tooltip).
- T+0s: The in-progress slot creation form in CMS Tab 2 is no longer visible.

**Duration:** 120 seconds

**Expected operator behavior:**
1. At T+0s: Operator observes Zone B replacement. They read the Incident Identity Bar: S1 EMERGENCY, Brisbane CBD.
2. Operator must switch attention to S1 incident management. CMS work is deferred.
3. After T+0s: If operator attempts to return to CMS (via Zone A or browser back), the nav items are disabled with tooltip. They understand CMS is unavailable.
4. Return-path banner (PATCH-014) is visible: "[View Venue Dashboard →]" opens in new tab.
5. Operator does not lose the CMS form data permanently — if the browser tab is preserved, the form state may still exist in component memory.

**Expected system behavior:**
1. Zone B replacement: immediate on S1 declaration, no page reload (history push).
2. CMS Zone A nav items: visually disabled (opacity 0.35, no pointer events), tooltip "Content authoring unavailable during Emergency Freeze."
3. System Status Bar: full red background. "EMERGENCY FREEZE" text.
4. Return-path banner: visible in IC surface Zone B bottom (PATCH-014).
5. CMS form state: **not specified** in the canonical spec — this is a gap. Expected: if operator uses browser back after the EMERGENCY_FREEZE is resolved, the form may or may not have state, depending on implementation.

**Failure criteria:**
- Operator cannot identify which incident has caused the Zone B replacement within 15 seconds (identity failure — Incident Identity Bar must show venue name and severity)
- CMS nav items appear active (clickable) during EMERGENCY_FREEZE (governance violation)
- Operator has no visible path back to any prior context (no return-path banner, no Zone A alternative) (navigation failure)
- Operator is confused about whether their CMS slot was submitted or lost (silent mutation — form state ambiguity)

**Pass criteria:**
- Operator reads Incident Identity Bar and confirms venue name within 15 seconds
- CMS nav items are verifiably non-interactive within 2 seconds of S1 declaration
- Return-path banner is visible without scrolling

**Observability hooks required:**
- `EMERGENCY_FREEZE_DECLARED` event timestamp vs. Zone B route change timestamp
- CMS nav item interaction attempts during EMERGENCY_FREEZE (should produce 0 navigations)
- Operator's first action after Zone B replacement (action log)

**Failure class if failed:** CLASS-CRITICAL
**Mapped patches:** PATCH-014, PATCH-005
**Residual risk if patches applied:** MEDIUM. The CMS form state loss is an unresolved gap (not covered by any patch). Operators who value their in-progress work may be tempted to defer S1 acknowledgment to preserve form state. Mitigation: the constitutional rule is clear (S1 takes priority) but the UI does not protect in-progress CMS state.

---

#### SIM-INC-04: Severity escalation S3 → S1 during active IC session

**Category:** 1 — High-stress incident conditions
**Surfaces tested:** Incident Command
**Operator role under test:** COMMANDER (OPERATOR role, currently serving as commander)
**Setup conditions:**
- Active S3 MAJOR incident, DECLARED state. Commander is on IC surface, Tab 1 (Situation Overview).
- Incident has been active for 22 minutes.
- Incident Identity Bar: amber tint background (`#F57C00` at 15%), "S3 MAJOR" badge, "DECLARED" state pill.
- Zone A: amber state for the affected venue.

**Stress injection:**
- T+0s: ADMIN escalates severity from S3 → S1. API call succeeds.
- T+0s: WebSocket event `SEVERITY_CHANGED` fires.
- T+0s: Incident Identity Bar background tint changes from amber to deep red (`#C62828` at 15%).
- T+0s: Severity badge changes from "S3 MAJOR" amber to "S1 EMERGENCY" deep red.
- T+0s: "Peak: S3" secondary label appears to the right of the new S1 badge (high-water mark).
- T+0s: System Status Bar shifts to full red background.
- T+0s: [Back] browser control is suppressed (S1/S2 rule — EMERGENCY_FREEZE).
- T+0s: Command Log in Tab 2 gains a `SEVERITY_CHANGED` entry.

**Duration:** 60 seconds

**Expected operator behavior:**
1. At T+0s: Commander observes the background color shift in the Incident Identity Bar (ambient peripheral signal — color change is large-surface).
2. Commander reads the new severity badge: "S1 EMERGENCY."
3. Commander checks System Status Bar — full red confirms EMERGENCY_FREEZE.
4. Commander reads "Peak: S3" label to confirm the severity has escalated (not been corrected downward).
5. Commander assesses whether any actions available at S3 are now restricted at S1 (e.g., [Start Handoff] is now disabled per EMERGENCY_FREEZE rules).
6. Commander navigates to Tab 5 (Incident Actions) to review what transitions are now available at S1.

**Expected system behavior:**
1. Identity Bar color change: immediate on WebSocket push, no page reload.
2. Severity badge: updated immediately. Previous badge does not flash or linger.
3. "Peak: S3" label: appears if `severity_high_water` differs from current severity (in this case it does not — S1 is the new peak, so `severity_high_water` = S1 = current severity — label NOT shown). Correction: "Peak: S3" label appears only when the severity has been DE-escalated. At the moment of escalation to S1, `severity_high_water` = S1 = current = no peak label.
4. System Status Bar: shifts to full red within 5 seconds of WebSocket push.
5. Zone A: venue dot shifts to red (S1 color) within 5 seconds.
6. Tab 5 badge (PATCH-010): green dot appears (commander has available transitions at new severity level).

**Failure criteria:**
- Identity Bar tint does not change within 10 seconds of escalation (stale render failure)
- Severity badge retains "S3 MAJOR" appearance after WebSocket update (stale render failure)
- System Status Bar does not shift to full red within 15 seconds (state coherence failure)
- The three elements (Identity Bar tint, severity badge, Status Bar) update in an observable sequence gap of >5 seconds between first and last update (coherence gap — operator may see mixed state)
- Commander cannot identify that severity has changed within 15 seconds (perception failure)

**Pass criteria:**
- All three color/state elements update within 5 seconds of each other
- Commander verbally confirms (in simulation debrief) that they understood severity changed and why
- Tab 5 action badge (PATCH-010) renders within 15 seconds of escalation

**Observability hooks required:**
- WebSocket event timestamp for `SEVERITY_CHANGED`
- UI render timestamps for: Identity Bar tint, severity badge, Status Bar — all three individually
- Time delta between first and last UI element update (must be < 5 seconds)
- Operator first action after T+0s (confirms perception)

**Failure class if failed:** CLASS-CRITICAL
**Mapped patches:** PATCH-010, PATCH-005
**Residual risk if patches applied:** LOW. The multi-element coherent update is an implementation concern — all three elements must subscribe to the same WebSocket event. If they use separate subscriptions with different timing, a coherence gap can occur. This is a frontend architecture risk, not a design risk.

---

#### SIM-INC-05: Multi-alert flood — 7 alerts in 60 seconds

**Category:** 1 — High-stress incident conditions
**Surfaces tested:** Live Operations (all zones)
**Operator role under test:** OPERATOR
**Setup conditions:**
- Operator is viewing Live Operations, single venue, HEALTHY state.
- Zone A Pane A3 notification bell: 0 unread.
- No active incidents.

**Stress injection:** (all alerts fire as system events, some are actionable, some are routine)
- T+0s: Alert 1 — L2 advisory for scheduled content transition (routine, no action required)
- T+8s: Alert 2 — Corpus hash verification completed (routine, positive result)
- T+16s: Alert 3 — L4 operational override placed by another operator (action: operator should review)
- T+24s: Alert 4 — Clock sync delta exceeded ±5s threshold (amber advisory)
- T+32s: Alert 5 — Delivery failure: content item failed to deliver to Venue C (action required: may need escalation)
- T+40s: Alert 6 — L3 override on Venue A auto-expired (informational)
- T+48s: Alert 7 — INCIDENT DECLARED at S2 severity for Venue D (CRITICAL — requires immediate navigation)

**Duration:** 90 seconds

**Expected operator behavior:**
1. T+0s–T+40s: Operator observes notification badge count incrementing in Pane A3 and System Status Bar bell. For routine alerts (1, 2, 6), operator does not need to act immediately.
2. T+32s: Alert 5 (delivery failure) — if the notification severity system is working correctly, this should be visually distinguished from routine alerts.
3. T+48s: Alert 7 (S2 incident) — Active Mode Indicator shifts to "INCIDENT ACTIVE" amber pulse (PATCH-005). Pane A2 shows new S2 incident. This is the highest-priority alert and must be distinguishable from the preceding 6.
4. Within 30 seconds of T+48s: Operator navigates to S2 incident via Pane A2 or notification tray.

**Expected system behavior:**
1. Notification badge count: increments 1→2→3→4→5→6→7 as alerts arrive.
2. Notification tray (if opened): alerts sorted by severity/urgency with INCIDENT DECLARED at top regardless of arrival time.
3. Alert 7 (S2 incident): simultaneously updates Pane A2 (new incident entry, S2 orange badge per PATCH-004), Active Mode Indicator (INCIDENT ACTIVE amber pulse per PATCH-005), and Zone A venue dot (orange for S2).
4. Notification tray must not auto-open (interrupting operator) — badge count is the signal; tray opens on operator click only.

**Failure criteria:**
- Alert 7 (S2 incident) is not visually distinguishable from Alert 1 (routine L2 advisory) in the notification tray or Pane A3 badge (alert severity failure)
- Active Mode Indicator does not shift to INCIDENT ACTIVE within 10 seconds of Alert 7 (PATCH-005 failure)
- Operator navigates to the delivery failure (Alert 5) before the S2 incident (Alert 7), despite Alert 7 arriving later (triage failure — Alert 7 must be the most salient)
- Notification bell count shows 7 but individual alert severities are not communicable from badge alone (all 7 appear equal weight when tray is closed)

**Pass criteria:**
- Within 30 seconds of Alert 7: operator navigates to S2 incident
- Operator correctly identifies Alert 7 as highest priority without opening the tray (i.e., Pane A2 S2 entry or INCIDENT ACTIVE mode signal drives navigation)
- Alerts 1, 2, 6 do not generate any operator action during simulation (correctly triaged as routine)

**Observability hooks required:**
- Alert arrival timestamps for all 7 alerts
- Operator navigation events: which route/surface navigated to and at what time
- Notification tray open events: was the tray opened? At what time? What was the operator looking at immediately before?

**Failure class if failed:** CLASS-CRITICAL (Alert 7 being missed) / CLASS-HIGH (Alert 7 delayed > 60 seconds)
**Mapped patches:** PATCH-004, PATCH-005
**Residual risk if patches applied:** MEDIUM. Alert tray internal severity sorting is not specified in the wireframes — the canonical spec states tray entries show "type icon, text summary, venue name, timestamp" but does not specify sort order within the tray. This is a gap: if tray shows alerts in arrival order, Alert 7 appears at the bottom (most recent) which may be below fold. Tray should sort by severity descending, not arrival time.

---

#### SIM-INC-06: L6 Emergency Override placed — OPERATOR's live view update

**Category:** 1 — High-stress incident conditions
**Surfaces tested:** Live Operations — Zone B Section 1
**Operator role under test:** OPERATOR (viewing Live Ops for the affected venue)
**Setup conditions:**
- OPERATOR is viewing Live Operations for Brisbane CBD (WF-LO-01, HEALTHY state).
- ADMIN is concurrently on the IC surface, Tab 3 (Override Management).
- No active overrides on Brisbane CBD.

**Stress injection:**
- T+0s: ADMIN completes the L6 Emergency Override placement flow (PATCH-001 — all 3 chip confirmations completed). POST to override endpoint.
- T+2s: Server confirms L6 override placed. WebSocket event `OVERRIDE_PLACED` fires with `level: 6`.
- T+2s: Emergency Content Banner renders in Section 1 of the OPERATOR's Live Operations Zone B: "EMERGENCY CONTENT ACTIVE — [content_ref] · Placed by [ADMIN_NAME] · just now"
- T+2s: Override list in Section 4 gains the L6 entry (full red background, bold white text, "L6 EMERGENCY" tag).

**Duration:** 60 seconds

**Expected operator behavior:**
1. OPERATOR is watching the Live Ops dashboard. At T+2s, the Emergency Content Banner appears in Section 1 (full-width red, non-dismissible).
2. Operator reads the banner: confirms it is an L6 emergency override, who placed it, and when.
3. Operator assesses whether they need to respond (S1 event on this venue — may need to navigate to IC surface).
4. If OPERATOR attempts to clear the L6 override from Section 4: [Clear Override] button for L6 is absent (L6 clear requires ADMIN + elevated session).

**Expected system behavior:**
1. Emergency Content Banner: appears within 5 seconds of L6 placement, full-width, red, non-dismissible, no close affordance.
2. Section 4 L6 override entry: appears within 5 seconds. Full red row. "EMERGENCY" tag. "No expiry — manual removal required" in red with warning icon.
3. [Clear Override] button for L6 entry: absent from DOM for OPERATOR role (not disabled — absent).
4. Zone C C4 (Constitutional Advisory): content updates to reflect L6 active state.

**Failure criteria:**
- Emergency Content Banner does not appear within 10 seconds of L6 placement (silent mutation failure — CRITICAL)
- Banner has a dismiss/close control visible to OPERATOR (governance violation)
- Section 4 shows L6 override as identical appearance to an L3 override (level salience failure)
- [Clear Override] is rendered but disabled for OPERATOR on the L6 entry (should be absent, not disabled)
- Operator cannot determine who placed the override from the banner text (accountability failure)

**Pass criteria:**
- Banner appears within 10 seconds and is non-dismissible
- L6 override entry is visually distinct from all other override levels (full red row + EMERGENCY tag)
- Operator reads placer identity from the banner

**Observability hooks required:**
- `OVERRIDE_PLACED` WebSocket event timestamp vs. Emergency Content Banner render timestamp
- Banner dismiss attempt count (must be 0 — no dismiss control rendered)
- Operator action log: did they attempt to clear the L6 override?

**Failure class if failed:** CLASS-CRITICAL
**Mapped patches:** PATCH-001
**Residual risk if patches applied:** LOW. PATCH-001 changes the placement confirmation mechanism but does not affect the OPERATOR's view of the resulting L6 override. The banner appearance and non-dismissibility are constitutional requirements enforced by the surface spec.

---

#### SIM-INC-07: COMMANDER_LAPSED with 0 other operators online

**Category:** 1 — High-stress incident conditions
**Surfaces tested:** Incident Command
**Operator role under test:** OPERATOR (junior, Cert L1, sole viewer)
**Setup conditions:**
- Active S2 CRITICAL incident, COMMANDER_LAPSED state.
- PATCH-012 presence indicator: "Currently viewing: 0 other operators."
- Countdown to Level 1 alert: 8 minutes remaining.
- Operator is the only person on the surface. They have Cert L1 (certification level for routine operations, not incident command).

**Stress injection:**
- T+0s: Scenario begins with operator already on the IC surface, viewing COMMANDER_LAPSED state.
- T+0s: PATCH-012 shows: "Currently viewing: 0 other operators. No other operators currently viewing this incident."
- T+300s (5 minutes): Countdown reaches 3 minutes. Pulse animation begins on countdown text.
- T+480s (8 minutes): Countdown reaches 00:00. Level 1 alert fires.

**Duration:** 600 seconds (10 minutes)

**Expected operator behavior:**
1. Operator reads COMMANDER_LAPSED indicator. Sees 0 other operators online.
2. Operator reads countdown: 8 minutes.
3. Operator decision tree: (a) assume command despite Cert L1 — permissible, the system allows it; (b) use [Notify all] — but 0 others are online, so notification fires to Zone A across all potentially-logged-in sessions.
4. If operator assumes command: PATCH-003 AssumeCommandConfirmCard shows incident context. Operator reads severity (S2) before confirming.
5. If operator does not assume and countdown expires: Level 1 alert fires. System notifies all OPERATOR+ with venue access (not just those currently viewing). This may bring a new operator online.

**Expected system behavior:**
1. PATCH-012: "Currently viewing: 0 other operators" renders immediately. "[Notify all →]" is still available (sends notification to all operators with access, even if not currently viewing). Text: "[Notify all operators with access →]" (clarified label from the 0-online case).
2. Countdown pulse at 3 minutes: text opacity cycles 100%→60% on 1s cycle.
3. Level 1 alert at T+480s: distinguished log entry appears in Tab 2. Push notification fires to all OPERATOR+ with venue access (broader than "currently viewing").
4. After Level 1 alert: no automatic reassignment. The incident remains COMMANDER_LAPSED. Any OPERATOR+ who arrives after the notification may still assume command.

**Failure criteria:**
- PATCH-012 shows "0 other operators" but does not offer any notification action (operator is stuck with no escalation path)
- [Notify all →] label implies "notify viewing operators only" when 0 are online — operator believes notification will reach no one and does not send it
- Level 1 alert at T+480s does not appear in Tab 2 if the operator is on a different tab at that moment (silent event failure)
- System provides no guidance to the lone operator about whether assuming command at Cert L1 is appropriate (UX gap — not a governance issue)

**Pass criteria:**
- PATCH-012 renders 0-online state with appropriate notification label that communicates notifications reach all access-holders, not just viewers
- Level 1 alert entry appears in Tab 2 at T+480s regardless of which tab the operator is on (Tab 2 badge per PATCH-010 renders even when Tab 2 is not active)
- Operator takes one of the two correct actions (assume or notify) within 8 minutes

**Observability hooks required:**
- Presence count data at scenario start: confirm 0 other viewers
- `COMMANDER_LAPSED_NOTIFY_SENT` event: did operator use [Notify all]?
- `COMMAND_ASSUMED` event: did operator assume command? At what time (how much of the 15-minute window remained)?
- `COMMANDER_LAPSED_ALERT_FIRED` event and Tab 2 badge render timestamp

**Failure class if failed:** CLASS-CRITICAL (if operator has no escalation path) / CLASS-HIGH (if operator hesitates and alert fires unnecessarily)
**Mapped patches:** PATCH-012, PATCH-003, PATCH-010
**Residual risk if patches applied:** HIGH. The fundamental risk — a sole junior operator facing an S2 incident without support — is not solvable by UI design alone. PATCH-012 improves the notification affordance. The residual risk requires operational policy (minimum staffing levels, duty manager contact information visible in UI, on-call roster). This is documented as a training and operations gap, not a UI gap.

---

#### SIM-INC-08: Race condition — two operators simultaneously click [Assume Command]

**Category:** 1 — High-stress incident conditions
**Surfaces tested:** Incident Command
**Operator role under test:** Two OPERATOR users simultaneously
**Setup conditions:**
- Active S3 MAJOR incident, COMMANDER_LAPSED state.
- Two operators (Operator A and Operator B) are both on the IC surface simultaneously.
- Both see: "Currently viewing: 1 other operator" (PATCH-012).
- Countdown to Level 1 alert: 4 minutes remaining.

**Stress injection:**
- T+0s: Both operators simultaneously open the AssumeCommandConfirmCard.
- T+3s: Both operators simultaneously click [Confirm — Assume Command].
- T+3s: Two POST requests arrive at the `/incidents/{id}/command/claim` endpoint near-simultaneously.

**Duration:** 30 seconds

**Expected operator behavior:**
- Both operators intend to assume command. One will succeed, one will fail.
- The winning operator sees: COMMANDER_LAPSED indicator replaced by standard commander name display showing their name. No error.
- The losing operator sees: an error state — the claim was rejected because command was already claimed.

**Expected system behavior:**
1. Server processes both POST requests. First to arrive wins (assuming optimistic locking or serialized write).
2. Winner (Operator A): `COMMAND_ASSUMED` event confirms. Identity Bar right group changes to standard commander name = Operator A's name. [Transfer Command] button appears (commander-only control).
3. Loser (Operator B): Server returns an error (e.g., 409 Conflict — command already claimed). The UI must surface this error inline, not silently fail.
4. Error for Operator B: The AssumeCommandConfirmCard shows an inline error message: "Command was just assumed by [Operator A's name]. [View incident]." The confirmation card closes or transitions to an informational state.
5. Both operators see an updated `COMMAND_ASSUMED` log entry in Tab 2 within 10 seconds.
6. PATCH-012 presence indicator for both: updates to show "Currently viewing: 1 other operator" still (neither has navigated away).

**Failure criteria:**
- Both operators see a success confirmation (dual commander assignment — governance violation)
- Operator B receives no feedback about why their claim failed (silent error — they remain confused about whether command was assumed)
- Command is assigned to neither operator (failed write on both — deadlock)
- The error for Operator B is modal/blocking (preventing them from continuing to observe the incident)
- Tab 2 command log shows duplicate `COMMAND_ASSUMED` entries (audit integrity failure)

**Pass criteria:**
- Exactly one `COMMAND_ASSUMED` event in the audit trail
- Operator B receives clear, non-blocking inline error within 10 seconds
- Both operators' UIs reach a coherent state showing the same commander name within 15 seconds

**Observability hooks required:**
- POST request timestamps for both `/command/claim` calls
- Server response codes for both (one 200, one 4xx)
- `COMMAND_ASSUMED` event count in audit trail (must be exactly 1)
- Operator B UI state at T+10s (error shown? action available?)

**Failure class if failed:** CLASS-CRITICAL (dual assignment or deadlock) / CLASS-HIGH (Operator B silent failure)
**Mapped patches:** PATCH-003 (context card), PATCH-012 (presence)
**Residual risk if patches applied:** LOW. Race condition handling is a backend concern. The UI's role is to display the outcome correctly — success for the winner, clear non-blocking error for the loser. The patch improvements make the confirmation intent more deliberate (reducing the likelihood of accidental simultaneous submission) but do not eliminate the race condition, which must be handled server-side.

---

### Category 2: Partial System Degradation

---

#### SIM-DEG-01: WebSocket drop during active monitoring

**Category:** 2 — Partial system degradation
**Surfaces tested:** Live Operations
**Operator role under test:** OPERATOR
**Setup conditions:**
- OPERATOR monitoring Live Operations for Brisbane CBD, HEALTHY state.
- All sections actively receiving WebSocket data.
- Last heartbeat: 8 seconds ago (CURRENT).

**Stress injection:**
- T+0s: WebSocket connection drops (simulate network interruption).
- T+0s: No UI change (immediate — operator unaware).
- T+30s: Last heartbeat data is now 38 seconds old. Section 2 Heartbeat Status: freshness transitions from CURRENT → STALE. Amber dot appears. "(stale)" text renders adjacent to the relative time.
- T+120s: Last heartbeat data is now 128 seconds old. Freshness: STALE → EXPIRED. Red dot. "(expired — last contact 2m ago)".
- T+180s: Constitutional State Indicator: `freshness === "STALE"` — confidence dot turns amber. If `freshness === "EXPIRED"`: "State data expired" appears in red adjacent to the badge.

**Duration:** 240 seconds

**Expected operator behavior:**
1. T+0s–T+29s: Operator is unaware of WebSocket drop (correct — not enough time has passed).
2. T+30s: Operator notices amber dot and "(stale)" in Section 2. Investigates.
3. T+120s: Operator sees "(expired)" in red. Recognizes this as a connection problem, not a venue problem.
4. Operator should check connectivity — there is no "reconnect" button specified. Operator may need to reload the page.
5. Operator does NOT interpret STALE heartbeat as "venue is offline" — STALE means data feed is stale, not that the venue player is offline.

**Expected system behavior:**
1. T+30s: Section 2 Heartbeat Status dot changes from green to amber. "(stale)" text appears.
2. T+120s: Dot changes to red. Text changes to "(expired — last contact 2m ago)".
3. T+30s+: Zone C C2 Health Indicators: Heartbeat row shows STALE state.
4. Constitutional State Indicator: confidence dot amber at STALE, "State data expired" at EXPIRED.
5. The staleness signal is in the data row — not in a persistent banner. There is no top-level WebSocket connection indicator specified. This is a gap.

**Failure criteria:**
- At T+120s, the operator incorrectly concludes the venue is OFFLINE (confusing data staleness with venue state — critical mental model failure)
- Section 2 heartbeat does not update to STALE indicator within 60 seconds of WebSocket drop (stale detection failure)
- No signal exists at T+240s that the data feed is disconnected (silent mutation — operator has no way to know the problem is their connection, not the venue)

**Pass criteria:**
- Operator correctly identifies "data is stale" (connection problem) vs "venue is offline" (venue problem) within 30 seconds of EXPIRED state appearing
- Section 2 and Zone C C2 show coherent staleness indicators within 15 seconds of each other

**Observability hooks required:**
- WebSocket disconnect event timestamp
- UI render timestamp for STALE indicator in Section 2
- Operator action log: did operator reload, navigate away, or investigate?
- Operator verbal report (simulation debrief): "The venue is offline" vs "I lost my data connection" — which did they say?

**Failure class if failed:** CLASS-HIGH (staleness misread as venue offline) / CLASS-MEDIUM (delayed staleness indicator)
**Mapped patches:** None directly. Residual gap: no persistent "WebSocket disconnected" banner is specified. This is an unresolved design gap.
**Residual risk if patches applied:** HIGH. No patch addresses the WebSocket disconnection signal. Recommendation for follow-up: add a persistent amber banner "Data feed disconnected — [Reconnect]" when WebSocket has been disconnected for >10 seconds. Not in scope for this patch cycle.

---

#### SIM-DEG-02: Corpus hash status returns UNKNOWN

**Category:** 2 — Partial system degradation
**Surfaces tested:** Live Operations — Section 2; Venue Operations — Tab 1 Overview
**Operator role under test:** OPERATOR
**Setup conditions:**
- Live Operations, Brisbane CBD, HEALTHY state.
- Section 2 Corpus Hash row: `hash_verified: true, hash_match: true` — "Verified ✓" in green.

**Stress injection:**
- T+0s: Backend fails to return corpus hash verification status. API response for `corpus_status` field: null/absent.
- T+0s: UI receives venue state update with `corpus_status: null`.
- T+0s: Section 2 Corpus Hash row must update.

**Duration:** 60 seconds

**Expected operator behavior:**
1. Operator notices corpus hash row changes state.
2. Operator reads: "Corpus status: UNKNOWN — not verified."
3. Operator understands this means verification has failed (backend) — not that the corpus is mismatched.
4. Operator does NOT treat UNKNOWN the same as MISMATCH (which would indicate a hash divergence).

**Expected system behavior:**
1. When `corpus_status` is absent: row renders "Corpus status: UNKNOWN — not verified" in amber.
2. This is explicitly distinct from:
   - `hash_verified: true, hash_match: false`: "MISMATCH — hash does not match expected" (red)
   - `hash_verified: false`: "Hash not verified" (amber)
   - `hash_verified: true, hash_match: true`: "Verified ✓" (green)
3. The UNKNOWN state uses the same amber color as "Hash not verified" — potential confusion.

**Failure criteria:**
- Corpus hash row displays "UNKNOWN" using the same text and color as "MISMATCH" (conflating verification failure with hash divergence — serious mental model failure)
- Corpus hash row displays "Verified ✓" when `corpus_status` is null (false positive — governance violation)
- Operator concludes "venue has wrong content" when `corpus_status` is null (mental model failure)

**Pass criteria:**
- UNKNOWN state renders in amber with "UNKNOWN — not verified" text (visually distinct from red MISMATCH)
- Operator correctly identifies "backend verification is unavailable" as distinct from "corpus hash mismatch"

**Observability hooks required:**
- Corpus status API response value (null/absent) vs. UI render state
- Operator verbal report: did they distinguish UNKNOWN from MISMATCH?

**Failure class if failed:** CLASS-HIGH
**Mapped patches:** None. The canonical spec already specifies the UNKNOWN rendering. This scenario validates the spec is implemented correctly.
**Residual risk:** MEDIUM. The amber color for both UNKNOWN and "Hash not verified" is a visual similarity that operators may confuse after the initial learning period. The text labels are distinct but color-blind operators may rely on color alone.

---

#### SIM-DEG-03: Constitutional state freshness transitions FRESH → STALE → EXPIRED

**Category:** 2 — Partial system degradation
**Surfaces tested:** Live Operations — System Status Bar
**Operator role under test:** OPERATOR
**Setup conditions:**
- All surfaces, HEALTHY constitutional state. `freshness: FRESH`.
- Constitutional State Indicator: green dot, "HEALTHY" text, confidence dot green.

**Stress injection:**
- T+0s: Constitutional state data feed stops updating (backend stale).
- T+30s: `freshness` transitions to STALE. Confidence dot shifts from green → amber regardless of computed confidence value.
- T+90s: `freshness` transitions to EXPIRED. "State data expired" text appears in red adjacent to the badge.

**Duration:** 120 seconds

**Expected operator behavior:**
1. T+30s: Operator notices confidence dot has turned amber. Reads: "HEALTHY" but confidence dot amber — interprets as "state data may be unreliable."
2. T+90s: Operator reads "State data expired" in red. Understands constitutional state is no longer reliable.
3. Operator does NOT act on constitutional state data after EXPIRED (it may be stale).
4. Operator may reload or seek a secondary status confirmation.

**Expected system behavior:**
1. T+30s: Confidence dot: green → amber. Constitutional state badge: still shows "HEALTHY" (the last known good state).
2. T+90s: "State data expired" text in red. Confidence dot: remains amber or shifts to grey (NONE).
3. All surfaces sharing the same ApplicationShell show the same status bar state simultaneously.

**Failure criteria:**
- Confidence dot remains green at T+30s when `freshness === STALE` (stale confidence failure)
- "State data expired" text does not appear at T+90s (silent mutation failure)
- Badge continues to show "HEALTHY" prominently without any freshness caveat after EXPIRED (false assurance failure)

**Pass criteria:**
- Three-step transition (FRESH→STALE→EXPIRED) produces three visually distinct status bar states
- Operator correctly describes each transition state in debrief

**Observability hooks required:**
- `freshness` field value at T+30s and T+90s in client-side data store
- Confidence dot color at each timestamp (screen recording)

**Failure class if failed:** CLASS-HIGH
**Mapped patches:** None. This validates existing spec behavior.
**Residual risk:** MEDIUM. The "State data expired" text in red is a small 13px label adjacent to the badge. At workstation distance it may be readable but not attention-grabbing. No pulsing or animation is specified for the EXPIRED state in the status bar.

---

#### SIM-DEG-04: PRE resolution null for one venue in fleet view

**Category:** 2 — Partial system degradation
**Surfaces tested:** Live Operations — fleet view (`/fleet`)
**Operator role under test:** ADMIN
**Setup conditions:**
- ADMIN is viewing fleet view with 5 venues. All venues showing HEALTHY state with PRE resolution data.

**Stress injection:**
- T+0s: Backend returns null for `pre_resolution` field for Venue C (Gold Coast RSL). All other venues unaffected.

**Duration:** 30 seconds

**Expected operator behavior:**
1. ADMIN notices Venue C's PRE level display has changed (no longer showing "L2 Campaign").
2. ADMIN reads the degraded state for Venue C's PRE field.
3. ADMIN does NOT interpret other venues as affected.

**Expected system behavior:**
1. Venue C PRE level display: "PRE: —" or "PRE: UNKNOWN" in amber, with a small "(data unavailable)" note. Does not show the last-known PRE level as if it were current.
2. Other venues: unchanged. No cross-venue contamination.
3. Section 3 in Venue C's Zone B (Content & PRE Resolution): "PRE Effective Content: unknown — content data stale" in amber.

**Failure criteria:**
- Venue C shows last-known PRE level without any staleness indicator (false data display)
- Null PRE response causes any other venue's display to error or blank (cross-venue contamination)
- No amber/UNKNOWN indicator for Venue C within 15 seconds of null response

**Pass criteria:**
- Venue C shows UNKNOWN/stale indicator within 15 seconds
- Other venues unaffected

**Observability hooks required:**
- PRE resolution API response for each venue at T+0s
- UI render state for Venue C PRE field at T+15s

**Failure class if failed:** CLASS-HIGH (false data) / CLASS-MEDIUM (delayed indicator)
**Mapped patches:** None.
**Residual risk:** LOW. Null-handling for PRE resolution is specified in the canonical surface specs.

---

#### SIM-DEG-05: Governed clock unavailable

**Category:** 2 — Partial system degradation
**Surfaces tested:** Live Operations — Section 2; all surfaces with timestamps
**Operator role under test:** OPERATOR
**Setup conditions:**
- All surfaces, HEALTHY. Governed clock: synchronized, delta +0.1s (green, within ±5s threshold).

**Stress injection:**
- T+0s: Governed clock becomes unavailable (backend clock service fails).
- T+0s: Clock Sync Status row in Section 2: value changes from "+0.1s" to "Governed clock unavailable" in amber.
- T+0s: System Status Bar Session Clock: continues to show local clock labeled "Wall:" — this is correct behavior (the session clock uses governed time when available, falls back to wall clock labeled "Wall:").

**Duration:** 60 seconds

**Expected operator behavior:**
1. Operator reads Clock Sync row: "Governed clock unavailable" in amber.
2. Operator understands: all governed timestamps on this surface may now use wall clock as fallback.
3. Operator recognizes that any "last action" timestamps in the audit log may be unreliable until governed clock is restored.
4. Operator does NOT treat "governed clock unavailable" as a venue failure — it is a platform service failure.

**Expected system behavior:**
1. Section 2 Clock Sync row: "Governed clock unavailable" in amber immediately on backend failure.
2. System Status Bar Session Clock: "Wall: 14:33:07 AEST" — label remains "Wall:" (no change, this is correct).
3. IC surface Duration clock: may continue using wall clock time — but this means the duration is now less authoritative.
4. Replay surface playhead: governed timestamps are critical for Replay. If governed clock is unavailable, playhead display should note "(using wall clock)" in amber.

**Failure criteria:**
- Clock Sync row does not update to amber within 30 seconds of governed clock failure
- Timestamps elsewhere continue to display without any staleness indicator (silent time trust failure)
- Operator confuses "governed clock unavailable" with "venue offline" (mental model failure)

**Pass criteria:**
- Clock Sync row shows amber warning within 30 seconds
- Operator correctly identifies this as a platform service issue, not a venue issue, in debrief

**Observability hooks required:**
- Governed clock service availability at T+0s
- Clock Sync UI render state at T+30s

**Failure class if failed:** CLASS-MEDIUM
**Mapped patches:** None.
**Residual risk:** MEDIUM. The governance implication of clock unavailability (timestamps are unreliable) is not prominently communicated beyond a single amber row in Section 2. A system-wide amber bar noting "Governed clock unavailable — timestamps may be unreliable" would be more effective but is not currently specified.

---

#### SIM-DEG-06: Command log entries arrive out-of-order (30-second delay)

**Category:** 2 — Partial system degradation
**Surfaces tested:** Incident Command — Tab 2 (Command Log)
**Operator role under test:** COMMANDER
**Setup conditions:**
- Active S3 incident, DECLARED state. Commander on Tab 2.
- 15 command log entries already present, chronological order.

**Stress injection:**
- T+0s: OPERATOR_A adds annotation at governed timestamp 14:32:05.
- T+0s: Due to message queue delay, this entry is held for 30 seconds.
- T+15s: OPERATOR_B adds annotation at governed timestamp 14:32:20.
- T+15s: OPERATOR_B's entry arrives at the client immediately (no delay).
- T+30s: OPERATOR_A's delayed entry arrives. Its governed timestamp is 14:32:05 — earlier than OPERATOR_B's 14:32:20 entry.

**Duration:** 60 seconds

**Expected operator behavior:**
1. At T+15s: Commander sees OPERATOR_B's entry appear at the bottom of the log.
2. At T+30s: OPERATOR_A's earlier entry arrives. It should insert into chronological position (before OPERATOR_B's entry), not append to the bottom.
3. Commander reads the log in chronological order. The late-arriving entry appears in the correct temporal position.
4. If auto-scroll is ON: the arrival of a late entry in the middle of the log does NOT scroll to the bottom. Auto-scroll fires for the truly newest entry. The toast "[N] new entries — scroll to latest" should not fire for a late-arriving historical entry.

**Expected system behavior:**
1. Log sort: always by `governed_timestamp` ascending. Insertion of out-of-order entries requires re-sort of the visible list.
2. Auto-scroll: only fires for entries whose `governed_timestamp` is newer than the last-seen entry. OPERATOR_A's entry (14:32:05) is older than OPERATOR_B's (14:32:20), so auto-scroll does not fire for it.
3. Visual indication: no specific out-of-order indicator is required. The entry simply appears in its correct chronological position.

**Failure criteria:**
- OPERATOR_A's late-arriving entry appends to the bottom of the log (wrong chronological position — misleads commander about incident sequence)
- Auto-scroll fires for the out-of-order entry, jumping the commander's view to an unexpected position
- Log entries become unreadable or blank during re-sort

**Pass criteria:**
- OPERATOR_A's entry appears in chronological position (before OPERATOR_B's entry) within 5 seconds of arrival
- Auto-scroll behavior is consistent (does not jump for the out-of-order entry)

**Observability hooks required:**
- WebSocket event arrival timestamps (actual) vs. governed timestamps in payload
- UI render timestamps for each entry's position in the list
- Auto-scroll event log

**Failure class if failed:** CLASS-HIGH (incorrect chronological display) / CLASS-MEDIUM (auto-scroll misbehavior)
**Mapped patches:** None.
**Residual risk:** MEDIUM. Out-of-order delivery is an inherent risk in distributed systems. The spec requires chronological sort by `governed_timestamp` — implementation must handle re-sort on late arrival.

---

#### SIM-DEG-07: 72h autonomy clock reaches zero during CMS session

**Category:** 2 — Partial system degradation
**Surfaces tested:** CMS Operations, Live Operations (cross-surface alert)
**Operator role under test:** OPERATOR
**Setup conditions:**
- OPERATOR is on CMS `/cms/schedule` (Tab 2), focused on schedule building.
- Venue A (Riverside Golf Club) has been OFFLINE for 71h 50m. Autonomy clock: 10 minutes remaining.
- OPERATOR is not currently viewing any Live Ops surface for Venue A.

**Stress injection:**
- T+0s: Autonomy clock is at 10 minutes remaining. Operator is on CMS.
- T+600s (10 minutes): Autonomy clock reaches zero. Venue A begins serving fallback content.
- T+600s: What cross-surface signal fires?

**Duration:** 660 seconds

**Expected operator behavior:**
1. If the system provides a cross-surface alert when autonomy expires: operator should see it on the CMS surface and navigate to Live Ops for Venue A.
2. If no cross-surface alert exists: operator is unaware until they navigate to Live Ops or Venue Ops for Venue A.

**Expected system behavior:**
From the canonical spec: "Autonomy expiring — venue will serve fallback content" (when < 1h remaining). This message is specified for Zone C C1 (Operational Context) on the Live Operations surface. It is NOT specified as a push notification or cross-surface alert. The Notification Tray (Pane A3) is not specified to receive an autonomy expiry event.

This is a gap: if the operator is on CMS and a venue's autonomy expires, no alert reaches them unless they happen to navigate to Live Ops or Venue Ops.

**Failure criteria:**
- No signal of any kind reaches the OPERATOR on the CMS surface when autonomy expires (silent cross-surface mutation — CRITICAL for a safety-critical timer)
- Operator has been on CMS for the entire 10-minute window without navigating to Live Ops and does not know the venue has entered fallback mode

**Pass criteria:**
- Within 120 seconds of autonomy expiry: OPERATOR receives some signal (notification in Pane A3, active incident created, banner in CMS Zone A) about the autonomy event.
- Note: if no cross-surface signal is specified, this scenario FAILS by design. This is the expected finding.

**Observability hooks required:**
- Notification creation event for autonomy expiry (if it exists)
- Operator navigation events during the 660-second window
- `AUTONOMY_EXPIRED` system event timestamp (if instrumented)

**Failure class if failed:** CLASS-CRITICAL (undetected autonomy expiry on a monitored venue)
**Mapped patches:** None. This is a gap not covered by any patch. Recommendation: autonomy expiry should generate a Level 2 notification in Pane A3 across all surfaces for any operator with access to the affected venue. Not in current scope.
**Residual risk:** HIGH. This is a documented unresolved gap.

---

#### SIM-DEG-08: Replay corpus partially available — 3 of 6 event types missing

**Category:** 2 — Partial system degradation
**Surfaces tested:** Replay Investigation — Tab 1 (Timeline)
**Operator role under test:** OPERATOR
**Setup conditions:**
- POST_INCIDENT replay session for Brisbane CBD, 5-hour window covering an S2 incident.
- Timeline normally shows 6 swim lanes: PRE, OVRD, DEVH, EMRG, PLYR, ANNO.
- Backend confirms that DEVH (Device Health), EMRG (Emergency), and PLYR (Player State) events are unavailable for the first 2 hours of the window (corpus gap).

**Stress injection:**
- T+0s: Session loads. Timeline renders with data gaps in DEVH, EMRG, PLYR swim lanes for the first 2 hours (hours 14:00–16:00).
- Remaining 3 hours (16:00–19:00): all 6 lanes have data.

**Duration:** 30 seconds (scenario setup + observation)

**Expected operator behavior:**
1. Operator opens Tab 1 (Timeline). Observes swim lanes.
2. Operator reads that DEVH, EMRG, PLYR have gaps for hours 14:00–16:00.
3. Operator understands: the corpus record for this period is incomplete. Investigation findings for that window are inconclusive.
4. Operator does NOT treat the empty lanes as "no events occurred in that period" — they must understand these are missing data, not confirmed empty.

**Expected system behavior:**
1. Gap regions in affected swim lanes: rendered with a distinct pattern (hatching, grey fill, or explicit "Data unavailable" label within the lane segment).
2. Tooltip on gap region: "Corpus data unavailable for this period. Events in this window cannot be verified."
3. Session header: a "Data gaps exist — [N] swim lanes incomplete for portions of this session" warning is displayed.
4. The session type may need to be flagged as "INCOMPLETE_CORPUS" rather than "POST_INCIDENT" clean.

**Failure criteria:**
- Gap regions render as empty space without any "missing data" indicator (false completeness — operator concludes "nothing happened" during the gap)
- No warning about corpus incompleteness in the session header
- Operator adds a Finding in Tab 5 based on "absence of events" during the gap period (inference from missing data rather than confirmed data)

**Pass criteria:**
- Gap regions show visual distinction from "empty but complete" swim lanes
- Session header shows corpus incompleteness warning
- Operator correctly describes "data unavailable" (not "no events") in debrief

**Observability hooks required:**
- Corpus data availability response for each swim lane and time window
- UI render state for gap regions (screenshot at session load)
- Operator annotations/findings created during simulation — content analysis for "no events" vs "data unavailable" language

**Failure class if failed:** CLASS-HIGH (false completeness leading to incorrect finding)
**Mapped patches:** None.
**Residual risk:** HIGH. The canonical replay spec does not explicitly define gap region rendering. This is an implementation-level gap that would require specification addition.

---

END OF PART 1

(Continue in STRESS-SIM-PART2.md)


---

## CATEGORY 3: MULTI-OPERATOR CONFLICT SCENARIOS

**Category description:** Two or more operators interact with the same surface, venue, or incident simultaneously. These scenarios validate that the system correctly resolves conflicts, prevents silent overwrites, and surfaces coordination state to all parties.

---

### SIM-CON-01: Simultaneous Override Placement — Same Venue

**Scenario ID:** SIM-CON-01
**Category:** Multi-Operator Conflict
**Severity class if failed:** CLASS-CRITICAL
**Affected surfaces:** Incident Command Surface (Zone B Tab 3), Live Operations Surface (Zone B Intervention Surface)
**Affected wireframes:** WF-IC-04 (Tab 3 Override Inventory), WF-LO-05 (Override Accumulation State)
**Mapped patches:** PATCH-001 (sequential chip-select), PATCH-010 (red dot badge on Tab 3)

**Setup conditions:**
- Venue: PKLAND — S2 CRITICAL incident active
- Operator A (OPERATOR role): IC surface open, beginning L6 override placement flow (Step 1 of 3-step sequential chip-select confirmed)
- Operator B (OPERATOR role): IC surface open, independent session, also beginning L6 override placement flow
- Both operators are viewing the same incident INC-PKLAND-7f3a
- No prior L6 override placed on this venue

**Stress injection:**
- Operator A completes Steps 1–3 and submits [Place L6 Override] at T=0
- Operator B completes Steps 1–3 and submits [Place L6 Override] at T=+0.8s (800ms later, network latency window)
- Server receives Operator A's write first; Operator B's write arrives while A's transaction is still committing

**Expected operator behavior:**
1. Operator A: sees placement confirmed, Zone B Tab 3 updates with the new override entry, red dot badge clears
2. Operator B: receives a conflict error — "Override placement rejected: an override was placed by [Operator A name] at [timestamp]. Refresh to see current state."
3. Operator B: does NOT see their override appear in Tab 3
4. Operator B: can see Operator A's override in Tab 3 after refresh/push update

**Expected system behavior:**
1. Server enforces optimistic locking or equivalent concurrency control on override writes
2. First writer wins; second write is rejected with a 409 Conflict or equivalent
3. Operator B's UI receives a push notification of the conflict result — not a silent failure
4. Audit log records both write attempts with outcome (ACCEPTED / REJECTED_CONFLICT)
5. Tab 3 red dot badge on Operator B's UI updates via WebSocket push to reflect the placed override

**Failure criteria:**
- Both overrides are accepted (duplicate placement, no conflict detection)
- Operator B's UI silently ignores the rejection without displaying an error
- Operator A's placement is replaced by Operator B's without notification to Operator A
- The audit log records only the successful write, not the rejected attempt

**Pass criteria:**
- Exactly one override is placed; the other is rejected with a visible conflict message
- Both operators see a consistent post-resolution Tab 3 state
- Both write attempts appear in audit log with outcome

**Observability hooks required:**
- Override write API response codes for both requests (should be 200 + 409)
- WebSocket push event received by Operator B's session (conflict notification)
- Audit log entries for both write attempts at T=0 and T=+0.8s
- Tab 3 DOM state for Operator B at T+5s (should show Operator A's override, not Operator B's)

**Residual risk:** MEDIUM. Conflict UX (the error message on Operator B's side) is not fully specified in the canonical IC spec. Implementation may choose a toast, a modal, or an inline error. If it is a brief toast, it may be missed under high cognitive load.

---

### SIM-CON-02: Commander Claim Race Condition

**Scenario ID:** SIM-CON-02
**Category:** Multi-Operator Conflict
**Severity class if failed:** CLASS-CRITICAL
**Affected surfaces:** Incident Command Surface (AssumeCommandConfirmCard, Zone A)
**Affected wireframes:** WF-IC-02 (Commander Assumed), WF-IC-03 (COMMANDER_LAPSED)
**Mapped patches:** PATCH-003 (context strip in AssumeCommandConfirmCard), PATCH-012 (presence count + notify link)

**Setup conditions:**
- COMMANDER_LAPSED alert has fired (15-minute claim window elapsed)
- No active commander on INC-PKLAND-7f3a
- Operator A and Operator B are both viewing the IC surface for this incident
- Both see the COMMANDER_LAPSED Level 1 constitutional alert

**Stress injection:**
- Operator A clicks [Assume Command] at T=0
- Operator B clicks [Assume Command] at T=+0.3s (300ms later)
- AssumeCommandConfirmCard appears for both before server resolves

**Expected operator behavior:**
1. Operator A: completes confirmation in AssumeCommandConfirmCard; commander claim succeeds
2. Operator B: AssumeCommandConfirmCard may appear briefly; upon submission, receives error: "Command already claimed by [Operator A name] at [timestamp]."
3. Operator B: sees commander identity update in Incident Identity Bar — Operator A's name appears
4. Neither operator is confused about who holds command after T+5s

**Expected system behavior:**
1. Server enforces single-writer claim on commander field; first claim wins
2. COMMANDER_LAPSED Level 1 alert auto-resolves upon successful claim
3. Operator B's session receives WebSocket push with updated commander identity within 2s
4. Audit log records both claim attempts with outcome
5. AssumeCommandConfirmCard on Operator B's side: either disappears (server rejects) or shows inline error on submit

**Failure criteria:**
- Both operators believe they hold command simultaneously (split-brain commander state)
- No error is shown to Operator B; they remain on the IC surface with a stale COMMANDER_LAPSED banner
- Commander identity in Incident Identity Bar does not update for Operator B within 5s

**Pass criteria:**
- Exactly one commander is set; the other claimant receives a visible error
- All active sessions show consistent commander identity within 5s of resolution
- COMMANDER_LAPSED alert is cleared in all sessions after successful claim

**Observability hooks required:**
- Commander claim API response codes for both requests
- WebSocket push events received by both sessions (commander identity update)
- Incident Identity Bar DOM state for Operator B at T+5s
- Audit log entries for both claim attempts

**Residual risk:** LOW. The commander claim model is well-specified. The main residual risk is the UX of the error on Operator B's side — the spec does not define what the AssumeCommandConfirmCard shows on claim rejection.

---

### SIM-CON-03: COMMANDER_LAPSED — Notify Broadcast Collision

**Scenario ID:** SIM-CON-03
**Category:** Multi-Operator Conflict
**Severity class if failed:** CLASS-HIGH
**Affected surfaces:** Incident Command Surface (COMMANDER_LAPSED state)
**Affected wireframes:** WF-IC-03 (COMMANDER_LAPSED)
**Mapped patches:** PATCH-012 (60s cooldown on notify link, COMMANDER_LAPSED_NOTIFY_SENT audit event)

**Setup conditions:**
- COMMANDER_LAPSED state active for INC-PKLAND-7f3a
- 3 operators viewing the IC surface simultaneously (Operator A, B, C)
- PATCH-012 notify link is visible to all: "Currently viewing: 3 operators — [Notify all →]"
- No prior notification sent (cooldown not active)

**Stress injection:**
- Operator A clicks [Notify all →] at T=0
- Operator B clicks [Notify all →] at T=+0.5s (before cooldown indicator renders for Operator B)
- Operator C clicks [Notify all →] at T=+1.2s

**Expected operator behavior:**
1. Operator A: notification sent; [Notify all →] transitions to "Notified (60s cooldown — [N]s remaining)"
2. Operator B: clicks during the cooldown window; either the button is already showing cooldown state (if push is fast enough) or receives "Notification already sent [N]s ago — please wait [M]s" inline error
3. Operator C: cooldown clearly visible, cannot click

**Expected system behavior:**
1. First notification request at T=0 is accepted; audit event COMMANDER_LAPSED_NOTIFY_SENT logged
2. Requests at T+0.5s and T+1.2s are rejected server-side (idempotency / rate limiting)
3. WebSocket push updates cooldown state for all 3 sessions within 1s of T=0
4. Exactly one notification is delivered to all access-holders — no duplicate notifications

**Failure criteria:**
- Multiple notifications delivered to the same recipients within the 60s window (spam)
- Operator B's click has no visible response (silent failure)
- The cooldown countdown is not visible to all 3 sessions after T=0

**Pass criteria:**
- Exactly one notification delivered; subsequent attempts blocked with visible feedback
- All 3 sessions show cooldown state within 2s of T=0
- COMMANDER_LAPSED_NOTIFY_SENT appears exactly once in audit log

**Observability hooks required:**
- Notify API response codes for all 3 requests (200, 429, 429)
- WebSocket push events for cooldown state update received by all 3 sessions
- Notification delivery log (recipient list, count)
- Audit log entries (count of COMMANDER_LAPSED_NOTIFY_SENT for this incident)

**Residual risk:** LOW. The 60s cooldown is specified in PATCH-012. The main risk is race condition within the first 500ms before the WebSocket push reaches all clients.

---

### SIM-CON-04: Override Removal During Active Viewing

**Scenario ID:** SIM-CON-04
**Category:** Multi-Operator Conflict
**Severity class if failed:** CLASS-HIGH
**Affected surfaces:** Incident Command Surface (Tab 3 Override Inventory)
**Affected wireframes:** WF-IC-06 (L6 Override Placement), WF-IC-07 (L6 Override Removal)
**Mapped patches:** PATCH-002 (hold-to-confirm removal), PATCH-010 (red dot on Tab 3)

**Setup conditions:**
- L6 override placed on venue PKLAND, entry "Entry-L6-001" visible in Tab 3
- Operator A (OPERATOR): Tab 3 open, beginning hold-to-confirm removal flow (holding the button)
- Operator B (ADMIN): Tab 3 open on the same incident, viewing the same override entry

**Stress injection:**
- Operator A completes the 3-second hold; removal submitted at T=0
- At T+0.2s, Operator B clicks on the override entry row detail (expand/view action)
- At T+1.0s, Operator A's removal is committed; the override no longer exists

**Expected operator behavior:**
1. Operator A: sees confirmation "L6 Override removed" in Tab 3; entry disappears
2. Operator B: if viewing the detail panel or expanded row, sees either: (a) the panel closes with a "This override has been removed by [Operator A name]" message, or (b) the expanded row collapses with a visual removal indicator
3. Operator B: does NOT see a stale override entry that implies the L6 is still active

**Expected system behavior:**
1. Removal succeeds for Operator A
2. WebSocket push removes the entry from Operator B's Tab 3 within 2s
3. If Operator B had an expanded detail panel open, the panel either closes with a removal notice or updates in-place
4. Audit log: OVERRIDE_REMOVED by Operator A

**Failure criteria:**
- Operator B's UI continues to show the override as active after it has been removed
- Operator B attempts an action on the removed override and receives a confusing error
- No push notification reaches Operator B's session within 5s

**Pass criteria:**
- Operator B's UI reflects removal within 2s via push
- No stale override state remains visible to any session after removal is committed
- Audit log accurately reflects the removal

**Observability hooks required:**
- WebSocket push event received by Operator B's session (override removal)
- Tab 3 DOM state for Operator B at T+5s (override entry absent)
- Any error responses from actions Operator B attempts on the removed entry

**Residual risk:** MEDIUM. The behavior when a detail panel is open and the underlying entity is removed is not explicitly specified. Implementation may vary.

---

### SIM-CON-05: Simultaneous Severity Escalation Disagreement

**Scenario ID:** SIM-CON-05
**Category:** Multi-Operator Conflict
**Severity class if failed:** CLASS-HIGH
**Affected surfaces:** Incident Command Surface (Tab 1 Incident Overview, severity controls)
**Affected wireframes:** WF-IC-01 (IC Default / Commander View), WF-IC-05 (Tab 1 Incident Overview)
**Mapped patches:** PATCH-010 (tab dot badges), PATCH-004 (Zone A incident badge color)

**Setup conditions:**
- INC-PKLAND-7f3a: current severity S3 MAJOR
- Operator A (OPERATOR, Commander): Tab 1 open, initiating severity escalation to S2 CRITICAL
- Operator B (OPERATOR, non-commander): Tab 1 open, independently initiating severity de-escalation to S4 MINOR

**Stress injection:**
- Operator A submits S2 escalation at T=0
- Operator B submits S4 de-escalation at T=+1.5s (before receiving push update from A's escalation)

**Expected operator behavior:**
1. Operator A: escalation to S2 confirmed; Zone B turns S2 palette; Zone A badge turns `#E64A19`
2. Operator B: de-escalation to S4 is rejected — "Incident severity has changed to S2 CRITICAL since you last viewed this screen. Your change to S4 MINOR was rejected to prevent accidental downgrade. Current severity: S2 CRITICAL."
3. Operator B: sees the current S2 state and can re-evaluate

**Expected system behavior:**
1. Operator A's escalation committed at T=0; incident severity = S2
2. Operator B's change received at T+1.5s; server detects version mismatch — the incident was at S3 when Operator B loaded the page, but is now S2
3. Operator B's request rejected (conflict) with current severity returned
4. All sessions receive WebSocket push of S2 severity; Zone B palette, Zone A badge, status bar update

**Failure criteria:**
- Operator B's S4 de-escalation is accepted after Operator A's S2 escalation commits (silent downgrade)
- No error message shown to Operator B upon rejection
- Zone A badge does not update to S2 for Operator B's session within 5s

**Pass criteria:**
- S2 is the final committed severity; S4 is rejected with visible error
- All sessions show S2 within 5s of Operator A's commit
- Audit log records both severity change attempts with outcome

**Observability hooks required:**
- Severity change API response codes for both requests (200, 409)
- WebSocket push event for S2 update received by Operator B's session
- Zone A badge color at Operator B T+5s (should be `#E64A19`)
- Audit log entries for both severity change attempts

**Residual risk:** MEDIUM. Optimistic locking on incident severity requires careful version-stamping. The UX of the rejection message (its specificity and placement) is not fully defined.

---

### SIM-CON-06: Simultaneous Replay Annotation Conflict

**Scenario ID:** SIM-CON-06
**Category:** Multi-Operator Conflict
**Severity class if failed:** CLASS-MEDIUM
**Affected surfaces:** Replay Investigation Surface (Tab 3 Annotations)
**Affected wireframes:** WF-RP-05 (Tab 3 Annotations), WF-RP-07 (Multi-Collaborator Replay)
**Mapped patches:** PATCH-010 (amber dot on Tab 3 for unresolved contradictions)

**Setup conditions:**
- Replay session REP-PKLAND-001 active
- Two collaborators: Investigator A (ADMIN) and Investigator B (OPERATOR)
- Both have Tab 3 Annotations open
- Timeline position: T+00:12:33

**Stress injection:**
- Investigator A adds annotation at T+00:12:33: "PRE level dropped to L2 — content continuity concern"
- Investigator B (simultaneously) adds annotation at the same timestamp: "PRE level at L5 — no concern"
- Both annotations are accepted (annotations are additive-only — no conflict rejection)

**Expected operator behavior:**
1. Both investigators see both annotations appear in Tab 3 under T+00:12:33
2. The contradiction between "L2 — concern" and "L5 — no concern" is visually flagged
3. PATCH-010: Tab 3 amber dot appears indicating unresolved contradiction
4. Neither investigator can delete the other's annotation (ADMIN-only deletion, and only for free-text on legal order per the canonical spec)

**Expected system behavior:**
1. Both annotations accepted (additive model; no conflict rejection for annotations)
2. System detects semantic contradiction (same timestamp, opposite PRE level claims) — flags as CONTRADICTION state
3. Tab 3 amber dot badge set for all collaborator sessions
4. Audit log: two ANNOTATION_ADDED events; one ANNOTATION_CONTRADICTION_DETECTED event

**Failure criteria:**
- Second annotation silently overwrites the first (additive model violated)
- Contradiction is not flagged — both annotations appear without any visual distinction
- Tab 3 amber dot does not appear for Investigator A's session within 5s

**Pass criteria:**
- Both annotations persist in the additive log
- Contradiction is flagged visually and via badge
- Neither annotation is deletable by Investigator B (non-ADMIN)

**Observability hooks required:**
- Annotation write API response codes for both requests (both 200)
- Tab 3 DOM state showing both annotations at the same timestamp
- Tab 3 badge state (amber dot present/absent) for both sessions
- Audit log: ANNOTATION_CONTRADICTION_DETECTED event

**Residual risk:** HIGH. The canonical spec requires additive-only annotations but does not define automated contradiction detection or the amber dot trigger criteria. This is a PATCH-010 specification that needs implementation definition.

---

### SIM-CON-07: Simultaneous CMS Batch Submission — Same Time Slot

**Scenario ID:** SIM-CON-07
**Category:** Multi-Operator Conflict
**Severity class if failed:** CLASS-HIGH
**Affected surfaces:** CMS Content Operations Surface (Tab 2 Content Calendar)
**Affected wireframes:** WF-CMS-02 (Tab 2 Content Calendar), WF-CMS-06 (72h Hard Block)
**Mapped patches:** PATCH-017 (72h banner Line 2 warning)

**Setup conditions:**
- Venue PKLAND content calendar: Tuesday 18:00–19:00 time slot is empty
- Content Manager A: Tab 2 open, creating a new content entry for Tue 18:00–19:00 slot (not yet submitted)
- Content Manager B: Tab 2 open, creating a different content entry for the same Tue 18:00–19:00 slot (not yet submitted)
- Both are within the 72h lead time window (delivery is due in 60 hours)

**Stress injection:**
- Content Manager A submits their entry at T=0
- Content Manager B submits their entry at T=+2s
- Server receives both; the slot was open when B loaded the page but A has now claimed it

**Expected operator behavior:**
1. Content Manager A: submission confirmed; slot is now occupied with their content
2. Content Manager B: submission rejected — "Time slot Tue 18:00–19:00 is now occupied by [Content A name]. Your submission was not saved. Please select a different slot or contact [Manager A name]."
3. Content Manager B: can see Content Manager A's entry in the calendar after rejection

**Expected system behavior:**
1. Content Manager A's entry committed
2. Content Manager B's write rejected (slot conflict); 409 returned
3. Calendar slot updates via WebSocket push to all active sessions
4. Audit log: CONTENT_SUBMITTED (A) and CONTENT_SUBMISSION_REJECTED_SLOT_CONFLICT (B)

**Failure criteria:**
- Both entries accepted, creating a scheduling collision in the corpus
- Content Manager B's UI shows no error; they believe submission succeeded
- Calendar does not update for Content Manager B's session within 10s

**Pass criteria:**
- Exactly one entry per slot; the conflict is surfaced to the losing submitter
- Calendar is consistent across sessions within 10s
- Corpus delivery confidence is not degraded by the rejected submission

**Observability hooks required:**
- Content submission API response codes (200, 409)
- Calendar slot DOM state for Content Manager B at T+15s
- WebSocket push event received by Content Manager B's session (slot update)
- Audit log entries for both submissions

**Residual risk:** MEDIUM. The 72h delivery lead time means the error is recoverable — the rejected submitter has time to resubmit. Risk is LOW in slow-burn scenarios, MEDIUM if the slot conflict happens near the 72h deadline.

---

### SIM-CON-08: Venue Status Contradiction Between Operators

**Scenario ID:** SIM-CON-08
**Category:** Multi-Operator Conflict
**Severity class if failed:** CLASS-MEDIUM
**Affected surfaces:** Venue Operations Surface (Tab 1 Status Dashboard), Live Operations Surface (Zone B Section 1 Player Health)
**Affected wireframes:** WF-VO-01 (LIVE state), WF-VO-03 (RECOVERED_BUT_UNTRUSTED), WF-LO-08 (RECOVERED_BUT_UNTRUSTED)
**Mapped patches:** PATCH-007 (Zone A dot for RECOVERED_BUT_UNTRUSTED), PATCH-009 (LIVE — UNVERIFIED pill)

**Setup conditions:**
- Venue PKLAND: status is RECOVERED_BUT_UNTRUSTED (just reconnected, corpus hash not yet verified)
- Operator A (VO surface): seeing the LIVE — UNVERIFIED amber pill, override controls are disabled
- Operator B (Live Ops surface): their session is stale — last push was 45s ago and shows LIVE (green) with overrides enabled

**Stress injection:**
- Operator B attempts to place an override in Zone B Intervention Surface while their session shows LIVE (green)
- Operator B's override write reaches the server while PKLAND is still RECOVERED_BUT_UNTRUSTED
- Server should reject the override (overrides blocked in RECOVERED_BUT_UNTRUSTED per canonical spec)

**Expected operator behavior:**
1. Operator A: no action; observing correct LIVE — UNVERIFIED state
2. Operator B: submits override from their stale LIVE view; immediately receives "Override rejected: venue PKLAND is in RECOVERED_BUT_UNTRUSTED state. Hash verification pending. Please wait for confirmation before placing overrides." AND their Zone B Section 1 updates to show the LIVE — UNVERIFIED state

**Expected system behavior:**
1. Override write rejected server-side because venue is RECOVERED_BUT_UNTRUSTED
2. Server triggers a forced state push to Operator B's session with the correct RECOVERED_BUT_UNTRUSTED state
3. Intervention Surface controls become disabled/absent in Operator B's Zone B within 2s
4. Audit log: OVERRIDE_REJECTED_VENUE_UNTRUSTED

**Failure criteria:**
- Override is accepted despite RECOVERED_BUT_UNTRUSTED state (security boundary breach)
- No error shown to Operator B; they believe override succeeded
- Operator B's UI does not update to RECOVERED_BUT_UNTRUSTED state after rejection

**Pass criteria:**
- Override rejected; venue state updated in Operator B's session
- Operator B's override controls are disabled within 2s of rejection
- Audit log accurately reflects the rejection and reason

**Observability hooks required:**
- Override write API response code for Operator B (should be 403 or 409 with reason)
- State push event received by Operator B's session
- Zone B Section 1 DOM state for Operator B at T+5s (LIVE — UNVERIFIED amber pill visible)
- Audit log: OVERRIDE_REJECTED_VENUE_UNTRUSTED event

**Residual risk:** HIGH. A 45-second stale session window is a realistic production scenario in low-network environments. The key risk is whether forced state pushes are implemented for rejection-triggered updates (not just periodic heartbeat updates).

---

## CATEGORY 4: LONG-DURATION FATIGUE SCENARIOS

**Category description:** Operators work extended shifts (6–12 hours). These scenarios validate that the system remains operationally safe when operators are fatigued, habituated, or distracted. Tests focus on attention failures, habituation blindness, and shift-boundary information loss.

---

### SIM-FAT-01: Critical Alert During Attention Valley

**Scenario ID:** SIM-FAT-01
**Category:** Long-Duration Fatigue
**Severity class if failed:** CLASS-CRITICAL
**Affected surfaces:** Live Operations Surface (System Status Bar, Zone A), Incident Command Surface
**Affected wireframes:** WF-LO-01 (HEALTHY baseline), WF-LO-03 (EMERGENCY_FREEZE), WF-IC-08 (S1 EMERGENCY_FREEZE Auto-Replace)
**Mapped patches:** PATCH-005 (Active Mode Indicator pulsing dot), PATCH-014 (S1/S2 Zone B auto-replace info banner)

**Setup conditions:**
- Operator has been on shift for 6 hours
- Venue PKLAND: HEALTHY for last 4 hours (no incidents)
- System Status Bar: green across all 6 indicators
- Zone A: no incident badges, no red dots
- Simulated attention valley: operator is performing low-attention maintenance task (Tab 5 Connectivity log review)

**Stress injection:**
- At T=0: EMERGENCY_FREEZE fires on venue PKLAND (S1)
- Zone B auto-replace fires (per canonical spec): operator's current workspace is replaced with IC surface
- System Status Bar: all indicators flip to S1 red
- Zone A incident badge appears: `#C62828` background

**Expected operator behavior:**
1. Operator notices Zone B has changed — PATCH-014 info banner at bottom: "You were automatically brought here — [View Venue Dashboard →]"
2. Operator reads Incident Identity Bar: S1 EMERGENCY_FREEZE badge, venue name, duration
3. Operator does NOT need to navigate to find the incident — they are already on the IC surface
4. Operator's first action within 30 seconds: either [Assume Command] or [Notify all →] (if COMMANDER_LAPSED)

**Expected system behavior:**
1. Zone B auto-replace fires within 2s of EMERGENCY_FREEZE declaration
2. System Status Bar updates to S1 red across all affected indicators
3. Zone A incident badge `#C62828` with pulsing dot (PATCH-005)
4. PATCH-014 info banner rendered at Zone B bottom with [View Venue Dashboard →] link
5. Audio alert (if configured) fires

**Failure criteria:**
- Zone B auto-replace does not fire within 5s (operator remains on Tab 5 log view, unaware of S1)
- PATCH-014 info banner absent — operator does not know they were automatically redirected
- Operator's first orientation action takes >60s (they were confused about where they are)

**Pass criteria:**
- Operator is on IC surface within 5s of EMERGENCY_FREEZE
- PATCH-014 banner confirms the context switch
- Operator's first meaningful action (assume command or notify) within 30s

**Observability hooks required:**
- Zone B auto-replace event timestamp (T=0 to render)
- PATCH-014 banner render confirmation (screenshot)
- Operator first-click timestamp after T=0 (interaction event log)
- System Status Bar state at T+2s

**Residual risk:** MEDIUM. If audio alerts are not configured or the device is muted, the auto-replace is the only mechanism for a fatigued operator who is looking away from the screen. The PATCH-014 banner mitigates disorientation but does not address the initial alerting problem.

---

### SIM-FAT-02: Override Habituation — Real Urgency Missed

**Scenario ID:** SIM-FAT-02
**Category:** Long-Duration Fatigue
**Severity class if failed:** CLASS-HIGH
**Affected surfaces:** Live Operations Surface (Zone B Intervention Surface, Zone A)
**Affected wireframes:** WF-LO-05 (Override Accumulation), WF-IC-04 (Tab 3 Override Inventory)
**Mapped patches:** PATCH-004 (Zone A badge color by severity), PATCH-010 (red dot on Tab 3)

**Setup conditions:**
- Operator has been on shift for 8 hours
- Over the shift, 6 routine L3 overrides have been placed and resolved (scheduled content adjustments)
- Each time, Zone A showed a badge and Tab 3 had a red dot — operator has learned to dismiss these quickly
- At T=0: an L6 EMERGENCY override is placed automatically by the system (constitutional escalation)

**Stress injection:**
- L6 override appears in Tab 3 — Tab 3 red dot fires (same as routine L3 overrides)
- Zone A badge: `#C62828` for L6 (vs `#F57C00` for the routine L3 overrides seen all shift)
- System Status Bar: CONSTITUTIONAL_RISK state fires (distinct from previous L3 state)
- Operator's habituated pattern: glance at Zone A badge → open Tab 3 → dismiss/acknowledge → return to main view

**Expected operator behavior:**
1. Operator glances at Zone A badge — notices `#C62828` (DEEP RED), not the `#F57C00` they've seen all shift
2. Operator opens Tab 3 — sees L6 EMERGENCY entry, not a routine L3
3. Operator correctly identifies this as non-routine; escalates (does not dismiss)
4. Operator's acknowledgment pause (time from seeing badge to first action) is longer for L6 than it was for L3

**Expected system behavior:**
1. Zone A badge color is `#C62828` — distinct from all prior L3 badges (`#F57C00`)
2. System Status Bar: CONSTITUTIONAL_RISK renders distinctly (different from DEGRADED or normal states)
3. Tab 3 entry: L6 EMERGENCY label is visually distinct from L3 entries (color, icon, or explicit severity label)
4. No mechanism allows the operator to "dismiss" the L6 the same way they dismissed L3s — L6 removal requires PATCH-002 hold-to-confirm

**Failure criteria:**
- Operator dismisses the L6 override without reading it (habituated dismissal pattern)
- Zone A badge for L6 is visually similar to L3 badges (same color or nearly same color)
- Tab 3 entry for L6 looks similar to L3 entries (no severity distinction)

**Pass criteria:**
- Zone A badge color discrimination is sufficient to break the habituated pattern
- Operator's pause time for L6 is measurably longer than for prior L3 overrides
- Operator escalates (does not dismiss) the L6 entry

**Observability hooks required:**
- Zone A badge color values for L3 vs L6 events (must be distinct by hue, not just shade)
- Tab 3 DOM render: L6 entry visual properties vs L3 entry visual properties
- Operator click sequence after T=0 (timing: badge seen → Tab 3 opened → action taken)

**Residual risk:** HIGH. Color discrimination is the primary distinction mechanism here. Fatigue reduces color discrimination ability. The system relies on operators correctly perceiving the color difference between `#C62828` and `#F57C00` after 8 hours. A secondary non-color distinction (icon, explicit text label "EMERGENCY LEVEL 6") in both the Zone A badge and Tab 3 entry is recommended but not yet specified.

---

### SIM-FAT-03: Training Mode Left Active After Shift Change

**Scenario ID:** SIM-FAT-03
**Category:** Long-Duration Fatigue
**Severity class if failed:** CLASS-HIGH
**Affected surfaces:** CMS Content Operations Surface (Training Mode banner), Live Operations Surface
**Affected wireframes:** WF-CMS-07 (Training Mode), WF-LO-01 (HEALTHY baseline)
**Mapped patches:** PATCH-006 (24px amber Training Mode strip always visible above Pane A4)

**Setup conditions:**
- Outgoing operator (Operator A) has been training a new user using CMS Training Mode for 2 hours
- Training Mode: ON — 24px amber strip above Pane A4 shows "TRAINING MODE ACTIVE — Submissions will not affect live corpus"
- Operator A is mid-session when shift change occurs
- Incoming operator (Operator B) takes over the workstation without being briefed on Training Mode status

**Stress injection:**
- Operator B sits down; Operator A has navigated away from CMS to check something in Live Ops
- Training Mode strip: visible in Zone A (always rendered when Training Mode ON per PATCH-006)
- Operator B navigates to CMS Tab 2 to make a real content submission for an upcoming event
- Operator B does not notice the Training Mode strip (fatigue, new session context)
- Operator B submits content; the submission is accepted by Training Mode (not written to live corpus)

**Expected operator behavior:**
1. Operator B should notice the Training Mode amber strip in Zone A before submitting
2. Operator B should either ask "why is there an amber strip?" or read it and toggle Training Mode OFF before submitting real content
3. If Training Mode is noticed post-submission: Operator B understands that their submission was not written to live corpus and must re-submit after disabling Training Mode

**Expected system behavior:**
1. PATCH-006: Training Mode strip is always visible in Zone A, not just in CMS tab
2. Before any content submission in Training Mode, a pre-submit modal fires: "⚠ Training Mode Active — This submission will NOT be written to the live corpus. Are you sure you want to proceed in Training Mode?"
3. Submission in Training Mode logged as TRAINING_SUBMISSION (distinct from real CONTENT_SUBMITTED)
4. Live corpus is not modified

**Failure criteria:**
- Operator B makes a real content submission while Training Mode is ON and believes it went live
- No pre-submit confirmation for Training Mode submissions
- Training Mode strip is not visible to Operator B when they sit down (e.g., only shown in CMS tabs, not Zone A persistently)

**Pass criteria:**
- PATCH-006 strip visible at all times (not just CMS view)
- Pre-submit Training Mode warning fires and requires confirmation
- Live corpus is not modified; TRAINING_SUBMISSION logged

**Observability hooks required:**
- Training Mode strip DOM visibility at workstation handoff time
- Pre-submit modal render for Operator B's first submission
- Submission API call: type (TRAINING_SUBMISSION vs CONTENT_SUBMITTED)
- Live corpus state after Operator B's submission (must be unchanged)

**Residual risk:** MEDIUM. PATCH-006 specifies a persistent strip, which is the primary safeguard. The additional pre-submit modal is a defense-in-depth measure not currently specified in the canonical CMS spec — this simulation recommends it be added.

---

### SIM-FAT-04: Notification Badge Blindness — Missed Escalation

**Scenario ID:** SIM-FAT-04
**Category:** Long-Duration Fatigue
**Severity class if failed:** CLASS-HIGH
**Affected surfaces:** Live Operations Surface (Zone A Pane A2 IncidentList, Zone A badges)
**Affected wireframes:** WF-LO-02 (S3 Incident), WF-LO-01 (HEALTHY baseline)
**Mapped patches:** PATCH-004 (Zone A incident badge color), PATCH-005 (Active Mode Indicator pulsing dot)

**Setup conditions:**
- Operator has been on shift 10 hours
- Zone A has had persistent low-severity badges for 6 hours (S4 MINOR on two other venues)
- Operator has learned to coexist with the S4 badges — they are acknowledged and monitored
- At T=0: a new S2 CRITICAL incident fires on venue PKLAND

**Stress injection:**
- Zone A: S2 badge (`#E64A19`) appears alongside the existing S4 badges (`#FBC02D`)
- Pane A2: new incident entry at top of IncidentList
- PATCH-005: Active Mode Indicator shifts to "INCIDENT ACTIVE" amber state with 8px pulsing dot
- Operator is reviewing a long text document in Zone B (low-attention task)

**Expected operator behavior:**
1. Pulsing dot in PATCH-005 Active Mode Indicator draws peripheral attention
2. Operator notices Zone A has a new, brighter badge color (`#E64A19` vs the existing `#FBC02D`)
3. Operator opens Pane A2 incident list; navigates to the new S2 incident
4. Time from T=0 to incident acknowledged: <2 minutes

**Expected system behavior:**
1. PATCH-005 Active Mode Indicator transitions to "INCIDENT ACTIVE" with 1s pulsing opacity animation
2. Zone A badge for PKLAND: `#E64A19` (distinct from `#FBC02D`)
3. Pane A2: S2 entry at top of list (sorted by severity)
4. System Status Bar: S2 indicators update

**Failure criteria:**
- Operator does not acknowledge the S2 incident within 5 minutes (badge blindness — the new badge blends with existing badges)
- PATCH-005 Active Mode Indicator does not change state (pulsing dot does not fire)
- Pane A2 S2 entry is not sorted above existing S4 entries (incorrect sort order)

**Pass criteria:**
- Operator acknowledges S2 within 2 minutes of T=0
- PATCH-005 pulsing animation is active at T=0
- Zone A badge color distinction between S4 and S2 is perceptible under fatigue conditions

**Observability hooks required:**
- Operator first-click on S2 incident entry (timestamp from T=0)
- PATCH-005 Active Mode Indicator state at T=0 (screenshot)
- Zone A badge colors at T=0 (both S4 and new S2 — should be distinct hues)
- Pane A2 sort order at T=0 (S2 entry must be at top)

**Residual risk:** HIGH. With multiple existing badges present, a new badge's distinctiveness depends on both color discrimination (which degrades under fatigue) and sort order (which must place S2 above S4). The pulsing animation is the most fatigue-resilient signal. If the pulse is subtle, badge blindness risk remains HIGH.

---

### SIM-FAT-05: Long Quiet Period → Sudden S1 Emergency

**Scenario ID:** SIM-FAT-05
**Category:** Long-Duration Fatigue
**Severity class if failed:** CLASS-CRITICAL
**Affected surfaces:** All surfaces (Zone B auto-replace, IC Surface)
**Affected wireframes:** WF-LO-01 (HEALTHY), WF-IC-08 (S1 EMERGENCY_FREEZE Auto-Replace)
**Mapped patches:** PATCH-005, PATCH-014

**Setup conditions:**
- Operator on shift 9 hours; no incidents in the last 7 hours
- All venues: HEALTHY, green across System Status Bar
- Operator is in low-vigilance mode (known human factors phenomenon after extended quiet periods)
- Operator's current task: reviewing past corpus replay (Zone B is showing a Replay Investigation session)

**Stress injection:**
- At T=0: S1 EMERGENCY_FREEZE fires on venue DEVH (different venue from the replay being reviewed)
- Zone B auto-replace fires: operator's replay investigation session is replaced by IC surface for DEVH
- System Status Bar: EMERGENCY_FREEZE state across all 6 indicators
- Zone A: `#C62828` badge for DEVH, pulsing

**Expected operator behavior:**
1. Operator is startled — Zone B changed from a familiar, low-energy replay to a full emergency IC surface
2. PATCH-014 banner: "You were automatically brought here — [View Venue Dashboard →]" allows orientation
3. Operator correctly identifies: "This is a live incident, not the replay I was reviewing"
4. Operator does NOT attempt to use replay controls (the amber REPLAY banner is gone — they are now on a live IC surface)
5. Within 30s: operator begins incident response (assume command or escalate)

**Expected system behavior:**
1. Replay session is cleanly suspended (current replay position saved for resume)
2. Zone B auto-replace renders IC surface for DEVH within 3s
3. PATCH-014 banner renders at Zone B bottom
4. No amber REPLAY banner present (operator is now in live mode)
5. Any replay controls from the previous session are not visible (DOM replaced)

**Failure criteria:**
- Operator sees both replay controls AND live IC controls simultaneously (DOM contamination from previous session)
- Operator attempts to use replay scrubbing on the live incident (mode confusion)
- No PATCH-014 orientation banner — operator does not understand why Zone B changed

**Pass criteria:**
- Zone B cleanly replaced; no replay UI elements persist
- PATCH-014 banner confirms the context switch
- Operator's first action is live-incident-appropriate (not replay-appropriate)

**Observability hooks required:**
- Replay session suspend event (timestamp, current position saved)
- Zone B DOM state at T+3s (replay controls: absent; IC surface: present)
- Amber REPLAY banner: absent at T+3s
- PATCH-014 banner: present at T+3s
- Operator first interaction: is it a replay control or an IC control?

**Residual risk:** MEDIUM. Replay session suspension state is not explicitly specified — if the replay position is not saved on auto-replace, the operator loses their investigation context and must restart from scratch when they return. This is an implementation quality concern, not a safety failure, but it adds cognitive burden at a critical moment.

---

### SIM-FAT-06: Shift Handoff Information Loss

**Scenario ID:** SIM-FAT-06
**Category:** Long-Duration Fatigue
**Severity class if failed:** CLASS-HIGH
**Affected surfaces:** Incident Command Surface (Tab 2 Shift Notes), Live Operations Surface
**Affected wireframes:** WF-IC-02 (Commander View Tab 2), WF-LO-01
**Mapped patches:** PATCH-008 (textarea persistence + ✎ icon on Tab 2 label)

**Setup conditions:**
- Outgoing operator (Shift A Commander): has been managing a recovering S3 incident for 4 hours
- Shift A has written shift notes in Tab 2 (IC surface): 3 paragraphs covering: override history, PRE divergence investigation status, venue connectivity intermittent pattern
- PATCH-008: Tab 2 label shows ✎ icon indicating non-empty notes
- Incoming operator (Shift B) sits down; Shift A commander verbally briefs briefly but does not open Tab 2

**Stress injection:**
- Shift B does not notice the ✎ icon on Tab 2
- Shift B assumes they are starting fresh; does not read the existing notes
- At T+30min: the intermittent connectivity pattern that Shift A documented fires again
- Shift B has no context on the pattern — does not recognize it as recurring

**Expected operator behavior:**
1. Shift B should notice the ✎ icon on Tab 2 during their initial orientation
2. Shift B should open Tab 2 and read the existing notes as part of their handoff routine
3. If they missed the icon: when the connectivity issue fires, they should check Tab 2 for context before escalating from scratch

**Expected system behavior:**
1. PATCH-008: ✎ icon on Tab 2 label is visible regardless of which tab is active
2. Tab 2 notes: persist across sessions (server-stored, not client-only)
3. No mechanism clears Tab 2 notes automatically (must be manual [Clear] action with confirmation)
4. If Shift B begins writing notes, they see the existing content (not a blank textarea) — cannot accidentally overwrite

**Failure criteria:**
- Tab 2 notes are not persisted server-side — lost when Shift A's session ends
- ✎ icon does not render on Tab 2 label when viewed by Shift B (client-only state not shared)
- Tab 2 content is blank when Shift B opens it (notes were cleared automatically or not persisted)

**Pass criteria:**
- Shift B can read all of Shift A's notes in Tab 2 upon opening
- ✎ icon is visible on Tab 2 label before Shift B opens it
- No content is lost at session boundary

**Observability hooks required:**
- Tab 2 content API retrieval for Shift B's session (should return Shift A's notes)
- Tab 2 label DOM: ✎ icon present/absent for Shift B's session
- Session boundary event log: Shift A logout, Shift B login, Tab 2 content state before/after

**Residual risk:** MEDIUM. Server-side persistence of shift notes is implied by PATCH-008 but not explicitly defined in the canonical spec. If notes are stored client-side (sessionStorage), they do not survive session changes. This is a critical implementation requirement.

---

### SIM-FAT-07: Zone C Advisory Panel Habituation

**Scenario ID:** SIM-FAT-07
**Category:** Long-Duration Fatigue
**Severity class if failed:** CLASS-MEDIUM
**Affected surfaces:** Live Operations Surface (Zone C Pane C4 Advisory)
**Affected wireframes:** WF-LO-01 (HEALTHY with Zone C), WF-LO-02 (S3 Incident Zone C)
**Mapped patches:** None (this scenario tests current spec behavior)

**Setup conditions:**
- Operator on shift 8 hours
- Zone C Advisory panel (Pane C4) has shown "ADVISORY: Minor PRE entropy on venue DEVH — no action required" for 6 hours
- Operator has habituated to the advisory (checked it initially, saw no action required, stopped reading it)
- At T=0: the advisory updates: "ADVISORY ESCALATED: PRE entropy on venue DEVH now requires operator review — action recommended within 4 hours"

**Stress injection:**
- Zone C Panel C4 content changes (text update)
- The updated advisory requires operator action, but the panel's visual container looks the same as before
- No badge, no color change, no modal — just text updated in the same Zone C panel the operator stopped reading

**Expected operator behavior:**
1. Operator should notice Zone C Panel C4 has new content (advisory escalated)
2. Operator should read the updated advisory and take recommended action within 4 hours

**Expected system behavior:**
1. Advisory content update fires via WebSocket push
2. Zone C Panel C4 updates in-place — no page reload, no scroll position reset
3. No visual distinction is applied when advisory content escalates (current spec does not define this)

**Failure criteria:**
- Operator does not notice the advisory escalation for >4 hours (past the recommended action window)
- Operator acknowledges the update but does not take action (misreads as the same low-priority advisory)

**Pass criteria:**
- Operator notices the advisory change within 30 minutes (before the 4-hour window closes)
- Operator takes the recommended action

**Observability hooks required:**
- Advisory content update event timestamp
- Operator interaction with Zone C Panel C4 (next click/view after T=0)
- Action taken timestamp

**Residual risk:** CRITICAL. This scenario has no mitigation in the current specification. Zone C advisory escalation looks identical to a low-priority advisory from a visual signal perspective. This is an identified gap: advisory escalation events should trigger a visual state change (color change, badge, or Zone C pulse) to break habituation. This gap should be added to the ambiguity register (A-NEW-01).

---

### SIM-FAT-08: 72h Delivery Timer Habituation — Real Urgency Missed

**Scenario ID:** SIM-FAT-08
**Category:** Long-Duration Fatigue
**Severity class if failed:** CLASS-HIGH
**Affected surfaces:** CMS Content Operations Surface (Tab 2 72h banner, Tab 5 countdown)
**Affected wireframes:** WF-CMS-04 (Tab 5 Delivery Confidence), WF-CMS-06 (72h Hard Block)
**Mapped patches:** PATCH-017 (72h banner Line 2 warning)

**Setup conditions:**
- Operator manages content for 15 venues; 72h countdown banners appear regularly throughout the week
- Most of the time, content is submitted well before the 72h warning fires
- After 3 weeks, the 72h banner is familiar and routine; operator has developed a habit of dismissing it
- At T=0: a 72h warning appears on venue PKLAND, but this one is genuinely critical — if missed, a live event (venue tournament finals) will have no content

**Stress injection:**
- 72h warning banner appears in Tab 2 for PKLAND: "⚠ 72h delivery lead time required for [date]" + PATCH-017 Line 2: "Slots before this time may not sync to venue players before air"
- Warning looks visually identical to the routine 72h warnings the operator has habituated to
- Operator's habituated response: "I'll get to it later" — moves on to other tasks

**Expected operator behavior:**
1. Operator reads the banner (PATCH-017 Line 2 is new context they haven't seen before)
2. Operator checks what event is at risk — recognizes PKLAND tournament finals
3. Operator treats this as urgent and prioritizes content submission

**Expected system behavior:**
1. PATCH-017 banner renders with both Line 1 and Line 2
2. Tab 5 Delivery Confidence panel shows countdown with increasing urgency color (amber > red as deadline approaches)
3. No additional escalation mechanism beyond the banner and Tab 5 countdown

**Failure criteria:**
- Operator dismisses the banner without reading Line 2
- Content is not submitted before the 72h hard block fires (venue falls into hard-block state)
- No escalation mechanism distinguishes the PKLAND tournament warning from routine 72h warnings

**Pass criteria:**
- Operator reads Line 2 and recognizes the urgency
- Content submitted before the 72h hard block

**Observability hooks required:**
- Banner render state (Line 1 and Line 2 both present)
- Operator interaction with Tab 2 after T=0 (did they dismiss or engage?)
- Content submission timestamp for PKLAND (before or after hard block?)
- Tab 5 countdown color state at T=0

**Residual risk:** HIGH. No mechanism currently distinguishes "routine 72h warning" from "critical event 72h warning." This is a specification gap. A "HIGH PRIORITY" flag or event-type label on the 72h banner would allow operators to differentiate. Add to ambiguity register (A-NEW-02).

---

## CATEGORY 5: REPLAY/LIVE CONFUSION SCENARIOS

**Category description:** Operators are simultaneously aware of both live system state and historical replay state. These scenarios validate that the IC-03 rule (zero live write controls in REPLAY mode), the amber REPLAY banner, and mode-switch transitions are sufficient to prevent operators from confusing replay context with live context.

---

### SIM-RPL-01: Replay-to-Live Context Switch Without Mental Model Reset

**Scenario ID:** SIM-RPL-01
**Category:** Replay/Live Confusion
**Severity class if failed:** CLASS-CRITICAL
**Affected surfaces:** Replay Investigation Surface, Live Operations Surface, System Status Bar
**Affected wireframes:** WF-RP-01 (PAUSED baseline), WF-LO-01 (HEALTHY)
**Mapped patches:** PATCH-013 (replay transport state label)

**Setup conditions:**
- Operator has been in an active replay session for 45 minutes (REP-PKLAND-001, POST_INCIDENT review)
- Replay is PAUSED at T+01:15:00 in the session
- Operator needs to check current live state of venue PKLAND (just reconnected after an outage)
- Operator opens Live Operations surface in a new browser tab

**Stress injection:**
- Operator moves between Replay tab and Live Ops tab multiple times in the next 5 minutes
- At T=0: operator is in the Live Ops tab viewing venue PKLAND — they see LIVE (green) state
- Operator navigates back to Replay tab — the amber REPLAY banner is present
- Operator navigates to Live Ops again — they make an override decision based on what they saw in the replay (not what is actually current in live state)

**Expected operator behavior:**
1. Operator correctly identifies: Replay tab has amber REPLAY banner = historical data
2. Operator correctly identifies: Live Ops tab has no REPLAY banner = current live data
3. Operator bases live intervention decisions on Live Ops tab state, not on replay observations
4. Operator does not attempt override actions while in the Replay tab (IC-03: controls absent)

**Expected system behavior:**
1. Amber REPLAY banner: always visible (28px, top of Zone B) in Replay tab — cannot be hidden
2. PATCH-013: replay transport state label clearly shows "STATE: ⏸ PAUSED" — operator knows this is historical
3. Live Ops tab: no amber banner — clearly distinct visual context
4. IC-03 enforcement: zero live write controls in Replay tab (override buttons absent from DOM)

**Failure criteria:**
- Operator attempts to place an override from within the Replay tab (write controls present — IC-03 violation)
- Operator confuses replay state for live state — makes live decisions based on replay data
- The amber REPLAY banner is missing or dismissible

**Pass criteria:**
- REPLAY banner is permanently present in Replay tab across all tab switches
- IC-03 enforced: no override controls in Replay tab
- Operator's live interventions are based on Live Ops tab state

**Observability hooks required:**
- REPLAY banner DOM visibility in Replay tab (persistent across tab switches)
- Override control DOM presence in Replay tab (must be absent)
- Any override API calls from a session with replay_mode: true (should be zero)
- PATCH-013 transport state label text at T=0

**Residual risk:** MEDIUM. Multi-tab workflows are not explicitly addressed in the canonical spec. The spec assumes single-surface at a time. The primary risk is that operators working in multi-tab mode may develop a mental shortcut of "left tab = replay, right tab = live" which breaks if tabs are rearranged or if multiple replay sessions are open.

---

### SIM-RPL-02: Write Action Attempted in Replay Mode

**Scenario ID:** SIM-RPL-02
**Category:** Replay/Live Confusion
**Severity class if failed:** CLASS-CRITICAL
**Affected surfaces:** Replay Investigation Surface (IC-03 enforcement)
**Affected wireframes:** WF-RP-04 (VIEWER Read-Only), WF-RP-01 (PAUSED baseline)
**Mapped patches:** None (IC-03 is a canonical spec rule, not a patch)

**Setup conditions:**
- Operator (OPERATOR role, not ADMIN) is in an active replay session
- REPLAY banner: visible (amber, 28px, persistent)
- Operator is on Tab 1 (Timeline) in the Replay surface
- Operator has just identified a PRE level anomaly in the replay that they want to "correct"

**Stress injection:**
- Operator opens Tab 3 (Annotations) to add a note
- Operator then navigates to what they expect to be an override placement control
- The override controls are absent from DOM (IC-03 enforced)
- Operator is confused — "Where is the override button?"

**Expected operator behavior:**
1. Operator discovers that override controls are absent (not disabled, but absent)
2. Operator reads the amber REPLAY banner — understands they are in historical mode
3. Operator correctly concludes: "I need to go to the Live Ops surface to place an override, not in this replay"
4. Operator does NOT attempt to submit a write request by other means (e.g., direct API call, keyboard shortcut)

**Expected system behavior:**
1. IC-03 strictly enforced: all live write controls absent from DOM in REPLAY mode
2. No override button, no [Declare Incident], no [Place Override +] anywhere in Replay surface
3. REPLAY banner provides context for why write controls are absent
4. If operator attempts an action that would be a write (e.g., keyboard shortcut): either nothing happens or a "Read-only in REPLAY mode" toast appears

**Failure criteria:**
- Any live write control is present in the DOM during REPLAY mode (IC-03 violation)
- Operator finds an alternative write path (keyboard shortcut, right-click, direct form submission)
- No contextual explanation for why write controls are absent

**Pass criteria:**
- Zero live write controls in DOM during REPLAY mode
- REPLAY banner visible throughout
- Operator is not left confused — they understand why controls are absent

**Observability hooks required:**
- Full DOM snapshot of Replay surface during REPLAY mode — check for any write control presence
- Operator keyboard input log during confusion period (looking for shortcut attempts)
- Any write API calls from this session (should be zero)

**Residual risk:** LOW. IC-03 is a hard spec rule and the absent-not-disabled pattern means there is no button to accidentally click. The main risk is operator confusion, which PATCH-013 (transport state label) and the REPLAY banner address.

---

### SIM-RPL-03: Real Incident Fires During Active Replay Session

**Scenario ID:** SIM-RPL-03
**Category:** Replay/Live Confusion
**Severity class if failed:** CLASS-CRITICAL
**Affected surfaces:** Replay Investigation Surface, Incident Command Surface (Zone B auto-replace)
**Affected wireframes:** WF-RP-01 (PAUSED), WF-IC-08 (S1 EMERGENCY_FREEZE)
**Mapped patches:** PATCH-014 (auto-replace orientation banner), PATCH-005 (pulsing dot)

**Setup conditions:**
- Operator is actively working in a Replay Investigation session (REPLAYING state, speed 1x)
- Replay session: REP-DEVH-002 (a historical DEVH incident from 3 days ago)
- At T=0: a real S1 EMERGENCY_FREEZE fires on venue PKLAND (unrelated venue)

**Stress injection:**
- Zone B auto-replace fires: operator's replay session is replaced by IC surface for PKLAND
- Operator was just annotating a finding in the replay — high cognitive engagement
- The transition from historical replay context to live S1 emergency is abrupt
- The venue in the new IC surface (PKLAND) is different from the replay venue (DEVH)

**Expected operator behavior:**
1. Operator startled by Zone B change; reads PATCH-014 orientation banner: "You were automatically brought here"
2. Operator reads Incident Identity Bar: S1 EMERGENCY_FREEZE, venue PKLAND — recognizes this is a DIFFERENT venue from their replay
3. Operator correctly understands: "This is a live emergency on PKLAND, not the DEVH replay I was in"
4. Operator does NOT treat the live incident as part of the historical replay they were reviewing
5. Operator begins incident response

**Expected system behavior:**
1. Zone B auto-replace fires immediately; replay session suspended (position saved)
2. IC surface rendered for PKLAND (not DEVH)
3. PATCH-014 banner: "You were automatically brought here — [View Venue Dashboard →]"
4. Amber REPLAY banner: ABSENT (operator is now in live mode)
5. Venue identity in Incident Identity Bar clearly shows PKLAND

**Failure criteria:**
- Amber REPLAY banner persists on the live IC surface (operator thinks they are still in replay)
- Operator confuses PKLAND (live) with DEVH (replay) — treats live incident as historical
- No orientation banner — operator does not understand why Zone B changed

**Pass criteria:**
- REPLAY banner absent on live IC surface
- PATCH-014 banner present with venue identity confirmed as PKLAND
- Operator's first action is live-incident-appropriate

**Observability hooks required:**
- Zone B DOM state at T+3s: IC surface for PKLAND; no replay controls; no REPLAY banner
- PATCH-014 banner: present, venue name is PKLAND
- Operator first click: IC control (live) not replay control (historical)
- Replay session suspend event (position saved)

**Residual risk:** MEDIUM. The context switch between a DEVH historical replay and a PKLAND live emergency is cognitively demanding — different venue, different time context, different surface. The venue name in the Incident Identity Bar is the critical disambiguation. If the operator is in a state of high replay immersion, they may misread the venue name initially.

---

### SIM-RPL-04: Replay Session Open for Same Venue as Active Live Incident

**Scenario ID:** SIM-RPL-04
**Category:** Replay/Live Confusion
**Severity class if failed:** CLASS-CRITICAL
**Affected surfaces:** Replay Investigation Surface, Incident Command Surface
**Affected wireframes:** WF-RP-08 (DIVERGENCE session), WF-IC-01 (Commander View)
**Mapped patches:** PATCH-013 (transport state label), PATCH-014 (auto-replace banner)

**Setup conditions:**
- Active live S2 CRITICAL incident: INC-PKLAND-7f3a on venue PKLAND
- Simultaneously: Operator opens a Replay Investigation session for the same venue PKLAND, reviewing an older incident (REP-PKLAND-002, from 2 weeks ago)
- Both surfaces are open in different browser tabs
- The venue identity (PKLAND) is the same in both

**Stress injection:**
- Operator switches between tabs rapidly
- In the Replay tab: historical PKLAND data (2 weeks ago, all healthy)
- In the Live IC tab: current PKLAND S2 CRITICAL
- Operator reads something in the replay that contradicts what they see in the live IC tab
- Operator begins to base live decisions on historical replay observations

**Expected operator behavior:**
1. Operator notices amber REPLAY banner in Replay tab (historical PKLAND — 2 weeks ago)
2. Operator notices NO REPLAY banner in Live IC tab (current PKLAND — now)
3. Operator uses the session header of the Replay tab to confirm the date/time of the historical session
4. Operator correctly separates historical context from live context — does not apply historical patterns to live decisions without verification

**Expected system behavior:**
1. REPLAY banner: always present in Replay tab; always absent in Live IC tab
2. Replay session header: clearly shows date/time of the historical session (not "now")
3. PATCH-013: "STATE: ▶ REPLAYING" label in Replay tab confirms mode
4. Live IC tab: Incident Identity Bar shows current timestamp and "ACTIVE" state

**Failure criteria:**
- Operator applies historical replay observations to live incident without verification
- The distinction between historical session date and current session date is not salient enough to notice during rapid tab switching

**Pass criteria:**
- Operator can clearly distinguish historical replay context from live incident context
- REPLAY banner is sufficient to prevent live decision contamination from historical data
- Replay session header date is readable during rapid tab switching

**Observability hooks required:**
- Replay session header date/time render (screenshot)
- Live IC Incident Identity Bar timestamp render (screenshot)
- REPLAY banner DOM state in Replay tab (persistent)
- Any live API write calls from the Replay session (must be zero)

**Residual risk:** HIGH. Same-venue replay + live incident is the highest confusion risk in the entire system. The amber banner and tab labels are the only disambiguators. Adding a "Historical Session — [Date]" label in large text above the replay session header is recommended as a defense-in-depth measure but is not currently specified.

---

### SIM-RPL-05: PAUSED vs REPLAYING Visual Confusion

**Scenario ID:** SIM-RPL-05
**Category:** Replay/Live Confusion
**Severity class if failed:** CLASS-HIGH
**Affected surfaces:** Replay Investigation Surface (transport controls)
**Affected wireframes:** WF-RP-01 (PAUSED), WF-RP-02 (REPLAYING)
**Mapped patches:** PATCH-013 (explicit state label: "STATE: ▶ REPLAYING" / "STATE: ⏸ PAUSED")

**Setup conditions:**
- Operator is reviewing a replay; replay is PAUSED at T+00:45:00
- Operator is annotating findings in Tab 3 (Tab 3 open, timeline not visible)
- Operator believes the replay is running (they left it playing before switching to Tab 3)

**Stress injection:**
- Operator returns to Tab 1 (Timeline) to check the current replay position
- They expect to see T+01:00:00 (15 minutes later); they see T+00:45:00 (paused at same position)
- Operator is confused: "Did I lose 15 minutes of replay? Is the replay still running?"
- Operator checks transport controls — the ⏸ PAUSED icon is present, but the operator is not confident about the icon convention (HF-RP-1 from the human factors audit)

**Expected operator behavior:**
1. Operator sees PATCH-013 state label: "STATE: ⏸ PAUSED" — unambiguous
2. Operator understands: replay was paused, they did not miss anything
3. Operator presses ▶ Play to resume
4. PATCH-013 updates to "STATE: ▶ REPLAYING"

**Expected system behavior:**
1. PATCH-013 state label is always visible above speed selector (not dependent on any hover or toggle)
2. State label is explicit text, not just icon: "STATE: ⏸ PAUSED" / "STATE: ▶ REPLAYING" / "STATE: ◁ SCRUBBING"
3. State label updates in real-time as transport state changes
4. No ambiguity between PAUSED and STOPPED states in the label (both show "PAUSED" — stopped state is not a valid replay state per canonical spec)

**Failure criteria:**
- PATCH-013 state label is absent (only icon is shown)
- State label is ambiguous ("●" / "▶" icon only — does not match HF-RP-1 audit finding)
- Operator cannot determine transport state by reading the label

**Pass criteria:**
- PATCH-013 state label clearly shows "STATE: ⏸ PAUSED" when paused
- State label updates to "STATE: ▶ REPLAYING" within 500ms of pressing Play
- Operator can determine transport state without hovering or expanding any UI

**Observability hooks required:**
- PATCH-013 state label DOM text at T=0 (should be "STATE: ⏸ PAUSED")
- State label update latency after play button press
- Operator click sequence: return to Tab 1 → check state label → press play

**Residual risk:** LOW. PATCH-013 directly addresses HF-RP-1. The explicit text label removes the icon convention ambiguity entirely. Residual risk: the label must be visually prominent enough to be seen without searching (placement above speed selector satisfies this).

---

### SIM-RPL-06: Scrubbing Near Real-Time — Corpus End Misinterpretation

**Scenario ID:** SIM-RPL-06
**Category:** Replay/Live Confusion
**Severity class if failed:** CLASS-HIGH
**Affected surfaces:** Replay Investigation Surface (Timeline Tab, transport controls)
**Affected wireframes:** WF-RP-03 (SCRUBBING state)
**Mapped patches:** PATCH-013 (state label: "STATE: ◁ SCRUBBING")

**Setup conditions:**
- Replay session REP-PKLAND-003: a recent session (corpus ends 30 minutes ago, at T-0:30)
- Operator has scrubbed the timeline to T-0:28 (near the corpus end)
- The timeline shows "2 minutes of corpus remaining"
- Operator is attempting to see "what happened right before the session ended"

**Stress injection:**
- Operator scrubs to T-0:01 (1 minute from corpus end)
- Timeline shows the corpus end boundary — data stops here
- Operator presses ▶ Play; replay runs for 1 minute then stops at corpus end
- Operator sees the venue was HEALTHY at T-0:00 (corpus end)
- Operator wonders: "Is the venue currently HEALTHY, or has something happened in the last 30 minutes?"

**Expected operator behavior:**
1. Operator reads the corpus end label: "Corpus ends here — [timestamp of corpus end]"
2. Operator understands: this shows state 30 minutes ago, not current state
3. Operator navigates to Live Ops surface to check current state
4. Operator does NOT assume that the HEALTHY state at corpus end equals current live state

**Expected system behavior:**
1. Timeline shows a clear corpus-end boundary marker with timestamp
2. PATCH-013: when replay reaches corpus end, state label shows "STATE: ⏸ PAUSED (END OF CORPUS)"
3. No implicit connection between corpus end state and live state
4. Operator can click a "Check current live state" link (or navigate manually to Live Ops)

**Failure criteria:**
- No corpus-end boundary marker on timeline — operator doesn't know they've reached the end
- State label does not differentiate "PAUSED at corpus end" from "PAUSED at midpoint"
- Operator concludes that corpus-end HEALTHY = current live HEALTHY without verification

**Pass criteria:**
- Corpus-end boundary is clearly marked with timestamp
- PATCH-013 state label distinguishes corpus-end pause from mid-session pause
- Operator navigates to Live Ops to verify current state before drawing conclusions

**Observability hooks required:**
- Timeline DOM: corpus-end boundary marker visible with timestamp
- PATCH-013 state label at corpus end (text content)
- Operator navigation after corpus end: do they go to Live Ops?

**Residual risk:** MEDIUM. The "check current live state" affordance at corpus end is not currently specified. Operators who are investigation-focused may not instinctively navigate to Live Ops after reaching corpus end.

---

### SIM-RPL-07: ADMIN Tab 6 Absence — Non-ADMIN Confusion

**Scenario ID:** SIM-RPL-07
**Category:** Replay/Live Confusion
**Severity class if failed:** CLASS-MEDIUM
**Affected surfaces:** Replay Investigation Surface (Tab 6 Counterfactual), Incident Command Surface (Tab 6 Evidence Package)
**Affected wireframes:** WF-RP-09 (Tab 6 ADMIN-only absent), WF-IC-12 (Tab 6 ADMIN-only)
**Mapped patches:** None (Tab 6 absence is a canonical spec rule)

**Setup conditions:**
- Operator (OPERATOR role, not ADMIN) is in a Replay Investigation session
- They are reviewing Tab 5 (Findings) and want to run a counterfactual analysis
- Tab 6 is absent from the tab bar (IC-03 applied: absent-not-disabled for permanent role differences)
- Operator does not know Tab 6 exists

**Stress injection:**
- Operator searches the UI for "counterfactual" or "what if" tools — finds nothing
- Operator attempts to find documentation or a help link in the surface
- Operator escalates to ADMIN colleague: "Where is the counterfactual tool?"
- ADMIN opens the same session — Tab 6 appears in their tab bar

**Expected operator behavior:**
1. Operator correctly concludes that counterfactual analysis requires ADMIN access (after ADMIN confirms)
2. Operator requests ADMIN to run the counterfactual analysis for them
3. Operator does NOT attempt to bypass the access restriction

**Expected system behavior:**
1. Tab 6 is completely absent from DOM for non-ADMIN users (absent-not-disabled)
2. Tab 6 is present for ADMIN users on the same session
3. There is no tooltip, no "upgrade required" message, no "request access" link — Tab 6 simply does not exist for non-ADMINs
4. If operator looks at their tab bar: Tabs 1–5 only; Tab 6 is not visible, grayed, or indicated

**Failure criteria:**
- Tab 6 is visible but disabled for non-ADMIN (reveals existence of hidden capability — security disclosure)
- Tab 6 is accessible to non-ADMIN by direct URL manipulation or keyboard navigation
- ADMIN's Tab 6 is not visible when viewing the same session (incorrect role-based rendering)

**Pass criteria:**
- Tab 6 absent for non-ADMIN; present for ADMIN in same session
- No capability disclosure for non-ADMIN (they don't know what they're missing unless told)
- No security bypass possible

**Observability hooks required:**
- Tab bar DOM for non-ADMIN session (Tab 6 absent)
- Tab bar DOM for ADMIN session (Tab 6 present)
- Any direct URL access attempts to Tab 6 content by non-ADMIN (must return 403)

**Residual risk:** LOW. The absent-not-disabled pattern is well-specified. Main risk is that ADMIN Tab 6 content may be partially visible in other surfaces if the implementation doesn't properly scope the role check.

---

### SIM-RPL-08: Multi-Collaborator Replay — Conflicting Timeline Positions

**Scenario ID:** SIM-RPL-08
**Category:** Replay/Live Confusion
**Severity class if failed:** CLASS-MEDIUM
**Affected surfaces:** Replay Investigation Surface (Timeline Tab, collaborator presence)
**Affected wireframes:** WF-RP-07 (Multi-Collaborator Replay)
**Mapped patches:** PATCH-013 (transport state label)

**Setup conditions:**
- Replay session REP-PKLAND-001 with 3 collaborators: Investigator A (leading), B and C (observing)
- Investigator A is scrubbing the timeline; B and C are supposed to be following
- Each collaborator has independent timeline control (or there is a "follow leader" mode — spec is ambiguous on this)

**Stress injection:**
- Investigator A scrubs to T+01:00:00
- Investigator B's timeline is still at T+00:45:00 (they were taking notes; did not follow A)
- Investigator C followed A and is at T+01:00:00
- All three are now discussing "what happened at T+01:00:00" but B is looking at a different point in time
- B makes an annotation at T+00:45:00 thinking it's the same timestamp A is referencing

**Expected operator behavior:**
1. Collaborators should know each other's timeline positions (via presence indicators)
2. B should notice: "A is at T+01:00:00, I'm at T+00:45:00" and either catch up or flag the discrepancy
3. B should NOT annotate at T+00:45:00 while discussing T+01:00:00 context (temporal mismatch)

**Expected system behavior:**
1. Collaborator presence indicators in session header show each collaborator's current timeline position
2. "Follow A" sync option (if implemented) allows B and C to lock their timeline to A's position
3. Annotation at T+00:45:00 by B is attributed with B's position, not A's

**Failure criteria:**
- No collaborator timeline position indicators — B doesn't know they're at a different position
- B's annotation is attributed to T+01:00:00 (the wrong timestamp — mismatch with B's actual position)

**Pass criteria:**
- Each collaborator's timeline position is visible to all others
- Annotations are attributed to the annotator's current position, not any other collaborator's position

**Observability hooks required:**
- Collaborator presence DOM: each collaborator's timeline position displayed
- Annotation write API payload: timestamp attributed to B's position (T+00:45:00) not A's (T+01:00:00)

**Residual risk:** HIGH. The canonical Replay spec defines collaborator presence (avatars in session header) but does not specify whether timeline positions are shown per collaborator. This is a significant specification gap that should be added to the ambiguity register (A-NEW-03).

---

## SECTION 4: OBSERVABILITY REQUIREMENTS

The following observability hooks are required to execute the simulation suite. All hooks must be implemented before simulation runs can produce valid results.

### 4.1 WebSocket Push Event Logging
- All WebSocket push events must be logged with: event type, payload, recipient session ID, delivery timestamp, acknowledged timestamp
- Required for: SIM-CON-01, SIM-CON-02, SIM-CON-03, SIM-CON-04, SIM-CON-05, SIM-CON-08
- Implementation note: push events should carry a sequence number to detect dropped events

### 4.2 DOM Snapshot Capture
- Automated screenshot and DOM snapshot at specified simulation timestamps (T=0, T+2s, T+5s, T+15s)
- Required for: all SIM-RPL scenarios, SIM-FAT-01, SIM-FAT-04, SIM-FAT-05
- Implementation note: must capture cross-tab state when multi-tab scenarios are in progress

### 4.3 Operator Interaction Event Stream
- All operator clicks, keyboard inputs, and form submissions logged with timestamp, element identity, and session context
- Required for: SIM-FAT-01, SIM-FAT-02, SIM-FAT-04, SIM-RPL-01, SIM-RPL-05
- Implementation note: element identity must include the semantic role (e.g., "Tab3OverrideInventory", "PlaceOverrideButton") not just the CSS class

### 4.4 API Call Audit Log
- All API calls (request, response code, response body, session ID, timestamp) logged for post-simulation analysis
- Required for: all SIM-CON scenarios, SIM-FAT-03, SIM-RPL-02
- Implementation note: rejected writes (409, 403) are as important as accepted writes (200)

### 4.5 Session State Log
- Full session state snapshot at key transitions: session start, surface change, tab change, state push received
- Required for: SIM-CON-02, SIM-FAT-06, SIM-RPL-03, SIM-RPL-04
- Implementation note: session state must include: current surface, active tab, current venue, current mode (LIVE/REPLAY/TRAINING)

### 4.6 Corpus Delivery State Log
- For all 72h-related scenarios: corpus delivery state, countdown value, and hard-block trigger events
- Required for: SIM-FAT-08, SIM-CON-07
- Implementation note: log must include the specific content slot affected and which operator last acted on it

---

## SECTION 5: SURFACE-TO-SCENARIO COVERAGE MATRIX

| Surface | Scenarios |
|---------|-----------|
| Live Operations Surface | SIM-INC-01, SIM-INC-03, SIM-INC-04, SIM-DEG-01, SIM-DEG-03, SIM-DEG-05, SIM-CON-05, SIM-CON-08, SIM-FAT-01, SIM-FAT-02, SIM-FAT-04, SIM-FAT-05 |
| Incident Command Surface | SIM-INC-01, SIM-INC-02, SIM-INC-03, SIM-INC-05, SIM-INC-06, SIM-CON-01, SIM-CON-02, SIM-CON-03, SIM-CON-04, SIM-CON-05, SIM-FAT-01, SIM-FAT-05, SIM-FAT-06, SIM-RPL-03 |
| Replay Investigation Surface | SIM-INC-07, SIM-DEG-08, SIM-CON-06, SIM-RPL-01, SIM-RPL-02, SIM-RPL-03, SIM-RPL-04, SIM-RPL-05, SIM-RPL-06, SIM-RPL-07, SIM-RPL-08 |
| CMS Content Operations Surface | SIM-DEG-06, SIM-INC-08, SIM-CON-07, SIM-FAT-03, SIM-FAT-08 |
| Venue Operations Surface | SIM-DEG-01, SIM-DEG-02, SIM-DEG-03, SIM-DEG-04, SIM-DEG-05, SIM-DEG-07, SIM-CON-08 |

### Wireframe Coverage Matrix

| Wireframe | Scenarios |
|-----------|-----------|
| WF-LO-01 | SIM-FAT-01, SIM-FAT-04, SIM-FAT-05, SIM-FAT-07, SIM-RPL-01 |
| WF-LO-02 | SIM-INC-01, SIM-INC-02, SIM-FAT-04 |
| WF-LO-03 | SIM-INC-03, SIM-FAT-01, SIM-FAT-05 |
| WF-LO-04 | SIM-DEG-01, SIM-DEG-03, SIM-INC-04 |
| WF-LO-05 | SIM-FAT-02, SIM-CON-01 |
| WF-LO-08 | SIM-DEG-05, SIM-CON-08 |
| WF-IC-01 | SIM-INC-01, SIM-CON-05, SIM-FAT-06 |
| WF-IC-02 | SIM-INC-05, SIM-CON-02, SIM-FAT-06 |
| WF-IC-03 | SIM-INC-06, SIM-CON-02, SIM-CON-03 |
| WF-IC-04 | SIM-INC-02, SIM-CON-01, SIM-CON-04, SIM-FAT-02 |
| WF-IC-06 | SIM-INC-05, SIM-CON-04 |
| WF-IC-07 | SIM-INC-05, SIM-CON-04 |
| WF-IC-08 | SIM-INC-03, SIM-FAT-01, SIM-FAT-05, SIM-RPL-03 |
| WF-RP-01 | SIM-RPL-01, SIM-RPL-02, SIM-RPL-05 |
| WF-RP-02 | SIM-RPL-05 |
| WF-RP-03 | SIM-RPL-06 |
| WF-RP-04 | SIM-RPL-02 |
| WF-RP-05 | SIM-CON-06 |
| WF-RP-07 | SIM-CON-06, SIM-RPL-08 |
| WF-RP-08 | SIM-RPL-04 |
| WF-RP-09 | SIM-RPL-07 |
| WF-CMS-02 | SIM-CON-07, SIM-FAT-08 |
| WF-CMS-04 | SIM-FAT-08 |
| WF-CMS-06 | SIM-CON-07, SIM-FAT-08 |
| WF-CMS-07 | SIM-FAT-03 |
| WF-VO-01 | SIM-DEG-01, SIM-DEG-02, SIM-DEG-07 |
| WF-VO-03 | SIM-DEG-05, SIM-CON-08 |

---

## SECTION 6: PATCH COVERAGE VERIFICATION

Each patch from HUMAN-COGNITIVE-LOAD-HARDENING-PATCH-v1.md is validated by at least one simulation scenario.

| Patch | Description | Validating Scenarios |
|-------|-------------|---------------------|
| PATCH-001 | L6 sequential chip-select (3-step) | SIM-INC-05, SIM-CON-01 |
| PATCH-002 | L6 hold-to-confirm removal | SIM-INC-05, SIM-CON-04 |
| PATCH-003 | AssumeCommandConfirmCard context strip | SIM-INC-06, SIM-CON-02 |
| PATCH-004 | Zone A badge color by severity | SIM-INC-01, SIM-FAT-02, SIM-FAT-04, SIM-CON-05 |
| PATCH-005 | Active Mode Indicator pulsing dot | SIM-FAT-01, SIM-FAT-04, SIM-FAT-05 |
| PATCH-006 | Training Mode amber strip always visible | SIM-FAT-03 |
| PATCH-007 | RECOVERED_BUT_UNTRUSTED Zone A dot (rotating ↻, orange) | SIM-DEG-05, SIM-CON-08 |
| PATCH-008 | Tab 2 textarea persistence + ✎ icon | SIM-FAT-06 |
| PATCH-009 | LIVE — UNVERIFIED single amber pill | SIM-DEG-05, SIM-CON-08 |
| PATCH-010 | Tab badge dots (red/amber/green) | SIM-INC-02, SIM-CON-01, SIM-CON-06, SIM-FAT-02 |
| PATCH-011 | Offline autonomy countdown duplicate in Zone B | SIM-DEG-03, SIM-INC-04 |
| PATCH-012 | COMMANDER_LAPSED presence count + notify | SIM-INC-06, SIM-CON-02, SIM-CON-03 |
| PATCH-013 | Replay transport state text label | SIM-RPL-01, SIM-RPL-02, SIM-RPL-05, SIM-RPL-06 |
| PATCH-014 | S1/S2 auto-replace orientation banner | SIM-INC-03, SIM-FAT-01, SIM-FAT-05, SIM-RPL-03 |
| PATCH-015 | Recovery workflow sessionStorage resume | SIM-DEG-05 |
| PATCH-016 | [Declare Incident] secondary button + divider | SIM-INC-01, SIM-INC-02 |
| PATCH-017 | 72h banner Line 2 warning + "Submit anyway" | SIM-FAT-08, SIM-CON-07 |
| PATCH-019 | VO status dashboard section labels | SIM-DEG-01, SIM-DEG-02 |
| PATCH-020 | Machine state history computed duration | SIM-DEG-07 |

**Patches not validated by any scenario:**
- None. All patches have at least one validating scenario.

---

## SECTION 7: RESIDUAL RISK REGISTER

After hardening patch application, the following risks remain unmitigated or partially mitigated.

| Risk ID | Risk Description | Severity | Mitigation Status | Recommended Action |
|---------|-----------------|----------|------------------|--------------------|
| RR-001 | Color discrimination as primary severity distinction degrades under fatigue (8+ hour shifts) | HIGH | PARTIAL — PATCH-004 differentiates colors; no secondary non-color distinction specified | Add explicit severity text label ("EMERGENCY L6", "CRITICAL S2") to Zone A badge and Tab 3 entry |
| RR-002 | Zone C advisory escalation has no visual signal change (habituation breaks monitoring) | CRITICAL | UNMITIGATED — no patch covers this | Add visual state change (color, badge, pulse) when advisory escalates; add A-NEW-01 to ambiguity register |
| RR-003 | Same-venue replay + live incident is the highest mode-confusion scenario; only amber banner distinguishes | HIGH | PARTIAL — amber banner + PATCH-013 transport label | Add "Historical Session — [Date/Time]" large-text label to replay session header |
| RR-004 | Multi-collaborator timeline position visibility not specified | HIGH | UNMITIGATED — spec gap | Add collaborator timeline position to presence indicators; add A-NEW-03 to ambiguity register |
| RR-005 | Routine 72h warning vs critical-event 72h warning indistinguishable | HIGH | PARTIAL — PATCH-017 adds Line 2 | Add content-type or priority flag to 72h banner; add A-NEW-02 to ambiguity register |
| RR-006 | Shift notes persistence cross-session not explicitly specified (may be client-side only) | HIGH | PARTIAL — PATCH-008 implies server persistence | Explicitly specify server-side storage for Tab 2 shift notes in IC canonical spec |
| RR-007 | Replay session state (position) not guaranteed to be saved on auto-replace | MEDIUM | UNMITIGATED | Define replay session suspend/resume behavior in canonical Replay spec |
| RR-008 | AssumeCommandConfirmCard submission UX on claim rejection not specified | MEDIUM | PARTIAL — PATCH-003 adds context strip but not rejection UX | Define error state for AssumeCommandConfirmCard when claim is already taken |
| RR-009 | "Check current live state" affordance at corpus end not specified | MEDIUM | UNMITIGATED | Add corpus-end boundary marker and live-state link to canonical Replay spec |
| RR-010 | Forced state push on override rejection (SIM-CON-08) is implementation-quality dependent | HIGH | UNMITIGATED | Specify forced state push on write-rejection as a canonical system requirement |

---

## SECTION 8: SIMULATION EXECUTION PROTOCOL

### 8.1 Pre-Simulation Requirements
- All observability hooks (Section 4) must be implemented and verified before simulation runs
- All patches from HUMAN-COGNITIVE-LOAD-HARDENING-PATCH-v1.md must be implemented in the test environment
- Test environment must have: at least 2 operator accounts (OPERATOR role), 1 ADMIN account, 1 VIEWER account
- Venue PKLAND and DEVH must be configured in the test environment with seeded corpus data

### 8.2 Simulation Run Order (Recommended)
1. Run all CLASS-CRITICAL scenarios first (SIM-INC-03, SIM-CON-01, SIM-CON-02, SIM-FAT-01, SIM-FAT-05, SIM-RPL-01, SIM-RPL-02, SIM-RPL-03, SIM-RPL-04)
2. Run CLASS-HIGH scenarios (remaining SIM-INC, SIM-DEG, SIM-CON, SIM-FAT scenarios)
3. Run CLASS-MEDIUM scenarios last

### 8.3 Pass/Fail Determination Per Scenario
- A scenario PASSES if: all Pass Criteria are met AND no Failure Criteria are triggered
- A scenario FAILS if: any single Failure Criterion is triggered (failure criteria are sufficient conditions for failure, not requiring all to be met)
- A scenario is INCONCLUSIVE if: observability hooks are insufficient to determine outcome (retry after hook implementation)

### 8.4 Regression Testing
- CLASS-CRITICAL scenarios must be re-run after any modification to:
  - Zone B auto-replace logic
  - IC-03 enforcement (write control rendering)
  - WebSocket push event delivery
  - Commander claim flow
  - L6 override placement/removal flow
- CLASS-HIGH scenarios must be re-run after any modification to the affected surface or patch

### 8.5 Documentation Requirements
- For each scenario run: record start time, all observability hook outputs, pass/fail verdict, any deviations from expected behavior
- For each failure: classify as SPEC_GAP, IMPLEMENTATION_BUG, or UX_FAILURE and file in the residual risk register

---

## SECTION 9: VERDICT FRAMEWORK

### 9.1 Overall Suite Verdict

The suite produces one of four verdicts:

**CERTIFIED_SAFE:** All CLASS-CRITICAL and CLASS-HIGH scenarios pass; ≤2 CLASS-MEDIUM failures with documented mitigations
**CONDITIONAL:** 1–3 CLASS-CRITICAL or CLASS-HIGH failures, all with documented mitigations and timelines; no unmitigated CRITICAL failures
**BLOCKED:** Any unmitigated CLASS-CRITICAL failure; or >3 unmitigated CLASS-HIGH failures
**INCOMPLETE:** Insufficient observability hooks to run ≥20% of scenarios

### 9.2 Minimum Bar for Production Deployment
- All 9 CLASS-CRITICAL scenarios must PASS
- ≥80% of CLASS-HIGH scenarios must PASS
- No unmitigated risk items in RR-001, RR-002, RR-003, RR-004, RR-010 (the five HIGH/CRITICAL residual risks)
- All patches from HUMAN-COGNITIVE-LOAD-HARDENING-PATCH-v1.md must be implemented

### 9.3 New Ambiguity Register Items

Items discovered during simulation design that require specification clarification before simulation can be run:

**A-NEW-01:** Zone C advisory escalation visual signal
- Gap: No visual distinction between "advisory updated (low priority)" and "advisory escalated (requires action)"
- Required addition: canonical spec must define an advisory escalation visual state (color change, badge, or pulse)
- Blocks: SIM-FAT-07 pass criteria definition

**A-NEW-02:** 72h warning priority classification
- Gap: No mechanism to distinguish routine 72h warning from high-criticality 72h warning (e.g., live event)
- Required addition: CMS canonical spec must define an event-type or priority flag for 72h banners
- Blocks: SIM-FAT-08 pass criteria definition

**A-NEW-03:** Multi-collaborator timeline position visibility
- Gap: Replay canonical spec defines collaborator presence (avatars) but not per-collaborator timeline positions
- Required addition: canonical spec must define whether collaborator positions are shown and how
- Blocks: SIM-RPL-08 pass criteria definition

**A-NEW-04:** Forced state push on write rejection
- Gap: System must push correct state to stale sessions when their write is rejected (not just periodic heartbeat)
- Required addition: system architecture must specify rejection-triggered state pushes
- Blocks: SIM-CON-08 pass criteria definition

### 9.4 Simulation Suite Status
- Total scenarios: 40
- CLASS-CRITICAL: 9 (SIM-INC-03, SIM-CON-01, SIM-CON-02, SIM-FAT-01, SIM-FAT-05, SIM-RPL-01, SIM-RPL-02, SIM-RPL-03, SIM-RPL-04)
- CLASS-HIGH: 22
- CLASS-MEDIUM: 7 (SIM-CON-06, SIM-CON-08, SIM-FAT-07, SIM-RPL-05, SIM-RPL-07, SIM-RPL-08, SIM-DEG-08)
- New ambiguity items discovered: 4 (A-NEW-01 through A-NEW-04)
- Patches fully covered: 19/19 (100%)

### 9.5 Recommended Pre-Build Actions (Priority Order)
1. **CRITICAL:** Resolve RR-002 (Zone C advisory escalation) — add visual escalation signal to spec
2. **CRITICAL:** Resolve A-NEW-04 (forced state push on rejection) — specify in system architecture
3. **HIGH:** Resolve RR-001 (color-only severity distinction) — add explicit severity text to Zone A badge and Tab 3
4. **HIGH:** Resolve RR-004 and A-NEW-03 (collaborator timeline positions) — add to Replay canonical spec
5. **HIGH:** Resolve RR-006 (Tab 2 shift notes server persistence) — add explicit storage spec to IC canonical spec
6. **HIGH:** Resolve RR-010 (rejection-triggered state push) — same as A-NEW-04
7. **MEDIUM:** Resolve RR-003 (same-venue replay/live disambiguation) — add historical session date label
8. **MEDIUM:** Resolve RR-005 and A-NEW-02 (72h priority flag) — add to CMS canonical spec
9. **MEDIUM:** Resolve RR-007 (replay suspend/resume on auto-replace) — define in Replay canonical spec
10. **MEDIUM:** Resolve RR-008 (AssumeCommandConfirmCard rejection UX) — define in IC canonical spec

---

END OF PART 2
