# ClubHub TV — State Synchronization and Consistency
# Shared Operational Intelligence Layer — Phase B: PRE-Native Frontend Architecture

**Document type:** Cross-agent architectural governance — synchronization semantics and consistency rules
**Authority:** SHARED DECISION ZONE — Agent 1 (PRE/Runtime) + Agent 2 (Backend/Sync) + Agent 3 (UX/Rendering)
**Audience:** All frontend contributors; backend engineers; platform architects
**Last updated:** 2026-05-25
**Status:** CANONICAL — synchronization behavior not conforming to this document is not eligible for deployment
**Phase:** B — PRE-Native Frontend Architecture (cross-agent shared decision zone)

---

## Purpose

This document defines the synchronization states, consistency guarantees, and honest uncertainty disclosure rules for the ClubHub TV frontend. It answers the question: when the frontend has not received the latest operational state, what does it know, what does it show, and how does it communicate the gap?

The threat this document addresses: **synchronization illusion.** In distributed systems, the frontend is always slightly behind the operational reality. Network latency, processing queues, and batching windows mean that what the frontend displays is a recent picture of the operational state, not an instantaneous one. This is normal and unavoidable. The problem arises when the frontend pretends the delay does not exist — displaying data as "current" without disclosing that it is milliseconds, seconds, or minutes old, and allowing operators to make decisions on that undisclosed approximation.

**The governing principle: synchronization honesty.** The frontend knows how fresh its data is. This knowledge is operationally relevant. The operator deserves to know it.

---

## Section 1 — Synchronization Philosophy

### 1.1 Synchronization Honesty

The frontend's synchronization state is an operational fact, not an implementation detail. When the frontend is not confirmed-current, this affects the reliability of every operational judgment an operator makes based on its display.

Synchronization honesty means:
- The freshness of displayed data is disclosed at a granularity appropriate to its operational significance
- Transitions from synchronized to partially synchronized to stale are surfaced to the operator, not hidden
- Actions that require current data are blocked or warned when synchronization confidence drops below the action's required threshold
- Reconnection and resynchronization are visible processes — the operator can see that the platform is recovering, not just wait for a loading spinner to disappear

### 1.2 Visible Uncertainty

Uncertainty about the current operational state is operationally significant. An operator who does not know that their display might be 30 seconds behind the operational reality is more dangerous than an operator who knows their display is 30 seconds behind and adjusts their confidence accordingly.

Visible uncertainty means:
- Aging data carries aging indicators that grow more prominent as data ages
- Partial data is displayed as partial — not averaged, not extrapolated, not silently omitted
- The gap between what the frontend knows and what may be operationally true is always calculable from the displayed information

### 1.3 No Hidden Reconciliation

When the frontend receives data that contradicts its prior state — a new PRE output that differs from the cached output — this reconciliation must be visible. The operator may notice a change and need to understand why the display changed. Hidden reconciliation — silently updating the display without surfacing the change — prevents the operator from understanding the operational significance of the update.

No hidden reconciliation means:
- State updates that produce significant changes in displayed values generate visible update events (per LIVE-UPDATE-BEHAVIOR-SPEC.md)
- Reconciliation after a stale period surfaces what changed during the gap
- Corrections to previously displayed state (e.g., a delayed event that retroactively changes the timeline) are surfaced as corrections, not silently applied

---

## Section 2 — Synchronization States

Seven canonical synchronization states exist. Every surface in the platform is in exactly one synchronization state at any given moment.

### Sync State SS-01: SYNCHRONIZED

**Definition:** The surface has received confirmed PRE output within the expected update interval. Data freshness is within the CONFIRMED threshold.

**Conditions for entry:**
- Last confirmed data receipt within the expected update interval
- No pending unacknowledged discrepancies between local and backend state

**Frontend behavior:**
- LIVE state badge (SB-01) displayed
- All consequential actions available
- Freshness timestamp accessible (within one interaction) but not permanently displayed

**Exit conditions:**
- Expected update interval elapses without new data → transitions to PARTIALLY-SYNCHRONIZED

---

### Sync State SS-02: PARTIALLY-SYNCHRONIZED

