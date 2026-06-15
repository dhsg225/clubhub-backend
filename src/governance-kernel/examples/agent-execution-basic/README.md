# Agent Execution Basic Example

Demonstrates running a governance SDK workflow via the Agent Runtime.

## Overview

This example shows:
- Creating an AgentRuntime with a DeterministicContext
- Registering a workflow with the runtime
- Running the workflow — transitions IDLE → RUNNING → IDLE
- Observing `agent.lifecycle.changed` events
- Testing BLOCKED behavior when kernel is frozen

## Prerequisites

- PostgreSQL running locally
- `DATABASE_URL` environment variable set

## Running

```bash
node index.js
```

## What to expect

```
[boot] Agent runtime initialized
[state] current: IDLE
[run] Starting workflow: basic-audit-workflow
[events] agent.lifecycle.changed { from: 'IDLE', to: 'RUNNING', reason: 'starting workflow' }
[events] workflow.step.completed { step_index: 0, action: 'audit.append' }
[events] agent.workflow.completed { workflow_id: 'basic-audit-workflow', status: 'COMPLETED' }
[events] agent.lifecycle.changed { from: 'RUNNING', to: 'IDLE', reason: 'workflow completed' }
[run] result: COMPLETED
[done] Agent execution basic example complete
```

## State machine

```
IDLE ──► RUNNING ──► IDLE        (normal completion)
IDLE ──► RUNNING ──► BLOCKED     (kernel frozen)
any  ──► TERMINATED              (shutdown)
```

## Blocking behavior

When kernel is frozen, `run()` returns `{ status: 'BLOCKED' }` immediately.
No workflow steps are attempted. Operator must unfreeze before running again.

## See also

- [PLUGIN_DEVELOPMENT_GUIDE.md](../../platform-docs/PLUGIN_DEVELOPMENT_GUIDE.md)
- [FAILURE_MODE_GUIDE.md](../../platform-docs/FAILURE_MODE_GUIDE.md)
