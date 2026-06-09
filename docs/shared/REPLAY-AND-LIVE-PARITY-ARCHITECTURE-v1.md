# ClubHub TV — Replay and Live Parity Architecture
# Shared Operational Intelligence Layer — Phase B: PRE-Native Frontend Architecture

**Document type:** Cross-agent architectural governance — replay integrity and live/replay rendering parity
**Authority:** SHARED DECISION ZONE — Agent 1 (PRE/Replay Engine) + Agent 3 (UX/Rendering)
**Audience:** All frontend contributors; Agent 1 (replay API); Agent 2 (corpus and delivery log)
**Last updated:** 2026-05-25
**Status:** CANONICAL — replay behavior not conforming to this document is not eligible for deployment
**Phase:** B — PRE-Native Frontend Architecture (cross-agent shared decision zone)

---

## Purpose

This document defines the architectural guarantee that ClubHub TV replay remains operationally trustworthy — and that live and replay rendering are sufficiently consistent that an operator who investigates a past event through replay reaches the same operational conclusions they would have reached watching the event live.

The threat this document addresses: **replay as unreliable witness.** Replay is only operationally valuable if operators trust that it accurately represents what happened. If replay approximates, reconstructs from logs, or produces outputs that differ from what the live surface showed at the same moment, it becomes a disputed witness rather than an authoritative record. Operators cannot use disputed witnesses to build operational literacy, resolve sponsor disputes, or investigate incidents with confidence.

Replay parity failure is insidious because it is invisible. An operator who sees different information in replay than was displayed live does not know which to trust — or may not even know they differ. The divergence is silent.

**The governing principle: replay is operational evidence.** Evidence must be accurate, consistent, and verifiable. Replay achieves this through deterministic PRE evaluation — the same inputs at the same moment always produce the same outputs. Any departure from this determinism corrupts the evidentiary value of replay.

---

## Section 1 — Replay Philosophy

### 1.1 Replay as Operational Evidence

Replay serves three distinct operational functions, each requiring full evidentiary quality:

**1. Incident investigation** — Replay is used to reconstruct what happened during an incident, determine causality, and identify what could have been done differently. For this purpose, replay must be an accurate record of what the PRE resolved, not an approximation.

**2. Operator training** — Replay is used to show operators how the platform behaved in real scenarios, building operational literacy. For this purpose, replay must show exactly what experienced operators saw — not a simplified or reconstructed version.

**3. Sponsor compliance** — Replay is used to verify that sponsored content was delivered as contracted. For this purpose, replay must be the definitive record of what was delivered — not a log summary that could be disputed.

Each of these purposes requires the same foundation: replay is the PRE's deterministic output for historical system states, and nothing else.

### 1.2 Reconstructibility as Trust

The trust value of replay comes from its reconstructibility — the property that any operator, at any time, querying the PRE with the same historical system state, will get the same output. Reconstructibility means:

- The historical system state (override stack, schedule state, device states at a specific moment) is preserved completely in the corpus
- The PRE's evaluation logic is deterministic — it does not use random values, current time, or external state
- The PRE's version at the time of the original resolution is recorded — if the PRE logic has been updated since, replay uses the original version to preserve the original resolution behavior

**Agent 1 implementation requirement:** The replay corpus must store the complete system state at each recorded moment — not just the output of the resolution, but the full input state. This enables reconstruction verification: any time a replay output is questioned, it can be verified by rerunning the PRE with the stored input state.

### 1.3 Temporal Integrity Preservation

The replay record must preserve the exact temporal properties of the original operation:
- Timestamps are the PRE's operational clock timestamps, not approximations
- The sequence of events within a recorded period is exactly as it occurred
- Gaps in coverage (periods where no corpus data exists) are explicitly represented as gaps, not as periods where "nothing happened"

---

## Section 2 — Live / Replay Parity Rules

### 2.1 Rendering Parity

