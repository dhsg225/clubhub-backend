# SYSTEM_ARCHITECTURE.md
# Governance Kernel — System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  OPERATOR LAYER                                                       │
│  Browser / CLI                                                        │
│    Bearer Token (HMAC-SHA256 + JTI)                                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP
┌───────────────────────────────▼─────────────────────────────────────┐
│  PLUGIN RUNTIME LAYER                                                 │
│  plugins/ota-runtime/                                                 │
│    routes.js ──► requireAuth(role) ──► governed-deployment.js        │
│                                    ──► governed-incidents.js         │
│                                    ──► governed-config.js            │
│                                    ──► governed-operators.js         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ API calls only
┌───────────────────────────────▼─────────────────────────────────────┐
│  GOVERNANCE KERNEL API LAYER   governance-kernel/api/                │
│  ┌───────────────────┐  ┌────────────────┐  ┌───────────────────┐   │
│  │AuthorityCoordinator│  │FreezeController│  │  IncidentManager  │   │
│  └───────────────────┘  └────────────────┘  └───────────────────┘   │
│  ┌───────────────────┐  ┌────────────────┐  ┌───────────────────┐   │
│  │   AuditLedger     │  │ConfigAuthority │  │OperatorAuthority  │   │
│  └───────────────────┘  └────────────────┘  └───────────────────┘   │
│  ┌───────────────────┐  ┌────────────────┐                           │
│  │  LineageEngine    │  │DeterministicClk│                           │
│  └───────────────────┘  └────────────────┘                           │
│  ┌──────────────────────────────────────┐                            │
│  │  event-bus (ring buffer, 5000 max)   │                            │
│  └──────────────────────────────────────┘                            │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ internal only
┌───────────────────────────────▼─────────────────────────────────────┐
│  GOVERNANCE PRIMITIVES LAYER   governance-kernel/core/               │
│  cluster-consensus  audit-ledger  incident-manager  config-authority │
│  session-authority  lineage       clock              deterministic-id│
└───────────────────────────────┬─────────────────────────────────────┘
                                │ SQL
┌───────────────────────────────▼─────────────────────────────────────┐
│  STORAGE LAYER                                                        │
│  PostgreSQL primary  (pg_advisory_xact_lock for LINEARIZED ops)      │
│  Node A ──┐                                                           │
│  Node B ──┴──► shared primary                                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Hard rule:** Arrows only flow downward. No layer imports from a layer above it.
**HA ceiling:** 2-node active/active. No multi-region. No consensus protocol.
