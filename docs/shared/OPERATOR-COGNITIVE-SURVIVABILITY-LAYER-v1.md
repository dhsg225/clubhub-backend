# OPERATOR COGNITIVE SURVIVABILITY LAYER v1

**Era:** Operator Reality Integration
**Status:** CANONICAL
**Scope:** Cognitive load boundaries, stress-safe decision thresholds, minimum viable understanding, panic-mode guarantees, error tolerance zones

---

## 1. PURPOSE

A system that is architecturally correct but cognitively unnavigable is operationally unsafe. The deterministic PRE resolution engine, the constitutional state machines, and the perceptual governance layer are all meaningless if the operator — under stress, fatigue, or incomplete training — cannot extract correct meaning and act safely.

This document defines the human survival constraints on the system. These constraints are not accommodations for weakness. They are acknowledgment that operator cognitive capacity is finite, variable, and the final gate through which all system correctness must pass before it becomes operational reality.

**The system is only as safe as the least cognitively available operator who must act on it.**

---

## 2. OPERATOR ROLE TAXONOMY

Operators are not a monolithic user class. Different roles have different cognitive loads, different familiarity with system internals, and different consequences for error.

### 2.1 Role Definitions

**Venue Operator (Primary Role)**
Responsible for day-to-day schedule execution at a single venue. Interacts with the live player, schedule pane, and incident acknowledgment surfaces. Does not manage infrastructure, PRE configuration, or multi-venue coordination.

Cognitive profile: High domain knowledge of their venue. Limited knowledge of system internals. Maximum attention to venue operational flow. High stress during live events.

**Fleet Operator**
Responsible for monitoring multiple venues simultaneously. Operates in a read-heavy mode with infrequent intervention. Primary concern: anomaly detection across fleet, not per-venue content detail.

Cognitive profile: Broad attention across many streams. Shallow per-venue context at any moment. Stress concentrated during multi-venue simultaneous anomalies.

**Platform Administrator**
Responsible for system configuration, PRE governance, OTA updates, and system health. Does not normally manage live venue operations. Interacts with administrative surfaces.

Cognitive profile: Deep system knowledge. Lower time pressure (most actions are not live-event-critical). High consequence errors (configuration changes affect all venues).

**Incident Commander**
Activated during declared incidents. May be any of the above roles elevated to incident authority. Primary concern: blast radius containment, authority clarity, recovery sequencing.

Cognitive profile: Maximum stress. Time-compressed. Operating at or above working memory capacity. Must not be asked to process novel information while incident is active.

### 2.2 Role-Specific Cognitive Load Boundaries

| Role | Max Concurrent Information Streams | Max Simultaneous Decisions Expected | Cognitive Reserve for System Internals |
|---|---|---|---|
| Venue Operator | 1 venue × 3 panes | 1 at a time | Low — system must surface conclusions, not data |
| Fleet Operator | Up to 20 venues × 1 status each | 1 per venue, sequential | Medium — can process aggregated summaries |
| Platform Admin | 1 system view × full config | Sequential, not concurrent | High — expected to understand system behavior |
| Incident Commander | Active incident only + 1 venue | 1 per 30-second window minimum | Zero — incident surface must require no background knowledge |

**Law:** The system must not simultaneously present more information streams than the role's stated maximum. When the surface would exceed the boundary, lower-priority information is compressed or hidden — never the safety-critical information.

---

## 3. SAFE DECISION THRESHOLDS UNDER STRESS

Not all decisions carry the same consequences. The system must calibrate the resistance of any action to the consequence of that action being wrong.

### 3.1 Decision Consequence Classification

| Class | Description | Examples |
|---|---|---|
| **CLASS-A: Reversible** | Consequence can be corrected within 60 seconds with no external impact | Pane focus change, filter adjustment, scroll position |
| **CLASS-B: Recoverable** | Consequence affects visible output but can be corrected before next schedule event | Fallback content selection, replay initiation |
| **CLASS-C: Event-Impacting** | Consequence affects a live event in progress | Forced schedule override, playback suspension |
| **CLASS-D: Structural** | Consequence persists across multiple events or requires backend changes to reverse | OTA update deployment, PRE configuration change, session elevation |

### 3.2 Stress-Mode Decision Gate

When the system detects an active incident (any level) and an operator attempts a CLASS-C or CLASS-D action:

1. A confirmation surface appears with an explicit restatement of what the action will do — written in plain operational language, not system terminology
2. The operator must take a separate confirming action (not the same gesture/button)
3. The confirmation surface is displayed with no other competing information — the workspace is suppressed to minimize cognitive noise during the confirmation decision
4. A 3-second minimum dwell before confirmation is accepted — prevents accidental double-tap confirmation

