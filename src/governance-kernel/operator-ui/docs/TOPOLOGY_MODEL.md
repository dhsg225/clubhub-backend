# TOPOLOGY_MODEL.md
# Governance Kernel v1 — HA Topology Visualization Model

**Status:** FROZEN (A2.0.0)
**Effective:** 2026-05-24

---

## 1. Topology sources

Topology data is sourced from `AuthorityCoordinator.getClusterStatus()` (MEMORY_ONLY)
via the API gateway. The client receives a topology snapshot + event stream updates
from node heartbeats.

Topology data is `CACHE_COHERENT` — it may be up to 120 seconds stale.
For split-brain analysis, the operator should use the "Force DB check" action
which calls `isFrozenStrong(pool)` and `getEpoch()` directly.

---

## 2. Node state model

Each node in the topology carries:

```javascript
{
  id: string,               // node identifier
  last_seen: ISO string,    // lineage_ts of last heartbeat (governed clock)
  status: 'HEALTHY' | 'STALE' | 'EVICTED' | 'UNKNOWN',
  freeze_epoch: number,     // freeze epoch this node last confirmed
  authority_epoch: number,  // authority epoch from last heartbeat
  config_hash: string,      // config hash this node is running
  freeze_state: boolean,    // freeze state reported by this node
}
```

---

## 3. Node status classification

| Status | Criteria | Badge color |
|--------|----------|-------------|
| HEALTHY | last_seen ≤ 30s ago | Green |
| STALE | last_seen 30s–120s ago | Yellow |
| EVICTED | explicitly evicted from cluster | Red |
| UNKNOWN | no heartbeat received | Gray |

The 30s/120s thresholds align with the kernel's `STALE_THRESHOLD_MS` and `CACHE_COHERENT` window.

---

## 4. Split-brain detection

Split-brain is indicated when:

1. Two or more nodes report **different `authority_epoch`** values
2. Two or more nodes report **conflicting `freeze_state`** values
3. Node count exceeds `MAX_NODES` (1000) — eviction logic triggered

Visual treatment for split-brain:
- RED "SPLIT BRAIN" banner displayed
- Both conflicting values shown side-by-side
- All mutations disabled
- "Force DB check" button available

Resolution criteria:
- Both instances report same `authority_epoch` AND same `freeze_state`
- OR operator manually confirms resolution via ADMIN action

---

## 5. Freeze epoch divergence

When two nodes report different `freeze_epoch`:
- Indicates one node did not receive or apply the freeze
- Yellow "FREEZE EPOCH DIVERGENCE" banner
- Shows: Node A epoch=5, Node B epoch=4
- "Force DB check" fetches authoritative state from DB for both

This is the active/active freeze divergence scenario from CONSISTENCY_MODEL.md §3.

---

## 6. Config drift

When two nodes report different `config_hash`:
- Yellow "CONFIG DRIFT" banner
- Shows: Node A hash=a1b2c3, Node B hash=f6e5d4
- Config drift is advisory (MEMORY_ONLY) — not a split-brain safety issue
- Resolution: rolling restart or `govConfig.initFromDb(pool)` on stale instance

---

## 7. Authority confidence scoring

Each node is assigned an authority confidence score:

| Score | Criteria |
|-------|----------|
| HIGH | last_seen < 5s, epoch matches current, freeze_state matches DB |
| MEDIUM | last_seen 5–30s, epoch matches current |
| LOW | last_seen 30–120s, or epoch divergence ≤ 1 |
| NONE | last_seen > 120s, or evicted |

The cluster's overall authority confidence is the minimum of all active node scores.

---

## 8. Replay node isolation

During replay rendering, the topology panel shows:
- Historical topology (reconstructed from heartbeat events up to replay cursor)
- Label: "TOPOLOGY AT [lineage_ts]"
- Mutations disabled
- "Force DB check" disabled (not available during replay — DB state is live, not historical)

---

## 9. DB authority state

The topology panel includes a DB status indicator:
- Green: Last `withAdvisoryLock()` call succeeded within 60s
- Yellow: Last `withAdvisoryLock()` call was 60–300s ago
- Red: DB unreachable or last call failed

If DB is red AND freeze_state is false:
- WARNING: "Freeze state is MEMORY_ONLY — DB unreachable. If DB returns, freeze will be re-confirmed (FAIL_CLOSED)."

---

## 10. Certification level display

The topology panel shows the current kernel certification level:
- From `reports/governance-certification.json`
- HA_PRODUCTION, PRODUCTION_READY, DEVELOPMENT
- PASS / CONDITIONAL / FAIL rating
- Conditional caveats listed

If certification is FAIL: RED banner "KERNEL CERTIFICATION FAILED — deployment blocked".
If certification is CONDITIONAL: Yellow banner with caveat count.
