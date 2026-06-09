# ADR-002 — Asset Delivery Trust Model
# ClubHub TV — Official Operational Truth for Media Asset Delivery

**Status:** ACCEPTED
**Date:** 2026-06-03
**Authority:** Platform Architecture
**Supersedes:** None
**Related:** ADR-001 (Screen Trust Boundary), OFFLINE-OPERATION.md, VENUE-AUTONOMY.md, ASSET-DISTRIBUTION.md

---

## Context

Two independent audits (Bootstrap Audit, Asset Delivery Reality Audit) established a gap between documented design and current implementation:

**Documented design** (OFFLINE-OPERATION.md, VENUE-AUTONOMY.md, asset-url-manager.ts module comment, IMPLEMENTATION-WAVES.md):
- Players serve content from local asset cache during network outages
- 72-hour autonomy window is a constitutional requirement
- The cloud is a capability amplifier, not a prerequisite for correct operation

**Current implementation:**
- `asset_dir` exists as an empty directory (never populated)
- `AssetVerifier` exists as a class (never invoked)
- `asset_path` in every PLAYLIST_UPDATE message is a CDN URL
- Chromium streams media directly from CDN
- No asset download pipeline exists
- No local-to-CDN path translation exists

The gap is an implementation deficit, not an architectural ambiguity. This ADR establishes the official operational model so that the resolution of this gap is unambiguous.

---

## Decision

**ClubHub TV is an autonomous-first platform.**

Screens must be capable of rendering scheduled content for a minimum of 72 hours without any network connectivity. CDN connectivity enhances performance but is not required for playback of content present in the most recently delivered corpus.

This is not a future aspiration. It is the constitutional basis for venue deployments as established in VENUE-AUTONOMY.md and represented by `autonomous_window_ms` in the player configuration.

---

## 1. What Is The Intended Truth

### Model: Autonomous-First

The correct model is **B: Autonomous-first**.

**Evidence from authoritative sources:**

`VENUE-AUTONOMY.md §1:`
> "Venues should operate correctly and safely in isolation. Cloud CMS connectivity should enhance the platform's capability — faster corpus updates, real-time monitoring, cross-venue coordination — but removing cloud connectivity should not cause venues to fail or produce non-compliant output. **The cloud is a capability amplifier, not a prerequisite for correct operation.**"

`OFFLINE-OPERATION.md §2.1:` Under BRIEF_OFFLINE (<1 hour), the following are listed as continuing to work normally:
> "Content playback from local asset cache"

`asset-url-manager.ts` module comment:
> "During offline: serve assets from local disk cache, bypass CDN entirely"

`IMPLEMENTATION-WAVES.md:`
> "72h offline autonomy test: player must continue resolving playlists from local corpus for 72h with no network access, with no degradation in playlist output"

`player-runtime/src/index.ts:28:`
```typescript
autonomous_window_ms: 72 * 60 * 60 * 1000, // 72h — constitutional requirement
```

**Alignment with operational requirements:**

| Dimension | Streaming-first | Autonomous-first | Correct model |
|-----------|----------------|-----------------|---------------|
| Venue expectations | Operators expect content during outages | Operators expect content during outages | Autonomous-first |
| Fleet operations | Single connectivity gap = visible failure across all screens at venue | Screens continue independently within autonomy window | Autonomous-first |
| Emergency override semantics | Emergency freeze/clear requires WAN | Emergency state persists locally, survives WAN loss | Autonomous-first |
| Rollback semantics | Rollback requires CMS connectivity to push new corpus | Rollback = deliver new corpus; player applies locally | Autonomous-first |
| Deployment semantics | Publish metadata = deployed | Deliver and verify media bytes on device = deployed | Autonomous-first |
| Sponsor compliance | Sponsor content may not render if CDN unavailable | Sponsor content renders from verified local copy | Autonomous-first |

Streaming-first is incompatible with venue deployment semantics. A clubhouse with a venue-side ISP outage cannot be left with black screens. The platform sells operational reliability, not connectivity dependency.

---

## 2. Autonomous-First Operational Definitions

### 2.1 What Constitutes "Available Content"

Content is **available** on a given screen if and only if:
1. The asset file is present in `asset_dir` at the expected path
2. The asset file passes integrity verification (checksum matches corpus record)
3. The asset `content_id` is present in the active corpus
4. The asset is referenced by at least one resolution path for the screen's current schedule window