**Definition:** The surface has received some but not all expected data within the current update interval. Some data components are current; others are aging.

**Conditions for entry:**
- Some data components within expected interval; some have exceeded the interval by 1–2×

**Frontend behavior:**
- LIVE state badge maintained (the surface is still live, but with reduced confidence)
- Freshness indicator becomes visible at the component level: components with aging data display a subtle aging indicator
- No action blocks — partial synchronization is a warning state, not a blocking state
- Reconnection or re-fetch attempts in progress if the cause is identifiable

**Exit conditions:**
- All components return to CONFIRMED threshold → transitions to SYNCHRONIZED
- Any component exceeds 2× expected interval → transitions to AGING

---

### Sync State SS-03: AGING

**Definition:** One or more data components have exceeded 2× the expected update interval without confirmation. The data is likely still accurate but cannot be guaranteed.

**Conditions for entry:**
- At least one data component beyond 2× expected update interval

**Frontend behavior:**
- AGING state label on the affected components
- Freshness indicator is prominently visible at the component level
- Actions affecting aging data components carry a freshness warning: "This data is [N] seconds old. Confirm to proceed."
- Automatic refresh attempts ongoing

**Exit conditions:**
- Affected components return to confirmation → transitions to SYNCHRONIZED or PARTIALLY-SYNCHRONIZED
- Any component exceeds staleness threshold → transitions to STALE

---

### Sync State SS-04: STALE

**Definition:** One or more data components have exceeded the staleness threshold. Data may no longer reflect current operational reality.

**Conditions for entry:**
- Any data component beyond the staleness threshold (default: 4× expected update interval, or 60 seconds, whichever is greater)

**Frontend behavior:**
- STALE state badge (SB-03) displayed prominently
- Staleness duration counter visible and updating
- All consequential actions blocked: "Actions unavailable — view not synchronized. Last synchronized: [timestamp]."
- Read-only operations permitted with staleness disclosure on all displayed values
- Reconnection attempts ongoing with visible status

**Exit conditions:**
- Synchronization restored → transitions to SYNCHRONIZED (with brief SYNCHRONIZED state shown)
- Connection fully lost → transitions to DISCONNECTED

---

### Sync State SS-05: DEGRADED

**Definition:** The surface is receiving live data from a partial or reduced-confidence source. Data is real-time but incomplete.

**Conditions for entry:**
- Backend state delivery layer reports partial availability (some scopes, some data types)
- PRE operating in degraded mode (reduced-confidence resolution)

**Frontend behavior:**
- DEGRADED state badge (SB-04) displayed with specific degradation description
- Degraded data components labeled with confidence qualifier
- Operations affecting degraded components carry additional confirmation: "Data for [N] screens is unavailable. This action will apply to confirmed scopes only."
- Non-degraded components continue with full SYNCHRONIZED behavior

**Exit conditions:**
- All data sources restored → transitions to SYNCHRONIZED
- Remaining data sources also lost → transitions to STALE or DISCONNECTED for affected components

---

### Sync State SS-06: DISCONNECTED

**Definition:** The surface has completely lost connection to the backend state delivery layer. No operational data is being received.

**Conditions for entry:**
- Complete loss of backend connection
- All reconnection attempts have failed or exceeded the connection timeout

**Frontend behavior:**
- STALE state badge with "Disconnected" label
- Explicit disconnection message: "Connection to operational system lost. Attempting to reconnect. Last synchronized: [timestamp]."
- All actions blocked
- The last received state is displayed but labeled clearly as potentially outdated
- Reconnection status displayed: "Reconnecting (attempt N of M)..."

**Exit conditions:**
- Connection restored → transitions to SYNCHRONIZED (with full reconciliation)

---

### Sync State SS-07: REPLAY-LOCKED

**Definition:** The surface is in replay mode. Live synchronization is suspended by design. The surface is viewing a historical state, not the current state.

**Conditions for entry:**
- Operator initiates replay mode (explicit transition per CANONICAL-UI-STATE-MODEL.md)

**Frontend behavior:**
- REPLAY state badge (SB-02) displayed
- Live update feed suspended — no new live data updates the display
- All displayed data reflects the selected historical moment
- Scrubber navigation is the only mechanism for changing the displayed state

