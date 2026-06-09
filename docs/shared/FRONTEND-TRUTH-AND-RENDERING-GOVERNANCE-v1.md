# ClubHub TV — Frontend Truth and Rendering Governance
# Shared Operational Intelligence Layer — Phase B: PRE-Native Frontend Architecture

**Document type:** Cross-agent architectural governance — rendering honesty and anti-illusion rules
**Authority:** SHARED DECISION ZONE — Agent 2 (Backend/Data Contracts) + Agent 3 (UX/Rendering)
**Audience:** All frontend contributors; Agent 2 (data delivery); all platform contributors
**Last updated:** 2026-05-25
**Status:** CANONICAL — rendering behavior not conforming to this document is not eligible for deployment
**Phase:** B — PRE-Native Frontend Architecture (cross-agent shared decision zone)

---

## Purpose

This document defines the rendering honesty rules for ClubHub TV — what the frontend may show, what it must show, what it must never hide, and what it must actively disclose even when disclosure is aesthetically inconvenient.

The threat this document addresses: **rendering as deception.** Not deliberate deception — unintentional deception that emerges from the accumulation of "reasonable" rendering choices: showing a loading skeleton that implies content is arriving when the data may not be available; displaying a rounded figure that implies precision the data doesn't have; using a confident visual treatment for uncertain data because "it looks cleaner"; hiding an error behind a retry that "usually works."

Each choice, in isolation, is defensible. Together they produce an interface that operators cannot fully trust — because they have learned, from experience, that the interface sometimes misrepresents the operational state in small ways. Small misrepresentations undermine trust in all representations.

**The governing principle: rendering as operational disclosure.** Every rendered element is a disclosure to the operator about the operational state. The interface exists to enable accurate operational understanding. Any rendered element that creates a false or uncertain impression fails this purpose.

---

## Section 1 — Rendering Philosophy

### 1.1 Rendering as Operational Disclosure

The interface is not an aesthetic artifact. It is an operational disclosure system. Every element it displays communicates something to the operator about the operational state of the platform.

This framing has a specific implication: rendering decisions are disclosure decisions. Choosing to show or hide a data element, choosing a visual treatment, choosing how to handle an uncertain state — these are decisions about what operational information the operator receives. They are not neutral aesthetic choices.

**Rendering as operational disclosure requires:**
- Every element on a surface has a defined operational purpose — what it discloses
- Rendering decisions are evaluated against their disclosure quality, not their aesthetic quality
- Elements that create false impressions — regardless of how clean they look — are rendering failures

### 1.2 Visibility Over Polish

When a choice must be made between visual polish and operational visibility, operational visibility wins. This is an unconditional rule.

**What this means in practice:**
- A stale-state indicator that disrupts the visual hierarchy is correct — the visual hierarchy should be disrupted when the data is stale
- A loading state that shows partial data with explicit uncertainty labels is better than a polished skeleton screen that implies imminent complete data
- An error state that is ugly but informative is better than a clean state that hides the error
- A dense, information-rich display that serves operational needs is better than a sparse, aesthetically superior display that omits operationally significant data

### 1.3 Anti-Illusion Rendering

Anti-illusion rendering is the active practice of identifying and eliminating rendering patterns that create false impressions — about data currency, data completeness, action completion, system reliability, or operational state.

**Common rendering illusions to prevent:**
- **The responsiveness illusion:** Immediately showing the result of an action before it is confirmed by the backend, creating the impression that the action completed instantly
- **The completeness illusion:** Displaying data that covers 80% of the operational scope and implying it covers 100%
- **The freshness illusion:** Displaying a value that was confirmed 45 seconds ago with the same visual treatment as a value confirmed 2 seconds ago
- **The stability illusion:** Using smooth transitions to hide rapid operational state changes that the operator should see as rapid
- **The precision illusion:** Displaying a computed figure with more decimal places or apparent precision than the underlying data warrants

---

## Section 2 — Rendering Legality

### 2.1 Allowed Abstraction

The following abstractions are permitted because they reduce cognitive load without reducing operational accuracy:

