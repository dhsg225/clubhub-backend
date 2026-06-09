# MULTI-REGION-STRATEGY.md
# ClubHub TV — Multi-Region Deployment Strategy

**Document type:** Deployment Architecture Reference
**Status:** Canonical
**Authority:** Platform Operations
**Audience:** Infrastructure engineers, platform architects, ENTERPRISE_ADMIN
**Last updated:** 2026-05-26
**Depends on:** PLAYER-TOPOLOGY.md, POLLING-AND-SYNC-ARCHITECTURE.md

---

## Table of Contents

1. [Region Definitions](#1-region-definitions)
2. [Multi-Region Architecture Overview](#2-multi-region-architecture-overview)
3. [Data Authority Model](#3-data-authority-model)
4. [Cross-Region Corpus Replication](#4-cross-region-corpus-replication)
5. [Regional Data Residency](#5-regional-data-residency)
6. [Player Region Assignment](#6-player-region-assignment)
7. [Failover and Degraded Region Operation](#7-failover-and-degraded-region-operation)
8. [Constitutional Implications of Multi-Region](#8-constitutional-implications-of-multi-region)
9. [Current Single-Region Baseline](#9-current-single-region-baseline)
10. [Multi-Region Readiness Criteria](#10-multi-region-readiness-criteria)

---

## 1. Region Definitions

Multi-region terminology uses three distinct "region" concepts that must not be conflated:

### 1.1 CMS Regions

CMS regions are geographic cloud infrastructure deployments hosting the ClubHub TV backend services. Each CMS region runs:

- CMS backend API (corpus authoring, campaign management, operator control plane)
- PostgreSQL (or equivalent) database (with replication policy — see Section 3)
- Corpus distribution service (serves corpus packages to players)
- Audit store (receives replay audit records from players)
- Entropy processing service (aggregates metrics from players)

A CMS region is a cloud infrastructure concept. Players do not "belong" to a CMS region in any persistent sense — they are configured with a sync endpoint URL that happens to be hosted in a CMS region.

### 1.2 Venue Regions

Venue regions are geographic groupings of physical venues. These groupings are used for:

- Operational management (a REGIONAL_MANAGER is responsible for all venues in their venue region)
- Data residency compliance (venues in certain geographies may have data residency requirements)
- Rollout sequencing (canary promotions can be staged by venue region)
- Observability (fleet dashboards can be filtered by venue region)

Venue regions are not required to align to CMS regions. An enterprise with venues in Australia and New Zealand might define a single "ANZ" venue region even if both are served by the same CMS region.

### 1.3 Player Regions

Players do not have an inherent region. A player is configured with:

- A primary sync endpoint URL (e.g., `https://sync.ap-southeast-2.clubhub.io`)
- A fallback sync endpoint URL (e.g., `https://sync.ap-southeast-1.clubhub.io`)

These endpoints happen to be hosted in cloud regions, but the player has no awareness of cloud region topology. If the primary endpoint fails, the player fails over to the secondary endpoint without knowing or caring which cloud region it is contacting.

---

## 2. Multi-Region Architecture Overview

### 2.1 Topology Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                      PLATFORM LAYER (Global)                         │
│                                                                      │
│  ┌──────────────────────────┐  ┌──────────────────────────────────┐  │
│  │   PRIMARY REGION         │  │   SECONDARY REGION(S)            │  │
│  │   (e.g., us-east-1)      │  │   (e.g., eu-west-1, ap-se-2)    │  │
│  │                          │  │                                  │  │
│  │  - Corpus authoring      │  │  - Corpus cache (read-only)      │  │
│  │  - Write authority       │  │  - Audit receive (writes to      │  │
│  │  - Canary state          │  │    primary after buffer)         │  │
│  │  - EMERGENCY_FREEZE      │  │  - Entropy receive               │  │
│  │    issuance              │  │  - Player sync service           │  │
│  │  - Audit archive         │  │  - Heartbeat receive             │  │
│  │  - Entropy analysis      │  │                                  │  │
│  │                          │  │  Replicates FROM primary         │  │
│  └──────────────────────────┘  └──────────────────────────────────┘  │
│            │                              │                           │
│            └──────────────────────────────┘                           │
│               Cross-region replication (corpus, emergency state)      │
└──────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
    ┌─────────▼──────────┐         ┌─────────▼──────────┐
    │  VENUE CLUSTER A   │         │  VENUE CLUSTER B   │
    │  (North America)   │         │  (Europe / ANZ)    │
    │  Syncs to primary  │         │  Syncs to secondary│
    └────────────────────┘         └────────────────────┘
```

### 2.2 Architectural Invariant

**The primary region is the single source of write authority.** All corpus versions are published in the primary region. All canary promotion decisions are made in the primary region. All EMERGENCY_FREEZE issuance originates in the primary region.

Secondary regions are read-optimized delivery tiers. They serve corpus packages to players, receive audit records (buffered for replication to primary), and receive heartbeats and entropy metrics. They do not author new corpus versions or make promotion decisions.

---

## 3. Data Authority Model

### 3.1 Write Authority

All writes are made in the primary region. Secondary regions receive replicated data only.

| Data type                | Write location    | Read location              |
|--------------------------|-------------------|----------------------------|
| Corpus versions          | Primary only      | Any region (replicated)    |
| Canary promotion state   | Primary only      | Any region (replicated)    |
| EMERGENCY state          | Primary only      | Any region (replicated <1min) |
| Replay audit records     | Secondary (buffered) → Primary | Primary (after replication) |
| Entropy metrics          | Secondary (buffered) → Primary | Primary (after aggregation) |
| Operator sessions / actions | Primary only  | Primary only               |
| Heartbeat records        | Secondary (receive) → Primary (aggregate) | Primary |

### 3.2 Read Authority

Corpus packages are read from any region. Players do not need to contact the primary region directly — they contact their nearest secondary region endpoint. The secondary region serves the corpus package that was replicated from the primary.

This means corpus read latency is regional (fast) rather than cross-continental (slow). For a venue in Sydney, corpus sync is served from an AP region, not from a US primary region.

### 3.3 Audit Records: Secondary-First Writes

Audit records and entropy metrics are first received by the secondary region (because that is the player's sync endpoint). Secondary regions buffer these records and replicate them to the primary region within an SLA:

| Replication SLA                 | Target       | Maximum |
|--------------------------------|--------------|---------|
| Audit record primary arrival    | <5 minutes   | 15 minutes |
| Entropy metric primary arrival  | <10 minutes  | 30 minutes |
| Heartbeat aggregation           | <5 minutes   | 10 minutes |

These SLAs allow forensic and compliance operations to query the primary region and get a near-complete view of all player activity within the replication window.

---

## 4. Cross-Region Corpus Replication

### 4.1 Replication Trigger

When an ENTERPRISE_ADMIN or authorized operator publishes a new corpus version in the primary CMS:

1. Primary region records the new corpus version with a version ID, checksum, and publication timestamp
2. Primary region initiates replication to all configured secondary regions
3. Each secondary region receives the corpus package and verifies the checksum
4. Each secondary region acknowledges receipt to the primary
5. Primary marks the corpus version as "replicated" to confirmed secondary regions
6. If a secondary fails to acknowledge within the SLA, an alert is generated

### 4.2 Replication SLA

| Stage                                          | Target | Maximum |
|------------------------------------------------|--------|---------|
| Primary publish → secondary availability       | <3 min | <5 min  |
| Secondary availability → player sync eligible  | <1 min | <2 min  |
| End-to-end: publish → player sync possible     | <5 min | <8 min  |

These SLAs must be measured in production and verified against the canary promotion schedule. If replication SLA is not met, a corpus version should not be promoted to FLEET_WIDE until replication is confirmed in all target regions.

### 4.3 Replication Failure Handling

If a secondary region fails to receive a corpus version replication:

1. Primary region marks the secondary as REPLICATION_DEGRADED for that corpus version
2. Players in the secondary region continue serving the previous corpus version (which they already have)
3. An alert is generated to PLATFORM_ADMIN
4. Primary region retries replication on a 5-minute interval for up to 4 hours
5. If replication is not restored within 4 hours: PLATFORM_ADMIN must manually trigger repair

**Critical:** Players are never instructed to contact the primary region directly as a fallback for a failed secondary. Players have a configured fallback endpoint (a different secondary region), not the primary. Direct player-to-primary connections are an operational exception, not a design pattern.

### 4.4 Emergency Corpus Propagation

Emergency corpus updates (corpus changes that accompany an emergency state declaration) have a higher replication priority than standard corpus updates. Emergency corpus replication:

- Is triggered immediately on EMERGENCY_FREEZE issuance
- Has a target SLA of <60 seconds to all regions (same SLA as the emergency signal itself)
- Bypasses standard replication queue prioritization
- Is confirmed by each secondary before the EMERGENCY state is considered globally active

---

## 5. Regional Data Residency

### 5.1 Data Residency Requirements

Some markets impose legal requirements on where data about their citizens and businesses may be stored. Known requirements at time of writing:

| Market     | Requirement                                                                |
|------------|----------------------------------------------------------------------------|
| European Union | GDPR: personal data of EU residents must be stored in EU or jurisdictions with adequate protection. |
| Australia  | Privacy Act 1988: no explicit data sovereignty requirement for non-sensitive data, but health data (relevant to some venue types) has restrictions. |
| New Zealand | Privacy Act 2020: aligns with GDPR principles; no strict localization requirement but transfer restrictions apply. |

**What is personal data in ClubHub TV?** The platform primarily handles venue operational data (schedules, content metadata) and screen playback records. Personal data is minimal:

- Operator accounts (name, email): personal data; must comply with residency requirements
- Screen identifiers, venue records: typically not personal data
- Audit records: contain screen activity, not personal data
- Heartbeat and metrics: operational telemetry, not personal data

### 5.2 Residency Compliance Architecture

For EU-based enterprises:

- Operator account data (name, email, authentication records) must be stored in an EU CMS region
- Venue operational data may be co-located with the EU region or replicated to it
- Audit records for EU venues must be stored in EU-resident storage (either EU primary or EU secondary with audit records not replicated outside EU)

For AU/NZ-based enterprises:

- Standard data residency rules do not require AU-only storage for non-sensitive operational data
- Where an enterprise chooses to use an AU/NZ region for latency or business preference, the region config supports this
- Compliance-critical data (for venues with regulatory display requirements) should use a local region to minimize recovery complexity

### 5.3 Configuration of Regional Data Residency

Each enterprise in the CMS has a `data_residency_region` configuration that specifies:

- Which CMS region is authoritative for this enterprise's data
- Which regions may receive replicated data
- Whether audit records may leave the residency region

This configuration is set by PLATFORM_ADMIN at enterprise onboarding and cannot be changed by the enterprise itself without PLATFORM_ADMIN involvement. Changing residency region for an existing enterprise requires a data migration plan.

---

## 6. Player Region Assignment

### 6.1 Assignment at Registration

When a player completes registration (see PLAYER-TOPOLOGY.md Section 4.2), the CMS provides:

- `primary_sync_endpoint`: The nearest secondary region endpoint for this venue's location
- `fallback_sync_endpoint`: A secondary region endpoint in a different region, for failover
- `emergency_endpoint`: The emergency channel endpoint (typically same as primary_sync_endpoint)

The player stores these endpoints in its identity file and uses them for all subsequent sync operations. The player does not dynamically discover or change its endpoint based on network conditions — endpoint changes are a CMS-driven corpus update.

### 6.2 Endpoint Assignment Policy

Endpoint assignment is based on venue location (derived from venue_id → venue record → geographic coordinates or country). The CMS uses the following policy:

| Venue country/region | Primary sync endpoint | Fallback endpoint |
|----------------------|-----------------------|-------------------|
| USA                  | us-east-1             | us-west-2         |
| UK                   | eu-west-2             | eu-west-1         |
| EU (non-UK)          | eu-west-1             | eu-central-1      |
| Australia            | ap-southeast-2        | ap-southeast-1    |
| New Zealand          | ap-southeast-2        | ap-southeast-1    |
| Singapore / SEA      | ap-southeast-1        | ap-southeast-2    |

This policy is maintained by PLATFORM_ADMIN and updated as new CMS regions are deployed.

### 6.3 Player Transparency to Region Changes

Players have no awareness of cloud region topology. A player configured with a sync endpoint URL does not know or care whether that URL resolves to us-east-1 or eu-west-1. If the platform migrates a sync endpoint from one region to another (e.g., during a failover), the URL may change. The new URL is delivered to the player via a corpus update containing updated endpoint configuration.

---

## 7. Failover and Degraded Region Operation

### 7.1 Primary Region Failure

If the primary CMS region becomes unavailable:

**Immediate impact:**
- No new corpus versions can be published (write authority is in primary)
- No canary promotion decisions can be made
- EMERGENCY_FREEZE cannot be newly issued (signing authority is in primary)
- Operator control plane (CMS web UI) becomes read-only or unavailable

**No immediate player impact:**
- Players continue to sync corpus from secondary regions (which have replicated copies of the last good corpus)
- Players continue receiving heartbeat acknowledgments from secondary regions
- Players continue uploading audit records and entropy metrics to secondary regions
- Content playback on all screens continues normally

**Secondary region behavior during primary failure:**
- Secondary regions enter READ_ONLY mode: they serve corpus and receive player data but do not make promotion decisions
- Secondary regions continue buffering incoming audit records and entropy metrics for replication to primary on restore

**Recovery:**
1. Primary region is restored (either recovered or failed over to a designated secondary-promoted-to-primary)
2. Secondary regions re-establish replication connections
3. Audit records and entropy metrics accumulated during the outage are replicated to primary
4. Normal operations resume; operator is notified of outage duration and affected operations

**Failover to new primary (rare, major incident):**
If the primary region cannot be recovered, one secondary region can be promoted to become the new primary. This is a major operational event requiring PLATFORM_ADMIN decision and is documented in a separate Disaster Recovery runbook (not in scope for this architecture document).

### 7.2 Secondary Region Failure

If a secondary region fails, players whose primary sync endpoint is in that region are affected:

**Player behavior:**
1. Player's primary sync endpoint becomes unreachable
2. Player retries primary endpoint 3 times with exponential backoff (30s, 60s, 120s)
3. After 3 failures, player attempts fallback endpoint
4. If fallback endpoint is reachable: player seamlessly continues sync via fallback
5. Player logs: `SYNC_FAILOVER: primary={primary_endpoint} failed, using fallback={fallback_endpoint}`

**Content continuity during secondary failover:** Unaffected. Player continues PRE from local corpus throughout.

**Audit record sync during secondary failover:**
- Player uploads audit records to the fallback endpoint
- Fallback endpoint receives them and replicates to primary
- No records are lost; there is a potential additional replication delay during the failover period

### 7.3 Partial Region Degradation

If a secondary region is operational but experiencing elevated latency or partial failures (e.g., corpus distribution service is down but audit receive is up):

- Corpus sync operations fail; player uses current local corpus (no content impact within autonomy window)
- Audit records continue uploading successfully
- An alert is generated to PLATFORM_ADMIN based on the degraded health check
- Players do not switch to fallback endpoint until the primary endpoint becomes completely unreachable

---

## 8. Constitutional Implications of Multi-Region

These are the requirements that the multi-region architecture must satisfy without exception. Any proposed multi-region change must be evaluated against each of these.

### 8.1 Canary Promotion Must Be Coordinated Across Regions

Canary promotion (SHADOW_ONLY → SINGLE_VENUE → FLEET_WIDE → AUTHORITATIVE) is managed in the primary region. When a corpus version is promoted to FLEET_WIDE, that promotion decision must be reflected in all secondary regions before any secondary-region players begin syncing the new version.

**Coordination requirement:** The primary region does not mark a promotion as FLEET_WIDE until all secondary regions confirm they have the corpus package available for delivery. This prevents a scenario where half the fleet is on the new corpus version and half is on the old one due to replication lag.

### 8.2 EMERGENCY_FREEZE Must Propagate to All Regions Within <1 Minute

When PLATFORM_ADMIN issues EMERGENCY_FREEZE:

1. Primary region broadcasts the freeze signal via the emergency channel to all connected players (directly or via secondary relays)
2. Primary region immediately replicates the EMERGENCY state to all secondary regions
3. Secondary regions relay the freeze signal to players connected via their emergency channel endpoints
4. Within 60 seconds of issuance, all players in all regions must be in EMERGENCY_FALLBACK mode

**Verification:** The primary region tracks EMERGENCY_FREEZE acknowledgment from each player (via the emergency channel). A player that has not acknowledged within 60 seconds is flagged as FREEZE_UNCONFIRMED and a PLATFORM_ADMIN alert is generated. The FREEZE_UNCONFIRMED state triggers escalation procedures documented in the Emergency Response playbook.

### 8.3 Replay Audit Is Cross-Region Reconciled

For forensic use (compliance investigations, incident reconstruction), the authoritative audit record is in the primary region's audit archive. Secondary regions receive audit records first and replicate to primary within the SLA (Section 3.3).

**Forensic query policy:** Any forensic audit query for a specific screen_id or invocation_id must be executed against the primary audit archive, not a secondary region cache. Secondary regions' local copies of audit records are eventually consistent and not forensically authoritative.

**Cross-region audit reconciliation on primary restore:** After a primary region outage, audit records that accumulated in secondary regions during the outage must be reconciled into the primary archive. The reconciliation process:
1. Primary comes back online
2. Each secondary region reports: "I have N unconfirmed audit records accumulated since {outage_start}"
3. Primary accepts all records, verifies hash chains, ingests into primary archive
4. Primary acknowledges; secondary regions mark records as confirmed
5. PLATFORM_ADMIN receives a report of the reconciliation: records count, any hash chain breaks detected

A hash chain break during reconciliation indicates a record was tampered with or lost during the outage period. This is treated as a CRITICAL incident requiring forensic investigation.

---

## 9. Current Single-Region Baseline

As of the platform's current maturity state, ClubHub TV is deployed in a single-region configuration. The multi-region architecture described in this document is the target architecture for platform scale.

**Current state:** All CMS services (backend API, corpus distribution, audit store, entropy processing) run in a single cloud region. Players worldwide sync to a single global endpoint. This is operationally acceptable for the current fleet size but introduces:

- Higher sync latency for geographically distant venues
- Single-region failure risk (no secondary for player failover)
- Data residency gaps for EU and regulated markets

**Migration path:** Multi-region expansion is planned as a distinct infrastructure phase. The player sync architecture (see POLLING-AND-SYNC-ARCHITECTURE.md) is designed to be region-transparent — players will not need software changes to operate against a multi-region endpoint configuration. The CMS backend will require database replication configuration and regional deployment.

---

## 10. Multi-Region Readiness Criteria

Before expanding to a new CMS region, the following criteria must be satisfied:

| Criterion | Verification method |
|-----------|---------------------|
| Corpus replication verified end-to-end | Deploy test corpus; verify availability in new region within SLA |
| Emergency propagation verified | Issue test EMERGENCY_FREEZE; verify receipt in new region within 60s |
| Audit record replication verified | Generate test audit records in new region; verify arrival in primary within SLA |
| Player endpoint failover tested | Configure test player with primary=new-region, fallback=existing-region; kill primary; verify fallback |
| Data residency configuration in place | PLATFORM_ADMIN confirms data_residency_region set for all enterprises in new region |
| Regional health monitoring operational | New region appears in fleet health dashboard; alerts route correctly |
| Runbooks updated | DR runbook, escalation matrix, and this document updated for new region |

New regions must not receive production player traffic until all criteria are verified and signed off by PLATFORM_ADMIN.
