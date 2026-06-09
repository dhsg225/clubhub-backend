# Training, Certification, and Simulation Workspace — v1

**Document type:** Operational Surface Specification
**Workspace:** Training, Certification, and Simulation
**Audience:** Frontend engineering, product, QA, instructors
**Constitutional basis:** Training actions are sandboxed. No training action affects production state. Certification governs operator capability access.
**Version:** 1.0
**Status:** Authoritative

---

## Overview

The Training, Certification, and Simulation Workspace is a distinct workspace mode — not a tab within the main operational workspace. Operators enter it via Zone A navigation. While in Training mode, the platform is clearly labeled as TRAINING throughout. All actions within simulation are sandboxed and do not affect production state.

Two distinct roles exist within this workspace:

- **Trainee:** works through training modules, certification examinations, and simulation exercises. Any operator with a platform account is a trainee with respect to certifications they have not yet achieved.
- **Instructor:** monitors trainee sessions, controls simulation parameters, grades examinations, and certifies readiness. Instructor role is granted separately from operational certification level and must be explicitly assigned by ADMIN.

An operator can be both a trainee and an instructor simultaneously — for example, an L3 OPERATOR pursuing L4 certification who also instructs L1 and L2 candidates.

---

## Training Mode Entry

**Entry point in Zone A:** "Training & Certification" link, below primary operational navigation items.

**On click:** a confirmation modal appears before entering training mode:

> "You are entering Training mode. No production state will be affected by actions taken here. Your session in the main workspace will remain active and can be resumed at any time. To leave training mode, use the [Exit Training] button in the training banner."

Modal buttons: [Enter Training] [Cancel].

**On [Enter Training]:**
- System Status Bar is replaced by a blue Training Banner (see below).
- Zone B switches to the Training workspace layout.
- Zone A updates to show training navigation only.
- Zone C is replaced by the progress panel (trainee) or instructor panel (instructor).
- No operational state changes.

Training mode is not a constitutional state. The blue banner is not a system health indicator.

---

## Training Banner

Persistent. Full width. 56 pixels tall. Blue background. Always visible at top of workspace while in training mode.

Contents:
- Left: training mode label — "TRAINING MODE — Actions here do not affect production."
- Right: [Exit Training] button.

[Exit Training] returns to the main operational workspace without confirmation (no destructive action is possible from training mode).

---

## Workspace Layout in Training Mode

The three-zone layout adapts for training mode:

- **Training Banner** (56px, top): replaces System Status Bar.
- **TC-LEFT** (280px): training navigation. Module list, certification tracker, session list.
- **TC-MAIN** (fluid): primary training surface — module content, simulations, examinations.
- **TC-RIGHT** (240px): instructor panel for instructors; progress panel for trainees.
- **Audit Trace Footer** (28px, bottom): shows training session ID and elapsed session time. Format: "Session [session_id] — [HH:MM:SS elapsed]."

---

## Trainee Workspace

### TC-LEFT for Trainee

Three sections in TC-LEFT:

**Module List:**
Ordered by certification level prerequisite, then by module number. A module that has a prerequisite cannot be started until the prerequisite module is COMPLETE.

Each module entry shows:
- Module number and name.
- Estimated time to complete.
- Completion status badge: NOT STARTED (grey) / IN PROGRESS (blue) / COMPLETE (green) / CERTIFIED (gold, for modules that are also examination gates).
- Lock icon if prerequisite not met, with tooltip: "Complete Module [N] first."

**Certification Tracker:**
- Visual horizontal progress bar spanning L1 through L4.
- Current certification level badge displayed prominently: L1 / L2 / L3 / L4.
- Below the bar: "Next: [next certification level]. Required: [list of incomplete prerequisites]."
- Completed prerequisites shown with checkmark. Incomplete shown as empty checkbox.

**Active Examination:**
Only shown when the trainee is in an active timed examination. Shows:
- Examination name.
- Time remaining: countdown timer. Format: MM:SS. Red when < 2 minutes remaining.
- Progress: "Q[N] of [total] answered."

### Training Modules