**Permitted abstractions:**
- **Aggregation with access:** Displaying a health grade (aggregate of entropy metrics) is permitted because it summarizes many metrics into a single actionable indicator — provided the underlying metrics are accessible through the abstraction
- **Progressive disclosure:** Showing EH-1 summary explanation before EH-3 forensic explanation is permitted because it reduces cognitive load for routine monitoring — provided deeper levels are accessible
- **Temporal aggregation:** Displaying "3 overrides active" instead of listing all three in primary view is permitted — provided the full list is accessible within one interaction
- **Conditional detail:** Hiding secondary information until it becomes relevant (e.g., hiding override expiry countdown until the override is within 30 minutes of expiry) is permitted — provided the operator can access the hidden information on demand
- **Relative timestamps:** Displaying "4 minutes ago" for recent events is permitted — provided the absolute timestamp is accessible within one interaction

**Abstraction validity test:** For any abstraction, ask: "Can an operator who sees only the abstracted view make the same operational decision as an operator who sees the full detail?" If yes, the abstraction preserves operational accuracy. If no, the abstraction is prohibited.

### 2.2 Forbidden Abstraction

The following abstractions are prohibited because they reduce operational accuracy:

**Forbidden abstractions:**
- **Aggregating without surfacing the worst condition:** A fleet health grade that shows "B" without surfacing the one venue at grade F hides an operationally critical condition
- **Summarizing with false completeness:** Displaying "5 overrides applied today" without disclosing that one was at LEVEL_0 omits the most operationally significant item
- **Smoothing rapid changes:** Using animation or transition timing to hide a state that changed and changed back quickly — the operator may have needed to know about the transient state
- **Omitting negative data:** Not showing a sponsor delivery gap because "it's within acceptable range" — the operator should see the gap and make the judgment about acceptability
- **Confidence-borrowing:** Displaying uncertain data with the same visual treatment as confirmed data — even if the uncertain data is "usually right"

### 2.3 Visibility Requirements

The following operational facts must always be visible (or immediately accessible via one interaction) regardless of information density settings, role configuration, or aesthetic considerations:

| Operational fact | Visibility requirement |
|---|---|
| Current state type (LIVE/REPLAY/STALE/etc.) | Always visible — non-dismissible badge |
| Active emergency activations on current scope | Always visible — persistent banner |
| STALE state when active | Always visible — non-dismissible indicator |
| Active incident on current scope | Always visible — persistent indicator |
| Synchronization state | Accessible within one interaction |
| Data freshness / last confirmed timestamp | Accessible within one interaction |
| Attribution (who took the last consequential action on this scope) | Accessible within one interaction |
| Resolution authority (what source is determining effective state) | Accessible within one interaction |

### 2.4 Uncertainty Disclosure

When data is uncertain — partially confirmed, estimated, approximated, or delayed — this uncertainty must be disclosed at the point of use.

**Uncertainty disclosure rules:**
- Uncertain data is never displayed with the same visual treatment as confirmed data
- The specific type of uncertainty is disclosed: AGING (time-based uncertainty), DEGRADED (source-based uncertainty), APPROXIMATE (precision-based uncertainty), PENDING (confirmation-based uncertainty)
- When an operator is about to take action based on uncertain data, the uncertainty is disclosed in the action confirmation, not only in the data display: "This action is based on data that has not been updated in 45 seconds. Confirm to proceed."
- Uncertainty indicators do not disappear until the underlying uncertainty is resolved — not after a timeout, not when the operator interacts with the surface

### 2.5 Degraded Rendering Rules

When the platform is operating in degraded mode — some data unavailable, some scopes unreachable, some computations running at reduced confidence — the interface must show degraded state honestly, not gracefully hide it.

**Degraded rendering requirements:**
- The DEGRADED badge (SB-04) is displayed with a specific description
- Degraded components are individually labeled — "3 screens not reporting" not just "some data unavailable"
- Fully functional components are shown normally; degraded components are shown with degradation labels
- The "total count" of any aggregate must include the degraded items in the total with a disclosure: "42 venues (37 healthy, 2 advisory, 3 not reporting)"
- Operators are not prevented from taking actions on healthy scopes just because degraded scopes exist — but actions affecting degraded scopes carry appropriate warnings

