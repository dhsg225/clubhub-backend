# PLUGIN_FAILURE_PLAYBOOK.md
# Operator Playbook — Plugin Failure

## Preconditions
- A plugin (e.g., OTA runtime) has entered DEGRADED state or is throwing errors
- Kernel itself may still be ACTIVE

## Required authority
- Role: OPERATOR (monitoring, freeze) / ADMIN (config changes, recovery)

## Commands

```bash
# 1. Check plugin lifecycle state:
GET /api/ota-runtime/runtime/status
# Look for: lifecycle.state, health.warnings, certification_status

# 2. Freeze deployment (precautionary):
POST /api/ota-runtime/deployment/freeze
{ "reason": "Plugin failure — halting mutations", "justification": "OTA runtime DEGRADED; precautionary freeze" }

# 3. Check certification status:
node -e "require('./plugins/ota-runtime').createOTARuntime().certifyRuntime().then(r=>console.log(JSON.stringify(r,null,2)))"

# 4. Check kernel certification (unchanged):
node -e "require('./governance-kernel').GovernanceCertificationRunner && new (require('./governance-kernel').GovernanceCertificationRunner)().run().then(r=>console.log(r.overall_rating))"

# 5. Restart plugin runtime (if process restart required):
# runtime.lifecycle.transition('SHUTDOWN', 'plugin failure recovery')
# createOTARuntime() + runtime.init(deps) + lifecycle.transition('ACTIVE', 'recovered')
```

## Expected events
- `governance.runtime.lifecycle_changed` (ACTIVE → DEGRADED)
- AuditLedger entry for precautionary freeze

## Rollback procedures
- Plugin failure does not affect kernel certification
- After plugin recovery: `lifecycle.transition('RECOVERING' → 'ACTIVE')`
- Re-run plugin certification: `certifyRuntime()`
- Unfreeze only after confirming plugin is ACTIVE and certification PASS

## Failure escalation
- Plugin certification FAIL after recovery: investigate which check failed; do not deploy until resolved
- If `bypassGovernance: true` detected in plugin: immediate block; requires code change and re-certification

## Replay implications
- Plugin DEGRADED events are replayable
- Plugin mutations blocked during DEGRADED state; no partial state to replay

## Certification implications
- Plugin failure does not regress kernel certification (kernel is independent)
- Plugin certification may show FAIL during degraded state — expected; re-run after recovery