Rendering parity means that a live view and a replay view of the same screen at the same moment produce the same rendered output. This is the fundamental guarantee that makes replay useful.

**Rendering parity requirements:**
- The effective state panel shows the same effective content in live view and replay view
- The override stack shows the same overrides in the same order with the same priority levels
- The health grade shows the same grade (computed from the same entropy inputs)
- The resolution level shows the same level with the same canonical label
- The explanation (reason trace) shows the same resolution path with the same causal attribution

**The only permitted rendering differences between live and replay are:**
- The state badge (LIVE vs. REPLAY)
- The live update feed (live updates continue in live view; replay view is static at the selected moment)
- The action affordances (some actions are available in live view but disabled in replay)
- The temporal context header (current time in live view; selected historical moment in replay view)

Everything else must be identical. A component that renders differently in live vs. replay — without one of the above permitted differences as justification — is a parity violation.

### 2.2 Interaction Parity

Interaction parity means that the available interactions in replay view are consistent with the interactions in live view, with the following defined exceptions.

**Interactions available in both live and replay:**
- Viewing effective state and resolution path
- Navigating the override stack
- Viewing sponsor delivery figures
- Viewing health grades and entropy indicators
- Accessing explanation surfaces (reason trace, suppression tree)
- Timeline navigation within the available corpus

**Interactions available only in live view:**
- Override creation, modification, or cancellation
- Emergency activation or deactivation
- Incident declaration
- Sponsor modification
- Any action that affects live operational state

**Interactions available only in replay view:**
- Timeline scrubbing (navigating to historical moments)
- Counterfactual simulation (from replay state)
- Replay-linked annotation

**Interaction parity violation:** Any interaction that is available in one mode but not the other, for reasons other than the above-defined exceptions, is a parity violation. For example: a surface that allows filtering the override stack in live view but not in replay view has violated interaction parity.

### 2.3 Explanation Parity

The explanation system (from EXPLAINABILITY-RENDERING-SYSTEM-v1.md) must produce identical explanations for the same operational moment in live and replay contexts.

**Explanation parity requirements:**
- The reason trace for a specific screen at a specific moment is identical whether accessed from the live view at that moment or from the replay view at the same moment
- The suppression tree for a specific override at a specific moment is identical in both contexts
- The EH-1 through EH-4 explanation levels are all available in replay (operators should be able to access forensic-level explanation in replay — that is where forensic investigation happens)

**What constitutes an explanation parity violation:**
- Replay explanations that use log reconstruction instead of actual PRE resolution path output
- Replay explanations that display a simplified resolution path compared to live explanations
- Replay explanations that attribute outcomes to different factors than live explanations

### 2.4 Timeline Parity

Timeline parity means that the operational timeline renders the same events in the same positions with the same labels in both live view (viewing recent history) and replay view (viewing the same period in historical context).

**Timeline parity requirements:**
- An event that appears at position T in the live view's recent history appears at the same position T in the replay view
- The event's label, type classification, and attribution are identical in both views
- Causality indicators (TP-06) are present in both views for the same causal relationships

**Timeline parity violation:** A "sponsor delivery gap" event that appears as a gap annotation in replay but was invisible in the live timeline at the time it occurred — because the live timeline's gap detection runs on a delay. The live timeline should surface gap annotations with appropriate timing disclosure, not omit them. Alternatively, if the live timeline legitimately does not have the annotation at the time of the event (because the processing hasn't completed), this must be disclosed in the replay view: "This annotation was added at [timestamp], [N] minutes after the event occurred."

### 2.5 State Badge Parity

State badges (SB-01 through SB-08 from OPERATIONAL-COMPONENT-SEMANTICS-v1.md) reflect the synchronization context, not the data quality. In replay, the REPLAY badge replaces the LIVE badge — but the underlying data quality indicators (STALE, DEGRADED) still apply to the replay corpus:

- If the corpus has a gap at the requested moment, the replay view shows the REPLAY badge with a corpus-gap indicator — not a blank display or a "nothing happening" state
- If the replay is accessing the corpus at a moment where PRE resolution confidence was reduced (e.g., the PRE was in degraded mode at that historical moment), this is disclosed in the replay view

---

## Section 3 — Replay Transition Governance

### 3.1 Replay Entry Visibility

Entering replay mode is a significant operational context switch. The operator is leaving the live operational environment and entering a historical reconstruction. This transition must be explicitly visible.

**Replay entry sequence (implementation requirement):**
1. Operator initiates replay entry (explicit action — no accidental entries)
2. The transition is visually distinct from any data update or navigation event
3. The live update feed is immediately suspended — no new live events update the display during transition
4. The REPLAY state header (RC-04 from TEMPORAL-AND-REPLAY-COMPONENTS-v1.md) appears
5. The investigation anchor is set from the entry context
6. The temporal context (which historical moment is being viewed) is displayed before the historical state is rendered

**What replay entry must not do:**
- Transition silently
- Begin with a blank or loading state without explanation
- Display live state alongside historical state during the transition

### 3.2 Replay Exit Visibility

Exiting replay mode returns the operator to the live operational environment. They may be returning to a state that has changed significantly since they entered replay.

**Replay exit sequence (implementation requirement):**
1. Operator initiates exit (explicit action — "Return to live" control, always visible)
2. Reconciliation summary computed: what changed between replay entry time and now
3. The reconciliation summary is displayed before live state is restored: "You were viewing [historical time]. You have been in replay for [duration]. Notable changes: [list or 'no notable changes']"
4. Operator acknowledges reconciliation (or it auto-resolves after defined period if no notable changes)
5. SYNCHRONIZED state briefly displayed
6. Live state fully restored; LIVE badge replaces REPLAY header

**Reconciliation summary contents:**
- Active incidents declared or resolved since replay entry
- Emergency activations or deactivations since replay entry
- Significant health grade changes (grade drop of 2+ letters)
- New overrides applied to the operator's current scope
- Any Tier 3+ signals that fired and may have not been acknowledged

**What replay exit must not do:**
- Transition silently back to live state
- Skip reconciliation when notable changes have occurred
- Lose the operator's navigation context (they return to the same scope they were in before replay)

### 3.3 Replay Scope Visibility

The scope of a replay investigation — which screens, venues, or fleet segments are included — must be always visible and explicitly bounded.

**Replay scope requirements:**
- The scope is declared when replay is entered and displayed in the REPLAY state header throughout
- Navigating to a different scope within replay expands the declared scope (the investigation now includes both scopes)
- The corpus coverage for the declared scope and time period is displayed: "Corpus complete for this scope and period" or "Corpus gap: [period]"

### 3.4 Replay Timestamp Authority

All timestamps in replay are the PRE's operational clock timestamps from the recorded historical period — not the current time, not the delivery timestamp, not the computation timestamp.

**Timestamp authority in replay:**
- The "viewing" timestamp (displayed in the REPLAY state header) is the PRE's operational clock for the selected historical moment
- Event timestamps in the replay timeline are the PRE's operational clock timestamps for when those events occurred
- The "investigation anchor" timestamp is the PRE's operational clock timestamp for the moment from which replay was entered
- Relative timestamps ("4 minutes before the incident") are calculated relative to the investigation anchor using PRE operational clock time

---

## Section 4 — Counterfactual Governance

### 4.1 Historical vs. Simulated Distinction

A counterfactual simulation starts from a historical system state and diverges from the actual historical record at a defined branch point. The output of a counterfactual is not a record of what happened — it is a simulation of what would have happened.

**Mandatory visual distinction:**
- The branch point is labeled: "Simulation begins here"
- Before the branch point: actual historical record (solid visual treatment)
- After the branch point: simulated alternative history (distinct visual treatment — not the same rendering as historical data)
- The counterfactual result is labeled "SIMULATED — this did not occur" at all times