---

## Section 3 — Client-Side State Rules

### 3.1 Temporary Local State

Some frontend state is legitimately local — display-layer state that does not represent operational facts. This state may be maintained client-side without disclosure.

**Legitimately local state:**
- UI state: scroll position, expanded/collapsed panels, selected filters, workspace layout preferences
- Navigation state: current breadcrumb path, recently viewed scopes
- Interaction flow state: which step the operator is currently on in an interaction flow

**Explicitly not local state (must come from backend/PRE):**
- Effective content for any screen
- Override stack composition
- Health grades
- Sponsor delivery figures
- Incident status

### 3.2 Pending-Action Rendering

Between the moment an operator initiates an action and the moment the backend confirms or rejects it, the action is in PENDING state. Pending-action rendering governs what the operator sees during this period.

**Pending-action rendering rules:**
- The action is displayed in PENDING state (SB-08) immediately — within one rendering cycle of initiation
- The current confirmed state continues to be displayed as the authoritative state; the pending action is displayed alongside it as "being applied"
- The distinction between "current confirmed state" and "pending target state" must be visually clear: the operator must be able to see both what is currently true and what they have requested
- If the backend confirms the action, the display transitions to the new confirmed state with SYNCHRONIZED feedback
- If the backend rejects the action, the PENDING state clears and the prior confirmed state continues with an explicit rejection notification and reason

**Optimistic rendering is prohibited.** The interface does not display the pending target state as if it were the current state. The operator must not be able to confuse "what I've requested" with "what is currently true."

### 3.3 Rollback Rendering

When an operator initiates a rollback (reverting a prior action), the rollback goes through the same PENDING state as any other action. The display does not immediately show the pre-action state.

**Rollback rendering rules:**
- Rollback is PENDING until the backend confirms the rollback has been applied
- The display during PENDING rollback shows: current state + pending rollback target state
- The operator can see: "Current: [state after original action]. Rollback will restore: [state before original action]. Applying..."
- On rollback confirmation, the display transitions to the restored state with SYNCHRONIZED feedback

### 3.4 Unsynchronized Interaction Visibility

When an operator has taken an action and the confirmation has not yet arrived, other operators viewing the same scope must be informed.

**Unsynchronized interaction visibility rules:**
- The scope displays an indication that a modification is pending: "[Operator] is making changes to this scope"
- This indication is visible to other operators who have the scope in view
- The indication clears when the action is confirmed or rejected
- Other operators are not blocked from viewing the scope, but they are informed that the displayed state may be about to change

---

## Section 4 — Performance vs. Honesty

### 4.1 What May Be Optimized

The following rendering behaviors may be optimized for performance without compromising operational honesty:

- **Update batching:** Grouping multiple simultaneous value changes into a single render update — permitted, provided the batch delay is within the defined batch windows (per LIVE-UPDATE-BEHAVIOR-SPEC.md) and does not cause a surface to display a STALE state that should be displaying LIVE
- **Progressive loading:** Loading and rendering high-priority data (effective state, override stack) before lower-priority data (health metrics, entropy details) — permitted, provided the loading state of each component is disclosed
- **Lazy detail loading:** Not loading EH-3 forensic explanation until the operator requests it — permitted, because the operator's access to detailed explanation is preserved even if it is not pre-loaded
- **View virtualization:** Not rendering off-screen fleet items until the operator scrolls to them — permitted, provided the count of items (including off-screen) is displayed
- **Caching:** Caching PRE output within defined freshness thresholds — permitted, provided caching does not produce silent stale state (AGING/STALE labels must still apply when thresholds are exceeded)

### 4.2 What Must Never Be Hidden

The following may not be hidden for any performance, aesthetic, or "simplicity" reason:

- Active emergency activations on any displayed scope
- STALE state when data has exceeded the staleness threshold
- Active incidents affecting the operator's current scope
- Synchronization loss (DISCONNECTED or STALE state)
- Failed actions — the operator must always receive explicit failure notification
- Corpus gaps in replay — periods where replay is unavailable must be labeled, not silently skipped

### 4.3 Rendering Latency Disclosure

