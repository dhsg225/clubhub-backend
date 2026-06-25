# Basic Kernel Example

Demonstrates the minimal governance kernel boot sequence and core API usage.

## Overview

This example shows how to:
- Initialize the governance kernel with a PostgreSQL pool
- Use `FreezeController` to freeze and unfreeze a deployment
- Use `AuthorityCoordinator` to read and increment the authority epoch
- Use `AuditLedger` to append and read audit entries

## Prerequisites

- PostgreSQL running locally
- `DATABASE_URL` environment variable set

## Running

```bash
node index.js
```

## What to expect

```
[boot] Governance kernel initialized
[epoch] Current authority epoch: 1
[freeze] Freezing deployment: example freeze
[freeze] frozen=true epoch=1
[audit] Appended 2 audit entries
[epoch] Incrementing epoch (LINEARIZED)...
[epoch] New epoch: 2
[unfreeze] Unfreezing...
[freeze] frozen=false
[done] Basic kernel example complete
```

## Key concepts

- **Dependency injection**: API classes receive `pool` as a dependency, never import `core/` directly
- **LINEARIZED operations**: `incrementEpoch()` acquires `pg_advisory_xact_lock` — total order across nodes
- **DB_AUTHORITATIVE reads**: `isFrozenStrong(pool)` confirms freeze state from DB, not memory cache
- **Audit trail**: All mutations append to the ledger with operator attribution

## See also

- [KERNEL_QUICKSTART.md](../../platform-docs/KERNEL_QUICKSTART.md)
- [AUTHORITY_MODEL_GUIDE.md](../../platform-docs/AUTHORITY_MODEL_GUIDE.md)
