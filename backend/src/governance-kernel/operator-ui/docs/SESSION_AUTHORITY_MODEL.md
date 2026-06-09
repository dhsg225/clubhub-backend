# SESSION_AUTHORITY_MODEL.md
# Governance Kernel v1 — Operator Session Authority Model

**Status:** FROZEN (A2.0.0)
**Effective:** 2026-05-24

---

## 1. Session token model

Operator sessions are JWS tokens (HMAC-SHA256) with the format:

```
base64url({ v:1, oid, role, iat, exp, jti }).HMAC_SHA256_hex
```

Fields:
- `v`: token format version (1 in v1 — FROZEN, cannot change)
- `oid`: operator ID
- `role`: ADMIN | OPERATOR | VIEWER
- `iat`: issued-at (Unix seconds, wall-clock)
- `exp`: expiry (Unix seconds, wall-clock)
- `jti`: JWT ID — unique per token, used for revocation

**Token format is IMMUTABLE in v1.x.** Changes require v2 + Governance RFC.

---

## 2. Role capabilities

### ADMIN

Full authority. Can:
- Freeze / unfreeze deployment
- Increment authority epoch
- Revoke any operator token
- Revoke any operator (all their tokens)
- Submit and confirm config proposals
- Transition incidents (strong / LINEARIZED)
- Archive resolved incidents
- Run certification
- View all surfaces

### OPERATOR

Operational authority. Can:
- Create incidents
- Transition incidents (MEMORY_ONLY)
- Request freeze (queued — ADMIN confirms)
- View all surfaces
- Submit config proposals (ADMIN confirms)

### VIEWER

Read-only. Can:
- View all governance surfaces
- View audit ledger
- View topology
- Start replay / forensic view
- Cannot submit any mutations

---

## 3. Session visualization

The session panel shows:
- Current operator ID (`oid`)
- Current role (ADMIN / OPERATOR / VIEWER)
- Token expiry countdown
- JTI display (last 8 chars for UI, full for audit)
- Token freshness indicator (time since issue)

Revocation status:
- If `isRevoked(jti)` returns true after a poll: "TOKEN REVOKED — please re-authenticate"
- Session immediately becomes read-only pending re-login

---

## 4. JTI tracking

The UI polls `/governance/tokens/status?jti=<jti>` every 30 seconds.

Server calls `OperatorAuthority.isRevoked(jti)` (MEMORY_ONLY).

If revoked:
- All mutations immediately disabled
- Revocation banner shown
- Re-login required

**Known gap:** `isRevoked()` is MEMORY_ONLY. If revocation occurred on a different
instance, this poll may return false until the instance restarts.
This is documented in CONSISTENCY_MODEL.md and DEPRECATION_POLICY.md §7.

---

## 5. Authority escalation warnings

When an OPERATOR role operator attempts an ADMIN-only action:

- Action button shows lock icon
- Tooltip: "This action requires ADMIN role"
- Clicking shows: "Insufficient authority — contact an ADMIN to perform this action"
- Action is NOT submitted (client-side gate)

Server-side `requireAuth('ADMIN')` enforces this regardless.

---

## 6. Replay visibility restrictions

During REPLAY mode:
- Session token is NOT replayed (per REPLAY_CONTRACT.md §4)
- Operator identity during replay is the current live operator viewing the replay
- Actions attributed during replay show: "Viewed by: [current operator] (replay of events from [lineage_ts range])"
- Revocation status of replayed events shown as-of-replay (not current)

---

## 7. Operator attribution model

Every operator action in the control plane is attributed with:

```
operator_id, role, jti, command, reason, justification, lineage_ts, authority_epoch
```

This attribution is appended to AuditLedger and searchable in the audit surface.

The audit surface supports filtering by:
- operator_id
- role
- action type
- lineage_ts range
- authority_epoch range

---

## 8. Stale authority warnings

The session panel shows stale authority warnings when:

1. `authority_epoch` in the session context is older than current kernel epoch
   - Warning: "Your session was issued under an older authority epoch. Some actions may require re-authentication."

2. Token is within 5 minutes of expiry
   - Warning: "Session expires in 4m 32s — save work and re-authenticate"

3. Token cannot be verified (transport error)
   - Warning: "Cannot verify session — working in degraded mode (VIEWER only)"
