# DELIVERY-RISK-MATRIX.md

**Document type:** Engineering implementation planning
**Status:** Engineering-ready
**Authority:** IMPLEMENTATION-WAVES.md, CRITICAL-PATH-ANALYSIS.md, ENGINEERING-STAFFING-MODEL.md
**Last updated:** 2026-05-26

---

## Overview

This document catalogs implementation delivery risks, ranked by severity (likelihood × impact). For each risk: the specific failure scenario, the early warning signals that indicate the risk is materializing, the mitigation strategy, and the escalation path if mitigation fails.

Risks are classified as CRITICAL, MEDIUM, or LOW. CRITICAL means the risk can cause constitutional failure, loss of data, or multi-week schedule slip. MEDIUM means the risk can cause operational degradation or 1–2 week delay. LOW means the risk is real but manageable without significant consequence.

**Likelihood scale:** H = >50% chance this occurs without mitigation; M = 20–50%; L = <20%
**Impact scale:** H = constitutional failure, data loss, or >2-week delay; M = operational degradation or 1–2 week delay; L = minor rework, no delay

---

## CRITICAL RISKS

### RISK-01: PRE Isolation Violation Discovered Late

**Likelihood:** L **Impact:** H **Severity:** CRITICAL

**Failure scenario:** An engineer implementing the corpus-publisher service imports a type or function from `src/pre/` — for example, importing the `PRE_OUTPUT_SCHEMA` type to validate corpus assembly output, or importing `PREResult` to use in a function signature. The import seems harmless because it's just a type. It is committed, passes code review (because reviewers are focused on the feature, not the import graph), and ships to production. Six weeks later, `constitutional-boundary-check.ts` fails on the PR but it has already been bypassed once and engineers think it's a false positive.

**Why it matters:** The constitutional boundary between PRE and CMS is not just organizational — it prevents corpus logic from being influenced by implementation details that live in `src/pre/`. Once a CMS service has any import from `src/pre/`, there is social pressure to add more (since the first one was accepted), and the boundary erodes incrementally.

**Early warning signals:**
- `constitutional-boundary-check.ts` fails in CI on any PR from corpus-publisher, cms-api, replay-audit-api, entropy-service, shadow-service, or canary-service
- A PR description says "I'm just importing the type, not the implementation" — this is the most common rationalization for a boundary violation
- An engineer asks "can I just import X from pre-engine? It's read-only" — the answer is always no

**Mitigation:**
1. `constitutional-boundary-check.ts` runs on every PR in CI (ci/stages/ — blocking, not advisory)
2. Monorepo dependency graph enforced: CMS-side packages must not declare `pre-engine` as a dependency in their `package.json`
3. All 9 engineers understand the boundary and its rationale during constitutional onboarding (Wave 1)
4. Code review checklist includes "imports from src/pre/?" as a required check item

**Escalation if mitigation fails:** If a boundary violation is discovered after it ships to production, the Technical Lead must assess whether the violation creates a concrete coupling (e.g., the CMS behavior changes based on a pre-engine type) or is a benign import (type only, no behavioral coupling). If benign: remove the import and replace with a locally-defined type. If behavioral coupling: halt feature work on the affected service until the coupling is removed and the constitutional boundary is re-verified.

---

### RISK-02: Corpus Corruption on Player During Update

**Likelihood:** M **Impact:** H **Severity:** CRITICAL

**Failure scenario:** A player-runtime process is downloading a new corpus version (a 2MB JSON payload over WiFi) when the network drops at 60% transfer. The partial file is written to the corpus location. On the next PRE.resolve() invocation, the runtime attempts to parse the partial JSON, which is malformed. PRE.resolve() throws, the circuit breaker opens, the player enters DEGRADED state and falls back to the LEVEL_5 structural fallback. The screen displays fallback content until the corpus can be re-downloaded successfully.

**More dangerous variant:** The download completes but the checksum verification is skipped due to a code bug. A partial file passes checksum verification (if the checksum is checked on a truncated field rather than the full payload). The corrupt corpus is applied. PRE.resolve() produces incorrect output silently.

**Early warning signals:**
- Corpus apply failure rate in monitoring (player-runtime logs should emit a metric for each corpus apply attempt: success, checksum-fail, parse-fail)
- Screen entering DEGRADED state shortly after a corpus version change (temporal correlation)
- LEVEL_5 fallback rate spike across a deployment group after a corpus publish

