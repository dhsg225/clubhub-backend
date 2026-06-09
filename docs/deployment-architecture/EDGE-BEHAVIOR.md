# EDGE-BEHAVIOR.md
# ClubHub TV — Edge Player Autonomous Behavior

**Document type:** Deployment Architecture Reference
**Status:** Canonical
**Authority:** Platform Operations
**Audience:** Infrastructure engineers, platform operators, venue integrators
**Last updated:** 2026-05-26
**Depends on:** PLAYER-TOPOLOGY.md, OFFLINE-OPERATION.md

---

## Table of Contents

1. [Edge Autonomy Principle](#1-edge-autonomy-principle)
2. [What Runs at the Edge](#2-what-runs-at-the-edge)
3. [Edge Autonomy Window](#3-edge-autonomy-window)
4. [Local Decision Quality](#4-local-decision-quality)
5. [Cloud vs Edge Responsibility Split](#5-cloud-vs-edge-responsibility-split)
6. [Edge Failure Handling](#6-edge-failure-handling)
7. [Edge Audit Integrity](#7-edge-audit-integrity)
8. [Edge Entropy Detection](#8-edge-entropy-detection)
9. [Emergency State at the Edge](#9-emergency-state-at-the-edge)
10. [Operational Implications](#10-operational-implications)

---

## 1. Edge Autonomy Principle

A screen player at the venue edge must be capable of continuing correct operation without any contact with the cloud CMS for a defined autonomy period. This is not a degraded mode — it is a first-class operational mode that must be designed for, tested for, and confirmed to work before a venue is declared OPERATIONAL.

**The core assertion:** A player that cannot operate autonomously is not a player — it is a display terminal dependent on a remote service. ClubHub TV is architected explicitly to reject this model. Every content decision a player makes is a local computation over locally-stored data.

**Why this matters:** Venue internet connectivity is not guaranteed. Even well-connected venues experience outages: ISP failures, router reboots, misconfigured firewalls, physical cable damage. A platform that halts content display when its internet connection drops is not viable for licensed venues with regulatory display requirements.

**Constitutional anchor:** The PRE (Playback Resolution Engine) is a pure local function. It makes no network calls. It reads no external services. Given the same corpus and the same timestamp, it produces the same output, always, on any hardware that can run the player application. This is the foundation of edge autonomy.

---

## 2. What Runs at the Edge

### 2.1 Core Player Process

The player process running on each Pi is responsible for:

| Function                    | Local? | Notes                                                               |
|-----------------------------|--------|---------------------------------------------------------------------|
| PRE.resolve() invocation    | Yes    | Pure local function, no network dependency                          |
| Corpus storage              | Yes    | Full corpus JSON stored on local filesystem, checksum-verified      |
| PRE output rendering        | Yes    | Content playback from local asset cache                             |
| Replay audit record write   | Yes    | Written to local append-only buffer; synced to cloud when connected |
| Entropy metric collection   | Yes    | Local corpus checksum comparison; metrics buffered for upload       |
| Emergency state persistence | Yes    | EMERGENCY_FREEZE state persisted to local disk; survives reboots    |
| Asset cache management      | Yes    | LRU eviction of non-active assets; storage budget enforcement       |
| Clock reading               | Yes    | System clock (UTC) read locally; NTP-synchronized                   |

### 2.2 What the Edge Player Does NOT Do

The player never:

- Makes a real-time network call to resolve content for the current timeslot
- Queries the cloud CMS to determine which schedule applies right now
- Sends a request to verify that its current output is correct
- Waits for CMS confirmation before playing a scheduled content item
- Coordinates with other players in the same venue before making a resolution decision

These restrictions are not operational choices — they are constitutional requirements. A PRE invocation that depends on a network call violates the pure-function constraint and breaks the determinism and replay guarantees that the platform is built on.

---

## 3. Edge Autonomy Window

### 3.1 Minimum Autonomy Requirement

**72 hours** without any CMS sync contact is the minimum autonomy window that all production players must support. This means:

- Any content change scheduled to occur within the next 72 hours must already be present in the player's corpus at the time of the last sync
- Corpus updates must be delivered to players at least 72 hours before their scheduled effective date
- This is an operational constraint on the CMS publish workflow, not just a player capability

**Example:** A campaign scheduled to start at 09:00 Monday must be in the player's corpus by 09:00 Friday at the latest. In practice, the publish-to-delivery SLA should target 4 hours, and campaigns should not be published within 72 hours of their start date unless the operator explicitly accepts the risk.

### 3.2 Target Autonomy Window (High-Risk Venues)

**7 days** is the target autonomy window for venues with documented poor or unreliable WAN connectivity. Venues classified as GRADE_A or GRADE_B for autonomy (see VENUE-AUTONOMY.md) must be capable of 7-day autonomous operation.

Achieving 7-day autonomy requires:
- All content for the upcoming week delivered at the time of last sync
- Asset cache large enough to hold all content referenced in the week's schedule
- Local audit buffer large enough to hold 7 days of PRE invocation records without overflow
- Entropy detection operating locally for 7 days without cloud confirmation

### 3.3 Autonomy Window Enforcement

The CMS must track per-venue last_sync_time and alert operators when a venue's sync is approaching the autonomy boundary:

| Time since last sync | CMS action                                                         |
|---------------------|--------------------------------------------------------------------|
| >48h                | INFO alert: venue approaching autonomy limit                       |
| >60h                | WARNING alert: venue may miss scheduled content changes            |
| >72h                | CRITICAL alert: venue has exceeded minimum autonomy window         |
| >7 days             | ESCALATION alert: venue requires immediate operator intervention   |

These thresholds apply to venues with standard (72h) autonomy. Venues with 7-day autonomy classification use proportionally adjusted thresholds.

---

## 4. Local Decision Quality

### 4.1 PRE Resolution Levels

The PRE resolves content through seven levels (L0–L6). All seven levels operate from locally-stored corpus data. There is no level that requires a network call.

| Level | Name                   | What it resolves                                              |
|-------|------------------------|---------------------------------------------------------------|
| L0    | Emergency override     | EMERGENCY_FREEZE state; active emergency content              |
| L1    | Explicit screen lock   | Screen-level overrides set by operator                        |
| L2    | Temporal override      | Time-bounded content locks within the schedule                |
| L3    | Campaign slot          | Active campaign content for the current timeslot              |
| L4    | Scheduled content      | Default schedule for the current daypart                      |
| L5    | Venue default          | Venue-level fallback content                                  |
| L6    | Platform emergency     | Platform-level emergency content (last-resort fallback)       |

Each level checks local corpus data. If a level does not produce a match, resolution falls through to the next level. This cascade is guaranteed to produce a result — L6 always resolves (it references the platform emergency content bundle, which is always present).

### 4.2 Time-of-Day and Date-Based Content

All time-of-day rules, date-specific campaigns, and daypart schedules execute correctly without CMS connectivity. The schedule is baked into the corpus. The player reads the local system clock (UTC, NTP-synchronized) and resolves PRE against the corpus for the current timestamp.

**Example:** A "Happy Hour" campaign scheduled for 16:00–18:00 Monday–Friday will begin and end correctly on each weekday without any CMS sync occurring after the corpus was last loaded. The corpus contains the full schedule window including start time, end time, day-of-week constraints, and content references.

**Date-sensitive constraint:** Date-based schedules (e.g., a Christmas promotion running December 24–26) resolve correctly as long as the corpus containing those dates was loaded before the start date. If a player is offline when a new corpus is published that adds a date-based schedule, the player will not have that schedule and will not execute it. This is correct behavior — the player faithfully executes the corpus it has; it does not guess at content.

### 4.3 Emergency Overrides at the Edge

Emergency overrides are stored in the corpus. A player that receives a corpus containing an active emergency override will execute it locally — the operator action of activating an emergency override in the CMS results in a corpus update that is delivered to all players. Once delivered, the override executes locally and persists even during offline periods.

The EMERGENCY_FREEZE state (which halts all PRE resolution) is handled differently. See Section 9.

---

## 5. Cloud vs Edge Responsibility Split

This is the canonical authority split. Any system design that blurs this boundary requires PLATFORM_ADMIN review.

### 5.1 Cloud CMS Responsibilities

| Responsibility                       | Notes                                                                        |
|--------------------------------------|------------------------------------------------------------------------------|
| Corpus authoring                     | Schedules, campaigns, overrides created and versioned in cloud CMS           |
| Corpus signing and version management| Each corpus version is checksummed and signed before distribution            |
| Canary promotion coordination        | SHADOW_ONLY → SINGLE_VENUE → FLEET_WIDE → AUTHORITATIVE managed in cloud     |
| Replay audit record long-term storage| Cloud store is the authoritative audit archive; edge buffer is transient     |
| Entropy analysis and alerting        | Cloud aggregates entropy metrics from all venues; generates operator alerts  |
| EMERGENCY_FREEZE issuance and lift   | Emergency state change requires PLATFORM_ADMIN authority, issued from cloud  |
| Campaign asset hosting (CDN)         | Media files served from CDN; players pull assets from CDN                    |
| Fleet health dashboard               | Cloud aggregates heartbeats and metrics across all players                   |
| Cross-venue operations               | Any action affecting multiple venues is cloud-coordinated                    |

### 5.2 Edge Player Responsibilities

| Responsibility                       | Notes                                                                        |
|--------------------------------------|------------------------------------------------------------------------------|
| PRE invocation (local execution)     | Pure local function, no cloud involvement                                    |
| Corpus storage and integrity         | Full corpus stored locally, checksum maintained                              |
| Asset cache management               | Downloads assets from CDN; stores locally; manages LRU eviction             |
| Replay audit record write (local)    | Written to local buffer; synced to cloud in batches when connected           |
| Entropy metric emission              | Local checksum comparison; metrics sent to cloud when connected              |
| Emergency state persistence          | EMERGENCY_FREEZE state persisted to disk; survives player reboots            |
| Heartbeat emission                   | 2-minute heartbeat to CMS (player is alive signal)                          |
| Corpus version poll                  | 5-minute lightweight poll to check if newer corpus version is available      |
| Clock synchronization                | NTP sync maintained; player refuses OPERATIONAL state if clock is unsync'd  |

### 5.3 The Hybrid Layer

Some operations are initiated at the edge but completed in the cloud:

| Operation                     | Edge action                          | Cloud action                                 |
|-------------------------------|--------------------------------------|----------------------------------------------|
| Audit record sync             | Buffers records locally; uploads batch | Stores records; confirms receipt             |
| Entropy reporting             | Computes local checksum mismatch metric | Aggregates; triggers alerts if threshold exceeded |
| Corpus update receive         | Polls for new version; downloads if available | Serves corpus package; records delivery acknowledgment |
| Emergency signal receive      | Listens on WebSocket/long-poll; applies state | Issues state change; confirms propagation   |

---

## 6. Edge Failure Handling

### 6.1 WAN Outage

**Detection:** Player's corpus version poll fails. Emergency channel WebSocket disconnects. Heartbeat acknowledgment not received.

**Response:**
1. Player continues invoking PRE from local corpus — no interruption to content playback
2. Replay audit records accumulate in local buffer
3. Entropy metrics accumulate locally (cannot upload)
4. Emergency channel falls back to 30-second poll interval; if that also fails, player enters OFFLINE mode for emergency channel
5. Player logs WAN outage duration and onset timestamp

**Duration limits:** Content integrity is maintained for the autonomy window (72h minimum). After the autonomy window, the platform cannot guarantee that scheduled content changes have been delivered. The player continues serving the last-valid corpus; it does not degrade or halt.

**Recovery:** See OFFLINE-OPERATION.md — Reconnection Procedure.

### 6.2 Corpus Checksum Mismatch on Sync

If a player downloads a new corpus version but the checksum does not match the value provided by the CMS:

1. Player rejects the corpus package entirely — it is not applied
2. Player continues operating on the last successfully verified corpus
3. Player logs a CORPUS_INTEGRITY_FAILURE event with: the expected checksum, the computed checksum, the corpus version ID, and the timestamp
4. Player sends an alert to the CMS (if WAN is available): corpus delivery failed for this screen_id
5. Player retries corpus download after a backoff interval (default: 15 minutes, 3 attempts, then escalate)

A player will never operate on a corpus that has not passed checksum verification. This is not configurable.

### 6.3 LAN Outage (Complete Network Loss)

If a player loses all network connectivity (both LAN and WAN):

1. PRE continues operating from local corpus — content playback is unaffected
2. All sync operations halt; audit buffer grows locally
3. Player cannot receive emergency signals via network — see Section 9.3 for emergency handling without network
4. Player logs LAN outage onset timestamp

This is the FULL_OFFLINE scenario from OFFLINE-OPERATION.md.

### 6.4 Local Storage Failure

If the microSD card fails or becomes read-only:

1. PRE cannot read corpus — player halts content resolution
2. Player enters EMERGENCY_FALLBACK mode with whatever content is in volatile memory (if any)
3. Player attempts to log the failure locally; if local storage is unavailable, logs only to STDOUT
4. Operator must be contacted for physical device intervention

Storage health monitoring (via `smartctl` or equivalent for flash media) should be implemented as part of the player systemd service health checks. The player should alert on storage health degradation before a hard failure occurs.

---

## 7. Edge Audit Integrity

### 7.1 Local Audit Buffer

Every PRE invocation produces an audit record. During connected operation, these records are batched and uploaded to the cloud audit store. During offline periods, records are written to a local append-only buffer.

**Buffer properties:**
- Append-only: records are never modified or deleted from the buffer
- Checksummed: each record includes a hash linking it to the previous record (hash-chained integrity)
- Durable: buffer is written to persistent storage (not memory) so records survive player restarts
- Bounded: buffer has a maximum size; when the maximum is approached, an alert is generated

**Buffer size estimation:**
- PRE invocations: approximately 1 per minute per screen (or more frequently for short content slots)
- Record size: approximately 2–5 KB per record (JSON with all resolution metadata)
- 72h at 1 invocation/minute: ~4,300 records × 5 KB = ~21 MB
- 7 days at 1 invocation/minute: ~10,000 records × 5 KB = ~50 MB
- Default local buffer maximum: 200 MB (sufficient for >7 days of dense invocations)

When the buffer approaches 80% of maximum, the player emits a AUDIT_BUFFER_FILL_WARNING event. At 95%, it emits AUDIT_BUFFER_CRITICAL. At 100%, older records are evicted to prevent overflow — but the invocation_id of evicted records is retained in a manifest so the cloud audit system knows a gap exists.

### 7.2 Audit Record Sync on Reconnect

When WAN connectivity is restored:

1. Player sends a sync intent to the CMS: "I have N buffered records from T_start to T_end"
2. CMS acknowledges and provides a receive endpoint
3. Player uploads records in chronological order, in batches of 100
4. CMS confirms receipt of each batch
5. Player marks confirmed records as eligible for local eviction
6. Process continues until all buffered records are confirmed

Records are never evicted from the local buffer until cloud receipt is confirmed. If the upload is interrupted partway through, the player retains unconfirmed records and resumes at the next reconnection.

---

## 8. Edge Entropy Detection

### 8.1 Local Entropy Computation

Entropy is the divergence between the corpus the CMS believes is deployed on a player and the corpus that is actually present. The player detects this locally by:

1. Maintaining a checksum of its currently active corpus
2. Comparing this checksum against the checksum the CMS reports as the expected deployed version for this screen_id
3. Computing a per-asset checksum for each asset in the local cache and comparing against the corpus's asset manifest

**Scan schedule:**
- Venue scan (corpus-level checksum comparison): every 60 minutes
- Fleet scan (asset-level checksum verification): every 6 hours

### 8.2 Entropy Metric Emission

Entropy metrics are not retained indefinitely on the player. They are computed, formatted as metric records, and buffered for upload to the CMS. The CMS aggregates entropy metrics across all players to compute venue-level and fleet-level entropy scores.

**During offline periods:** Entropy metrics accumulate in the local buffer alongside audit records. On reconnect, they are uploaded in the same batch process. The CMS backfills entropy history from the batch.

### 8.3 Local Entropy Alert

If the player computes an entropy score above a configured threshold locally (corpus checksum differs from expected), it logs a LOCAL_ENTROPY_DETECTED event. This event is included in the audit batch and triggers a CMS-level entropy alert when uploaded.

Critically, entropy detection does not cause the player to take any autonomous corrective action. The player does not self-correct corpus entropy. It detects, records, and reports. The response to entropy is a human operator decision mediated by the CMS.

---

## 9. Emergency State at the Edge

### 9.1 EMERGENCY_FREEZE via Network Signal

The standard path for EMERGENCY_FREEZE delivery is the real-time emergency channel (WebSocket or long-poll). When the player receives an EMERGENCY_FREEZE signal:

1. Player immediately halts all PRE invocations
2. Player writes EMERGENCY_FREEZE state to local persistent storage (`/etc/clubhub/emergency-state.json`)
3. Player switches content output to the designated emergency fallback content (pre-downloaded, verified)
4. Player continues attempting to maintain network connectivity to the emergency channel
5. Player logs the EMERGENCY_FREEZE receipt: timestamp, issuing authority, and the signal contents

The emergency fallback content must be verified on the player's local storage before the player can enter EMERGENCY_FALLBACK mode for a network-delivered freeze. If the emergency fallback content is not present, the player displays a blank screen (which is less harmful than displaying potentially non-compliant content).

### 9.2 Emergency Fallback Content Requirements

Each player must have a verified local copy of the platform emergency fallback content bundle at all times. This bundle is:

- Delivered as part of the initial corpus bootstrap
- Verified on every corpus sync operation
- Never evicted from local storage by LRU (it is exempt from the asset cache eviction policy)
- Defined at the platform level by PLATFORM_ADMIN; cannot be overridden by venue operators

The bundle typically contains a simple looping video or image sequence that is compliance-safe, non-commercial, and venue-appropriate for all markets.

### 9.3 Emergency Without Network (Pre-Positioned Emergency)

An emergency that occurs while a player is offline cannot be delivered via the network emergency channel. This is a known operational gap. Mitigations:

1. **Pre-positioned emergency content:** Emergency fallback content is always present locally. If an operator needs to take screens to emergency state without network connectivity, the emergency must be triggered by physically accessing the player and running a local emergency activation command.

2. **Hardware emergency button (GRADE_A venues):** Venues classified GRADE_A must have a hardware emergency button wired to the player's GPIO. Pressing this button triggers a local EMERGENCY_FREEZE without network connectivity. The player writes the emergency state to disk immediately.

3. **Emergency signal persistence:** Once a player has been in EMERGENCY_FREEZE state, that state is written to disk. If the player reboots during an emergency (power outage, etc.), it re-reads the emergency state from disk on startup and remains in EMERGENCY_FALLBACK mode. An emergency survives player reboots.

### 9.4 EMERGENCY_FREEZE Lift at the Edge

A player in EMERGENCY_FALLBACK mode resumes normal operation only when it receives an authenticated EMERGENCY_FREEZE_LIFT signal from the CMS. This signal:

- Must be signed by PLATFORM_ADMIN or delegated ENTERPRISE_ADMIN authority
- Is delivered via the same emergency channel as the freeze signal
- Results in the player deleting the emergency state from local disk
- Results in the player immediately resuming PRE invocations using the current local corpus

A player will NOT autonomously exit EMERGENCY_FALLBACK mode. If a player reboots while in EMERGENCY_FALLBACK and the EMERGENCY_FREEZE_LIFT has not been received, it remains in EMERGENCY_FALLBACK after reboot.

---

## 10. Operational Implications

### 10.1 Corpus Publish Lead Times

Given the 72h autonomy window, operations teams must enforce the following publish workflow:

- **Standard campaigns:** Must be published and confirmed delivered to all target players at least 72h before the campaign start date.
- **Emergency campaigns:** May be published with shorter lead times, but delivery confirmation must be obtained from all target players before the lead time drops below 4 hours.
- **Immediate overrides:** Are delivered via the corpus update path and take effect as soon as the player syncs; under normal network conditions, delivery latency is 5–15 minutes.

### 10.2 Testing Edge Autonomy

Before a venue is declared OPERATIONAL, the following autonomy test must be performed:

1. Load the venue's corpus onto all players
2. Disconnect all players from WAN for 4 hours
3. Observe that all scheduled content changes within the 4-hour window execute correctly
4. Reconnect and confirm that buffered audit records sync successfully
5. Confirm that entropy metrics for the offline period are received by the CMS

This test must be documented in the venue commissioning record and signed off by an authorized platform operator.

### 10.3 Player Self-Identification at the Edge

Each player knows its own screen_id, venue_id, and the CMS endpoints it should contact. This information is stored in `/etc/clubhub/identity.json` and is the stable identity of the player. The player does not need to query the CMS to know who it is.

This means a player can be inspected locally (via SSH or physical access) at any time and will report its screen_id, current corpus version, last sync time, current mode, and current PRE output — without any CMS connectivity required.
