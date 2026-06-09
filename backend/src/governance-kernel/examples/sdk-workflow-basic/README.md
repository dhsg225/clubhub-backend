# SDK Workflow Basic Example

Demonstrates creating and executing a basic governance SDK workflow.

## Overview

This example shows:
- Initializing the Governance SDK with kernel dependencies
- Defining a workflow with multiple steps
- Executing the workflow via the SDK client
- Observing `workflow.step.completed` events

## Prerequisites

- PostgreSQL running locally
- `DATABASE_URL` environment variable set

## Running

```bash
node index.js
```

## What to expect

```
[boot] SDK initialized
[workflow] Defined: deploy-and-audit (2 steps)
[events] workflow.started { workflow_id: 'deploy-and-audit' }
[events] workflow.step.completed { step_index: 0, action: 'audit.append' }
[events] workflow.step.completed { step_index: 1, action: 'audit.append' }
[events] workflow.completed { workflow_id: 'deploy-and-audit' }
[result] status: COMPLETED
[done] SDK workflow basic example complete
```

## Key concepts

- **WorkflowEngine**: Registers + executes DAG workflows deterministically
- **step_index**: Steps execute in defined index order (deterministic)
- **consistencyLevel**: Each step declares its kernel consistency requirement
- **replayable: true**: All workflows replay-compatible by default

## Workflow definition format

```javascript
{
  id: 'my-workflow',
  replayable: true,
  steps: [
    { action: 'audit.append', args: { ... }, consistencyLevel: 'DB_AUTHORITATIVE' },
    { action: 'deployment.freeze', args: { ... }, consistencyLevel: 'LINEARIZED' },
  ]
}
```

## See also

- [KERNEL_QUICKSTART.md](../../platform-docs/KERNEL_QUICKSTART.md)
- [PLUGIN_DEVELOPMENT_GUIDE.md](../../platform-docs/PLUGIN_DEVELOPMENT_GUIDE.md)
