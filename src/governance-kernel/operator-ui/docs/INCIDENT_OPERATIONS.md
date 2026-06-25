# INCIDENT_OPERATIONS.md
# Governance Kernel v1 — Incident Operations UX Contract

**Status:** FROZEN (A2.0.0)
**Effective:** 2026-05-24

---

## 1. Incident identity model

Incidents have **content-addressed IDs** (SHA-256 of `{type, severity, causal_chain}`).
The UI must display and use these deterministic IDs — never server-generated sequence IDs as the
primary identifier.

Properties of deterministic incident IDs:
- Same incident re-created with same inputs produces the same ID
- Two incidents with different `causal_chain` produce different IDs
- IDs are stable across replay
- Operators should use IDs to cross-reference logs, audit entries, and incidents

---

## 2. Incident lifecycle visualization

```
DETECTED → TRIAGED → MITIGATING → FROZEN → RECOVERING → RESOLVED → POSTMORTEM_REQUIRED
```

Each state has a distinct visual treatment:

| State | Label | Visual |
|-------|-------|--------|
| DETECTED | "New" | Red badge |
| TRIAGED | "In triage" | Orange badge |
| MITIGATING | "Mitigation active" | Yellow badge |
| FROZEN | "Frozen" | Blue badge (matches freeze state) |
| RECOVERING | "Recovering" | Cyan badge |
| RESOLVED | "Resolved" | Green badge |
| POSTMORTEM_REQUIRED | "Post-mortem required" | Purple badge |

Terminal states (RESOLVED, POSTMORTEM_REQUIRED) show a "View history" button that
opens the ForensicView for that incident.

---

## 3. Incident transition submission

### OPERATOR-level transition (MEMORY_ONLY)

```
Operator selects new state → transition form shows:
  - From state → To state
  - Reason (required)
  - Estimated downstream impact
    │
    ▼
POST /governance/incidents/:id/transition
    │
    ▼
Server: IncidentManager.transition(id, toState, reason) — MEMORY_ONLY
    │
    ▼
Server emits: governance.incident.transitioned
    │
    ▼
UI updates from event (no optimistic update)
```

### ADMIN-level strong transition (LINEARIZED)

Available for FROZEN → RECOVERING (unfreezing an incident-driven freeze):

```
POST /governance/incidents/:id/transition-strong
    │
    ▼
Server: IncidentManager.transitionStrong(pool, id, state, reason) — LINEARIZED
    │
    ▼
Server emits: governance.incident.transitioned (with linearized_confirmed: true)
    │
    ▼
UI shows LINEARIZED badge on transition
```

---

## 4. Causal chain visualization

Every incident created with a `causal_chain` value displays a causal chain panel:

```
[Incident A] ←── caused_by ─── [Incident B] ←── caused_by ─── [Incident C]
     │                               │
  RESOLVED                       MITIGATING
```

The causal chain is reconstructed from:
- `causal_chain` field on the incident
- `correlation_id` linking related events
- `caused_by` links in lineage

ForensicView.buildIncidentReport() reconstructs the full causal chain from the event log.

---

## 5. Lineage graph

The lineage graph panel shows all events with matching `correlation_id`.

Each event node displays:
- `event_type`
- `lineage_ts`
- `operator_id` (if attributable)
- `authority_epoch`
- Lineage anomalies (ORPHANED_EVENT, BROKEN_CAUSAL_CHAIN, etc.)

**Lineage anomaly indicators:**

| Anomaly | UI label | Explanation |
|---------|----------|-------------|
| ORPHANED_EVENT | "No causal parent" | Event has no caused_by link |
| BROKEN_CAUSAL_CHAIN | "Chain break" | caused_by points to missing event |
| CROSS_INCIDENT_CONTAMINATION | "Cross-incident event" | Event linked to multiple incidents |
| MISSING_AUTHORITY_CONTEXT | "No authority context" | Event missing authority_epoch |
| DUPLICATE_CORRELATION | "Duplicate" | Same correlation_id on unrelated events |

During REPLAY mode, ORPHANED_EVENT anomalies are suppressed (per REPLAY_CONTRACT.md §5).

---

## 6. Deterministic incident replay

Clicking "Replay incident" on a resolved incident:
1. Loads incident event set via GET /governance/incidents/:id/events
2. Passes events to ReplayTimeline.load()
3. GovernedStateStore.enterReplayMode()
4. Advances timeline from incident creation to resolution
5. Each step renders incident state at that point in time

Replay rendering mode:
- Mutations disabled
- REPLAY banner visible
- Timeline controls active

---

## 7. Incident archival

When incidents are archived via `IncidentManager.archiveResolved(pool)`:
- UI removes them from "active" view
- They appear in "archived" view with faded styling
- "View history" still opens ForensicView for each
- Archive operation is DB_SYNC — UI waits for confirmation

---

## 8. MAX_ACTIVE_INCIDENTS enforcement

When `getActive().length >= MAX_ACTIVE_INCIDENTS (500)`:
- UI shows: "Maximum active incidents reached (500/500)"
- "Create incident" button disabled
- Tooltip: "Archive resolved incidents to create new ones"
- AuditLedger button shown: "Archive now (requires ADMIN)"

---

## 9. Rendering mode distinctions

| Mode | Incident panel behavior |
|------|------------------------|
| LIVE | Full interaction — create, transition, archive |
| REPLAY | Read-only — historical state per cursor |
| FORENSIC | Overlay — historical + current side by side |
| SIMULATION | Read-only — simulated incident states |
