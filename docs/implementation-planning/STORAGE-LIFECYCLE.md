# STORAGE-LIFECYCLE.md

**Status:** Engineering-Ready
**Authority:** Implementation planning document. Defines complete data lifecycle for every entity class.
**Last updated:** 2026-05-26
**Depends on:** DATABASE-ROLLOUT-PLAN.md, AUDIT-RETENTION-POLICY.md

---

## Overview

This document defines what happens to every record type from birth to death (or permanent preservation). Each section follows the same structure:

1. Creation event
2. Mutation policy
3. Soft-delete policy
4. Hard-delete policy
5. Archival trigger
6. Cold storage target
7. Retrieval SLA from cold storage
8. Cross-reference dependencies that prevent deletion

The overriding principle: **no record referenced by an active replay audit record may be deleted or made inaccessible.** This constraint propagates through all entity types.

---

## 1. Replay Audit Records

### Creation
Written by `ReplayAuditWriter` (src/audit/replay-audit-writer.ts) after every `PRE.resolve()` invocation. One record per screen per invocation. Expected volume: ~2,160 records/screen/day at 30-second resolve intervals over an 18-hour operating window.

### Mutation Policy
**IMMUTABLE.** The `record_checksum` (fnv1a32 of all fields except itself) detects any post-write modification. PostgreSQL trigger `replay_audit_no_update` throws unconditionally on any UPDATE attempt. No application path exists to modify a written record.

### Soft-Delete Policy
**NONE.** Soft-delete is not applicable. Records cannot be hidden from audit queries.

### Hard-Delete Policy
**FORBIDDEN.** PostgreSQL trigger `replay_audit_no_delete` throws unconditionally on any DELETE attempt. There is no code path — emergency or otherwise — that hard-deletes a replay audit record.

Exception for compliance venues: this prohibition extends to 7 years minimum. Even after 7 years, deletion requires PLATFORM_ADMIN authorization with a written rationale stored in `constitutional_freeze_log`.

### Archival Trigger
- **HOT → WARM transition:** 90 days after `created_at`. The monthly partition containing records older than 90 days is detached from the live table (`ALTER TABLE replay_audit_records DETACH PARTITION replay_audit_records_YYYY_MM`). The detached partition remains in PostgreSQL but is moved to a lower-cost tablespace (or exported to S3 + queried via Athena).
- **WARM → COLD transition:** 365 days after `created_at`. The partition is exported via `pg_dump --format=custom --compress=9`, uploaded to S3 Glacier, and dropped from PostgreSQL.
- **COLD → PERMANENT exception:** Records from `LICENSED_GAMING` or `LICENSED_ALCOHOL` venues move to a COLD storage bucket tagged with a 7-year lifecycle policy. No automatic deletion — requires human action at year 7.

### Cold Storage Target
- S3 Glacier Instant Retrieval: years 1–3
- S3 Glacier Deep Archive: years 3–7

### Retrieval SLA from Cold Storage
- Glacier Instant Retrieval: milliseconds (immediate)
- Glacier Deep Archive: up to 12 hours (bulk retrieval), up to 48 hours for retrieval within 5-hour window

### Cross-Reference Dependencies
A replay audit record MUST remain accessible for as long as:
- Any `parity_record` references it via `replay_reference`
- Any proof-of-play report includes it in its time range
- The `venue_id` has an active or pending regulatory inquiry

---

## 2. Constitutional Freeze Log Entries

### Creation
Written when the constitutional runtime triggers a freeze event (CLASS_4 divergence, INVARIANT_VIOLATION, operator-initiated freeze). One record per event.

### Mutation Policy
**IMMUTABLE.** PostgreSQL triggers `constitutional_freeze_no_update` and `constitutional_freeze_no_delete` throw unconditionally.

### Soft-Delete Policy
**NONE.**

### Hard-Delete Policy
**FORBIDDEN unconditionally.** No exception. No PLATFORM_ADMIN override. These records are the authoritative history of constitutional state transitions.

