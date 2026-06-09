# OPERATIONAL VISUAL SEMANTICS v1

**Era:** Perceptual Governance
**Status:** CANONICAL
**Scope:** Color meaning, severity hierarchy, replay/live distinction, degraded state, semantic iconography, perceptual invariants

---

## 1. PURPOSE

The visual layer of ClubHub TV is operational infrastructure. Every color, every contrast ratio, every icon carries a functional meaning. Visual elements that do not carry operational meaning do not belong on an operational surface.

This document defines what visual signals mean, and holds those meanings permanently. Operators develop perception reflexes over time — seeing a color and knowing immediately what class of situation it represents. Those reflexes must never be violated by aesthetic refreshes, theme variations, or sponsor customization.

**Visual consistency is operator trust. Visual inconsistency is operational hazard.**

---

## 2. CANONICAL OPERATIONAL COLOR SYSTEM

Colors in the ClubHub TV operational layer carry exactly one meaning each. These meanings are constitutional. They cannot be reassigned, repurposed for sponsor branding, or applied decoratively.

### 2.1 Severity Spectrum

The severity spectrum governs all operational states that communicate system health, alert level, or attention urgency.

| Semantic Role | Token Name | Operational Meaning |
|---|---|---|
| **Nominal** | `color.status.nominal` | System operating within all expected parameters. No action required. |
| **Advisory** | `color.status.advisory` | System operating but approaching a threshold. Operator awareness warranted. No immediate action required. |
| **Warning** | `color.status.warning` | Threshold breached. Operator should monitor and prepare to act. |
| **Alert** | `color.status.alert` | Action is required. System cannot self-correct. Operator intervention expected. |
| **Critical** | `color.status.critical` | Urgent operator action required. Blast radius expanding or imminent. |
| **Terminal** | `color.status.terminal` | Unrecoverable state. Operator must intervene to restore service. |

**Law:** Severity tokens are applied in strict monotonic order. A NOMINAL-colored element cannot represent a WARNING condition. A WARNING-colored element cannot represent a NOMINAL condition. The color hierarchy is the severity hierarchy.

**Law:** The gap between severity levels must be perceptually unambiguous at all ambient light conditions expected in venue operation. Colors are selected for the operational environment (bright arena lighting, dim control rooms, direct sunlight on venue floors), not for screen aesthetics.

### 2.2 Operational Mode Spectrum

Distinct from severity — these communicate what mode the system is in, not how healthy it is.

| Semantic Role | Token Name | Operational Meaning |
|---|---|---|
| **Live** | `color.mode.live` | Content being rendered is current, authoritative, and real-time. |
| **Replay** | `color.mode.replay` | Content being rendered is historical corpus material. Not current truth. |
| **Degraded** | `color.mode.degraded` | System is operational but with reduced fidelity or capability. |
| **Stale** | `color.mode.stale` | Data shown may no longer reflect backend authority. Must not be trusted without re-verification. |
| **Simulated** | `color.mode.simulated` | System is in a simulation or test environment. Not production. |

**Law:** LIVE and REPLAY must be perceptually distinct at a glance. An operator must be incapable of confusing live content for replay or vice versa. This is not a UX convenience — it is a truth-integrity requirement.

**Law:** STALE must always appear visually diminished relative to LIVE. Stale data is never presented with full visual authority.

### 2.3 Operator Authority Spectrum

Communicates the authority level of an operator action, override, or session state.

| Semantic Role | Token Name | Operational Meaning |
|---|---|---|
| **Standard** | `color.authority.standard` | Normal operator session. Standard permissions. |
| **Elevated** | `color.authority.elevated` | Operator has invoked elevated authority. Actions have expanded scope. |
| **Override** | `color.authority.override` | Active operator override of a system decision. |

**Law:** Elevated authority surfaces must be visually distinguishable from standard surfaces at all times during elevation. An operator must be constantly aware they are operating in an elevated context.

### 2.4 Content Classification Spectrum

Communicates the category of content being displayed — distinguishes operational content from sponsored/promotional content.

| Semantic Role | Token Name | Operational Meaning |
|---|---|---|
| **Operational** | `color.content.operational` | Content that represents operational system state. Highest trust. |
| **Schedule** | `color.content.schedule` | Content derived from the authoritative schedule. Trust from PRE resolution. |
| **Sponsored** | `color.content.sponsored` | Content from a sponsor or advertiser. Must not appear as operational truth. |
| **Fallback** | `color.content.fallback` | Content being shown as a graceful fallback, not from the authoritative resolution. |

**Law:** SPONSORED content must never use OPERATIONAL or SCHEDULE color tokens. Sponsors cannot assume operational visual authority.

