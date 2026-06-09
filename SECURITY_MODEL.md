# SECURITY MODEL

**Version:** 1.0.0
**Status:** ENFORCED (Model defined. Implementation: stubs in place. Full enforcement: Phase 2.)
**Authority:** Defines trust boundaries, Pi enrollment, token lifecycle, and
compromise handling for ClubHub TV. All security controls integrate with
existing middleware stack in `backend/src/`.

---

## 0. CURRENT SECURITY POSTURE (HONEST BASELINE)

Before defining the target model, the current state must be acknowledged:

| Area | Current State | Risk Level |
|------|--------------|------------|
| Pi authentication | None. Any client with screen_id can poll any manifest. | HIGH |
| Manifest integrity | None. No signing or HMAC. Pi trusts whatever backend returns. | HIGH |
| OTA verification | None. No package signature check. | HIGH |
| Operator access | No auth on backend API. Rate limiting by IP only. | MEDIUM |
| Transport security | Caddy enforces HTTPS on production. Dev sim: HTTP. | MEDIUM |
| DB access | Internal Docker network only. No external exposure. | LOW |
| Log sensitivity | Logs contain screen_id and IP hash. No PII in current schema. | LOW |

**This document defines the target model and scaffolding. Full enforcement is
Phase 2 of security implementation. The model is defined here to ensure new code
is built toward the target rather than away from it.**

---

## 1. TRUST BOUNDARIES

### 1.1 Boundary Map

```
┌──────────────────────────────────────────────────────────┐
│  INTERNET (UNTRUSTED)                                    │
│                                                          │
│   Operator browser ──────┐                              │
│   Venue network (Pi)  ───┼──→  [ Caddy :443 ]           │
│   Attacker               │         │                    │
└──────────────────────────┘         │                    │
                                      ▼                    │
┌─────────────────────────────────────────────────────────┐│
│  PROXY ZONE (Caddy)                                     ││
│  Only accepts HTTPS. Strips non-API paths.              ││
│  Security headers enforced.                             ││
└──────────────────────┬──────────────────────────────────┘│
                       │ /api/*                             │
┌──────────────────────▼──────────────────────────────────┐│
│  INTERNAL ZONE (Backend + DB)                           ││
│  No external exposure. Internal Docker network only.    ││
│  Rate limiting enforced here.                           ││
│  Screen auth enforced here (target state).              ││
└──────────────────────┬──────────────────────────────────┘│
                       │ pg:5432                            │
┌──────────────────────▼──────────────────────────────────┐│
│  DATA ZONE (PostgreSQL)                                 ││
│  No network exposure. Backend-only access.              ││
│  Schema: screens, content, schedules, venues, playlists ││
└─────────────────────────────────────────────────────────┘│
                                                            │
┌─────────────────────────────────────────────────────────┐│
│  APPLIANCE ZONE (Pi hardware at venue)                  ││
│  Physically accessible by venue staff (untrusted).      ││
│  No inbound connections accepted.                       ││
│  Communicates outbound to Caddy only.                   ││
│  Holds enrollment token + session token.                ││
└─────────────────────────────────────────────────────────┘│
```

### 1.2 Boundary Enforcement Rules

| Rule | Boundary | Current | Target |
|------|----------|---------|--------|
| TB1 | Only HTTPS in production | Caddy enforces | Caddy enforces |
| TB2 | DB not externally reachable | Docker internal network | Docker internal network |
| TB3 | Backend not directly internet-reachable | Caddy proxy | Caddy proxy |
| TB4 | Pi has no server ports open | No server ports | No server ports |
| TB5 | Pi authenticates to backend | NOT IMPLEMENTED | Enrollment token + session JWT |
| TB6 | Manifests are integrity-verified | NOT IMPLEMENTED | HMAC-SHA256 signature |
| TB7 | OTA packages are signed | NOT IMPLEMENTED | SHA256 + operator signature |

---

## 2. PI ENROLLMENT MODEL

Enrollment is the process by which a Pi establishes a verified identity with the
backend. An unenrolled Pi MUST NOT be served manifests (target state).

### 2.1 Enrollment Flow (Target)

```
Step 1: Factory/provisioning
  Operator generates a one-time enrollment token (OET) for the screen.
  OET is written to the Pi SD card during imaging.
  OET is also stored in the screens table (hashed) with status=PENDING.

Step 2: First boot
  Pi presents OET + screen_id + hardware fingerprint to POST /screens/enroll
  Backend validates: OET exists, is PENDING, matches screen_id, not expired
  Backend returns: session token (JWT, 24h expiry)
  Backend marks OET as USED in screens table

Step 3: Normal operation
  Pi presents session token on every manifest poll (Authorization: Bearer <token>)
  Backend validates token on every poll (expiry + not revoked)
  On token expiry: Pi re-enrolls with stored OET (if OET still valid) or requires
    operator re-provisioning

Step 4: Token refresh
  Before expiry, Pi may request a new session token using the current valid token
  Backend issues new token, old token is revoked
  Ensures continuity without re-enrollment
```

### 2.2 Enrollment Token Properties

