# INCIDENT REALITY INTEGRATION SYSTEM v1

**Era:** Operator Reality Integration
**Status:** CANONICAL
**Scope:** Real incident surface behavior, stress-progressive UI degradation, authority clarity under chaos, signal conflict resolution, safe-to-ignore rules, recovery cognition sequencing

---

## 1. PURPOSE

Incident design in most systems targets the ideal incident: a single failure, a clear cause, a calm operator, plenty of time. Real incidents target the actual incident: cascading signals, unclear causality, multiple operators with different information, time pressure, and an operator whose stress response is actively narrowing their cognition.

This document defines how the ClubHub TV interface behaves during real incidents — not idealized ones. The architecture must remain comprehensible as conditions degrade, and must actively guide the operator toward correct action rather than presenting them with a maximally accurate but cognitively overwhelming picture.

**The system's job during an incident is to reduce the operator's cognitive load, not to maximize information density.**

---

## 2. WHAT OPERATORS SEE DURING REAL INCIDENTS

### 2.1 The Reality Gap Between Design and Operation

Systems are designed under the assumption that operators will:
- Read the full incident surface before acting
- Process all available signals
- Understand the causal chain
- Make deliberate, considered decisions

Real incidents involve operators who:
- Act on the first recognizable signal without reading further
- Process 2–3 signals simultaneously at most
- Infer causality from incomplete information
- Make decisions in 10–30 second windows

The incident surface must be designed for the second description, not the first.

### 2.2 The First 30 Seconds

In the first 30 seconds of an incident, the operator's primary cognitive question is: **"Is this real and do I need to act now?"**

The incident surface during the first 30 seconds must answer only this:
1. What severity level is this? (color + L1 text — one line)
2. What is specifically failing? (plain language — one line)
3. Is this requiring me to act right now, or monitoring? (explicit label: "ACTION REQUIRED" vs "MONITORING")
4. What is the single highest-priority action available? (one button, labeled with plain action verb)

Everything else is suppressed for 30 seconds. The operator is not ready to process it.

### 2.3 30 Seconds to 3 Minutes

After the first 30 seconds, the operator has established baseline situation awareness. The incident surface expands to include:
- Blast radius scope (which venues, which screens, what content)
- Timeline: when did this start?
- Who else is active on this incident?
- Available response actions (expanded from the single initial action)
- Current system behavior (what the system is doing automatically — any fallbacks activated, any circuit breakers tripped)

### 2.4 After 3 Minutes

After 3 minutes, the operator has processed the situation. The full incident surface is available:
- Full causal information (what triggered the incident state machine transition)
- Historical context (similar incidents in corpus)
- Communication channels (who to notify)
- Recovery sequencing guidance
- Post-incident documentation requirements

**Law:** Information is revealed progressively. The sequence is fixed: immediate triage → blast radius → context → detail. An operator can always expand to earlier-stage information. But the default view matches their likely cognitive state at each time window.

---

## 3. PROGRESSIVE DEGRADATION OF UI UNDER STRESS

The UI degrades gracefully under operational stress. This degradation is not failure — it is intentional compression that makes the incident surface safer under cognitive load.

### 3.1 Degradation Stages

**Stage 0 — Nominal:** Full operational surface, all panes, all information levels.

**Stage 1 — Watching (incident detected, not yet declared):**
- Incident status bar appears in shell chrome at minimal footprint
- No workspace changes
- Operator may continue normal operation

**Stage 2 — Declared (incident confirmed):**
- Incident banner expands to prominent position in shell chrome
- Non-critical panes (sponsorship analytics, secondary schedule views) reduce to indicators
- Primary pane remains with degraded indicators active
- Explainability zone shows last confirmed resolution, clearly marked as pre-incident

**Stage 3 — Contained / Active Response:**
- Workspace compresses to incident-focused layout
- Primary pane shows only the affected scope (not full schedule)
- Incident action panel expands (visible without scrolling)
- Secondary information collapsed but accessible via explicit expand action

**Stage 4 — Critical:**
- Full incident surface replaces workspace
- Only incident-critical information visible
- All non-incident pane content suppressed to status badges in a sidebar
- The surface is the incident, not the schedule

**Stage 5 — Terminal (unrecoverable, operator must intervene):**
- Single-surface view: what failed, what is affected, what the operator must do
- No ambient information
- No animations (IMMEDIATE timing only for state changes)
- A single escalation path: call support, initiate restart, contact adjacent authority

### 3.2 Degradation Is One-Way During Incident

Once the surface has degraded to Stage N, it does not return to Stage N-1 automatically. Degradation is progressive during an active incident. Recovery requires explicit operator action (incident resolution), not automatic timeout.

**Rationale:** Automatic UI recovery during an incident falsely signals that the situation has improved. Only the operator can determine that the situation has improved sufficiently to warrant expanded information density.

