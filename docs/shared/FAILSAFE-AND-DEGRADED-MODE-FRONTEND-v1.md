# ClubHub TV — Failsafe and Degraded-Mode Frontend
# Shared Operational Intelligence Layer — Phase D: Operational Frontend Execution Architecture

**Document type:** Cross-agent architectural governance — frontend behavior under degraded and failure conditions
**Authority:** SHARED DECISION ZONE — Agent 1 (PRE/Runtime) + Agent 2 (Backend/Sync) + Agent 3 (UX/Rendering)
**Audience:** All frontend contributors; platform operations; all agent leads
**Last updated:** 2026-05-25
**Status:** CANONICAL — degraded-mode behavior not conforming to this document is not eligible for deployment
**Phase:** D — Operational Frontend Execution Architecture (cross-agent shared decision zone)

---

## Purpose

This document defines how the ClubHub TV frontend behaves when the platform is degraded — when connections are lost, data is delayed, the PRE is unreachable, or the backend is partially unavailable.

The threat this document addresses: **false confidence under failure.** Degraded conditions are precisely when the interface must be most honest — because degraded conditions are when operators most need accurate information about what they can and cannot trust. A frontend that hides degradation behind a clean appearance gives operators a false sense of normalcy during the moments when they most need to know that something is wrong.

**The governing principle: especially honest when degraded.** The platform's operational trust guarantee does not have a "except when the system is failing" clause. The interface must be honest about its state under all conditions — including and especially failure conditions.

---

## Section 1 — Failsafe Philosophy

### 1.1 Degraded Honesty

Degraded honesty means that the interface honestly represents every degraded condition, without exception. No degraded condition is hidden for aesthetic reasons, to avoid alarming operators, or because the developers believed "it will probably recover soon."

**What degraded honesty requires:**
- Every degraded condition is labeled with what is degraded, since when, and what is being done to recover
- The scope of degradation is precisely described — not "some data unavailable" but "3 screens not reporting: Bar Left, Gaming North, Main Stage"
- The reliability of displayed data in degraded conditions is explicitly communicated — operators must know which values to trust and which to treat with caution
- Recovery is visible — the operator can see that recovery is in progress, not just wait and wonder

**What degraded honesty does not mean:**
- Degraded honesty does not mean alarming operators unnecessarily. Minor degradation (one device temporarily unreachable) is disclosed but not treated as a crisis.
- Degraded honesty does not mean blocking all operations when only some data is unavailable. Operations on healthy scopes continue normally.

### 1.2 Graceful Visibility

"Graceful degradation" in ClubHub TV means graceful visibility of degraded state — not graceful hiding of it. The platform degrades gracefully when:

- Each failure is contained to its scope and does not propagate visual failure to healthy scopes
- The healthy portions of the system remain fully operational and clearly labeled as such
- The degraded portions are clearly labeled as degraded with specific, actionable descriptions
- Recovery paths are visible and accessible

**What graceful visibility explicitly rejects:**
- Clean, healthy-looking displays when data is stale or unavailable
- Generic error states that don't tell the operator what is wrong
- Silent fallbacks that produce wrong data rather than acknowledged-incomplete data

### 1.3 Operational Survivability

The frontend must remain operationally useful under degraded conditions. Operators must be able to:

- See the last confirmed state of any scope (with staleness labeled)
- Take emergency actions on healthy scopes even when some data is unavailable
- Access the replay record (historical data is unaffected by live system degradation, unless the replay infrastructure itself is degraded)
- Navigate the system and understand what is healthy vs. degraded

**What must never fail due to frontend degradation (independent of backend conditions):**
- Emergency activation flow visibility (the flow must be accessible even if confirmation cannot be received)
- The STALE / DEGRADED / DISCONNECTED state badge system (the operator must always be able to see the synchronization state)
- The last-confirmed-state display (even if data is days old in an extreme scenario, it must be visible with accurate timestamps)
- Navigation between workspaces

---

## Section 2 — Degraded States

Six canonical degraded states exist. These correspond to specific failure conditions in the platform's operational infrastructure.

### Degraded State DS-01: Partial Synchronization

**Definition:** The frontend is receiving some but not all expected data within the current update interval. Some scopes are synchronized; others are aging or stale.

**Causes:**
- Network congestion affecting delivery of some event streams
- Some backend service components operating normally; others delayed
- Some device scopes reporting normally; others temporarily unreachable