**Counterfactual output may not be:**
- Confused with actual historical record
- Used as the basis for live operational actions without conversion to a proper preview
- Saved to the corpus as if it were historical data
- Presented to operators who did not initiate the counterfactual without explicit disclosure that it is simulated

### 4.2 Approximation Disclosure

In some cases, the corpus may not have the complete input state required for a perfect deterministic replay at a specific moment. The PRE may be able to produce a high-confidence approximation using the nearest complete corpus entry and applying forward projection.

**Approximation disclosure rules:**
- If the replay result is an approximation (not exact deterministic reconstruction), this must be disclosed: "Approximate reconstruction — corpus entry at [timestamp ± N seconds]. Confidence: [HIGH/MEDIUM/LOW]."
- Approximate reconstructions use a distinct visual treatment from exact reconstructions
- Approximate reconstructions may not be used as evidentiary basis for sponsor compliance verification or formal incident investigation — only exact reconstructions carry evidentiary weight
- The operator must be able to determine whether any specific replay moment is exact or approximate

### 4.3 Reconstruction Confidence Visibility

Every replay moment has a reconstruction confidence level. The confidence level is determined by:

- **EXACT:** Complete corpus entry exists for this exact moment. PRE evaluation is deterministic.
- **HIGH:** Corpus entry within a few seconds. Forward projection confidence is very high.
- **MEDIUM:** Corpus entry within the current minute. Some events in the gap may not be reflected.
- **LOW:** Corpus entry more than one minute old. Significant reconstruction uncertainty.
- **UNAVAILABLE:** No corpus entry available for this period. Replay cannot be provided.

Reconstruction confidence must be visible in the REPLAY state header and in the timeline at any moment where confidence is below EXACT.

---

## Section 5 — Replay Failure Modes

### Failure Mode RF-01: Replay Approximation Ambiguity

**What it is:** Replay produces an approximated or log-reconstructed result but presents it with the same visual treatment as an exact reconstruction. The operator cannot tell that what they are seeing is not deterministic PRE output.

**Why it happens:** Replay implementation that falls back to log reconstruction without disclosure when corpus entries are unavailable.

**Prevention:** Approximation disclosure (Section 4.2) is mandatory. Any non-exact reconstruction carries visible confidence labels. The corpus completeness indicator is always visible in replay view.

---

### Failure Mode RF-02: Hidden Simulation

**What it is:** A counterfactual simulation is displayed alongside or in place of the actual historical record, without clear visual distinction. The operator forms a false memory of what the historical record shows.

**Prevention:** The mandatory visual distinction requirements in Section 4.1. The simulated branch is never shown with the same visual treatment as the actual record. The "SIMULATED" label is structural, not dismissible, and not subtle.

---

### Failure Mode RF-03: Timestamp Collapse

**What it is:** Multiple timestamps (operational clock, delivery timestamp, computation timestamp, current time) appear in the replay view without clear labeling, causing the operator to lose track of which timestamp refers to what.

**Prevention:** Timestamp authority rules (Section 3.4). Every timestamp in replay view is labeled with its semantic type. "Viewing" is always the PRE operational clock. "Delivered" and "computed" timestamps are secondary and labeled as such.

---

### Failure Mode RF-04: Replay / Live Blending

**What it is:** Live state updates "bleed through" into the replay view — perhaps because the operator's view subscription was not correctly suspended on replay entry, or because a real-time push update arrived and was applied to the display before the live feed suspension took effect.

**Prevention:** Replay entry must fully suspend the live update feed before rendering historical state. The transition sequence (Section 3.1) enforces the correct order. Any live event that arrives after replay entry is queued but not rendered until replay exit.

---

### Failure Mode RF-05: Causality Distortion

**What it is:** The replay timeline presents events in an order that differs from their actual causal sequence — either because log reconstruction doesn't preserve exact ordering, or because visualization decisions have reordered events for display purposes.

