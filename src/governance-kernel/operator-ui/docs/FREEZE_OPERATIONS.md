# FREEZE_OPERATIONS.md
# Governance Kernel v1 — Freeze Operations UX Contract

**Status:** FROZEN (A2.0.0)
**Effective:** 2026-05-24

---

## 1. Freeze authority model

Freeze is a LINEARIZED operation. The UI must never assume a freeze is active
or inactive without DB confirmation from `FreezeController.isFrozenStrong(pool)`.

The UI distinguishes three freeze knowledge states:

| UI State | Meaning | Source |
|----------|---------|--------|
| `FROZEN_CONFIRMED` | Freeze confirmed by DB | DB_AUTHORITATIVE or LINEARIZED event |
| `FROZEN_CACHE` | Freeze flag set in kernel memory (CACHE_COHERENT) | In-memory read ≤ 120s ago |
| `UNFROZEN_CACHE` | Unfreeze flag set (MEMORY_ONLY) | In-memory read |
| `FREEZE_UNKNOWN` | Cannot determine freeze state | Stale / transport error |

Operators in safety-critical paths MUST trigger a "Force DB check" to get `FROZEN_CONFIRMED`.

---

## 2. Freeze submission workflow

```
Operator selects: "Freeze deployment"
    │
    ▼
FreezeOperationPanel shows:
  - Reason input (required)
  - Justification input (required — appended to AuditLedger)
  - Current epoch display
  - Current freeze state (with confidence badge)
  - Estimated impact: "All nodes will halt OTA delivery"
    │
    ▼
Operator confirms → GovernedCommandSubmitter.submit({ command: 'FREEZE', ... })
    │
    ▼
UI state: FREEZE_PENDING (spinner, mutations disabled)
    │
    ▼ POST /governance/freeze (requires OPERATOR or ADMIN role)
    │
    ▼
Server: FreezeController.freeze(reason, pool) — LINEARIZED
    │
    ▼
Server emits: governance.kernel.freeze_confirmed
    │
    ▼
UI state: FROZEN_CONFIRMED (DB-confirmed badge)
    │
    ▼
AuditLedger entry visible in audit surface
```

**NO OPTIMISTIC UPDATE.** The freeze panel shows PENDING until the server confirms.

---

## 3. FAIL_CLOSED visualization

When `FreezeController.freeze()` is called and DB fails:
- Default policy: FAIL_CLOSED — freeze occurs in memory
- Server emits: `governance.kernel.freeze_local` (not `freeze_confirmed`)
- UI shows: `FROZEN_LOCAL` state with yellow badge
- Tooltip: "Freeze applied locally — DB confirmation pending. Use 'Force DB check' to verify."

The UI MUST distinguish `FROZEN_CONFIRMED` from `FROZEN_LOCAL`. This is not a cosmetic distinction.

---

## 4. Freeze epoch visibility

Every freeze panel MUST display:
- Current `freeze_epoch` (from `FreezeController.getFreezeEpoch()`)
- `authority_epoch` at time of freeze
- Time since freeze confirmed
- Which operator initiated the freeze (from AuditLedger attribution)

The freeze_epoch is the deterministic identifier for a specific freeze/unfreeze cycle.
Operators use it to correlate freeze events across instances in split-brain scenarios.

---

## 5. Freeze divergence warning

In active/active topology:
- Instance A may show `frozen: true`
- Instance B may show `frozen: false` (CACHE_COHERENT staleness)

The topology surface detects this divergence and shows:
- **FREEZE DIVERGENCE** warning
- Both instance states displayed
- "Force DB check" button triggers `getFreezeStateStrong(pool)` on both instances
- Resolution: both instances converge after DB read

---

## 6. Stale freeze detection

The freeze panel shows a stale indicator when:
- `received_at` of freeze slice > `CACHE_COHERENT_STALE_THRESHOLD_MS` (120s)
- Transport is interrupted
- Event stream has a gap in freeze events

Stale freeze → show "FREEZE STATE UNKNOWN" with yellow badge.
Do NOT show "not frozen" when data is stale. Fail safe toward uncertainty.

---

## 7. Unfreeze workflow

Unfreeze is EVOLVABLE / MEMORY_ONLY — weaker than freeze by design.

```
Operator selects: "Unfreeze deployment"
    │
    ▼
UI shows: Confirmation dialog
  - "This will allow deployment operations to resume"
  - "DB sync may take up to 120s to propagate to all instances"
  - Reason input (required)
    │
    ▼
Operator confirms → POST /governance/unfreeze (requires ADMIN role)
    │
    ▼
Server: FreezeController.unfreeze(reason) — MEMORY_ONLY
    │
    ▼
Server emits: governance.kernel.unfreeze
    │
    ▼
UI state: UNFROZEN_CACHE (yellow badge — "memory only, syncing")
    │
    After 120s or "Force DB check":
    ▼
UI state: UNFROZEN_CONFIRMED (if DB confirms)
```

The unfreeze badge intentionally shows less confidence than freeze.
This is not a UI bug — it reflects the asymmetric safety design.

---

## 8. DB failure policies visualization

The freeze panel displays the current `DB_FAILURE_POLICY`:

| Policy | UI label | Badge color |
|--------|----------|-------------|
| FAIL_CLOSED | "Fail safe (default)" | Green |
| FAIL_OPEN | "Fail open (NOT recommended)" | Red warning |
| STALE_OK | "Use last known state" | Yellow |

If `FAIL_OPEN` is detected, the UI shows a persistent red banner:
"WARNING: Freeze policy is FAIL_OPEN — DB failures will NOT trigger freeze"

---

## 9. Replay mode (freeze events)

During replay, freeze events are rendered as timeline annotations:
- FREEZE events: red vertical line on timeline
- UNFREEZE events: green vertical line on timeline
- Each annotation shows: reason, epoch, operator_id, lineage_ts
- Clicking annotation seeks ReplayTimeline to that event
- ForensicView.buildBeforeAfterComparison() shows state delta at that point
