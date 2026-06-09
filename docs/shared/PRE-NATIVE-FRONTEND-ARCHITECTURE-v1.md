# ClubHub TV — PRE-Native Frontend Architecture
# Shared Operational Intelligence Layer — Phase B: PRE-Native Frontend Architecture

**Document type:** Cross-agent architectural governance — PRE-to-frontend truth transport
**Authority:** SHARED DECISION ZONE — Agent 1 (PRE/Runtime) + Agent 2 (Backend/Sync) + Agent 3 (UX/Rendering)
**Audience:** All frontend contributors; all agent leads; platform architects
**Last updated:** 2026-05-25
**Status:** CANONICAL — no frontend architecture decision may contradict this document
**Phase:** B — PRE-Native Frontend Architecture (cross-agent shared decision zone)
**Governance:** docs/shared/CROSS-AGENT-GOVERNANCE.md — changes require all three agent leads

---

## Purpose

This document defines the ClubHub TV frontend as a PRE-native system — a rendering surface that presents the PRE's deterministic operational truth without interpretation, reinterpretation, or client-side inference.

The threat this document addresses: **truth death at the rendering boundary.** The PRE may be perfectly deterministic. The replay harness may be exactly correct. The delivery log may be complete and accurate. Yet the frontend can still kill operational truth by:

- Displaying optimistically computed state before PRE confirmation arrives
- Caching PRE outputs and serving the cache after the live state has changed
- Reconstructing explanations from delivery logs rather than calling the PRE's reason trace API
- Applying client-side smoothing that hides transitions the operator needs to see
- Showing "loading" states that mask which parts of the display are current and which are stale
- Retrying failed actions silently and displaying success before confirmation

None of these requires malicious intent. Each is a "reasonable" frontend optimization that happens to create a gap between what the operator sees and what the PRE actually resolved. That gap — however small — is where operational trust is lost.

**The governing principle: the frontend is a truth renderer, not a truth interpreter.** Its role is to make PRE reality humanly visible. Its role is not to decide what PRE reality to show, how to smooth it, or when to hide it.

---

## Section 1 — Frontend Philosophy

### 1.1 Frontend as Truth Renderer

The frontend has one job: render PRE reality as it is, labeled as it is, at the time it is.

"Render" means:
- Show the PRE's resolved output as the effective state — not a computed approximation
- Show the resolution level and contributing sources as the PRE computed them — not a simplified summary
- Show the synchronization state as it actually is — not as it was two seconds ago

"As it is" means:
- Current PRE output, not a cached prior output
- Current synchronization state, not an assumed-current state
- Current confidence level, not a smoothed or averaged confidence

"Labeled as it is" means:
- LIVE means confirmed live — not "probably current"
- REPLAY means deterministic historical PRE output — not log-reconstructed approximation
- STALE means the frontend has not received confirmed current state within the staleness threshold

### 1.2 PRE Authority Primacy

The PRE is the sole authority on what a screen is showing and why. No frontend component may override, reinterpret, or contradict the PRE's resolution output.

**PRE authority is unconditional:**
- If the PRE says content X is playing on screen S at time T, the frontend renders content X on screen S at time T — regardless of any client-side cache, prior PRE output, or operator expectation
- If the PRE says an override at LEVEL_2 is the resolution winner, the frontend renders that — not a simplified "override active" summary that omits the level
- If the PRE cannot be reached (network failure, service unavailable), the frontend renders STALE state — not the last known PRE output presented as current

**What this means for implementation (Agent 1 and Agent 2):**
- The frontend must call the PRE (directly or via the backend state delivery layer) for every effective state it displays
- Caching of PRE output is permitted for performance, but cached output must be labeled with its freshness and must expire per the defined staleness thresholds
- The frontend must never compute effective state client-side — effective state is always PRE-computed

### 1.3 No Frontend Operational Reinterpretation

The frontend does not make operational judgments. It renders operational facts.

**Prohibited frontend behaviors:**
- Deciding that an override is "probably still active" and rendering it as active without confirmation
- Inferring that a screen is healthy because no alerts have arrived recently
- Displaying a sponsor delivery figure as confirmed when the delivery log has not yet been updated
- Rendering a pending action as completed before the PRE confirms it
- Smoothing health grade transitions (hiding a brief dip to grade C that the operator should see)