Six modules. Each has defined prerequisites, assessment criteria, and certification level linkage.

---

#### Module 1 — Platform Orientation

**Certification prerequisite for:** L1 (VIEWER certification).
**Estimated time:** 20 minutes.
**Format:** Interactive walkthrough + identification exercise.
**No instructor required.**

Content:

Part A — Interactive Walkthrough:
The trainee navigates a sandboxed replica of the three-zone workspace (identical layout to production, populated with synthetic data, all actions sandboxed). A step-by-step instruction overlay guides the trainee through each element.

Steps (each shown one at a time):
1. Locate the System Status Bar. Click it to confirm.
2. Identify Zone A — click any Zone A pane to confirm.
3. Identify the zone A venue list (Pane A1). Click it.
4. Identify Zone B — click the center workspace area.
5. Identify Zone C — click the right intelligence panel.
6. Locate the Audit Trace Footer. Click it.
7. Find the current constitutional state indicator in the System Status Bar.
8. Find the governed clock display.
9. Locate the PRE Explainer panel (Zone C, Pane C1).
10. Find the active incident indicator.

Each step: instruction text + [Confirm] button. On click, system validates the trainee clicked the correct element. If incorrect: "Not quite — that's [what they clicked]. Try again." No limit on attempts in walkthrough phase.

Part B — Replay Session:
After the walkthrough, the trainee watches a recorded replay of a reference operator performing routine tasks: checking constitutional state, placing a schedule block, reviewing override stack, reading a PRE resolution trace.

Replay is loaded in the training sandbox replay surface. The trainee watches. No interaction required during playback. A [Play] / [Pause] control is provided. Replay duration: approximately 8 minutes.

Assessment:
Drag-and-drop identification exercise. The trainee is shown a screenshot of the workspace with numbered labels (1–10). They must drag each label to the correct UI element. Must pass 100% (all 10 correct) to mark module COMPLETE. Unlimited attempts on the assessment. Each failed attempt shows which labels were wrong, allows retry immediately.

---

#### Module 2 — PRE Understanding

**Certification prerequisite for:** L2 (OPERATOR — Basic).
**Estimated time:** 30 minutes.
**Format:** Simulation exercises + timed assessment.
**No instructor required.**

Content:

10 simulation exercises of increasing complexity. In each exercise:

1. A PRE resolution output is displayed. Format identical to the PRE Resolution Trace in Zone C Pane C1: winner, resolution level, evaluated levels, reason text, governed timestamp.
2. Trainee selects the resolution level from a list (L0 through L5 with labels).
3. Trainee selects the primary resolution reason from a list of options specific to that exercise.
4. Trainee submits.
5. System shows correct answer and explanation: "The resolution level was L[N] because [explanation]. The reason was [reason] because [explanation]."

Exercise difficulty increases across 10 exercises:
- Exercises 1–3: simple single-level resolutions (no overrides, clear winner).
- Exercises 4–6: override stack present, trainee must identify which override won.
- Exercises 7–9: DOW constraints active, sponsorship SOV visible in resolution trace.
- Exercise 10: emergency override active, trainee must identify L6 suppression of all other levels.

Practice mode: all 10 exercises available without time limit. Trainee can attempt any exercise, see answer, retry.

Assessment:
Same 10 exercises presented in randomized order, 60 seconds per exercise, time visible. Must pass 8 of 10 to mark module CERTIFIED. If time expires on a question: marked as unanswered (incorrect). Results shown after all 10: score, which questions were wrong, correct answers.

On pass: module status changes to CERTIFIED. L2 certification prerequisite for Module 2 is satisfied.
On fail: trainee can return to practice mode and retry assessment after 10 minutes.

---

#### Module 3 — Override Operations

**Certification prerequisite for:** L2 (OPERATOR — Basic).
**Estimated time:** 25 minutes.
**Format:** Simulation with enforced workflow + scenario assessment.
**No instructor required.**

Content:

The trainee operates in a sandboxed venue simulation. The simulation contains a synthetic venue with a live (simulated) PRE resolution, active schedule blocks, and an empty override stack.

