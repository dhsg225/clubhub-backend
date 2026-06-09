# ClubHub TV — Event and State Orchestration
# Shared Operational Intelligence Layer — Phase D: Operational Frontend Execution Architecture

**Document type:** Cross-agent architectural governance — event classification, ordering, and state orchestration
**Authority:** SHARED DECISION ZONE — Agent 1 (PRE/Runtime) + Agent 2 (Backend/Sync); Agent 3 operator visibility requirements
**Audience:** All frontend contributors; backend engineers; Agent 1 (event schema); Agent 2 (delivery)
**Last updated:** 2026-05-25
**Status:** CANONICAL — event processing behavior not conforming to this document is not eligible for deployment
**Phase:** D — Operational Frontend Execution Architecture (cross-agent shared decision zone)

---

## Purpose

This document defines the event classification system, orchestration rules, and consistency guarantees for state events flowing from the ClubHub TV backend to the frontend runtime.

The threat this document addresses: **event chaos at the boundary.** The backend produces many event types from many sources at potentially high volume. Without a defined classification system, ordering rules, and visibility requirements, the frontend receives an undifferentiated stream of state changes and must make ad-hoc decisions about how to process them. These ad-hoc decisions — batching one type but not another, dropping duplicates inconsistently, reordering events for performance — introduce exactly the non-determinism that Phase D is designed to prevent.

**The governing principle: causality preservation through event discipline.** Events must be classified before they are processed, ordered before they are applied, and isolated across execution paths. The operator's experience of operational time must map precisely onto the actual sequence of operational events.

---

## Section 1 — Event Philosophy

### 1.1 Causality Preservation

Every event in the ClubHub TV event stream represents a fact about operational reality. The relationship between events — which came first, which caused which — is as operationally significant as the events themselves. An override applied before an emergency activation has a different operational meaning than an override applied after — even if the override stack looks the same in both cases.

**Causality preservation requires:**
- Events carry enough information to reconstruct their causal position in the operational sequence
- The frontend processes events in causal order, not arrival order
- When causal relationships between events are known (Event A caused Event B), this is represented in the event schema and rendered in the UI (causality indicators, TP-06)

### 1.2 Event Ordering Integrity

The order in which events are applied to the render model is a constitutional property. Event ordering integrity means that the render model always reflects a causally consistent state — a state that could have actually existed in the operational timeline.

**What constitutes an ordering integrity violation:**
- Applying Event B (PRE timestamp T+1) before Event A (PRE timestamp T) for the same scope
- Applying two events atomically that did not occur simultaneously (falsely implying they were simultaneous)
- Dropping Event A and applying Event B, creating a state that never existed in the actual operational timeline

### 1.3 Operational Event Visibility

Operationally significant events must be visible to the operator — not just applied to the render model, but disclosed as events. The operator should be able to see that something changed, what changed, and why, not just observe that the display looks different.

**Visibility tiers:**
- **Always visible (operator-notified):** Tier 3+ escalation events, emergency activations, incident declarations, synchronization state changes
- **Accessible on demand:** Tier 1–2 advisory events, passive state updates, delivery log updates
- **Background (not surfaced):** Internal bookkeeping events, heartbeats, sequence number acknowledgments

---

## Section 2 — Event Classes

Six canonical event classes exist. Every event in the ClubHub TV event stream belongs to exactly one class. Class membership determines the event's processing priority, ordering rules, batching eligibility, and operator visibility requirements.

### Event Class EC-01: PRE Resolution Events

**Definition:** Events produced by the PRE when it resolves the effective state for a scope — override applied, schedule transition, emergency activation, content change.

**Properties:**
- `event_class`: "PRE_RESOLUTION"
- `pre_timestamp`: PRE operational clock timestamp (authoritative)
- `scope`: Affected scope (screen_id, venue_id, fleet)
- `resolution_output`: Full PRE resolution output including effective state and resolution path
- `resolution_version`: PRE version that computed this output
- `prior_state_hash`: Hash of the prior state, enabling conflict detection

**Processing priority:** Highest — PRE resolution events are the operational ground truth and are processed before any other event class.

**Batching:** PRE resolution events are never batched. Each event is processed individually and rendered atomically.

**Operator visibility:** Always visible for the affected scope. Significant state changes (effective content change, resolution level change) generate at minimum a U-02 (attention-worthy) update per LIVE-UPDATE-BEHAVIOR-SPEC.md.

