# CONSTITUTIONAL VERIFICATION SCENARIO LIBRARY v1

**Era:** Execution Acceleration
**Status:** CANONICAL
**Scope:** 45 named verification scenarios covering replay divergence, multi-operator collision, incident escalation, stale-state propagation, live/replay confusion, sponsor conflict, network degradation, rendering instability, recovery, stress-mode, shift handoff, and fatigue conditions

---

## 1. PURPOSE

This library is the operational truth test corpus. Each scenario is a verifiable claim about the system's constitutional behavior. If the system fails any scenario, the failure is classified, escalated, and resolved before deployment.

Scenarios are organized by constitutional surface tested. Each scenario includes initial conditions, trigger sequence, expected behavior, forbidden behavior, tested surfaces, failure severity, and replay verification expectations.

---

## FORMAT REFERENCE

```
SCENARIO ID: [CATEGORY]-[NNN]
Name: [descriptive name]
Initial Conditions: [system state before trigger]
Trigger Sequence: [ordered events]
Expected Behavior: [what the system must do]
Forbidden Behavior: [what the system must never do]
Constitutional Surfaces Tested: [document references]
Failure Severity: CRITICAL | HIGH | MEDIUM | LOW
Replay Verification: [what corpus/replay must confirm]
```

---

## 2. REPLAY DIVERGENCE SCENARIOS

### SCENARIO REPLAY-001
**Name:** Corpus round-trip determinism — nominal live operation

**Initial Conditions:** System nominal; corpus packet `nominal-live-001` available; player in LIVE state.

**Trigger Sequence:**
1. Load corpus packet `nominal-live-001` into replay mode
2. Play to completion
3. Export rendering hash
4. Reset and repeat 10 times

**Expected Behavior:** Rendering hash is identical across all 10 runs. State machine final state is identical across all 10 runs.

**Forbidden Behavior:** Any run produces a different hash. Any run produces a different final state.

**Constitutional Surfaces Tested:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §12; FRONTEND-TESTING-AND-SIMULATION-HARNESS-v1 §3.1

**Failure Severity:** CRITICAL

**Replay Verification:** This scenario IS the replay verification. Hash must be consistent before it can be recorded in the corpus as the expected value.

---

### SCENARIO REPLAY-002
**Name:** GovernedClock freeze — no timestamp drift during replay

**Initial Conditions:** GovernedClock frozen at 2026-01-15 14:00:00 UTC. Corpus packet loaded.

**Trigger Sequence:**
1. Advance GovernedClock by 30 minutes via simulation control
2. Observe all component timestamp outputs

**Expected Behavior:** All component timestamps advance in sync with GovernedClock. No component shows a timestamp outside the governed range.

**Forbidden Behavior:** Any component uses wall clock. Any component timestamp is ahead of or behind GovernedClock by more than 0ms.

**Constitutional Surfaces Tested:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §11; DEVELOPER-EXECUTION-AND-INTEGRATION-GUIDE-v1 §7.1

**Failure Severity:** CRITICAL

**Replay Verification:** Corpus packet timestamps must match the GovernedClock values at the time of authoring. If they do not match, the packet was authored with wall clock — a corpus integrity failure.

---

### SCENARIO REPLAY-003
**Name:** Replay-to-live transition — no live state contamination from replay context

**Initial Conditions:** Player in REPLAY state with corpus packet `nominal-replay-003` loaded.

**Trigger Sequence:**
1. Complete replay playback
2. Operator exits replay
3. Player transitions through SYNCING to LIVE
4. Live PRE resolution confirmed

**Expected Behavior:** All replay context (packetId, replayTimestamp, historical explanation) is cleared from all component state. Live content renders with fresh PRE resolution and no historical carry-over.

**Forbidden Behavior:** Any component in the LIVE state carries a replayContext field. Explanation zone shows historical explanation after live mode confirmed. Any stale replay data influences live rendering.

**Constitutional Surfaces Tested:** COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1 §5; FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §2.1

**Failure Severity:** CRITICAL

**Replay Verification:** After live state confirmed, a new corpus packet must be started — the prior replay context must not appear in any subsequent corpus snapshot.

---

### SCENARIO REPLAY-004
**Name:** Corpus packet integrity failure — replay must abort, not continue with corrupted data

**Initial Conditions:** Corpus packet with intentionally corrupted determinism hash.

**Trigger Sequence:**
1. Load corrupted corpus packet
2. Verify integrity check runs
3. Observe system response

**Expected Behavior:** Replay state machine transitions to FAILED. Error surface appears. Operator presented with "Replay unavailable — integrity check failed" message and explicit action to return to live.

**Forbidden Behavior:** Corrupted packet plays back as if valid. Integrity check is skipped. System silently returns to live without surfacing the failure. Operator left with no awareness of the failure.

**Constitutional Surfaces Tested:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §2.5; FRONTEND-TESTING-AND-SIMULATION-HARNESS-v1 §3.1

**Failure Severity:** CRITICAL

**Replay Verification:** A corpus record of this scenario must capture the FAILED state transition — confirming that corruption detection is observable and forensically auditable.