Guided exercise sequence:

Step 1: Trainee reads current PRE resolution output. System records that trainee has viewed the resolution.
Step 2: Trainee navigates to Override Control. Places a level 3 override on the sandbox venue. [Preview PRE Resolution] is mandatory — the [Submit for Approval] button is disabled until preview has been completed. Trainee completes the preview, reviews the result, submits the override.
Step 3: System shows override now active (in a simulated "auto-approved" mode — sandbox overrides do not require real approval). Trainee verifies that PRE resolution output has changed to reflect the override. Trainee confirms: [PRE has updated — confirm].
Step 4: Trainee removes the override. [Preview Without This Override] is mandatory before [Confirm Removal]. Trainee completes preview, confirms removal.
Step 5: Trainee verifies that PRE resolution has returned to pre-override state. Trainee confirms: [PRE has restored — confirm].

The system enforces the preview steps. If a trainee attempts to submit or remove without completing the mandatory preview:
- [Submit for Approval] remains greyed.
- Tooltip: "Preview PRE resolution before submitting."

Assessment:
5 override scenarios. Each scenario starts with a different sandbox venue state (varying override stacks, schedule blocks, sponsorship configurations). For each:
- Correct sequence required: preview → place → verify → remove → verify.
- No skipping steps (enforced by disabled buttons as above).
- No time limit on individual steps, but session total timer visible.
- Errors recorded: any incorrect action (e.g., attempting to submit without preview) is logged.

Must complete each of the 5 scenarios in the correct sequence, with zero skipped mandatory previews. Assessment passes when all 5 scenarios are completed correctly.

---

#### Module 4 — Incident Response

**Certification prerequisite for:** L3 (OPERATOR — Advanced).
**Estimated time:** 40 minutes.
**Format:** Timed simulation scenarios.
**No instructor required (S2–S5 scenarios). S1 is instructor-led only — part of Module 6.**

Content:

4 simulated incident scenarios. One each for severity S2, S3, S4, S5. S1 is not included in self-paced training.

For each scenario:
1. The sandbox venue transitions into INCIDENT state at the declared severity. Zone B shows the Incident Commander Surface as it would appear in production (sandboxed, synthetic data).
2. Trainee must:
   a. Read the incident severity correctly (identify S2/S3/S4/S5 from the Incident Commander display).
   b. Identify the correct first action for that severity from a list of 4 options.
   c. Execute that action in the simulated interface.
3. Correct first actions by severity:
   - S5: [Acknowledge Incident] to remove from auto-declaration queue.
   - S4: [Assign to Operator] — select an operator, assign.
   - S3: [Escalate to ADMIN] and [Initiate Forensic Replay].
   - S2: [Initiate Emergency Protocol] and [Notify Emergency Contact].

Time limit: 90 seconds per scenario from the moment the incident is displayed.

After each scenario (pass or fail): explanation shown: "Correct first action for [severity]: [description]. Reason: [explanation]."

Assessment:
Same 4 scenarios in randomized order. Must pass 3 of 4 within 90 seconds each. If time expires: scenario marked failed. Results shown after all 4. Score, time taken per scenario, correct/incorrect first action.

On pass: module status CERTIFIED.
On fail: all 4 scenarios available for retry after 15-minute cooldown.

---

#### Module 5 — Forensic Replay

**Certification prerequisite for:** L3 (OPERATOR — Advanced).
**Estimated time:** 45 minutes.
**Format:** Investigative replay exercise.
**No instructor required.**

Content:

A pre-constructed incident corpus is loaded into the training sandbox replay surface. The corpus contains a complete operational timeline including: normal operation, an anomaly, an incident trigger event, a machine state transition, and a manual override placed in response.

The trainee must investigate using the Replay & Forensics workspace (sandboxed, corpus pre-loaded). The trainee can scrub the timeline, inspect events, read PRE resolution traces, and view the override stack at any governed timestamp.

The trainee must answer 3 investigative questions per scenario (2 scenarios total):