When the platform's rendering latency is significantly higher than normal (e.g., under heavy load, during deployment, after a significant event), this must be disclosed rather than hidden behind loading animations.

**Rendering latency disclosure rules:**
- If the time from data receipt to data display exceeds the defined rendering latency target (typically 200ms), the excess must be disclosed if it exceeds 1 second: "Display updating — processing large state change"
- If the platform is under load that is causing data delivery delays, this is disclosed at the surface level: "Updates may be delayed — platform under heavy load"
- Loading animations must not be used to hide rendering delays longer than the expected loading time — after the expected loading time has elapsed, the display must show an explicit "taking longer than expected" disclosure

### 4.4 Partial-Data Legality

Displaying partial data — data for some scopes, some metrics, or some time periods — is legal when full data is unavailable, provided:

- The partial data is labeled as partial: "Showing 14 of 17 screens (3 not reporting)"
- The missing items are represented as absent (labeled gaps), not as zeros, averages, or omissions
- The operator cannot accidentally treat the partial data as complete
- Operations that would affect all items carry warnings about the missing items

**What is not legal:**
- Displaying partial data with the same completeness visual treatment as full data
- Omitting items from aggregates without disclosing the omission
- Using partial data to compute aggregate metrics (e.g., health grades, average SOV) without disclosing that the aggregate is based on partial data

---

## Section 5 — Failure Modes

### Failure Mode FT-01: Fake Responsiveness

**What it is:** The interface immediately shows the successful result of an action — the override appears in the stack, the health grade improves, the schedule change is applied — before the backend has confirmed the action. The operator believes their action succeeded because the display changed. The backend may later reject or timeout the action, reverting the display — which the operator experiences as the interface "un-doing" their action.

**Why it happens:** Optimistic UI patterns designed to reduce perceived latency, adapted from consumer software where temporary inconsistency is acceptable.

**Prevention:** Pending-action rendering (Section 3.2) is mandatory. The action is always shown as PENDING until backend confirmation. The display never optimistically shows the post-action state as confirmed.

---

### Failure Mode FT-02: Hidden Loading Deception

**What it is:** A skeleton screen, spinner, or loading state is displayed that implies data is being loaded and will arrive shortly — when in fact the data may not be available (connectivity failure, service outage) or may take much longer than the loading state implies.

**Prevention:** Loading states have defined timeouts. After the timeout:
- If data is arriving but slowly: "Taking longer than expected. Still loading..."
- If no data signal has been received: "Unable to load. [Reason if known]. [Retry option]."

Loading states do not persist indefinitely while implying imminent arrival.

---

### Failure Mode FT-03: Stale Optimistic Rendering

**What it is:** The cache serves a prior PRE output as the current state because the cache has not yet expired, while the actual current PRE output would show a different state. The displayed state is "technically within the freshness threshold" but is actually stale in the meaningful sense — the operational reality has changed and the operator is seeing an old picture.

**Prevention:** Freshness thresholds are set conservatively, based on the operational significance of the data type — not on the technical update frequency. For high-stakes data (emergency status, override stack), the freshness threshold is aggressive. For lower-stakes data (historical trend metrics), it can be relaxed. The threshold calibration is Agent 1 and Agent 2 responsibility; the disclosure is Agent 3 responsibility.

---

### Failure Mode FT-04: Silent Retry Behavior

**What it is:** An action fails, is automatically retried, and the operator is never informed of the failure or the retry. The action eventually succeeds. The operator has no record of the failure. If the action is not idempotent, it may have been applied multiple times. The audit log shows the retry timestamp, not the original initiation timestamp — the operator cannot reconcile their memory of when they took the action with the audit record.

**Prevention:** Retry disclosure (per STATE-SYNCHRONIZATION-AND-CONSISTENCY-v1.md Section 3.4). All retries are disclosed. The PENDING state shows retry count. The audit log records both the initiation timestamp and the final confirmation timestamp, with the retry count.

---

### Failure Mode FT-05: Local-State Illusion

**What it is:** The frontend's local state — which exists for UI performance and interaction flow continuity — diverges from the backend state and the local state "wins" in the rendering. The operator sees a display that reflects the local state rather than the authoritative backend state. This can happen when a local state update and a backend state update conflict, and the conflict resolution favors local state.

