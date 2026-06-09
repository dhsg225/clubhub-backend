# CONFIG_ROLLBACK_PLAYBOOK.md
# Operator Playbook — Config Rollback

## Preconditions
- Config change has caused degraded behavior
- Operator has ADMIN role
- Previous config version known (from GET /config history)

## Required authority
- Role: ADMIN (config update requires ADMIN)

## Commands

```bash
# 1. Inspect current config and history:
GET /api/ota-runtime/config
Authorization: Bearer <token>
# Returns: { snapshot: { config_version, config_hash, changed_keys, ... } }

# 2. Identify previous known-good values:
#    Inspect snapshot.changed_keys to find what changed
#    Cross-reference with AuditLedger entries for config_changed action_type

# 3. Apply rollback changes (manual re-apply of previous values):
POST /api/ota-runtime/config
Authorization: Bearer <token>
{
  "changes": { "ota.ring1_max_pct": 10, "ota.ring2_max_pct": 25 },
  "justification": "Rollback: ring1_max_pct regression caused 12% error rate increase. Reverting to version 4 values."
}

# 4. Verify config hash matches expected:
GET /api/ota-runtime/config
# Verify config_hash matches the hash from the target previous version
```

## Expected events
- `governance.config.updated` on event bus
- AuditLedger entry with action_type `config_changed`, before/after hashes
- Config version incremented

## Rollback procedures
- Config rollback IS itself a forward change (version N+1 with previous values)
- True replay of previous config: apply all `changed_keys` values from target version
- Hash chain is preserved through rollback — integrity is maintained

## Failure escalation
- If config is frozen: `ConfigAuthority.isFrozen()` returns true
  - Unfreeze config: requires calling `ConfigAuthority.unfreeze()` (ADMIN internal op)
- If `ConfigAuthority singleton not initialized`: server restart required
- Hash mismatch after rollback: verify `stableStringify()` key sort is consistent

## Replay implications
- Config change is recorded in event bus as `governance.config.updated`
- Replay of events covering this rollback will show config hash transitions
- `ConfigDiffEngine.hash()` is deterministic — same config produces same hash in replay

## Certification implications
- No certification impact from config rollback
- If config changes affect certification thresholds, re-run `certifyRuntime()`