Question format:
1. "At what governed timestamp did the incident trigger event occur?" (Free-text field, governed timestamp format.)
2. "What machine state transition occurred immediately before the trigger?" (Multiple choice, 4 options.)
3. "What was in the override stack at the moment of the trigger?" (Multiple choice, 4 options showing different override stack states.)

The trainee uses the replay surface to find the answers — answers are discoverable from the corpus. No guessing required if the corpus is inspected correctly.

Annotation requirement: during investigation, the trainee must annotate at least 3 events on the timeline (right-click event → Add Annotation → text field). Annotations are saved to the training session record. They are not graded for content — only presence (3 annotations required).

Assessment:
All 3 questions for both scenarios must be answered correctly. Annotation requirement must be met (3 annotations per scenario). No time limit on investigation. A 5-minute time limit applies to answering each question after the investigation phase is marked complete by the trainee clicking [Submit Answers].

On pass: module status CERTIFIED.
On fail: different corpus loaded for retry (different incident scenario, same question format). Retry available immediately.

---

#### Module 6 — Emergency Response

**Certification prerequisite for:** L4 (ADMIN).
**Estimated time:** 60 minutes minimum (variable, instructor-paced).
**Format:** Instructor-led simulation. Not self-paced.
**Requires an active instructor session.**

Module 6 cannot be started without an instructor present. In TC-LEFT, Module 6 shows: "Instructor-led only. You must have an active instructor session to proceed." [Request Instructor Session] button — sends a request to all available instructors. The trainee waits for an instructor to accept and open a joint session.

When an instructor accepts, Module 6 activates. The trainee's TC-MAIN shows the simulation. The instructor's TC-MAIN Tab A (Monitor) shows a mirror view of the trainee's session.

Simulation content:

Scenario 1 — Emergency Override Declaration:
- Instructor injects an INCIDENT_S2 scenario via Simulation Control.
- Trainee must: correctly identify severity, navigate to Override Control, initiate Emergency Override workflow for the affected venue, complete the required confirmation sequence (enter reason, type EMERGENCY, confirm).
- Instructor observes in real time. Instructor can freeze/advance time.
- Trainee must annotate their decisions in the replay annotation panel as they act.

Scenario 2 — Constitutional Freeze Simulation:
- Instructor injects a CONSTITUTIONAL_RISK state transition.
- Trainee must: identify constitutional state from System Status Bar, navigate to the correct surface, initiate the freeze resolution protocol (in simulation — this calls the sandboxed freeze resolution workflow, not production).
- Trainee must explain (via annotation or verbal if voice is available) each step as they take it.

Instructor evaluates using the rubric in Certification Review (see Instructor Workspace, Tab C below).

---

### TC-MAIN for Trainee

TC-MAIN content adapts to the current module state:

**Module walkthrough:** Split view. Left side: the sandboxed workspace interface (full interactive). Right side: instruction text and current step indicator (Step N of M). Instruction panel scrolls independently of the workspace.

**Simulation exercises:** Full sandboxed workspace, identical layout to production workspace. Blue SIMULATION label in all four corners of TC-MAIN. Blue border around entire TC-MAIN area. Synthetic data only — no production data visible. "SIMULATION" watermark in light grey behind the workspace content.

**Replay exercise:** Replay workspace loaded with the pre-constructed corpus. Annotation toolbar visible in TC-MAIN. Same interface as production Replay & Forensics Workspace, labeled "TRAINING REPLAY — Sandbox corpus."

**Timed examination:** Examination display occupies full TC-MAIN. One question at a time. Question text at top. Answer options below (radio buttons or drag-and-drop as appropriate for question type). Progress bar: "Q[N] of [total]." Time remaining: countdown timer, large, right-aligned. [Submit Answer] button. Answer cannot be changed after submission.

---

### Progress Panel (TC-RIGHT for Trainee)

