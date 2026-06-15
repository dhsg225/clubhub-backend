# PLUGIN_RUNTIME_FLOW.md
# Plugin Runtime Flow Diagram

```
Application bootstrap
       │
       ▼
createOTARuntime()
       │
       ▼
runtime.init({ authorityCoordinator, freezeController, ... })
  ├──► lifecycle UNINITIALIZED ──► BOOTING
  ├──► governedDeployment.init(deps)
  ├──► governedIncidents.init(deps)
  ├──► governedConfig.init(deps)
  ├──► governedOperators.init(deps)
  ├──► deploymentRuntime.init({ clock })
  └──► lifecycle BOOTING ──► RECOVERING

       │
       ▼
lifecycle.transition('ACTIVE', 'startup complete')  ◄── caller responsibility

       │
       ▼
runtime.createRouter({ pool })
  └──► Express router with governed routes

       │
       ▼  Incoming operator request:
requireAuth(role)
  ├── FAIL ──► 401/403
  └── PASS ──► route handler
                  │
                  ├──► governed-deployment | governed-incidents | governed-config
                  │         │
                  │         ▼
                  │    Kernel API call (AuthorityCoordinator / FreezeController / etc.)
                  │         │
                  │         ▼
                  │    core/ primitive ──► PostgreSQL
                  │
                  ├──► AuditLedger.appendEntry()
                  ├──► eventBus.emit()
                  └──► HTTP response
```

## Lifecycle ↔ replay interaction

```
lifecycle: ACTIVE ──► REPLAY (on enterReplay())
                │
                ▼
  All assertNotReplay() calls ──► REPLAY_ISOLATION_VIOLATION
                │
                ▼
lifecycle: REPLAY ──► ACTIVE (on exitReplay())
                │
                ▼
  SnapshotClient.fetchSnapshot() ──► live state restored
```