**Exit conditions:**
- Operator explicitly exits replay → transitions to SYNCHRONIZED (with reconciliation)

---

## Section 3 — Consistency Governance

### 3.1 Eventual Consistency Visibility

The ClubHub TV backend is a distributed system with eventual consistency properties. Events propagate with finite latency; different data types have different propagation speeds. The frontend must make eventual consistency visible rather than hiding it behind a "we'll catch up eventually" assumption.

**Eventual consistency disclosure rules:**
- Data types with different propagation speeds are labeled with their respective expected update intervals. The health grade (computed on a 60-second cycle) and the override stack (updated in near-real-time) are displayed with different freshness expectations.
- When two data types on the same surface have different freshness states, this is disclosed: "Override stack: synchronized. Health grade: updated 52 seconds ago (updates every 60s)."
- Operators are never required to infer that two data types have different update cadences — this is always disclosed.

### 3.2 Ordering Guarantees

The backend state delivery layer provides the following ordering guarantees:

**Within a scope (screen, venue, fleet):**
- Events for the same scope are delivered in the order they occurred, as determined by the PRE's operational clock
- No out-of-order delivery within a scope — if event B occurred after event A on screen S, the frontend will receive A before B for screen S

**Across scopes:**
- Events for different scopes may arrive in any order
- The frontend must not infer temporal relationships between events at different scopes from their delivery order

**Implementation requirement (Agent 2):** The backend state delivery layer must maintain per-scope ordering. Out-of-order delivery within a scope is a consistency violation that must be detected and corrected at the delivery layer, not tolerated and reconciled at the frontend.

### 3.3 Delayed Event Rendering

Some events arrive at the frontend after significant delay relative to when they occurred — typically batch-processed data (delivery log confirmations, entropy computations, sponsor SOV calculations). These delayed events must be rendered honestly.

**Delayed event rendering rules:**
- The event's position in the timeline reflects when it occurred, not when it was delivered
- The delivery delay is disclosed: "Sponsor delivery confirmed at 14:23 (confirmed at 14:28 — 5-minute processing pipeline)"
- Delayed events that contradict a currently displayed state update the display, with the update labeled as a correction: "Delivery data updated: gap detected at 14:23 (reported at 14:28)"

### 3.4 Retry Disclosure

When an action fails and is retried:

1. The PENDING state (SB-08) remains displayed — the operator knows the action is still in-flight
2. The retry count is visible: "Applying: override to Screen: Bar Left (retry 2 of 3)"
3. The retry delay is disclosed: "Retrying in 3 seconds..."
4. On retry success: confirmation includes the retry count: "Override applied (confirmed after 2 attempts)"
5. On retry exhaustion: explicit failure with recovery path: "Override could not be applied after 3 attempts. [Reason if known]. [Recovery path.]"

**Non-idempotent actions may not be retried automatically.** Actions that have side effects beyond the intended effect (e.g., actions that charge a credit account, generate a notification, or produce an audit event on each attempt) must not be automatically retried. The operator must explicitly re-initiate the action.

**Implementation requirement (Agent 2):** The backend must clearly specify which action endpoints are idempotent (safe to retry) and which are not. The frontend may only auto-retry idempotent endpoints.

### 3.5 Conflict Visibility

When two state updates conflict — when the backend receives two events that cannot both be true simultaneously — this conflict must be surfaced to the frontend and to the operator.

**Conflict visibility rules:**
- The DIVERGENT state (SB-06 / State Type 8 in CANONICAL-UI-STATE-MODEL.md) is activated when conflicting state is detected
- The conflicting values are displayed side by side
- The authoritative value is identified (per resolution rules defined by Agent 1 and Agent 2)
- The conflict is logged for investigation

**The frontend must not silently resolve conflicts** by choosing one value over another without surfacing the conflict. Silent conflict resolution is a form of hidden reconciliation.

---

## Section 4 — Multi-Operator Consistency

### 4.1 Concurrent Intervention Visibility

When two operators are acting on the same scope simultaneously, both operators must be aware of the other's activity. The platform does not implement pessimistic locking (no operator can be locked out), but it provides awareness and conflict detection.

