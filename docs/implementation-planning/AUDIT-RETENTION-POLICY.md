# AUDIT-RETENTION-POLICY.md

**Status:** Engineering-Ready
**Authority:** Implementation planning document. Legal and operational rationale for all retention decisions.
**Last updated:** 2026-05-26
**Depends on:** DATABASE-ROLLOUT-PLAN.md, STORAGE-LIFECYCLE.md, EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7

---

## 1. Retention Tier Summary

| Tier | Age Range | Storage | Query SLA | Who Can Access |
|---|---|---|---|---|
| HOT | 0–90 days | PostgreSQL (indexed, partitioned) | <100ms p95 | VENUE_MANAGER+, AUDITOR+, proof-of-play systems |
| WARM | 91–365 days | PostgreSQL detached partition OR S3 + Athena | <5s | ENTERPRISE_ADMIN+, AUDITOR+, on-request queries |
| COLD | 1–7 years | S3 Glacier Instant (1–3yr) / Deep Archive (3–7yr) | <12h (Instant) / <48h (Deep) | PLATFORM_ADMIN, legal counsel, regulatory bodies |
| PERMANENT | Forever | S3 Glacier + cross-region replication + offsite tape | Best-effort retrieval | PLATFORM_ADMIN only; court order may compel disclosure |

**Definitions:**
- AUDITOR: a principal with the `AUDITOR` role at any scope (enterprise or venue)
- ENTERPRISE_ADMIN: principal with admin role at enterprise_group scope
- PLATFORM_ADMIN: system-level administrator (bypasses RLS, accesses all tenants)

---

## 2. Record Categories and Their Retention Class

### 2.1 PERMANENT Retention Records

The following record types carry PERMANENT retention — they are never purged, never archived to cold storage (they remain in hot PostgreSQL), and never deleted under any circumstances:

**ConstitutionalFreezeLog entries** (`constitutional_freeze_log` table)
- Rationale: These document constitutional state transitions — the most severe operational events in the system. They are the system's institutional memory. If a CLASS_4 divergence occurred, the freeze log entry is the authoritative record that it happened, who authorized the freeze, and what state the system was in. Losing this record would make it impossible to defend decisions made during constitutional events.

**Canary AUTHORITATIVE promotion events** (`canary_stage_history` rows where `is_authoritative_promotion = true`)
- Rationale: The AUTHORITATIVE promotion event documents the moment PRE became the production scheduling authority. This is a one-time irreversible constitutional event per enterprise. It must be available for the lifetime of the platform.

**Constitutional state transition events** (CLASS_4 events in `canary_stage_history` and `constitutional_freeze_log`)
- Rationale: CLASS_4 divergences are constitutional violations. Any regulatory inquiry about system behavior during a CLASS_4 event will require this record.

**GDPR anonymization events** (`constitutional_freeze_log` entries where `freeze_type = 'GDPR_ERASURE'`)
- Rationale: The erasure itself must be recorded permanently. Paradoxically, the record that personal data was erased cannot be erased.

**Any record explicitly marked `permanent: true` by PLATFORM_ADMIN** via a constitutional freeze log entry authorizing the designation.

---

### 2.2 EXTENDED Retention Records (7 Years)

The following venues trigger 7-year minimum retention on ALL their replay audit records, parity records, and entropy reports:

**Venues with `compliance_tier = 'LICENSED_GAMING'`**
- Legal basis: Gaming commissions (e.g. UK Gambling Commission, Malta Gaming Authority, Nevada Gaming Control Board) require operators to maintain records proving content displayed complied with responsible gambling requirements. This includes proof that LEVEL_0 emergency content (responsible gambling messages) was displayed at required intervals.
- Audit content required: `resolution_level`, `is_fallback`, `playlist_checksum`, and the full corpus state at invocation time. All carried in `replay_audit_records` + `corpus_versions`.

**Venues with `compliance_tier = 'LICENSED_ALCOHOL'`**
- Legal basis: Some jurisdictions' liquor licensing authorities require proof that age verification messaging was displayed. The 7-year window aligns with typical statute of limitations for licensing violations.

**Responsible gambling compliance audit trail**
- Venues in any compliance tier that display responsible gambling content: minimum 7-year retention on records where `resolution_level = 0` (Level 0 emergency — responsible gambling overrides).

**Implementation note for compliance venues:** The `venue_id` carries the `compliance_tier` field. The archival pipeline reads `compliance_tier` from the venue record when deciding which S3 lifecycle tier to apply to an outgoing partition export. LICENSED_GAMING and LICENSED_ALCOHOL venues use a separate S3 bucket prefix (`s3://clubhub-audit-cold/compliance/`) with a 7-year lifecycle policy and versioning enabled.

---

### 2.3 STANDARD Retention Records (365 Days)

These records are retained for one year in queryable storage (HOT + WARM), then archived to cold storage, then deleted (or retained if referenced by compliance-tier records).

- All `replay_audit_records` from venues with `compliance_tier = 'STANDARD'`
- All `parity_records` (shadow comparison results)
- All `entropy_reports` at WARNING or CRITICAL severity
- All `entropy_acknowledgments`
- All non-authoritative `canary_stage_history` rows
- Sponsorship proof-of-play summaries (generated reports, not raw records)

