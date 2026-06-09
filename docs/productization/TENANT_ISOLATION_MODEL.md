# Tenant Isolation Model

## Isolation Boundaries

Each tenant has isolated:
- Replay sessions (scoped by tenant_id in opts)
- Topology view (filtered by attrs.tenant_id)
- Trace streams (filtered by tenant_id field)
- Policies (TenantPolicyScope filters by tenant_id)
- Quotas (TenantQuotaPolicy per-tenant counters)
- Health (TenantHealth per-tenant dimension tracking)
- Event namespace (`tenant.{tenantId}.{eventType}`)
- Freeze state (TenantContext.freeze() is tenant-local)

## Isolation Diagram

```
Platform
├── Tenant A
│     ├── TenantContext (frozen=false, replays=[], policies=[])
│     ├── TenantHealth  (dimensions: deployment, incidents)
│     ├── TenantPolicyScope (A-specific policies)
│     └── TenantQuotaPolicy (A-specific quotas)
│
└── Tenant B
      ├── TenantContext (frozen=true, replays=[...], policies=[])
      ├── TenantHealth  (DEGRADED)
      ├── TenantPolicyScope (B-specific policies)
      └── TenantQuotaPolicy (B-specific quotas)
```

## No Cross-Tenant Leakage

- Replay sessions filtered: `s.opts.tenant_id === tenantId`
- Topology filtered: `e.attrs.tenant_id === tenantId`
- Policy evaluation scoped: tenant_id injected into context
- Rate limits isolated: key = `tenant:{tenantId}` separate from operator key
- TenantRegistry throws on duplicate tenant registration

## Tenant Lifecycle Isolation

Freezing Tenant A does not affect Tenant B. Each `TenantContext.freeze()` is independent. Platform-level freeze (kernel FROZEN state) propagates to all tenants via `lifecycle.transition('FROZEN')`.

## Convergence: Cross-Tenant Risk

ConvergenceEngine scans orphaned workflows without tenant filter — a workflow with no linked agent is flagged regardless of tenant. This is intentional: orphaned workflows are a platform-level concern.