### Archival Trigger
**NONE.** These records are PERMANENT. They stay in the `constitutional_freeze_log` PostgreSQL table. They are never exported to S3. They are never archived. The table is expected to remain small (hundreds of rows per enterprise per year at most) and does not require archival to manage size.

### Cold Storage Target
N/A — remains in hot PostgreSQL storage permanently.

### Retrieval SLA
Immediate — always in hot storage.

### Cross-Reference Dependencies
N/A — these records are the terminal point; nothing else depends on them being present, but they cannot be removed regardless.

---

## 3. Corpus Versions

### Creation
Written by the corpus management system when an operator publishes a new PRE input corpus. Each write is immutable at creation. `corpus_version_id` is the stable reference used by `replay_audit_records` (indirectly — via `corpus_deployment_id` and the `pre_output_hash` computed from the corpus state at invocation time).

### Mutation Policy
**IMMUTABLE.** The `corpus_checksum` (fnv1a32 of canonical corpus JSON) detects tampering. PostgreSQL trigger `corpus_versions_no_delete` throws unconditionally. No UPDATE trigger is needed — the application never writes UPDATE statements to this table.

### Soft-Delete Policy
**NONE.** Corpus versions cannot be hidden.

### Hard-Delete Policy
**FORBIDDEN unconditionally.** Even if all audit records that reference a corpus version have expired, the corpus version metadata (row in `corpus_versions`) must remain. This is because:
- The `pre_output_hash` in audit records is derived from the corpus state at invocation time. The corpus version row is the only way to reconstruct what the system "knew" at that moment.
- Regulatory inquiries may require producing the corpus state in effect at a specific time.

**After all audit records referencing this corpus version have been archived to cold storage:** The `corpus_json` JSONB column may be nulled out (replaced with a placeholder `{"archived": true, "archive_uri": "s3://..."}`). The row itself remains. The corpus JSON is accessible from the cold storage URI.

### Archival Trigger
- **Binary package archival:** When no active `corpus_deployment` references the corpus version, the binary corpus package (stored in S3 Standard) moves to S3 Glacier after 90 days of no active reference.
- **Metadata archival:** Never — the row remains in PostgreSQL permanently.

### Cold Storage Target
- Corpus binary packages: S3 Glacier (same lifecycle as related audit partitions)
- Corpus metadata row: Stays in PostgreSQL. No cold storage.

### Retrieval SLA from Cold Storage
- Corpus binary from Glacier: up to 12 hours (bulk retrieval)
- For regulatory retrieval SLAs, use Glacier Instant Retrieval tier for corpus packages

### Cross-Reference Dependencies
A corpus version CANNOT have its row deleted as long as:
- Any `corpus_deployment` references it (active or historical)
- Any `replay_audit_record` was produced during a period when this corpus was the active deployment (correlation by timestamp and deployment_group)

---

## 4. Content Assets

### Creation
Uploaded by operators via the content management system. Stored in S3 Standard with a CloudFront CDN distribution. Row written to `content_assets`.

### Mutation Policy
**Metadata:** Freely mutable (name, cdn_url, is_active). **Content file (S3 object):** Immutable once uploaded — content-addressable by `checksum_sha256`. A new version of content is a new asset with a new `content_asset_id`.

### Soft-Delete Policy
`deleted_at` set on `content_assets` row. Asset becomes invisible to PRE resolution but remains in storage. CDN cache expires naturally (TTL).

### Hard-Delete Policy
**FORBIDDEN** if:
- Any active `replay_audit_record` references this `content_asset_id` in the corpus used at invocation time (determined by tracing: `replay_audit_records.correlation_id` → `corpus_version` → `corpus_json` containing `content_id`)
- Any active `campaign`, `schedule`, `override`, or `sponsorship` references it (FK constraint)
- The asset is within the compliance retention window for its venue

**PERMITTED** after:
- All referencing audit records have aged out of cold storage (beyond compliance retention window)
- All campaign/schedule/override/sponsorship references are deleted or soft-deleted
- PLATFORM_ADMIN authorization recorded in `constitutional_freeze_log`

