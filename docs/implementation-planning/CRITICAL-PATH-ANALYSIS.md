# CRITICAL-PATH-ANALYSIS.md

**Document type:** Engineering implementation planning
**Status:** Engineering-ready
**Authority:** IMPLEMENTATION-WAVES.md, SERVICE-DECOMPOSITION.md
**Last updated:** 2026-05-26

---

## Definition

The critical path is the longest chain of sequentially dependent work items where any slip on any item delays the overall delivery date. Items not on the critical path have float — they can slip without moving the end date, provided they complete before the next wave needs them.

This document identifies the critical path through all 7 implementation waves, explains why each item is on it, and identifies which dependencies are most likely to cause schedule surprises.

---

## The Critical Path (in order)

### CP-1: PostgreSQL Schema Wave 1 — Identity + Tenancy (Week 1–2)

**Why it's on the critical path:** Every other table in the system has a foreign key dependency on `platforms`, `enterprise_groups`, `venues`, `screen_zones`, or `screens`. No CMS API endpoint can be built until these tables exist. No auth service can be built until `principals` can reference `enterprise_groups`. The entire backend stack is blocked until Wave 1 migrations pass.

**Duration estimate:** 1–2 weeks (including CI integration, migration test harness, staging validation)

**Blocking:** CMS API core, auth service, player-runtime corpus sync, everything

**Risk:** FK ordering bugs. The migration files must be sequenced correctly: `platforms` before `enterprise_groups`, `enterprise_groups` before `venues`, `venues` before `screens`. A single ordering mistake causes a `psql` error that blocks all subsequent migrations. Mitigation: run a full migration sequence against a clean database container in CI before merging any migration PR.

---

### CP-2: player-runtime v1 — Pi Hardware Dependency (Week 2–5)

**Why it's on the critical path:** The edge engineer cannot do meaningful integration testing without physical Pi hardware. The player-runtime can be developed and unit-tested on a development machine, but the following cannot be tested without Pi hardware:
- Chromium kiosk startup stability
- GPU memory allocation
- Corpus file write performance on the Pi's SD card or SSD
- Systemd unit file behavior on Raspberry Pi OS
- WiFi reconnection behavior on Pi's wireless adapter

**Duration estimate:** 3–4 weeks for v1 (PRE loop, corpus sync, heartbeat, player-ui serving)

**Hardware lead time:** Raspberry Pi 4 (4GB RAM) availability varies. Order in Week 1. Current (2026) lead time is typically 2–4 weeks for individual units, up to 6 weeks for bulk orders. Order at least 3 units in Week 1: 1 for development, 1 for integration testing, 1 spare.

**Blocking:** End-to-end Wave 1 gate, all offline autonomy testing, all player-hardening work in Wave 4

**Risk:** If Pi hardware arrives late (Week 4–5 instead of Week 2), the edge engineer has 2–3 weeks of unblocked development time (writing code that can be unit-tested) but cannot validate the full integration. The Wave 1 operational readiness gate cannot pass without a Pi displaying a playlist. This directly delays Wave 2 start.

---

### CP-3: Corpus Sync — End-to-End Delivery (Week 4–6)

**Why it's on the critical path:** The player cannot display anything useful without a corpus. The corpus sync path (`GET /corpus/version` → `GET /corpus/:version_id` → checksum verify → atomic apply → PRE.resolve()) must work before the Wave 1 operational readiness gate can pass. This is the integration point between the CMS backend (corpus-publisher) and the edge (player-runtime), and integration bugs here are common.

**Duration estimate:** 1–2 weeks (after player-runtime v1 is functional)

**Blocking:** Wave 1 gate; Wave 2 signing must extend this, not replace it

**Risk:** Corpus payload size. The full `SystemStateSnapshot` corpus JSON for a large venue (50+ screens, complex schedules) can be 1–5MB uncompressed. On a Pi over WiFi with a poor connection, a 5MB download can fail mid-transfer. The atomic write-to-temp-then-rename pattern is mandatory to handle partial downloads gracefully, but getting it right takes iteration.

---

### CP-4: Audit Cloud Service — Chain Integrity (Wave 2, Week 8–10)

**Why it's on the critical path:** The Wave 2 operational readiness gate requires audit chain integrity verification for all active venues. This gate must pass before Wave 3 work (CMS core) can begin, because adding campaign/schedule/override data to the system without a verified audit chain means the system is in a constitutionally unverified state for the period where CMS data exists but cloud audit does not.