- Current module: name, step N of M (for walkthrough modules), time elapsed in this module.
- Certification progress: checklist of prerequisites for the next certification level above current. Each item: module name, completion status, checkmark or empty circle.
- Recent assessment scores: last 5 assessments, each showing module name, score, pass/fail, date. Scrollable if more than 5.
- [Request Instructor] button: sends an asynchronous notification to all online instructors. No response is guaranteed. If an instructor is available, they will accept and the trainee receives a notification. Response time is not bounded. The button can be pressed at any time, even outside of Module 6.

---

## Instructor Workspace

### TC-LEFT for Instructor

Three sections:

**Active Trainee Sessions:**
List of all operators currently in training mode. Each entry: operator_id, display name, current module, time elapsed in session. Sorted by session start time ascending. Clicking a trainee entry opens their session in TC-MAIN Tab A (Monitor).

If trainee has pressed [Request Instructor]: a notification badge appears on their entry, and a notification appears in TC-LEFT with the trainee's name and "Instructor requested."

**Examination Queue:**
Trainees currently in a timed examination or awaiting examination result review. Entry: operator_id, examination (module name and level), time remaining (if in progress) or "Awaiting review" (if automated grading is pending) or "Awaiting instructor grade" (Module 6 only).

**Certification Requests:**
Trainees who have completed all automated prerequisites for a certification level and are requesting instructor sign-off or ADMIN review. Entry: operator_id, certification level sought, automated assessment results (pass/fail per module). [Review] link opens Certification Review in TC-MAIN Tab C.

---

### TC-MAIN for Instructor

Three sub-modes via tabs.

---

#### Tab A: Monitor

Live read-only view of a selected trainee's current training session.

- Mirror view: instructor sees exactly what the trainee sees in their TC-MAIN. No interaction — instructor cannot click or type in the mirror view.
- Trainee's TC-LEFT and TC-RIGHT are not mirrored — instructor sees only the trainee's TC-MAIN content.
- Trainee identity shown at top: "[operator_id] — [display name] — [current module] — [elapsed time]."
- Instructor annotation panel: text field below the mirror view. Instructor can type notes at any time. Notes are timestamped (governed timestamp at time of typing). Notes are NOT shown to the trainee during the active session. Notes appear in the post-session replay review (available to instructor for debrief).
- If trainee has pressed [Request Instructor]: a notification banner appears at top of Tab A with trainee's name and a text response field. Instructor types a response, presses [Send]. Response appears in the trainee's progress panel (TC-RIGHT) as a text message. Text only — no voice or video in this interface.

---

#### Tab B: Simulation Control

Controls for the shared sandbox simulation environment. Available only in Tab B, only to instructors.

**Scope selector:** select which trainee's sandbox to control. Default: last viewed trainee.

**Controls:**

[Reset Sandbox]:
- Clears all overrides, state transitions, and injected scenarios from the selected trainee's sandbox.
- Returns sandbox to baseline state (LIVE, HEALTHY, no overrides, standard synthetic schedule).
- Confirmation modal: "Reset [operator_id]'s sandbox? This will clear all active overrides and injected scenarios." [Confirm Reset] [Cancel].
- Takes effect within 3 seconds.

[Inject Scenario]:
- Dropdown of pre-built scenarios. Select and click [Inject].
- Available scenarios: VENUE_OFFLINE, INCIDENT_S5, INCIDENT_S4, INCIDENT_S3, INCIDENT_S2, SCHEDULE_CONFLICT, OVERRIDE_EXPIRY, DEGRADED_STATE, CONSTITUTIONAL_RISK, EMERGENCY_FREEZE, CORPUS_STALE, NTP_DESYNC, CHROMIUM_DEAD.
- Each scenario has a description tooltip: what state it creates, what the trainee will see.
- Injection is immediate. No warning given to trainee — this simulates operational surprise.
- Inject button is red to signal the surprise nature of the action.

[Freeze Time]:
- Pauses the governed clock in the selected trainee's sandbox at the current simulation timestamp.
- While frozen: all time-based events in the simulation are paused (scheduled events, override expirations, heartbeat intervals).
- The trainee's workspace continues to function (they can still navigate and act) but nothing new happens due to time passage.
- [Freeze Time] button becomes [Resume Time] while frozen. Pressing [Resume Time] resumes the governed clock.
- A "CLOCK FROZEN" indicator appears in the instructor's Tab B view. Does not appear in trainee's view — instructor uses this silently.