---

### SCENARIO REPLAY-005
**Name:** Historical explanation parity — replay explanation matches corpus, not live engine

**Initial Conditions:** Corpus packet with known explanation payload. Live explanation engine running.

**Trigger Sequence:**
1. Enter replay mode with corpus packet
2. Navigate to explanation zone
3. Compare rendered explanation to corpus packet's explanationPayload
4. Compare rendered explanation to what the live explanation engine would produce for the same item

**Expected Behavior:** Rendered explanation matches corpus packet exactly (same determinism hash). Live explanation engine output may differ — that difference is expected and correct.

**Forbidden Behavior:** Explanation zone shows live engine output during replay. Any field of the displayed explanation differs from the corpus packet's stored explanation.

**Constitutional Surfaces Tested:** COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1 §4.2; OPERATIONAL-VISUAL-SEMANTICS-v1 §4

**Failure Severity:** HIGH

**Replay Verification:** Explanation payload hash stored in corpus must match rendering output hash.

---

## 3. MULTI-OPERATOR COLLISION SCENARIOS

### SCENARIO MULTI-001
**Name:** Concurrent replay initiation — two operators, single serialized outcome

**Initial Conditions:** Two authenticated operators in STANDARD authority. Player in LIVE state.

**Trigger Sequence:**
1. Operator A and Operator B simultaneously submit replay initiation for different corpus packets
2. Observe which replay is initiated
3. Observe notification to the rejected operator

**Expected Behavior:** Exactly one replay is initiated. The other operator receives an explicit rejection notification. Rejection notification names the operator whose action was accepted. Player is in REPLAY state for exactly one packet.

**Forbidden Behavior:** Both replays are queued. Both replays fail silently. Rejected operator receives no feedback. System enters an undefined state from collision.

**Constitutional Surfaces Tested:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §4.1 (mutation serialization); OPERATOR-COGNITIVE-SURVIVABILITY-LAYER-v1 §3.2

**Failure Severity:** HIGH

**Replay Verification:** Corpus must record exactly one REPLAY initiation event with one operator's authority metadata.

---

### SCENARIO MULTI-002
**Name:** Authority conflict — standard operator action blocked by elevated Incident Commander

**Initial Conditions:** Operator A holds STANDARD authority. Operator B has been elevated to INCIDENT_COMMANDER during a declared incident.

**Trigger Sequence:**
1. Operator A attempts to initiate replay during active incident
2. Observe system response

**Expected Behavior:** Action is rejected. Operator A receives explicit notification: "Action prevented — [Operator B name] (Incident Commander) has restricted replay during active incident." No replay is initiated.

**Forbidden Behavior:** Replay initiates despite incident and authority restriction. Silent rejection with no operator notification. Operator A retries without understanding why it failed.

**Constitutional Surfaces Tested:** INCIDENT-REALITY-INTEGRATION-SYSTEM-v1 §5.2; FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §6

**Failure Severity:** CRITICAL

**Replay Verification:** Rejection event must appear in corpus with full authority metadata.

---

### SCENARIO MULTI-003
**Name:** Concurrent session elevation — only one operator can hold elevated authority simultaneously

**Initial Conditions:** Two operators in STANDARD authority. No active incident.

**Trigger Sequence:**
1. Both operators simultaneously request elevation
2. Observe which operator receives elevation
3. Observe state for both operators

**Expected Behavior:** Exactly one operator reaches ELEVATED state. The other receives a "elevation unavailable — another operator currently elevated" notification. ELEVATED state is held by exactly one operator at all times.

**Forbidden Behavior:** Both operators simultaneously in ELEVATED state. Neither operator receives feedback. Elevation silently fails with no notification.

**Constitutional Surfaces Tested:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §2.2; OPERATOR-COGNITIVE-SURVIVABILITY-LAYER-v1 §2.2

**Failure Severity:** HIGH

**Replay Verification:** Session authority state history shows exactly one ELEVATED state per time window.

---

### SCENARIO MULTI-004
**Name:** Shift handoff — outgoing operator session expiry during live event

**Initial Conditions:** Operator session within SESSION_EXPIRING threshold. Live event in progress.

**Trigger Sequence:**
1. Session expiry warning appears
2. Outgoing operator does not refresh session within warning window
3. Session expires (transitions to EXPIRED)

**Expected Behavior:** Session expiry banner appears at SESSION_EXPIRING state. Upon expiry: write-access controls lock. Read-only mode activates. Player continues in LIVE state — session expiry does not disrupt playback. Incoming operator can authenticate and take over.

**Forbidden Behavior:** Session expiry stops playback. Expired operator is unexpectedly logged out mid-action. Read access is removed along with write access. No visual indication of session state.

**Constitutional Surfaces Tested:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §2.2; TRAINING-AND-OPERATIONAL-CERTIFICATION-UX-v1 §8.2

**Failure Severity:** HIGH

**Replay Verification:** Session state machine transitions must be fully captured in corpus.

---

### SCENARIO MULTI-005
**Name:** Post-incident multi-operator review — concurrent replay of same incident corpus