---

### Event Class EC-02: Synchronization Events

**Definition:** Events produced by the synchronization layer reporting on the health of the data connection between backend and frontend — connected, disconnected, degraded, reconnected, data gap detected.

**Properties:**
- `event_class`: "SYNCHRONIZATION"
- `sync_state`: The new synchronization state (per STATE-SYNCHRONIZATION-AND-CONSISTENCY-v1.md)
- `affected_scopes`: Which scopes are affected by this synchronization change
- `reason`: Machine-readable reason code for the synchronization event
- `recovery_path`: What action is being taken to restore synchronization

**Processing priority:** High — synchronization events must be applied before any further PRE resolution events for the affected scopes, so that the synchronization state is correctly displayed before new data is rendered.

**Batching:** Synchronization events are never batched. Each event is rendered immediately.

**Operator visibility:** All synchronization state transitions below SYNCHRONIZED (AGING, STALE, DEGRADED, DISCONNECTED) generate visible state badges. Recovery (return to SYNCHRONIZED) generates a SYNCHRONIZED state badge with brief display.

---

### Event Class EC-03: Operator Intervention Events

**Definition:** Events produced when an operator takes a consequential action — override applied, emergency activated, incident declared, action confirmed, action rejected.

**Properties:**
- `event_class`: "OPERATOR_INTERVENTION"
- `intervention_type`: The action type (canonical action types from INTERACTION-SEQUENCING-SPEC.md)
- `operator_id`: The acting operator
- `scope`: Affected scope
- `action_timestamp`: PRE operational clock timestamp of when the action was applied
- `outcome`: Confirmed / Rejected / Pending
- `audit_record_id`: Link to the immutable audit record for this intervention

**Processing priority:** High — operator intervention events that affect the current operator's scope are rendered immediately.

**Batching:** Never batched for the current operator's own actions. Remote operator interventions on the current scope may be batched with a maximum 2-second window.

**Operator visibility:**
- Own actions: confirmation / rejection surfaced prominently
- Remote actions on current scope: attributed update (per STATE-SYNCHRONIZATION-AND-CONSISTENCY-v1.md Section 4.2)
- Remote actions on other scopes: available in notification stream, not prominently surfaced

---

### Event Class EC-04: Replay Events

**Definition:** Events produced by the replay system as the operator navigates temporal positions — PRE evaluation results for historical moments, corpus availability status, counterfactual simulation results.

**Properties:**
- `event_class`: "REPLAY"
- `replay_timestamp`: The historical PRE operational clock timestamp being rendered
- `scope`: The historical scope being queried
- `resolution_output`: Historical PRE resolution output
- `reconstruction_confidence`: EXACT / HIGH / MEDIUM / LOW / UNAVAILABLE
- `corpus_gap`: Whether this replay event covers a period with a corpus gap

**Processing priority:** Applied only in the replay execution path (Section 3.4 of OPERATIONAL-FRONTEND-RUNTIME-v1.md). Replay events never enter the live execution path.

**Batching:** Not applicable — replay events are produced on demand in response to scrubber navigation, not pushed continuously.

**Operator visibility:** All replay events update the REPLAY state header and the render model. Corpus gaps and approximations are always disclosed per REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md.

---

### Event Class EC-05: Degradation Events

**Definition:** Events reporting that the platform's operational capability has reduced — PRE operating in degraded mode, screens unreachable, data pipeline delayed, partial data availability.

**Properties:**
- `event_class`: "DEGRADATION"
- `degradation_type`: What is degraded (PRE confidence, device connectivity, data pipeline, backend availability)
- `affected_scopes`: Which scopes are affected
- `degradation_severity`: MINOR / MODERATE / SEVERE
- `estimated_recovery`: When recovery is expected (if known)

**Processing priority:** High — degradation events must be rendered before subsequent data events for the affected scopes, so that degraded state is visible before the data itself is displayed.

**Batching:** Never batched — degradation state must be immediately visible.

**Operator visibility:** DEGRADED state badge with specific description, per CANONICAL-UI-STATE-MODEL.md.

---

### Event Class EC-06: Advisory Events

**Definition:** Events from the entropy and operational intelligence system reporting advisory conditions — health grade changes, entropy threshold crossings, override accumulation advisories, SOV delivery advisories.