[Advance Time]:
- Moves the simulation governed clock forward by a specified number of minutes.
- Input field: number of minutes (integer, 1–1440).
- [Advance] button.
- Effect: any scheduled events, override expirations, or heartbeat intervals within the advanced window fire immediately in sequence.
- Confirmation: "Advance simulation clock by [N] minutes? This will trigger any events scheduled in that window." [Confirm] [Cancel].

[Grant Elevated Session]:
- Temporarily grants the trainee an elevated session in the sandbox.
- Required for Module 6 trainee actions (Emergency Override, Freeze Resolution).
- Duration: 60 minutes. Shown as countdown in instructor's Tab B.
- [Revoke Session] available at any time.
- Elevated session status is shown to the trainee in their session indicator (same as production elevated session indicator, but labeled "SANDBOX ELEVATED SESSION").

---

#### Tab C: Certification Review

For reviewing trainees in certification examination or requesting sign-off.

**Automated review (L1, L2, L3):**
- Trainee name and current certification level sought.
- Automated assessment results per module: module name, score, pass/fail, date of completion, number of attempts.
- All required modules must be CERTIFIED for the certification level to be grantable.
- If all prerequisites met: [Certify at Level N] button active.
- If prerequisites not met: [Certify at Level N] greyed. Tooltip lists which modules are not yet passed.

**Manual review (L4 — instructor-led Module 6):**
Rubric grading panel. Four criteria, each scored 1–5 by the instructor:

| Criterion | Description | Score range |
|-----------|-------------|-------------|
| Scenario comprehension | Did the trainee correctly identify the severity and affected scope of each injected scenario? | 1–5 |
| First action correctness | Was the first action taken in each scenario constitutionally correct? | 1–5 |
| Recovery workflow | Did the trainee follow the correct constitutional recovery pathway without prompting? | 1–5 |
| Annotation quality | Did the trainee annotate their decisions in the replay surface throughout the session? | 1–5 |

Total: 20 points. 16 or higher required to pass.

Score input: 1–5 integer selector per criterion. Score rationale field (optional, per criterion — free text, saved to session record).

**Actions:**

[Certify at Level N]:
- Active when all automated prerequisites pass AND (for L4) rubric total >= 16.
- Clicking issues certification.
- Certification record: operator_id, certification level, certified_at (governed timestamp), certified_by (instructor operator_id).
- Trainee's role capabilities update immediately to reflect new certification level.
- Trainee receives notification: "Certification level [N] granted. Certified by [instructor_id] at [timestamp]."
- Logged in Certification History (immutable).

[Fail — Remediate]:
- Available at any point. Does not require rubric completion for early failure decision.
- Required: select which modules must be repeated (checkboxes from module list).
- Required: remediation note field (minimum 20 characters). Describes what the trainee needs to improve.
- Trainee notified: "Certification at Level [N] not granted. Required remediation: [list of modules]. Note from instructor: [text]."
- Trainee's current certification level unchanged.
- Logged in Certification History (immutable).

[Request Re-assessment]:
- Opens a scheduling interface — sends a message to the trainee proposing another instructor-led session.
- Does not modify certification status.
- Session scheduling is asynchronous (message-based, not calendar integration within this workspace).

---

### TC-RIGHT for Instructor

**Skill Decay Alerts:**
Operators who were previously certified but have not used specific capabilities in more than 90 days. Each entry:
- operator_id and display name.
- Certification level.
- Last active date (last time the operator performed an action requiring their certified capabilities, not just last login).
- At-risk capability: the specific capability that has not been exercised (e.g., "Emergency Override placement," "Forensic Replay investigation").

Skill decay is detected by absence of relevant audit trail events, not by self-report. The system compares each certified operator's audit trail against their certification level's capability set.

**Readiness Summary:**
Across all operators with platform accounts:
- Count by certification level: L1: [N], L2: [N], L3: [N], L4: [N].
- Count with active (non-expired) certifications: [N] of [total].
- Count with skill decay alerts: [N].
- Count with expiring certifications (within 30 days): [N].

