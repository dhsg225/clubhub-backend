# VENUE-AUTONOMY.md
# ClubHub TV — Venue Autonomy Model

**Document type:** Deployment Architecture Reference
**Status:** Canonical
**Authority:** Platform Operations
**Audience:** Infrastructure engineers, venue integrators, ENTERPRISE_ADMIN, REGIONAL_MANAGER
**Last updated:** 2026-05-26
**Depends on:** PLAYER-TOPOLOGY.md, EDGE-BEHAVIOR.md, OFFLINE-OPERATION.md

---

## Table of Contents

1. [Autonomy Principle](#1-autonomy-principle)
2. [Venue Autonomy Capabilities](#2-venue-autonomy-capabilities)
3. [Venue Autonomy Limits](#3-venue-autonomy-limits)
4. [Constitutional Guarantee Preservation](#4-constitutional-guarantee-preservation)
5. [Venue Autonomy Grades](#5-venue-autonomy-grades)
6. [Grade Assignment Criteria](#6-grade-assignment-criteria)
7. [Hardware Requirements by Grade](#7-hardware-requirements-by-grade)
8. [Autonomy Grade in Practice: Examples](#8-autonomy-grade-in-practice-examples)
9. [Local Operator Capabilities](#9-local-operator-capabilities)
10. [Autonomy and Compliance](#10-autonomy-and-compliance)
11. [Upgrading Venue Autonomy Grade](#11-upgrading-venue-autonomy-grade)

---

## 1. Autonomy Principle

Venues should operate correctly and safely in isolation. Cloud CMS connectivity should enhance the platform's capability — faster corpus updates, real-time monitoring, cross-venue coordination — but removing cloud connectivity should not cause venues to fail or produce non-compliant output.

**The cloud is a capability amplifier, not a prerequisite for correct operation.**

This principle has architectural consequences at every layer:

- PRE.resolve() is a pure local function (no cloud dependency at invocation time)
- Corpus is stored locally in full (no partial corpus; no "just-in-time" cloud queries)
- Emergency state is persisted locally (emergency mode survives network loss)
- Audit records are generated locally and buffered (no audit data loss during outages)
- Schedule execution is entirely local (time-based rules baked into corpus)

A venue that cannot meet these requirements for a defined autonomy period is not deployable without specific risk documentation and operator acknowledgment. GRADE_C venues represent the minimum viable autonomy level for any production deployment.

---

## 2. Venue Autonomy Capabilities

These are operations that a venue performs correctly and safely without any cloud CMS connectivity:

### 2.1 Scheduled Content Execution

All time-based schedule rules execute locally from the corpus. This includes:

- Daypart schedules (morning / afternoon / evening content rotation)
- Day-of-week schedules (weekday vs. weekend content)
- Date-specific campaigns (promotions with defined start and end dates)
- Time-bounded overrides (screen locks that expire at a defined time)
- Seasonal content rules (summer vs. winter menus, holiday content)

**Constraint:** All scheduled content changes must be present in the corpus that was last delivered before the outage began. See EDGE-BEHAVIOR.md Section 3 for the autonomy window constraint.

### 2.2 Emergency Response (Local)

Venue operators can trigger emergency response without cloud connectivity, subject to grade-dependent capabilities:

- **GRADE_A:** Hardware emergency button connected to player GPIO; one press triggers EMERGENCY_FREEZE on all screens in the venue immediately
- **GRADE_B:** Tablet-based local management interface (runs on venue LAN; no WAN required); operator taps "Emergency Stop" in the local interface
- **GRADE_C:** Phone call to REGIONAL_MANAGER, who triggers EMERGENCY_FREEZE via the CMS from their location (requires CMS connectivity somewhere in the chain, not necessarily at the venue)

### 2.3 Local Override

A venue operator can create local content overrides via a locally-deployed management interface (for GRADE_A and GRADE_B venues). These overrides:

- Are written to a local override store on the venue's player or local CMS node
- Are executed by the local PRE as a LEVEL_1 (screen lock) or LEVEL_2 (temporal override) resolution
- Are NOT propagated to the cloud CMS during the offline period (they are a local, venue-scoped action)
- Are uploaded to the cloud CMS on reconnect as a "venue-applied override" audit record

Local overrides created during an offline period are temporary by default (maximum duration: 8 hours without cloud confirmation). If the venue reconnects before the override expires, the cloud CMS records the override in the audit trail. If the venue does not reconnect before the override expires, the override expires locally and the PRE falls through to the next resolution level.

This time limit on local overrides is a constitutional safety constraint: it prevents indefinite unaudited local modifications to platform behavior.

### 2.4 Entropy Detection

Local entropy detection operates without cloud connectivity:

- Each player computes a checksum of its locally-stored corpus every 60 minutes
- Each player verifies asset checksums every 6 hours
- Results are stored locally and uploaded in batch on reconnect

The venue cannot compare its local entropy state against the cloud CMS's expected state without connectivity. But it can detect internal inconsistencies (e.g., if two players in the same venue have different corpus checksums, indicating they are on different corpus versions — a form of intra-venue entropy).

### 2.5 Audit Record Generation

All PRE invocations during an offline period generate audit records. These records are:

- Written to the local append-only buffer immediately after each invocation
- Checksummed individually and hash-chained to the previous record
- Retained locally until cloud confirmation of receipt

The local audit record stream is constitutionally equivalent to the cloud audit record stream. Records generated offline have the same format, same fields, and same integrity guarantees as records generated during connected operation.

---

## 3. Venue Autonomy Limits

These are operations that a venue cannot perform without cloud CMS connectivity. These limits exist by design — they require platform-level authority that cannot be safely delegated to offline edge nodes.

### 3.1 New Campaign Publishing

Publishing a new campaign requires:
- ENTERPRISE_ADMIN authority in the cloud CMS
- Corpus version management (signing, versioning, distribution)
- Cross-venue coordination (which venues receive the campaign, in what order)

These operations cannot happen offline. A venue cannot unilaterally publish a new campaign for its screens.

**Practical implication:** All campaign content for an upcoming period must be published in advance and delivered to the venue before any anticipated offline period. Last-minute campaign additions cannot be delivered to an offline venue.

### 3.2 Canary Promotion

Corpus version promotion (SHADOW_ONLY → SINGLE_VENUE → FLEET_WIDE → AUTHORITATIVE) is managed exclusively by ENTERPRISE_ADMIN or PLATFORM_ADMIN via the cloud CMS. A venue cannot locally promote a corpus version to authoritative status.

**Why:** Canary promotion involves fleet-wide coordination, rollback capability, and cross-venue consistency checks. These operations require platform-level state visibility that is not available at a single offline venue.

### 3.3 Cross-Venue Operations

Any action that must be applied consistently across multiple venues — a synchronized campaign activation, a fleet-wide emergency, a content policy enforcement — requires cloud CMS coordination. A single offline venue cannot coordinate with other venues.

### 3.4 EMERGENCY_FREEZE Reset

A venue in EMERGENCY_FALLBACK mode cannot autonomously exit that mode. The EMERGENCY_FREEZE_LIFT signal must be issued by PLATFORM_ADMIN via the cloud CMS and delivered to the player. This is a constitutional requirement: emergency state lift requires explicit human authority above the venue level.

**Exception for hardware emergency button (GRADE_A only):** If a venue activated EMERGENCY_FREEZE locally via the hardware button, the venue operator can also lift the freeze locally via a confirmed two-step process (button + PIN, or button + local management interface confirmation). However, the local lift is still logged as a local action and is subject to cloud CMS confirmation within 4 hours — if the cloud CMS does not confirm the lift within 4 hours of reconnection, it becomes a DISPUTED_EMERGENCY_LIFT and triggers an ENTERPRISE_ADMIN review.

---

## 4. Constitutional Guarantee Preservation

Venue autonomy does not weaken the platform's constitutional guarantees. This section documents how each core guarantee is maintained during autonomous operation.

### 4.1 PRE Determinism

**Guarantee:** For identical inputs (screen_id, at, corpus), PRE.resolve() produces identical outputs.

**Preserved offline because:** The local PRE is the same code as the cloud PRE. No modifications, shortcuts, or degraded paths are used in offline mode. The corpus stored locally is a checksum-verified copy of the authoritative cloud corpus. The timestamp is read from the local NTP-synchronized system clock. Given these identical inputs, the output is identical.

### 4.2 Full Replayability

**Guarantee:** Every PRE invocation is replayable from its inputs.

**Preserved offline because:** Every PRE invocation during offline operation produces an audit record with the full invocation inputs (screen_id, at, corpus_version, corpus_checksum). The corpus itself is stored locally. Given these records and the corpus, any offline invocation can be replayed.

### 4.3 Corpus Integrity

**Guarantee:** The player never operates on a corpus that has not been checksum-verified.

**Preserved offline because:** The corpus checksum verification requirement is enforced regardless of connectivity. A player will not load a new corpus (or continue operating on a corrupted corpus) without a passing checksum. Connectivity does not change this requirement.

### 4.4 Emergency State Persistence

**Guarantee:** Emergency state persists across reboots and connectivity changes.

**Preserved offline because:** EMERGENCY_FREEZE state is written to persistent storage (`/etc/clubhub/emergency-state.json`) immediately on receipt or local activation. This file is read on every player startup. The player enters EMERGENCY_FALLBACK if this file is present and valid, regardless of network state.

### 4.5 Audit Completeness

**Guarantee:** No PRE invocations occur without an audit record.

**Preserved offline because:** The audit record write is synchronous with the PRE invocation. A PRE invocation that completes without producing an audit record is a platform defect. The local buffer write occurs to persistent storage before the PRE output is acted upon.

---

## 5. Venue Autonomy Grades

Autonomy grades define the operational capabilities and requirements for venues based on their risk profile, connectivity reliability, and compliance obligations.

### GRADE_A: Full Autonomous Capability

**Autonomy window:** 7 days
**Emergency capability:** Hardware emergency button + local CMS node
**Local management:** Full local management interface (operator UI running on venue LAN)
**Audit capability:** Local audit export; on-site audit retrieval by field technician
**Required for:** All compliance-critical venues; all venues with documented unreliable WAN; all AIR_GAPPED venues

### GRADE_B: Standard Autonomous Capability

**Autonomy window:** 72 hours
**Emergency capability:** Software emergency trigger via tablet/device on venue LAN
**Local management:** Tablet-based local management interface
**Audit capability:** Audit records buffered locally; synced on reconnect
**Required for:** Standard commercial venues; licensed venues with regular WAN access

### GRADE_C: Minimal Autonomous Capability

**Autonomy window:** 24 hours
**Emergency capability:** Phone call to REGIONAL_MANAGER (not local-only capability)
**Local management:** None beyond direct SSH access (for technical staff)
**Audit capability:** Audit records buffered locally; synced on reconnect
**Applicable to:** Low-risk venues with reliable WAN; venues where a 24h content outage is acceptable; venues where an operator is always reachable

**GRADE_C is the minimum production grade.** Any venue with compliance requirements, regulatory display obligations, or unreliable WAN must be GRADE_B or higher.

---

## 6. Grade Assignment Criteria

### 6.1 Assessment Dimensions

Grade assignment is determined by assessing four dimensions:

| Dimension | Assessment questions |
|-----------|---------------------|
| Regulatory risk | Does the venue have statutory display obligations (gaming, liquor licensing, food safety messaging)? What is the regulatory consequence of missing required content? |
| WAN reliability | What is the venue's historical WAN availability? Does the venue have a backup WAN connection (4G/LTE)? Is the venue in a remote location with limited ISP options? |
| Operational risk | What is the consequence to the business if screens go dark for 1h, 4h, 24h? Is the venue unattended (fully automated) or staffed? |
| Compliance history | Has this venue had previous compliance incidents? Are there ongoing regulatory obligations requiring demonstrable content audit trails? |

### 6.2 Grade Decision Matrix

| WAN reliability | Regulatory obligation | Operational risk | Required grade |
|----------------|----------------------|-----------------|----------------|
| Unreliable/unknown | Any | Any | GRADE_A |
| Any | High (statutory) | Any | GRADE_A |
| Reliable | Medium | High | GRADE_B |
| Reliable | Medium | Medium | GRADE_B |
| Reliable | Low/none | Low | GRADE_C |
| Reliable | Low/none | Medium | GRADE_C or GRADE_B |

When in doubt, assign the higher grade. The cost of unnecessary infrastructure is less than the cost of a compliance failure at an under-graded venue.

### 6.3 ENTERPRISE_ADMIN Authority for Grade Assignment

Grade assignment is the responsibility of the ENTERPRISE_ADMIN, with input from:

- The VENUE_ADMIN (who knows the venue's physical and operational context)
- The REGIONAL_MANAGER (who knows the market's regulatory environment)
- Platform Operations (who can assess technical capability of the venue's infrastructure)

Grade assignments are recorded in the venue record in the CMS and are auditable. A grade downgrade (from GRADE_A to GRADE_B, or GRADE_B to GRADE_C) requires ENTERPRISE_ADMIN signoff and a risk acknowledgment statement.

---

## 7. Hardware Requirements by Grade

### 7.1 GRADE_A Hardware Specification

| Component | Requirement |
|-----------|-------------|
| Pi model | Raspberry Pi 4 (4 GB RAM) or Pi 5 (minimum) |
| Storage | 64 GB Class A2 microSD; consider 128 GB for large content libraries |
| Network | Ethernet primary; 4G/LTE USB modem as WAN backup |
| Emergency button | Hardware push-button wired to GPIO 17 (configurable); momentary normally-open |
| Local CMS node | Lightweight local management server running on a separate device (e.g., second Pi or NUC) on the venue LAN |
| UPS | Uninterruptible power supply for all players and local CMS node |
| Active cooling | Mandatory for all Pi 5; recommended for Pi 4 in enclosed installations |

### 7.2 GRADE_B Hardware Specification

| Component | Requirement |
|-----------|-------------|
| Pi model | Raspberry Pi 4 (2 GB RAM minimum; 4 GB recommended) |
| Storage | 32 GB Class A1 minimum; 64 GB recommended |
| Network | Ethernet primary; Wi-Fi acceptable as backup |
| Emergency trigger | Tablet or phone on venue LAN with local management app installed |
| UPS | Recommended but not mandatory |
| Active cooling | Recommended for enclosed installations |

### 7.3 GRADE_C Hardware Specification

| Component | Requirement |
|-----------|-------------|
| Pi model | Raspberry Pi 4 (2 GB RAM minimum) |
| Storage | 32 GB Class A1 minimum |
| Network | Ethernet primary; Wi-Fi acceptable |
| Emergency trigger | Via phone to REGIONAL_MANAGER (no local hardware required) |
| UPS | Not required |
| Active cooling | Recommended for enclosed installations |

---

## 8. Autonomy Grade in Practice: Examples

### 8.1 Licensed Club (Gaming Venue) — GRADE_A Required

A members' club in Australia with 40 electronic gaming machines (EGMs) and a liquor licence. Statutory requirements:

- Responsible gambling messaging must be displayed on specific screens during EGM operating hours
- Specific signage required during particular hours per state gaming regulations
- Compliance inspections may request audit records showing what was displayed and when

**Grade rationale:** High regulatory obligation; compliance failure is reportable; audit records must be complete and retrievable; venue must be able to respond to emergencies without cloud dependency.

**Infrastructure:** Pi 5 players with 64 GB storage; hardware emergency button at bar; local CMS node for local management; 4G backup WAN; UPS on all players and networking equipment.

### 8.2 Pub With Regular Entertainment — GRADE_B Typical

A suburban pub with 8 screens showing sport, promotions, and music content. No gaming machines. Liquor licensed.

**Grade rationale:** Medium regulatory obligation (liquor licence requires responsible service messaging); reliable broadband WAN; venue staffed during all operating hours; emergency can be triggered by staff tablet if WAN fails.

**Infrastructure:** Pi 4 (4 GB) players with 32 GB storage; tablet with local management app on venue Wi-Fi; Ethernet primary connection.

### 8.3 Small Café or Retail Venue — GRADE_C Minimum

A café with 2 screens showing promotional content and a digital menu. No regulatory obligations.

**Grade rationale:** Low risk; screens showing non-critical commercial content; WAN outage only affects promotional content delivery; staffed venue where manager can call REGIONAL_MANAGER if needed.

**Infrastructure:** Pi 4 (2 GB) players with 32 GB storage; standard broadband WAN.

### 8.4 Resort Complex — GRADE_A Required

A resort hotel with 60+ screens across bar, pool, lobby, restaurant, and spa. Content varies significantly by zone.

**Grade rationale:** High operational risk (screens in multiple unmanned areas; central monitoring required); complex schedule with many zones; emergency response must not require staff to locate specific equipment across a large property; high reputational risk if screens show wrong content in guest areas.

**Infrastructure:** Pi 5 players in AV rack per zone; centralized local CMS node in server room; hardware emergency buttons at each major staffed location (reception, bar, restaurant); network monitoring for all player connections; full UPS on server room equipment.

---

## 9. Local Operator Capabilities

### 9.1 What a VENUE_ADMIN Can Do Locally (GRADE_A/B)

Via the local management interface (without cloud connectivity):

| Action | GRADE_A | GRADE_B | Notes |
|--------|---------|---------|-------|
| Trigger EMERGENCY_FREEZE | Yes (hardware button + local UI) | Yes (local UI) | All screens at the venue |
| View current screen content | Yes | Yes | What each screen is currently showing |
| Create a temporary override | Yes | Yes | Maximum 8h duration without cloud confirmation |
| View venue entropy state | Yes | Yes | Local corpus checksum status |
| Restart individual player | Yes | Yes | Via local UI; player reconnects automatically |
| View audit records (recent) | Yes | Limited | GRADE_A has full local audit viewer; GRADE_B has recent-only summary |
| Push a new campaign | No | No | Requires cloud CMS |
| Modify scheduling rules | No | No | Requires corpus update from cloud CMS |
| Promote corpus version | No | No | Requires cloud CMS and ENTERPRISE_ADMIN authority |

### 9.2 GRADE_A Local CMS Node

The GRADE_A local CMS node is a lightweight server application running on the venue LAN. It provides:

- A web-based management interface accessible from any device on the venue LAN (browser required; no app install needed for staff)
- Read-access to all local player states and current PRE outputs
- Emergency trigger capability (sends EMERGENCY_FREEZE directly to all local players via LAN)
- Local override creation (with 8h maximum duration constraint)
- Local audit record viewer (read-only)
- Asset cache status for all players

The local CMS node does NOT have authority to:
- Modify the corpus
- Promote corpus versions
- Lift an EMERGENCY_FREEZE that originated from the cloud CMS (only a local-triggered freeze can be lifted locally)
- Create operator accounts or modify role assignments

The local CMS node syncs with the cloud CMS when WAN is available, uploading locally-created overrides, emergency actions, and status updates. When WAN is unavailable, it operates in local-only mode.

---

## 10. Autonomy and Compliance

### 10.1 Compliance During Offline Periods

For compliance-critical venues, the critical question during an offline period is: "Are the required content items still being displayed?"

The answer depends on whether those items were baked into the corpus before the outage began. If they were, yes — the PRE resolves them locally, and the audit records prove it. If they were not (because they were published after the outage began), no — and this creates a compliance risk.

**Compliance-critical venue protocol:**

- Compliance-required content (responsible gambling messaging, regulatory signage) must be in the corpus with no expiry — they are always-on schedule items, not dated campaigns
- These items must be in every corpus version published to the venue, not just selected versions
- They must survive corpus updates: a new corpus version must be rejected by the CMS if it does not include all required compliance content for the target venue

### 10.2 Proving Compliance from Offline Audit Records

If a regulator requests proof that required content was displayed during an offline period:

1. Retrieve the buffered audit records from the player (exported via SSH or field technician USB export)
2. Upload to the CMS as an offline audit import
3. CMS processes the records and generates a compliance report for the specified time period
4. The report shows: for each required content item, every PRE invocation that resolved to that item, with timestamp, and the corpus version used
5. The corpus version checksum in each audit record proves which corpus was in use at each moment

This report is forensically valid because:
- The audit records are hash-chained (tampering is detectable)
- The corpus version checksums are verifiable against the CMS's stored corpus archive
- The PRE is deterministic: given the audit record's inputs, the output can be reproduced

### 10.3 Regulatory Documentation

For gaming and liquor-licensed venues, the platform generates a Regulatory Compliance Certificate on request:

- Specifies which compliance-required content items were active for the venue during the requested period
- Shows the PRE resolution proof (which resolution level resolved each required item)
- Documents any offline periods and whether required content was maintained during those periods
- Signed by the ENTERPRISE_ADMIN for legal admissibility

---

## 11. Upgrading Venue Autonomy Grade

When a venue's risk profile changes (e.g., a venue gains a gaming licence and must upgrade from GRADE_B to GRADE_A):

### 11.1 Upgrade Process

1. **Assessment:** ENTERPRISE_ADMIN and VENUE_ADMIN complete a grade reassessment using the criteria in Section 6
2. **Hardware procurement:** Order required hardware (emergency button, UPS, local CMS node if needed)
3. **Installation planning:** Schedule an installation window (ideally during off-hours)
4. **Hardware installation:** Field technician installs hardware; tests emergency button GPIO integration; configures local CMS node
5. **Grade update in CMS:** ENTERPRISE_ADMIN updates venue grade in CMS; this triggers updated alerting thresholds and compliance reporting requirements
6. **Verification:** Run the autonomy tests from OFFLINE-OPERATION.md Section 11.1 appropriate for the new grade
7. **Documentation:** Update venue commissioning record; notify REGIONAL_MANAGER

### 11.2 Downgrade Process

Downgrading a venue's autonomy grade (e.g., removing a gaming licence means GRADE_A compliance requirements no longer apply) follows a similar process but requires:

- ENTERPRISE_ADMIN decision with written rationale
- PLATFORM_ADMIN notification (downgrade of any compliance-critical venue requires platform-level awareness)
- Updated venue commissioning record noting the change and its rationale
- Confirmation that any hardware being decommissioned (local CMS node, UPS) is properly retired

**Note:** Grade downgrade does not change existing audit records or compliance history. The audit trail for the previous grade period remains intact and continues to be retained according to the retention policy that was in effect at the time the records were created.