**Properties:**
- `event_class`: "ADVISORY"
- `advisory_type`: The advisory condition type (from entropy model M-01 through M-12)
- `scope`: Affected scope
- `signal_tier`: The attention tier (0–5) per ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md
- `advisory_value`: The metric value that triggered the advisory
- `threshold`: The threshold that was crossed
- `advisory_message`: Operator-facing description

**Processing priority:** Priority determined by `signal_tier` — Tier 3+ advisory events are high priority; Tier 0–2 advisory events are low priority (batch-eligible).

**Batching:** Tier 0–2 advisory events are eligible for batching within the passive update window. Tier 3+ are never batched.

**Operator visibility:** Per signal tier. Tier 3+ events generate persistent indicators. Tier 0–2 events update in-place without notification.

---

## Section 3 — Orchestration Rules

### 3.1 Ordering Guarantees

The event orchestration layer enforces the following ordering guarantees:

**Within a scope:**
- Events are applied in PRE operational clock timestamp order
- The ordering layer buffers events within a 500ms window to allow for out-of-order network delivery
- After the window expires, events are applied in timestamp order with any still-missing events flagged as potential gaps

**Across event classes (same scope, same timestamp):**
When multiple event classes have the same PRE timestamp for the same scope, application order is:
1. EC-05 Degradation (must be applied before any data events for degraded scopes)
2. EC-02 Synchronization (must be applied before PRE resolution events to set the synchronization context)
3. EC-01 PRE Resolution (the ground truth data)
4. EC-03 Operator Intervention (actions and their consequences)
5. EC-06 Advisory (intelligence derived from the above)
4. EC-04 Replay (isolated path, not applicable to live stream)

**Cross-scope ordering:** No ordering guarantee is provided or required across scopes. Events for Venue A and events for Venue B may be processed in any order relative to each other.

### 3.2 Batching Legality

| Event class | Batching eligibility | Maximum batch window |
|---|---|---|
| EC-01 PRE Resolution | Never | N/A |
| EC-02 Synchronization | Never | N/A |
| EC-03 Operator Intervention (own) | Never | N/A |
| EC-03 Operator Intervention (remote, current scope) | Limited | 2 seconds |
| EC-03 Operator Intervention (remote, other scope) | Eligible | 10 seconds |
| EC-04 Replay | N/A (demand-driven) | N/A |
| EC-05 Degradation | Never | N/A |
| EC-06 Advisory (Tier 3+) | Never | N/A |
| EC-06 Advisory (Tier 0–2) | Eligible | 5 seconds |

**Batch window override during incidents:** All batch windows are reduced to maximum 1 second during an active incident on the current scope.

### 3.3 Throttling Legality

Throttling — intentionally delaying event processing to limit the rate of updates — is permitted only for EC-06 Advisory Tier 0–2 events during high-volume periods. Throttling is prohibited for all other event classes.

**Throttling disclosure:** When throttling is active, the operator must be informed: "Advisory updates are being consolidated due to high event volume. [Count] advisories updated in the last [window]."

### 3.4 Retry Governance

When event delivery fails (acknowledgment timeout, network error), the delivery layer may retry. Retry governance:

- Retries are permitted for all event classes — failed delivery is not a data event, it is a delivery event
- The frontend maintains an acknowledgment timeout per event: events not acknowledged within the timeout are flagged for redelivery by the backend
- Redelivered events are deduplicated by `event_id` — a redelivered event that has already been processed is silently dropped
- If the maximum retry count is exhausted without delivery, this is reported as an EC-02 (Synchronization) event — the event gap is treated as a synchronization failure, not a silent data loss

### 3.5 Replay Event Isolation

Replay events (EC-04) are completely isolated from the live event stream. The orchestration layer maintains separate queues:

- **Live queue:** EC-01, EC-02, EC-03, EC-05, EC-06
- **Replay queue:** EC-04

When the frontend is in replay mode, the live queue continues to be populated (live events arrive and are processed into the live state model) but no events from the live queue enter the render scheduler. When replay mode is exited, the live state model is applied to the render model, which may include multiple live events that accumulated during the replay session.

---

## Section 4 — Multi-Stream Consistency

### 4.1 Concurrent Event Streams

