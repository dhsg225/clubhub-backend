# OFFLINE-OPERATION.md
# ClubHub TV — Offline Operation Requirements and Behavior

**Document type:** Deployment Architecture Reference
**Status:** Canonical
**Authority:** Platform Operations
**Audience:** Infrastructure engineers, platform operators, venue operators, support teams
**Last updated:** 2026-05-26
**Depends on:** EDGE-BEHAVIOR.md, VENUE-AUTONOMY.md, PLAYER-TOPOLOGY.md

---

## Table of Contents

1. [Offline Scenario Classification](#1-offline-scenario-classification)
2. [BRIEF_OFFLINE: WAN Outage <1 Hour](#2-brief_offline-wan-outage-1-hour)
3. [EXTENDED_OFFLINE: WAN Outage 1h–72h](#3-extended_offline-wan-outage-1h72h)
4. [PROLONGED_OFFLINE: WAN Outage >72h](#4-prolonged_offline-wan-outage-72h)
5. [FULL_OFFLINE: No LAN or WAN](#5-full_offline-no-lan-or-wan)
6. [AIR_GAPPED: Permanent No-WAN Venues](#6-air_gapped-permanent-no-wan-venues)
7. [Reconnection Procedure](#7-reconnection-procedure)
8. [Manual Corpus Update Procedure (Air-Gapped)](#8-manual-corpus-update-procedure-air-gapped)
9. [Offline Constitutional Guarantees](#9-offline-constitutional-guarantees)
10. [Operator Communication During Offline Periods](#10-operator-communication-during-offline-periods)
11. [Testing Offline Behavior](#11-testing-offline-behavior)

---

## 1. Offline Scenario Classification

Offline scenarios are classified by duration and scope. Classification determines the operational response required.

| Classification     | Condition                        | Content continuity | Audit integrity | Operator action required     |
|--------------------|----------------------------------|-------------------|-----------------|------------------------------|
| `BRIEF_OFFLINE`    | WAN outage <1 hour               | Full               | Buffered locally | None — transparent           |
| `EXTENDED_OFFLINE` | WAN outage 1h–72h                | Full               | Buffered locally | Monitor; notify if >24h      |
| `PROLONGED_OFFLINE`| WAN outage >72h                  | Partial risk       | Buffered locally | Operator intervention required |
| `FULL_OFFLINE`     | No LAN or WAN                    | Emergency fallback | Buffered locally | Physical investigation       |
| `AIR_GAPPED`       | Permanent no-WAN venue           | Full (manual sync) | Offline local only | Manual corpus update process |

**Content continuity notes:**

- "Full" means all scheduled content changes within the autonomy window execute correctly from local corpus.
- "Partial risk" means content changes scheduled after the corpus was last synced will not execute. The player continues serving the last-valid corpus, but new campaigns or schedule changes published after last sync are unknown to the player.
- "Emergency fallback" means the device cannot resolve PRE normally (corpus or LAN unavailable); it serves the locally-cached emergency fallback content bundle.

---

## 2. BRIEF_OFFLINE: WAN Outage <1 Hour

### 2.1 Player Behavior

The player continues operating in ACTIVE mode throughout a brief WAN outage. No operator intervention is required and no content disruption occurs.

**What continues working normally:**
- PRE.resolve() invocations from local corpus
- Content playback from local asset cache
- Scheduled content transitions (time-of-day rules, daypart changes)
- Local entropy detection (corpus checksum comparison)
- Replay audit record write to local buffer

**What stops working:**
- Corpus version check (5-minute poll fails)
- Audit record batch upload (15-minute batch fails)
- Emergency channel WebSocket (drops; player falls back to 30-second long-poll)
- Heartbeat acknowledgment (player continues sending; CMS sees heartbeat gap)

### 2.2 CMS Behavior

The CMS detects the player's outage via missed heartbeats (2-minute interval). After 3 consecutive missed heartbeats (6 minutes), the CMS marks the player as CONNECTIVITY_DEGRADED and generates an INFO-level alert.

After 15 minutes of no heartbeat, the CMS generates a WARNING-level alert to the VENUE_ADMIN.

### 2.3 Recovery

On WAN restoration:
- Emergency channel reconnects automatically within 30 seconds
- Corpus version check resumes
- Audit buffer uploads immediately
- Heartbeat resumes; CMS marks player ACTIVE
- No data loss; no operator action required

---

## 3. EXTENDED_OFFLINE: WAN Outage 1h–72h

### 3.1 Player Behavior

The player remains in ACTIVE mode (content playback continues) but enters an increasingly autonomous operational posture. The player cannot receive corpus updates, emergency signals, or operator commands during this period.

**Risk profile during extended offline:**
- New corpus versions published during the outage will not reach the player until reconnect
- EMERGENCY_FREEZE signals cannot be delivered via network (see EDGE-BEHAVIOR.md Section 9.3 for hardware emergency button option)
- Operator commands issued through the CMS during this period are queued and delivered on reconnect

**Audit buffer growth:** At 1 PRE invocation per minute, the local audit buffer grows by approximately 300 KB per hour. A 72h offline period accumulates approximately 21 MB of audit records — well within the 200 MB buffer limit.

### 3.2 CMS Alerting During Extended Offline

| Duration     | Alert level | Recipients                           | Message                                       |
|-------------|-------------|--------------------------------------|-----------------------------------------------|
| >6h          | WARNING     | VENUE_ADMIN, REGIONAL_MANAGER        | Venue connectivity lost: extended outage       |
| >12h         | WARNING     | VENUE_ADMIN, REGIONAL_MANAGER        | Venue offline >12h: check venue internet       |
| >24h         | CRITICAL    | VENUE_ADMIN, ENTERPRISE_ADMIN        | Venue offline >24h: intervention may be needed |
| >48h         | CRITICAL    | ENTERPRISE_ADMIN                     | Venue approaching 72h autonomy limit           |
| >60h         | ESCALATION  | ENTERPRISE_ADMIN, PLATFORM_ADMIN     | Venue within 12h of autonomy limit: urgent     |

### 3.3 Content Continuity Risk Window

Content continuity is maintained for all content changes that were baked into the corpus at the time of last sync. The risk window opens when a content change is scheduled to go live during the offline period but was published after the last corpus sync.

**Example:**
- Last corpus sync: Monday 08:00
- WAN outage begins: Monday 10:00
- New campaign published in CMS: Monday 14:00, scheduled to start Tuesday 09:00
- Player offline through Tuesday 09:00

In this scenario, the Tuesday campaign does not activate on this player. The player serves whatever the previous schedule dictated for that timeslot. This is correct behavior — the player faithfully executes its corpus. The gap is a content management risk, not a system failure.

**Mitigation:** Venues with known connectivity issues should be marked GRADE_B or GRADE_A in the autonomy model, triggering earlier CMS alerts and more conservative corpus publish lead times.

---

## 4. PROLONGED_OFFLINE: WAN Outage >72h

### 4.1 Classification Trigger

PROLONGED_OFFLINE is declared when a player has been offline for more than 72 hours. At this point, the platform cannot guarantee that the player's corpus is current with respect to content changes that may have been published in the intervening period.

This is an elevated operational state. It is not a system failure — the player is still serving content correctly from its last-valid corpus. But the content it is serving may be stale relative to what the CMS intends to be showing.

### 4.2 Player Behavior

The player remains in ACTIVE mode. From the player's perspective, nothing has changed — it continues resolving PRE from local corpus. The player does not know that its corpus may be stale relative to the CMS's current intent.

**What the player does:**
- Continues PRE invocations using the locally-stored corpus
- Logs an internal EXTENDED_OFFLINE_THRESHOLD_EXCEEDED event at the 72h mark
- Continues accumulating audit records and entropy metrics locally
- Continues attempting to establish WAN connectivity (with exponential backoff on failed connections)

**What the player does not do:**
- The player does not change its operating mode
- The player does not halt content delivery
- The player does not notify the operator independently (no WAN means no notification path)

### 4.3 Required Operator Intervention

When PROLONGED_OFFLINE is declared for a venue, the following escalation path applies:

1. **Immediate:** ENTERPRISE_ADMIN is notified. They should attempt to contact venue staff to investigate the connectivity issue.
2. **Venue staff action:** Venue staff should check internet router, ISP service, physical cabling. Attempt to restore WAN connectivity.
3. **If connectivity cannot be restored within 48h:** Dispatch a field technician. The Pi's 4G USB modem backup (if installed) should be activated. Alternatively, arrange manual corpus update via USB if content changes are critical (see Section 8).
4. **If venue is expected to remain offline for an extended period:** Consider air-gapped operation classification (Section 6).

### 4.4 Entropy Accumulation During Prolonged Offline

The longer a venue remains offline, the more divergence may accumulate between the CMS's intended corpus and the player's deployed corpus. This divergence is not detectable by the CMS until the player reconnects. When the player reconnects:

1. The player sends an entropy report covering the offline period
2. The CMS computes a retroactive entropy score for the venue's offline period
3. The CMS identifies any scheduled content that the player missed
4. An operator review is triggered to confirm whether missed content is operationally significant (e.g., if a compliance-required message was not displayed during the offline period)

---

## 5. FULL_OFFLINE: No LAN or WAN

### 5.1 When This Occurs

FULL_OFFLINE occurs when a player loses all network connectivity, including the venue LAN. This is an unusual condition that typically indicates:

- A catastrophic venue network failure (switch failure, power outage affecting networking equipment)
- Physical damage to the player's Ethernet cable or port
- A hardware failure on the player itself affecting the network interface

### 5.2 Player Behavior

Without LAN access, the player cannot reach the venue's local network segment. It continues operating PRE from locally-stored corpus with no change to content playback. However:

- All sync operations are halted (same as WAN outage)
- Emergency channel is unreachable
- The player cannot be reached for any network-based management operations

### 5.3 Emergency Content

If a physical investigation reveals that the player has also lost access to local corpus storage (e.g., SD card failure), the player falls to the last content it has in volatile memory. If that content is also unavailable, the screen goes to the emergency fallback bundle (if available) or displays a black screen.

A black screen is the safe failure state for ClubHub TV. An unknown content display (untested, unverified) is more dangerous than a blank screen from a compliance perspective.

### 5.4 Physical Intervention

FULL_OFFLINE requires physical investigation. The operator should:

1. Verify power to the Pi player (LED indicators on the board)
2. Check Ethernet cable and connection at both the Pi and the switch
3. Check the venue network switch is operational
4. SSH to the Pi from the same LAN segment to check for software-level network issues
5. If the Pi is unresponsive: connect a keyboard and monitor directly to diagnose boot failure

If the SD card is confirmed failed: replace SD card with a pre-provisioned spare. See PLAYER-TOPOLOGY.md Section 9.2 for the device replacement procedure.

---

## 6. AIR_GAPPED: Permanent No-WAN Venues

### 6.1 Definition

An AIR_GAPPED venue is one that has no reliable internet connectivity and is not expected to obtain it. These venues operate permanently in manual-sync mode. All corpus updates are delivered via physical media or a local file server.

This classification is distinct from FULL_OFFLINE (which is a failure state) — AIR_GAPPED is a designed and documented operating mode for specific venues.

**Typical AIR_GAPPED venues:**
- Remote regional clubs in areas without reliable internet infrastructure
- Venues in buildings with network restrictions (some regulated environments, defense-adjacent facilities)
- Temporary venue installations where installing WAN infrastructure is not viable

All AIR_GAPPED venues must be assigned GRADE_A autonomy classification (see VENUE-AUTONOMY.md). This is non-negotiable — venues that require manual corpus updates must have the highest autonomy capability because each update cycle may be weeks apart.

### 6.2 AIR_GAPPED Player Behavior

An AIR_GAPPED player operates identically to a WAN-connected player in all respects except:

- Corpus updates are received via USB rather than network pull
- Audit records accumulate locally indefinitely (until a field technician retrieves them)
- Entropy metrics accumulate locally and are submitted manually at each visit
- Emergency signals cannot be delivered remotely — hardware emergency button is mandatory (GRADE_A requirement)

The player application does not have a special "air-gapped mode" — from the application's perspective, it is simply a player that has been offline for an extended period and is receiving corpus updates via local media.

### 6.3 Air-Gapped Corpus Update Cadence

ENTERPRISE_ADMIN must establish a defined corpus update schedule for each AIR_GAPPED venue:

| Venue risk classification | Minimum update cadence | Recommended cadence |
|--------------------------|------------------------|---------------------|
| Compliance-critical (e.g., gaming venues) | Weekly | Twice weekly |
| Standard commercial venues | Bi-weekly | Weekly |
| Low-risk venues (limited schedule changes) | Monthly | Bi-weekly |

Compliance-critical venues require weekly visits at minimum because regulatory display requirements can change, and the venue must be able to demonstrate that correct content was displayed during any given period. Weekly corpus updates with local audit record retrieval provides a defensible audit trail.

---

## 7. Reconnection Procedure

When a player reconnects after any offline period (BRIEF, EXTENDED, or PROLONGED), the following sequence executes automatically:

### 7.1 Reconnection Sequence

```
[WAN connectivity restored]
         |
         v
[Step 1] Emergency channel reconnects
         - WebSocket or long-poll re-established
         - Player receives any pending EMERGENCY signals
         - If EMERGENCY_FREEZE is pending: player enters EMERGENCY_FALLBACK immediately
         - Otherwise: player remains ACTIVE
         |
         v
[Step 2] Corpus version check
         - Player polls CMS for current authoritative corpus version
         - If newer version exists: download and verify (see Step 3)
         - If current version matches: no action
         |
         v
[Step 3] Corpus update (if applicable)
         - Download new corpus package
         - Verify checksum against CMS-provided expected value
         - If checksum passes: atomically apply new corpus (player transitions ACTIVE → STANDBY → ACTIVE)
         - If checksum fails: reject; retry with exponential backoff; alert CMS
         |
         v
[Step 4] Replay audit batch upload
         - Send sync intent to CMS: {screen_id, buffer_start, buffer_end, record_count}
         - Upload in chronological batches of 100 records
         - Await CMS confirmation per batch
         - Mark confirmed records as eligible for local eviction
         - Log: {offline_duration, records_uploaded, sync_completed_at}
         |
         v
[Step 5] Entropy batch upload
         - Upload accumulated entropy metrics
         - CMS computes retroactive entropy scores
         - CMS generates alerts for any threshold breaches during the offline period
         |
         v
[Step 6] Offline duration report
         - Player sends report to CMS: {screen_id, offline_began, offline_ended, duration_seconds, corpus_version_at_reconnect}
         - CMS logs this to the venue operational history
         - CMS notifies VENUE_ADMIN of offline period conclusion and its duration
```

### 7.2 Audit Record Sync Guarantees

Audit record sync is append-only. There are no conflicts. The CMS accepts all records from the player's buffer, in chronological order. Records from different players at the same venue may arrive out of order relative to each other; this is expected and the CMS handles it by sorting on invocation_timestamp.

If the upload is interrupted mid-batch (second WAN outage), the player retains all unconfirmed records and resumes from the last confirmed batch at next reconnection.

### 7.3 Atomic Corpus Application

A corpus update during reconnection is atomic. The player does not partially apply a new corpus. The sequence is:

1. Download complete corpus package to a staging location
2. Verify checksum of the complete package
3. Atomically replace the active corpus directory with the verified staged package
4. Log the corpus application as a replay-auditable event: {screen_id, old_corpus_version, new_corpus_version, applied_at, verified_checksum}
5. Continue PRE invocations using the new corpus

If Step 3 fails (e.g., power loss during the atomic replace), the player retains the old corpus and retries the download at next reconnection.

---

## 8. Manual Corpus Update Procedure (Air-Gapped)

This procedure is followed when delivering a corpus update to a venue that cannot receive updates via WAN.

### 8.1 Package Preparation (Cloud CMS)

1. **ENTERPRISE_ADMIN** triggers "Generate Offline Package" in the CMS for the target venue
2. CMS assembles a signed corpus package containing:
   - The current authoritative corpus JSON for the target venue
   - All referenced assets not yet present in the venue's known asset cache
   - A corpus manifest: expected checksum, venue_id, target_corpus_version, generated_at, expires_at
   - A digital signature from the CMS signing key
3. Package is exported as a single encrypted archive: `clubhub-corpus-{venue_id}-{version}.pkg`
4. Package is provided to the field technician via secure transfer (not email; use a secure file transfer platform)

**Package expiry:** Packages expire 30 days from generation. An expired package will be rejected by the player. This prevents accidental application of a stale package during a future visit.

### 8.2 On-Site Delivery (Field Technician)

1. Field technician arrives at venue with corpus package on a USB drive
2. Connect USB drive to the Pi player (any USB port)
3. Run the corpus update script: `sudo /opt/clubhub/bin/apply-offline-corpus.sh /media/usb/clubhub-corpus-{venue_id}-{version}.pkg`
4. Script performs:
   - Signature verification against CMS public key (baked into the player's trusted key store)
   - Package expiry check
   - Corpus checksum verification
   - Atomic corpus replacement
   - Audit log entry for the manual update
5. Script outputs: SUCCESS or FAILURE with reason
6. If SUCCESS: player continues ACTIVE mode with new corpus
7. If FAILURE: player retains current corpus; technician must contact ENTERPRISE_ADMIN for a new package

### 8.3 Audit Record Retrieval (Air-Gapped)

During the same visit, the technician retrieves buffered audit records:

1. Run: `sudo /opt/clubhub/bin/export-audit-buffer.sh /media/usb/`
2. Script copies the audit buffer to the USB drive as: `audit-{screen_id}-{export_timestamp}.log`
3. Technician brings USB back to office
4. ENTERPRISE_ADMIN uploads audit records to CMS via the "Import Offline Audit" function
5. CMS ingests records, verifies hash chain integrity, and incorporates into the audit archive

This process must be completed within 30 days of the export to satisfy the audit record ingestion SLA.

### 8.4 Manual Update Audit Trail

Every manual corpus update is logged as a distinct audit event type `MANUAL_CORPUS_UPDATE` in both the player's local buffer and the CMS. This event records:

- The technician's identity (entered during the update script prompt)
- The corpus package version applied
- The previous corpus version replaced
- The timestamp of application
- The package signature verification result

This audit trail is required for compliance venues — regulators may ask for evidence that content changes were applied at a specific date and time, and the manual update audit event provides that evidence.

---

## 9. Offline Constitutional Guarantees

These guarantees must hold during any offline period. They are not aspirational targets — they are invariants. If any of these fails, it is a platform defect requiring immediate investigation.

**G-1: PRE determinism is preserved offline**
All PRE invocations during an offline period are deterministic. Given the same corpus and the same timestamp, the player produces the same output, regardless of network connectivity. The offline PRE outputs are identical to what they would have been if the player were connected.

**G-2: Offline PRE invocations are fully replayable**
Every PRE invocation during an offline period produces an audit record written to the local buffer. The corpus used for each invocation is retained locally. Given the audit record and the corpus, any invocation from the offline period can be replayed and verified. The replay audit guarantee is not weakened by offline operation.

**G-3: Corpus integrity is maintained offline**
The player never operates on a corpus that has not been checksum-verified. If the local corpus file is corrupted during an offline period, the player detects this on the next read and enters STANDBY mode (halting content delivery) rather than serving content from a corrupt corpus. A corrupted corpus is treated the same way as a failed checksum on a newly downloaded corpus — the player will not operate on it.

**G-4: Emergency state persists through offline and reboots**
If a player entered EMERGENCY_FALLBACK mode before going offline, it remains in EMERGENCY_FALLBACK mode throughout the offline period and after any reboots. The emergency state is not automatically cleared by the passage of time, by reconnection, or by any event other than an authenticated EMERGENCY_FREEZE_LIFT signal from the CMS.

**G-5: No audit records are silently discarded**
If the local audit buffer reaches capacity and older records must be evicted, the eviction is logged. The eviction record contains the invocation_ids of the evicted records so the CMS can identify the gap. Silent data loss from the audit record stream is prohibited.

**G-6: Offline duration is accurately reported**
When a player reconnects, it reports its offline duration accurately. This report is itself an audit record. The reported duration is derived from the player's system clock (NTP-synchronized prior to going offline); it is not an estimate.

---

## 10. Operator Communication During Offline Periods

### 10.1 CMS Alert Routing

During a player or venue offline period, CMS alerts are routed as follows:

| Duration         | Alert level  | Routed to                                        |
|-----------------|--------------|--------------------------------------------------|
| 6+ minutes      | INFO         | Operations dashboard (not paged)                  |
| 15+ minutes     | WARNING      | VENUE_ADMIN (in-app notification)                 |
| 1+ hours        | WARNING      | VENUE_ADMIN, REGIONAL_MANAGER (email + in-app)   |
| 6+ hours        | CRITICAL     | VENUE_ADMIN, ENTERPRISE_ADMIN (email + SMS)       |
| 24+ hours       | CRITICAL     | ENTERPRISE_ADMIN (email + SMS + phone escalation) |
| 48+ hours       | ESCALATION   | ENTERPRISE_ADMIN, PLATFORM_ADMIN (all channels)  |
| 72+ hours       | ESCALATION   | Full escalation + mandatory field dispatch        |

### 10.2 What Operators Cannot Do During Venue Offline

Operators must understand the following limitations during offline periods:

- **Cannot push new content:** Corpus updates cannot reach a player that is not connected.
- **Cannot issue emergency stops remotely:** EMERGENCY_FREEZE cannot be delivered to an offline player via network. Hardware emergency button (GRADE_A) is the only remote-less option.
- **Cannot retrieve current screen state:** The player's operational state is not visible to the CMS until it reconnects.
- **Cannot replay recent invocations:** Recent audit records are buffered locally on the player and are not visible in the CMS until sync.

### 10.3 Operator Actions That Are Queued

Some operator actions issued during a venue's offline period are queued by the CMS and delivered on reconnect:

- Corpus version updates (delivered on reconnect as part of corpus sync)
- Schedule changes (included in next corpus package)
- Non-emergency override changes (included in next corpus package)

Queued actions are not time-sensitive by default. Operators must explicitly mark an action as time-critical when issuing it, which triggers alerting if the target player has not reconnected within 4 hours.

---

## 11. Testing Offline Behavior

### 11.1 Required Pre-Commissioning Tests

Before a venue is declared OPERATIONAL, the following offline behavior tests must be executed and results recorded in the commissioning report:

**Test 1: BRIEF_OFFLINE simulation**
- Disconnect WAN for 30 minutes
- Verify content continues normally
- Reconnect; verify audit sync completes; verify no data loss
- Required result: all pass; zero content disruption

**Test 2: EXTENDED_OFFLINE simulation**
- Disconnect WAN for 4 hours
- Verify scheduled content changes within the 4-hour window execute correctly
- Reconnect; verify audit sync completes; verify entropy metrics received
- Required result: all scheduled changes execute; sync completes; no anomalies

**Test 3: Emergency state persistence**
- Trigger EMERGENCY_FREEZE via CMS
- Confirm player enters EMERGENCY_FALLBACK
- Reboot the player while in EMERGENCY_FALLBACK
- Confirm player returns to EMERGENCY_FALLBACK after reboot (not to ACTIVE)
- Issue EMERGENCY_FREEZE_LIFT from CMS
- Confirm player returns to ACTIVE
- Required result: all transitions correct; emergency state survived reboot

**Test 4: Corpus checksum rejection**
- Manually corrupt a corpus file on the player
- Verify player detects corruption and enters STANDBY mode
- Verify player rejects the corrupt corpus and does not serve content from it
- Deliver a valid corpus; verify player returns to ACTIVE
- Required result: corrupt corpus rejected; player does not serve unverified content

### 11.2 Periodic Operational Tests

After commissioning, offline behavior should be verified:

- **Quarterly:** Simulate 1-hour WAN outage; verify clean recovery
- **Annually:** Full EXTENDED_OFFLINE test (4 hours) with audit sync verification
- **On any infrastructure change:** Rerun Test 1 and Test 3 minimum
