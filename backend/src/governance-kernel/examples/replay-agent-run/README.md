# Replay Agent Run Example

Demonstrates replaying a recorded workflow execution trace using the ReplayClient.

## Overview

This example shows:
- Recording a workflow execution trace (live run)
- Entering replay mode and replaying the trace via ReplayClient
- Confirming identical `sdk.replay.step` events are emitted
- Verifying replay exits cleanly with `exitReplay()`

## Prerequisites

- No PostgreSQL required — uses mock kernel deps

## Running

```bash
node index.js
```

## What to expect

```
[run] Simulating live workflow execution trace...
[run] Trace recorded: 3 steps
[replay] Entering replay mode, correlation: replay-example-001
[events] sdk.replay.started { correlation_id: 'replay-example-001', step_count: 3 }
[events] sdk.replay.step { step_index: 0, action: 'audit.append' }
[events] sdk.replay.step { step_index: 1, action: 'audit.append' }
[events] sdk.replay.step { step_index: 2, action: 'audit.append' }
[events] sdk.replay.completed { step_count: 3 }
[replay] Exited replay mode
[verify] 3 steps replayed in step_index order ✓
[done] Replay agent run example complete
```

## Replay contract

- Steps are replayed in `step_index` order — not in `received_at` order
- `enterReplay()` called before any trace processing
- `exitReplay()` always called (finally block) — even on error
- No mutations occur during replay

## See also

- [REPLAY_GUIDE.md](../../platform-docs/REPLAY_GUIDE.md)
- [DETERMINISM_GUIDE.md](../../platform-docs/DETERMINISM_GUIDE.md)