The frontend receives events from multiple concurrent streams:
- Real-time push (websocket or SSE) — low latency, high frequency for active scopes
- Periodic polling — medium latency, lower frequency for fleet-wide data
- Delivery log updates — batch-processed, higher latency
- Advisory system — computed on schedule, delivered as advisory events

**Multi-stream consistency rule:** When the same operational fact is delivered by multiple streams (e.g., an override that appears in both real-time push and a subsequent polling response), the frontend uses the event with the authoritative PRE timestamp. The real-time push event and the polling event for the same override are deduplicated — the later-arriving duplicate is dropped without processing.

### 4.2 Conflict Visibility

When two events for the same scope carry contradictory PRE outputs at the same timestamp — a genuine conflict in the event stream — this must be surfaced to the operator as a DIVERGENT state.

**Conflict detection rule:** Two events produce a conflict if:
- They affect the same scope
- They carry the same or overlapping PRE timestamps
- Their `resolution_output` values differ

**Conflict resolution:** The conflict is surfaced as DIVERGENT state (State Type 8, CANONICAL-UI-STATE-MODEL.md). The backend is notified of the conflict via the conflict report mechanism. The frontend does not silently resolve conflicts by picking one event over the other.

### 4.3 Temporal Alignment

The frontend must maintain temporal alignment across simultaneous event streams. When events from different streams affect the same surface at the same time, they must be aligned to the same PRE operational clock reference — not applied in network arrival order, which may differ between streams.

**Temporal alignment implementation:** The state processing layer maintains a per-scope "current time" cursor that advances only forward (toward the most recent confirmed PRE timestamp). Events with timestamps behind the cursor for a scope are late arrivals — they are applied as corrections with explicit disclosure, not silently inserted.

### 4.4 Event Deduplication Visibility

While silent deduplication (dropping duplicate events without notification) is correct for EC-01 through EC-06, the deduplication rate must be visible in the platform's operational monitoring (not in the operator-facing UI, but in the platform's own observability layer):

- Deduplication events are logged with: original event_id, duplicate event_id, delivery stream, timestamp of both arrivals
- High deduplication rates indicate a delivery infrastructure issue and should trigger an operational alert to the platform team

---

## Section 5 — Failure Modes

### Failure Mode EO-01: Hidden Reorder

**What it is:** The orchestration layer applies Event B (timestamp T+1) before Event A (timestamp T) due to network arrival order, and the reorder produces an incorrect intermediate state that the operator sees briefly before Event A corrects it. The operator experiences a "flash" of wrong state.

**Prevention:** Per-scope ordering with the 500ms buffering window (Section 3.1). Events are held until the window expires before being applied in timestamp order. The flash is impossible because events are not rendered until they can be ordered correctly.

---

### Failure Mode EO-02: Dropped-Event Ambiguity

**What it is:** An event is dropped — never delivered, lost in transit, or silently discarded — and the frontend continues displaying state as if the event had been applied. The operator's display shows the pre-event state while the actual operational state reflects the event. When the discrepancy is discovered (through a subsequent event that references the dropped event, or through operator investigation), the operator cannot determine what happened.

**Prevention:** Acknowledgment timeout with gap detection (Section 3.4). If an expected event does not arrive within the timeout, this is treated as a synchronization failure (EC-02 event). The gap is surfaced to the operator as STALE or DEGRADED state for the affected scope.

---

### Failure Mode EO-03: Duplicate-Event Illusion

**What it is:** A duplicate event is processed (the deduplication layer failed), causing the same operational fact to appear twice — an override appearing twice in the stack, a timeline event appearing twice, a health grade change being animated twice.

**Prevention:** Strict event_id deduplication with the rolling window (Section 3.1, deduplication). The deduplication window is sized to cover the maximum expected redelivery delay, ensuring that any redelivered event will be caught before processing.

---

### Failure Mode EO-04: Event Starvation

**What it is:** High-priority events continuously preempt low-priority events in the orchestration queue, causing low-priority events to never be processed. Advisory events accumulate without rendering, producing a large batch of "missed" advisories that render all at once when the high-priority stream quiets.

**Prevention:** Maximum batch age enforcement (Section 3.2 — maximum batch window). Every event class has a maximum time it can be held in the queue before it must be processed, regardless of queue depth from higher-priority events.

---

### Failure Mode EO-05: Synchronization Inversion