**Prevention:** Replay events are ordered by the PRE operational clock timestamp, always. No secondary ordering criteria may override chronological order. Events at the same millisecond use the tie-breaking rules defined in TEMPORAL-AND-REPLAY-COMPONENTS-v1.md Section 4.3.

---

## Section 6 — Human Factors

### 6.1 Replay-Assisted Trust

Operators develop trust in the platform's replay through repeated experiences of replay confirming what they believed about the operational record. An operator who investigates an incident through replay and finds that the replay confirms their mental model of what happened has a trust-confirming experience. An operator who finds that replay contradicts their mental model — but the replay is accurate — has learned something operationally valuable.

**Design implication:** Replay should be framed as a learning tool, not a verification tool. Operators who use replay to confirm what they already believe benefit less than operators who use replay to challenge and refine their mental models. The platform should encourage "check your assumptions in replay" as a routine practice, not a crisis response.

### 6.2 Temporal Orientation

Operators in replay can lose temporal orientation — they may forget how far in the past they are viewing, how long they have been in replay, or how the current replay moment relates to other operational events they care about.

**Design implication:** The REPLAY state header (RC-04) is the primary temporal orientation tool. The "time since present" display (how far in the past the current replay moment is) maintains continuous orientation. The investigation anchor (the moment from which replay was entered) provides a reference point for navigating the timeline.

### 6.3 Forensic Cognition

Forensic investigation — using replay to reconstruct the causal chain of a past incident — is a cognitively demanding task. The operator must hold multiple timelines in mind simultaneously: what was happening at the scope of interest, what was happening in adjacent scopes, and what was happening in the operational environment as a whole.

**Design implication:** Forensic investigation is supported by the multi-scope replay capability, the causality indicators (TP-06), and the investigation anchor system. The replay workspace should support the operator in holding multiple timelines simultaneously — not requiring them to navigate back and forth to compare two moments, but enabling side-by-side or overlaid comparison.

### 6.4 Historical Confidence

The confidence operators have in historical data is a function of replay's perceived accuracy. Operators who have had experiences where replay seemed to contradict what they remembered will discount replay as a source of truth. Operators who have never had replay-accuracy concerns will rely on it appropriately.

**Design implication:** Reconstruction confidence labeling (Section 4.3) is counterintuitively a trust-builder, not a trust-reducer. An operator who sees "EXACT reconstruction" for most replay moments, and "HIGH confidence" for a few, has a more calibrated trust model than an operator who sees no confidence labels. The former knows when to rely on replay absolutely and when to treat it as high-confidence-but-verify. The latter may over-trust low-confidence approximations.

---

## Related Documents

**PRE-NATIVE-FRONTEND-ARCHITECTURE-v1.md** — The upstream architecture that defines how PRE outputs reach the frontend. Replay architecture is the historical dimension of this flow.

**STATE-SYNCHRONIZATION-AND-CONSISTENCY-v1.md** — Sync state SS-07 (REPLAY-LOCKED) is governed by this document. Replay transition governance in Section 3 implements the transition rules.

**FRONTEND-TRUTH-AND-RENDERING-GOVERNANCE-v1.md** — The rendering honesty rules that govern how replay approximations and confidence levels are disclosed.

**TEMPORAL-AND-REPLAY-COMPONENTS-v1.md** — The replay component specifications (RC-01 through RC-06) that implement the architectural requirements defined here.

**EXPLAINABILITY-RENDERING-SYSTEM-v1.md** — The explanation parity requirements (Section 2.3) are implemented by the explainability rendering system.

---

*End of REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md v1.0*
*Authority: SHARED — Agent 1 (PRE/Replay Engine) + Agent 3 (UX/Rendering)*
*PRE deterministic replay API and corpus architecture: Agent 1 definition and implementation authority*
*Replay rendering and parity enforcement: Agent 3 definition authority*
*Corpus storage and delivery log: Agent 2 co-authority*
*Changes require consensus of Agent 1 and Agent 3; Agent 2 consulted on corpus-related changes.*