**Initial Conditions:** Incident resolved. Three operators simultaneously enter post-incident review, each loading the same corpus packet.

**Trigger Sequence:**
1. Three operators load the same corpus packet for review
2. Each enters replay mode independently
3. One operator exits replay mid-review

**Expected Behavior:** Each operator's replay session is independent. No operator's replay state affects another's. The operator who exits returns to live — the other two continue their independent replay sessions.

**Forbidden Behavior:** One operator's replay exit terminates others' replay sessions. State contamination between review sessions. Any operator's live state is affected by another's replay.

**Constitutional Surfaces Tested:** COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1 §5.3; FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §4.2

**Failure Severity:** MEDIUM

**Replay Verification:** Three independent corpus replay traces are recorded, showing no state cross-contamination.

---

## 4. INCIDENT ESCALATION SCENARIOS

### SCENARIO INC-001
**Name:** Incident declaration to operator surface — 500ms maximum latency

**Initial Conditions:** Player in LIVE state, nominal operation.

**Trigger Sequence:**
1. Backend emits incident declaration event at T=0
2. Observe time until incident banner is visible in shell chrome

**Expected Behavior:** Incident banner visible within 500ms of backend event. Banner shows severity level, plain-language description, and single primary action.

**Forbidden Behavior:** Banner appears after 500ms. Banner appears but is incomplete (no action). Banner is dismissable before operator acknowledges. Banner does not interrupt current operator focus.

**Constitutional Surfaces Tested:** INCIDENT-REALITY-INTEGRATION-SYSTEM-v1 §2.2; OPERATOR-COGNITIVE-SURVIVABILITY-LAYER-v1 §5.3

**Failure Severity:** CRITICAL

**Replay Verification:** Corpus records incident declaration event and banner appearance event with timestamps. Delta must be ≤500ms.

---

### SCENARIO INC-002
**Name:** Full escalation path — WATCHING through TERMINAL

**Initial Conditions:** Nominal operation.

**Trigger Sequence:**
1. Inject WATCHING condition (threshold breach)
2. Allow auto-escalation to DECLARED
3. Inject CONTAINED action
4. Inject RESOLVING action
5. Declare RESOLVED
6. Allow POST_INCIDENT window to complete

**Expected Behavior:** Each state produces the correct UI compression stage per INCIDENT-REALITY-INTEGRATION-SYSTEM-v1. Shell chrome reflects each transition within 500ms. Workspace compression correct at each stage. Post-incident review surface appears after resolution.

**Forbidden Behavior:** Any state transition is not reflected in the UI. UI compresses to wrong stage for the current state. Post-incident surface is skippable without acknowledgment.

**Constitutional Surfaces Tested:** INCIDENT-REALITY-INTEGRATION-SYSTEM-v1 §3; OPERATIONAL-VISUAL-SEMANTICS-v1 §3.3

**Failure Severity:** HIGH

**Replay Verification:** Full incident lifecycle must be corpus-reproducible.

---

### SCENARIO INC-003
**Name:** Replay blocked during active incident

**Initial Conditions:** DECLARED incident, Operator in STANDARD authority.

**Trigger Sequence:**
1. Operator attempts to initiate replay
2. Observe system response

**Expected Behavior:** Replay is blocked. Player remains in LIVE or INCIDENT state. Operator receives explicit plain-language message: "Replay unavailable during active incident."

**Forbidden Behavior:** Replay initiates during incident. Replay button is hidden without explanation. Player transitions to REPLAY state.

**Constitutional Surfaces Tested:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §6; INCIDENT-REALITY-INTEGRATION-SYSTEM-v1 §7

**Failure Severity:** CRITICAL

**Replay Verification:** Corpus shows transition attempt rejected with INCIDENT_ACTIVE reason.

---

### SCENARIO INC-004
**Name:** Single next action rule — Stage 3 incident surface

**Initial Conditions:** Incident at CONTAINED severity (Stage 3 compression active).

**Trigger Sequence:**
1. Observe incident surface at Stage 3
2. Count visible primary action buttons
3. Expand "Other options"
4. Count total available actions

**Expected Behavior:** Exactly one primary action button visible without expansion. "Other options" expansion is available. All actions available via expansion. Primary action is labeled with plain-action verb, not system terminology.

**Forbidden Behavior:** More than one primary action button at Stage 3. No "Other options" expansion available. Primary action button uses system terminology.

**Constitutional Surfaces Tested:** INCIDENT-REALITY-INTEGRATION-SYSTEM-v1 §4.2; OPERATOR-COGNITIVE-SURVIVABILITY-LAYER-v1 §3.1

**Failure Severity:** HIGH

**Replay Verification:** Incident surface composition is captured in rendering corpus.

---

## 5. STALE-STATE PROPAGATION SCENARIOS

### SCENARIO STALE-001
**Name:** PRE resolution exceeds TTL — STALE indicator appears immediately

**Initial Conditions:** PRE resolution in RESOLVED state.

**Trigger Sequence:**
1. Advance GovernedClock past the PRE resolution TTL threshold
2. Observe PRE state machine transition
3. Observe UI change