Content that is referenced in the corpus but whose bytes are not verified on local storage is **not available**. It is **known but unavailable**.

A content item whose asset bytes are present and verified but whose `content_id` does not appear in the current corpus is **available but unreferenced**. It is a candidate for eviction.

### 2.2 What Constitutes "Fully Deployed"

A content deployment is **complete** when every screen in the target deployment set has:
1. Received the corpus version containing the new content
2. Downloaded the asset bytes for all new content items in that corpus
3. Verified asset integrity (checksum)
4. Acknowledged availability to the CMS (heartbeat with asset readiness state)

Publishing a corpus version to the CMS does not constitute deployment completion. A corpus version is delivered when screens hold it locally with verified assets.

This definition has a direct consequence for the 72-hour corpus delivery lead time: the 72-hour window is the time required for the delivery pipeline to propagate a corpus update, download all new assets, verify them, and have all target screens confirm readiness. It is not a publishing delay — it is a physical delivery constraint.

### 2.3 When Content May Enter Rotation

A content item may enter playlist rotation on a screen when:
1. Its asset bytes are verified on that screen's local storage
2. Its `content_id` appears in the screen's active corpus
3. The screen's asset readiness has been acknowledged by the CMS (or the screen is operating within its autonomy window with the corpus that includes the item)

A content item must **not** enter rotation solely because the corpus references it. Corpus delivery and asset delivery are two distinct pipeline stages. The corpus is the schedule; local asset presence is the prerequisite for execution.

### 2.4 Guarantees Required Before Playlist May Reference an Asset

Before an enriched playlist item may be transmitted to the renderer, the following must hold:
1. `asset_path` resolves to a verified local file (not a CDN URL)
2. The file exists at `asset_path` at the moment of enrichment
3. The file's checksum matches the corpus record (verified at download time; not re-verified at every render cycle)

If any condition fails, the item must be excluded from the enriched playlist or the player must transition to a degraded state — not silently pass an undefined or CDN `asset_path` to the renderer.

### 2.5 Operational Meaning of Deployment Completion

Deployment completion is a **per-screen acknowledgment**, not a CMS-side publication event.

The CMS may not mark a corpus version as "deployed to venue" until it has received asset readiness acknowledgments from all enrolled screens in that venue (or a defined quorum for large venues). Until that acknowledgment threshold is met, the corpus version is in `DELIVERING` state, not `DEPLOYED` state.

A venue marked `DEPLOYED` for a corpus version provides the operational guarantee: if this venue loses WAN connectivity now, it can continue rendering all content in that corpus version for the full autonomy window.

---

## 3. Streaming-First Is Rejected (Not Selected)

This section documents why streaming-first was considered and rejected, so the decision is not revisited without new evidence.

**Arguments for streaming-first:**
- Simpler implementation (no asset download pipeline)
- CDN handles storage and delivery concerns
- Eliminates storage management on edge hardware

**Reasons for rejection:**
1. **Venue reliability contract.** Operators at venues — clubhouses, sports facilities — cannot control ISP reliability. A platform that goes blank during an ISP outage is not viable for venue deployment.
2. **Emergency override contract.** EMERGENCY_FREEZE must work unconditionally. If content cannot render without CDN, a "frozen" screen during an emergency is indistinguishable from a failed screen. Autonomous rendering means EMERGENCY_CLEAR restores actual content, not a spinner.
3. **Sponsor compliance.** Sponsored content at specific timeslots that fails to render due to CDN unavailability is a commercial liability. Local delivery is required for compliance guarantees.
4. **The platform's own documentation rejects it.** VENUE-AUTONOMY.md, OFFLINE-OPERATION.md, and IMPLEMENTATION-WAVES.md all assume autonomous operation as the baseline. Streaming-first would require rewriting the foundational operational model, not just the implementation.

If a future variant of this platform is intended for venues with guaranteed connectivity (e.g., cloud kiosks), that variant requires a separate ADR establishing a different trust model. It must not be assumed as the default.

---

## 4. Deployment Semantics

### 4.1 Correct Operational Meaning

Deployment success must mean:

> **"The screen possesses every asset required for playback of all content in the current corpus, verified locally."**

Not:

> "The screen possesses instructions describing what to play."

### 4.2 Current State