---

## 4. INFORMATION COMPRESSION RULES DURING INCIDENTS

During an active incident, information that would normally be displayed must be compressed to fit the operator's reduced cognitive capacity.

### 4.1 Compression Priority

| Information Type | Compression Treatment |
|---|---|
| Incident severity and scope | NEVER compressed. Always full display at L1 or L2 scale. |
| Required operator actions | NEVER compressed. Displayed prominently with plain-language labels. |
| LIVE vs REPLAY mode indicator | NEVER compressed. Must remain visible. |
| Session authority indicator | NEVER compressed. Elevated authority must always be visible. |
| Active fallback content indicator | NEVER compressed. Operators must know what is actually playing. |
| Secondary venue status | Compressed to status icons only — expand on demand |
| Schedule detail (items beyond next 2) | Hidden — expand on demand |
| Explainability content (non-incident) | Hidden — expand on demand |
| PRE resolution detail | Hidden — available in incident context only |
| System version, connection metrics | Hidden entirely during Stage 3+ incidents |

### 4.2 The Single Next Action Rule

During Stage 3–5 incidents, the surface exposes exactly one primary action button at a time. The system selects this action based on the current incident state machine state and the most common recovery path for the current failure mode.

This is not automation — the operator still makes the decision. But the surface does not force them to evaluate 6 possible actions and select the correct one. The system surfaces the most likely correct action; the operator confirms or overrides.

Overrides are available via an explicit "Other options" expansion — they require one additional interaction to surface, preventing accidental selection of non-recommended recovery paths.

### 4.3 Temporal Compression

During an incident, timestamps shift from precise ISO8601 format to relative operational notation:
- "4 minutes ago" replaces "2026-05-27 14:32:11 UTC" for incident-start time
- "3 minutes into incident" replaces absolute duration figures
- "Next event: 12 minutes" replaces absolute schedule timestamps

Operators under stress process relative time more accurately than absolute time. The switch to relative notation is automatic during Stage 2+ and reverts on incident resolution.

**Exception:** Corpus packet timestamps in the replay surface remain in absolute ISO8601 format. Replay is a precision activity and absolute timestamps are required for corpus navigation. This is not compressed.

---

## 5. AUTHORITY CLARITY UNDER MULTI-ROLE CHAOS

During large incidents, multiple operators may be active simultaneously: the Venue Operator managing local effects, a Fleet Operator watching the broader impact, and an Incident Commander coordinating response. Each of these roles has different authority. The system must make authority unambiguous.

### 5.1 Active Operator Visibility

During a declared incident, the incident surface shows:
- Which operators are currently active on this incident (display names, not system IDs)
- Which authority level each operator holds
- Which operator currently holds the highest authority

This information is real-time. If an operator elevates, the authority display updates immediately.

### 5.2 Conflicting Authority Resolution

When two operators attempt conflicting actions simultaneously:
- The higher-authority operator's action proceeds
- The lower-authority operator's action is rejected with an immediate, explicit notification: "Action prevented — [Name] (Incident Commander) is taking a conflicting action"
- The rejected operator sees what the higher-authority operator did, in real-time

**Forbidden:** Silent rejection. An operator who attempts an action and sees nothing happen will attempt the action again, creating a loop. Every rejection must be explicit and immediate.

### 5.3 Authority Inheritance During Incident

When an Incident Commander is assigned during an active incident:
- Their elevated authority is immediately visible to all other active operators
- Actions previously available to other operators that are now restricted by the Incident Commander's authority are visually locked with an explicit indicator: "Locked by Incident Commander"
- The locked operator can request authority from the Incident Commander via a single action — this creates a notification on the Incident Commander's surface

---

## 6. CONTRADICTION RESOLUTION WHEN MULTIPLE SIGNALS CONFLICT

Real incidents produce contradictory signals: a venue reports nominal status while its content shows a fallback. A backend event declares resolution while the PRE resolution is still STALE. Multiple alerts fire with contradictory severity classifications.

### 6.1 Signal Priority Hierarchy During Incidents

When signals conflict, the system resolves in this order:

```
Priority 1: Backend-declared incident state machine state
  (if the backend says DECLARED, the surface shows DECLARED regardless of other signals)

Priority 2: Operator-acknowledged state
  (if an operator has acknowledged resolution, that acknowledgment is surfaced)

Priority 3: PRE resolution state
  (STALE, FAILED take precedence over RESOLVED if resolution timestamp is old)

Priority 4: Content rendering state
  (fallback content in play overrides nominal status indicators)

Priority 5: Connectivity indicators
  (network status is the least authoritative signal — it describes path, not state)
```

### 6.2 Contradiction Surface

When conflicting signals exist, the system does not silently resolve them. It displays the contradiction explicitly:

```
SYSTEM STATUS CONFLICT

Backend reports: NOMINAL
Content rendering: FALLBACK ACTIVE (last resolved 8m ago)

Showing degraded view. Tap "Investigate" for detail.
```

The operator is not asked to resolve the conflict themselves — they are shown it exists, and offered an investigation path. The system continues operating on the highest-priority signal until the conflict is resolved.

### 6.3 Forbidden Conflict Handling

| Pattern | Why Forbidden |
|---|---|
| Average conflicting signals to produce a "middle" severity | Creates false precision from genuine uncertainty |
| Show only the most optimistic signal | Hides active problems behind nominal-looking UI |
| Show only the most pessimistic signal always | Creates false alarm fatigue — operators stop acting on signals |
| Hide the contradiction from the operator | Operators must know when the system's own signals disagree |

---

## 7. "WHAT TO IGNORE SAFELY" RULES

During an incident, operators receive more signals than they can process. The system must explicitly communicate which signals can be safely deprioritized.

### 7.1 Safely Ignorable During Stage 3+ Incidents

The system explicitly marks these as "monitoring only — no action required" during high-severity incidents:

- PRE resolution timing metrics (resolution is happening, timing variation is expected during incidents)
- Sponsor content delivery status (non-operational during incident response)
- Historical replay availability (replay is blocked during active incidents; its status is irrelevant)
- Entropy score changes (these are informational; they do not require operator response during an active incident)
- OTA update availability (updates are frozen during incidents; their availability status is suppressed)

These items are hidden from the primary incident surface. They are available in the system detail view for Platform Administrators who may need them, but they are not surfaced to Venue Operators or Fleet Operators during an incident.

### 7.2 Never Ignorable

These signals always require operator attention, regardless of what else is happening:
- TERMINAL state entry on any component
- Incident severity escalation
- Authority conflict notification
- Session expiry warning during incident
- Stale data on content currently rendering to live audience

---

## 8. RECOVERY COGNITION SEQUENCING

How understanding returns after stress is not the reverse of how it degrades. Recovery requires active reconstruction of situation awareness, not just re-expansion of the collapsed UI.

### 8.1 The Recovery Sequence

When an incident is resolved, the system does not immediately return to full information density. It sequences recovery:

**Minute 0–2: Resolution Confirmation**
- Incident banner changes from active to resolved state
- The specific thing that failed is shown with explicit past-tense language: "PRE resolution failure — resolved at 14:47 UTC"
- The current state is shown: "System nominal. All content from authoritative schedule."
- One operator action required: "Confirm resolution and resume full monitoring"

**Minute 2–5: State Reconstruction**
- The incident timeline is shown: what happened, when, what was affected
- Current content status: is the authoritative schedule now playing, or is fallback still active?
- Any pending operator actions from the incident: documentation requirements, post-incident review scheduling

**Minute 5+: Full Surface Restoration**
- All panes return
- All information levels return
- Incident enters POST_INCIDENT state in the incident state machine — visible but non-intrusive
- Post-incident review surface is available but not forced

### 8.2 Re-Orient Before Resume

Before the operator returns to normal operation after a Stage 3+ incident, the system presents a "re-orient" surface:
- Current system state (all five minimum viable understanding items for their role)
- What is currently playing at their venue(s)
- Any events that occurred during the incident that required attention but were deferred

This prevents operators from resuming normal operation while still holding an incomplete mental model of the current state.

### 8.3 Post-Incident Cognitive Reset

After a significant incident (Stage 3+, duration >15 minutes), the system flags a recommended cognitive reset:
- Suggested shift handoff or break before next high-consequence operation
- Available replay of the incident timeline for review when the operator's cognition has recovered
- Access to the simulation harness for any new failure mode encountered — so the operator can process it in a low-stress environment

These are suggestions, not enforced restrictions. The system cannot control operator schedules. But it surfaces the recommendation explicitly.

---

## 9. INCIDENT SURFACE ANTI-PATTERNS

| Pattern | Operational Failure |
|---|---|
| Full schedule view visible during Stage 4+ incident | Operator attention fragments across irrelevant content |
| Incident resolved automatically without operator confirmation | Operator may not know the incident is over; may continue incident-response behavior inappropriately |
| Recovery returns to full information density immediately | Second cognitive shock; operator cannot process the sudden information volume |
| Contradictory signals silently resolved to optimistic state | Operator believes system is healthy when it may not be |
| Authority conflict silently rejected | Operator retries rejected action in a loop, escalating their stress |
| Post-incident documentation required before operator can resume operation | Creates pressure that may cause hasty, incomplete documentation |
| Incident timeline available only through navigation | Critical for understanding; must be surfaced, not buried |
| Multiple simultaneous primary action buttons during Stage 3+ incident | Forces decision selection under exactly the conditions that degrade decision quality |

---

*Document status: CANONICAL — Operator Reality Integration Era*
*Do not modify without constitutional governance review*