**Expected Behavior:** PRE state machine transitions from RESOLVED to STALE. PRE boundary immediately renders DegradedResolutionFallback. Content zone shows stale indicator with elapsed time. No content is presented as authoritative.

**Forbidden Behavior:** PRE boundary continues to pass STALE data to renderer. No visual change when resolution becomes stale. Elapsed time indicator is absent or wrong.

**Constitutional Surfaces Tested:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §2.3; COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1 §3.2

**Failure Severity:** CRITICAL

**Replay Verification:** State transition from RESOLVED to STALE is captured with exact timestamp.

---

### SCENARIO STALE-002
**Name:** Stale data never presented without stale marker — no silent stale

**Initial Conditions:** PRE resolution in STALE state. Backend unreachable.

**Trigger Sequence:**
1. Observe the content zone during STALE state
2. Verify every displayed data element is either from current resolution or explicitly marked stale

**Expected Behavior:** Every schedule item on the surface carries a stale marker. The stale marker includes elapsed time since last valid resolution. No item is presented with full visual authority.

**Forbidden Behavior:** Any item displayed without stale marker during STALE state. Stale marker is hidden for "clean" appearance. Elapsed time not displayed.

**Constitutional Surfaces Tested:** OPERATIONAL-VISUAL-SEMANTICS-v1 §5.2; OPERATOR-COGNITIVE-SURVIVABILITY-LAYER-v1 §7.2

**Failure Severity:** CRITICAL

**Replay Verification:** Rendering during STALE state must carry stale attestation metadata in corpus.

---

### SCENARIO STALE-003
**Name:** Stale recovery — re-resolution restores authoritative state

**Initial Conditions:** PRE resolution in STALE state. Backend recovers.

**Trigger Sequence:**
1. Backend comes back online
2. PRE state machine triggers re-resolution (STALE → RESOLVING → RESOLVED)
3. Observe content zone

**Expected Behavior:** Resolution spinner appears during RESOLVING. On RESOLVED: stale markers disappear. Content refreshes to authoritative resolution. Operator sees explicit "Resolved [time]" indicator.

**Forbidden Behavior:** Stale markers persist after new RESOLVED state. Content does not refresh after re-resolution. Operator has no visibility of re-resolution occurring.

**Constitutional Surfaces Tested:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §2.3; COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1 §3.1

**Failure Severity:** HIGH

**Replay Verification:** Full STALE → RESOLVING → RESOLVED cycle corpus-recorded.

---

## 6. LIVE/REPLAY CONFUSION SCENARIOS

### SCENARIO LRC-001
**Name:** LIVE mode indicator — always visible, never auto-hiding

**Initial Conditions:** Player in LIVE state.

**Trigger Sequence:**
1. Leave system idle for 10 minutes
2. Navigate through all workspace panes
3. Open and close the explainability zone

**Expected Behavior:** LIVE mode badge in shell chrome is visible at every point. It does not hide after inactivity. It does not reduce in size when other panes are open.

**Forbidden Behavior:** LIVE badge hides after inactivity. Badge is covered by another pane. Badge is not visible in the shell chrome during any pane state.

**Constitutional Surfaces Tested:** OPERATIONAL-VISUAL-SEMANTICS-v1 §4.1; COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1 §2.1

**Failure Severity:** CRITICAL

**Replay Verification:** LIVE badge must be present in all rendering corpus frames during LIVE state.

---

### SCENARIO LRC-002
**Name:** Replay mode — all four mandatory indicators simultaneously visible

**Initial Conditions:** Player transitions to REPLAY state with corpus packet loaded.

**Trigger Sequence:**
1. Enter replay mode
2. Verify all four mandatory LIVE/REPLAY indicators from OPERATIONAL-VISUAL-SEMANTICS-v1 §4.1

**Expected Behavior:** (1) REPLAY mode badge visible in shell chrome using `color.mode.replay`. (2) Corpus packet timestamp displayed prominently. (3) Replay border frame using `color.mode.replay` visible on replay pane. (4) Explainability zone header reads "Historical Decision" not "Current Decision."

**Forbidden Behavior:** Any of the four indicators absent. Badge present but timestamp absent. Frame absent. Explainability header unchanged from live mode.

**Constitutional Surfaces Tested:** OPERATIONAL-VISUAL-SEMANTICS-v1 §4.1; DESIGN-TOKEN-CONSTITUTION-v1 §3.2

**Failure Severity:** CRITICAL

**Replay Verification:** All four indicators must be verifiable in rendering corpus during REPLAY state.

---

### SCENARIO LRC-003
**Name:** Simultaneous live and replay panes — clear visual separation

**Initial Conditions:** Both LIVE pane and REPLAY pane visible simultaneously (comparison mode).

**Trigger Sequence:**
1. Activate comparison mode
2. Observe visual separation between panes

**Expected Behavior:** Each pane carries its full mode indicators. A visual separator at the pane boundary uses both `color.mode.live` and `color.mode.replay`. No content from one pane is styled with the other's mode token.

**Forbidden Behavior:** Boundary between panes is ambiguous. A viewer cannot immediately identify which pane is live and which is historical.

