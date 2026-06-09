# ClubHub TV — Operational Frontend Runtime
# Shared Operational Intelligence Layer — Phase D: Operational Frontend Execution Architecture

**Document type:** Cross-agent architectural governance — frontend runtime execution principles
**Authority:** SHARED DECISION ZONE — Agent 1 (PRE/Runtime) + Agent 2 (Backend/Sync) + Agent 3 (UX/Rendering)
**Audience:** All frontend contributors; platform architects; all agent leads
**Last updated:** 2026-05-25
**Status:** CANONICAL — frontend runtime behavior not conforming to this document is not eligible for deployment
**Phase:** D — Operational Frontend Execution Architecture (cross-agent shared decision zone)

---

## Purpose

This document defines the operational frontend runtime — the execution model by which ClubHub TV's frontend processes incoming operational state, schedules rendering, propagates state changes, and maintains causal integrity across all concurrent activity.

The threat this document addresses: **runtime-introduced non-determinism.** Phase B established that the PRE is deterministic and that the frontend must render PRE truth without interpretation. Phase D addresses a subtler problem: even a frontend that renders correctly in isolation can produce non-deterministic operator experiences when execution timing is uncontrolled.

**Concrete examples of runtime non-determinism:**
- Two state updates arrive within milliseconds of each other. The frontend renders the first, then the second — but due to batching, renders them in reverse order. The operator sees a state sequence that contradicts the operational timeline.
- An operator initiates an action. A remote update arrives. Both are processed concurrently. The rendering shows a brief flash of the remote update's state, then the operator's pending state, then the confirmed combined state — creating a visual sequence the operator must interpret.
- A replay scrub and a live update arrive in the same rendering frame. The frontend applies both, producing a momentary blend of historical and live state.

None of these requires a bug. All emerge from uncontrolled runtime execution. This document eliminates them through constitutional runtime governance.

**The governing principle: operational rendering determinism.** The sequence of states displayed to the operator must match the causal sequence of operational events — not the arbitrary sequence of network arrival, render queue priority, or JavaScript event loop timing.

---

## Section 1 — Frontend Runtime Philosophy

### 1.1 Operational Runtime vs. Consumer SPA

A consumer single-page application runtime is optimized for: responsiveness, perceived speed, smooth animations, low latency between user action and visual feedback. These are the right priorities for a consumer product.

An operational runtime for ClubHub TV has different priorities:
1. **Causal correctness** — the sequence of displayed states must match the causal sequence of operational events
2. **Synchronization honesty** — the displayed state must accurately represent what is known, including uncertainty
3. **Replay integrity** — live and replay execution must be structurally isolated and never contaminate each other
4. **Graceful degradation** — under failure conditions, the runtime must degrade honestly, not silently

**Where these priorities conflict with consumer SPA priorities:**
- Responsiveness vs. causal correctness: an optimistic update that feels responsive but shows unconfirmed state violates causal correctness
- Smooth animation vs. synchronization honesty: a smooth transition that hides a state uncertainty violates synchronization honesty
- Low latency vs. ordering guarantees: rendering state updates immediately as they arrive, without sequencing, can violate causal ordering

**In every conflict, operational priorities win.** The frontend may feel slightly less responsive than a consumer SPA as a direct result of this governance. This is not a bug — it is the cost of operational integrity.

### 1.2 PRE-Aligned Execution

PRE-aligned execution means that the frontend's rendering cycle is governed by PRE output timestamps, not by network arrival timestamps or rendering engine timing.

**What PRE-aligned execution requires:**
- State updates are applied to the render model in the order of their PRE operational clock timestamps, not the order they arrived at the frontend
- When two updates have the same timestamp, they are applied atomically — the operator never sees an intermediate state where one update is applied but not the other
- The render model does not advance beyond the latest confirmed PRE output timestamp — it does not extrapolate, predict, or project forward

**Implementation implication (Agent 1 and Agent 2):** Every state event delivered to the frontend must carry a PRE operational clock timestamp. The frontend's state processing layer uses these timestamps to order events before application, regardless of network arrival order.

### 1.3 Rendering Determinism Principles

**Principle RD-01: Same inputs, same render.** Given the same set of confirmed PRE outputs for a specific scope and time range, the frontend must produce the same rendered output every time. There must be no render non-determinism from animation state, timing, or uncontrolled asynchrony.