**Permitted frontend behaviors:**
- Labeling uncertainty: "Last confirmed: [timestamp] — current state may differ"
- Batching updates for rendering performance, provided the batch delay is within defined thresholds and disclosed
- Progressive disclosure of complex operational state (EH-1 before EH-3)
- Displaying the last confirmed PRE output while awaiting updated output, with AGING/STALE labeling

### 1.4 Causality Preservation

The frontend must preserve the causal relationships between operational events. It must not render consequences before causes, reorder events for visual convenience, or hide causal links that are operationally significant.

**Causality preservation requirements:**
- Events are displayed in the order they occurred, not in order of visual priority
- An override is shown as the cause before its effect (suppressed content) is shown as the effect
- A state change is attributed to its cause — not shown as a spontaneous change
- Resolution path information (from the PRE) is available at all times for any displayed effective state

---

## Section 2 — Authoritative State Flow

### 2.1 PRE → Backend → Frontend Truth Flow

Operational truth flows from a single source and propagates in one direction:

```
PRE resolution engine
    ↓ [resolution output: effective state + resolution path]
Backend state delivery layer (Agent 2)
    ↓ [typed state events: authored, timestamped, versioned]
Frontend rendering layer (Agent 3)
    ↓ [rendered to operator: labeled, attributed, synchronized]
Operator
```

**Each layer has a defined responsibility:**

**PRE (Agent 1):** Compute the effective state and its resolution path. Expose this via the state query API and the resolution path API. Guarantee determinism: same inputs → same output, always.

**Backend state delivery layer (Agent 2):** Receive PRE outputs and deliver them to frontend subscribers as typed, versioned state events. Maintain the event ordering guarantee (events arrive in the order they occurred). Do not filter, transform, or editorialize PRE outputs. Add attribution metadata (which PRE version computed this, at what time).

**Frontend rendering layer (Agent 3):** Receive typed state events, apply the rendering rules defined in Phase A and Phase C documents, and display the result to the operator with all required labels, state badges, and synchronization indicators.

### 2.2 Event Propagation Semantics

State events flowing from the backend to the frontend carry the following semantics:

**Event properties (required on every state event):**
- `event_type`: The canonical event type (override_applied, effective_state_changed, emergency_activated, etc.)
- `timestamp`: The PRE's operational clock timestamp for when this state change occurred — not the delivery timestamp
- `scope`: The affected scope (screen_id, venue_id, or fleet)
- `resolution_output`: The PRE's resolution output for this scope at this timestamp
- `resolution_version`: The PRE version that computed this output
- `sequence_number`: A monotonically increasing sequence number within the event stream, for ordering guarantees
- `delivery_timestamp`: When this event was delivered to the frontend — may differ from `timestamp` under load

**Events are immutable.** Once an event is delivered, it cannot be modified, replaced, or retracted (except via a correction event that explicitly references the original and explains the correction).

### 2.3 Authoritative State Boundaries

The boundary between authoritative state (computed by the PRE) and client-derived state (computed by the frontend) must be explicit and managed.

**Authoritative state** (must come from PRE, never client-computed):
- Effective content for any screen at any time
- Resolution level and resolution path
- Override stack composition and priority ordering
- Emergency activation status and scope
- Sponsor delivery confirmed figures
- Venue health grades (computed by entropy engine, which is PRE-adjacent)

**Client-derived state** (acceptable to compute client-side, with disclosure):
- Display-layer state (which panel is expanded, scroll position, filter state)
- Relative timestamps ("4 minutes ago" derived from a confirmed authoritative timestamp)
- UI state transitions (animation progress, loading indicator state)
- Pending action state — the frontend's optimistic representation of an in-flight action, clearly labeled as PENDING

**Explicitly prohibited client-derived state:**
- Effective content inferred from schedule data alone (must come from PRE)
- Health grade computed client-side from delivery figures
- Override priority order computed client-side
- Any state presented as authoritative that has not been confirmed by the PRE