The current system implements the second definition only. Publishing a corpus version to CMS and verifying the corpus JSON is cached on the player constitutes the current maximum deployment verification. Media bytes are not verified. Media bytes may not exist on the device at all.

### 4.3 Deployment State Machine (Operational Definition)

```
CORPUS_PUBLISHED          — CMS has published a new corpus version
    ↓
CORPUS_DELIVERED          — Player has received and cached corpus JSON (current implementation ceiling)
    ↓
ASSETS_DOWNLOADING        — Player is downloading asset bytes for new content in corpus
    ↓
ASSETS_VERIFIED           — All required asset bytes present and checksum-verified
    ↓
READINESS_ACKNOWLEDGED    — Player has reported asset readiness to CMS via heartbeat
    ↓
DEPLOYED                  — CMS has received readiness from all screens in target set
```

`CORPUS_DELIVERED` ≠ `DEPLOYED`. Operating as if `CORPUS_DELIVERED` = `DEPLOYED` is the semantic error that produces metadata autonomy without media autonomy.

### 4.4 Consequence for Scheduling

The 72-hour corpus delivery lead time (referenced in IMPLEMENTATION-WAVES.md and CMS operational architecture documentation) maps to the `CORPUS_PUBLISHED → DEPLOYED` transition, not to `CORPUS_PUBLISHED → CORPUS_DELIVERED`. The 72 hours must be sufficient for the complete pipeline including asset download and verification across all target screens.

---

## 5. Emergency Override Semantics

### 5.1 EMERGENCY_FREEZE During WAN Loss

| Trigger scenario | Expected behavior |
|-----------------|-------------------|
| WAN available | EMERGENCY_FREEZE propagates via WebSocket immediately. All screens freeze. |
| WAN unavailable, LAN available | EMERGENCY_FREEZE propagates via local LAN WebSocket path (GRADE_A/B venues). All screens in venue freeze. |
| WAN unavailable, LAN unavailable | EMERGENCY_FREEZE cannot be transmitted to player runtime via network path. GPIO-triggered freeze (GRADE_A) or pre-staged local override (GRADE_B) applies. GRADE_C venues cannot freeze screens without network. |

EMERGENCY_FREEZE does not depend on media delivery. It operates on the player state machine regardless of whether assets are local or CDN. Freezing a screen that is streaming from CDN is behaviorally identical to freezing a screen rendering from local assets — the player-runtime stops the renderer.

### 5.2 EMERGENCY_CLEAR During WAN Loss

| Condition after CLEAR | Expected behavior |
|----------------------|-------------------|
| Assets present locally, WAN unavailable | Content resumes from local asset cache. Player continues in autonomous mode. |
| Assets NOT present locally (current state), WAN unavailable | Renderer receives PLAYLIST_UPDATE with CDN URLs. CDN unreachable. Black screen after freeze cleared. |
| Assets NOT present locally, WAN available | Renderer attempts CDN stream. CDN reachable. Content resumes (current behavior, streaming-only). |

Under the autonomous-first model, EMERGENCY_CLEAR during WAN loss must resume visible content. Under the current implementation (streaming-only), EMERGENCY_CLEAR during WAN loss produces a black screen — which is operationally indistinguishable from a failed screen from the perspective of a venue operator.

### 5.3 Override Queuing

Remote override commands (EMERGENCY_FREEZE, EMERGENCY_CLEAR, LOCK_SCREEN, content overrides) that cannot be delivered due to WAN loss are queued by the remote-command-poller. On reconnection, the queue is drained in order of timestamp. This applies to override commands only — it does not change the media availability question.

### 5.4 Official Emergency Override Behavior Statement

> Emergency state transitions (FREEZE/CLEAR) are network-transmitted but locally persisted. A player that loses WAN connectivity after receiving EMERGENCY_FREEZE remains frozen. A player that receives EMERGENCY_CLEAR resumes playback from locally available assets. The quality of resumed playback is a function of local asset readiness, not emergency channel availability.

---

## 6. Fleet Health Semantics

The current health model conflates distinct operational dimensions. The following dimensions are **independent** and must be tracked and reported separately.

### 6.1 Four Distinct Health Dimensions

**Connectivity Health**
> Can the screen reach the CMS? Can it reach the CDN?

Metrics: heartbeat acknowledgment latency, corpus sync recency, WebSocket connection state.
Failure: screen is unreachable for management operations. Does not directly imply content failure.