**Principle RD-02: No invisible transitions.** Every change in displayed state must be traceable to a specific incoming event. There are no "spontaneous" state changes — every change has a cause that is accessible to the operator.

**Principle RD-03: Causal ordering preservation.** The rendered sequence of states must preserve the causal ordering of the underlying events. An event at time T must always appear before an event at time T+1 in the rendered output.

**Principle RD-04: Atomic compound updates.** When a single operational event produces changes to multiple panels or components simultaneously, all changes must be rendered in the same render frame — not spread across multiple frames where the operator could see a partially-updated state.

### 1.4 Operational Timing Integrity

The frontend must not introduce timing artifacts that distort the operator's perception of operational time. Specifically:

- Animation durations must not make events appear to occur at different times than they actually did
- Loading delays must not make one piece of data appear newer or older than another piece of data that arrived at the same time
- Batching windows must not cause events to appear to clump together temporally when they were spread over time

**Timing integrity rule:** If two events occurred 3 minutes apart in operational time, the operator should perceive them as occurring 3 minutes apart — not as occurring simultaneously (because they arrived in the same batch), not as occurring seconds apart (because the second was buffered while the first rendered).

---

## Section 2 — Authoritative Runtime Boundaries

### 2.1 PRE Authority in the Runtime

Within the frontend runtime, the PRE's computed output is the highest authority. No runtime process may modify, supplement, or reorder PRE output before it is rendered.

**PRE authority in the runtime means:**
- The state processing layer applies PRE outputs exactly as received — no normalization, no enrichment, no client-side computation of PRE-domain values
- If a PRE output appears to conflict with a prior PRE output (e.g., a correction arriving out of order), the conflict is surfaced to the operator, not resolved silently by the runtime
- The render model for any scope is always the latest confirmed PRE output for that scope — not a locally-merged view that combines PRE outputs with client-derived state

### 2.2 Backend Authority in the Runtime

The backend state delivery layer (Agent 2) is authoritative for: event delivery, event ordering guarantees, synchronization state, and attribution metadata.

**Backend authority in the runtime means:**
- The frontend trusts the backend's sequence numbers for ordering — it does not reorder events based on its own timestamp analysis
- The frontend treats backend-confirmed synchronization state as authoritative — it does not infer synchronization from data content
- When the backend reports a conflict or correction, the frontend surfaces this to the operator, not resolves it unilaterally

### 2.3 Frontend Rendering Authority

The frontend is authoritative only for display-layer execution: how state is visually represented, how transitions are animated (within constitutional constraints), how information density is applied, and how operator interaction state is managed.

**Frontend rendering authority does NOT extend to:**
- Deciding which PRE output to display when multiple are available
- Determining the operational significance of a state change
- Modifying the causal attribution of an event
- Computing or inferring any PRE-domain value

### 2.4 Temporary Client State Legality

Client state that exists only to support rendering (scroll position, panel expansion state, filter selections) is legitimately local and may be maintained independently of backend state. This state must satisfy:

- It represents only display-layer attributes — not operational facts
- It does not influence what operational data is displayed (only how it is presented)
- It is clearly separated in the frontend architecture from authoritative state
- It does not persist across sessions (or if it does, it is clearly labeled as a display preference, not an operational record)

---

## Section 3 — Runtime Execution Model

### 3.1 Event Ingestion Model

Events arrive at the frontend from multiple sources (PRE push, polling, delivery log updates, advisory system). The event ingestion model defines how these events enter the runtime and are processed.

**Event ingestion pipeline:**
```
Network arrival
    ↓ [deduplication: reject events already processed by sequence_number]
Event queue (ordered by PRE operational clock timestamp)
    ↓ [ordering: PRE timestamp, not arrival timestamp]
Conflict detection layer
    ↓ [detect: same scope, overlapping timestamp, different state]
State processing layer
    ↓ [apply: updates to render model, in PRE timestamp order]
Render scheduler
    ↓ [schedule: next render frame, atomic compound updates]
Render output → operator display
```

**Deduplication:** Events carry a globally unique `event_id`. The ingestion layer maintains a rolling deduplication window (configurable, default: last 1000 events). Duplicate events are silently dropped before entering the queue.

**Ordering:** Events for the same scope are applied in PRE operational clock timestamp order. If event B arrives before event A (same scope, A has earlier timestamp), the ordering layer holds B until A is processed, then processes both in correct order. A maximum hold time prevents indefinite buffering: if A does not arrive within the hold timeout, B is processed with a disclosure that it may have been preceded by an undelivered event.