**Frontend behavior:**
- The top-level synchronization indicator shows the partial state: "Partial synchronization — [N] of [M] data streams current"
- Individual components with aging data display component-level AGING or STALE indicators
- Components with confirmed-current data display normally without degradation indicators
- Operations on confirmed-current scopes proceed normally; operations on degraded scopes carry appropriate warnings

**Recovery:**
- Automatic — the frontend continues attempting to receive data for degraded scopes
- Recovery is per-scope: as each scope returns to synchronization, its component transitions to SYNCHRONIZED state
- No manual operator action required for partial synchronization recovery

---

### Degraded State DS-02: Disconnected Operation

**Definition:** The frontend has completely lost connection to the backend state delivery layer. No new operational data is being received.

**Causes:**
- Complete network failure between frontend and backend
- Backend state delivery service unavailable
- Network partition

**Frontend behavior:**
- STALE state badge with "Disconnected" label on all affected surfaces
- Explicit disconnection message: "Connection lost at [timestamp]. Attempting to reconnect. Last synchronized: [timestamp]."
- All consequential actions blocked with explanation: "Cannot apply — connection lost. Action will be available when reconnected."
- Emergency activation path remains accessible: the emergency activation flow is available with a disclosure: "Connection lost — emergency activation will be applied when connection is restored, or may be applied locally pending confirmation."
- Reconnection attempts displayed with status and attempt count

**Recovery:**
- Automatic reconnection attempts with exponential backoff
- Recovery produces a full reconciliation: the frontend fetches all state changes since the disconnection timestamp and applies them in order
- SYNCHRONIZED state displayed after reconciliation with a summary of what changed during the disconnection period

---

### Degraded State DS-03: Stale Replay

**Definition:** The replay system is available but the corpus has gaps or is unavailable for the period the operator is trying to investigate.

**Causes:**
- Corpus storage unavailable or corrupted for a specific period
- Corpus generation pipeline delayed (recent period not yet indexed)
- PRE version mismatch preventing deterministic replay of a historical period

**Frontend behavior:**
- Replay is available for corpus-covered periods; corpus gaps are explicitly marked in the scrubber and timeline
- Corpus gap disclosure: "Replay unavailable for this period. [Reason if known.] [Available periods: before/after.]"
- The operator is not prevented from navigating around the gap; the gap is clearly bounded
- Near-real-time replay (last few minutes) shows a "pending indexing" disclosure if the corpus is not yet available

**Recovery:**
- Corpus gaps from pipeline delay recover automatically as the pipeline catches up
- The scrubber updates to reflect newly available periods without requiring operator action

---

### Degraded State DS-04: Delayed Event Propagation

**Definition:** The frontend is connected and receiving events, but events are arriving with higher-than-normal latency. Displayed state may be several seconds to minutes behind the actual operational state.

**Causes:**
- Backend processing pipeline under load
- Network congestion (data is arriving, but slowly)
- Event batching at the delivery layer producing larger-than-normal batch delays

**Frontend behavior:**
- Normal LIVE state badge maintained if within the AGING threshold
- After exceeding the AGING threshold: component-level AGING indicators with latency disclosure: "Updates delayed — last confirmed [N]s ago (normally [M]s)"
- After exceeding the STALE threshold: full STALE state
- Delayed event propagation is distinguished from disconnection: the operator can see that data is still arriving, just slowly

**Recovery:**
- Automatic — as propagation latency returns to normal, AGING indicators clear and components return to full AUTHORITATIVE state

---

### Degraded State DS-05: Backend Unavailable

**Definition:** Specific backend services are unavailable, preventing some categories of data or operations from functioning.

**Causes:**
- Specific backend service outage (sponsorship service, delivery log service, health computation service)
- Database connection failure affecting a subset of data types
- Deployment in progress

**Frontend behavior:**
- Affected data types are labeled with the specific service that is unavailable: "Sponsor delivery data unavailable — delivery service unreachable"
- Unaffected data types continue to display normally
- Operations that depend on the unavailable service are disabled with specific explanation: "Sponsorship modification unavailable — delivery service unreachable. Override operations remain available."
- The scope of the unavailability is precisely described — not "some features unavailable" but "these specific operations are affected"

**Recovery:**
- Per-service recovery: as each backend service recovers, its dependent data and operations become available again
- Service recovery events are surfaced to the operator: "Delivery service restored — sponsor data updating"

---

