# ASSET-DISTRIBUTION.md
# ClubHub TV — Media Asset Distribution Architecture

**Document type:** Deployment Architecture Reference
**Status:** Canonical
**Authority:** Platform Operations
**Audience:** Infrastructure engineers, content operations, platform operators
**Last updated:** 2026-05-26
**Depends on:** PLAYER-TOPOLOGY.md, EDGE-BEHAVIOR.md, POLLING-AND-SYNC-ARCHITECTURE.md

---

## Table of Contents

1. [Asset Types and Characteristics](#1-asset-types-and-characteristics)
2. [Distribution Architecture](#2-distribution-architecture)
3. [Asset Integrity Model](#3-asset-integrity-model)
4. [Asset Versioning Policy](#4-asset-versioning-policy)
5. [Prefetch Strategy](#5-prefetch-strategy)
6. [Storage Constraints and Cache Management](#6-storage-constraints-and-cache-management)
7. [Campaign Asset Readiness Gate](#7-campaign-asset-readiness-gate)
8. [Asset Delivery SLAs](#8-asset-delivery-slas)
9. [Asset Retirement and Retention](#9-asset-retirement-and-retention)
10. [Operational Procedures](#10-operational-procedures)

---

## 1. Asset Types and Characteristics

### 1.1 Asset Taxonomy

| Asset type          | Format                    | Typical size    | Delivery method      |
|---------------------|---------------------------|-----------------|----------------------|
| Video (primary)     | H.264/H.265 MP4           | 50 MB – 500 MB  | CDN pull             |
| Video (short-form)  | H.264 MP4 <30s            | 5 MB – 50 MB    | CDN pull             |
| Images              | JPEG, PNG, WebP           | 500 KB – 5 MB   | CDN pull             |
| Audio               | AAC, MP3                  | 2 MB – 20 MB    | CDN pull (optional)  |
| Dynamic templates   | HTML + JSON layout def    | <500 KB         | Included in corpus   |
| Corpus metadata     | JSON                      | 10 KB – 5 MB    | CMS sync direct      |
| Emergency bundle    | MP4 or image set          | 10 MB – 100 MB  | Pre-provisioned + CDN |

### 1.2 Video Encoding Requirements

All video assets must be delivered in a format the Pi player hardware can decode without excessive CPU load:

| Specification      | Required                             | Notes                                      |
|--------------------|--------------------------------------|--------------------------------------------|
| Container          | MP4 (H.264) preferred                | Pi 4/5 has H.264/H.265 hardware decode     |
| Resolution         | 1080p maximum (1920×1080)            | 4K not supported on standard Pi display output |
| Frame rate         | 25 fps or 30 fps                     | Higher frame rates not recommended         |
| Bitrate (H.264)    | 4–8 Mbps for 1080p                  | Ensures smooth playback on SD card read speeds |
| Bitrate (H.265)    | 2–4 Mbps for 1080p                  | Pi 5 preferred for H.265 at this bitrate   |
| Audio codec        | AAC stereo or mono                   | Required even if venue mutes audio         |
| Keyframe interval  | ≤2 seconds                          | Required for reliable seek to start of content |

Video assets that do not meet these specifications may cause playback issues (dropped frames, audio desync, excessive CPU load causing thermal throttling). The CMS should validate encoding specifications on upload and reject non-compliant assets with operator-visible error messages.

### 1.3 Dynamic Templates

Dynamic templates are layout definitions that control how content is composed on screen (e.g., a layout with a video zone, a ticker zone, and a clock zone). Templates are JSON files that reference asset IDs — the template itself is not a media file.

Templates are small and included directly in the corpus metadata package rather than distributed via CDN. A corpus update that changes a template layout is a corpus sync operation, not an asset download.

### 1.4 Emergency Bundle

The emergency bundle is a special asset set that:

- Is pre-provisioned on all players at initial setup
- Must always be present on the player (never evicted by LRU)
- Is re-verified on every corpus sync
- Contains the content displayed when the player is in EMERGENCY_FALLBACK mode

Emergency bundle assets are managed by PLATFORM_ADMIN. Venue operators cannot modify or replace the emergency bundle. If a VENUE_ADMIN requires custom emergency content (e.g., venue-specific safety messaging), this must be approved by PLATFORM_ADMIN and incorporated into the platform-level emergency bundle configuration for that venue.

---

## 2. Distribution Architecture

### 2.1 Content CDN

Media assets are hosted on a content delivery network (CDN). The CDN provides:

- Geographic distribution of asset files close to venue locations
- HTTPS delivery with TLS 1.2+
- High throughput for large video file transfers
- Range request support (allows resumable downloads and byte-range streaming)
- Signed URL support (asset URLs include time-limited authentication signatures)

Players pull assets from the CDN. The CMS does not push assets to players. The corpus metadata package contains CDN URLs for each asset referenced in the schedule. Players use these URLs to download assets during prefetch.

### 2.2 Corpus Metadata Distribution

The corpus metadata package (JSON, typically <5 MB) is not delivered via CDN. It is delivered via the CMS sync service directly. This design choice is intentional:

- The corpus is the authority document for what is scheduled — it must be served by an authoritative source with access control
- The corpus is version-controlled and checksummed; CDN edge caches may return stale versions
- The corpus is small enough to deliver efficiently from a single endpoint

The corpus delivery path is: `CMS primary → CMS secondary (regional) → player`.

### 2.3 End-to-End Asset Flow

```
[Content team uploads video to CMS]
         |
         v
[CMS validates encoding, computes SHA-256 checksum, assigns asset_id]
         |
         v
[CMS uploads to CDN origin (cloud storage bucket)]
         |
         v
[CDN distributes to regional edge nodes]
         |
         v
[ENTERPRISE_ADMIN creates campaign referencing asset_id]
         |
         v
[Corpus version is published: corpus includes asset_id → CDN URL mapping]
         |
         v
[Corpus version replicated to regional CMS sync endpoints]
         |
         v
[Player syncs new corpus version, reads asset manifest for upcoming 24h]
         |
         v
[Player sends prefetch requests to CDN for each required asset not in local cache]
         |
         v
[CDN delivers assets to player; player verifies checksum on receipt]
         |
         v
[Assets written to local asset cache; asset_id marked as READY in player's manifest]
         |
         v
[Campaign becomes eligible for activation once all target players confirm asset READY]
```

### 2.4 CDN URL Signing

Asset URLs in the corpus are time-limited signed URLs. Signed URLs prevent unauthorized players or third parties from accessing content assets directly. Signing parameters:

- URL expiry: 48 hours from corpus publication
- Player authentication: URL includes player's screen_id as a claim (CDN validates on delivery)
- Rotation: when a corpus version is updated, new signed URLs are generated for all referenced assets

**Note:** Because signed URLs expire, a player that has been offline for >48h may find that corpus asset URLs have expired. On reconnect, the player syncs the current corpus version, which contains fresh signed URLs. This means a player should not attempt to use cached URLs from a previous corpus version to download assets — it must always use the URL from its current active corpus.

---

## 3. Asset Integrity Model

### 3.1 Checksum Strategy

Every asset stored in the CMS has a SHA-256 checksum computed at upload time. This checksum is stored in the asset record and is included in every corpus metadata package that references the asset.

The player verifies the checksum after downloading any asset:

1. Download complete asset file from CDN
2. Compute SHA-256 of the downloaded file
3. Compare against expected checksum from corpus metadata
4. If match: write to local cache; mark as VERIFIED
5. If mismatch: delete the downloaded file; log ASSET_INTEGRITY_FAILURE; retry

A checksum mismatch on a CDN-delivered asset is treated as:
- A potential CDN corruption event (most common cause: incomplete download, corrupted edge cache)
- A potential content tampering event (rare; triggers security alerting if repeated for the same asset)

### 3.2 Checksum Verification on Playback

Asset integrity is also verified before each playback session begins. When the PRE outputs a playlist containing asset references, the player verifies that the local cached copy of each required asset:

1. Exists in the local asset cache
2. Has a valid VERIFIED status (checksum was confirmed at download time)
3. Has not been modified since download (if the player supports continuous filesystem integrity monitoring)

If a required asset is MISSING or UNVERIFIED when playback is about to begin, the player:
1. Logs an ASSET_MISSING_AT_PLAYBACK event
2. Attempts emergency re-download from CDN (if WAN is available)
3. If re-download succeeds and verifies: plays the content
4. If re-download fails or WAN is unavailable: skips to the next content item in the PRE output playlist, logs the skip
5. If all items in the current PRE output are unavailable: falls back to the next PRE resolution level (venue default → platform emergency)

### 3.3 Asset Checksum as Entropy Signal

Asset-level checksum verification is part of the platform's entropy detection model. If a player consistently reports a checksum mismatch for an asset that other players verify successfully, this is an entropy signal indicating potential local storage corruption on that player.

The 6-hour fleet scan includes an asset-level checksum sweep. Results are reported to the CMS as part of the entropy metrics batch. The CMS flags players with persistent asset integrity failures for operator investigation.

---

## 4. Asset Versioning Policy

### 4.1 Immutable Asset IDs

Assets in ClubHub TV are immutable. When a content file is uploaded:

- It is assigned a permanent asset_id (UUID)
- It is stored at a permanent CDN path based on that asset_id
- Its checksum is recorded permanently in the CMS

An asset's content never changes. If a replacement is needed (e.g., updated video file), the replacement is uploaded as a new asset with a new asset_id. The corpus is then updated to reference the new asset_id instead of the old one.

**Rationale:** Mutable assets make replay audit unreliable. If an asset's content could change over time, then replaying a historical PRE invocation might render different content than what actually played at that time. By making all assets immutable and giving them permanent IDs, any historical PRE invocation can be replayed and the result is guaranteed to match what the screen displayed.

### 4.2 Asset Replacement Workflow

```
[Operator uploads replacement video]
         |
         v
[CMS assigns new asset_id (e.g., asset-UUID-v2)]
         |
         v
[Operator updates campaign to reference new asset_id]
         |
         v
[CMS publishes new corpus version with updated asset reference]
         |
         v
[Players prefetch new asset; verify checksum]
         |
         v
[Old asset (asset-UUID-v1) remains in CMS and on CDN]
[Old asset remains in player cache until LRU eviction]
[Old asset is NOT evicted if any active replay audit record references it]
```

### 4.3 Duplicate Detection

The CMS computes checksums at upload time and checks for exact duplicates (same checksum = same content). If an operator uploads a file that is bit-for-bit identical to an existing asset, the CMS:

1. Detects the duplicate via checksum
2. Returns the existing asset_id rather than creating a new record
3. Notifies the operator: "This file is identical to asset {asset_id} uploaded on {date}"

This prevents unnecessary duplication of storage and reduces CDN distribution load.

---

## 5. Prefetch Strategy

### 5.1 Prefetch Window

The player maintains a 24-hour lookahead window. On each corpus sync (and on a periodic 4-hour basis if no sync has occurred), the player:

1. Reads the current corpus
2. Computes the PRE output for every 5-minute interval in the next 24 hours (predictive resolution)
3. Collects all unique asset_ids referenced in those outputs
4. Compares against the local asset cache's VERIFIED assets
5. Downloads any asset not yet VERIFIED locally

**Why 24 hours?** This window provides sufficient lead time for asset delivery under most venue network conditions (including slow or intermittent connectivity), while keeping the total prefetch volume manageable for typical campaign schedules. It also provides a full day of autonomy for venues that might lose WAN connectivity at any time.

### 5.2 Predictive PRE Resolution for Prefetch

The predictive resolution used for prefetch is identical to the live PRE resolution — it runs the same deterministic function against the same corpus, at simulated future timestamps. This means the prefetch prediction is guaranteed to match what the live PRE will actually resolve at those timestamps, assuming the corpus has not changed in the interim.

If the corpus is updated between the prefetch computation and the scheduled playback time, the player re-runs the predictive resolution against the new corpus and prefetches any newly-required assets.

### 5.3 Prefetch Prioritization

Asset downloads are prioritized by urgency:

| Priority | Condition | Target download time |
|----------|-----------|---------------------|
| CRITICAL | Asset required in next 30 minutes | Immediately; maximum bandwidth |
| HIGH     | Asset required in next 4 hours    | Complete within 2 hours       |
| NORMAL   | Asset required in next 24 hours   | Complete within 8 hours       |
| LOW      | Asset required >24h from now      | Background; lowest bandwidth  |

CRITICAL priority assets interrupt any in-progress lower-priority downloads. If a CRITICAL asset cannot be downloaded in time (WAN failure, CDN error), the player logs PREFETCH_CRITICAL_FAILURE and falls back to the next available content in the PRE resolution cascade.

### 5.4 Prefetch and Bandwidth Management

Asset prefetching is the primary contributor to player bandwidth consumption. The prefetch scheduler must respect configurable bandwidth limits to avoid saturating the venue's WAN connection:

| Time window              | Configurable bandwidth cap |
|--------------------------|---------------------------|
| Business hours (default: 08:00–22:00) | 5 Mbps maximum        |
| Off-hours (default: 22:00–08:00)       | 20 Mbps maximum        |

Off-hours is the preferred window for large asset downloads (new campaign video files). The CMS may schedule corpus updates to publish late in the evening so that asset prefetch completes overnight before business opens.

**Override:** CRITICAL priority assets ignore bandwidth caps. Content compliance cannot be compromised by bandwidth throttling.

---

## 6. Storage Constraints and Cache Management

### 6.1 Storage Budget

| Storage region           | 32 GB SD card | 64 GB SD card |
|--------------------------|---------------|---------------|
| OS + system              | ~6 GB         | ~6 GB         |
| Player app + runtime     | ~2 GB         | ~2 GB         |
| Corpus + config          | ~500 MB       | ~500 MB       |
| Audit buffer             | ~500 MB       | ~500 MB       |
| Emergency bundle         | ~200 MB       | ~200 MB       |
| Content asset cache      | ~20 GB        | ~50 GB        |
| Reserved                 | ~3 GB         | ~5 GB         |

The content asset cache is the dominant consumer of storage. For venues with large content libraries or long scheduling windows (e.g., a resort complex with 50+ screens each showing different content), 64 GB cards are strongly recommended.

### 6.2 LRU Eviction Policy

When the content asset cache approaches its storage budget limit, the player evicts assets using a Least Recently Used (LRU) policy with the following constraints:

**Eviction eligible:** An asset is eligible for eviction if:
- It has not been referenced in any PRE output in the past 48 hours
- It is not referenced in any future PRE output in the next 24 hours (as computed by predictive resolution)
- It is not referenced by any audit record in the local audit buffer that has not yet been confirmed by the cloud CMS (see Constraint 2 below)

**Eviction ineligible:** An asset must never be evicted if:
- It is in the current PRE output (actively being displayed)
- It is in any future PRE output within the prefetch window (next 24 hours)
- It is part of the emergency bundle (always retained)
- It is referenced by an unconfirmed local audit record (Constraint 2)

**Constraint 2 — Replay integrity protection:** An audit record for a PRE invocation that referenced a specific asset must be uploadable to the CMS in a state where the CMS can verify the asset was present. The asset must not be evicted before the audit record referencing it has been confirmed received by the CMS. This ensures that the claim "this content played at this time" can be verified against the asset that was present.

In practice, audit records are confirmed within 15–30 minutes of generation when WAN is available. During an offline period, assets referenced in buffered audit records are pinned until the audit records are confirmed post-reconnect.

### 6.3 Storage Pressure Alerting

| Storage remaining  | Alert level | Player action                                        |
|--------------------|-------------|------------------------------------------------------|
| <4 GB              | WARNING     | Aggressive LRU eviction of oldest eligible assets    |
| <2 GB              | CRITICAL    | Pause all non-CRITICAL prefetch operations           |
| <1 GB              | ESCALATION  | Alert VENUE_ADMIN; pause all prefetch                |

If storage reaches <500 MB, the player cannot guarantee it can store incoming CRITICAL priority assets. At this point, the player enters STORAGE_CRITICAL mode, which is an operator escalation requiring physical investigation (potential SD card replacement or cleanup).

---

## 7. Campaign Asset Readiness Gate

### 7.1 Asset Readiness as a Campaign Activation Prerequisite

A campaign in the platform's lifecycle progresses through: DRAFT → APPROVED → SCHEDULED → ACTIVE → COMPLETED.

The transition from SCHEDULED to ACTIVE is gated by asset readiness. A campaign cannot become ACTIVE on a target player unless all assets required by that campaign are VERIFIED on that player's local cache.

This gate is enforced by the CMS, not the player. The CMS tracks per-player asset readiness status, received via the player's heartbeat payload (which includes an asset_status summary for currently-scheduled campaigns).

### 7.2 Pre-Flight Check Process

Before a campaign's scheduled start time, the CMS runs a pre-flight check:

| Check time before start | Action |
|--------------------------|--------|
| T-24h                   | CMS confirms all target players have received the corpus version referencing this campaign |
| T-4h                    | CMS confirms all target players have started prefetch for all campaign assets |
| T-1h                    | CMS checks which players have VERIFIED status for all campaign assets |
| T-15m                   | CMS flags any players that are not yet READY; sends PREFETCH_URGENT signal |
| T-0 (start time)        | CMS computes which players are READY vs NOT_READY for campaign activation |

### 7.3 Behavior When Players Are Not Ready at Start Time

If one or more target players do not have VERIFIED assets at campaign start time:

| Scope of non-readiness | CMS behavior |
|------------------------|--------------|
| <10% of target players | Campaign activates for ready players; non-ready players continue previous schedule; alert generated |
| 10%–30% of target players | Campaign activation delayed for non-ready players; VENUE_ADMIN alerted; 30-minute retry window |
| >30% of target players | Campaign activation held platform-wide; ENTERPRISE_ADMIN notified; operator decision required |

The operator can override the readiness gate and force campaign activation. This override is logged as an operator decision in the audit trail. The non-ready player continues serving fallback content (from the PRE resolution cascade) until its assets are VERIFIED.

### 7.4 Missing Asset Gate Override

In exceptional circumstances (compliance requirement, time-critical content), an ENTERPRISE_ADMIN can override the missing asset gate. The override is subject to:

- Mandatory reason entry (logged in audit trail)
- ENTERPRISE_ADMIN acknowledgment that some screens may show fallback content until assets are VERIFIED
- Automatic expiry of the override at T+4h (if assets are still not VERIFIED, the issue escalates)

---

## 8. Asset Delivery SLAs

These SLAs apply under normal operating conditions (WAN connectivity; CDN operational). SLA breaches generate CMS alerts.

| Metric                                        | Target SLA | Maximum SLA |
|-----------------------------------------------|------------|-------------|
| Asset available on CDN after CMS upload        | <5 minutes | <15 minutes |
| Asset prefetch starts after corpus sync        | <10 minutes | <30 minutes |
| Small asset (<50 MB) prefetch completion       | <30 minutes | <2 hours |
| Large asset (50–500 MB) prefetch completion    | <4 hours   | <12 hours |
| Campaign asset readiness across fleet          | T-4h       | T-1h |
| Emergency bundle re-verification on sync       | <5 minutes | <15 minutes |

Asset SLA breaches are tracked as part of the platform's operational health metrics. Persistent SLA breaches (>3 occurrences in 24 hours for a specific venue) trigger a network quality investigation for that venue.

---

## 9. Asset Retirement and Retention

### 9.1 When Assets Can Be Retired

An asset can be retired from active use (removed from future campaigns) but remains in the CMS archive. Retirement means:

- The asset is no longer included in any future corpus version
- Players with the asset in their cache will evict it via LRU when the prefetch window no longer includes it
- The asset remains in the CDN with reduced (or no) caching priority

An asset can be permanently deleted from the CMS and CDN only when:

1. No active campaign references the asset
2. No corpus version currently deployed to any player references the asset
3. All audit records referencing the asset have been confirmed in the primary audit archive and the audit record retention period has elapsed (typically 7 years for compliance-critical venues)

Condition 3 is the long-tail constraint. Assets may remain in the CDN archive for 7+ years due to audit retention requirements, even if they have not been displayed in years.

### 9.2 Retention Policy by Venue Classification

| Venue classification | Audit record retention | Asset retention minimum |
|---------------------|------------------------|------------------------|
| Compliance-critical (gaming, liquor) | 7 years | 7 years |
| Standard commercial | 3 years | 3 years |
| Non-regulated venues | 1 year | 1 year |

The asset retention minimum applies to assets that were actively referenced in audit records. Assets that were uploaded but never scheduled in any campaign have no audit references and can be deleted after 90 days of inactivity.

### 9.3 CDN Cost Management

Retaining assets on CDN for 7 years at full CDN pricing is cost-prohibitive for large asset libraries. The archival strategy:

- Assets in active use (referenced in current corpus): CDN with full edge caching
- Assets retired from active use but within retention period: CDN with reduced caching (origin-only serve, slower delivery)
- Assets beyond retention period: delete from CDN; retain audit record metadata (not the file itself) in the CMS archive

PLATFORM_ADMIN manages the retention policy configuration. Enterprises may request longer retention periods for compliance purposes.

---

## 10. Operational Procedures

### 10.1 Diagnosing Asset Prefetch Failures

When a VENUE_ADMIN reports that a player is not showing expected content:

1. Check the CMS asset readiness dashboard for the affected venue
2. Identify which assets are NOT_READY for the affected screen_id
3. Check the CDN access logs for the player's IP — was the download attempted? Did it fail?
4. Check the player's local log via SSH: `journalctl -u clubhub-player | grep PREFETCH`
5. Common causes:
   - Insufficient storage: check storage usage on player
   - Network throttling: venue firewall blocking CDN downloads; check CDN domain whitelist
   - Signed URL expiry: player was offline for >48h; corpus sync required to refresh URLs
   - Corrupt download: checksum mismatch; player logs ASSET_INTEGRITY_FAILURE

### 10.2 Forcing Immediate Asset Prefetch

If a critical asset is needed urgently on a player:

```bash
# Via CMS operator API (VENUE_ADMIN or higher)
POST /api/players/{screen_id}/prefetch-trigger
{
  "asset_ids": ["asset-uuid-here"],
  "priority": "CRITICAL"
}
```

This signal is delivered to the player via the next poll cycle (within 5 minutes). The player immediately begins downloading the specified assets at CRITICAL priority, bypassing all bandwidth throttling.

### 10.3 Viewing Player Asset Cache Status

Player asset cache status is visible in the CMS fleet dashboard:

- Per-screen: total cache usage, count of VERIFIED assets, count of MISSING assets, last prefetch completion time
- Per-venue: aggregate cache health, any players with STORAGE_CRITICAL or PREFETCH_CRITICAL_FAILURE events
- Per-campaign: readiness status across all target players (how many are READY vs NOT_READY)

For direct inspection of a player's local cache state (requires SSH access):

```bash
# On the Pi player
/opt/clubhub/bin/cache-status.sh
```

Output: total cache size, asset count by status (VERIFIED, DOWNLOADING, MISSING), top 10 largest assets, LRU candidates.