This is not an inconvenience feature. It is a stress-mode decision gate. Under high stress, operators act before reading. The gate enforces reading.

### 3.3 Forbidden Confirmation Anti-Patterns

| Pattern | Why Dangerous |
|---|---|
| "Are you sure? Yes / No" dialog | Operators trained to click through confirmation dialogs; provides no additional cognitive processing |
| Confirmation checkbox ("I understand") | Same — muscle memory defeats the gate |
| Confirmation that uses system terminology ("Confirm OTA manifest transition?") | Requires prior knowledge; Incident Commander may not have it |
| Confirmation timeout that defaults to "confirm" | Defaults to highest-consequence action; catastrophic under distraction |
| Confirmation timeout that defaults to "cancel" | Better, but still removes operator agency — they must act, not wait |

**Required confirmation form:** "You are about to [plain-language description of action] affecting [specific scope]. This cannot be undone immediately. Tap [plain action verb] to continue."

---

## 4. MINIMUM VIABLE UNDERSTANDING PER OPERATOR TYPE

An operator does not need to understand the full system to operate safely. They need to understand the subset of the system they are responsible for, to the depth required to act correctly under stress.

### 4.1 Venue Operator Minimum Viable Understanding

A Venue Operator is safe to operate the system if they can correctly answer:
1. Is the system currently showing live or historical content?
2. Is the current content from the authoritative schedule or a fallback?
3. Is there an active incident I need to acknowledge?
4. What is the next scheduled item, and when does it start?
5. How do I pause playback if something is wrong?

**The system must present all five of these answers without requiring the operator to navigate, expand, or search.** They must be ambient — available in the operator's immediate visual field at all times.

A Venue Operator does NOT need to understand:
- PRE resolution mechanics
- Corpus packet structure
- State machine transition rules
- OTA update governance

If any of these concepts appear in the primary operational surface for a Venue Operator, the surface has violated cognitive load boundaries.

### 4.2 Fleet Operator Minimum Viable Understanding

A Fleet Operator is safe if they can correctly answer:
1. Which venues are currently nominal, degraded, or in incident?
2. Which venues require immediate action from me?
3. For any anomalous venue: is the issue at the venue, the network, or the platform?
4. What is the single most urgent thing I need to do right now?

The fleet view must compress all venue state into these four dimensions. A Fleet Operator looking at 20 venues must reach question 4's answer within the 2-second scanability window.

### 4.3 Incident Commander Minimum Viable Understanding

An Incident Commander (elevated from any role during an incident) requires a simplified surface that answers:
1. What is failing? (in plain language)
2. What is the current blast radius?
3. What authority do I have right now?
4. What is the single next action the system recommends?
5. Who else is currently active on the incident?

**Critical rule:** An Incident Commander must reach minimum viable understanding from a cold start within 90 seconds of being assigned. The system cannot assume they were watching the incident develop. Their surface must reconstruct the operational picture for them.

---

## 5. PANIC-MODE UI COMPREHENSION GUARANTEES

Under acute stress (confirmed by system signals: rapid sequential actions, repeated error acknowledgments, unresolved high-severity alerts), the visible surface must contract to a panic-mode profile.

### 5.1 Panic-Mode Signals

The system infers panic-mode conditions from:
- 3 or more operator error acknowledgments within 60 seconds
- Rapid sequential navigation (3+ pane changes within 10 seconds without settling)
- Incident at level 3 or above with no operator acknowledgment within 120 seconds
- Operator session at ELEVATED authority during a CRITICAL incident

The system does not label these explicitly to the operator — this would compound stress. Instead, the surface silently contracts.

### 5.2 Panic-Mode Surface Contract

When panic-mode conditions are detected:
- The surface reduces to the minimum viable understanding for the operator's role
- Non-critical panes are collapsed (not closed — operator can expand if needed)
- All ambient/reference information (L4/L5 typography) is hidden
- Only L1, L2, and critical L3 information remains fully visible
- Motion suppression activates (per MOTION-AND-TRANSITION-GOVERNANCE-v1.md Section 9)
- A single prominent "What do I do?" affordance is available — it opens the incident recovery surface with the recommended next action

### 5.3 Panic-Mode Must Not Hide Safety Information

The panic-mode contraction never hides:
- Active incident banners
- Severity escalation signals
- Session authority indicators
- LIVE vs REPLAY mode distinction
- Stale data warnings

These surfaces expand to fill the simplified view. Panic-mode is not a clean slate — it is an operational triage view.

