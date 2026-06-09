# Fleet Consensus

**Enforcement location:** `backend/src/lib/fleet-consensus.js`, `backend/src/routes/manifest.js`
**Probe tool:** `simulator/fleet-divergence.js`
**Contract check:** `validate-contracts.js` check 17 — `fleet_consensus`

---

## What it is

Every manifest response now carries two lineage fields:

```json
{
  "authority_epoch":    1,
  "manifest_generation": 3,
  ...manifest content...
}
```

Screens echo these values back on their next poll via query parameters. The fleet consensus engine (`fleet-consensus.js`) compares reported values across all active screens to detect divergence.

---

## Authority epoch

`authority_epoch` is a process-lifetime integer that increments on each call to `incrementEpoch()`. Its primary purpose is detecting **backend restarts**: if screens report epoch N but the backend is now at epoch N+1, a quorum check determines whether the fleet has re-established authority.

`incrementEpoch()` should be called from `PLATFORM.startup` event handler. Currently it is initialized to `1` at module load.

---

## Manifest generation

`manifest_generation` increments each time manifest content changes (via `incrementManifestGeneration()`). This field is separate from `checksum` — it provides a monotonic ordering guarantee that `checksum` alone cannot provide.

---

## Screen heartbeat

Screens report lineage on every manifest poll:

```
GET /manifest?screen_id=sim-01
              &authority_epoch=1
              &manifest_version=3
              &manifest_hash=abc123
              &previous_manifest_hash=xyz789
              &rollout_version=1.2.0
              &applied_at=1716000000000
```

The manifest route calls `fleetConsensus.recordHeartbeat(screen_id, {...})` before returning the response. Screens that do not yet report these fields are tracked but excluded from divergence analysis (they appear as `authority_epoch: null`).

---

## Consensus states

| State | Condition |
|---|---|
| `HEALTHY` | All active screens on current epoch and generation; no stale screens |
| `DEGRADED` | Fewer than 60% of active screens on current manifest generation |
| `SPLIT_BRAIN` | More than 2 distinct manifest checksums across active screens |
| `AUTHORITY_LOSS` | No active screen has seen the current `authority_epoch` |
| `STALE_SCREEN` | One or more screens silent for > 120 s (but below SPLIT_BRAIN threshold) |

A screen is **stale** if `received_at` (backend time of last poll) is more than `STALE_THRESHOLD_MS` (120 s) ago.

---

## Automatic freeze triggers

**`SPLIT_BRAIN`** — sets `rollout_frozen = true`. Ring promotions must check `isRolloutFrozen()` before proceeding. The freeze reason is recorded as `"SPLIT_BRAIN: N distinct manifest hashes across fleet"`.

**`AUTHORITY_LOSS`** — also sets `rollout_frozen = true`. Rejects ring promotions until a quorum of screens re-establishes the current epoch.

Freeze is cleared by `unfreezeRollout(reason)` — an explicit operator call only.

---

## Split-brain detection

```
if (distinct manifest checksums across active screens > SPLIT_BRAIN_THRESHOLD(2)):
  status = SPLIT_BRAIN
  rollout_frozen = true
```

The threshold of 2 allows for one version in the process of rolling out (new and old manifest coexisting briefly). Three or more distinct versions indicates an irreconcilable divergence.

---

## Divergence probe: `simulator/fleet-divergence.js`

Polls all screens and produces `reports/consensus-health.json`:

```sh
node simulator/fleet-divergence.js
node simulator/fleet-divergence.js --backend=http://localhost:4000 --screens=10
node simulator/fleet-divergence.js --watch --interval=30000
```

Report format:
```json
{
  "generated_at": "...",
  "backend": "http://localhost:4000",
  "consensus": {
    "status": "HEALTHY",
    "rollout_frozen": false,
    "divergences": [],
    "summary": { "healthy": 10, "errored": 0, "distinct_checksums": 1 }
  },
  "screens": [...]
}
```

---

## Invariants

1. Every manifest response includes `authority_epoch` and `manifest_generation` — enforced by validate-contracts.js check 17.
2. `SPLIT_BRAIN` detection always triggers a rollout freeze — the freeze path is in the same code branch as the status assignment.
3. `isRolloutFrozen()` returns a synchronous boolean — no async I/O in the critical path.
4. Screen records are in-memory only — a backend restart clears all heartbeat history. This is by design: post-restart, screens must re-register by polling.
5. `unfreezeRollout()` requires an explicit reason string — no silent unfreeze.

---

## Limitations

- Heartbeat data is in-memory per backend process. In a multi-instance backend deployment, each instance has an independent view. True distributed consensus requires a shared store (Redis, database) — not implemented.
- `authority_epoch` is not persisted. A backend restart resets it to 1 regardless of previous state. Screens that reported epoch 5 before restart will trigger `AUTHORITY_LOSS` until they poll again.
- Screens that never report lineage fields (legacy or unpatched) contribute `null` epoch/version values. They are excluded from split-brain analysis but counted in total screen counts.
- The 2-distinct-checksum threshold for split-brain allows rolling updates. It does not distinguish between a legitimate rolling update and actual split-brain during a stuck rollout. Operators should use `manifest_generation` divergence as a secondary signal.
- `manifest_generation` is not persisted. It resets to 1 on backend restart regardless of the true manifest change history.
