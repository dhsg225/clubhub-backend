# Data Ownership Map

**Document type:** Engineering implementation planning
**Status:** Actionable — defines write authority and migration ownership
**Authority:** ENGINEERING-CONSTITUTION-v1.md, EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7

---

## Ownership Definitions

**Owns:** Service has exclusive write authority. Only this service may INSERT, UPDATE, or DELETE records in this table (at the application layer). No other service accesses the table's database directly.

**Reads-only:** Service reads this data via the owning service's API. It does not have a database connection to the owning service's schema.

**Never-touches:** Service has no business reason to read or write this data. Any code path that does so is a constitutional violation.

---

## Service: player-runtime (Edge)

| Data entity | Owns | Reads-only | Never-touches |
|---|---|---|---|
| Local corpus store (on-device) | OWNS — manages atomic corpus replacement | — | — |
| Local audit ring buffer | OWNS — append-only local file | — | — |
| Local constitutional state (GlobalConstitutionalBreaker) | OWNS — in-memory singleton | — | — |
| Local entropy state (computed scores) | OWNS — in-memory, recomputed per cycle | — | — |
| Local canary stage | Reads from corpus (read-only) | — | — |
| Organizations, venues, screens, campaigns | Reads from corpus (read-only) | — | cms-api DB |
| Replay audit records (cloud) | Pushes via POST /audit/batch | — | replay-audit-api DB |
| Parity records (cloud) | Pushes via POST /parity/record during shadow mode | — | shadow-service DB |
| Entropy reports (cloud) | Pushes via POST /entropy/report | — | entropy-service DB |
| Canary stage state (cloud) | Reads from corpus | — | canary-service DB |

---

## Service: cms-api (Cloud)

| Data entity | Owns | Reads-only | Never-touches |
|---|---|---|---|
| organizations | OWNS | — | — |
| venues | OWNS | — | — |
| screens | OWNS | — | — |
| areas | OWNS | — | — |
| tv_groups | OWNS | — | — |
| campaigns | OWNS | — | — |
| content_items | OWNS | — | — |
| schedules | OWNS | — | — |
| overrides | OWNS | — | — |
| sponsorship_contracts | OWNS | — | — |
| templates | OWNS | — | — |
| deployment_groups | OWNS | — | — |
| emergency_records | OWNS | — | — |
| operator_users, roles, sessions | OWNS | — | — |
| corpus_versions (references only) | Reads metadata from corpus-publisher API | — | corpus-publisher DB |
| replay_audit_records | Summary counts via replay-audit-api API | — | replay-audit-api DB |
| entropy_snapshots | Alert summaries via entropy-service API | — | entropy-service DB |
| parity_records | — | — | shadow-service DB |
| canary_stage_state | Status display via canary-service API | — | canary-service DB |

---

## Service: replay-audit-api (Cloud)

| Data entity | Owns | Reads-only | Never-touches |
|---|---|---|---|
| replay_audit_records | OWNS — append-only | — | — |
| proof_of_play_reports | OWNS — generated artifacts | — | — |
| organizations, venues, screens | Reads from cms-api for scope validation | — | cms-api DB |
| corpus_versions | Reads from corpus-publisher for retention decisions | — | corpus-publisher DB |
| parity_records | — | — | shadow-service DB |

---

## Service: entropy-service (Cloud)

| Data entity | Owns | Reads-only | Never-touches |
|---|---|---|---|
| venue_entropy_snapshots | OWNS | — | — |
| fleet_entropy_snapshots | OWNS | — | — |
| entropy_reports_inbox | OWNS | — | — |
| entropy_alerts | OWNS | — | — |
| overrides, schedules, campaigns | — | — | cms-api DB |
| replay_audit_records | — | — | replay-audit-api DB |

Note: entropy-service computes scores from data pushed by player-runtime (corpus checksums, delivery log summaries). It does not read cms-api's database. The scores it computes reflect observed player behavior, not CMS configuration.

---

## Service: shadow-service (Cloud)

| Data entity | Owns | Reads-only | Never-touches |
|---|---|---|---|
| parity_records | OWNS — append-only | — | — |
| shadow_venue_config | OWNS | — | — |
| rollback_trigger_log | OWNS | — | — |
| replay_audit_records | — | — | replay-audit-api DB |
| campaigns, schedules | — | — | cms-api DB |

---

## Service: canary-service (Cloud)

| Data entity | Owns | Reads-only | Never-touches |
|---|---|---|---|
| canary_stage_state | OWNS | — | — |
| promotion_history | OWNS — append-only | — | — |
| rollback_log | OWNS — append-only | — | — |
| parity_records, parity_reports | Reads summaries from shadow-service API | — | shadow-service DB |
| replay_audit_records | — | — | replay-audit-api DB |

---

## Service: corpus-publisher (Cloud)

| Data entity | Owns | Reads-only | Never-touches |
|---|---|---|---|
| corpus_versions | OWNS | — | — |
| corpus_package_artifacts (CDN/object storage) | OWNS | — | — |
| campaigns, schedules, overrides (CMS data) | Reads from cms-api API for corpus assembly | — | cms-api DB |