[Export Readiness Report] (ADMIN instructors only): generates a downloadable report (JSON and CSV formats available) containing all operator certifications, certification dates, expiry dates, and skill decay status. Report is generated at current governed timestamp and includes the timestamp in the filename.

---

## Certification Views

### Certification Badge

Four badge levels displayed in operator profiles, Zone A pane (operator identity section), and Certification History.

| Level | Visual | Label |
|-------|--------|-------|
| L1 | Grey badge | Certified Observer |
| L2 | Blue badge | Certified Operator |
| L3 | Blue badge with star overlay | Advanced Operator |
| L4 | Gold badge | Platform Administrator |

Each badge displays:
- Level label.
- operator_id.
- certified_at: governed timestamp.
- certified_by: instructor operator_id, or "Automated" for automated-only certifications.
- expiry_date: certifications expire 12 months from certified_at. Format: "Expires [date]."

When a certification has expired, the badge shows: grey background regardless of level, "EXPIRED" text, "Expired [date]." The operator retains their last known level in the system but capabilities gated to that level are suspended until re-certification.

### Certification History

Per-operator timeline of all certification events. Entries:

- Certification granted: level, certified_at, certified_by.
- Certification failed: level attempted, failed_at, instructor_id (for L4) or "Automated," modules failed.
- Remediation assigned: modules required, instructor note (truncated, full text on expand).
- Certification expired: level, expired_at.
- Re-certification: same format as initial certification grant.

Read-only. Cannot be altered or deleted. Auditable via the platform audit trail. ADMIN can view any operator's certification history. Operators can view their own.

### Capability Map

Per-operator grid showing which platform capabilities are accessible at the operator's current certification level.

Capabilities are grouped by workspace:
- CMS workspace capabilities.
- Incident Commander capabilities.
- Replay & Forensics capabilities.
- Venue Operations capabilities.
- Platform Administration capabilities.

For each capability: name, description (one sentence), minimum certification level required.

Capabilities the operator can access: shown normally.
Capabilities requiring a higher level: greyed out. Tooltip: "Requires L[N] certification. [Brief description of how to achieve it]."
Capabilities that were accessible at a previous (expired) level: shown in amber with "Certification expired — re-certify to restore access."

---

## Examination Constraints

The following constraints apply during all timed examinations (Modules 2, 4, 5 assessment phases):

**Time enforcement:**
- Per-question time limits are enforced by the server, not just the client. The client timer is a display of server-computed time remaining.
- If a question's time limit expires before submission: the question is automatically marked as unanswered. System moves to the next question. No partial credit.
- If total examination time expires: all remaining unanswered questions are marked as unanswered.

**Answer finality:**
- Answers cannot be changed after [Submit Answer] is pressed.
- No back-navigation between questions during examination mode.

**Documentation access:**
- The workspace does not provide access to help documentation within the examination interface.
- External browser tabs are not blocked by the platform — the platform does not enforce external access restrictions.
- The workspace provides no in-examination hint system.
- If an operator opens the documentation portal in a separate browser tab during examination: this is not tracked or penalized by the platform. The assessment design assumes operators work from understanding, not from reference.

**Remaining time display:**
- Timer shown prominently in TC-MAIN during examinations.
- When time remaining < 2 minutes for total examination: timer turns amber.
- When time remaining < 30 seconds: timer turns red and a brief (1-second) vibration animation applies to the timer element.

**Accessibility accommodation:**
- Operators with documented accessibility needs can have extended time granted by ADMIN.
- ADMIN sets an `extended_time` flag on the operator's account.
- Extended time doubles all per-question time limits. Total examination time is adjusted proportionally.
- Extended time flag is visible in the operator's Certification History (recorded at the time of any examination taken under extended time).

---

## Instructor-Led Session Constraints (Module 6)

During Module 6:

- Trainee workspace: simulation only, no production workspace access. If trainee navigates to Zone A and attempts to open a production venue: blocked with message "Production access suspended during instructor-led session."
- Instructor can inject scenarios at any time without prior warning. This is by design — real operational situations do not announce themselves.
- Instructor can freeze and advance time without trainee notification. The trainee's display updates immediately to reflect the new simulation state.
- Annotation is required for grading. Trainee must annotate in the timeline annotation panel. The system records annotation count and timestamps. Instructor sees these in the rubric review. If trainee reaches end of session with fewer than 3 annotations: a prompt appears — "Add at least 3 timeline annotations before the instructor can complete grading." The session does not close until annotations are present.
- Trainee must request the elevated session from the instructor (via [Request Instructor] button). Instructor grants via [Grant Elevated Session] in Simulation Control. The trainee cannot self-grant an elevated session — even in sandbox.

---

## Replay-Assisted Learning

Any past trainee simulation session can be opened in replay mode for review. The session corpus is the complete record of everything that occurred in the sandbox during that session, including injected scenarios, trainee actions, governed timestamps, and PRE resolution traces.

**Trainee self-review:**
Trainee can open any of their own past sessions in the training replay surface via TC-LEFT → "Session History." Sessions listed by date and module, showing pass/fail outcome.

The replay surface in this context is identical to the Replay & Forensics Workspace with one addition: annotation prompts appear at key events. At each event of type OPERATOR_ACTION, INCIDENT_DECLARED, or OVERRIDE_PLACED: a prompt appears in the right annotation panel — "What did you observe here? What would you do?" The trainee can answer (free text) and save the annotation. These annotations are stored on the session record.

Annotation prompts are visible only to the trainee in their own session review. Instructors cannot see these prompts when viewing the session — they see only annotations the trainee has actually submitted.

**Instructor post-session debrief:**
Instructor can open any trainee's past session in replay from TC-MAIN Tab A by pressing [Open Session in Replay]. The replay surface shows the full session timeline with the instructor's own annotations (from the monitor session) timestamped in the annotation panel. Instructor annotations are shown separately from any trainee annotations (differentiated by color and label: "Instructor note" vs "Trainee annotation").

---

## Accessibility

**Reading accessibility:**
All module instruction text, assessment questions, and scenario descriptions are written at a reading accessibility standard appropriate for operational technical documentation. Minimum contrast ratio 4.5:1 for all text. No instructional content conveyed by color alone.

**Time-limited assessments:**
Extended time accommodation available as described under Examination Constraints. ADMIN grants the flag on the operator's account before the examination begins. The flag cannot be applied retroactively to a completed examination.

**Simulation interface:**
Training simulation is identical to the production workspace interface. All accessibility properties of the production workspace (keyboard navigation, screen reader labeling, contrast ratios, focus indicators) are inherited by the simulation. No additional accessibility layer is added or removed in the training context.

**Navigation:**
TC-LEFT module list and section headers are keyboard accessible. Tab/Shift-Tab for navigation. Enter/Space to expand sections. Arrow keys to navigate module list items.

**Timer displays:**
Time remaining is shown as a number (not only as a progress bar). Color changes are accompanied by text changes (e.g., "WARNING: < 2 minutes" label added when timer turns amber).

---

## Cognitive Load

**One step at a time:** module walkthroughs show one step per screen. Examination presents one question per screen. No scrolling required to see the current task.

**Explicit prerequisite statements:** before a trainee starts any module, the module entry screen states: "Completing this module satisfies the following certification requirement: [specific requirement name]." This is shown above the [Begin Module] button.

**Progress always visible:** certification progress checklist in TC-RIGHT is always visible during training. Trainee can see at any point what they have completed and what remains.

**No skip-ahead:** modules must be completed in order. Assessment cannot be attempted before walkthrough is complete (for walkthrough modules). Within an assessment, questions cannot be skipped — each must be answered or timed out before the next appears.

**Sandbox isolation is stated, not assumed:** every simulation screen carries the SIMULATION label and blue border. Trainees are never left to wonder whether their actions are affecting production.

---

*End of Training, Certification, and Simulation Workspace Specification v1*