**Constitutional Surfaces Tested:** OPERATIONAL-VISUAL-SEMANTICS-v1 §4.3; COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1 §5.1

**Failure Severity:** CRITICAL

**Replay Verification:** Rendering corpus captures pane boundaries with token metadata.

---

### SCENARIO LRC-004
**Name:** Live presence pulse suppressed in replay mode

**Initial Conditions:** Player transitions from LIVE to REPLAY.

**Trigger Sequence:**
1. Observe live presence pulse (Category C motion) during LIVE
2. Transition to REPLAY
3. Observe motion state

**Expected Behavior:** Live presence pulse is active during LIVE. Pulse is suppressed immediately on REPLAY state entry. No element in the REPLAY pane pulses with the live presence animation.

**Forbidden Behavior:** Live presence pulse continues in replay mode. Pulse appears on the replay frame or replay badge.

**Constitutional Surfaces Tested:** MOTION-AND-TRANSITION-GOVERNANCE-v1 §3.3; OPERATIONAL-VISUAL-SEMANTICS-v1 §4.4

**Failure Severity:** HIGH

**Replay Verification:** Motion state captured in corpus; pulse present before REPLAY transition, absent after.

---

## 7. SPONSOR CONFLICT SCENARIOS

### SCENARIO SPONSOR-001
**Name:** Sponsor color does not conflict with severity spectrum

**Initial Conditions:** A sponsor with a brand color that is perceptually close to `color.status.warning`.

**Trigger Sequence:**
1. Load sponsor content with the near-warning brand color
2. Display both sponsor content zone and an active WARNING severity indicator simultaneously
3. Run perceptual distance check at expected viewing distance (2 meters)

**Expected Behavior:** The colorDistance check flags the conflict. Sponsor content is blocked from using the conflicting color in the zone. Operator cannot mistake sponsor color for WARNING severity.

**Forbidden Behavior:** Sponsor color appears alongside WARNING indicator without perceptual differentiation. System allows sponsor to use severity-spectrum colors.

**Constitutional Surfaces Tested:** OPERATIONAL-VISUAL-SEMANTICS-v1 §6.3; DESIGN-TOKEN-CONSTITUTION-v1 §7.2

**Failure Severity:** HIGH

**Replay Verification:** Token usage metadata captured in rendering corpus confirms sponsor content uses only `color.content.sponsored` tokens.

---

### SCENARIO SPONSOR-002
**Name:** Sponsor content expansion beyond designated zone — blocked

**Initial Conditions:** Sponsor content zone defined at fixed dimensions.

**Trigger Sequence:**
1. Load sponsor content with CSS that attempts to overflow the zone boundary
2. Observe rendered output

**Expected Behavior:** Sponsor content is clipped to its designated zone. No overflow. No sponsor content appears in operational surfaces.

**Forbidden Behavior:** Sponsor content renders in shell chrome. Sponsor content overlaps operational status indicators. Sponsor animation plays outside sponsor zone.

**Constitutional Surfaces Tested:** OPERATIONAL-VISUAL-SEMANTICS-v1 §6.1; COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1 §2.1

**Failure Severity:** HIGH

**Replay Verification:** Zone boundary enforcement captured in rendering corpus.

---

## 8. NETWORK DEGRADATION SCENARIOS

### SCENARIO NET-001
**Name:** Backend unreachable — DEGRADED state entered, not crash

**Initial Conditions:** Player in LIVE state.

**Trigger Sequence:**
1. Set network to BACKEND_UNREACHABLE
2. Advance GovernedClock past PRE resolution TTL
3. Observe state machine transitions

**Expected Behavior:** PRE transitions RESOLVED → STALE → (re-resolution fails) FAILED. Player transitions LIVE → DEGRADED. Connectivity indicator in shell chrome shows DEGRADED using `color.mode.degraded`. Stale content visible with explicit stale marker.

**Forbidden Behavior:** System crashes. Player transitions to TERMINAL without backend confirmation. Stale content presented as authoritative. Shell shows nominal status.

**Constitutional Surfaces Tested:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §2.1; OPERATIONAL-VISUAL-SEMANTICS-v1 §5.1

**Failure Severity:** CRITICAL

**Replay Verification:** Full degraded state entry captured in corpus with timestamps.

---

### SCENARIO NET-002
**Name:** 60-second offline period — graceful degradation, not progressive failure

**Initial Conditions:** Player in LIVE state.

**Trigger Sequence:**
1. Set BACKEND_UNREACHABLE
2. Advance GovernedClock 60 seconds in 10-second increments
3. Observe system state at each increment

**Expected Behavior:** System enters DEGRADED. Stale indicators show elapsed time correctly. System does not progressively accumulate error states or crash. At 60 seconds, the operator surface is still navigable, still shows stale content with markers, still shows shell chrome fully.

**Forbidden Behavior:** Memory leak causes progressive render slowdown. Error state accumulates with each re-resolution failure. Shell chrome becomes unavailable.

**Constitutional Surfaces Tested:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §2.1; OPERATOR-COGNITIVE-SURVIVABILITY-LAYER-v1 §6.1