### 5.4 Panic-Mode Exit

Panic-mode exits automatically when:
- Operator acknowledges the active incident
- Operator returns to a settled interaction pattern (no rapid actions for 30 seconds)
- System returns to nominal state

The exit is gradual — previously hidden information reappears over 2-3 interaction cycles, not all at once. Returning from panic-mode to full information density at once would create a second cognitive shock.

---

## 6. REDUCED-STATE INTERFACES FOR DEGRADED COGNITION

Fatigue, end-of-shift operation, and sustained multi-hour incident response all degrade operator cognition in predictable ways. The system must accommodate degraded cognition without requiring the operator to recognize or report their own degradation.

### 6.1 Degraded Cognition Patterns

| Pattern | Observable Signal | System Adaptation |
|---|---|---|
| **Attention narrowing** | Operator stops interacting with secondary panes | Secondary panes reduce to summary indicators |
| **Repetitive action loops** | Same action performed multiple times in succession | System surface highlights the last-performed action's result explicitly |
| **Long dwell without action** | Operator on same view for >5 minutes without interaction | Key action affordances pulse gently (Category C motion) to re-engage attention |
| **Missed acknowledgments** | Required operator acknowledgments not completed within threshold | Escalating reminder — first subtle, then prominent, then shell-level interrupt |

### 6.2 Long-Dwell Recovery Surface

When an operator has been inactive for >5 minutes, the system presents a lightweight "re-orient" surface on their next interaction:
- Current system state in minimum viable understanding format for their role
- Any unacknowledged events that occurred during their inactivity
- A single "Continue" action to dismiss and resume normal view

This prevents operators from returning from distraction and acting on a surface that has changed significantly without their awareness.

---

## 7. ERROR TOLERANCE ZONES

Not all misunderstandings are equally dangerous. The system must be designed so that common, predictable misunderstandings lead to safe outcomes.

### 7.1 Safe Misunderstanding Zone

These are misunderstandings the system is designed to tolerate — operators may hold these beliefs and still operate safely:

- Misunderstanding of PRE resolution internals (the system surfaces conclusions, not resolution mechanics)
- Confusion about corpus packet structure (operators never interact with raw packets)
- Uncertainty about which resolver tier produced a result (the system presents the result and its authority level; tier is reference information)
- Uncertainty about whether an OTA update has been applied (the system shows current version explicitly)

### 7.2 Dangerous Misunderstanding Zone

These misunderstandings lead to unsafe outcomes. The system must actively prevent them:

- Believing REPLAY content is live content (→ may issue unnecessary override actions)
- Believing STALE data is authoritative (→ may rely on incorrect schedule)
- Believing an incident has resolved when it hasn't (→ may fail to complete containment actions)
- Believing they have STANDARD authority when ELEVATED (→ may take unintended high-consequence actions)
- Believing a fallback is the authoritative schedule (→ may miss required content)

**For each dangerous misunderstanding: the system ensures it is impossible to maintain this belief while looking at the operational surface.** The visual signal contradicting the misunderstanding is always present, always visible, always unambiguous.

### 7.3 Ambiguity is a Design Defect

If an operator can reasonably misinterpret a surface element in a way that leads to a dangerous misunderstanding, that is a design defect. It is corrected by redesigning the element, not by adding operator training to work around it.

---

## 8. FORBIDDEN COGNITIVE OVERLOAD PATTERNS

| Pattern | Cognitive Failure Caused |
|---|---|
| Showing raw PRE resolution data to Venue Operators | Requires system internals knowledge; not role-appropriate |
| Multi-step confirmation dialogs during active incident | Depletes decision budget at exactly the wrong moment |
| Simultaneous presentation of both historical and live data without explicit mode framing | Creates live/replay confusion — the most dangerous misunderstanding |
| Error messages using system-internal terminology | Operator cannot act on error they cannot interpret |
| Status that requires inference across multiple panels to determine | Forces cognitive synthesis under conditions that reduce synthesis capacity |
| Defaults that expose maximum functionality to all roles | Minimum effective surface reduces load; maximum surface increases it |
| State-change animations that complete before operator can process the new state | Motion communicates change; if it completes before the operator looks, the change was unannounced |
| Single-button dismissal of multi-consequence alerts | Invites accidental acknowledgment of critical information |
| Help text that appears only on hover | Under stress, operators do not hover to discover affordances |
| "Smart" UI that guesses operator intent and acts | Removes operator agency at moments when agency is most needed |

---

*Document status: CANONICAL — Operator Reality Integration Era*
*Do not modify without constitutional governance review*
