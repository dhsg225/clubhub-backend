# HA_FAILOVER_PLAYBOOK.md
# Operator Playbook — HA Node Failover

## Preconditions
- One of two cluster nodes is unavailable (process crash, OOM, network partition)
- Remaining node is ACTIVE or DEGRADED
- DB primary is still reachable from remaining node

## Required authority
- Role: ADMIN

## Commands

```bash
# 1. Verify surviving node state:
GET /api/ota-runtime/runtime/snapshot
# Check: epoch, freeze state, active incidents

# 2. Confirm freeze state is authoritative:
# This forces DB_AUTHORITATIVE check on surviving node
POST /api/ota-runtime/deployment/freeze
{ "reason": "HA failover — precautionary freeze during single-node operation",
  "justification": "Node B unavailable; freezing to prevent partial rollout" }

# 3. Verify topology shows the failed node as STALE/EVICTED:
GET /api/ota-runtime/runtime/status
# Look for: topology.nodes[nodeB].status === 'STALE' or 'EVICTED'

# 4. If split-brain detected — resolve:
# UI will show CRITICAL split-brain alert and block mutations
# Use operator UI "Force DB Check" → confirms current state
# Then clear split-brain (operator UI action)

# 5. After failed node recovery — verify epoch sync:
# Both nodes should show same authority_epoch after recovery
```

## Expected events
- `governance.cluster.node_stale` when node stops heartbeating (> 30s)
- `governance.authority.split_brain_detected` if epochs diverge
- `governance.authority.freeze_committed` on precautionary freeze

## Rollback procedures
- After second node recovers: unfreeze if business allows
- Verify second node epoch matches surviving node before unfreezing
- `POST /deployment/unfreeze` with ADMIN role

## Failure escalation
- Both nodes unreachable: DB may still be available; restore nodes before operator actions
- DB primary fails: infrastructure-level failover required; kernel cannot self-heal

## Replay implications
- Failover events are recorded in event bus
- After recovery, operators can replay the failover window for forensic analysis

## Certification implications
- HA ceiling remains 2-node; this playbook is the defined operational response within that ceiling
- After recovery run `certifyRuntime()` to confirm no regression
