# SECURITY_RESPONSE_PLAYBOOK.md
# Operator Playbook — Security Response

## Preconditions
- Security incident detected: compromised operator account, token theft, unauthorized access

## Required authority
- Role: ADMIN

## Commands

```bash
# 1. Revoke specific JTI (known compromised token):
# Via OperatorAuthority (internal call or admin endpoint):
await operatorAuthority.revokeToken(jti, { reason: 'suspected_compromise', revokedBy: 'ops-admin' });

# 2. Revoke all tokens for an operator:
await operatorAuthority.revokeOperator(operatorId, { reason: 'account_compromise' });

# 3. Freeze deployment immediately (precautionary):
POST /api/ota-runtime/deployment/freeze
{ "reason": "Security incident — compromised operator account",
  "justification": "Token theft suspected; freezing until investigation complete" }

# 4. Inspect AuditLedger for unauthorized actions:
node -e "
const { AuditLedger } = require('./governance-kernel/api/AuditLedger');
const ledger = new AuditLedger();
console.log(JSON.stringify(ledger.getEntries().filter(e => e.operator_id === 'suspected-user'), null, 2));
"

# 5. Rotate signing key (invalidates ALL tokens):
await operatorAuthority.rotateSigningKey({ reason: 'security_incident', rotatedBy: 'ops-admin' });
# All operators must re-issue tokens after rotation
```

## Expected events
- `governance.operator.token_revoked` for each revoked JTI
- `governance.operator.key_rotated` on signing key rotation
- `governance.authority.freeze_committed` on precautionary freeze
- AuditLedger entries for all actions above

## Rollback procedures
- Revocation is permanent — tokens cannot be un-revoked
- Key rotation is irreversible — all prior tokens are invalidated
- After investigation: issue new tokens for authorized operators
- Unfreeze only after confirming no further unauthorized activity

## Failure escalation
- `OPERATOR_SECRET_KEY` compromised: key rotation required AND key storage must be updated in environment
- Unauthorized epoch increments detected: audit ledger + event bus forensics; may require DB audit
- AuditLedger integrity check fails: `auditLedger.verifyIntegrity()` returns false — hash chain tampered

## Replay implications
- Revocation events are in event bus and are replayable
- Forensic replay of the incident window can show which actions were taken with the compromised token

## Certification implications
- Security response does not affect certification
- Re-run full certification suite after key rotation to confirm no side effects