**Failure Severity:** HIGH

**Replay Verification:** 60-second degraded corpus shows stable state, not progressive degradation.

---

### SCENARIO NET-003
**Name:** Intermittent connectivity — no LIVE/DEGRADED oscillation jitter

**Initial Conditions:** Player in LIVE state. Network set to INTERMITTENT (30% packet loss).

**Trigger Sequence:**
1. Run system for 5 minutes with intermittent connectivity
2. Count LIVE→DEGRADED and DEGRADED→LIVE transitions
3. Verify minimum dwell time rule

**Expected Behavior:** State machine does not oscillate rapidly between LIVE and DEGRADED. Minimum 2000ms dwell per state per MOTION-AND-TRANSITION-GOVERNANCE-v1 §7.3. Operator sees at most a few state changes, not a flickering indicator.

**Forbidden Behavior:** Rapid LIVE/DEGRADED oscillation visible to operator. Connectivity jitter directly maps to state jitter. Operator cannot read the status indicator due to frequent changes.

**Constitutional Surfaces Tested:** MOTION-AND-TRANSITION-GOVERNANCE-v1 §7.3; FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §4.3

**Failure Severity:** HIGH

**Replay Verification:** State transition timestamps show minimum 2000ms between consecutive LIVE↔DEGRADED transitions.

---

## 9. RENDERING INSTABILITY SCENARIOS

### SCENARIO REND-001
**Name:** Unrelated state change does not re-render content cards

**Initial Conditions:** Schedule pane showing 10 schedule items. Session in SESSION_EXPIRING state.

**Trigger Sequence:**
1. Record render count for each ScheduleItemCard
2. Inject SESSION_EXPIRING event
3. Observe re-renders

**Expected Behavior:** Shell chrome updates with session expiry indicator. ScheduleItemCard render counts unchanged — no card re-rendered due to session state change.

**Forbidden Behavior:** Any ScheduleItemCard re-renders in response to session state change.

**Constitutional Surfaces Tested:** FRONTEND-TESTING-AND-SIMULATION-HARNESS-v1 §5.2; COMPONENT-ASSEMBLY-AND-BOUNDARY-GOVERNANCE-v1 §9.2

**Failure Severity:** HIGH

**Replay Verification:** Render records show content cards stable during non-content state changes.

---

### SCENARIO REND-002
**Name:** Causal render order — shell updates before workspace on incident

**Initial Conditions:** Nominal live operation.

**Trigger Sequence:**
1. Inject incident declaration
2. Record render timestamps for IncidentBanner and LivePlayerPane

**Expected Behavior:** IncidentBanner renders before LivePlayerPane in the same update cycle. Shell always renders before workspace for incident-triggered updates.

**Forbidden Behavior:** Workspace renders before shell on incident declaration. IncidentBanner render timestamp is after LivePlayerPane render timestamp.

**Constitutional Surfaces Tested:** FRONTEND-TESTING-AND-SIMULATION-HARNESS-v1 §5.3; RENDERING-ORCHESTRATION-AND-VIEW-STABILITY-v1

**Failure Severity:** HIGH

**Replay Verification:** Render order captured in corpus render records.

---

### SCENARIO REND-003
**Name:** Anti-jitter — no layout shift from non-spatial state changes

**Initial Conditions:** Schedule pane with full schedule visible.

**Trigger Sequence:**
1. Inject PRE resolution update (content unchanged)
2. Observe layout of all schedule items

**Expected Behavior:** No schedule item changes position. No layout reflow. Items that did not change content are visually stable.

**Forbidden Behavior:** Any item shifts position due to unrelated item change. Column or row alignment shifts. Scroll position resets.

**Constitutional Surfaces Tested:** MOTION-AND-TRANSITION-GOVERNANCE-v1 §7.4; TYPOGRAPHY-AND-INFORMATION-LEGIBILITY-v1 §5.3

**Failure Severity:** HIGH

**Replay Verification:** Layout stability verifiable from rendering corpus spatial records.

---

## 10. RECOVERY AND RECONCILIATION SCENARIOS

### SCENARIO REC-001
**Name:** Backend reconnection — authoritative state restored without operator action

**Initial Conditions:** Player in DEGRADED state after backend unreachable.

**Trigger Sequence:**
1. Restore network connectivity
2. Observe PRE state machine transitions
3. Observe player state machine transitions

**Expected Behavior:** PRE transitions automatically FAILED → RESOLVING → RESOLVED. Player transitions DEGRADED → SYNCING → LIVE. Stale markers disappear. Connectivity indicator returns to nominal. Content refreshes to authoritative resolution.

**Forbidden Behavior:** Operator must manually trigger re-resolution. System stays in DEGRADED after connectivity restores. Stale markers persist after RESOLVED.

**Constitutional Surfaces Tested:** FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §2.1; INCIDENT-REALITY-INTEGRATION-SYSTEM-v1 §8

**Failure Severity:** HIGH

**Replay Verification:** Full recovery sequence in corpus with transition timestamps.

---

### SCENARIO REC-002
**Name:** Post-incident recovery — staged information re-expansion