**Concurrent intervention visibility rules:**
- When operator A is in an active interaction flow on scope S, the backend must notify any other operator currently viewing scope S that "a modification is in progress" (without revealing what the modification is)
- When operator B submits an action on scope S while operator A has an action pending, B's action preview must include: "Another action on this scope was applied in the last [N] seconds. Your preview reflects the state including that action."
- The "last modified by" attribution is always visible in the override stack and operational timeline

### 4.2 Remote-State Acknowledgment

When a remote operator's action changes the state of a scope the current operator is viewing, the current operator must receive an explicit notification of the change — not just a silent state update.

**Remote-state acknowledgment rules:**
- The update is attributed: "[Operator name] applied an override to [scope] at [time]"
- The change in effective state is highlighted as the result of a remote action (a different visual treatment from a schedule-progression or expiry-driven state change)
- The current operator's in-progress work is evaluated for conflict: "The state has changed. Your in-progress [action] may need to be regenerated."

### 4.3 Synchronization Race Visibility

A synchronization race occurs when an operator initiates an action, the action reaches the backend, and a competing action from another operator arrives at the backend in the same processing window. The last-write-wins rule applies, but the operator whose action was superseded must be notified.

**Synchronization race handling:**
- If operator A's action was superseded by operator B's action in the same processing window, operator A receives: "Your [action] was applied but was immediately superseded by [B's action type] from [operator B]. Current state: [new effective state]."
- This is a one-time notification; it does not block operator A from taking further action
- Both actions appear in the audit log with their exact timestamps and processing sequence

### 4.4 Ownership Transfer Synchronization

When operational ownership of a scope is transferred between operators (during escalation, shift transition, or incident command transfer), this transfer must be fully synchronized — both the transferring and receiving operators must confirm the transfer before it is complete.

**Ownership transfer synchronization rules:**
- Ownership is in PENDING state until both parties confirm (transferring operator: transfer initiated; receiving operator: transfer accepted)
- While in PENDING ownership transfer, the scope displays both operators' names: "[Operator A] → [Operator B] (pending acceptance)"
- If the receiving operator rejects the transfer, it returns to the original owner with an explicit notification
- Ownership transfer is logged with timestamps for both the initiation and acceptance

---

## Section 5 — Failure Modes

### Failure Mode SF-01: Silent Reconciliation

**What it is:** The backend receives a correction to a prior state (a delayed delivery confirmation, a correction to an erroneously reported event) and updates the frontend display without surfacing the correction to the operator. The operator's mental model was formed on the prior state; the correction changes the display without explaining the change.

**Prevention:** All corrections that change displayed values must be labeled as corrections (per Section 3.3). The prior value and the corrected value are shown together briefly before transitioning to the corrected state.

---

### Failure Mode SF-02: Duplicate Event Rendering

**What it is:** The frontend renders the same operational event twice — once when it is received via real-time push, and once when it appears in a subsequent polling response. An override appears twice in the override stack. A timeline event appears twice on the timeline.

**Why it happens:** Dual event delivery paths (push and poll) without deduplication logic.

**Prevention:** All events carry a unique `event_id` (or `sequence_number`). The frontend deduplicates events before rendering. An event that has already been rendered does not produce a second render.

---

### Failure Mode SF-03: Hidden Delay

**What it is:** The frontend receives data with a significant computation delay (per Section 3.3) but presents it as if it were freshly computed. The operator believes the health grade is current when it is actually 4 minutes old.

**Prevention:** All data carries a computation timestamp distinct from the delivery timestamp. Data with significant computation lag (more than the expected update interval for that data type) is rendered with the computation timestamp visible, not the delivery timestamp.

---

### Failure Mode SF-04: Out-of-Order Causality

**What it is:** Events arrive at the frontend in an order that inverts their causal relationship. Event B (the consequence) arrives before event A (the cause). The frontend renders B before A, creating the visual impression that the consequence preceded the cause.

**Prevention:** Per-scope ordering guarantees (Section 3.2). Within a scope, events are delivered in causal order. The frontend applies scope-level sequence numbers to detect and reject out-of-order events.

---

### Failure Mode SF-05: Stale Authority Illusion