**Mitigation:**
1. **Atomic apply:** Write the downloaded corpus to `/var/lib/clubhub/corpus/incoming/<version_id>.json.tmp`, verify the fnv1a32 checksum and Ed25519 signature, then `rename()` (atomic on Linux) to the active corpus path. Never modify the active corpus file in-place.
2. **Checksum verification is not optional:** The checksum check must run before the rename. Test: write a unit test that deliberately corrupts the last byte of a corpus payload and verifies the player rejects it.
3. **Signature verification is not optional (post-Wave 2):** Same pattern — verify before apply. If signature fails, log the failure with the corpus version ID and keep the current corpus.
4. **Fallback to prior version:** If signature or checksum fails, the player must retain the previous corpus version. Never leave the player with no corpus.
5. **Monitoring:** Emit a corpus apply metric on every attempt with the outcome (ACCEPTED, REJECTED_CHECKSUM, REJECTED_SIGNATURE, REJECTED_PARSE).

**Escalation:** If checksum or signature failures spike for a deployment group, the corpus-publisher may have produced a malformed or incorrectly signed package. Halt corpus deployment to that deployment group until the issue is diagnosed.

---

### RISK-03: Audit Record Loss During Extended Offline

**Likelihood:** M **Impact:** H **Severity:** CRITICAL

**Failure scenario:** A Pi at a remote venue loses its internet connection. The player-runtime continues operating (72h autonomy design). Audit records accumulate in the local ring buffer. After 7 days offline (a venue closed for a week after a venue closure event), the ring buffer fills beyond its capacity (50MB), and the ring buffer begins dropping the oldest unsynced records to make space for new ones. The player logs a gap marker. When connectivity resumes, the audit chain for that venue has a gap spanning 2–4 days.

**Consequences:** The audit chain integrity check for that venue fails. AUDITOR cannot verify the chain for that venue for the affected period. For a LICENSED_GAMING venue with compliance obligations, this gap may constitute a regulatory reporting failure.

**Early warning signals:**
- Player-runtime audit buffer size metric at 70% capacity (alert threshold) — if this alert fires and the venue is in an extended offline state, escalate immediately
- Heartbeat gap in Redis heartbeat store (screen_id missing from heartbeat set for >2h)
- Buffer fullness metric approaching 90% — gap is imminent

**Mitigation:**
1. **Buffer size alert at 70% capacity.** Player-runtime emits a metric for buffer utilization. At 70%, an entropy ADVISORY alert is triggered. At 90%, a CRITICAL alert is triggered. These alerts reach the VENUE_OPERATOR via the entropy alerting path.
2. **Priority sync on reconnect.** When connectivity is restored, audit sync takes priority over entropy reports and other outbound calls.
3. **GRADE_A venue configuration.** High-compliance venues (LICENSED_GAMING, LICENSED_ALCOHOL with compliance requirements) must be configured as GRADE_A venues: Pi 4GB RAM, 64GB storage, 4G backup connectivity. The 4G backup should activate when the primary WiFi connection is lost for >5 minutes.
4. **Gap markers are explicit.** When the ring buffer must drop records, it writes a gap marker record: `{ type: 'AUDIT_GAP', dropped_count: N, period_start: T1, period_end: T2, reason: 'buffer_overflow' }`. This gap marker is itself synced to the cloud audit service, making the gap visible in the audit chain integrity check rather than silently absent.
5. **Venue operator notification.** When a venue enters extended offline state (>2h without heartbeat), the VENUE_OPERATOR is notified via entropy alert. They can take action (investigate the network, activate the 4G backup) before the buffer fills.

**Escalation:** If a LICENSED_GAMING venue has an audit gap, the PLATFORM_ADMIN must be notified immediately. The gap must be documented in an incident record. Regulatory reporting implications are assessed by the operator (not the platform).

---

### RISK-04: Database Migration Failure in Production

**Likelihood:** H **Impact:** M **Severity:** CRITICAL

**Failure scenario (1):** A Flyway migration adds a foreign key from `overrides` to `principals` for the `issued_by` field. The migration was tested on a small staging dataset. In production, there are 140,000 override records with a NULL `issued_by` field (existing records created before the column existed). The FK constraint validation fails because the migration was written to add the FK on existing rows without handling the null case.

**Failure scenario (2):** An RLS policy migration enables RLS on the `campaigns` table. The migration was tested with the default `app.current_enterprise_id` session variable set. In production, there is a service account (used by corpus-publisher for internal queries) that does not set the session variable before querying. All corpus-publisher campaign queries start returning empty results (the RLS policy sees no matching enterprise_id). Corpus assembly fails silently.