---

### 2.4 SHORT Retention Records (90 Days Queryable)

These records are retained at HOT storage only. After 90 days they can be archived to warm or deleted, depending on whether they have compliance dependencies.

- Preview session records (generated by the preview explainability subsystem)
- Screen heartbeat logs (Redis TTL-based; PostgreSQL backup only for compliance venues)
- Routine operational metrics (Prometheus/Grafana scrapes — not in PostgreSQL)
- ADVISORY-severity entropy reports (may be archived after 90 days and deleted after 365 days if no regulatory relevance)
- Session records: expired sessions deleted after 90 days from expiry

---

## 3. Retention Enforcement Matrix

| Record Type | STANDARD Venue | LICENSED_ALCOHOL Venue | LICENSED_GAMING Venue |
|---|---|---|---|
| replay_audit_records | 365 days | 7 years | 7 years |
| parity_records | 365 days | 7 years (if same screen) | 7 years (if same screen) |
| entropy_reports | 365 days (WARNING/CRITICAL) | 7 years | 7 years |
| constitutional_freeze_log | PERMANENT | PERMANENT | PERMANENT |
| canary_stage_history | 365 days | 365 days | 365 days |
| canary AUTHORITATIVE event | PERMANENT | PERMANENT | PERMANENT |
| corpus_versions (row) | PERMANENT | PERMANENT | PERMANENT |
| corpus_versions (JSON body) | Archive at 365 days | Archive at 7 years | Archive at 7 years |
| content_assets (file) | 90 days post-last-ref | 7 years if in audit | 7 years if in audit |
| principal records | Soft-delete on offboard | Same | Same |
| GDPR anonymization event | PERMANENT | PERMANENT | PERMANENT |

---

## 4. GDPR and Data Deletion

### 4.1 What Is Erasable

**Personal data in principal records:**
- `principals.email`: erasable
- `principals.display_name`: erasable
- `sessions.ip_address`: erasable
- `sessions.user_agent`: erasable

**GDPR erasure procedure:**
1. Principal submits a Subject Access Request (SAR) to the enterprise's designated data controller
2. Enterprise data controller validates the request (identity verification)
3. PLATFORM_ADMIN or ENTERPRISE_ADMIN executes the anonymization script:
   ```sql
   UPDATE principals
   SET email = NULL,
       display_name = '[ANONYMIZED]',
       gdpr_anonymized_at = now()
   WHERE principal_id = :principal_id;
   ```
4. Session personal data anonymized:
   ```sql
   UPDATE sessions
   SET ip_address = NULL,
       user_agent = NULL
   WHERE principal_id = :principal_id;
   ```
5. Anonymization event recorded in `constitutional_freeze_log`:
   ```json
   {
     "freeze_type": "GDPR_ERASURE",
     "principal_id": "<uuid>",
     "enterprise_group_id": "<uuid>",
     "reason": "GDPR Article 17 erasure request",
     "approved_by": "<admin_principal_id>",
     "timestamp": "<iso8601>"
   }
   ```

### 4.2 What Is NOT Erasable

**Audit records that reference `principal_id`:**
The `principal_id` UUID in audit records CANNOT be erased. The UUID itself carries no personal data — it is not a name, email, or biometric. After erasure of personal fields in `principals`, the UUID becomes an opaque identifier. GDPR Recital 26 exempts anonymized data from its scope.

**Legal basis for retaining operational records:** Article 17(3)(b) exempts erasure when processing is necessary for "compliance with a legal obligation which requires processing by Union or Member State law to which the controller is subject." Audit records for licensed venues fall squarely within this exemption.

**Venue and screen records:** These contain no personal data. They are operational infrastructure records. Not subject to GDPR erasure.

### 4.3 Right to Erasure Boundary

The right to erasure (Article 17) stops at:
1. Personal data in principal records (erasable by anonymization)
2. Personal data in session records (erasable)

The right to erasure does NOT reach:
1. `principal_id` UUID references in audit records (legal obligation basis)
2. Venue/screen operational records (no personal data)
3. Constitutional freeze log (institutional record, not personal data)
4. Any record where deletion would compromise audit integrity

This boundary is the explicit engineering design choice. It is not an oversight.

---

## 5. Integrity Verification Schedule

### 5.1 Monthly: HOT Tier Chain Check

Run the audit chain integrity check for all active venues:
```
GET /replay/integrity/:venue_id?window=30d
```
This endpoint (defined in replay-audit-api) recomputes `record_checksum` for every record in the past 30 days and reports any mismatch.

**Expected result:** 0 corrupted records. Any mismatch is a CRITICAL alert.
**Who runs it:** Automated CI/CD pipeline. Result posted to the PLATFORM_ADMIN monitoring dashboard.
**Action on failure:** Immediately escalate to PLATFORM_ADMIN. Do not archive affected partition until investigation is complete. Record incident in `constitutional_freeze_log`.

### 5.2 Quarterly: WARM Tier Sample Verification

