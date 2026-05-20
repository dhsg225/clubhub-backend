# Distributed Authority

`backend/src/lib/distributed-authority.js`

DB-backed authority lease for multi-instance rollout coordination. Uses the
`authority_leases` table with a single `singleton` row. Only one holder may
have a valid lease at any time.

## Lease Model

- One row, `lease_id = 'singleton'`, always.
- A holder is the instance whose `holder_id` matches the row AND whose `expires_at > now`.
- Any instance can attempt `acquireLease()`; only the current holder or an expired row
  results in a successful acquire.

## TTL

Default: 30,000 ms (30 seconds). Override with `AUTHORITY_LEASE_TTL_MS` env var.
Holders must call `renewLease()` before expiry to maintain authority.

## holder_id

```
process.env.BACKEND_INSTANCE_ID ?? `${os.hostname()}:${process.pid}`
```

In single-instance deployments, this is deterministic per process. In HA,
`BACKEND_INSTANCE_ID` must be set to a stable unique value per instance.

## Epoch Monotonicity

`epoch` increments each time `acquireLease()` succeeds after expiry for a
different holder. The epoch never decrements. This allows consumers to detect
when authority has changed hands.

## Freeze Propagation

`propagateFreeze(reason)` sets `frozen = true` in the DB row, visible to all
instances on next `getState()` call. Emits `AUTHORITY.freeze_propagated` to the
in-memory event log. `clearFreeze()` reverses this.

## Authority Events (in-memory)

| Event | When |
|-------|------|
| `AUTHORITY.acquired` | This instance successfully acquired the lease |
| `AUTHORITY.lost` | acquireLease returned but another instance holds the lease |
| `AUTHORITY.conflict` | DB error during acquire attempt |
| `AUTHORITY.stale` | Lease found expired (not yet emitted automatically) |
| `AUTHORITY.freeze_propagated` | propagateFreeze() was called |

## DB Schema

```sql
CREATE TABLE IF NOT EXISTS authority_leases (
  lease_id      TEXT PRIMARY KEY DEFAULT 'singleton',
  holder_id     TEXT NOT NULL,
  epoch         INTEGER NOT NULL DEFAULT 1,
  acquired_at   BIGINT NOT NULL,
  expires_at    BIGINT NOT NULL,
  frozen        BOOLEAN NOT NULL DEFAULT false,
  freeze_reason TEXT,
  updated_at    BIGINT NOT NULL
)
```

## Single-Instance vs HA Behavior

**Single instance:** `acquireLease()` always succeeds. Epoch stays at 1.
`isLeaseHolder()` is always true while the process is healthy.

**HA (multiple instances):** Only one instance holds the lease at a time.
Others get `acquired: false` from `acquireLease()`. They must wait for expiry
to attempt again. Lease must be renewed proactively.

## Failure Scenarios

**Lease expiry (no renewal):** After TTL, any other instance can acquire the
lease. In-flight rollout operations from the previous holder are NOT automatically
cancelled — they continue to run with a stale authority assumption.

**DB unavailable:** `acquireLease()` catches the error, emits `AUTHORITY.conflict`,
and returns `{ acquired: false }`. Callers must treat this as authority loss.
There is no in-memory fallback.

**Split-brain (network partition):** Both instances may believe they hold the
lease if clock skew causes simultaneous acquire with non-overlapping DB visibility.
The DB `ON CONFLICT DO UPDATE` provides atomic resolution at the SQL level, but
only if the DB is reachable from both. If the DB is partitioned, no resolution occurs.

## Invariants

- Only one `singleton` row ever exists.
- `epoch` monotonically increases.
- `propagateFreeze` is visible to all instances that call `getState()`.
- `init()` creates the table and attempts initial acquire — safe to call on startup.