### Degraded State DS-06: PRE Unreachable

**Definition:** The PRE cannot be reached for new resolution queries. Live effective state queries are failing.

**Causes:**
- PRE service unavailable
- PRE in maintenance mode
- Network partition between frontend and PRE service

**Frontend behavior:**
- This is the most severe degraded state — the PRE is the ground truth
- The last confirmed PRE outputs are displayed with STALE state badges and precise "last confirmed" timestamps
- All operations that require PRE evaluation (override creation preview, emergency activation preview) show a clear disclosure: "PRE preview unavailable — [reason]. You may proceed without preview, but effective state cannot be confirmed until PRE connectivity is restored."
- Emergency activation without preview is permitted (emergencies cannot wait for PRE connectivity) with explicit disclosure
- The operator is given a clear status: "Priority Resolution Engine unreachable since [timestamp]. [Attempting to reconnect / [Status].] Last known state: [timestamp]."

**Recovery:**
- Automatic reconnection to PRE
- On reconnection, a full state refresh is performed — the PRE is queried for the current state of all scopes the operator has in view
- SYNCHRONIZED state is displayed after the state refresh, with a summary of any changes that occurred during the PRE unavailability period

---

## Section 3 — Operator Visibility Rules

### 3.1 Degraded-State Disclosure

All degraded states must be disclosed at the appropriate scope level:

**Surface-level disclosure (always):** The top-level synchronization indicator (always visible per CANONICAL-UI-STATE-MODEL.md) shows the aggregate degradation state. If any scope is in DS-01 through DS-06, this indicator reflects the worst current degraded state.

**Workspace-level disclosure (when relevant):** If a degraded state affects the scope currently in view, the workspace-level state badge (DEGRADED, STALE, etc.) is displayed.

**Component-level disclosure (always for affected components):** Every component displaying data from a degraded source carries an individual degradation indicator, regardless of whether the workspace-level badge is also present.

**Disclosure must be specific:** Generic "degraded" labels are non-conforming. Every degradation disclosure must specify:
- What is degraded (which service, which scopes, which data types)
- Since when the degradation began
- What is being done to recover (if applicable)
- What the operator can and cannot do in the degraded state

### 3.2 Confidence Labeling

Under degraded conditions, displayed values carry confidence labels that communicate how reliable they are:

| Data condition | Confidence label |
|---|---|
| Confirmed within expected interval | No label (default — confirmed) |
| AGING (1–2× expected interval) | "Updated [N]s ago" (subtle label) |
| STALE (>2× expected interval) | "Last confirmed: [timestamp]" (prominent label) |
| Degraded source (partial data) | "Partial data — [N] of [M] sources reporting" |
| PRE unreachable (last known) | "Last PRE confirmation: [timestamp]" |

### 3.3 Uncertainty Rendering

Under degraded conditions, values that cannot be confirmed must be rendered with uncertainty indicators that make their uncertainty visually apparent:

- Values from degraded sources use a reduced-confidence visual treatment (not the same rendering as confirmed values)
- Aggregate metrics computed from partial data show the partial basis: "Fleet health: B (37 of 42 venues reporting)"
- Estimates or projections must be labeled as such: "Projected SOV: 87% (based on last confirmed delivery data as of [timestamp])"

**There is no "good enough" threshold below which uncertainty labeling is waived.** Even minor uncertainty is disclosed.

### 3.4 Partial-Data Legality Under Degradation

Displaying partial data under degraded conditions is not only legal — it is required. The alternative (showing nothing until all data is available) is operationally worse than showing partial data with clear disclosure.

**Partial data legality rules:**
- Partial data is displayed; missing items are shown as explicitly absent (labeled gaps, not empty space)
- The count of available items vs. total expected items is always shown: "14 of 17 screens reporting"
- Operations affecting all items carry warnings: "3 screens are not reporting. This action will apply to reporting screens immediately and to unreachable screens when they reconnect."
- Aggregates over partial data must use the partial data count as denominator, not the full count: "89% SOV" should be "89% SOV (of 14 reporting screens)"

---

## Section 4 — Recovery Governance

### 4.1 Reconnection Visibility

Recovery from any degraded state is a visible process. The operator must be able to see that recovery is happening, how far it has progressed, and when it is complete.