| Property | Value | Source |
|----------|-------|--------|
| Format | UUID v4, base64url encoded | Operator provisioning tool |
| Storage on Pi | `/etc/clubhub/enrollment.token` (not in app directory) | Pi imaging |
| Storage in DB | SHA-256 hash (never store plaintext) | `screens` table |
| Expiry | 30 days from generation | `security.enrollment_token_expiry_ms` |
| Use limit | 1 (invalidated after successful enrollment) | DB flag `used = true` |
| Revocable | Yes, by operator at any time | DELETE or mark revoked in DB |

### 2.3 Current State Gap

**The current `screens` table schema does not include enrollment_token, token_status,
or session_token fields.** A migration is required before enrollment can be enforced.

The `backend/src/middleware/screenAuth.js` stub provides the middleware interface.
Full enforcement requires the migration and a provisioning CLI tool (Phase 2).

---

## 3. TOKEN LIFECYCLE

```
                    ┌─────────────────┐
                    │   PROVISIONED   │
                    │ (OET generated) │
                    └────────┬────────┘
                             │ First boot
                             ▼
                    ┌─────────────────┐
                    │    ENROLLING    │
                    │ (POST /enroll)  │
                    └────────┬────────┘
                    ┌────────┴────────┐
              Fail  │                 │ Success
                    ▼                 ▼
           ┌─────────────┐   ┌───────────────┐
           │  REJECTED   │   │   ENROLLED    │
           │             │   │ (JWT issued)  │
           └─────────────┘   └───────┬───────┘
                                     │ Token nearing expiry
                                     ▼
                             ┌───────────────┐
                             │  REFRESHING   │
                             └───────┬───────┘
                             ┌───────┴───────┐
                       Fail  │               │ Success
                             ▼               ▼
                    ┌─────────────┐  ┌───────────────┐
                    │  EXPIRED    │  │   ENROLLED    │
                    │ (re-enroll) │  │ (new token)   │
                    └─────────────┘  └───────────────┘

    Operator action at any state:
    ──────────────────────────────►  REVOKED
```

| Token State | Can Poll Manifest | Resolution |
|-------------|------------------|-----------|
| ENROLLED (valid) | Yes | Normal operation |
| ENROLLED (expiring < 1h) | Yes | Begin token refresh |
| EXPIRED | No | Re-enroll using OET |
| REVOKED | No | Operator must re-provision |
| REJECTED (failed enroll) | No | Check OET validity; wait for operator |

### 3.1 Token Governed Values

| Parameter | Value | Location |
|-----------|-------|---------|
| Session token expiry | 86,400,000ms (24h) | `thresholds.json` `security.session_token_expiry_ms` |
| Refresh window before expiry | 3,600,000ms (1h) | `thresholds.json` `security.token_refresh_window_ms` |
| Max failed enrollment attempts | 5 (then lock for 1h) | `thresholds.json` `security.max_failed_enrollments` |
| Enrollment token expiry | 2,592,000,000ms (30 days) | `thresholds.json` `security.enrollment_token_expiry_ms` |

---

## 4. SIGNED MANIFEST STRATEGY

### 4.1 Problem

The Pi currently trusts whatever the backend returns as the manifest JSON. An
attacker who can intercept the connection (or compromise the backend) can serve
arbitrary content to all screens.

### 4.2 Signing Strategy (Target)

```
Backend manifest computation:
  1. Compute manifest JSON for screen
  2. Compute HMAC-SHA256(manifest JSON, SECRET_KEY)
  3. Return: { manifest: {...}, sig: "<hex HMAC>", signed_at: <ts> }

Pi manifest validation:
  1. Receive manifest + sig
  2. Compute local HMAC-SHA256(manifest JSON, shared_key)
  3. If signatures match: accept manifest
  4. If signatures do not match: reject, continue displaying cached manifest,
     emit SCREEN.manifest_integrity_failure event
  5. On 3 consecutive integrity failures: enter watchdog reboot
```

**Key management:**
- `SECRET_KEY` env var in `.env.production` is the signing key
- It is already present as the signing key for session tokens
- Pi receives the signing key during enrollment (not via manifest response)
- Key rotation requires re-enrollment of all Pis (operator action)

### 4.3 Checksum vs. Signature

The existing `checksum` field in manifests detects **accidental** content changes.
The HMAC signature detects **intentional** tampering. Both must be present:
- Checksum: "Did the content change?" (content-addressed, served by backend)
- Signature: "Did this manifest come from a trusted backend?" (cryptographic proof)

---

## 5. REPLAY PREVENTION

A replay attack presents a previously valid manifest response to a Pi to force it
to display stale content.

### 5.1 Replay Vectors

| Vector | Risk | Mitigation |
|--------|------|-----------|
| Cached HTTP response replay | Pi receives a stale manifest response | `Cache-Control: no-store` on all manifest responses (existing or add) |
| Signed manifest replay | Old signed manifest re-presented | Include `signed_at` timestamp in signature; Pi rejects if `signed_at` > 60s old |
| Session token replay after revocation | Revoked token used from intercepted traffic | Backend maintains revocation list; checked on every poll |
| OTA package replay | Old firmware re-installed | OTA packages signed with version number; Pi rejects version ≤ current |

