# THREAT_MODEL_GUIDE.md
# Governance Kernel — Threat Model

---

## Trust boundaries

```
UNTRUSTED: External network callers, operator browsers
SEMI-TRUSTED: Operator tokens (verified HMAC-SHA256 + JTI revocation)
TRUSTED: Process with DB access (kernel node process)
ROOT-TRUSTED: PostgreSQL primary, OPERATOR_SECRET_KEY holder
```

---

## In-scope threats

### T1: Unauthorized deployment mutation
**Attack:** Caller attempts to freeze/unfreeze without valid OPERATOR token.
**Mitigation (HARD):** All mutating routes require `OperatorAuthority.requireAuth(OPERATOR)`.
**Verification:** GovernedRoutingCertification GRC-01.
**Residual:** Client-side role gate bypass by elevated role (ADVISORY — server-side is the enforcement layer).

### T2: Config tampering
**Attack:** Config updated without justification or operator attribution.
**Mitigation (HARD):** `ConfigAuthority.update()` throws without `justification`.
**Verification:** OTARuntimeCertification ORC-04; audit ledger entry required.
**Residual:** Config can be updated by any ADMIN role holder — no second-factor.

### T3: Token replay after revocation
**Attack:** Attacker captures a valid token and uses it after revocation.
**Mitigation (HARD):** `verifyToken()` checks JTI revocation list on every call.
**Mitigation gap (SOFT):** JTI revocation propagation gap: up to 30s polling lag.
**Residual:** 30s window during which a revoked token is still valid between polls.

### T4: Audit ledger manipulation
**Attack:** Attacker modifies AuditLedger entries to conceal operator actions.
**Mitigation (HARD):** AuditLedger is append-only with hash chain. `verifyIntegrity()` detects tampering.
**Residual:** In-memory ledger before DB persist is tamper-possible. Hash chain verified at persist time.

### T5: Authority boundary bypass via plugin
**Attack:** Malicious plugin imports `governance-kernel/core/` directly to bypass authority layer.
**Mitigation (HARD):** `UIPluginRegistry` rejects `bypassGovernance: true`.
**Mitigation (HARD):** `AuthorityBypassCertification` detects direct core/ imports statically.
**Residual:** Runtime plugin code is not OS-sandboxed in v1 (worker thread isolation is v3 advisory).

### T6: Epoch manipulation
**Attack:** Plugin increments epoch without `AuthorityCoordinator` to forge LINEARIZED operations.
**Mitigation (HARD):** `AuthorityBypassCertification` ABC-05 certifies AuthorityCoordinator is used.
**Mitigation (HARD):** DB advisory lock prevents concurrent epoch increments.
**Residual:** A process with raw DB access could bypass advisory locks.

### T7: Replay injection
**Attack:** Attacker injects malicious events into a replay stream.
**Mitigation (HARD):** Replay events are sourced from kernel-controlled event store.
**Mitigation (HARD):** `applyReplayEvent()` enforces replay mode guard (not callable in LIVE mode).
**Residual:** Event store integrity depends on DB write access controls.

---

## Out-of-scope threats (v1)

| Threat | Notes |
|--------|-------|
| OPERATOR_SECRET_KEY compromise | Key rotation available but key storage is infrastructure concern |
| DB primary compromise | Infrastructure layer; out of governance kernel scope |
| Side-channel timing attacks on HMAC | Standard HMAC-SHA256 timing-safe comparison used |
| Multi-node >2 coordination attacks | Out of HA ceiling |
| DDoS on advisory lock acquisition | Infrastructure layer; op-level concern |

---

## Security controls summary

| Control | Enforcement | Level |
|---------|-------------|-------|
| Role-based route gating | `OperatorAuthority.requireAuth()` | HARD |
| Token HMAC verification | `verifyToken()` HMAC-SHA256 | HARD |
| JTI revocation | `sessionAuth.isRevoked()` + DB | SOFT (30s poll gap) |
| Audit trail | AuditLedger hash chain | HARD |
| Authority boundary isolation | Certification + import checks | HARD (static) |
| Config justification requirement | `ConfigAuthority.update()` | HARD |
| Replay isolation | `assertNotReplay()` guards | HARD |
| Plugin governance enforcement | `UIPluginRegistry._validate()` | HARD |