**Reconnection display requirements:**
- Active reconnection attempt: "Reconnecting... (attempt N)" — displayed in the synchronization state area
- Reconnection success: brief SYNCHRONIZED state badge before transitioning to LIVE
- Reconnection failure: "Unable to reconnect after [N] attempts. [Manual action available / Continuing to retry]"
- Recovery duration: for reconnections that take significant time (>10 seconds), elapsed time is displayed

### 4.2 State Revalidation

On recovery from DS-02 (Disconnected) or DS-06 (PRE Unreachable), the frontend must revalidate all displayed state:

**Revalidation process:**
1. Connection confirmed
2. State refresh requested for all scopes in view
3. The frontend enters a brief "revalidating" state — STALE badge persists until revalidation is complete
4. PRE outputs received and applied
5. SYNCHRONIZED state displayed with change summary
6. Transition to LIVE state

**Revalidation must not be skipped.** The frontend must not transition directly from DISCONNECTED to LIVE without a confirmed state refresh. The STALE badge persists through the revalidation period to prevent operators from trusting pre-refresh state.

### 4.3 Replay Reconciliation

On recovery from DS-03 (Stale Replay) or on return from replay mode during which a degradation occurred:

- The corpus availability is re-checked and the scrubber is updated to reflect newly available periods
- If the operator was viewing a period during a corpus gap that has since been indexed, they are offered the option to re-investigate with full data: "Corpus data is now available for this period. Regenerate replay?"

### 4.4 Stale-State Cleanup

When recovery from any degraded state is complete:

- All STALE, AGING, and DEGRADED badges are replaced with SYNCHRONIZED (briefly) then LIVE
- Stale value rendering (reduced-confidence visual treatment) is restored to normal
- The change summary (what changed during the degraded period) is displayed

**Stale-state cleanup must be complete.** No components may remain in STALE or DEGRADED rendering state after the scope has fully recovered. The cleanup must sweep all affected components, not just the primary surface.

---

## Section 5 — Failure Modes

### Failure Mode DF-01: False Healthy State

**What it is:** The frontend displays a healthy-looking surface despite operating on degraded, stale, or partial data. An operator who reads the display believes the operational state is healthy when it may not be.

**Why it happens:** Stale state indicators that are subtle, easily dismissed, or positioned outside the operator's primary attention zone. DEGRADED or STALE badges that render in low-contrast or small size, failing to interrupt the otherwise-normal appearance of the surface.

**Prevention:** Staleness and degradation indicators must be visually dominant when data is not confirmed-current. STALE state is not a subtle modifier — it is a primary state that changes the fundamental visual character of the surface. A surface in STALE state must look different from a LIVE surface in a way that is impossible to overlook.

---

### Failure Mode DF-02: Hidden Degradation

**What it is:** A backend service fails silently — its data stops updating, but the frontend displays the last received data without any degradation indicator, because the staleness threshold has not yet been triggered (the service failed 30 seconds ago and the threshold is 60 seconds).

**Prevention:** Proactive degradation detection beyond staleness thresholds. The backend should push EC-05 Degradation events when a service becomes unavailable, not wait for the frontend to detect staleness. The combination of push-based degradation notification and pull-based staleness detection provides defense in depth.

---

### Failure Mode DF-03: Silent Recovery Mutation

**What it is:** On recovery from a disconnection, the frontend silently applies all accumulated state changes without surfacing a change summary. The operator's display changes significantly — new overrides, changed health grades, an active incident — without any notification that things changed during the disconnection.

**Prevention:** Recovery reconciliation summary (Section 4.2). On every recovery, the operator receives a change summary before the updated state is displayed. The change summary is not optional — even "no notable changes" is surfaced briefly to confirm that the reconciliation was completed.

---

### Failure Mode DF-04: Stale-State Persistence

**What it is:** After recovery, some components remain in STALE rendering state because the cleanup sweep was incomplete. The operator sees a mostly-recovered surface with one or two components still showing STALE badges — and cannot determine whether those components are actually still stale or whether the cleanup failed.

**Prevention:** Stale-state cleanup completeness requirement (Section 4.4). The cleanup process is complete-or-nothing: all affected components are cleaned up atomically, or none are (and the recovery is considered incomplete until all can be cleaned up).

---

### Failure Mode DF-05: False Synchronization Confidence

**What it is:** The SYNCHRONIZED badge appears after a partial recovery — the connection is restored and some data is confirmed-current, but other data is still aging or stale. The operator sees SYNCHRONIZED and believes the full surface is current.