**Metadata Readiness**
> Does the screen hold a current corpus and playlist that represent the operator's intended schedule?

Metrics: corpus version ID, corpus age, corpus_load_source (current/previous/factory), last successful resolve timestamp.
Failure: screen may play stale or unintended content.

**Content Readiness**
> Does the screen hold verified local copies of all assets required by the current corpus?

Metrics: asset inventory coverage (count of verified local assets / count of corpus-required assets), last asset verification timestamp, storage utilization.
Failure: screen knows what to play but cannot play it. This is the current undetected failure mode.

**Playback Health**
> Is content currently rendering visibly on the physical display?

Metrics: Chromium process alive, last PLAYLIST_UPDATE sent, display output signal detected (where hardware telemetry available), operator-confirmed visual.
Failure: screen appears healthy by all software metrics but is showing nothing.

### 6.2 The Invisible Failure Mode

The current implementation does not expose Content Readiness as a health dimension. A screen can simultaneously be:

- `connectivity_health: HEALTHY` (heartbeats arriving)
- `metadata_readiness: HEALTHY` (current corpus cached)
- `content_readiness: UNKNOWN` (asset_dir empty, no assets verified — not tracked)
- `playback_health: UNKNOWN` (no verification that Chromium rendered)

And be displaying a black screen because `asset_path = undefined` or CDN is unreachable.

This state is operator-invisible under the current health model. The fleet dashboard reports the screen as healthy. The operator has no signal. The venue displays nothing.

### 6.3 Health Reporting Requirements

Fleet health must surface all four dimensions independently. A screen is **operationally healthy** only when all four dimensions are in a healthy state. Healthy connectivity and metadata while content readiness is unknown or failed must produce a visible operational alert, not a green status.

---

## 7. Semantic Contradictions and Long-Term Constraints

### 7.1 Semantic Contradictions

**Contradiction 1: autonomous_window_ms without media autonomy**

`autonomous_window_ms = 72h` is a constitutional constant that implies the platform can operate offline for 72 hours. The current implementation provides metadata autonomy only. The constant is a promise the system cannot currently keep. Retaining the constant without implementing media autonomy creates a false operational guarantee communicated to operators via documentation and configuration.

**Contradiction 2: AssetVerifier as structural deception**

`AssetVerifier` exists as a class with three public methods. Its presence implies the system verifies local assets. It is instantiated but never called. An engineer reading the codebase or an operator reading architecture documentation will infer that asset verification is active. It is not. The class is either an implementation placeholder (to be completed) or a semantic artifact that must be documented as such.

**Contradiction 3: asset_dir as implied cache**

`ASSET_DIR` is configured as an environment variable, exposed in PlayerConfig, passed to AssetVerifier, and has a default path. Its presence in configuration implies it is a functional cache location. It is an empty directory. This creates operator confusion during incident investigation: operators and engineers checking the filesystem will find the directory but no content, without any indication of whether this is expected or a failure.

**Contradiction 4: asset_path comment vs. reality**

`playlist-renderer.ts` contains the comment: `asset_path: string; // local file path verified by player-runtime`. The value is a CDN URL. This is a false comment in a production code path.

**Contradiction 5: "CDN pull" in ASSET-DISTRIBUTION.md vs. local cache requirement**

`ASSET-DISTRIBUTION.md §1.1` lists delivery method as "CDN pull" for video, images, and audio. This describes the origin-to-player delivery mechanism (how assets first arrive), not the player-to-Chromium serving mechanism (how assets are rendered). However, without a defined download pipeline, "CDN pull" currently means "Chromium streams from CDN at render time" — which is not what "CDN pull" should mean in a local-cache architecture. The term requires clarification: CDN pull is the asset acquisition mechanism, not the render-time delivery mechanism.

### 7.2 Operator Expectation Mismatches

**Mismatch 1: Deployment confirmation**

Operators who publish a corpus and see it reflected in player health assume screens will play the new content. Currently, if the corpus contains new assets that have not been downloaded (because no download pipeline exists), screens will either skip those items or display black. The operator receives no signal that anything is wrong.

**Mismatch 2: 72-hour autonomy**

Venues that have been told the platform provides 72-hour autonomous operation will experience black screens during extended connectivity loss. This is a customer-facing breach of a documented operational guarantee.

**Mismatch 3: Fleet health dashboard**

