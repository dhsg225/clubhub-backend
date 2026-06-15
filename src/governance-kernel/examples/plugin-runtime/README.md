# Plugin Runtime Example

Demonstrates integrating the OTA plugin runtime with the governance kernel via dependency injection.

## Overview

This example shows how to:
- Boot the OTA plugin runtime with governance kernel dependencies
- Promote a deployment wave through the governed runtime
- Observe governance events emitted during promotion
- Read runtime snapshot after promotion

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
[boot] OTA plugin runtime initialized
[lifecycle] Runtime state: ACTIVE
[promote] Promoting wave 0 on ring: prod-eu-west-1
[events]   governance.runtime.lifecycle_changed { from: BOOTING, to: ACTIVE }
[events]   governance.authority.epoch_changed { epoch: 2 }
[promote] Wave promotion complete
[snapshot] { lifecycle: 'ACTIVE', epoch: 2, frozen: false }
[done] Plugin runtime example complete
```

## Dependency injection pattern

The OTA runtime receives governance kernel APIs via `init(deps)` — never imports `core/` directly:

```javascript
const runtime = createOTARuntime();
await runtime.init({
  authorityCoordinator,
  freezeController,
  incidentManager,
  configAuthority,
  operatorAuthority,
  auditLedger,
  eventBus,
});
```

## Authority boundary

All plugin code must:
- Import only from `governance-kernel/api/`
- Receive dependencies via `init(deps)`
- Never call `new Pool()` or access DB directly

## See also

- [PLUGIN_DEVELOPMENT_GUIDE.md](../../platform-docs/PLUGIN_DEVELOPMENT_GUIDE.md)
- [AUTHORITY_MODEL_GUIDE.md](../../platform-docs/AUTHORITY_MODEL_GUIDE.md)
- OTA runtime docs: `../../plugins/ota-runtime/docs/`