**Law:** FALLBACK content must be visually distinct from SCHEDULE content. Operators must never believe fallback content is the authoritative schedule.

---

## 3. SEVERITY HIERARCHY INTEGRITY RULES

### 3.1 No Severity Skipping

Severity escalation progresses through the spectrum. Visual signals do not jump from NOMINAL directly to CRITICAL. The spectrum exists to give operators calibration time.

Exception: Terminal events may jump directly to TERMINAL coloring. True terminal states require immediate operator recognition.

### 3.2 No Severity Decoration

Severity colors are not used for emphasis, visual interest, or hierarchy within non-critical content. An orange element always means WARNING. It never means "important section header."

If non-severity hierarchy is needed (e.g., primary vs secondary text), use the typography and density system — not the severity color spectrum.

### 3.3 No Competing Severity Signals

At any given moment, no more than one severity level dominates the operational surface. Simultaneous multi-severity signals create cognitive overload.

**Rule:** The highest-active severity color claims the operational surface. Lower-severity signals are suppressed to indicators only (small badges, muted tokens) when a higher severity is active.

### 3.4 Severity Signal Durability

Severity signals persist until the condition is resolved. They are never automatically dismissed by time-based decay, animation fade-out, or UI cleanup routines.

**Forbidden:** A CRITICAL severity indicator that fades out after 30 seconds "to avoid cluttering the UI."

---

## 4. REPLAY / LIVE VISUAL DISTINCTION RULES

The distinction between LIVE and REPLAY is the most operationally critical visual differentiation in the system.

### 4.1 Mandatory Replay Indicators

When the system is in REPLAY mode, the following MUST be present simultaneously:

1. **Mode badge:** A persistent, non-dismissable badge using `color.mode.replay` token, positioned in the shell chrome (always-visible zone)
2. **Temporal anchor:** The timestamp of the corpus packet being replayed, displayed prominently in or adjacent to the replay pane
3. **Border treatment:** The replay pane carries a continuous border or frame using `color.mode.replay` — the visual boundary of the historical content zone
4. **Explanation panel header:** The explainability zone header identifies itself as "Historical Decision" not "Current Decision"

### 4.2 Live Indicators

When in LIVE mode:
1. **Mode badge:** Persistent badge using `color.mode.live` in shell chrome
2. **Recency indicator:** A signal communicating the age of the last PRE resolution (e.g., "Resolved 12s ago")
3. **No replay border:** Absence of the replay frame is itself a live signal

### 4.3 Simultaneous Replay/Live View

When both a live pane and a replay pane are simultaneously visible (during comparison mode):
- Each pane carries its full mode indicators
- A visual separator between panes uses both `color.mode.live` and `color.mode.replay` tokens at the boundary
- No content from one pane is styled with the other's mode color

### 4.4 Forbidden Replay/Live Confusion Patterns

| Pattern | Why Forbidden |
|---|---|
| Replay pane without timestamp | Operator cannot calibrate historical vs current |
| Live pane with replay-style muted colors | Operator perceives live content as lower-authority |
| Replay badge that auto-hides after inactivity | Operator loses mode awareness |
| Shared visual frame between live and replay content | Boundary between truth and history disappears |
| Replay mode indicated only by a tooltip | Tooltips require hover action; mode awareness must be ambient |

---

## 5. DEGRADED-STATE RENDERING RULES

Degraded states are never made to look "clean" by hiding indicators. The degraded condition is information. Hiding it hides truth.

### 5.1 Degraded State Visual Contract

When the system is in DEGRADED state:
- `color.mode.degraded` applies to connectivity indicators in shell chrome
- Content rendered from stale resolution carries `color.mode.stale` treatment on its authority indicators
- Fallback content carries `color.content.fallback` treatment
- The degraded indicator remains visible until nominal state is restored

### 5.2 Stale Data Rendering

When data has exceeded its freshness threshold:
- The data element's authority indicator shifts to `color.mode.stale`
- The element's primary content MAY render normally, but with a clearly visible stale marker adjacent
- The stale marker includes elapsed time since last confirmed resolution
- Stale data is NEVER rendered without its stale marker

**Forbidden:** A "clean" view that removes stale markers to avoid visual clutter. Stale markers are operational safety information.

### 5.3 Partial Manifest Rendering

When the manifest is partially available:
- Available slots render normally with their standard content tokens
- Unavailable slots render with an explicit "Pending Resolution" indicator
- The schedule pane header indicates partial state
- Fallback content in unavailable slots uses `color.content.fallback`, not `color.content.schedule`

---

## 6. SPONSORSHIP VS OPERATIONAL STATE SEPARATION

