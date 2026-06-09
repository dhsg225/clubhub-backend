# OTA_RUNTIME_ARCHITECTURE.md
# Phase A3 — OTA Plugin Runtime Architecture

**Phase:** A3 — OTA Plugin Conversion + Governed Runtime Integration
**Status:** COMPLETE
**Effective:** 2026-05-24

---

## 1. Architecture overview

```
BEFORE (A1/A2):                     AFTER (A3):

OTA Routes                          OTA Routes
  → lib/*                             → ota-runtime/routes.js
    → governance primitives              → governed-deployment.js
                                         → governed-incidents.js
                                         → governed-config.js
                                         → governed-operators.js
                                           → Governance Kernel APIs
                                             → governance-kernel/core/*
```

The OTA runtime is a **governed application runtime** — not an authority owner. Every authority operation routes through a kernel API class. The OTA runtime holds zero direct authority.

---

## 2. Module map

```
plugins/ota-runtime/
├── index.js                  — factory + certifyRuntime() entry point
├── lifecycle.js              — UNINITIALIZED → BOOTING → … → SHUTDOWN
├── routes.js                 — governed Express router factory
├── deployment-runtime.js     — in-memory deployment READ model
├── governed-deployment.js    — deployment authority via AuthorityCoordinator + FreezeController
├── governed-incidents.js     — incident authority via IncidentManager
├── governed-config.js        — config authority via ConfigAuthority
├── governed-operators.js     — operator authority via OperatorAuthority
├── replay-hooks.js           — replay isolation surface (no kernel imports)
├── certification/
│   ├── OTARuntimeCertification.js
│   ├── GovernedRoutingCertification.js
│   ├── ReplayIsolationCertification.js
│   ├── AuthorityBypassCertification.js
│   └── LifecycleConsistencyCertification.js
└── docs/
    ├── OTA_RUNTIME_ARCHITECTURE.md    — this file
    ├── GOVERNED_RUNTIME_CONTRACT.md
    ├── REPLAY_EXECUTION_MODEL.md
    ├── PLUGIN_RUNTIME_LIFECYCLE.md
    └── AUTHORITY_BOUNDARY_ENFORCEMENT.md
```

---

## 3. Authority routing map

| Operation | OTA module | Kernel API | Consistency |
|-----------|-----------|------------|-------------|
| Wave promotion | governed-deployment | AuthorityCoordinator.incrementEpoch() | LINEARIZED |
| Freeze | governed-deployment | FreezeController.freeze(reason, pool) | LINEARIZED |
| Freeze local (emergency) | governed-deployment | FreezeController.freezeLocal(reason) | MEMORY_ONLY |
| Unfreeze | governed-deployment | FreezeController.unfreeze(reason) | MEMORY_ONLY |
| Rollback | governed-deployment | FreezeController.freeze() → event | LINEARIZED |
| Deploy complete | governed-deployment | AuthorityCoordinator.incrementEpoch() | LINEARIZED |
| Incident create | governed-incidents | IncidentManager.create() | DB_AUTHORITATIVE |
| Incident transition | governed-incidents | IncidentManager.transition() | CACHE_COHERENT |
| Incident transition (strong) | governed-incidents | IncidentManager.transitionStrong() | LINEARIZED |
| Incident archive | governed-incidents | IncidentManager.archive() | DB_AUTHORITATIVE |
| Config read | governed-config | ConfigAuthority.get/snapshot | CACHE_COHERENT |
| Config update | governed-config | ConfigAuthority.update() | DB_ASYNC |
| Operator auth | governed-operators | OperatorAuthority.requireAuth() | MEMORY_ONLY |
| Token issue | governed-operators | OperatorAuthority.issueToken() | MEMORY_ONLY |
| Token revoke | governed-operators | OperatorAuthority.revokeToken() | DB_ASYNC |
| Audit ledger append | all governed-* | AuditLedger.appendEntry() | DB_ASYNC |
| Audit ledger linearized | governed-operators | AuditLedger.appendLinearized() | LINEARIZED |

---

## 4. Event namespace

All OTA runtime events are emitted through the kernel event bus (`eventBus.emit()`):

| Namespace | Events |
|-----------|--------|
| `governance.deployment.*` | wave_promoted, rollback, complete |
| `governance.authority.*` | freeze_committed, unfreeze_requested |
| `governance.incident.*` | detected, triaged, mitigating, resolved, archived |
| `governance.config.*` | updated |
| `governance.operator.*` | token_issued, token_revoked, action_ledgered |
| `governance.runtime.*` | lifecycle_changed, freeze_local |

All events carry: `event_type`, `event_id`, `deterministic_ts`, `lineage_ts`.

---

## 5. Dependency injection model

The OTA runtime accepts all kernel dependencies via `init(deps)`. It never imports from `governance-kernel/core/` or `lib/` directly. The injection model:

```javascript
const runtime = createOTARuntime();
await runtime.init({
  authorityCoordinator,  // AuthorityCoordinator instance
  freezeController,      // FreezeController instance
  incidentManager,       // IncidentManager instance
  auditLedger,           // AuditLedger instance
  configAuthority,       // ConfigAuthority instance
  operatorAuthority,     // OperatorAuthority instance
  lineageEngine,         // LineageEngine instance (optional)
  eventBus,              // kernel event-bus module (optional)
  clock,                 // DeterministicClock or { nowIso() } (optional)
});
runtime.lifecycle.transition('ACTIVE', 'startup complete');

const router = runtime.createRouter({ pool });
app.use('/api/ota-runtime', router);
```

---

## 6. Backward compatibility

All existing OTA routes, APIs, screen protocol, manifest flow, and rollout semantics are unchanged externally. Phase A3 restructures the internal authority routing only.

**External surface: UNCHANGED**
**Internal authority routing: ALL routes through kernel APIs**