**Prevention:** SYNCHRONIZED state requires all in-view components to be at confirmed-current status, not just the connection being restored. A surface where some components are AGING and others are confirmed-current shows PARTIALLY-SYNCHRONIZED, not SYNCHRONIZED. The full SYNCHRONIZED badge is reserved for complete surface-level confirmation.

---

## Section 6 — Human Factors

### 6.1 Degraded Honesty as Trust Preservation

The most counter-intuitive aspect of degraded honesty is that it preserves trust better than graceful hiding. An operator who sees "3 screens unreachable" and watches those screens recover, with clear status throughout, has a trust-confirming experience with the platform: "the platform told me something was wrong, and I watched it fix itself." An operator who never sees the degradation but later discovers that a sponsor gap occurred during an "invisible" degradation period has a trust-destroying experience: "the platform hid something from me."

**Design implication:** Degradation disclosure is not just technically correct — it is trust-building. Operators who regularly see honest degradation labels develop a calibrated understanding of the platform's reliability envelope. They learn what normal looks like, what degraded looks like, and how quickly the platform recovers. This calibration is operationally valuable.

### 6.2 Alarm Fatigue Under Degradation

Frequent, minor degradation that surfaces with the same visual treatment as major degradation will produce alarm fatigue. Operators will begin ignoring DEGRADED states because "it's always slightly degraded about something."

**Design implication:** The visual severity of degradation disclosure must be proportional to the operational significance of the degradation. DS-01 (partial synchronization — 1 of 42 venues has an aging metric) should look different from DS-06 (PRE unreachable). The former is a mild advisory; the latter is a critical condition. The disclosure system must communicate this difference, not apply uniform treatment to all degradation.

### 6.3 Operator Decision Confidence Under Uncertainty

Operators who cannot determine what is and is not reliable will either: (a) refuse to take any action until full reliability is restored, or (b) take action anyway without adjusting their confidence level. Both are wrong — the correct behavior is to take action only on confirmed-reliable data, with appropriate confidence adjustment for data of known reliability.

**Design implication:** The partial-data legality rules (Section 3.4) and confidence labeling (Section 3.2) enable the correct behavior by making data reliability explicit and per-component. An operator can look at the display and see: "these 39 venues are confirmed-current; these 3 are not reporting; I will act on the 39 and flag the 3 for follow-up."

### 6.4 Recovery Anticipation

Operators who have been working in a degraded state develop expectations about when recovery will occur. If recovery is visible (reconnection attempts, status messages), they can calibrate when to expect full functionality. If recovery is invisible (the system is working on it somewhere but there's no indication), they experience increasing anxiety as time passes without knowing whether recovery is happening.

**Design implication:** Recovery visibility is as important as degradation visibility. The operator who entered a degraded state 2 minutes ago should be able to see: "reconnection in progress — attempt 4 of 10 — last attempt failed at 14:23:15." This is not noise — it is operational context that allows the operator to calibrate their response: wait, escalate, or prepare for extended degradation.

---

## Related Documents

**PRE-NATIVE-FRONTEND-ARCHITECTURE-v1.md** — The upstream architecture that defines the authoritative state flow this document's failure modes corrupt.

**STATE-SYNCHRONIZATION-AND-CONSISTENCY-v1.md** — The synchronization states (SS-01 through SS-07) that correspond to the degraded states defined here.

**OPERATIONAL-FRONTEND-RUNTIME-v1.md** — The runtime execution model that continues operating during degraded conditions.

**EVENT-AND-STATE-ORCHESTRATION-v1.md** — EC-05 Degradation events that propagate degraded state through the orchestration layer.

**FRONTEND-TRUTH-AND-RENDERING-GOVERNANCE-v1.md** — The rendering honesty principles that this document applies specifically to degraded conditions.

**ENTROPY-OBSERVABILITY-UX-v1.md** — Platform entropy signals often indicate approaching degradation. Entropy observability is the early warning system; this document governs the active response.

---

*End of FAILSAFE-AND-DEGRADED-MODE-FRONTEND-v1.md v1.0*
*Authority: SHARED — Agent 1 (PRE/Runtime) + Agent 2 (Backend/Sync) + Agent 3 (UX/Rendering)*
*Degradation event generation and recovery infrastructure: Agent 1 and Agent 2 definition authority*
*Degradation disclosure rendering and operator visibility: Agent 3 definition authority*
*Changes to any section require consensus of all three agents.*