**Early warning signals:**
- Flyway migration dry-run failure in staging (required before every production deployment)
- Application error rate spike immediately after a migration is applied
- Empty result sets from queries that previously returned data (symptom of an RLS misconfiguration)
- Corpus-publisher `corpus.publish.requested` events hanging without completing

**Mitigation:**
1. **Staging migration dry-run is mandatory.** No migration reaches production without being applied to a staging environment with a production-volume data snapshot. This is enforced by the deployment pipeline: production deploy is blocked if staging migration has not been applied successfully in the last 24 hours.
2. **Rollback script for every migration.** Every Flyway migration file must have a corresponding rollback script (not relying on Flyway's built-in rollback, which does not work for DDL on PostgreSQL). The rollback script is reviewed alongside the migration PR.
3. **RLS policy test suite.** Every new RLS policy must have a corresponding test that verifies: (a) a query with the correct session variable returns expected rows, (b) a query with a different enterprise_id returns no rows, (c) a service account query with `bypass_rls=true` returns expected rows.
4. **Technical Lead reviews all migrations.** No migration touching append-only tables, partitioned tables, or RLS policies merges without Technical Lead review.
5. **Migration windows.** Production migrations run during low-traffic windows (e.g., 2–4 AM local time for the primary venue region). DDL on large tables (replay_audit_records) must be assessed for lock impact before scheduling.

**Escalation:** If a migration fails mid-apply in production, execute the rollback script immediately. Do not attempt to continue the migration or manually patch the inconsistent state. Page the DevOps engineer and Technical Lead.

---

### RISK-05: Pi Hardware Supply Chain Disruption

**Likelihood:** M **Impact:** H **Severity:** CRITICAL

**Failure scenario:** The Raspberry Pi 4 (4GB RAM variant) is unavailable or has a 6–8 week lead time at the time of order. The edge engineer cannot do integration testing. The Wave 1 operational readiness gate cannot be passed. Waves 2–7 are delayed proportionally.

**Early warning signals:**
- Pi 4 stock check at primary distributors (Farnell, RS, Adafruit) shows >4 week lead time
- Procurement estimates delivery after Week 4 (the latest date that allows Wave 1 gate to pass on schedule)

**Mitigation:**
1. **Order hardware in Week 1, day 1.** Five units: 1 development, 1 integration test, 1 staging/demo, 1 DevOps provisioning tooling, 1 spare.
2. **Stock buffer for customer deployments.** Venue deployment requires physical hardware at the customer site. The customer procurement process must begin 8 weeks before the planned deployment date. If supply chain is constrained, order 12 weeks ahead.
3. **Alternative hardware for development.** If Pi 4 is unavailable, Pi 5 (same architecture, different peripherals) can be used for development. Verify that Chromium kiosk behavior and GPIO (for GRADE_A emergency button) work equivalently. The player-runtime OS configuration may differ slightly.
4. **Cloud VM simulation fallback.** The edge engineer can run player-runtime on a cloud VM (ARM instance, e.g., AWS Graviton) for the first 2 weeks of development while hardware is in transit. Unit tests and corpus sync logic can be developed and tested on a VM. Hardware-specific testing (kiosk mode, GPIO) requires physical hardware.

**Escalation:** If Pi 4 is unavailable beyond Week 6, the Technical Lead must assess whether Wave 1 can be delivered on schedule with a substitute platform or whether the timeline must slip. A timeline slip on Wave 1 cascades to all subsequent waves.

---

## MEDIUM RISKS

### RISK-06: Canary Gate Never Clears for Enterprise

**Likelihood:** H **Impact:** M **Severity:** MEDIUM

**Failure scenario:** The first enterprise begins the canary process in Wave 6. Shadow parity is enabled. After 2 weeks of shadow recording, the parity score is 0.97 — good but not meeting the 0.999 threshold required for canary advancement. Investigation reveals that the divergences are classified as CLASS_2 (non-deterministic, schedule-driven) but are actually caused by a corpus configuration issue: a sponsorship contract's `expires_at` field is set to a timezone that does not account for DST correctly, causing the L4 sponsorship to appear or not appear differently between the legacy resolver and PRE.resolve() depending on the time of day. The divergence is real — not a classification error — but it requires a corpus correction, not a code change.

**The stuck state:** The enterprise cannot advance beyond SHADOW_ONLY. The Technical Lead is brought in to diagnose. Corpus correction is made. But now the parity record history for the prior 2 weeks contains the divergences. Does the 0.999 threshold apply to the rolling 7-day window (which will clear within a week of the fix) or to the cumulative history?

**Early warning signals:**
- Parity score is improving week over week but at a rate that suggests it won't reach 0.999 within the planned wave timeline
- Divergence class breakdown shows a concentration in a specific resolution level (L4 in this example) that suggests a data issue rather than a PRE logic issue
- Enterprise is asking about timeline for canary advancement and the answer keeps slipping

**Mitigation:**
1. **Parity score threshold uses rolling 7-day window only.** The canary promotion readiness check is based on the rolling 7-day parity score, not cumulative. A corpus fix takes effect within 7 days.
2. **Divergence root cause analysis tooling.** The parity dashboard must show divergence breakdown by resolution level and by time period, not just a single score. If all divergences are concentrated in a 2-hour window each day (DST boundary), that's visible in the dashboard.
3. **Classification review workflow.** If the ENTERPRISE_ADMIN believes divergences are misclassified (e.g., classified as CLASS_2 when they should be CLASS_1 due to a corpus configuration issue), there is a review workflow to flag the divergence for Technical Lead assessment. This is not a way to lower the threshold — it's a way to identify corpus corrections needed.
4. **Pre-canary corpus health check.** Before enabling shadow mode for an enterprise, run a 24h dry-run comparison in staging with the enterprise's current corpus. If the staging dry-run parity score is below 0.999, diagnose before enabling shadow mode in production.

---

### RISK-07: Emergency Trigger Failure During Actual Incident

**Likelihood:** L **Impact:** H **Severity:** MEDIUM

**Failure scenario:** A VENUE_OPERATOR at a licensed alcohol venue triggers the emergency override due to a licensing compliance requirement (e.g., post-watershed content playing during a daytime event). The emergency API call is made. cms-api returns a 200. But the emergency signal is not delivered to the player via the WebSocket push channel because the WebSocket gateway is overloaded (a fleet-wide corpus update is in progress and the gateway is handling 1,000 simultaneous player connections). The operator sees "Emergency active" in cms-web but the screens continue displaying normal content for 2 minutes.

**Why this is not acceptable:** For compliance venues, a 2-minute delay in emergency content display may constitute a regulatory violation. The operator believes the emergency is active and is compliant — but the screens tell a different story.

**Early warning signals:**
- WebSocket gateway connection error rate elevated (metric alert at 5% connection error rate)
- Integration tests for emergency trigger in CI detect response time >500ms
- Stress test shows WebSocket gateway drops connections at >500 simultaneous clients

**Mitigation:**
1. **Two-confirmation UI.** The emergency console must display "Emergency is active on N/N screens" before the operator considers the action complete. The UI polls `GET /emergency/status/:venue_id` every 5 seconds until all screens have acknowledged the emergency (via their heartbeat or audit record). If any screen has not acknowledged within 30 seconds, the UI shows "ALERT: N screens have not confirmed emergency content."
2. **Long-poll fallback.** Player-runtime maintains both a WebSocket connection and a long-poll fallback (`GET /emergency/poll` with 60s timeout). If the WebSocket push fails, the long-poll picks up the emergency signal within 60 seconds. In the failure scenario above, the 2-minute delay becomes 60-second maximum.
3. **Emergency endpoint isolation.** The `GET /emergency/poll` endpoint must continue functioning even when the CMS is in READ_ONLY constitutional state. This is a constitutional requirement explicitly noted in the system contracts.
4. **Integration test for emergency trigger in CI.** The CI test suite must include: trigger emergency → verify player-runtime receives the signal → verify emergency content is displayed → clear emergency → verify normal content resumes. This test runs against a real player-runtime process (or a faithful simulation).
5. **Periodic drill exercises.** Production emergency drill quarterly: VENUE_OPERATOR triggers emergency on a non-public-facing screen, verifies it activates, clears it. Drill results logged.

---

### RISK-08: PLATFORM_ADMIN Unavailable During EMERGENCY_FREEZE

**Likelihood:** M **Impact:** H **Severity:** MEDIUM

**Failure scenario:** The GlobalConstitutionalBreaker transitions to EMERGENCY_FREEZE at 3 AM on a Saturday. The primary PLATFORM_ADMIN is on vacation. The secondary PLATFORM_ADMIN has not been onboarded to the on-call rotation and does not have their human authorization token (the token required to exit EMERGENCY_FREEZE). The constitutional freeze lasts until Monday when the primary PLATFORM_ADMIN returns.

**Consequences:** All venues are serving emergency content for 48+ hours. Normal operations are halted. If the freeze was triggered by a false positive (e.g., a transient replay nondeterminism error that does not represent an actual constitutional breach), the 48h freeze is entirely unnecessary.

**Early warning signals:**
- On-call rotation has fewer than 2 PLATFORM_ADMINs
- PLATFORM_ADMIN on-call rotation has not been reviewed in >30 days
- The human authorization token for EMERGENCY_FREEZE exit has not been tested in staging in >90 days

**Mitigation:**
1. **Minimum 2 PLATFORM_ADMINs at all times.** The role assignment system should alert (not block — but alert) when only 1 active PLATFORM_ADMIN exists. Wave 7 includes an on-call rotation as a first-class system entity.
2. **Human authorization token distribution.** The EMERGENCY_FREEZE exit token is not a single shared secret — each PLATFORM_ADMIN has their own named token registered in the system. Token registration is done out-of-band (not in the system itself) and stored securely by the individual. Token registration is verified in staging quarterly.
3. **On-call rotation documentation.** The on-call rotation must specify: who is primary, who is secondary, how to reach both, and what the SLA is for responding to a constitutional freeze (target: <30 minutes at any hour). This documentation is maintained as a first-class operational document, reviewed monthly.
4. **EMERGENCY_FREEZE false positive protocol.** If the freeze is triggered by an automated circuit breaker (not a human action), the PLATFORM_ADMIN on-call has authority to exit the freeze after verifying the triggering condition has resolved, without waiting for a full post-incident review. The post-incident review happens afterwards.

---

### RISK-09: Replay Nondeterminism Under Clock Skew

**Likelihood:** M **Impact:** M **Severity:** MEDIUM

**Failure scenario:** A Pi's system clock drifts forward by 15 minutes (NTP misconfigured). When PRE.resolve() is called at 11:45 PM venue local time, the Pi's clock shows 12:00 AM — past midnight, into the next day. The schedule resolver (level2-scheduled.ts) uses the Pi's local clock for `days_of_week` evaluation. Content that should not play on this day of week begins playing. The audit record shows resolution at 12:00 AM Thursday (Pi's clock) but the cloud replay audit shows the invocation was received at 11:45 PM Wednesday. The `full-stack-determinism.ts` script detects a timestamp mismatch between player and cloud.

