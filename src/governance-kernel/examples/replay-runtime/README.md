# Replay Runtime Example

Demonstrates entering and exiting replay mode with the governance kernel.

## Overview

This example shows how to:
- Enter replay mode with a correlation ID
- Verify that mutations are blocked during replay (`assertNotReplay()`)
- Process events in deterministic order (sorted by `lineage_ts`)
- Exit replay mode and confirm mutations re-enable

## Prerequisites

- PostgreSQL running locally
- `DATABASE_URL` environment variable set

## Running

```bash
node index.js
```

## What to expect

```
[boot] Kernel initialized
[replay] Entering replay mode, correlation: example-replay-001
[replay] Replay mode active: true
[replay] Processing 3 events in lineage_ts order...
[replay]   ts=1000 type=governance.freeze.frozen
[replay]   ts=1042 type=governance.incident.created
[replay]   ts=1087 type=governance.authority.epoch_changed
[replay] Mutation attempt blocked: REPLAY_ISOLATION_VIOLATION
[replay] Exiting replay mode
[replay] Replay mode active: false
[replay] Mutations re-enabled
[done] Replay runtime example complete
```

## Key concepts

- **Replay isolation**: `assertNotReplay()` throws `REPLAY_ISOLATION_VIOLATION` on any mutation attempt
- **Deterministic order**: Events are replayed sorted by `lineage_ts` ascending — not by `received_at`
- **received_at frozen**: Wall-clock timestamps are not updated during replay
- **ForensicView**: Replay produces a read-only, side-effect-free view of past state

## Replay modes

| Mode         | Description                                          |
|--------------|------------------------------------------------------|
| HARD         | Full isolation — all mutations blocked               |
| SOFT         | Advisory warnings on mutations (dev/test only)       |

## See also

- [REPLAY_GUIDE.md](../../platform-docs/REPLAY_GUIDE.md)
- [DETERMINISM_GUIDE.md](../../platform-docs/DETERMINISM_GUIDE.md)
