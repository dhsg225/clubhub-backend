# MOTION AND TRANSITION GOVERNANCE v1

**Era:** Perceptual Governance
**Status:** CANONICAL
**Scope:** Animation meaning, legal motion categories, transition timing, incident suppression, replay motion behavior, anti-jitter perception

---

## 1. PURPOSE

Motion on an operational surface is not decoration. Motion carries meaning. An operator who sees movement looks at it — this is a perceptual reflex, not a choice. If that movement carries no operational meaning, the reflex was wasted. Worse: it created noise that desensitizes the operator to motion, which is the primary mechanism by which urgent signals attract attention.

**Every animation on a ClubHub TV operational surface must answer: what operational fact does this motion communicate?**

If it cannot answer, the animation is not permitted.

---

## 2. WHAT MOTION MEANS

In the ClubHub TV perceptual system, motion has three and only three legitimate operational meanings:

### Meaning 1: State Change
Something changed. The system transitioned from one state to another. Motion confirms the transition occurred and communicates its direction (escalation vs de-escalation).

### Meaning 2: Live / Active
Something is currently happening. Motion communicates continuity of operation. A spinning indicator means "a process is running." A pulsing live indicator means "this data is current."

### Meaning 3: Temporal Position
Where in time something is located. Motion communicates movement through a timeline — scrubbing through replay history, a schedule item approaching its start time.

**All motion must be classifiable as one of these three meanings. Motion that cannot be classified is forbidden.**

---

## 3. LEGAL ANIMATION CATEGORIES

### Category A: State Transition Animations

Used to communicate that a component has moved from one operational state to another.

**Properties:**
- Duration: 150ms–250ms
- Easing: decelerate-out (fast start, smooth stop) — communicates arrival at new state
- Direction: escalation transitions move upward or increase contrast; de-escalation moves downward or decreases contrast
- Interruption behavior: new transition cancels and replaces in-progress transition immediately (no queuing)

**Legal uses:**
- Severity level change on a status indicator
- Pane entering/exiting degraded rendering mode
- Incident banner appearing or resolving
- Operator session state change (e.g., elevation granted)
- PRE resolution state change (RESOLVED → STALE)

**Illegal uses:**
- Schedule item "entry animations" (schedule items appear because data arrived, not as entertainment)
- Hover states (interaction feedback, not state change)
- Any sponsor content entrance/exit

### Category B: Active Process Indicators

Used to communicate that an asynchronous operation is in progress.