### 2.4 Rendering Authority Hierarchy

When the frontend has multiple representations of the same operational fact (e.g., a cached PRE output from 30 seconds ago and a newly delivered PRE output), the rendering authority hierarchy determines which is displayed:

1. **Newly confirmed PRE output** — always wins
2. **Cached PRE output within RECENT threshold** — acceptable with freshness label
3. **Cached PRE output in AGING state** — displayed with AGING label
4. **Cached PRE output in STALE state** — displayed with STALE label; consequential actions blocked
5. **Client-inferred state** — never displayed as authoritative; always labeled as inferred if displayed at all

---

## Section 3 — Rendering Governance

### 3.1 Rendering Legality

The following rendering behaviors are legally permitted:

- **Rendering confirmed PRE output** — always legal
- **Rendering labeled cached output** — legal within defined thresholds, with freshness disclosure
- **Rendering PENDING state** — legal for in-flight operator actions, clearly labeled as pending
- **Rendering STALE state** — legal (and required) when synchronization has been lost
- **Progressive disclosure** — legal; summary renders before full detail renders, provided summary is not misleading
- **Batched updates** — legal within defined batch windows (per LIVE-UPDATE-BEHAVIOR-SPEC.md), with disclosure that updates are batched

The following rendering behaviors are prohibited:

- **Rendering unconfirmed state as confirmed** — prohibited
- **Rendering client-inferred state as authoritative** — prohibited
- **Silently transitioning from live to stale state** — prohibited (STALE badge is mandatory)
- **Hiding the resolution path** — prohibited (must be accessible)
- **Optimistic rendering of committed actions** — prohibited; actions must be labeled PENDING until confirmed

### 3.2 Prohibited Client-Side Assumptions

The frontend must not make the following assumptions:

- **"If no error event arrived, the action succeeded"** — the frontend must wait for a success event
- **"The override stack hasn't changed because I haven't received an update"** — absence of events may mean network failure, not absence of changes
- **"The health grade is still A because it was A 30 seconds ago"** — health grades can change rapidly; the frontend must not extend them beyond the freshness threshold
- **"The screen is playing X because the schedule says it should be"** — the schedule does not determine effective state; the PRE does
- **"This is the current override stack because I applied the last override"** — another operator may have modified the stack since

### 3.3 Visibility Obligations

The frontend has affirmative obligations to make operational truth visible — not merely to avoid hiding it.

**Visibility obligations:**
- When effective state is unknown (connection lost, PRE unavailable), this must be shown explicitly — not a blank display, not the last known state presented as current, but a labeled "state unknown" display
- When an action has been taken but not yet confirmed, the PENDING state must be visible — the operator must know that the system is processing their action
- When synchronization confidence drops below CONFIRMED, the freshness indicator must become more prominent — not hidden in small text, but displayed at a size appropriate to the degree of uncertainty
- When multiple operators are active on the same scope, their activity must be visible — not as a privacy concern, but as an operational awareness tool

### 3.4 Degraded-State Honesty

Under degraded conditions, the frontend must be more transparent, not less.

**Degraded-state rendering rules:**
- When the backend state delivery layer is experiencing delays, the frontend must display the delay duration, not hide it
- When some scopes are unreachable, the unreachable scopes must be labeled — the frontend must not display the reachable scopes' data as if it represents the full picture
- When the PRE is in degraded mode (reduced-confidence resolution), this must be propagated to the frontend and displayed — the frontend must not present a degraded PRE resolution with the same visual confidence as a full-confidence resolution
- "Graceful degradation" means: honest degradation with visible state, not invisible degradation with clean appearance

### 3.5 Stale-State Handling

When data exceeds the staleness threshold:

1. The STALE state badge (SB-03 from OPERATIONAL-COMPONENT-SEMANTICS-v1.md) is applied to the affected surface immediately
2. The staleness duration counter begins and updates continuously
3. Consequential operator actions are blocked with explicit explanation
4. Automatic reconnection attempts are made; their status is displayed
5. On reconnection, SYNCHRONIZED state is briefly shown before transitioning to LIVE