**Prevention:** Backend-confirmed state always wins over local state in the rendering of operational facts (Section 3.1 — local state is legitimately local only for display-layer state, not for operational facts). Conflict resolution between local and backend state for operational facts is: backend wins, always.

---

## Section 6 — Human Factors

### 6.1 Perceived Honesty

Operators develop a perception of the interface's honesty through accumulated experience. An interface that has occasionally shown false states, hidden errors, or implied precision it didn't have is perceived as less honest — even after the specific issues are fixed — because the operator has calibrated their trust model to include the possibility of deception.

**Design implication:** Perceived honesty is a long-term asset built through consistent honest rendering. A single instance of fake responsiveness, hidden loading deception, or silent retry behavior can undermine perceived honesty for weeks — because the operator who experienced it cannot know whether it has been fixed. The investment in honest rendering is an investment in long-term trust maintenance.

### 6.2 Trust Under Latency

Operators who understand why there is latency — "I can see it's processing, retry 2 of 3" — tolerate latency significantly better than operators who see unexplained delays. The former experience the latency as a system behavior they understand; the latter experience it as a system behavior they cannot explain, which triggers uncertainty and frustration.

**Design implication:** Visible processing state (PENDING with elapsed time, retry disclosure, load indication with timeout) is not just a UX courtesy — it is a trust preservation tool that reduces the operational stress of normal latency.

### 6.3 Visible Uncertainty Tolerance

Operators can tolerate uncertainty when it is visible and labeled. An operator who sees "health grade: B (updated 52 seconds ago, next update in 8 seconds)" is in a fundamentally different position from an operator who sees "health grade: B" with no freshness information. The former knows their uncertainty; the latter does not know that there is any. The former can calibrate their confidence; the latter cannot.

**Counter-intuitively:** visible uncertainty disclosures — AGING labels, freshness timestamps, confidence qualifiers — increase operator confidence in the interface overall, because they demonstrate that the interface is honest about the limits of its knowledge. An interface that is honest about uncertainty is more trustworthy than one that presents uncertain data as certain.

### 6.4 Frustration vs. Deception Tradeoffs

There is a design temptation to choose deception over frustration: hide the error rather than show an ugly error message; show optimistic state rather than a loading spinner; smooth over the rapid state change rather than show it. These choices trade short-term frustration for long-term trust damage.

**Guiding principle:** Operators can recover from frustration. They cannot recover from the discovery that the interface deceived them. Short-term friction — the STALE indicator that interrupts their flow, the PENDING state that makes them wait for confirmation, the uncertainty label that adds cognitive load — is operationally honest and operationally safe. The alternative is operationally deceptive and operationally dangerous.

---

## Related Documents

**PRE-NATIVE-FRONTEND-ARCHITECTURE-v1.md** — The upstream architecture that defines what the frontend must render honestly. This document defines how it renders honestly.

**STATE-SYNCHRONIZATION-AND-CONSISTENCY-v1.md** — The synchronization states that govern uncertainty disclosure and staleness rendering.

**REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md** — Rendering honesty in the replay context — approximation disclosure and confidence labeling.

**COMPONENT-CONSTITUTION-v1.md** — Component invariants CI-01 through CI-05 implement the rendering legality rules in Section 2 of this document.

**CANONICAL-UI-STATE-MODEL.md** — The state types that this document's rendering rules apply to. State type rendering requirements are defined there; rendering honesty rules are defined here.

**UX-CONSTITUTIONAL-RESILIENCE-v1.md** — The six non-negotiable UX invariants that this document operationalizes in the rendering context.

---

*End of FRONTEND-TRUTH-AND-RENDERING-GOVERNANCE-v1.md v1.0*
*Authority: SHARED — Agent 2 (Backend/Data Contracts) + Agent 3 (UX/Rendering)*
*Data contract specifications that determine what is "confirmed" vs. "pending": Agent 2 definition authority*
*Rendering honesty rules and anti-illusion rendering: Agent 3 definition authority*
*Changes require consensus of Agent 2 and Agent 3; Agent 1 consulted on PRE-related honesty requirements.*