**Dependencies that must come first:**
- Wave 5 DB schema (`replay_audit_records` with append-only trigger) must exist
- Player-runtime must be sending audit batches (Wave 1 ring buffer → sync to cloud)
- RLS must be enabled on `replay_audit_records` before the service goes to production

**Duration estimate:** 2–3 weeks (replay-audit-api + integrity endpoint + UI query)

**Blocking:** Wave 2 gate; Wave 3 cannot start until chain integrity passes for all active venues

**Risk:** The `enforce_append_only()` trigger must be created before the first audit record is inserted. If a developer inserts a test record before the trigger is in place and then creates the trigger, the trigger does not retroactively protect the already-inserted records. All records inserted before the trigger are unprotected. This is not a technical failure but a process failure — it must be caught in code review and verified in CI by checking that the trigger exists before any audit insert succeeds.

---

### CP-5: Campaign Publish → Corpus Generation Pipeline (Wave 3, Week 14–18)

**Why it's on the critical path:** This is the most complex backend workflow in the system and the centerpiece of Wave 3. The pipeline is:

```
VENUE_OPERATOR creates campaign
  → campaign enters DRAFT
  → ENTERPRISE_ADMIN reviews and approves
  → corpus-publisher assembles SystemStateSnapshot
  → validates against corpus-schema
  → signs with Ed25519 private key
  → publishes to CDN
  → players sync new corpus version
  → PRE.resolve() uses new corpus
  → audit records reflect new resolution
```

This chain has 8 steps, each of which can fail independently. The integration between cms-api and corpus-publisher (the `corpus.publish.requested` event) is the highest-risk point: the event must carry enough information for corpus-publisher to reconstruct the full SystemStateSnapshot without making additional CMS API calls (to avoid circular dependencies and consistency issues at assembly time).

**Duration estimate:** 4–5 weeks (campaign lifecycle + approval workflow + corpus assembly + CDN delivery)

**Blocking:** Wave 4 preview API cannot be built until corpus publication works (preview resolves against proposed corpus versions); Wave 6 shadow service needs a published corpus to compare against

**Risk:** The 72h lead time constraint. Campaign scheduling validation must prevent `start_at` less than 72h in the future. If this constraint is implemented as UI-only validation (frontend warning, no API enforcement), an operator who bypasses the UI can schedule a campaign with insufficient lead time. The validation must be enforced in the CMS API (`POST /campaigns` and `POST /campaigns/:id/publish`) and tested with a direct API call that bypasses the UI.

---

### CP-6: Preview API + Approval Gate Enforcement (Wave 4, Week 22–24)

**Why it's on the critical path:** The constitutional requirement states that campaign approval must require preview confirmation. Without the preview API and approval gate enforcement, operators can approve campaigns without seeing what they will display — which is both a UX problem and a constitutional violation. The gate is API-level, not UI-level: the `POST /campaigns/:id/approve` endpoint must return 422 if no preview confirmation exists for the current review session.

**Duration estimate:** 2–3 weeks (preview API + preview UX + gate enforcement + test coverage)

**Blocking:** The Wave 4 operational readiness gate cannot pass until the preview gate is enforced. No campaign can reach APPROVED state in production without a preview.

**Risk:** The preview checksum prefix. Preview output must carry the `PREVIEW:` prefix on `playlist_checksum` to prevent a preview output from being treated as a canonical audit record. If this prefix is accidentally omitted, a preview invocation could write a record to `replay_audit_records` that appears to be a real production resolution. This is not a correctness failure (the content displayed to players is unaffected) but an audit chain integrity violation. The prefix must be enforced in the preview service and verified in the preview vector tests.

---

### CP-7: Shadow Service + Parity Recording (Wave 6, Week 34–37)

**Why it's on the critical path:** The canary service cannot evaluate promotion readiness without parity data. Parity data comes from the shadow service, which receives comparison results from player-runtime during shadow stages. The shadow service must be deployed and recording parity before the first canary advancement is attempted. This is the first step of Wave 6 and gates everything else in the wave.

**Duration estimate:** 2–3 weeks (shadow service + parity recording + parity report API)

**Blocking:** Canary service cannot be built until shadow service provides parity data; canary UX cannot be built until canary service is functional

