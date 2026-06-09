# POLLING-AND-SYNC-ARCHITECTURE.md
# ClubHub TV — Player-CMS Synchronization Architecture

**Document type:** Deployment Architecture Reference
**Status:** Canonical
**Authority:** Platform Operations
**Audience:** Infrastructure engineers, platform developers, platform operators
**Last updated:** 2026-05-26
**Depends on:** PLAYER-TOPOLOGY.md, EDGE-BEHAVIOR.md, ASSET-DISTRIBUTION.md

---

## Table of Contents

1. [Sync Model Selection Rationale](#1-sync-model-selection-rationale)
2. [Hybrid Sync Architecture](#2-hybrid-sync-architecture)
3. [Polling Intervals and Schedules](#3-polling-intervals-and-schedules)
4. [Emergency Channel Architecture](#4-emergency-channel-architecture)
5. [Corpus Sync Protocol](#5-corpus-sync-protocol)
6. [Audit Record Sync Protocol](#6-audit-record-sync-protocol)
7. [Entropy Metrics Sync Protocol](#7-entropy-metrics-sync-protocol)
8. [Heartbeat Protocol](#8-heartbeat-protocol)
9. [Sync Conflict Resolution](#9-sync-conflict-resolution)
10. [Bandwidth Budget and Constraints](#10-bandwidth-budget-and-constraints)
11. [Constitutional Sync Guarantees](#11-constitutional-sync-guarantees)
12. [Failure Modes and Recovery](#12-failure-modes-and-recovery)
13. [Sync Observability](#13-sync-observability)

---

## 1. Sync Model Selection Rationale

Three synchronization models were considered:

| Model | Description | Verdict |
|-------|-------------|---------|
| Push-only (CMS pushes to players) | CMS initiates all data delivery to players | Rejected: requires CMS to maintain persistent connections to all players; scales poorly; players behind NAT/firewall require complex hole-punching |
| Poll-only (players poll CMS) | Players initiate all communications on a fixed interval | Rejected alone: unacceptably slow for emergency signal delivery (60-second poll interval still 60 seconds too slow for EMERGENCY_FREEZE) |
| Hybrid (poll for routine; push for emergency) | Players poll for corpus and data sync; CMS pushes emergency signals only | Selected |

The hybrid model matches each data type to its latency requirement:

- **Corpus sync:** Acceptable latency is 5–15 minutes; polling is ideal (low overhead, player-initiated, no persistent connection required)
- **Emergency signals:** Required latency is <60 seconds; push via WebSocket or long-poll is required
- **Audit records:** Batch upload at player convenience; polling cadence is acceptable
- **Heartbeat:** Player-initiated, frequent (2 minutes); polling pattern

The hybrid model also aligns with the edge autonomy principle: players control their own sync cycle, they are not dependent on CMS actively targeting them. A player that stops receiving CMS pushes (due to CMS degradation) continues operating correctly on its local corpus.

---

## 2. Hybrid Sync Architecture

### 2.1 Channel Overview

```
PLAYER                              CMS (Regional Endpoint)
  |                                          |
  |------- [EMERGENCY CHANNEL] ------------>|  WebSocket (persistent)
  |<------ [Emergency signals] -------------|  or long-poll fallback
  |                                          |
  |------- [CORPUS VERSION POLL] ---------->|  GET /sync/corpus-version
  |<------ [Version response] --------------|  (every 5 minutes)
  |                                          |
  |------- [CORPUS DOWNLOAD] ------------->|  GET /sync/corpus/{version_id}
  |<------ [Corpus package] --------------|  (on version change only)
  |                                          |
  |------- [AUDIT BATCH UPLOAD] ---------->|  POST /sync/audit-records
  |<------ [Confirmation] -----------------|  (every 15 min, or 100 records)
  |                                          |
  |------- [ENTROPY METRICS UPLOAD] ------>|  POST /sync/entropy-metrics
  |<------ [Confirmation] -----------------|  (every 60 minutes)
  |                                          |
  |------- [HEARTBEAT] ------------------->|  POST /sync/heartbeat
  |<------ [Ack + pending commands] -------|  (every 2 minutes)
  |                                          |
  |------- [ASSET PREFETCH] -------------->|  GET {asset CDN URL}
  |<------ [Asset bytes] ------------------|  (player-initiated, scheduled)
```

### 2.2 Connection Architecture

Each player maintains:

1. **One persistent WebSocket connection** to the emergency channel endpoint (or one active long-poll request, re-issued on completion)
2. **On-demand HTTP connections** for all polling and upload operations (opened per request, closed after completion — no persistent HTTP connections for non-emergency channels)
3. **CDN connections** for asset downloads (HTTP/2, multiplexed, player-initiated)

The WebSocket connection for the emergency channel is the only persistent network connection maintained by the player. This is the only connection that needs to survive for extended periods without data transfer. WebSocket keepalive (ping/pong) is sent every 30 seconds to prevent idle timeouts.

---

## 3. Polling Intervals and Schedules

### 3.1 Summary Table

| Channel | Type | Nominal interval | Trigger condition | Data transferred |
|---------|------|-----------------|-------------------|-----------------|
| Emergency channel | WebSocket (push) | Persistent | On emergency event | Signal payload (<1 KB) |
| Corpus version check | Poll | 5 minutes | Every 5 min | Version ID + checksum (<100 bytes) |
| Full corpus sync | Pull on change | On change only | Version check shows new version | Corpus package (<5 MB) |
| Audit record batch | Push (player-initiated) | 15 minutes | Every 15 min OR buffer >100 records | Batch of audit records (variable) |
| Entropy metrics | Push (player-initiated) | 60 minutes | Every 60 min | Venue scan metrics (<10 KB) |
| Heartbeat | Push (player-initiated) | 2 minutes | Every 2 min | Heartbeat payload (<2 KB) |
| Asset prefetch | Pull (player-initiated) | As needed | Prefetch scheduler | Asset files (variable) |

### 3.2 Jitter

All polling intervals include a random jitter to prevent synchronized polling storms when large fleets are deployed. Jitter is applied as a percentage of the base interval:

| Channel | Jitter |
|---------|--------|
| Corpus version check (5 min) | ±60 seconds |
| Audit batch upload (15 min) | ±90 seconds |
| Entropy metrics (60 min) | ±5 minutes |
| Heartbeat (2 min) | ±15 seconds |

Jitter is computed independently per player at startup using the screen_id as a seed, producing consistent-but-varied polling offsets across the fleet. A fleet of 500 players with 5-minute polling and 60-second jitter spreads ~83 requests/minute across the polling window rather than 500 requests at a single moment.

### 3.3 Interval Configuration

Polling intervals are configurable via the player's corpus configuration (included in the corpus package). Default values are those in the summary table. PLATFORM_ADMIN may adjust intervals for the entire fleet or per-enterprise:

**Reasons to increase heartbeat interval (reduce frequency):**
- Constrained CMS infrastructure (reducing heartbeat load)
- 4G/LTE backup connections where every byte has cost

**Reasons to decrease heartbeat interval (increase frequency):**
- High-criticality venues where detection of player loss must be faster than 6 minutes
- Active incident monitoring periods where real-time fleet visibility is needed

**Constitutional floor:** The heartbeat interval may not be increased beyond 5 minutes in normal operation. A player that has not contacted the CMS in 5 minutes must be considered potentially at risk. Beyond 5 minutes, the CMS has no reliable ability to detect player failure.

**Constitutional ceiling:** The emergency channel polling fallback (used when WebSocket is unavailable) may not be increased beyond 60 seconds. The EMERGENCY_FREEZE delivery SLA of <60 seconds requires at least a 60-second polling fallback interval.

---

## 4. Emergency Channel Architecture

### 4.1 WebSocket Primary

The primary emergency channel is a WebSocket connection from the player to the CMS emergency endpoint. The player initiates this connection at startup and maintains it continuously.

**Connection lifecycle:**
```
[Player startup]
    |
    v
[Player connects WebSocket to emergency endpoint]
    |
    v
[Player sends handshake: {screen_id, current_corpus_version, player_mode}]
    |
    v
[CMS acknowledges: {session_id, pending_signals: [...]}]
    (pending signals: any signals generated while player was disconnected)
    |
    v
[WebSocket held open; player receives signals as CMS pushes them]
    |
    v
[Player sends ping every 30 seconds; CMS responds with pong]
    |
    v
[If WebSocket disconnects for any reason: player immediately attempts reconnection]
    [Reconnection backoff: 1s, 2s, 4s, 8s, 16s, 30s maximum]
    [After 3 failed reconnections: switch to long-poll fallback]
```

### 4.2 Long-Poll Fallback

If the WebSocket cannot be established (firewall blocking WebSocket upgrades, CMS WebSocket service degradation), the player falls back to long-polling:

1. Player sends `GET /sync/emergency-poll` with header `Prefer: wait=30`
2. CMS holds the connection open for up to 30 seconds
3. If a signal arrives within 30 seconds: CMS responds with the signal payload; player processes it
4. If no signal arrives within 30 seconds: CMS responds with `204 No Content`; player immediately sends a new long-poll request
5. This creates an effective polling interval of 0–30 seconds for emergency signals

**Emergency signal delivery SLA under long-poll:** Maximum 30 seconds from signal issuance to player receipt (the 30-second poll window). This is within the 60-second SLA.

### 4.3 Emergency Signal Format

```json
{
  "signal_id": "sig-uuid",
  "signal_type": "EMERGENCY_FREEZE" | "EMERGENCY_FREEZE_LIFT" | "CORPUS_INVALIDATE" | "PLAYER_COMMAND",
  "issued_at": "2026-05-26T14:30:00.000Z",
  "issued_by": "platform_admin_user_id",
  "authority_level": "PLATFORM_ADMIN",
  "target": "ALL_FLEET" | "ENTERPRISE:{id}" | "VENUE:{id}" | "SCREEN:{screen_id}",
  "payload": { ... },
  "signature": "base64-encoded-signature"
}
```

**Signal signature:** Emergency signals are signed by the CMS using an asymmetric key. The player verifies the signature against the CMS public key (baked into the player image at provision time). A signal with an invalid signature is rejected and logged as SUSPICIOUS_SIGNAL — it does not trigger any player state change.

### 4.4 Emergency Signal Acknowledgment

When a player receives an EMERGENCY_FREEZE signal:

1. Player applies the state change immediately (before acknowledging)
2. Player sends acknowledgment: `{signal_id, screen_id, applied_at, new_mode: "EMERGENCY_FALLBACK"}`
3. CMS records the acknowledgment timestamp
4. CMS tracks which players have acknowledged and which have not

If a player has not acknowledged within 60 seconds of signal issuance, the CMS generates FREEZE_UNCONFIRMED alert for that player. The PLATFORM_ADMIN can see which players are confirmed vs. unconfirmed in the emergency dashboard.

---

## 5. Corpus Sync Protocol

### 5.1 Version Check (Lightweight Poll)

Every 5 minutes (±60s jitter), the player sends:

```
GET /sync/corpus-version
Headers:
  X-Screen-ID: {screen_id}
  X-Current-Version: {current_corpus_version_id}
  X-Current-Checksum: {current_corpus_checksum}
```

CMS response options:

```json
// No change
{ "status": "CURRENT", "version": "v-uuid-same" }

// New version available
{
  "status": "UPDATE_AVAILABLE",
  "version": "v-uuid-new",
  "checksum": "sha256-hex",
  "size_bytes": 1048576,
  "download_url": "/sync/corpus/v-uuid-new",
  "expires_at": "2026-05-27T00:00:00Z"
}

// Player is behind by more than N versions (major update or long outage)
{
  "status": "SIGNIFICANTLY_BEHIND",
  "current_authoritative_version": "v-uuid-latest",
  "versions_behind": 7,
  "immediate_download_required": true
}
```

The version check payload is intentionally tiny (<200 bytes). For a fleet of 1,000 players polling every 5 minutes with 60-second jitter, this generates approximately 200 requests/minute — each returning <1 KB. Total: <200 KB/min of version check traffic.

### 5.2 Full Corpus Download

When the version check returns `UPDATE_AVAILABLE` or `SIGNIFICANTLY_BEHIND`, the player downloads the full corpus package:

```
GET /sync/corpus/{version_id}
Headers:
  X-Screen-ID: {screen_id}
  Authorization: Bearer {player_token}
Range: bytes=0-  (supports resumable download)
```

The corpus package download uses HTTP range requests for resumability. If the download is interrupted (WAN outage mid-download), the player resumes from where it stopped on the next connection attempt.

**Corpus package structure:**
```
corpus-{venue_id}-{version_id}.pkg
  ├── manifest.json          (version metadata, checksums, asset manifest)
  ├── corpus.json            (main corpus data)
  ├── overrides.json         (active overrides for this venue)
  ├── compliance.json        (compliance rules for this venue)
  └── asset-manifest.json    (all asset IDs with CDN URLs and checksums)
```

### 5.3 Atomic Corpus Application

After download and checksum verification, the corpus is applied atomically:

```bash
# Staging directory
/var/clubhub/corpus-staging/{version_id}/

# Active corpus directory
/var/clubhub/corpus-active/

# Atomic replacement (using rename syscall — atomic on POSIX filesystems)
mv /var/clubhub/corpus-staging/{version_id}/ /var/clubhub/corpus-active-new/
mv /var/clubhub/corpus-active/ /var/clubhub/corpus-previous/
mv /var/clubhub/corpus-active-new/ /var/clubhub/corpus-active/
```

This ensures the player is never in a state where it has partially applied a new corpus. The previous corpus is retained in `/var/clubhub/corpus-previous/` for 24 hours as a rollback option before being removed.

### 5.4 Corpus Application Audit Record

Every corpus application generates an audit record:

```json
{
  "event_type": "CORPUS_APPLIED",
  "screen_id": "{screen_id}",
  "applied_at": "2026-05-26T14:35:00.000Z",
  "previous_version": "v-uuid-old",
  "new_version": "v-uuid-new",
  "previous_checksum": "sha256-old",
  "new_checksum": "sha256-new",
  "delivery_method": "WAN_SYNC" | "MANUAL_USB"
}
```

This record is written to the local audit buffer immediately and uploaded to the cloud CMS in the next audit batch. It provides a complete history of which corpus version was active on each player at each point in time, which is essential for replay audit.

---

## 6. Audit Record Sync Protocol

### 6.1 Upload Trigger Conditions

The player initiates an audit batch upload when either of the following is true:

- The local buffer has accumulated ≥100 records since the last confirmed upload
- 15 minutes have elapsed since the last successful upload

Whichever condition is met first triggers the upload. Under normal operation (1 PRE invocation/minute), the 15-minute timer triggers approximately every 15 minutes. During high-frequency operation (short content slots, multiple invocations per minute), the 100-record threshold may trigger more frequently.

### 6.2 Upload Protocol

```
POST /sync/audit-records
Headers:
  X-Screen-ID: {screen_id}
  X-Batch-ID: {batch-uuid}
  X-Record-Range: {first_seq_num}-{last_seq_num}
  X-Record-Count: {count}
  Content-Type: application/x-ndjson

Body: newline-delimited JSON, one audit record per line
```

**Batch size:** Maximum 100 records per request. If the buffer has >100 records pending, the player uploads in sequential batches, awaiting confirmation of each batch before sending the next.

**CMS response:**
```json
{
  "batch_id": "batch-uuid",
  "accepted": 97,
  "rejected": 3,
  "rejected_reasons": [
    {"seq": 42, "reason": "DUPLICATE_INVOCATION_ID"},
    ...
  ],
  "confirmed_through_seq": 96
}
```

The player marks all records with `seq ≤ confirmed_through_seq` as confirmed and eligible for eviction. Rejected records are logged locally and included in the next batch (with a flag indicating re-submission). Permanent rejections (e.g., DUPLICATE_INVOCATION_ID on a second submission of the same batch) are logged as anomalies.

### 6.3 Upload Retry on Failure

If an audit batch upload fails (WAN outage, CMS error, timeout), the player retries:

| Attempt | Backoff |
|---------|---------|
| 1       | Immediate |
| 2       | 30 seconds |
| 3       | 2 minutes |
| 4       | 10 minutes |
| 5+      | 30 minutes (repeated) |

Records in the buffer are never discarded due to upload failure. They remain in the buffer until confirmed by the CMS. The buffer's maximum size constraint (200 MB default) provides the safety limit.

---

## 7. Entropy Metrics Sync Protocol

### 7.1 Venue Scan (60-Minute Cadence)

Every 60 minutes, each player computes a venue-level entropy scan:

1. Read current corpus from disk
2. Compute SHA-256 of the corpus JSON (canonical form)
3. Compare against the expected checksum embedded in the corpus's own manifest
4. Record: `{screen_id, scan_timestamp, corpus_version, computed_checksum, expected_checksum, match: true/false}`

### 7.2 Fleet Asset Scan (6-Hour Cadence)

Every 6 hours, each player performs an asset-level checksum sweep:

1. For each asset in the local cache that is referenced in the current corpus or the next 24h of scheduled content:
2. Compute SHA-256 of the local file
3. Compare against the checksum stored in the asset manifest
4. Record: `{asset_id, scan_timestamp, computed_checksum, expected_checksum, match: true/false, file_size_bytes}`

### 7.3 Upload Format

```
POST /sync/entropy-metrics
Headers:
  X-Screen-ID: {screen_id}
  X-Report-Period: {start_timestamp}/{end_timestamp}
  Content-Type: application/json

Body:
{
  "venue_scans": [
    { "timestamp": "...", "corpus_version": "...", "checksum_match": true, ... },
    ...
  ],
  "asset_scans": [
    { "asset_id": "...", "timestamp": "...", "checksum_match": true, ... },
    ...
  ],
  "summary": {
    "venue_scan_count": 4,
    "asset_scan_count": 1,
    "corpus_entropy_detected": false,
    "asset_entropy_detected": false,
    "asset_failures": []
  }
}
```

### 7.4 CMS Processing of Entropy Metrics

The CMS processes received entropy metrics to:

1. Verify that each player's reported corpus checksum matches the expected checksum for the corpus version deployed to that player
2. Identify players reporting asset checksum mismatches (persistent mismatches = ENTROPY alert)
3. Aggregate venue-level entropy scores and fleet-level entropy scores
4. Generate entropy alerts when scores exceed configured thresholds

Entropy processing is asynchronous. The player does not need to wait for CMS processing before continuing operation. The CMS sends no response payload beyond acknowledgment.

---

## 8. Heartbeat Protocol

### 8.1 Heartbeat Payload

Every 2 minutes, the player sends a heartbeat to the CMS:

```json
{
  "screen_id": "{screen_id}",
  "timestamp": "2026-05-26T14:32:00.000Z",
  "player_mode": "ACTIVE" | "OFFLINE" | "STANDBY" | "EMERGENCY_FALLBACK",
  "corpus_version": "{version_id}",
  "corpus_checksum": "{checksum}",
  "last_pre_invocation_at": "2026-05-26T14:31:55.000Z",
  "audit_buffer_record_count": 47,
  "audit_buffer_size_bytes": 235000,
  "storage_available_bytes": 18000000000,
  "uptime_seconds": 86400,
  "clock_offset_ms": 12,
  "current_content_id": "{asset_id or template_id}",
  "pre_resolution_level": 3
}
```

### 8.2 CMS Response to Heartbeat

The CMS acknowledges the heartbeat and may include pending commands:

```json
{
  "acknowledged_at": "2026-05-26T14:32:01.000Z",
  "pending_commands": [
    {
      "command_id": "cmd-uuid",
      "command_type": "PREFETCH_TRIGGER" | "CORPUS_REFRESH" | "LOG_LEVEL_CHANGE",
      "payload": { ... }
    }
  ],
  "server_time": "2026-05-26T14:32:01.000Z"
}
```

**Server time inclusion:** The CMS includes the current server UTC time in each heartbeat response. The player uses this to detect significant clock drift. If the player's local clock differs from the server time by >30 seconds, the player logs a CLOCK_DRIFT_WARNING. If drift exceeds 60 seconds, the player logs CLOCK_DRIFT_CRITICAL and alerts the CMS — this is a serious operational issue because clock drift directly affects PRE resolution correctness.

### 8.3 Heartbeat-Based Player State in CMS

The CMS uses heartbeat data to maintain a real-time view of each player's operational state. CMS considers a player:

- **ONLINE:** Heartbeat received within the last 4 minutes (2× interval)
- **CONNECTIVITY_DEGRADED:** No heartbeat for 4–10 minutes
- **OFFLINE:** No heartbeat for >10 minutes
- **LOST:** No heartbeat for >30 minutes (escalation alert generated)

---

## 9. Sync Conflict Resolution

### 9.1 No Corpus Write Conflicts

Corpus write conflicts cannot occur because:

- The CMS is the sole author of corpus versions
- Players are read-only consumers of corpus versions
- A player never generates a modification to the corpus; it only reads and applies what is delivered

There is no mechanism by which two players could create conflicting corpus versions. Corpus version conflicts at the CMS level (e.g., two operators simultaneously publishing different versions) are resolved by the CMS's corpus versioning system, not by the players.

### 9.2 No Audit Record Conflicts

Audit record conflicts cannot occur because:

- Every audit record has a unique invocation_id (UUID generated at invocation time)
- Audit records are append-only; no record is ever modified
- Multiple players at the same venue generate records with different invocation_ids

The only "conflict" that can occur is duplicate submission of the same batch (player sends a batch, doesn't receive confirmation, resends the batch). The CMS handles this by deduplicating on invocation_id — a record with an invocation_id already in the archive is accepted (returning success) but not stored again.

### 9.3 Offline Player Rejoining — No Conflict Possible

When a player that has been offline for an extended period reconnects:

1. It submits its buffered audit records (potentially days of records)
2. CMS accepts all records in chronological order
3. CMS deduplicates on invocation_id (in case of partial overlap from a previous partial sync)
4. All records are incorporated into the audit archive

There is no scenario where a player's rejoining creates a conflict with existing CMS data. The CMS accepts new records from the offline period as purely additive information.

### 9.4 Corpus Version Conflict on Rejoin

If a player returns from a long offline period and its current corpus version is N versions behind the current authoritative version, the CMS does not merge or reconcile. It simply delivers the current authoritative corpus package. The player applies it atomically. The transition is recorded in the audit trail.

---

## 10. Bandwidth Budget and Constraints

### 10.1 Per-Player Bandwidth Estimates (Connected, Idle)

| Channel | Size | Frequency | Monthly total per player |
|---------|------|-----------|--------------------------|
| Corpus version check | 200 bytes | Every 5 min | ~1.7 MB |
| Heartbeat (upload) | 800 bytes | Every 2 min | ~17 MB |
| Heartbeat response | 400 bytes | Every 2 min | ~8.5 MB |
| Audit record batch | ~50 KB per batch | Every 15 min | ~145 MB |
| Entropy metrics | ~10 KB | Every 60 min | ~14 MB |
| Emergency channel (WebSocket keepalive) | ~50 bytes | Every 30 sec | ~6 MB |
| **Total non-asset sync** | — | — | **~192 MB/player/month** |

This is approximately 200 MB/player/month for all non-content sync operations. For a 50-screen venue, this is ~10 GB/month of management traffic.

### 10.2 Asset Prefetch Bandwidth

Asset prefetch is the variable and dominant bandwidth consumer. It is impossible to specify precisely without knowing the content schedule (video sizes, campaign frequency, turnover rate). Estimates:

| Scenario | Monthly asset bandwidth (estimate) |
|----------|-------------------------------------|
| Low turnover (same content for weeks) | 500 MB – 2 GB/player |
| Medium turnover (weekly campaign changes) | 2 GB – 10 GB/player |
| High turnover (daily content changes) | 10 GB – 50 GB/player |

For venues with constrained WAN connections (e.g., 4G backup at 10 Mbps), high-turnover content schedules may not be viable without planning. ENTERPRISE_ADMIN should assess content turnover rates against venue network capacity when designing campaign schedules.

### 10.3 4G/LTE Operational Budget

When a venue operates on 4G/LTE backup (primary WAN has failed), a data budget must be observed to avoid excessive mobile data costs. Recommended emergency 4G budget:

| Priority | Operations permitted | Approximate usage |
|----------|---------------------|-------------------|
| CRITICAL | Heartbeat, emergency channel, CRITICAL priority asset prefetch | ~300 MB/day |
| HIGH | Audit upload, entropy metrics, HIGH priority asset prefetch | +500 MB/day |
| PAUSE | Full corpus sync, NORMAL/LOW asset prefetch | Paused |

The player automatically detects 4G operation via an environment variable or configuration flag set by the venue's IT infrastructure and applies the appropriate throttling. VENUE_ADMIN can also manually enable "4G budget mode" from the local management interface.

---

## 11. Constitutional Sync Guarantees

These guarantees must be maintained by the sync architecture. Any proposed change to sync behavior must be validated against each guarantee.

**S-1: New corpus is not applied until checksum verification passes**

A player must not switch PRE operations to a new corpus version until:
1. The complete corpus package has been received
2. The SHA-256 checksum of the received package matches the CMS-provided expected checksum
3. The checksum has been logged in the local audit buffer

A partial download, a corrupted download, or an unverified download must never be applied.

**S-2: Corpus application is atomic**

The player is never in a state where it has partially applied a new corpus. The atomic rename operation (Section 5.3) ensures this. If the player reboots during corpus application, it returns to the previous verified corpus.

**S-3: Corpus application is replay-auditable**

Every corpus application generates an audit record documenting the old version, new version, timestamps, and verified checksums. This record makes it possible to reconstruct exactly which corpus version was active on any given player at any given time.

**S-4: Emergency signal application precedes acknowledgment**

A player must apply an EMERGENCY_FREEZE state change before sending the acknowledgment. The CMS acknowledgment timestamp therefore represents a time by which the player has definitively applied the state. A player that acknowledges but has not applied is a platform defect.

**S-5: Corpus version applied must match the corpus version used for PRE invocation**

The corpus version in each PRE audit record must match the corpus version stored in the player's active corpus directory. A PRE invocation must not be performed against a different corpus version than the one that is logged. This is enforced by reading both the corpus and the version identifier atomically at the start of each invocation.

---

## 12. Failure Modes and Recovery

### 12.1 CMS Sync Endpoint Unavailable

**Detection:** HTTP connection refused, DNS resolution failure, or HTTPS handshake failure on corpus version poll.

**Player response:**
1. Continue operating from local corpus (no interruption to content)
2. Retry with exponential backoff: 30s, 60s, 120s, 300s, 600s (cap at 10 minutes)
3. After 3 consecutive failures: attempt fallback endpoint
4. Log sync failure locally; include in next successful audit batch

**Content impact:** None within the autonomy window.

### 12.2 Emergency Channel WebSocket Disconnects

**Detection:** WebSocket close event or timeout on ping/pong (30s interval).

**Player response:**
1. Immediately attempt WebSocket reconnection
2. Reconnection backoff: 1s, 2s, 4s, 8s, 16s, 30s (cap at 30 seconds)
3. After 3 consecutive failed reconnections: switch to long-poll fallback
4. Log WebSocket disconnection; note whether long-poll is active

**Emergency delivery impact:** During the reconnection window (<30s), an emergency signal cannot be delivered immediately. Long-poll ensures maximum 30-second delivery latency once active.

### 12.3 CMS Returns Unexpected Corpus Version

If the CMS version check returns a version ID that the player cannot download (e.g., the corpus package returns a 404 or fails checksum):

1. Player retries download 3 times with exponential backoff
2. If all 3 attempts fail: player continues on current corpus
3. Player logs `CORPUS_DOWNLOAD_FAILED` with the version ID, error codes, and timestamps
4. Player includes this failure in the next heartbeat payload
5. CMS detects the failure via heartbeat; generates a CORPUS_DELIVERY_FAILURE alert for VENUE_ADMIN

**Content impact:** Player remains on previous corpus version until download succeeds. If the previous corpus version is still valid (not expired), content continues normally. If the previous corpus version has been invalidated by the CMS (a rare event), the player falls back to the emergency bundle.

### 12.4 Audit Buffer Approaching Capacity

**Detection:** Player's audit buffer size exceeds 80% of configured maximum.

**Player response:**
1. Increase upload frequency: attempt upload every 5 minutes instead of 15 minutes
2. If upload consistently fails: log AUDIT_BUFFER_FILL_WARNING to local system log
3. At 95% capacity: log AUDIT_BUFFER_CRITICAL; generate heartbeat alert

**Recovery:** Once WAN is restored, the increased upload frequency rapidly drains the buffer. Under normal conditions, the buffer drains within 30 minutes of WAN restoration (uploading at 100 records per batch, every 5 minutes, approximately 300 records per 15 minutes).

---

## 13. Sync Observability

### 13.1 Per-Player Sync Metrics in CMS

The CMS maintains the following per-player sync metrics, derived from heartbeat data and upload acknowledgments:

| Metric | Description | Alert threshold |
|--------|-------------|-----------------|
| `last_heartbeat_at` | Timestamp of last received heartbeat | CRITICAL if >10 minutes ago |
| `last_corpus_sync_at` | Timestamp of last corpus version sync | WARNING if >2h ago |
| `last_audit_upload_at` | Timestamp of last confirmed audit upload | WARNING if >30 minutes ago |
| `audit_buffer_unconfirmed_count` | Records not yet confirmed by CMS | CRITICAL if >500 |
| `corpus_version_current` | Whether player is on the authoritative version | WARNING if not current >30 min |
| `emergency_channel_status` | WebSocket or long-poll status | CRITICAL if disconnected >60s |
| `clock_drift_ms` | Player clock vs. CMS time | WARNING if >30s; CRITICAL if >60s |

### 13.2 Fleet Sync Health Dashboard

The CMS operations dashboard provides:

- **Fleet connectivity rate:** % of players with heartbeat within the last 4 minutes
- **Corpus version distribution:** heat map of how many players are on each corpus version
- **Audit backlog by venue:** which venues have the largest unconfirmed audit buffers
- **Emergency channel health:** how many players have active WebSocket connections vs. long-poll fallback
- **Sync SLA compliance:** % of corpus updates delivered within the 5-minute SLA, % of emergency signals acknowledged within 60 seconds

### 13.3 Player-Side Sync Diagnostics

On each player (accessed via SSH), the following diagnostic commands are available:

```bash
# Current sync status
/opt/clubhub/bin/sync-status.sh
# Output: all sync channels, last success time, next scheduled time, failure count

# Test corpus version check
/opt/clubhub/bin/test-corpus-poll.sh
# Output: HTTP response code, response time, returned version ID

# Test emergency channel
/opt/clubhub/bin/test-emergency-channel.sh
# Output: WebSocket or long-poll status, last signal received, latency test

# Show audit buffer status
/opt/clubhub/bin/audit-buffer-status.sh
# Output: buffer size, unconfirmed record count, oldest unconfirmed timestamp

# Force immediate sync (for debugging)
/opt/clubhub/bin/force-sync.sh --channel=corpus
/opt/clubhub/bin/force-sync.sh --channel=audit
/opt/clubhub/bin/force-sync.sh --channel=entropy
```