**Consequences:** Audit chain integrity check fails for the venue (timestamp ordering anomaly). The divergence appears as a CLASS_1 (deterministic divergence) in parity records, which can block canary advancement.

**Early warning signals:**
- `full-stack-determinism.ts` fails for a specific screen with timestamp-related divergence
- Player-runtime audit record timestamps are consistently ahead of or behind cloud-received timestamps by a fixed offset
- Screen heartbeat `last_seen_at` is consistently inconsistent with the clock on the CMS server

**Mitigation:**
1. **NTP enforcement in Pi OS configuration.** Player-runtime startup script must verify that NTP synchronization is active (`timedatectl status | grep "NTP synchronized: yes"`). If NTP is not synchronized, log a CRITICAL entropy event and continue with cached time (do not halt — halting is worse).
2. **Clock skew metric.** Player-runtime emits a clock skew metric (difference between player UTC time and the timestamp returned by `GET /corpus/version` response header, which is server time). If skew > 5 minutes, emit a WARNING entropy event. If skew > 15 minutes, emit a CRITICAL entropy event.
3. **Grace window in schedule resolution.** The schedule resolver should have a ±1 minute grace window at day boundaries to prevent DOW mismatches due to small clock offsets.

---

## LOW RISKS

### RISK-10: Sponsor Proof-of-Play Data Format Disputes