---

## Data Sovereignty Classification

### Enterprise-scoped data
Data that belongs to a specific organization and must be isolated from other organizations. Row-level security enforced at the database level in cms-api.

- organizations (owners of their own record)
- venues, screens, areas, tv_groups
- campaigns, content_items, schedules, overrides, templates
- sponsorship_contracts
- deployment_groups
- emergency_records
- operator_users (scoped to org)
- corpus versions assigned to their deployment groups

Multi-tenant query pattern: every query in cms-api includes a mandatory `WHERE org_id = :caller_org_id` clause enforced by row-level security policy, not application code. Application code cannot accidentally leak cross-org data even with a buggy query.

### Platform-scoped data
Data that belongs to the platform operator (ClubHub), not to any specific enterprise customer. Access restricted to PLATFORM_ADMIN.

- constitutional_freeze_log (permanent retention — never deleted)
- GlobalConstitutionalBreaker state (in-memory in player-runtime; mirrored state in constitutional API)
- Platform-level circuit breaker history

### Player-scoped data (edge-to-cloud lifecycle)
Data that originates at the edge (on-device) and becomes cloud-scoped when synced.

- Local audit ring buffer → becomes replay_audit_records on sync
- Local entropy scores → become venue_entropy_snapshots on push
- Local parity comparison results → become parity_records on push (shadow mode only)

During the local buffering period, this data is player-scoped. After sync confirmation, it is cloud-scoped and immutable.

---

## Data That Can Never Be Deleted

These records must have `DELETE` revoked at the database level for the application user. They are only removable by a database administrator with explicit authorization.

### replay_audit_records
- Retention: permanent while referenced by any active downstream artifact
- Minimum retention: 7 years (proof-of-play contractual obligation)
- Condition for deletion consideration: only after all proof_of_play_reports referencing these records have been delivered and acknowledged by sponsors, AND the retention period has elapsed
- DB enforcement: `REVOKE DELETE ON replay_audit_records FROM cms_app_user`

### constitutional_freeze_log
- Retention: permanent — no expiry
- Rationale: the history of constitutional freeze events is an audit trail for platform governance. It cannot be altered or deleted.
- DB enforcement: `REVOKE UPDATE, DELETE ON constitutional_freeze_log FROM cms_app_user`

### corpus_versions referenced by audit records
- Any `corpus_version` that appears as a foreign key in any `replay_audit_record` must be retained
- Deleting a corpus version that is referenced by audit records would corrupt the audit chain (you could not replay the resolution logic without the corpus that was active at the time)
- Enforcement: foreign key constraint + soft-delete only (mark as `archived: true` but never hard delete)

### parity_records
- Retention: lifetime of the canary campaign they relate to plus 90 days
- Parity records are referenced by replay_audit_records (via `replay_reference` field)
- DB enforcement: `REVOKE DELETE ON parity_records FROM app_user`

### promotion_history and rollback_log (canary-service)
- Retention: permanent — these are the authorization trail for canary promotions
- Each entry contains the hash of the human approval token — this is the auditable proof that a human authorized each promotion

---

## Data Migration Ownership

When a schema change is required, the owning service's team owns the migration:

| Migration type | Owner | Required approvals |
|---|---|---|
| cms-api schema change | CMS team | CMS lead + data contracts review |
| replay-audit-api schema change | Audit team | Audit lead + constitutional review (append-only constraint must be preserved) |
| corpus-publisher schema change | Platform team | Platform lead + corpus schema version bump |
| pre-types schema change | Core Platform | Two senior engineers + corpus migration plan |
| constitutional_freeze_log change | PLATFORM_ADMIN | PLATFORM_ADMIN + external audit trail review |

---

## Cross-Service Data Access Patterns

These are the only legitimate patterns for cross-service data access. Any pattern not listed here requires constitutional review.

**cms-api reads entity counts from replay-audit-api:**
`GET /audit/v1/replay/invocations?screen_id={id}&summary=true` — aggregate count only, no individual records. Used for the operator's "total deliveries" display on the screen detail page.

**replay-audit-api reads venue/screen data from cms-api:**
`GET /cms/v1/venues/{id}` — used to validate that a venue_id in an incoming audit batch belongs to a real venue before inserting. Prevents orphaned audit records.

**corpus-publisher reads CMS data for corpus assembly:**
`GET /cms/v1/venues?deployment_group_id={id}` and related endpoints — corpus-publisher assembles the corpus package from CMS data via API calls. It does not have a direct database connection to the CMS schema.

**entropy-service sends alerts to cms-api:**
`POST /cms/v1/entropy/alerts` (internal service-to-service endpoint) — entropy-service pushes alert payloads to cms-api which queues them for operator display. This is the only direction of entropy→CMS data flow.

**canary-service reads parity summaries from shadow-service:**
`GET /shadow/v1/parity/report/{enterprise_id}` — canary-service polls for parity summaries as part of promotion readiness evaluation. It reads aggregated scores, not individual parity records.