**There is no graceful acceptance of stale state.** Stale state is not a normal operational condition — it is a failure condition that requires operator awareness and platform remediation.

---

## Section 4 — Frontend Failure Modes

### Failure Mode FF-01: Optimistic Divergence

**What it is:** The frontend renders the result of an operator action before the PRE confirms it — displaying "override applied" while the PRE is still processing, or while a conflict check is pending. The operator sees a false state and may take subsequent actions based on it.

**Example:** An operator applies an override. The frontend immediately renders the override as active because the operator took the action. The PRE evaluates the override and rejects it (conflict with a higher-priority override). The frontend eventually receives the rejection — but the operator has already made a second decision based on the false "override active" state.

**Why it happens:** Optimistic UI patterns adapted from consumer software, where "eventual consistency" is acceptable and temporary false states do no harm. In ClubHub TV, false operational states produce real operational decisions.

**Prevention:** All consequential actions remain in PENDING state until PRE confirmation is received. The frontend never renders an action as complete before confirmation. The PENDING visual treatment (SB-08) makes the unconfirmed state explicit.

---

### Failure Mode FF-02: Replay Drift

**What it is:** The replay surface diverges from the live surface in its rendering of the same operational event. An operator who investigates a past event in replay sees it rendered differently from how the same event appears in the operational dashboard. They may reach different conclusions from the two views.

**Why it happens:** Separate rendering code paths for live and replay. Live rendering receives PRE output via real-time events; replay rendering reconstructs from the delivery log or from a simplified replay API that doesn't return the full resolution path. The two paths diverge as they accumulate independent changes.

**Prevention:** Live and replay rendering use the same rendering components, consuming the same data structure (PRE resolution output). The only difference is the source of the PRE output — live calls the current PRE; replay calls the historical PRE. Both return the same schema; both are rendered by the same components.

---

### Failure Mode FF-03: Synchronization Hallucination

**What it is:** The frontend believes it is synchronized when it is not. It displays the LIVE state badge, presents data as current, and allows consequential actions — while actually displaying state from a prior synchronization that is now stale.

**Why it happens:** Synchronization detection that is overly optimistic — checking only that a connection exists, not that current data has been received within the expected interval.

**Prevention:** LIVE state requires active, periodic confirmation. The synchronization watchdog monitors the time since last confirmed data receipt and transitions to AGING or STALE when thresholds are crossed — regardless of whether the connection appears active.

---

### Failure Mode FF-04: Hidden Retry Mutation

**What it is:** An action fails silently, is retried by the frontend automatically, and succeeds on retry — but the operator never sees the failure, the retry, or the confirmation. The operator's action is eventually applied, but the audit record shows the action at the time of the retry, not the time the operator initiated it. More dangerously: if the action is not idempotent, a retry may apply it twice.

**Why it happens:** Retry logic in the frontend's action handling that is designed to improve "reliability" without considering the operational consequences of silent retries.

**Prevention:** All retries are disclosed to the operator. If an action fails and is retried, the PENDING state (SB-08) remains visible and includes "retry N of M in progress." If a retry succeeds, the operator is notified of the retry and the final confirmation timestamp. If retries are exhausted without success, the operator receives an explicit error — not a silent failure.

---

### Failure Mode FF-05: Local-State Corruption

**What it is:** The frontend maintains local state (for UI performance, offline capability, or interaction flow continuity) that diverges from the authoritative backend state. The local state overrides the backend state in rendering, producing a display that contradicts what the PRE has resolved.

**Why it happens:** Client-side state management systems that maintain their own representations of operational data, applied over incoming backend updates, can produce this divergence when the local state is updated (by an operator action) but the backend state update is delayed or arrives out of order.

**Prevention:** Local state that represents operational facts (effective content, override stack, health grade) is always treated as PENDING until confirmed by the backend. It never overrides confirmed backend state in rendering.

---

### Failure Mode FF-06: Authority Inversion

**What it is:** The frontend presents client-derived state as more authoritative than PRE-confirmed state. The most common form: the frontend computes what should be playing based on the schedule, and when the PRE output has not yet arrived, renders the schedule-computed prediction as the current effective state — without labeling it as predicted.

