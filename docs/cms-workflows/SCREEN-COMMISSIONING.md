# Screen Commissioning

**Document type:** Operational workflow specification
**Audience:** VENUE_OPERATOR (venue commissioning), ENTERPRISE_ADMIN (bulk commissioning), PLATFORM_ADMIN (platform configuration), platform engineers
**Depends on:** PRE-REFERENCE-IMPLEMENTATION-v1.md, VENUE-ONBOARDING.md, CLUBHUB_SYSTEM_CONTRACTS.md, OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Overview

Screen commissioning is the process by which a physical display device is admitted to the ClubHub TV platform and authorized to receive and display resolved PRE content. A screen does not serve live playlists until it has completed the full commissioning sequence and passed the initial PRE determinism check.

Commissioning is irreversible in terms of the audit record — a screen_id and its fingerprint, once registered, are retained permanently even after decommissioning. This is a forensic integrity requirement: replay audit records that reference a screen_id must remain interpretable indefinitely.

---

## 2. Pre-Requisites

The following must be satisfied before commissioning begins:

| Pre-requisite                   | Verified By                   | Notes                                                                 |
|---------------------------------|-------------------------------|-----------------------------------------------------------------------|
| Venue record exists             | System (automated check)      | Venue must be in CORPUS_INITIALIZED state or later                   |
| Screen zone assigned            | VENUE_OPERATOR                | Zone determines which corpus slot category applies to this screen    |
| Deployment group configured     | ENTERPRISE_ADMIN+             | Screen must have a destination deployment group before commissioning |
| Corpus version bound to group   | ENTERPRISE_ADMIN+             | The group must have an active CorpusVersion binding                  |
| Physical installation complete  | VENUE_OPERATOR (attestation)  | Operator attests physical installation; logged in audit record       |
| Network path confirmed          | Platform engineer / VENUE_OP  | Device must be able to reach backend; tested before step 1           |
| Emergency content slot pre-loaded | ENTERPRISE_ADMIN+           | Venue must have emergency_content corpus slot populated              |

Attempting to commission a screen for a venue that lacks emergency_content corpus population produces a hard error: `EMERGENCY_CONTENT_SLOT_MISSING`. This is not bypassed by any role.

---

## 3. Commissioning Steps

### Step 1: Physical Installation Attestation

**Actor:** VENUE_OPERATOR (minimum)

The operator records physical installation completion via the operator UI. This creates:
- `screen.installation_attested` audit record with `screen_zone`, `physical_location_description`, `attested_by`, `attested_at`
- A provisional `screen_id` assigned at this point (UUID, system-generated)

The `screen_id` is provisional until step 2. The installation attestation is the only step that can be performed without network connectivity to the backend — it can be completed on a mobile device and synchronized later.

### Step 2: Device Registration

**Actor:** System (automated) + VENUE_OPERATOR (triggers enrollment)

The device runs the enrollment handshake:
1. Device sends enrollment request to backend with hardware fingerprint (MAC address + CPU serial + display adapter identifier, SHA-256 hashed)
2. Backend verifies fingerprint is not already registered (duplicate fingerprint is a hard error: `DEVICE_ALREADY_REGISTERED`)
3. Backend assigns `device_fingerprint_hash` to the provisional `screen_id` — the screen_id is now permanent
4. Backend issues device certificate (used for subsequent authenticated communication)
5. `screen.device_registered` audit record written: `screen_id`, `device_fingerprint_hash`, `certificate_issued_at`, `enrollment_source` (which venue/operator triggered enrollment)

**What this prevents:** A single physical device cannot be registered as two different screens. A screen_id cannot be transferred to a different physical device without going through decommission + recommission.

### Step 3: Network Topology Configuration

**Actor:** VENUE_OPERATOR + Platform engineer (for complex configurations)

Configure:
- Backend endpoint the device polls (primary + failover if applicable)
- Poll interval (default: 60 seconds; configurable per deployment group)
- Heartbeat interval (default: 120 seconds — matches CLUBHUB_SYSTEM_CONTRACTS.md §1.2 screen health SLA)
- Network zone assignment (relevant for fleet-local delivery networks)

Configuration is written to device and confirmed:
- Device sends first authenticated heartbeat
- Backend records heartbeat receipt: `screen.heartbeat_established` with `screen_id`, `first_heartbeat_at`, `poll_interval_s`, `heartbeat_interval_s`

Heartbeat failure at this step is a blocking commissioning error — it indicates a network path problem that must be resolved before proceeding.

### Step 4: Corpus Version Assignment

**Actor:** System (automatic, based on deployment group) + ENTERPRISE_ADMIN (may override group assignment)

The screen inherits its CorpusVersion binding from its deployment group. Assignment is automatic when the screen is enrolled into the group.