**What it is:** An EC-02 (Synchronization) event reporting STALE state arrives at the orchestration layer after subsequent EC-01 (PRE Resolution) events for the same scope. The frontend applies the PRE resolution events first (because they arrived first), then applies the STALE synchronization event, transitioning the display to STALE state after it has already been updated with data that arrived while in the STALE condition.

**Prevention:** Cross-class ordering rule (Section 3.1 — across event classes). Synchronization events are applied before PRE resolution events at the same timestamp. If a synchronization event arrives after PRE resolution events with overlapping timestamps, the orchestration layer detects the out-of-order delivery and applies a corrected sequence.

---

## Section 6 — Human Factors (Agent 3 Contribution)

### 6.1 Event Visibility as Operational Transparency

Operators who can see that things are happening — not just that the display has changed, but that a specific event was the cause — have a stronger operational mental model than operators who observe only the effects of events without the events themselves.

**Design implication:** The notification stream (accessible from any workspace) is the operator-facing reflection of the event orchestration layer. It is not every event (most events are too low-level to surface individually), but it is every event at EC-03 and above, plus EC-06 Tier 3+ advisories. The notification stream lets operators verify their understanding: "I thought an override expired — let me check the notification stream." The notification stream is the human-accessible audit of the orchestration layer.

### 6.2 Ordering Confusion

When operators observe state changes that appear out of order — because of batching, delayed rendering, or (in the failure mode) actual ordering violations — they lose confidence in their ability to reconstruct the operational timeline. "The override appeared in the stack before the schedule change, but I thought the schedule change happened first" is a genuinely disorienting experience that undermines the operator's mental model.

**Design implication:** The operational timeline must be the authoritative presentation of event order — and the timeline must be driven by PRE operational clock timestamps, not arrival timestamps. An operator who observes a confusing order in the live display can always verify the actual order by examining the timeline.

### 6.3 Concurrent Intervention Visibility

When multiple operational events occur in rapid succession — a remote override, a schedule transition, and an advisory threshold crossing all within a 10-second window — operators may not be able to process all three. The presentation must prioritize the most operationally significant event (highest tier) without losing the others.

**Design implication:** The update type hierarchy (from LIVE-UPDATE-BEHAVIOR-SPEC.md, U-01 through U-05) maps to the event class priorities. The highest-priority update within a batch is the visually dominant render; lower-priority updates are present but not competing for primary attention. The notification stream serves as the backup record for updates that were not at the top of the attention hierarchy.

### 6.4 Event Deduplication Distrust

If an operator observes the same event appearing twice — duplicate-event illusion (EO-03) — they may interpret this as a double-application of the action, not as a display artifact. An override that appears twice in the stack looks like two overrides, not one override that was rendered twice.

**Design implication:** Duplicate-event illusion is among the most trust-damaging failure modes because it directly misrepresents the override stack — the operational record the operator uses to understand what is affecting their screens. Deduplication must be bulletproof. The deduplication window must be sized generously enough to catch all realistic redelivery scenarios.

---

## Related Documents

**OPERATIONAL-FRONTEND-RUNTIME-v1.md** — The runtime that implements the event orchestration defined here. The event ingestion pipeline (Section 3.1) maps to the event classes and orchestration rules in this document.

**RENDERING-LIFECYCLE-AND-CONCURRENCY-v1.md** — How events from the orchestration layer are rendered with concurrency governance.

**STATE-SYNCHRONIZATION-AND-CONSISTENCY-v1.md** — EC-02 (Synchronization events) map to the synchronization states defined there.

**LIVE-UPDATE-BEHAVIOR-SPEC.md** — EC-06 Advisory events map to the update types (U-01 through U-05) defined there.

**ATTENTION-ECONOMICS-AND-SIGNAL-PRIORITY-v1.md** — EC-06 signal tiers map to the attention tier system.

---

*End of EVENT-AND-STATE-ORCHESTRATION-v1.md v1.0*
*Authority: SHARED — Agent 1 (PRE/Runtime) + Agent 2 (Backend/Sync); Agent 3 operator visibility requirements*
*Event schema definition (event_id, pre_timestamp, resolution_output): Agent 1 definition authority*
*Event delivery infrastructure and ordering guarantees: Agent 2 implementation authority*
*Operator visibility requirements and notification stream: Agent 3 definition authority*
*Changes require consensus of Agent 1 and Agent 2; Agent 3 review for visibility rule changes.*