Sample 5% of WARM records (91–365 days old) from each venue and recompute their `record_checksum`.

**Process:**
1. Retrieve partition from S3 (or query detached partition)
2. Deserialize each sampled record
3. Recompute `fnv1a32(canonicalizeJson(record minus record_checksum))`
4. Compare with stored `record_checksum`
5. Report pass/fail count

**Expected result:** 100% pass rate on sampled records. Any failure triggers a full WARM tier scan for the affected partition.
**Who runs it:** PLATFORM_ADMIN via an operations script. Can be automated as a quarterly cron job.

### 5.3 Annually: PLATFORM_ADMIN Attestation

The PLATFORM_ADMIN (or designated Compliance Officer) signs an annual attestation confirming:
- The audit system has been operating continuously
- Monthly integrity checks have passed (or documented exceptions exist)
- Quarterly sample verifications have passed
- No unauthorized deletion or modification has been detected
- Retention policies are being enforced as documented here

This attestation is stored in `constitutional_freeze_log` with `freeze_type = 'ANNUAL_COMPLIANCE_ATTESTATION'`.

---

## 6. Export Procedures

### 6.1 Regulatory Export (Gaming/Alcohol Commission)

**Who can trigger:** PLATFORM_ADMIN only
**What it produces:** A cryptographically signed export package containing all replay audit records for a specified venue and time range, in NDJSON format with an integrity manifest.

**Export format:**
```
export-package/
  manifest.json          — SHA-256 of each file, record count, venue_id, time range, export timestamp, PLATFORM_ADMIN signature
  records.ndjson         — one JSON object per line, each a complete ReplayAuditRecord
  corpus-versions.ndjson — corpus versions active during the time range
  parity-records.ndjson  — parity records for the same time range (if any)
  integrity.json         — chain of record_checksums in order (verifiable without application code)
```

**Signature:** PLATFORM_ADMIN signs `manifest.json` using an RSA-4096 key stored in AWS KMS. The public key is available in the regulatory export metadata. The regulator can verify the signature without access to ClubHub systems.

**NDJSON rationale:** Regulators receive a file they can process with any standard tool (`jq`, Python, Excel via import). NDJSON does not require ClubHub-specific tooling to read. Each line is a self-contained JSON object — no parsing of a large JSON array required.

### 6.2 Sponsorship Proof-of-Play Export

**Who can trigger:** ENTERPRISE_ADMIN for their enterprise
**What it produces:** A summary report of content delivery for a specific sponsorship contract and time range.

**Export format:**
```
proof-of-play-report/
  summary.json           — total impressions, SOV achieved, time range, enterprise_id, sponsorship_id
  daily-breakdown.ndjson — one JSON per day: date, screen count, impression count, avg SOV
  audit-sample.ndjson    — 10% sample of underlying audit records (verifiable against summary)
  integrity.json         — SHA-256 of each file
```

**Signature:** ENTERPRISE_ADMIN signs with their enterprise's signing key (provisioned during onboarding).

### 6.3 On-Demand Principal Data Export (GDPR SAR)

**Who can trigger:** Principal (for their own data) or ENTERPRISE_ADMIN (for any principal in their enterprise)
**What it produces:** All data about the requesting principal — session history, role assignments, actions taken (overrides issued, acknowledgments made).

**Does NOT include:** Venue or screen data that the principal merely had access to. Their `principal_id` appears in audit records but the audit records themselves are not "their data" — they are system operational records.

---

## 7. Partition Archival Runbook

This is the step-by-step procedure for archiving a replay audit partition from HOT to COLD.

**Trigger:** A partition whose `FOR VALUES FROM` range is more than 365 days in the past.

**Steps:**
1. Verify the partition has no active queries: `pg_stat_activity` check
2. Export the partition: `pg_dump --table=replay_audit_records_YYYY_MM --format=custom --compress=9 -f /tmp/replay_audit_YYYY_MM.pgdump`
3. Verify export integrity: `pg_restore --list /tmp/replay_audit_YYYY_MM.pgdump | wc -l` (check expected row count)
4. Upload to S3: `aws s3 cp /tmp/replay_audit_YYYY_MM.pgdump s3://clubhub-audit-cold/year=YYYY/month=MM/replay_audit_records_YYYY_MM.pgdump`
5. Apply Glacier transition tag if compliance venue: `aws s3api put-object-tagging ...`
6. Verify S3 object checksum matches local file
7. Detach partition from PostgreSQL: `ALTER TABLE replay_audit_records DETACH PARTITION replay_audit_records_YYYY_MM`
8. Drop the detached partition (data is now in S3): `DROP TABLE replay_audit_records_YYYY_MM`
9. Record the archival event: INSERT into `constitutional_freeze_log` with `freeze_type = 'PARTITION_ARCHIVED'`

**Rollback:** If any step fails, the partition remains attached. Re-run from step 1. Do not drop the PostgreSQL partition until S3 upload is verified.

**Note:** The `constitutional_freeze_log` entry in step 9 is not strictly a "freeze" — but it provides a durable record that the partition was archived and when. This record cannot be deleted (PERMANENT).