**Risk:** Parity gap during shadow service downtime. If the shadow service is unavailable while players are in shadow stage, parity records for that period are not captured (player-runtime does not buffer parity records — they are best-effort, unlike audit records). A gap in parity records halts canary promotion eligibility. The canary service must detect gaps (missing parity records for a screen over a time window) and surface them as a blocking condition in the promotion readiness report.

---

### CP-8: Canary Human Approval Flow (Wave 6, Week 37–39)

**Why it's on the critical path:** This is the final constitutional completeness requirement. The system is not constitutionally complete until canary stage advancement requires a human approval token. Without this, an operator (or a bug in the canary service) could auto-advance from SHADOW_ONLY to AUTHORITATIVE — which is explicitly forbidden by the constitution.

**Duration estimate:** 1–2 weeks (canary service stage advance endpoint with token validation + canary wizard UX)

**Blocking:** The Wave 6 gate cannot pass until a full canary stage sequence (SHADOW_ONLY → AUTHORITATIVE) is executed with human approval tokens at each step, verified in staging.

**Risk:** Token storage. The human approval token must be hashed before storage — the raw token must never appear in the database or logs. If a developer logs the token for debugging and that log is shipped to a log aggregator, the token is compromised. Code review must verify that no `human_approval_token` value is logged at any level. The CI lint rules should flag any `console.log(req.body)` in the canary service.

---

## Critical Path Timeline

```
Week 1-2:   CP-1  PostgreSQL schema Wave 1
Week 2-5:   CP-2  player-runtime v1 (Pi hardware dependency)
Week 4-6:   CP-3  Corpus sync end-to-end
Week 8-10:  CP-4  Audit cloud service + chain integrity
Week 14-18: CP-5  Campaign publish → corpus generation pipeline
Week 22-24: CP-6  Preview API + approval gate enforcement
Week 34-37: CP-7  Shadow service + parity recording
Week 37-39: CP-8  Canary human approval flow
```

Total critical path length: ~39 weeks. Constitutional completeness achieved at the end of Wave 6 (Week 39–40). Wave 7 (Weeks 41–52) is enterprise hardening — important but not on the critical path to constitutional completeness.

---

## Non-Critical-Path Items (can slip without delaying delivery)

These items have float — they can be deferred or slipped within their wave without causing a cascade delay, provided they complete before the next wave requires them.

| Item | Float | Why it's not on critical path |
|---|---|---|
| Sponsor portal | Wave 7+ | Sponsors can receive proof-of-play via email CSV export initially |
| Golf marshal specialized PWA | Wave 7 | Golf venues can use general mobile PWA initially |
| Multi-region implementation | Post-Wave 7 | Single-region is sufficient for first 12–18 months |
| Grafana dashboards | Within Wave 5 | Metrics can be collected to Prometheus before dashboards are built; dashboards are a view, not a dependency |
| Conference zone workflow | Wave 7 | Hotels can use general override system initially |
| Shift handover report | Wave 7 | Operators can use audit log directly initially |
| Training certification system gating | Wave 7 | Can be policy-enforced initially |
| Weekly digest notifications | Entropy alerts can be real-time notifications initially |
| GlobalConstitutionalBreaker EMERGENCY_FREEZE exit wizard | Wave 7 | The freeze state is already implemented; the exit wizard is the UX, not the mechanism |

---

## Key Dependency Risks

### Risk 1: Pi Hardware Availability (HIGH)

**Description:** Raspberry Pi 4 (4GB RAM variant) supply chain disruption delays hardware delivery. The edge engineer cannot complete integration testing without physical hardware.

**Current status:** Pi 4 availability improved in 2025–2026 but remains occasionally constrained for bulk orders. Single units are generally available with 1–3 week lead times.

**Impact:** If hardware arrives in Week 4 instead of Week 2, the Wave 1 gate cannot pass until Week 8 instead of Week 6. This pushes Wave 2 start to Week 8, Wave 3 start to Week 14+ (as specified) — which is already the plan. Any further delay (hardware arriving Week 5–6) compresses Wave 2 into fewer weeks and risks the audit chain integrity verification being rushed.

**Mitigation:** Order hardware in Week 1 — the first day of the project. Order 5 units (development, integration, staging, one spare, one for the DevOps engineer to set up deployment tooling). If the lead time is estimated at 3+ weeks, consider using a cloud-based Pi emulator for the first 2 weeks of edge development.

---

### Risk 2: Corpus Signing Ceremony (MEDIUM)

