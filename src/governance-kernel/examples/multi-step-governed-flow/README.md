# Multi-Step Governed Flow Example

Demonstrates a complex multi-step governance workflow with event observation and trace recording.

## Overview

This example shows:
- Defining a 4-step workflow (audit → freeze → audit → unfreeze)
- Executing via the Agent Runtime with full lifecycle tracking
- Observing all `workflow.step.completed` events per step
- Collecting an execution trace suitable for replay

## Prerequisites

- PostgreSQL running locally
- `DATABASE_URL` environment variable set

## Running

```bash
node index.js
```

## What to expect

```
[boot] SDK + Agent runtime initialized
[define] Workflow: governed-deployment-flow (4 steps)
[run] Starting agent execution
[events] agent.lifecycle.changed { from: 'IDLE', to: 'RUNNING' }
[events] workflow.step.completed { step_index: 0, action: 'audit.append' }
[events] workflow.step.completed { step_index: 1, action: 'audit.append' }
[events] workflow.step.completed { step_index: 2, action: 'audit.append' }
[events] workflow.step.completed { step_index: 3, action: 'audit.append' }
[events] agent.workflow.completed { status: 'COMPLETED' }
[events] agent.lifecycle.changed { from: 'RUNNING', to: 'IDLE' }
[trace] Workflow trace: 4 steps COMPLETED
[trace] All steps deterministic: ✓
[done] Multi-step governed flow example complete
```

## Workflow trace

The execution trace captures:
- `step_index` — deterministic step ordering
- `action` — SDK action type (maps to kernel API)
- `consistencyLevel` — declared consistency requirement per step
- `status` — COMPLETED | FAILED | SKIPPED

This trace is replay-compatible — pass to `ReplayClient.replay()` for forensic analysis.

## See also

- [REPLAY_GUIDE.md](../../platform-docs/REPLAY_GUIDE.md)
- [PLUGIN_DEVELOPMENT_GUIDE.md](../../platform-docs/PLUGIN_DEVELOPMENT_GUIDE.md)
- [CERTIFICATION_GUIDE.md](../../platform-docs/CERTIFICATION_GUIDE.md)