Operators monitoring fleet health via the dashboard will see healthy screens that are displaying nothing. The health dashboard is providing false assurance.

**Mismatch 4: Emergency override confidence**

Operators who execute EMERGENCY_CLEAR after an emergency event expect content to resume on cleared screens. If the WAN was also lost during the emergency (a common scenario — physical emergencies affect infrastructure), cleared screens will be blank. Operators will not know if the clear succeeded or failed.

### 7.3 Deployment Ambiguities

**Ambiguity 1: When is a campaign "live"?**

Currently: when the corpus is published and players have synced the corpus JSON. Under the autonomous-first model: when all target screens have downloaded and verified the assets. These are different moments. The second can be hours after the first. Operators have no way to know which state they are in.

**Ambiguity 2: Rollback semantics**

If a bad corpus is rolled back via the corpus-rollback endpoint, the player reverts to the previous corpus snapshot. Asset files associated with the reverted corpus version must still be present locally for rollback to restore correct rendering. If asset files were not cached (current state), rollback restores the metadata of the previous state but not necessarily its playback capability.

**Ambiguity 3: What does "screen is ACTIVE" mean?**

`commissioning_state = ACTIVE` indicates the screen is enrolled and heartbeating. It does not indicate that the screen is rendering content or that it is capable of rendering content. The state name implies operational readiness it does not provide.

### 7.4 Resilience Assumption Violations

**Violation 1: Emergency bundle**

`ASSET-DISTRIBUTION.md §1.4` specifies: "The emergency bundle is pre-provisioned on all players at initial setup. Must always be present on the player (never evicted by LRU). Is re-verified on every corpus sync." No code provisions, pre-populates, or verifies an emergency bundle. This is a documented safety mechanism that does not exist.

**Violation 2: Air-gapped venue support**

`OFFLINE-OPERATION.md §6` describes a manual corpus update procedure for air-gapped venues. This procedure depends on the player being able to load assets from a USB-delivered package. Without a local asset cache and a defined asset path structure, an air-gapped venue cannot function — USB delivery has no target.

**Violation 3: Corpus snapshot rotation serves only metadata**

The three-snapshot corpus rotation (current/previous/factory) is a resilience mechanism for recovering valid scheduling metadata. It does not protect against media loss. If a new corpus version introduces content whose assets were never downloaded, rotating back to previous corpus does not restore playback — the assets for the previous corpus may or may not be present.

---

## 8. Summary: Current State vs. Required State

| Property | Current state | Required state |
|----------|--------------|----------------|
| Asset delivery model | CDN streaming at render time | Local cache, CDN for acquisition |
| `asset_path` value in PLAYLIST_UPDATE | CDN URL | Local filesystem path |
| `AssetVerifier` status | Instantiated, never called | Called after every download |
| `asset_dir` status | Empty directory | Populated asset cache |
| Deployment completion signal | Corpus JSON cached on device | Asset bytes verified, readiness acknowledged |
| Content readiness health dimension | Not tracked | Tracked, reported, alertable |
| Emergency bundle | Not implemented | Pre-provisioned, always verified |
| Offline media playback | Not possible | Required for 72h autonomy window |
| Operator failure visibility | Screen appears healthy with black display | Content readiness failures surface as alerts |

---

## Consequences

1. **The implementation gap is confirmed and bounded.** The missing component is an asset download pipeline between corpus receipt and playlist enrichment. The scaffolding (AssetVerifier, asset_dir, AssetUrlManager) exists and reflects the correct architecture.

2. **`autonomous_window_ms` remains meaningful.** It is the target autonomy window, not a current capability. It is the specification for what the download pipeline must achieve.

3. **No architectural redesign is required.** The design is correct. The implementation is incomplete.

4. **Deployment semantics must be updated** in the CMS and operator tooling to reflect the `CORPUS_DELIVERED → DEPLOYED` gap. Operators must not receive confirmation of deployment until media bytes are verified on screens.

5. **Fleet health must be extended** to expose Content Readiness as a first-class dimension. Operators must not be able to observe a screen as healthy while it lacks verified local assets.

6. **The 72-hour corpus delivery lead time** is reaffirmed as a physical delivery constraint (corpus + assets propagated and verified) not a publication scheduling convention.

---

*ADR-002 accepted. Autonomous-first is the official platform model. The implementation gap does not change the model — it defines the remaining work.*