**Likelihood:** H **Impact:** L **Severity:** LOW

**Failure scenario:** A sponsor receives a proof-of-play CSV report and disputes the format. They want impression counts, not invocation counts. They want campaign-level aggregation, not screen-zone-level. They want a PDF with their logo. The current report format does not match their media agency's reporting template.

**Why the impact is low:** The audit records are immutable and complete — the data exists. The dispute is about the export format, not the underlying data. Adding new export formats does not require touching the audit chain or any constitutional guarantee.

**Mitigation:** Design the proof-of-play export layer as a separate service from audit storage. The audit records are the authoritative data; the export layer transforms them into whatever format sponsors request. New export formats are additive — they do not modify audit records. Wave 6 ships one default export format (CSV by sponsorship contract + date range). Additional formats can be added on demand without a constitutional review.

---

### RISK-11: Multi-Region Requirement Before Wave 7

**Likelihood:** M **Impact:** M **Severity:** LOW (manageable with early design)

**Failure scenario:** A large EU hotel group signs up in Wave 4. Their data processing agreement requires all guest-associated data to be stored in the EU. The current system is single-region (e.g., us-east-1). The `venue.gdpr_region` flag exists in the schema but the data residency enforcement is not implemented.

**Why the impact is manageable:** The `gdpr_region` boolean flag in the `venues` table was added specifically to support future regional partitioning. The enterprise_group_id prefix-based partitioning strategy is documented in DATABASE-ROLLOUT-PLAN.md. No data has been mixed in a way that requires migration — the EU enterprise's data was stored in a separate partition from the start.