What this binding means:
- PRE will use this CorpusVersion when resolving content for this screen
- The corpus version's content assets must be delivered to this device before live content begins
- The binding is recorded: `screen.corpus_version_assigned` with `screen_id`, `corpus_version_id`, `deployment_group_id`, `assigned_at`

If the screen is assigned to a deployment group that is in SHADOW_ONLY or canary stage, the screen enters shadow mode automatically — it receives PRE-resolved content but also runs legacy resolution in parallel for parity comparison.

### Step 5: PRE Initial Invocation — First-Boot Determinism Check

**Actor:** System (automated, triggered at commissioning)

This is the constitutional gate that must pass before a screen can serve live playlists.

Process:
1. PRE.resolve() invoked 5 times for this screen with a canonical test input (fixed `at` timestamp, known content schedule, known corpus version)
2. All 5 outputs must produce identical `playlist_checksum`
3. Any divergence is a commissioning failure — `screen.determinism_check_failed` recorded
4. On pass: `screen.determinism_check_passed` recorded with `screen_id`, `corpus_version_id`, `test_input_hash`, `playlist_checksum`, `invocation_count`, `all_deterministic: true`

A failed determinism check means the screen cannot proceed to step 6. The failure is escalated to ENTERPRISE_ADMIN and the platform engineering team. Common causes: corpus asset delivery incomplete (step 6 not yet run would cause this — this step runs against the deployment group's expected corpus state, not device-local assets), clock skew on device, device hardware inconsistency.

Determinism checks are not retried automatically. A human must investigate the failure, clear it, and manually re-trigger commissioning from step 5.

### Step 6: Entropy Baseline Establishment

**Actor:** System (automated, triggered immediately after step 5 pass)

The entropy baseline is the reference state against which all future entropy scans compare. It records what the device actually has vs. what the corpus version specifies.

Process:
1. Device reports its current corpus asset inventory (asset IDs + checksums for all locally cached content)
2. Backend computes expected inventory from the CorpusVersion binding
3. Comparison: `baseline_match_percentage`, `missing_assets[]`, `checksum_mismatches[]`
4. If baseline_match_percentage < 95%: ASSET_RESYNC triggered; commissioning continues but screen is flagged as PENDING_RESYNC

The entropy baseline is stored as:
- `screen.entropy_baseline_established` with `screen_id`, `corpus_version_id`, `baseline_established_at`, `baseline_checksum`, `match_percentage`, `asset_count`

This baseline is the "ground truth" against which all future entropy reports measure drift. If the baseline itself is incorrect, all future entropy measurements are meaningless. ENTERPRISE_ADMIN must review baseline_match_percentage < 95% cases before the screen is admitted.

### Step 7: Screen Admitted to Deployment Group

**Actor:** System (automatic after steps 1-6 pass) + VENUE_OPERATOR (confirms admission)

The screen transitions from COMMISSIONING to ACTIVE status within the deployment group.

At admission:
- Screen appears in fleet monitoring dashboard
- Screen is included in all future entropy scans for its venue
- Screen begins receiving PRE-resolved playlists (or shadow-mode content if deployment group is in canary stage)
- `screen.admitted_to_deployment_group` audit record: `screen_id`, `deployment_group_id`, `admitted_at`, `commissioning_completed_at`, `screens_in_group_after_admission`

The VENUE_OPERATOR receives a confirmation notification. If they do not confirm within 1 hour, the admission stands — the confirmation is a UX signal, not a blocking gate. The admission itself is automatic on prerequisites passing.

### Step 8: Monitoring Established

**Actor:** System (automatic at admission)

Monitoring configuration applied to the screen:
- Heartbeat monitoring: alert if no heartbeat within 180 seconds (1.5x the heartbeat interval SLA)
- Entropy polling interval configured: default 60 minutes (configurable per deployment group, range 15min–240min)
- Checksum drift alert threshold configured: default 0% tolerance (any checksum mismatch is an alert)
- Screen appears in venue health dashboard

`screen.monitoring_established` audit record: `screen_id`, `heartbeat_alert_threshold_s`, `entropy_poll_interval_s`, `checksum_drift_tolerance`, `monitoring_started_at`

---

## 4. Commissioning Authority

### 4.1 Venue-Level Commissioning

**Actor:** VENUE_OPERATOR (minimum)

A VENUE_OPERATOR may commission individual screens within their assigned venue. They may complete steps 1-3 and step 7 (confirmation). Steps 4-6 are automated by the system; the VENUE_OPERATOR does not need to trigger them manually.

**Limitation:** A VENUE_OPERATOR cannot commission screens in other venues, even if physically present. Commissioning is scope-bound to the operator's venue assignment.

### 4.2 Bulk Commissioning (ENTERPRISE_ADMIN)

An ENTERPRISE_ADMIN may commission screens across multiple venues simultaneously. Bulk commissioning workflows:

1. ENTERPRISE_ADMIN uploads a device manifest (CSV or JSON: serial numbers, venue assignments, zone assignments, deployment group assignments)
2. System validates the manifest: checks for duplicate fingerprints, valid venue assignments, valid deployment groups
3. Validation report returned (errors block submission; warnings require acknowledgment)
4. ENTERPRISE_ADMIN confirms submission
5. Commissioning steps 1-8 run asynchronously for each device in the manifest
6. ENTERPRISE_ADMIN receives a commissioning status report as each device completes or fails

Bulk commissioning is asynchronous. The ENTERPRISE_ADMIN does not need to remain online while devices complete their commissioning sequences.

---

## 5. Decommissioning

### 5.1 Screen Removal

**Actor:** VENUE_OPERATOR+ (for individual screen); ENTERPRISE_ADMIN for bulk decommission

Decommissioning steps:
1. VENUE_OPERATOR marks screen as PENDING_DECOMMISSION
2. Screen is removed from PRE schedule at next tick — no more content resolved for this screen
3. Screen is excluded from future entropy scans
4. Device certificate revoked
5. Corpus binding released — the deployment group no longer includes this screen
6. `screen.decommissioned` audit record written: `screen_id`, `decommissioned_by`, `decommissioned_at`, `reason`

**What is retained after decommissioning:**
- screen_id (permanent — referenced by historical ReplayAuditRecords)
- device_fingerprint_hash (retained to prevent re-registration of the same physical device under a different identity)
- All audit records associated with this screen (immutable, forever)
- Entropy baseline and all entropy scan records (forensic reference)

**What is released:**
- Active corpus binding
- Deployment group membership
- Monitoring configuration
- Device certificate

A decommissioned screen cannot be "reactivated" — it must go through full re-commissioning (see §6) if returned to service.

---

## 6. Re-Commissioning (Screen Moved or Returned to Service)

When a previously decommissioned screen is returned to service — either at the same venue or moved to a different venue — it must complete full re-commissioning.

**Key differences from initial commissioning:**

1. **Device registration:** Device fingerprint is already registered. The re-commissioning path recognizes the existing `screen_id` and reuses it (rather than generating a new UUID). This preserves the historical audit record linkage.

2. **Corpus re-binding:** If the screen moves to a different venue, its corpus binding must be re-established for the new venue's deployment group. The old binding is archived.

3. **Entropy re-baseline:** A new entropy baseline is established for the new venue/corpus context. The old baseline is retained in audit history but is no longer the active reference.

4. **PRE determinism re-check:** Must pass again, even if the screen previously passed. The corpus version may have changed; the re-check verifies determinism in the current corpus state.

5. **Audit continuity:** All pre-decommission audit records remain associated with the screen_id. Re-commissioning adds to the record rather than replacing it. The audit history will show the commissioning, decommissioning, and re-commissioning events in sequence.

---

## 7. Offline Commissioning

Some deployments involve screens that cannot be online during initial setup (remote venues, restricted networks, temporary installations). The offline commissioning path accommodates this:

### 7.1 What Can Be Done Offline

- Step 1 (physical installation attestation) — fully offline via mobile sync
- Device certificate pre-provisioning — ENTERPRISE_ADMIN generates a batch of pre-provisioned certificates tied to expected device fingerprints; certificates are loaded onto devices before installation

### 7.2 What Requires Connectivity

Steps 2-8 all require backend connectivity. Offline commissioning defers these to the first moment of connectivity.

### 7.3 First-Connect Protocol

When a pre-provisioned device first establishes connectivity:
1. Device presents its pre-provisioned certificate
2. Backend validates certificate, confirms fingerprint matches registration record
3. Steps 2-8 run automatically in sequence
4. Operator is notified when commissioning completes

Pre-provisioned screens that have not established connectivity within 30 days of certificate issuance trigger an alert to ENTERPRISE_ADMIN. Certificates expire after 90 days — the device must be re-provisioned if not connected within that window.

---

## 8. Constitutional Implications

A screen that has not completed the full commissioning sequence — specifically step 5 (first-boot determinism check) — MUST NOT serve live playlists. This is a constitutional requirement, not a best practice.

The enforcement mechanism: PRE will not resolve content for a `screen_id` that does not have a `screen.determinism_check_passed` record in the audit log. Any attempt to force content resolution for an uncommissioned screen returns `SCREEN_NOT_COMMISSIONED` and the attempt is logged as a constitutional violation.

This means:
- Content cannot be pushed to a screen "manually" to work around commissioning
- OTA updates do not bypass this check
- Even PLATFORM_ADMIN cannot force content resolution for an uncommissioned screen (they can re-trigger commissioning, but not bypass it)

The constitutional protection exists because an uncommissioned screen has no verified entropy baseline — its corpus state is unknown — and therefore PRE determinism cannot be guaranteed for its output.