**Description:** Corpus signing requires a hardware security module (HSM) or a secrets manager (AWS KMS, HashiCorp Vault) to store the Ed25519 private key. Setting up the signing infrastructure, generating the key pair, bundling the public key in the player-runtime release process, and documenting the key rotation procedure takes time and requires coordination between the DevOps engineer, the Technical Lead, and (potentially) a security review.

**If delayed:** Wave 2 cannot ship to production without corpus signing. Attempting to ship Wave 2 with unsigned corpus is a constitutional violation (forbidden — see Wave 2 forbidden shortcuts).

**Mitigation:** Plan the signing ceremony in Week 1, even though signing is not implemented until Wave 2. The DevOps engineer should set up AWS KMS (or equivalent) and generate the key pair in Week 1. The public key should be committed to the repository in Week 1 so the edge engineer can hard-code it in player-runtime from the beginning.

---

### Risk 3: Constitutional Freeze Log Partition (HIGH — silent risk)

**Description:** The `constitutional_freeze_log` table has **permanent retention** — it is never archived or deleted. If this table is created without the BEFORE DELETE trigger from the start, records inserted before the trigger is added are not protected. If the table is created with the wrong partition strategy (e.g., partitioned by month, then later attempts to detach the partition would fail because a partition has permanent records), the migration cannot be undone without a full table rewrite.

**Why this is a critical path risk:** If the wrong schema is deployed for this table in Wave 1 (e.g., partitioned when it should not be, or missing the delete trigger), fixing it in production after audit records have been written requires either a data migration (risky) or a table drop-and-recreate (impossible without losing records). Unlike other tables, there is no way to silently fix this after the fact.

**Mitigation:** The `constitutional_freeze_log` schema in DATABASE-ROLLOUT-PLAN.md is the authority. The migration must include the BEFORE DELETE trigger before the first insert is possible. The table must NOT be partitioned (permanent records cannot be archived — partitioning makes sense only if you're planning to detach and archive partitions eventually). Verify the trigger is active on the table before Wave 1 deploys to production.

---

### Risk 4: PRE Isolation Discovered Late (LOW likelihood, HIGH impact)

**Description:** An engineer working on the CMS API or corpus-publisher imports a type or function from `src/pre/` — creating a constitutional boundary violation. If this is discovered in Wave 4 or later, the refactoring required to remove the import may cascade across multiple services.

**Why this is a critical path risk:** If discovered late, fixing it may require halting feature work and doing a dedicated refactoring sprint. A refactoring sprint in the middle of Wave 4 delays the preview API, which delays the Wave 4 gate, which delays Wave 5 start.

**Mitigation:** `scripts/system-integrity/constitutional-boundary-check.ts` must run on every PR from day 1. Enforce this in CI (ci/stages/04-replay-harness.yml or a dedicated stage). The monorepo build graph (package.json dependencies) should make it impossible to import `src/pre/` from CMS API packages — verify this by checking that `cms-api`, `corpus-publisher`, and `replay-audit-api` packages do not list `pre-engine` as a dependency.

---

## Schedule Sensitivity Analysis

The table below shows how much each critical path item can slip before it causes an unrecoverable cascade.

| CP Item | Planned Completion | Slip Budget | Cascade Risk |
|---|---|---|---|
| CP-1: DB schema Wave 1 | Week 2 | 1 week (can compress Wave 1 slightly) | Low — early in project |
| CP-2: player-runtime v1 | Week 5 | 1 week (compresses corpus sync integration) | Medium — Pi hardware is external risk |
| CP-3: Corpus sync | Week 6 | 0 weeks (is the Wave 1 gate) | High — no slip budget |
| CP-4: Audit cloud service | Week 10 | 2 weeks (Wave 2 has a 6-week window) | Medium |
| CP-5: Campaign publish pipeline | Week 18 | 2 weeks (Wave 3 has an 8-week window) | Medium |
| CP-6: Preview API + gate | Week 24 | 2 weeks (Wave 4 has a 6-week window) | Medium |
| CP-7: Shadow service | Week 37 | 1 week | High — directly gates CP-8 |
| CP-8: Canary approval flow | Week 39 | 1 week | High — is the constitutional completeness gate |

The riskiest single item is **CP-3 (corpus sync)** which has zero slip budget because it is the Wave 1 operational readiness gate. The second riskiest is **CP-2 (player-runtime)** because it has an external hardware dependency that cannot be controlled.