Sponsor and promotional content exists on operational surfaces but must never be mistaken for operational information.

### 6.1 Sponsor Content Zone Isolation

Sponsor content is rendered only in designated sponsor zones, defined by the manifest and PRE resolution. These zones have a distinct visual treatment that separates them from operational surfaces:

- Sponsor zones use `color.content.sponsored` as a border or header treatment
- Sponsor content does not use any token from the severity spectrum
- Sponsor content does not use `color.mode.*` tokens
- Sponsor content does not use `color.content.operational` or `color.content.schedule`

### 6.2 Sponsor Branding Constraint

Sponsor brands may apply their own colors and typography within the sponsor content zone. They CANNOT:
- Use colors that conflict with the severity spectrum (e.g., red-family colors that may be confused with `color.status.critical`)
- Apply animations that trigger motion governance rules (see MOTION-AND-TRANSITION-GOVERNANCE-v1.md)
- Expand beyond their designated zone
- Override any shell chrome visual treatment

### 6.3 The Contamination Rule

If a sponsor's brand color is perceptually similar to any severity spectrum color at the expected viewing distance and ambient light conditions, the sponsor color is ineligible for use in that zone. The operational signal takes precedence.

---

## 7. SEMANTIC ICONOGRAPHY GOVERNANCE

### 7.1 Icon Meaning Registry

Icons carry fixed operational meanings. They are not decorative.

| Icon Category | Semantic Meaning | Usage Constraint |
|---|---|---|
| **Status icons** | Represent system health states (nominal, degraded, critical) | Used only in shell chrome and operational panels |
| **Mode icons** | Indicate current operational mode (live, replay, simulated) | Used only in mode badges and pane headers |
| **Authority icons** | Indicate permission level or operator override | Used only adjacent to elevated-authority surfaces |
| **Action icons** | Represent available operator actions | Always paired with text label; never icon-only for critical actions |
| **Causal icons** | Indicate that an explanation is available | Used in explainability surfaces only |
| **Temporal icons** | Represent time-related concepts (historical, scheduled, live) | Used only in temporal context (replay timeline, schedule view) |

### 7.2 Icon Stability Rule

Icons within a semantic category are never repurposed across categories. A status icon is never used to indicate an action. A temporal icon is never used for a severity signal.

### 7.3 Critical Action Icon Law

For any action whose consequences cannot be immediately reversed, the icon must not stand alone. A text label is mandatory. The operator must read what they are about to do, not infer it from a symbol.

---

## 8. FORBIDDEN AMBIGUITY PATTERNS

The following patterns produce operational ambiguity and are constitutionally forbidden:

| Pattern | Operational Failure It Causes |
|---|---|
| Red used for both critical alerts and active/selected states | Operator cannot distinguish urgent from routine |
| Green used for both nominal system health and sponsor approval | Operator conflates system trust with sponsor signal |
| Blinking or pulsing on non-critical elements | Motion attention budget consumed by non-urgent content |
| Severity color applied to typography hierarchy (e.g., orange headings) | Operators learn to ignore orange → actual warnings missed |
| STALE and LIVE data rendered with identical visual treatment | Operator believes stale data is authoritative |
| REPLAY mode visually equivalent to LIVE mode | Operator may issue live operational commands while reviewing history |
| Sponsor colors within severity spectrum range | Sponsor signal may be processed as severity signal |
| Contextual meaning (hover states, selection) using severity colors | Severity perception becomes unreliable |
| "Dark mode" that reduces visibility of severity indicators | Night-vision optimization cannot come at cost of alert legibility |
| Loading states that use `color.status.warning` palette for spinners | Operator perceives sustained load as a warning condition |

---

## 9. PERCEPTUAL CONSISTENCY INVARIANTS

The following are unconditional. They do not change across themes, context, venue type, or deployment environment.

**Invariant 1:** The severity spectrum colors do not change. Their hue relationship (nominal through terminal) is permanent.

**Invariant 2:** LIVE and REPLAY are always visually distinct. No design decision reduces this distinction.

**Invariant 3:** Stale data always carries visual diminishment relative to fresh data.

**Invariant 4:** The shell chrome is always visually separable from workspace content. The operational frame is never absorbed into the content surface.

**Invariant 5:** Elevated authority is always visually signaled during its active period.

**Invariant 6:** Incident state at any severity level is always reflected in the shell chrome, regardless of which workspace pane is in focus.

**Invariant 7:** Sponsor content is never presented with the same visual authority as schedule or operational content.

**Invariant 8:** No severity color may be used for decoration, emphasis, or branding in any context.

---

*Document status: CANONICAL — Perceptual Governance Era*
*Do not modify without constitutional governance review*
