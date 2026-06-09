# EVENT_LINEAGE_FLOW.md
# Event Lineage Flow Diagram

```
Root event (e.g., operator freeze command)
  event_id: "aabb1122"
  correlation_id: "freeze-op-001"
  caused_by: null
  authority_epoch: 7
       │
       ├──► freeze_committed event
       │      event_id: "ccdd3344"
       │      correlation_id: "freeze-op-001"
       │      caused_by: "aabb1122"        ◄── causal link
       │      authority_epoch: 7
       │
       └──► audit_ledger_entry event
              event_id: "eeff5566"
              correlation_id: "freeze-op-001"
              caused_by: "aabb1122"        ◄── causal link
              authority_epoch: 7
```

## Lineage anomaly types

```
ORPHANED_EVENT              — caused_by references event not in store
BROKEN_CAUSAL_CHAIN         — gap in parent chain (skipped event)
CROSS_INCIDENT_CONTAMINATION — event references wrong incident_id vs parent
MISSING_AUTHORITY_CONTEXT   — governed event emitted without authority_epoch
DUPLICATE_CORRELATION       — two unrelated events share correlation_id
```

## Verification

```javascript
const lineageEngine = new LineageEngine();
const result = lineageEngine.verifyLineage(events, { strict: true });
// result.anomalies[] — list of detected anomaly objects
// result.valid       — true if no anomalies
```

## Lineage fields on every governed event

```
correlation_id      — ties events belonging to same logical operation
caused_by           — event_id of parent event
authority_epoch     — cluster epoch at emission time
incident_id         — active incident (optional)
policy_decision_id  — policy that caused this event (optional)
```