### 3.2 Render Scheduling Discipline

Render scheduling determines when state changes are applied to the visual display.

**Render scheduling rules:**
- **Atomic compound updates:** State changes produced by a single event are applied in a single render frame. Partial renders (where one panel reflects the new state but another does not) are prohibited.
- **Priority ordering:** Escalation-tier updates (Tier 3+) are rendered in the next available frame, bypassing any batch window. Passive updates (Tier 0–2) are batched per the defined windows.
- **No render starvation:** The render scheduler must ensure that low-priority batched updates do not starve indefinitely due to continuous high-priority events. A maximum batching delay is enforced: no passive update may be held longer than 2× its batch window.
- **Replay rendering isolation:** Events in the live execution path do not enter the render scheduler during replay mode. Replay events from the replay execution path enter instead. The two paths are mutually exclusive at the render scheduler level.

### 3.3 State Propagation Ordering

When a state change affects multiple components simultaneously (a fleet-wide event that changes all venues' health grades, an emergency activation that affects all visible screens), the propagation order must be:

1. **Scope-specific components first:** The component for the directly affected scope updates before parent/aggregate components
2. **Causal order within siblings:** If component A's state change caused component B's state change, A updates before B
3. **Atomic within a frame:** All components affected by the same event update in the same render frame — never split across frames

**Anti-pattern to prevent:** An emergency activation arrives. The emergency banner renders in frame 1. The override stack updates in frame 2. The health grade updates in frame 3. The operator sees three sequential partial updates instead of one coherent simultaneous update. This is a propagation ordering failure.

### 3.4 Replay Execution Path

The replay execution path is structurally separate from the live execution path. They share rendering components but not state propagation.

**Replay execution path:**
```
Operator replay navigation (scrubber / timeline click)
    ↓ [temporal reference: selected PRE operational clock timestamp]
Replay corpus query (via Agent 1 replay API)
    ↓ [PRE evaluation: historical system state at timestamp → resolution output]
Replay state model (isolated from live state model)
    ↓ [no live events enter this path while replay is active]
Render scheduler (replay mode)
    ↓ [same render components as live path, replay-labeled]
Render output → operator display (with REPLAY badge, no live updates)
```

**Isolation requirement:** The replay state model and the live state model are completely isolated at runtime. There is no shared mutable state between them. A live event that arrives while replay is active is held in the live event queue and applied to the live state model — but it does not affect the replay state model or the replay render output.

### 3.5 Live Execution Path

```
Backend event delivery (PRE push / polling)
    ↓ [event ingestion pipeline: dedup → order → conflict detection]
Live state model
    ↓ [PRE-aligned state: only confirmed PRE outputs]
Render scheduler (live mode)
    ↓ [priority-ordered, atomic compound updates]
Render output → operator display (with LIVE/STALE/DEGRADED badge)
```

**Live execution path isolation:** During replay mode, new live events continue to flow into the live state model but do not produce render output. The live state model is updated in the background so that when replay exits, the live display is immediately current without requiring a re-fetch.

---

## Section 4 — Runtime Failure Modes

### Failure Mode RF-01: Timing Race Visibility

**What it is:** Two events arrive in rapid succession. The frontend processes them concurrently. Due to a race condition in the state processing layer, the later event is applied before the earlier one. The operator sees a brief flash of the wrong state followed by the correct state — but cannot understand why the display changed twice.

**Prevention:** The event ordering layer (Section 3.1) processes events sequentially, not concurrently. No two events for the same scope are processed simultaneously. The event queue is strictly ordered.

---

### Failure Mode RF-02: Render-Order Divergence

**What it is:** State changes propagate to some components in one render frame and other components in the next, creating a brief period where the display is internally inconsistent — some panels show the pre-update state while others show the post-update state.

**Prevention:** Atomic compound updates (Section 3.2). All components affected by the same event render in the same frame. The render scheduler holds all component updates from the same event until all are ready, then renders them together.

---

### Failure Mode RF-03: Stale Execution Loops

**What it is:** The render scheduler enters a loop where it repeatedly re-renders state that has not changed — either because a render triggers a state update that triggers another render, or because a stale event re-enters the processing queue.

**Prevention:** The deduplication layer (Section 3.1) prevents re-processing of already-handled events. The render scheduler includes cycle detection: if the same component renders with the same state twice within one frame, the second render is suppressed with a cycle detection log entry.

---

### Failure Mode RF-04: Replay / Live Contamination

**What it is:** A live event "leaks" into the replay rendering path, or a replay state update affects the live state model. The operator sees live operational state appearing in what they believe is a historical replay view — or vice versa.

**Prevention:** Replay and live execution paths use completely isolated state models (Section 3.4). No shared mutable state. The replay execution path is activated by an explicit mode transition and deactivated by an explicit exit — not by implicit state changes.

---

### Failure Mode RF-05: Local-State Corruption

**What it is:** Client-side display state (filter selections, scroll positions) accidentally influences the authoritative state model — causing the displayed operational data to reflect a client-filtered view rather than the authoritative backend view.

**Prevention:** Strict architectural separation between display state and authoritative state (Section 2.4). The two state stores are never merged. Rendering reads from authoritative state and separately applies display state as a presentation layer — display state cannot mutate authoritative state.

---

## Section 5 — Human Factors

### 5.1 Trust Under Timing Instability

When the interface behaves inconsistently under timing variations — sometimes rendering quickly, sometimes displaying brief flashes, sometimes showing intermediate states — operators develop an imprecise model of what the display "means." They learn to wait for the display to "settle" before trusting it, introducing unnecessary hesitation into operational decision-making.

**Design implication:** The runtime must produce consistent behavior across timing variations. An operator should never need to wait for the display to settle — the display should be definitively current as soon as it renders, without any period of uncertainty about whether another update is still arriving.

### 5.2 Operator Interpretation of Lag

Operators interpret latency as information. A display that takes 3 seconds to reflect an action suggests to the operator that the action is complex, the system is under load, or something is wrong. If the latency is normal and expected, this interpretation is wrong and causes unnecessary cognitive load.

**Design implication:** Expected latency must be communicated (PENDING state with elapsed time) to prevent operators from interpreting normal latency as an error signal. Unexpected latency (above the normal processing time) must be disclosed: "Processing is taking longer than expected."

### 5.3 Concurrency Confusion

When multiple state changes occur simultaneously — a remote operator's action, a schedule transition, and an entropy threshold crossing all in the same second — operators may be unable to process all three changes and miss some of them.

**Design implication:** Simultaneous updates use the update type hierarchy (from LIVE-UPDATE-BEHAVIOR-SPEC.md) to prioritize rendering. The highest-priority update is visually dominant; lower-priority updates are available but not competing for attention. Operators should never have to parse three simultaneous visual signals of equal prominence.

### 5.4 Rendering Hesitation Perception

If the frontend batches updates and renders them with a 5-second delay, operators may perceive a 5-second lag between reality and display — even if the underlying data is accurate. This perceived lag erodes confidence in the display's currentness.

**Design implication:** The render scheduler's batching windows must be tuned to the operational context. During incidents, batching windows are reduced or eliminated for relevant signals. During normal operations, 5-second batching for passive updates is acceptable because operators are not expecting instantaneous passive updates.

---

## Related Documents

**EVENT-AND-STATE-ORCHESTRATION-v1.md** — The event classification and orchestration rules that populate the event ingestion pipeline defined in Section 3.1.

**RENDERING-LIFECYCLE-AND-CONCURRENCY-v1.md** — The concurrency governance and rendering lifecycle that the render scheduler (Section 3.2) implements.

**FAILSAFE-AND-DEGRADED-MODE-FRONTEND-v1.md** — What happens to the execution model when the runtime encounters degraded conditions.

**PRE-NATIVE-FRONTEND-ARCHITECTURE-v1.md** — The upstream architecture principles that this runtime implements. The state flow defined there is executed by the runtime defined here.

**STATE-SYNCHRONIZATION-AND-CONSISTENCY-v1.md** — The synchronization states that the runtime detects and surfaces.

---

*End of OPERATIONAL-FRONTEND-RUNTIME-v1.md v1.0*
*Authority: SHARED — Agent 1 (PRE/Runtime) + Agent 2 (Backend/Sync) + Agent 3 (UX/Rendering)*
*Event delivery ordering and sequence guarantees: Agent 1 and Agent 2 definition authority*
*Render scheduling and execution model: Agent 3 definition authority; Agent 1 and Agent 2 review*
*Changes to any section require consensus of all three agents.*
