# Observability Exports

## Export Layer Design

All exporters are read-only. No exporter can mutate platform state. Exports are deterministic snapshots.

## Exporter Catalog

| Exporter               | Output                             | Format  |
|------------------------|-------------------------------------|---------|
| MetricsExporter        | lifecycle, health, runtime states  | JSON    |
| TopologyExporter       | entity graph snapshot              | JSON    |
| TraceExporter          | decision trace entries + chain     | JSON    |
| CertificationExporter  | cert suite results by phase        | JSON    |
| ConvergenceExporter    | divergence findings + scan         | JSON    |
| ReplayExporter         | active replay sessions             | JSON    |
| EventStreamExporter    | ordered platform event log         | NDJSON  |

## NDJSON Streams

`EventStreamExporter.toNDJSON(since_seq)` emits one JSON object per line:
```
{"seq":1,"type":"platform.lifecycle.transition","fields":{...},"ts":1700000000001}
{"seq":2,"type":"platform.execution.routed","fields":{...},"ts":1700000000002}
```

## Tenant-Scoped Exports

`TopologyExporter.export(tenantId)` and `ReplayExporter.export(tenantId)` filter output to tenant-owned entities. No cross-tenant data in exports.

## Replay Safety

All export snapshots are point-in-time reads. They do not hold locks and do not prevent concurrent operations. Exports are safe to generate at any lifecycle state including FROZEN.

## Integration

Exporters are wired via `createObservabilityExport(deps)` factory. Each exporter receives only the deps it needs (read-only references). No exporter holds an ExecutionRouter or sdkClient reference.