### 5.2 Replay Prevention for Manifests

```javascript
// Manifest signature payload includes timestamp
const payload = JSON.stringify({ manifest, signed_at: Date.now() });
const sig = hmac(payload, SECRET_KEY);

// Pi rejects if:
const age = Date.now() - signed_at;
if (age > 60_000) reject('REPLAY: signed_at too old');  // 60s freshness window
```

The 60s freshness window accommodates network latency (typically < 5s) and
clock skew (typically < 30s with NTP). See REALITY_GAP_VALIDATION.md Assumption E2
for venues without NTP.

---

## 6. OTA TRUST CHAIN

```
Operator creates update package:
  1. Build firmware artifact
  2. Compute SHA-256(artifact)
  3. Sign hash with operator private key: sig = sign(SHA-256, operator_key)
  4. Package: { artifact, sha256, sig, version, target_ring }

Backend receives package (POST /ota/upload):
  5. Verify sig against operator public key (stored in backend config)
  6. Verify SHA-256(artifact) matches claimed SHA-256
  7. Store package; set rollout state = PENDING

Pi receives OTA instruction (in manifest response):
  8. Pi downloads artifact
  9. Pi verifies SHA-256(downloaded) == SHA-256 from manifest
  10. Pi verifies sig using cached operator public key
  11. Only if BOTH checks pass: proceed with installation
  12. If either fails: abort, remain on current version, emit SCREEN.ota_failed

Post-install:
  13. Pi reboots into new version
  14. Pi polls manifest; new version checksum must appear in manifest response
  15. If checksum mismatch: rollback (E2 failure in SYSTEM_CONTRACTS)
```

---

## 7. OPERATOR PRIVILEGE MODEL

| Role | Capabilities | Authentication |
|------|-------------|---------------|
| `admin` | Full CRUD on content, schedules, venues, screens; OTA upload; backup/restore | HTTPS + operator credentials (Phase 2) |
| `venue_operator` | Read content, view screen status, view manifests for assigned venues | HTTPS + operator credentials (Phase 2) |
| `screen` (Pi) | Read manifest for own screen_id only | Enrollment token + session JWT |
| `monitor` | Read health endpoints, read metrics | IP allowlist (internal only) |

**Current state:** No role enforcement. All write endpoints accessible to any
caller within rate limits. The `heavy` rate limit tier (10 req/min) provides
partial protection against automated abuse of admin endpoints.

**Phase 2 requirement:** Add operator auth middleware (JWT or API key) to all
non-health, non-manifest routes before any production deployment with public
backend exposure.

---

## 8. COMPROMISED NODE HANDLING

A node is considered compromised if:

| Indicator | Classification |
|-----------|---------------|
| Polling with revoked/expired token | Credential compromise |
| Polling from unexpected IP hash for extended period | Possible network compromise |
| Emitting anomalous event patterns (extremely high poll rate, pattern repetition) | Possible replay/injection attack |
| Physical reported stolen or tampered (operator report) | Physical compromise |

### 8.1 Compromise Response Procedure

```
Step 1: QUARANTINE (immediate, automated where possible)
  Revoke session token → subsequent polls return 401
  Flag screen as QUARANTINED in DB
  Emit SECURITY.node_quarantined event

Step 2: ISOLATE (operator action)
  Remove screen from active schedules (stop serving manifests)
  If physical access possible: power down

Step 3: INVESTIGATE
  Review SECURITY event log for the screen_id
  Check request_id correlation to backend logs
  Determine vector: credential, network, or physical

Step 4: REMEDIATE
  If credential: re-provision with new OET (wipe old token from DB)
  If network: rotate SECRET_KEY + re-enroll all screens (high impact)
  If physical: replace hardware, re-image SD card

Step 5: RESTORE
  Re-enroll with new credentials
  Verify 3 consecutive successful authenticated polls
  Remove QUARANTINED flag
```

---

## 9. CONTRADICTIONS WITH EXISTING CONTRACTS

One contradiction identified and resolved:

**Contradiction:** SYSTEM_CONTRACTS §7 (Polling Contract) defines the polling
protocol without any authentication requirement. The security model adds
authentication to manifest polls.

**Resolution:** §7 defines the timing and change-detection contract, which remains
unchanged. Authentication is an additional layer. This document adds:
- `TB5`: Pi authenticates to backend (target)
- Manifest endpoint must validate Bearer token (target)

A contract amendment is required in SYSTEM_CONTRACTS §7 when token enforcement
is activated. Until then, the existing polling contract governs and auth is opt-in.

---

## 10. INTERACTION WITH OTHER MATURITY DOCUMENTS

| Document | Interaction |
|----------|-------------|
| OBSERVABILITY.md | All security events use SECURITY namespace |
| OTA_GOVERNANCE.md | OTA trust chain is prerequisite for Ring 0 deployment |
| CLUBHUB_STATE_AUTHORITY.md | Enrollment writes to Tier 1 (screens table) via backend only |
| CAPACITY_MODEL.md | Token validation adds ~1ms per poll at any scale (negligible) |