**Initial Conditions:** Incident just resolved (POST_INCIDENT state).

**Trigger Sequence:**
1. Operator acknowledges resolution
2. Observe UI expansion over time

**Expected Behavior:** Information does not flood back immediately. UI expands in stages: first resolution confirmation summary, then state reconstruction view, then full surface. Full expansion does not occur until operator confirms re-orient.

**Forbidden Behavior:** Immediate full UI re-expansion after incident resolution. Operator receives no re-orient surface. Post-incident review surface is skippable without acknowledgment.

**Constitutional Surfaces Tested:** INCIDENT-REALITY-INTEGRATION-SYSTEM-v1 §8.1; OPERATOR-COGNITIVE-SURVIVABILITY-LAYER-v1 §5.4

**Failure Severity:** MEDIUM

**Replay Verification:** Post-incident expansion stages captured in corpus.

---

## 11. STRESS-MODE OPERATOR SCENARIOS

### SCENARIO STRESS-001
**Name:** Panic-mode activation — surface contracts on behavioral signals

**Initial Conditions:** Nominal operation. Operator receives 3 error acknowledgments within 60 seconds.

**Trigger Sequence:**
1. Inject 3 sequential error conditions requiring acknowledgment within 60 seconds
2. Observe UI surface after third acknowledgment

**Expected Behavior:** Surface contracts to panic-mode profile: non-critical panes collapse, ambient/reference information hidden, only L1/L2/critical-L3 information visible, "What do I do?" affordance appears.

**Forbidden Behavior:** Surface remains at full density after panic signals. Panic-mode hides safety information (incident banners, mode indicators, stale warnings). Surface floods back to full density immediately after one calm action.

**Constitutional Surfaces Tested:** OPERATOR-COGNITIVE-SURVIVABILITY-LAYER-v1 §5.1–5.3

**Failure Severity:** HIGH

**Replay Verification:** Panic-mode activation captured in operator behavior corpus.

---

### SCENARIO STRESS-002
**Name:** CLASS-D action during active incident — full confirmation gate

**Initial Conditions:** Active incident at DECLARED level. Operator in ELEVATED authority.

**Trigger Sequence:**
1. Operator initiates a CLASS-D (structural) action
2. Observe confirmation gate behavior

**Expected Behavior:** Confirmation gate appears. Workspace is suppressed to minimize cognitive noise. Plain-language restatement of action. Minimum 3-second dwell before confirmation can be accepted. Second distinct confirming gesture required.

**Forbidden Behavior:** "Are you sure?" dialog. Confirmation gate uses system terminology. Confirmation can be completed in under 3 seconds. Confirmation defaults on timeout.

**Constitutional Surfaces Tested:** OPERATOR-COGNITIVE-SURVIVABILITY-LAYER-v1 §3.2–3.3

**Failure Severity:** CRITICAL

**Replay Verification:** Confirmation gate interaction captured with timing metadata.

---

## 12. SHIFT HANDOFF SCENARIOS

### SCENARIO HAND-001
**Name:** Outgoing session expiry mid-event — incoming operator takes over

**Initial Conditions:** Live event in progress. Outgoing operator session in SESSION_EXPIRING.

**Trigger Sequence:**
1. Session expires (EXPIRED state)
2. New operator authenticates
3. New operator completes minimum viable understanding check

**Expected Behavior:** Playback continues through session transition. Outgoing operator retains read access. Incoming operator sees re-orient surface with current system state before resuming full operation.

**Forbidden Behavior:** Playback stops on session expiry. Incoming operator is dropped into full operation without re-orient. Re-orient surface is skippable.

**Constitutional Surfaces Tested:** TRAINING-AND-OPERATIONAL-CERTIFICATION-UX-v1 §8; FRONTEND-STATE-MACHINE-ARCHITECTURE-v1 §2.2

**Failure Severity:** HIGH

**Replay Verification:** Session transition captured; playback continuity verified in corpus.

---

### SCENARIO HAND-002
**Name:** Incident handoff — incoming Incident Commander cold start in 90 seconds

**Initial Conditions:** Active incident at RESOLVING. Incoming Incident Commander assigned cold.

**Trigger Sequence:**
1. New operator assigned Incident Commander role
2. Start 90-second timer
3. Operator must demonstrate minimum viable incident understanding

**Expected Behavior:** Incident surface reconstructs current incident state for the new commander within their first view. Minimum viable incident understanding (5 items) is available without navigation within 90 seconds of assignment.

**Forbidden Behavior:** New commander must navigate to find incident context. 90-second window passes without all 5 minimum understanding items being visible.

**Constitutional Surfaces Tested:** TRAINING-AND-OPERATIONAL-CERTIFICATION-UX-v1 §3.4; INCIDENT-REALITY-INTEGRATION-SYSTEM-v1 §2.3

**Failure Severity:** CRITICAL

**Replay Verification:** Cold-start context assembly timing captured in corpus.

---

## 13. LONG-DURATION FATIGUE SCENARIOS

### SCENARIO FAT-001
**Name:** 4-hour session — long-dwell re-orient surface triggers