**Why it happens:** Designed with good intent — "let's show the operator something rather than a loading spinner." The loading spinner is more honest than the predicted state.

**Prevention:** When authoritative PRE output has not been received, the display is either STALE (if prior output exists beyond threshold) or explicitly "awaiting state — not yet confirmed." The frontend does not fill in PRE output with schedule-derived predictions, even transiently.

---

## Section 5 — Human Factors

### 5.1 Trust Collapse After Divergence

When an operator discovers that the frontend showed them something that was not true — an override "applied" that was actually rejected, a health grade "A" for a venue that was actually DEGRADED — the trust damage is disproportionate to the single event. The operator now doubts all prior states they believed were confirmed. They may begin questioning whether the platform's current state is also false.

Trust collapse is not recoverable through explanation. The operator who has experienced a false state will require repeated accurate states over an extended period before trust is restored — and even then, a residual distrust may persist.

**Design implication:** Preventing false states is a trust-preservation strategy, not an accuracy goal. The cost of a single false state — in operational error risk and in trust damage — is orders of magnitude greater than the cost of displaying PENDING or STALE states while waiting for confirmation.

### 5.2 Stale-State Confusion

Operators who have been working with a stale display without realizing it — because the stale indicator was not prominent or was missed — experience a specific form of confusion when the display updates to current state: they cannot reconcile the current state with the decisions they made based on the stale state.

**Design implication:** The STALE indicator must be impossible to miss (Section 3.5). The SYNCHRONIZED update (after stale recovery) must surface what changed during the stale period — otherwise the operator has no way to understand the gap between what they believed and what is actually true.

### 5.3 Hidden Synchronization Stress

Operators who are uncertain about whether the display is current — who have a nagging sense that "this might be stale" without having explicit evidence — experience low-level stress that accumulates and degrades operational performance over time. This is distinct from explicit stale-state confusion: it is uncertainty, not falseness.

**Design implication:** Synchronization confidence must be actively communicated, not assumed. An operator who can see "synchronized 4 seconds ago" is in a fundamentally different cognitive state from an operator who sees no freshness indicator and has to guess. The former is confident; the latter is uncertain. Both may be viewing the same data — but only the former can focus their attention on operational decisions rather than meta-questions about the display's accuracy.

### 5.4 Authority Ambiguity

When the operator cannot determine whether what they see is PRE-confirmed, client-predicted, or cached, they are in a state of authority ambiguity — they do not know how much to trust the display. Authority ambiguity produces hesitation in time-sensitive decisions and second-guessing in all decisions.

**Design implication:** Every displayed operational fact must have an accessible authority label — what it is (PRE-confirmed, cached at timestamp X, pending confirmation) — within one interaction. Not every fact needs to display this label permanently, but every fact must be able to answer the question "where does this come from and when was it confirmed?" immediately on operator request.

---

## Related Documents

**STATE-SYNCHRONIZATION-AND-CONSISTENCY-v1.md** — The synchronization states and consistency governance that implement the synchronization rules in this document.

**REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md** — The replay-safe architecture that prevents the replay drift failure mode (FF-02).

**FRONTEND-TRUTH-AND-RENDERING-GOVERNANCE-v1.md** — The rendering honesty rules that implement the rendering governance in Section 3.

**CANONICAL-UI-STATE-MODEL.md** — The eight state types that this document's state flow produces and that the frontend must render and label.

**COMPONENT-CONSTITUTION-v1.md** — The component invariants that operationalize this document's rendering legality rules.

**CROSS-AGENT-GOVERNANCE.md** — The shared decision zone governance under which this document was created. Changes require all three agent leads.

---

*End of PRE-NATIVE-FRONTEND-ARCHITECTURE-v1.md v1.0*
*Authority: SHARED — Agent 1 (PRE/Runtime) + Agent 2 (Backend/Sync) + Agent 3 (UX/Rendering)*
*PRE resolution output schema and state query API: Agent 1 definition authority*
*Backend state delivery layer implementation: Agent 2 implementation authority*
*Frontend rendering conformance: Agent 3 definition authority*
*Changes to any section require consensus of all three agents.*
