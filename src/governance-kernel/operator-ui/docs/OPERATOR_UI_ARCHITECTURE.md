# OPERATOR_UI_ARCHITECTURE.md
# Governance Kernel v1 — Operator Control Plane Architecture

**Status:** FROZEN (A2.0.0)
**Phase:** A2 — Operator Control Plane + Governed UX Foundation
**Effective:** 2026-05-24

---

## 1. Architectural premise

The Operator Control Plane is a **governed view layer** over kernel authority state.

It is NOT:
- an authority source
- a command originator with kernel-level trust
- a state machine that operates independently of the kernel
- a shortcut around governance APIs

It IS:
- a read model that reflects authoritative kernel state
- a submission layer that routes operator intent to governed APIs
- a visualization layer that surfaces consistency level, replay mode, and authority epoch
- a certification-verifiable layer with its own invariants

The kernel remains the sole authority. The UI is always subordinate.

---

## 2. Four-layer model

```
┌─────────────────────────────────────────────────────────────────┐
│  OPERATOR LAYER — human decision                                │
│  ADMIN / OPERATOR / VIEWER roles                                │
│  Session token with JTI, expiry, revocation check              │
└────────────────────────┬────────────────────────────────────────┘
                         │ governed intent submission
┌────────────────────────▼────────────────────────────────────────┐
│  CONTROL PLANE LAYER — transport + state                        │
│  GovernedEventStream — event reconciliation                     │
│  SnapshotClient — authoritative snapshot fetch                  │
│  GovernedStateStore — read model (no mutations)                 │
│  Replay mode isolation — live vs frozen view                    │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP / governed API calls only
┌────────────────────────▼────────────────────────────────────────┐
│  API GATEWAY LAYER — server-side                                │
│  OperatorAuthority.requireAuth() middleware                     │
│  Governed API routes — maps to kernel methods                   │
│  No direct core/ access — only through api/ classes            │
│  Audit logging — every operator command attributed              │
└────────────────────────┬────────────────────────────────────────┘
                         │ kernel API calls only
┌────────────────────────▼────────────────────────────────────────┐
│  KERNEL LAYER — authority                                       │
│  GovernanceKernel — lifecycle + replay                         │
│  FreezeController — LINEARIZED authority                        │
│  IncidentManager — governed state machine                       │
│  ConfigAuthority — hash-pinned config                           │
│  AuditLedger — immutable ledger                                 │
│  OperatorAuthority — token + role management                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Authority separation rules

### Client-side rules (HARD — certified)

1. **CLIENT_NO_DIRECT_AUTHORITY**: Client code MUST NOT call kernel `core/` modules directly.
   Any state mutation must travel through API gateway → governed API route → kernel api/ class.

2. **CLIENT_READ_MODEL_ONLY**: `GovernedStateStore` is read-only. There is no write method on the store.
   Mutations are submitted as commands and reflected via event reconciliation after server confirmation.

3. **CLIENT_NO_OPTIMISTIC_LINEARIZED**: Optimistic updates are FORBIDDEN for LINEARIZED operations
   (freeze, epoch increment, linearized incident transitions). The UI MUST wait for server confirmation
   before updating state.

4. **CLIENT_EPOCH_DISPLAY**: The UI MUST display `authority_epoch` on all authority-sensitive surfaces.
   An operator must never be uncertain about which epoch their view reflects.

5. **CLIENT_CONSISTENCY_LABEL**: Every data surface must declare its consistency level to the operator.
   MEMORY_ONLY, CACHE_COHERENT, DB_AUTHORITATIVE, and LINEARIZED surfaces use distinct visual
   indicators.

### Server-side rules (HARD — certified)

6. **SERVER_NO_RAW_CORE**: API gateway routes MUST NOT import from `governance-kernel/core/` directly.
   Only `governance-kernel/api/` classes are permitted.

7. **SERVER_AUTH_REQUIRED**: Every mutating route MUST pass through `OperatorAuthority.requireAuth()`.
   VIEWER role routes that expose sensitive data also require auth.

8. **SERVER_AUDIT_EVERY_COMMAND**: Every operator command (freeze, incident transition, config proposal)
   MUST be logged to AuditLedger with `operator_id`, `role`, `command`, `justification`, and `jti`.

9. **SERVER_REPLAY_ISOLATION**: When serving a replay stream, the server MUST prevent the client from
   submitting mutating commands. Replay mode is read-only.

---

## 4. Operator intent submission flow

```
Operator clicks "Freeze deployment"
        │
        ▼
FreezeOperationPanel.submit(reason)
        │
        ▼
GovernedCommandSubmitter.submit({
  command: 'FREEZE',
  reason,
  justification,
  session_token
})
        │ POST /api/governance/freeze
        ▼
API Gateway: OperatorAuthority.requireAuth('OPERATOR')
        │
        ▼
AuditLedger.appendEntry({ action: 'FREEZE_SUBMITTED', ... })
        │
        ▼
FreezeController.freeze(reason, pool)    ← LINEARIZED
        │
        ▼
Server emits governance.kernel.freeze_confirmed via event stream
        │
        ▼
GovernedEventStream receives freeze_confirmed
        │
        ▼
GovernedStateStore.dispatch(freezeConfirmed(event))
        │
        ▼
FreezePanel renders FROZEN state with epoch + reason
```

No optimistic updates. The freeze panel shows PENDING until confirmation arrives.

---

## 5. Snapshot reconciliation model

On connect (or reconnect), the client:

1. Fetches authoritative snapshot via `SnapshotClient.fetchSnapshot()`
2. Loads snapshot into `GovernedStateStore` as baseline
3. Subscribes to `GovernedEventStream` starting from snapshot `sequence_id`
4. Reconciles events on top of snapshot

If event stream gap is detected (missing `sequence_id` range):
- Client MUST refetch snapshot rather than extrapolating
- Stale state banner shown until reconciliation completes

---

## 6. Replay rendering isolation

When the client enters REPLAY mode:

1. Live event stream is PAUSED (no new events applied)
2. `GovernedStateStore` enters `replay_rendering` mode
3. State mutations are sourced from replay event array only
4. UI surfaces show REPLAY MODE indicator
5. Mutating commands are DISABLED at the UI layer
6. Replay timeline drives `lineage_ts` forward

Exit from replay mode:
1. Snapshot refetch (to reset to current live state)
2. Event stream resumed from current cursor
3. UI surfaces return to LIVE indicators

---

## 7. Split-brain visualization

When two instances report divergent `authority_epoch` or `freeze_state`:

- Both instance states shown side-by-side
- SPLIT BRAIN banner displayed
- All mutating commands DISABLED until split brain resolves
- `TOPOLOGY_MODEL.md` defines exact resolution criteria

Operators MUST use `isFrozenStrong(pool)` to get DB-authoritative answer.
The UI routes this via API gateway with a "force DB check" flag.

---

## 8. Stale state handling

| Consistency level | Stale indicator | Action |
|------------------|-----------------|--------|
| MEMORY_ONLY | Yellow badge — "local state" | Tooltip explains limitation |
| CACHE_COHERENT (< 120s) | Green | Timestamp shown |
| CACHE_COHERENT (> 120s) | Yellow badge — "stale" | Refresh link |
| DB_AUTHORITATIVE | Green with DB icon | No warning |
| LINEARIZED (confirmed) | Green with lock icon | No warning |

---

## 9. What is NOT in scope for v1

- Real-time WebSocket push (uses polling + snapshot reconciliation)
- AI-assisted operator decisions
- Multi-domain cross-visualization
- Client-side policy evaluation
- Autonomous operator approval

These are advisory-only gaps documented for v2.