**Properties:**
- Duration: continuous (loop)
- Easing: linear (no deceleration — the process hasn't ended)
- Speed: slow enough to register as "in progress" without creating visual urgency
- Maximum coverage: contained within the element representing the in-progress operation

**Legal uses:**
- PRE resolution in-flight (RESOLVING state)
- Corpus packet loading for replay
- Backend sync in progress
- Operator action awaiting backend confirmation

**Illegal uses:**
- Decorative loaders that persist after operation completes
- "Skeleton screen" animations that last beyond actual load time
- Background spinners during stable operational states

**Law:** Active process indicators are removed immediately when the operation completes. No fade-out delay. The absence of the indicator communicates completion.

### Category C: Live Presence Indicators

Used to communicate that a data source is currently live and streaming.

**Properties:**
- Duration: continuous (very slow pulse, 2000ms–4000ms cycle)
- Amplitude: minimal — a slight opacity or scale variation, not a dramatic pulse
- Easing: sine wave (smooth, non-urgent)
- Suppressed: immediately, when mode changes from LIVE to any other mode

**Legal uses:**
- Live mode badge pulse (communicating active data stream)
- Connectivity indicator in shell chrome (communicating active backend connection)

**Illegal uses:**
- Any content element pulsing for visual interest
- Replay mode pulsing (replay is not live; it must not communicate liveness)

### Category D: Temporal Position Motion

Used to communicate movement through time — replay scrubbing, schedule progression, countdown.

**Properties:**
- Directional: forward in time = left-to-right (or top-to-bottom in vertical layouts)
- Speed: proportional to represented time (1 second of real time ≠ 1 second of animation unless explicitly live)
- Interruption: immediate response to operator scrub input — no lag
- Position indicators: stable (do not animate unless explicitly being moved)

**Legal uses:**
- Replay timeline scrubbing
- Schedule item countdown (approaching start time)
- Historical corpus navigation

**Illegal uses:**
- Decorative time-based animations unrelated to represented time
- Countdowns as urgency decoration on non-time-critical elements

---

## 4. TRANSITION TIMING SEMANTICS

Timing is meaning. The speed of a transition communicates the urgency of the change.

### 4.1 Timing Tiers

| Tier | Duration | Semantic |
|---|---|---|
| **Immediate** | 0ms (no animation) | The system has instantaneously changed. Used for critical safety states. |
| **Fast** | 100ms–150ms | High-urgency state change. Operator attention required now. |
| **Standard** | 200ms–300ms | Normal operational state transition. Operator should notice. |
| **Relaxed** | 400ms–500ms | Low-urgency informational update. Background awareness. |
| **Temporal** | Operator-controlled | Duration determined by operator interaction speed (scrubbing). |

**Law:** Urgency dictates speed. CRITICAL severity transitions use IMMEDIATE or FAST. Advisory transitions use STANDARD. No CRITICAL-class event uses RELAXED timing.

**Law:** Timing tiers are not adjusted for aesthetic reasons. A CRITICAL alert does not use RELAXED timing to feel "less jarring."

### 4.2 The Immediacy Rule for Terminal Events

Transitions into TERMINAL, CRITICAL, or any level-3+ incident state use IMMEDIATE timing (0ms). These events require operator recognition without perceptual delay. Animation would add latency to recognition.

### 4.3 De-escalation Timing

When severity decreases (e.g., ALERT → WARNING → ADVISORY → NOMINAL), transitions use STANDARD or RELAXED timing. De-escalation need not create urgency.

---

## 5. INTERRUPTION MOTION RULES

### 5.1 Higher-Severity Interrupts Lower

If an animation is in progress and a higher-severity event occurs, the in-progress animation is cancelled immediately and the higher-severity transition begins with its appropriate timing tier.

**Example:** A STANDARD-timing PRE resolution update animation is 100ms in when an incident is declared. The incident banner appears immediately (IMMEDIATE timing), cancelling the update animation.

### 5.2 No Animation Queuing for Operational Events

Operational state transitions are never queued behind in-progress animations. If component A is animating and a state change requires it to immediately change, it changes immediately. The animation does not complete first.

**Forbidden:** "Wait for current animation to finish before applying new state."

### 5.3 Operator Action Interrupts System Animation

Any animation triggered by system events (backend updates, TTL expiry, etc.) is immediately interruptible by operator interaction. Operator input always takes priority over in-progress system-initiated motion.

---

## 6. REPLAY TIMELINE MOTION BEHAVIOR

### 6.1 Replay Is Not Live

No motion during replay communicates liveness. The live presence indicator (Category C) is suppressed during replay. If a live indicator accidentally remains active during replay, the operator may misinterpret historical content as current truth.

### 6.2 Replay Scrubbing Motion

During operator-controlled scrubbing:
- Motion is continuous and directly proportional to operator input (touch/drag/scroll)
- No easing on operator-driven scrub — the position follows the operator's hand exactly
- Position commits (operator releases control) apply a fast decelerate-out easing to signal position lock

### 6.3 Replay Playback Motion

During replay playback (not scrubbing):
- Content transitions occur at the original corpus timestamps
- Transition timing reflects the original operational timing, not aesthetic preference
- Frame rate must not introduce perceived time compression or expansion

### 6.4 Replay-to-Live Transition Motion

The transition from REPLAY to LIVE mode is a significant operational event. It uses:
- FAST timing (150ms) for the mode badge transition (operator needs fast visual confirmation of mode change)
- The replay border frame disappears with FAST timing
- The live indicator activates with its initial pulse
- Content transitions use STANDARD timing as the live PRE resolution populates

---

## 7. ANTI-JITTER PERCEPTION RULES

Jitter — unintended, rapid oscillation of position, opacity, or layout — destroys operator trust in the rendering surface.

### 7.1 Jitter Definition

Jitter occurs when a visual element changes its rendered state more than once within a single logical update cycle, or oscillates between two values without a committed state change.

### 7.2 Sources of Operational Jitter

| Source | Prevention |
|---|---|
| Rapid PRE resolution updates | Debounce resolution updates — minimum 500ms between visual state changes for the same element |
| Status polling with threshold oscillation | Apply hysteresis — require consecutive readings above/below threshold before visual change |
| Network latency variation causing content reflow | Stabilize container dimensions before content arrives (explicit height reservation) |
| State machine oscillation (LIVE → DEGRADED → LIVE in rapid succession) | Apply minimum dwell time: 2000ms minimum per state before transition |
| Sponsor content loading causing layout shift | Sponsor zones have fixed dimensions — content loads into reserved space |

### 7.3 The Minimum Dwell Rule

No operational state indicator may visually change more frequently than once per 2000ms, except:
- Operator-initiated changes (immediate)
- CRITICAL or TERMINAL severity events (immediate)
- Explicit temporal motion (replay scrubbing — operator controlled)

### 7.4 Layout Stability

No element may change its rendered position as a side effect of another element's state change, unless that position change is itself an intentional operational signal.

**Forbidden:** Content cards shifting position when a status indicator in the same pane changes severity. Layout stability is a constitutional requirement, not a performance optimization.

---

## 8. FORBIDDEN ANIMATION PATTERNS

The following patterns are constitutionally prohibited:

| Pattern | Operational Failure It Causes |
|---|---|
| Entrance animations on schedule items | Operator perceives content arrival as "events" rather than data updates; attention budget misallocated |
| Exit animations on resolved incidents | Incident resolution requires clear acknowledgment, not a fade suggesting it's drifting away |
| Easing on operator-scrubbed replay timeline | Adds lag between operator input and position response; breaks haptic trust |
| Pulsing on non-live elements | Trains operator to ignore pulses; live indicator loses signal value |
| Skeleton screen animations lasting longer than actual data load | Motion persists after operational need has ended |
| Celebratory animations on any event | No event on an operational surface warrants celebration animations |
| Parallax scrolling | Disassociates content from its operational position |
| Sponsor content animation that triggers Category A semantics | Sponsor transition appears as a system state change |
| Animation behind elevated-authority confirmation dialogs | Motion behind a critical decision surface creates distraction |
| Page-level transitions (full-screen sweeps, fades between major views) | Operator loses spatial memory of operational surface layout |
| Motion that accelerates toward the operator (zoom-in easing) | Perceptually aggressive; creates visual pressure inappropriate for operational context |
| Blinking on any element not at CRITICAL or TERMINAL severity | Blink is the highest-urgency motion signal; casual use destroys its value |

---

## 9. INCIDENT-MODE MOTION SUPPRESSION

During an active incident at level 3 or above:

### 9.1 Suppressed Motion

All Category A transition animations below FAST tier are suppressed — state changes render immediately.

All Category B active process indicators are reduced to minimal visual presence (small, muted spinner instead of prominent loading state).

All Category C live presence indicators are suppressed — the operator does not need a "live" pulse during active incident; they need clarity.

### 9.2 Remaining Motion

Category D temporal motion (replay scrubbing) remains if the operator initiates replay during incident review — operator-initiated and directly controlled.

CRITICAL and TERMINAL event transitions always use IMMEDIATE timing regardless of incident suppression state.

### 9.3 Rationale

During an incident, the operator's cognitive load is at maximum. Motion that served informational purposes during nominal operation becomes noise during crisis. Suppressing non-essential motion reduces the perceptual field to only the signals that matter: severity indicators, active incident information, and operator-controlled interactions.

---

## 10. MOTION BUDGET

The operational surface has a limited motion budget. When that budget is consumed, additional motion creates noise rather than signal.

### 10.1 Simultaneous Animation Limit

No more than 3 independently animating elements should exist on the visible surface at any time during nominal operation. During incident mode: no more than 1 (the incident indicator itself).

### 10.2 Budget Priority

When budget would be exceeded, lower-priority animations are suppressed:

```
Priority 1 (never suppressed):  TERMINAL / CRITICAL state transitions
Priority 2 (suppressed last):   ALERT state transitions
Priority 3:                     WARNING state transitions
Priority 4:                     Active process indicators for operator-initiated actions
Priority 5:                     Active process indicators for system operations
Priority 6 (suppressed first):  Live presence indicators, temporal position indicators
```

---

*Document status: CANONICAL — Perceptual Governance Era*
*Do not modify without constitutional governance review*