**What it is:** The frontend displays a stale state that happens to be identical to the current state — producing the visual appearance of current data when the data has actually not been refreshed. The synchronization watchdog fails to detect the stale state because the values haven't changed.

**Why it happens:** Staleness detection based on value change rather than time since last confirmed update.

**Prevention:** Staleness detection is time-based, not value-based. The synchronization watchdog checks the time since last confirmed data receipt, regardless of whether the data has changed. A surface that displays the same health grade as 5 minutes ago is AGING if it has not received a confirmed update in that time — even if the grade hasn't changed.

---

## Section 6 — Human Factors

### 6.1 Synchronization Trust

Operators develop a model of how current the platform's display is. If the display is usually nearly instantaneous, operators come to rely on it as instantaneous — and are surprised and disoriented when significant latency occurs. If the display makes its freshness explicit, operators calibrate their trust appropriately.

**Design implication:** Freshness labeling trains operator calibration. An operator who regularly sees "synchronized 3 seconds ago" develops an accurate model of the platform's latency. An operator who never sees freshness labels develops an inaccurate model of perfect instantaneity — which fails catastrophically when latency spikes.

### 6.2 Confusion Under Partial Consistency

When some data is current and some is stale — partial synchronization — operators often cannot determine which parts of the display to trust. The inconsistency is more cognitively disorienting than uniform staleness, because it requires the operator to track which components are reliable on a component-by-component basis.

**Design implication:** Partial synchronization must be disclosed at the component level (each component's freshness state is individually indicated), not just at the surface level. An operator who sees "3 of 7 metrics are aging" knows which specific metrics to treat with caution — rather than distrusting the entire surface.

### 6.3 Hidden Delay Frustration

When operators take actions and do not receive timely feedback, they experience frustration — not because the delay is necessarily long, but because the delay is hidden. A 3-second delay that is visible (PENDING state with elapsed time counter) is experienced as "the system is working." A 3-second delay that is hidden (no feedback, no indicator) is experienced as "the system is broken."

**Design implication:** PENDING state must be shown immediately — within one rendering cycle of action initiation. The operator must never be in a state where they have taken an action and have no indication of what is happening. Even if the backend has not yet responded, the frontend confirms: "Received. Processing."

### 6.4 Remote-Intervention Ambiguity

When an operator's display changes because another operator took an action — and this is not clearly attributed — the operator may not understand why the display changed. They may assume a system error, a data anomaly, or their own prior action, when the actual cause is another operator's intervention.

**Design implication:** Remote-operator attribution (Section 4.2) is not just an audit feature — it is a cognitive clarity feature. An operator who sees "[Operator B] applied an override at 14:23" immediately understands the change. An operator who sees the display change silently must investigate — spending cognitive resources on meta-questions rather than operational decisions.

---

## Related Documents

**PRE-NATIVE-FRONTEND-ARCHITECTURE-v1.md** — The authoritative state flow and rendering philosophy that this document's synchronization states implement.

**REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md** — Sync state SS-07 (REPLAY-LOCKED) and the live/replay transition governance.

**FRONTEND-TRUTH-AND-RENDERING-GOVERNANCE-v1.md** — The rendering honesty rules that govern how synchronization states are displayed.

**CANONICAL-UI-STATE-MODEL.md** — The eight UI state types that map to the synchronization states defined here. SS-01 maps to LIVE; SS-04 maps to STALE; SS-05 maps to DEGRADED; SS-07 maps to REPLAY.

**LIVE-UPDATE-BEHAVIOR-SPEC.md** — How updates arriving during various synchronization states are rendered without destroying operator cognition.

---

*End of STATE-SYNCHRONIZATION-AND-CONSISTENCY-v1.md v1.0*
*Authority: SHARED — Agent 1 (PRE/Runtime) + Agent 2 (Backend/Sync) + Agent 3 (UX/Rendering)*
*Synchronization thresholds and update intervals: Agent 1 and Agent 2 define; Agent 3 renders*
*Backend delivery ordering guarantees: Agent 2 implementation authority*
*Synchronization state rendering and disclosure: Agent 3 definition authority*
*Changes require consensus of all three agents.*