### Archival Trigger
| State | Trigger | Action |
|---|---|---|
| Active, referenced by campaign | N/A | CDN hot storage |
| No campaign reference, within 90 days | `deleted_at` set | Move from CDN to S3 Standard warm |
| 90+ days, no campaign reference | Age-based job | Move to S3 Glacier |
| Referenced by active audit records | N/A | Cannot delete from any tier |

### Cold Storage Target
- S3 Standard (warm): up to 90 days after last campaign reference
- S3 Glacier Instant Retrieval: 90 days to 3 years
- S3 Glacier Deep Archive: 3+ years (compliance venue assets follow venue's retention tier)

### Retrieval SLA from Cold Storage
- S3 Glacier Instant: milliseconds
- S3 Glacier Deep Archive: up to 48 hours

### Cross-Reference Dependencies
- Active `campaigns`, `schedules`, `overrides`, `sponsorships`
- Historical `corpus_versions` that included this asset in `corpus_json`
- Any `replay_audit_record` produced during an active deployment that included this asset

---

## 5. Parity Records

### Creation
Written by the shadow comparison subsystem (src/shadow/) after each shadow execution comparison. One record per `ShadowInvocation`. Only generated during active canary rollout periods (when a deployment group is in SHADOW_ONLY through FLEET_WIDE stage).

### Mutation Policy
**IMMUTABLE.** The `deterministic_checksum` (fnv1a32 of canonical record minus the checksum field) detects tampering. PostgreSQL triggers enforce no DELETE, no UPDATE.

### Soft-Delete Policy
**NONE.**

### Hard-Delete Policy
**FORBIDDEN.** Same prohibition as replay audit records.

### Archival Trigger
Parity records follow the same retention tiers as the replay audit records they reference:
- HOT: 0–90 days in PostgreSQL (partitioned monthly, same as `replay_audit_records`)
- WARM: 91–365 days (detached partition, exported to S3 or queried via Athena)
- COLD: 1–7 years in S3 Glacier, matching the compliance tier of the venue of the screen that was shadowed

### Cold Storage Target
- Same S3 buckets and Glacier tiers as replay audit records (co-locate by month for retrieval efficiency)

### Retrieval SLA from Cold Storage
Same as replay audit records — parity records are retrieved together with audit records during regulatory inquiries.

### Cross-Reference Dependencies
- The `replay_reference` field points to the `invocation_id` of the associated replay audit record. A parity record MUST remain accessible as long as its referenced audit record is accessible (and vice versa — the audit record references the parity record's `divergence_class`).

---

## 6. Entropy Reports and Acknowledgments

### Creation
Written by the entropy subsystem (src/entropy/) after each venue-level or fleet-level entropy evaluation. One report per evaluation window per venue. Frequency: configurable per entropy severity — CRITICAL venues evaluated every 5 minutes, HEALTHY venues every hour.

### Mutation Policy
**Mostly immutable.** The only permitted mutation is setting `acknowledgment_at` from NULL to a non-NULL value (one-way transition enforced by trigger `entropy_reports_constrained_update`). All other fields are immutable after write.

`entropy_acknowledgments` rows are fully immutable (append-only triggers).

### Soft-Delete Policy
**NONE.**

### Hard-Delete Policy
**FORBIDDEN.** Entropy reports are part of the operational audit trail. They document the system's entropy state at specific points in time. Deletion would create gaps in the entropy history used for compliance and incident reconstruction.

Exception: ADVISORY-severity entropy reports older than 365 days may be archived to cold storage and removed from hot PostgreSQL (they have no compliance value at that age). This requires PLATFORM_ADMIN authorization.

### Archival Trigger
- HOT: 0–90 days in PostgreSQL
- WARM: 91–365 days (exported to S3, queryable via Athena for retrospective analysis)
- COLD: 365+ days in S3 Glacier (ADVISORY severity only)
- WARNING and CRITICAL severity reports follow the same retention tier as the venue's audit records (up to 7 years for licensed venues)

### Cold Storage Target
- S3 Standard warm: 91–365 days
- S3 Glacier: 365 days to compliance limit

### Retrieval SLA from Cold Storage
- 91–365 days: S3 Standard, immediate
- 365+ days: S3 Glacier, up to 12 hours

### Cross-Reference Dependencies
- `entropy_acknowledgments` rows reference `entropy_report_id` — must remain accessible while the report is accessible
- Venue entropy history is referenced by incident reconstruction workflows — reports must remain accessible for the same period as venue audit records

---

## 7. Canary Stage History

### Creation
Written by the canary governance subsystem (src/shadow/canary/) on every stage transition event — PROMOTE, ROLLBACK, or RESET. One record per transition.

### Mutation Policy
**IMMUTABLE.** Append-only triggers enforce no DELETE, no UPDATE.

### Soft-Delete Policy
**NONE.**

### Hard-Delete Policy
**FORBIDDEN.** Canary transitions — especially AUTHORITATIVE promotion events — are constitutional events. They document when PRE became the production authority. This history must be permanently available.

AUTHORITATIVE promotion events are additionally tagged `is_authoritative_promotion = true` and should be treated as PERMANENT records (same category as constitutional freeze log).

### Archival Trigger
- HOT: 0–365 days in PostgreSQL (low volume — at most a few dozen rows per enterprise per year)
- COLD: After 365 days, export to S3 Glacier for long-term retention
- AUTHORITATIVE promotion events: PERMANENT — never move to cold storage or delete

### Cold Storage Target
- S3 Glacier for non-authoritative events after 365 days
- S3 Glacier + cross-region replication for AUTHORITATIVE events (permanent)

### Retrieval SLA
- HOT: immediate
- COLD (Glacier): up to 12 hours

### Cross-Reference Dependencies
- Referenced by `constitutional_state` (current canary_stage)
- Referenced by incident reconstruction and proof-of-parity workflows

---

## 8. Organization, Venue, and Screen Records

### Creation
Created by PLATFORM_ADMIN (enterprise_groups), enterprise operators (venues, screen_zones), or automated provisioning (screens).

### Mutation Policy
**Freely mutable** for operational fields (name, status, timezone, metadata_json, last_seen_at). **Immutable** primary keys — no record may have its ID changed.

### Soft-Delete Policy
- **Screens:** `deleted_at` set on decommission. Screen disappears from active queries but row is retained.
- **Venues:** `deleted_at` set on closure. Venue disappears from active queries.
- **Enterprise groups:** `deleted_at` set on contract termination.

### Hard-Delete Policy
**FORBIDDEN** if any `replay_audit_record` references the `venue_id` or `screen_id`. Because replay audit records are retained for up to 7 years, a venue or screen that has been operational cannot be hard-deleted for up to 7 years after its last audit record.

After the compliance retention window has expired for all associated audit records: PLATFORM_ADMIN may authorize hard-delete. This authorization must be recorded in `constitutional_freeze_log`.

### GDPR Application
Venue and screen records contain no personal data. They are operational records and are excluded from GDPR erasure requests under the "legal obligation" basis (regulators require audit trails that reference these identifiers).

### Archival Trigger
No archival — these rows are small and remain in PostgreSQL indefinitely (even soft-deleted rows are retained until the audit retention window expires).

### Cross-Reference Dependencies
- `venues`: referenced by `replay_audit_records`, `campaigns`, `overrides`, `entropy_reports`, `corpus_deployments`
- `screens`: referenced by `replay_audit_records`, `parity_records`, `deployment_group_screens`, `schedules`

---

## 9. Principal and Session Records

### Creation
Principals created during user onboarding or service account provisioning. Sessions created at authentication.

### Mutation Policy
- **Principal:** Freely mutable for operational fields (email, display_name, status). `principal_id` is immutable.
- **Session:** Immutable after creation. Revocation sets `revoked_at` only.

### Soft-Delete Policy
- **Principal:** `deleted_at` set on offboarding. Account becomes inaccessible.
- **Session:** `revoked_at` set on logout or forced revocation.

### Hard-Delete Policy
**Principal:** FORBIDDEN if the `principal_id` appears in any audit record (`replay_audit_records`, `canary_stage_history.approved_by`, `entropy_acknowledgments.acknowledged_by`, `overrides.issued_by`, etc.).

**Session:** Hard-delete permitted after `expires_at` + 90 days (no compliance value for expired sessions). Running a background job is the correct mechanism, not application-layer deletion.

### GDPR Erasure
**Personal data (email, display_name):** Erasable on GDPR Subject Access Request (SAR). The erasure procedure:
1. Zero `email` field (set to NULL)
2. Zero `display_name` field (set to NULL or `"[ANONYMIZED]"`)
3. Set `gdpr_anonymized_at = now()`
4. Record the erasure event in `constitutional_freeze_log` (who requested, who approved, which `principal_id`)

The `principal_id` UUID is **retained** as an opaque reference in all audit records. The UUID has no personal data — it is an identifier, not a name, email, or biometric. GDPR regulators accept this approach under Recital 26 (anonymized data) combined with the legal obligation basis for retaining audit records.

**Session data:** `ip_address` and `user_agent` are erasable via the same anonymization procedure applied to sessions belonging to the anonymized principal.

### Archival Trigger
- Active principal records: HOT indefinitely (small table)
- Expired sessions (past `expires_at`): delete after 90 days
- Revoked sessions: delete after 365 days

### Cold Storage Target
None — session data does not go to cold storage.

### Cross-Reference Dependencies
- `principal_id` referenced by: `role_assignments.principal_id`, `canary_stage_history.approved_by`, `entropy_acknowledgments.acknowledged_by`, `overrides.issued_by`, `corpus_versions.created_by`, `corpus_deployments.deployed_by`
- These references must remain valid even after anonymization (the UUID stays; only personal fields are erased)

---

## 10. Role Assignments

### Creation
Created when a principal is granted a role at a specific scope. Append-only after creation — role changes are new rows (with the previous row revoked).

### Mutation Policy
**Immutable** for all fields except `revoked_at`. Role changes create new rows — no in-place update of scope or role_type.

### Soft-Delete Policy
`revoked_at` set when a role is withdrawn.

### Hard-Delete Policy
**FORBIDDEN.** Role assignments are an authorization audit trail. They document who had what permissions at what time — required for incident investigation and regulatory inquiries.

### Archival Trigger
- HOT: indefinitely (low volume, small rows)
- No cold storage required

### Cross-Reference Dependencies
- `principal_id`: subject to anonymization rules (role assignment row retained; name of principal is in `principals.display_name`, not here)

---

## Dependency Graph Summary

The following deletion order respects all cross-references (bottom-up — can only delete after all things that depend on it are deleted):

```
constitutional_freeze_log    [PERMANENT — never deletable]
replay_audit_records         [FORBIDDEN delete — 7yr compliance minimum]
parity_records               [FORBIDDEN delete — follows audit records]
canary_stage_history         [FORBIDDEN delete — AUTHORITATIVE events permanent]
entropy_reports              [FORBIDDEN delete — ADVISORY archivable after 365d]
entropy_acknowledgments      [FORBIDDEN delete]
corpus_versions              [FORBIDDEN delete — row retained; JSON archivable]
content_assets               [SOFT-DELETE; hard-delete only after audit window]
campaigns / schedules /      [SOFT-DELETE; hard-delete allowed when no audit refs]
  overrides / sponsorships
screens                      [SOFT-DELETE; hard-delete only after audit window]
screen_zones                 [SOFT-DELETE; hard-delete only after screens deleted]
venues                       [SOFT-DELETE; hard-delete only after audit window]
deployment_groups            [SOFT-DELETE]
corpus_deployments           [APPEND-ONLY — no delete]
principals                   [SOFT-DELETE; anonymize for GDPR; no hard-delete if in audit]
role_assignments             [SOFT-DELETE via revoked_at; no hard-delete]
sessions                     [Hard-delete after expires_at + 90d]
enterprise_groups            [SOFT-DELETE; hard-delete only after all venues deleted]
```