**Mitigation:**
1. **GDPR region flag is mandatory from day 1.** The `venues.gdpr_region` field is in the Wave 1 schema. Set it correctly during venue provisioning. Never allow it to be changed after audit records have been written for a venue.
2. **Data residency advisory in enterprise onboarding.** The enterprise onboarding checklist (Wave 7) must include: "Does this enterprise have GDPR or data residency requirements? If yes, multi-region infrastructure is required before onboarding."
3. **If multi-region is required before Wave 7:** The DevOps engineer can stand up a second PostgreSQL instance in the EU region and direct EU enterprise traffic to it. This is operational complexity but not architectural complexity — the application code is region-agnostic because all multi-tenancy is enterprise_group_id scoped.

---

### RISK-12: Chromium Kiosk Memory Leak on Long-Running Pi

**Likelihood:** H **Impact:** L **Severity:** LOW

**Failure scenario:** Chromium on Pi accumulates memory over 7–14 days of continuous operation. The player-ui React app re-renders the playlist on each content change (every 30–60 seconds). Over 14 days, Chromium's heap grows from ~150MB to ~800MB, triggering the Pi's OOM killer, which kills Chromium. The kiosk launcher script restarts Chromium. The player-ui reconnects to player-runtime's local WebSocket. Normal operation resumes within 30 seconds.

**Why the impact is low:** The systemd unit file auto-restarts the kiosk script on exit. The player-runtime process is unaffected. Audit records for the 30-second restart window show no PRE invocations (player-runtime pauses resolution when player-ui is not connected). The gap is visible in the audit chain but is not a constitutional violation — it is a hardware limitation.

**Mitigation:**
1. **Scheduled nightly restart.** Add a systemd timer to restart Chromium at 3 AM venue local time daily. This clears Chromium's heap before it becomes a problem and has no visible effect on venues (screens are off or showing overnight content during this window).
2. **player-ui memory profiling.** Run Chrome DevTools memory profiling on the player-ui after 24h of continuous operation. Identify any React component memory leaks (unstale useEffect subscriptions, closures holding stale state). Fix before production deployment.
3. **Monitoring.** Emit a Pi memory utilization metric every 5 minutes (available from `/proc/meminfo`). Alert at 80% utilization.

---

## Risk Register Summary

| Risk | Likelihood | Impact | Severity | Primary mitigation |
|---|---|---|---|---|
| RISK-01: PRE isolation violation | L | H | CRITICAL | constitutional-boundary-check.ts in CI on every PR |
| RISK-02: Corpus corruption on apply | M | H | CRITICAL | Atomic apply with checksum verification |
| RISK-03: Audit loss during extended offline | M | H | CRITICAL | 70% buffer alert, GRADE_A venue 4G backup |
| RISK-04: Database migration failure | H | M | CRITICAL | Staging dry-run required, rollback scripts |
| RISK-05: Pi hardware supply chain | M | H | CRITICAL | Order Week 1 day 1, 5 units |
| RISK-06: Canary gate never clears | H | M | MEDIUM | 7-day rolling window, root cause tooling |
| RISK-07: Emergency trigger failure | L | H | MEDIUM | Two-confirmation UI, long-poll fallback |
| RISK-08: PLATFORM_ADMIN unavailable during freeze | M | H | MEDIUM | Min 2 PLATFORM_ADMINs, documented on-call |
| RISK-09: Replay nondeterminism under clock skew | M | M | MEDIUM | NTP enforcement, clock skew metric |
| RISK-10: Proof-of-play format disputes | H | L | LOW | Separate export layer, additive formats |
| RISK-11: Multi-region before Wave 7 | M | M | LOW | gdpr_region flag from Wave 1, regional advisory |
| RISK-12: Chromium memory leak | H | L | LOW | Scheduled nightly restart, memory monitoring |