**Initial Conditions:** Operator in continuous session for 4 hours.

**Trigger Sequence:**
1. Operator is inactive for 5 minutes
2. Operator resumes interaction

**Expected Behavior:** On resumption, system presents lightweight re-orient surface: current system state in minimum viable understanding format, any events that occurred during inactivity. Operator sees "Continue" to dismiss and resume normal view.

**Forbidden Behavior:** No re-orient after extended inactivity. Operator resumes on a surface that has changed significantly without awareness. Re-orient surface is disruptive (blocks work rather than informing).

**Constitutional Surfaces Tested:** OPERATOR-COGNITIVE-SURVIVABILITY-LAYER-v1 §6.2; TRAINING-AND-OPERATIONAL-CERTIFICATION-UX-v1 §8

**Failure Severity:** MEDIUM

**Replay Verification:** Inactivity period and re-orient trigger captured in operator behavior corpus.

---

### SCENARIO FAT-002
**Name:** Skill decay detection — repeated same-class action

**Initial Conditions:** Operator performing live event management for extended period.

**Trigger Sequence:**
1. Operator takes the same action type 4 times in 10 minutes
2. Observe decay signal generation
3. Verify supervisor notification

**Expected Behavior:** Decay signal generated with pattern name "REPETITIVE_ACTION_LOOP." Decay signal routed to supervisor review. No in-product interruption of the operator.

**Forbidden Behavior:** Decay signal interrupts the operator mid-task. No decay signal generated. Decay signal generates an automated consequence without supervisor review.

**Constitutional Surfaces Tested:** HUMAN-SYSTEM-FEEDBACK-LOOP-v1 §5; TRAINING-AND-OPERATIONAL-CERTIFICATION-UX-v1 §6

**Failure Severity:** LOW

**Replay Verification:** Decay signal event captured in operator behavior corpus with timestamp.

---

### SCENARIO FAT-003
**Name:** End-of-shift incident declaration — senior operator cognition check

**Initial Conditions:** Operator approaching end of certified shift. Incident declared.

**Trigger Sequence:**
1. Incident declared at end-of-shift condition
2. Operator acknowledges incident
3. Operator actions during first 5 minutes of incident response observed

**Expected Behavior:** System surfaces recommended cognitive reset indicator: "Shift handoff recommended before incident response if possible." This is surfaced as a recommendation, not a restriction. If operator continues, they receive the full incident surface with all cognitive support structures.

**Forbidden Behavior:** System prevents end-of-shift operator from responding to incident. Recommendation is shown during the 30-second initial triage window (must wait until after initial triage period). Recommendation is disruptive.

**Constitutional Surfaces Tested:** OPERATOR-COGNITIVE-SURVIVABILITY-LAYER-v1 §6.1; INCIDENT-REALITY-INTEGRATION-SYSTEM-v1 §8.3

**Failure Severity:** LOW

**Replay Verification:** Recommendation surface timing captured; must not appear in first 30 seconds of incident.

---

## 14. ADDITIONAL SCENARIOS (RAPID REFERENCE)

| ID | Name | Severity |
|---|---|---|
| REPLAY-006 | Explanation completeness — every schedule item has explanation | HIGH |
| REPLAY-007 | State machine replayFromHistory() new state path added | HIGH |
| MULTI-006 | Three-operator concurrent incident response — no authority deadlock | HIGH |
| INC-005 | Motion suppression at Stage 3+ incident | HIGH |
| INC-006 | Incident contradiction surface — conflicting backend and content signals | HIGH |
| STALE-004 | Fleet operator stale venue detection — at least one venue flagged in 30s | HIGH |
| STALE-005 | Stale state during active replay — clock freeze prevents stale in replay-bound | MEDIUM |
| LRC-005 | Replay mode indicator survives pane navigation | CRITICAL |
| LRC-006 | Live mode — no historical timestamp visible | HIGH |
| SPONSOR-003 | Sponsor animation does not trigger Category A motion semantics | HIGH |
| SPONSOR-004 | Sponsor zone fixed dimensions — no reflow | MEDIUM |
| NET-004 | Partial manifest — fallback content visually distinct from authoritative | HIGH |
| NET-005 | Recovery from TERMINAL state — operator restart required | HIGH |
| REND-004 | Typography hierarchy preserved at 200% zoom | MEDIUM |
| REND-005 | Fleet-wall minimum text size at 3-meter viewing distance | HIGH |
| REC-003 | Architectural debt expiry — surface partial freeze activates | MEDIUM |
| STRESS-003 | Minimum viable understanding — new operator 2-second scanability test | HIGH |
| STRESS-004 | Confirmation gate — plain language verification | HIGH |
| HAND-003 | Post-incident documentation not blocking operational resume | MEDIUM |
| FAT-004 | Confusion event — "Rapid Undo" pattern captured | LOW |
| FAT-005 | Confusion event — "Mode Check Loop" triggers investigation threshold | MEDIUM |

---

*Document status: CANONICAL — Execution Acceleration Era*
*Traces to: All constitutional documents — this library is the executable expression of constitutional compliance*
