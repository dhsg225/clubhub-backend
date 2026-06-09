# Production Readiness Checklist

**Version:** 1.0
**Maintained by:** PLATFORM_ADMIN
**Last reviewed:** 2026-05-26
**Scope:** Every venue going live in production for the first time

This checklist must be completed and signed off by a PLATFORM_ADMIN before any venue is
considered production-ready. Items marked **[BLOCK]** are hard gates — the venue does not
go live until every BLOCK item is checked. Items marked **[REQUIRED-WAVE-N]** must be
complete before the specified wave ships but do not block earlier waves.

Sign-off record: PLATFORM_ADMIN principal_id, timestamp, and checklist version must be
written to the system audit log via the constitutional console before the first player is
enrolled.

---

## Section 1: Database and Infrastructure [all BLOCK]

These items must pass before any application deployment proceeds.

- [ ] **[BLOCK]** PostgreSQL RLS enabled on all enterprise-scoped tables.
  Verification: attempt a cross-tenant SELECT as a second enterprise's DB role — query must
  return 0 rows. Document the exact query used and its output in the sign-off record.

- [ ] **[BLOCK]** Append-only trigger on `replay_audit_records` tested.
  Verification: attempt a DELETE on a row that exists — trigger must throw and transaction
  must roll back. Confirm via psql, not application layer.

- [ ] **[BLOCK]** Append-only trigger on `parity_records` tested.
  Same verification procedure as above. Both triggers must be confirmed independently.

- [ ] **[BLOCK]** Constitutional freeze log partition confirmed permanent-retention.
  Verification: confirm no TTL policy, no archival job, no pg_partman retention policy
  touches the `constitutional_freeze_log` partition. Document the partition definition and
  confirm with DBA.

- [ ] **[BLOCK]** Database backup verified end-to-end.
  Procedure: (1) trigger a full backup in staging, (2) restore that backup to an isolated
  staging clone, (3) run `scripts/disaster-recovery/verify-audit-chain.ts` against the
  restored clone, (4) confirm all checks pass. Document backup size, restore time, and
  verification output.

- [ ] **[BLOCK]** Corpus signing keys stored in secrets manager.
  Verification: grep the entire repository (including .env files, docker-compose files,
  CI configuration) for any string resembling a signing key. Result must be zero matches.
  Confirm secrets manager entry exists and is accessible only to the corpus-publisher
  service account.

- [ ] **[BLOCK]** CDN configured with TLS 1.2+ and correct CORS policy.
  Verification: (1) confirm TLS version via `openssl s_client` or equivalent, (2) confirm
  CORS headers allow only the production CMS domain and no wildcard origins, (3) confirm
  corpus asset URLs are served over HTTPS only (no HTTP fallback).

---

## Section 2: Player Deployment [all BLOCK]

These items apply per Pi unit before it is enrolled at a venue.

- [ ] **[BLOCK]** Pi hardware inventory received and burn-tested.
  Burn test: run player-runtime under load for 24h on each unit before shipping to venue.
  Any unit that fails (thermal throttle, storage errors, network drops) must be replaced.
  Record serial numbers of all shipped units.

- [ ] **[BLOCK]** player-runtime installed and startup-verified on target Pi model.
  Verification: power cycle the Pi, confirm player-runtime reaches HEALTHY constitutional
  state within 60 seconds of boot. Check state via heartbeat endpoint, not logs alone.

- [ ] **[BLOCK]** First-boot determinism check passed.
  Procedure: invoke PRE 5 times identically (same corpus, same context, same time seed).
  All 5 outputs must be byte-identical. Run `scripts/system-integrity/full-stack-determinism.ts`
  on the player and confirm PASS. If any run differs, the unit is not production-ready.

- [ ] **[BLOCK]** Corpus signature verification confirmed on player.
  Test: attempt to apply a corpus bundle with a tampered or missing signature. Player must
  reject it and remain on the current signed corpus. Log entry must appear showing rejection
  reason. Do not use a production signing key for this test — use a known-bad test key.

- [ ] **[BLOCK]** 72-hour offline autonomy test completed.
  Procedure: disconnect the Pi from all network access for 72h. Confirm that scheduled
  playlists continue to play correctly throughout the window. Reconnect and confirm the
  player re-syncs without error and audit buffer records reach the cloud service.

- [ ] **[BLOCK]** Emergency content asset confirmed present in player local cache.
  Verification: inspect the player local cache directory and confirm the emergency content
  asset bundle is present and passes checksum verification. Confirm that a simulated
  VENUE_EMERGENCY trigger plays the emergency asset, not a black screen.

- [ ] **[BLOCK]** Heartbeat monitoring confirmed.
  Verification: confirm the player appears in the fleet dashboard within 5 minutes of first
  network connection. Confirm the heartbeat interval is 2 minutes (production setting).
  Confirm an alert fires if the heartbeat is absent for more than 10 minutes.

- [ ] **[BLOCK]** Audit buffer confirmed.
  Procedure: while the player is offline, perform actions that generate audit records.
  Reconnect. Within 10 minutes of reconnection, confirm those records have arrived in the
  cloud audit service and the audit chain integrity check passes.

---

## Section 3: Constitutional Enforcement [all BLOCK]

These gates confirm the enforcement stack is intact before any production traffic runs.
All commands should be run from the repository root against the production build.

- [ ] **[BLOCK]** `validate-contracts.ts --all` passes with 0 violations.
  Expected output: `143 files checked, 0 violations`. Any violation is a BLOCK. Do not
  deploy with suppressed violations or exclusions not present in the committed configuration.

- [ ] **[BLOCK]** `constitutional-boundary-check.ts` passes.
  Expected output: `24 PRE files checked, 0 boundary violations`. Confirms PRE has no
  forbidden imports (shadow, entropy, audit, runtime, api modules). Any violation means
  PRE can observe platform state it must not know about.

- [ ] **[BLOCK]** All four vector suites passing at documented assertion counts:
  - `scripts/vectors/chaos.vec.ts`: 270/270 assertions
  - `scripts/vectors/runtime-integration.vec.ts`: 150/150 assertions
  - `scripts/vectors/shadow.vec.ts`: 141/141 assertions
  - `scripts/vectors/hardening.vec.ts`: 119/119 assertions

  Any regression in assertion count — even if overall PASS — must be investigated before
  deployment proceeds. Assertion counts are pinned; a lower count means a test was removed.

- [ ] **[BLOCK]** CI stages 04 and 07 through 12 are all merge-blocking and passing on the
  production branch.
  Verification: check the CI dashboard for the production branch HEAD commit. All listed
  stages must show green. A skipped stage is not equivalent to a passing stage.

- [ ] **[BLOCK]** PRECircuitBreaker is in CLOSED state at first production invocation.
  Verification: after player-runtime starts and processes its first PRE call, query the
  circuit breaker state endpoint. State must be CLOSED. Confirm trip count is 0.

- [ ] **[BLOCK]** ReplayCircuitBreaker is in CLOSED state.
  Same verification. Threshold is 1 — any single nondeterminism event opens this breaker
  and triggers CLASS_4. Confirm it has never been tripped on this player unit.

- [ ] **[BLOCK]** GlobalConstitutionalBreaker is in NORMAL state.
  Verification: constitutional console must show NORMAL. READ_ONLY or EMERGENCY_FREEZE
  states are not acceptable starting conditions for production. If the state is not NORMAL,
  the EMERGENCY_FREEZE exit procedure must be completed first.

---

## Section 4: CMS and Workflows [REQUIRED-WAVE-3]

These items confirm end-to-end workflow correctness and must be complete before Wave 3
deploys. They do not block Waves 1 and 2 but must not be deferred past Wave 3 go-live.

- [ ] **[REQUIRED-WAVE-3]** Campaign end-to-end test completed.
  Procedure: create a campaign → preview it (confirm preview matches expected resolution
  via PRE explainability surface P1) → approve it → publish it → confirm it becomes visible
  on a connected screen within the expected scheduling window. Document the campaign ID and
  timing in the sign-off record.

- [ ] **[REQUIRED-WAVE-3]** Override lifecycle test completed.
  Procedure: create an override → confirm it enters ACTIVE state → cancel it → confirm it
  moves to CANCELLED state and the screen returns to the previous content. Verify audit log
  records each transition with principal_id.

- [ ] **[REQUIRED-WAVE-3]** Emergency lifecycle test completed.
  Procedure: trigger a VENUE_EMERGENCY via the operator console → confirm emergency content
  appears on affected screen(s) within 60 seconds → clear the emergency → confirm screens
  return to normal scheduled content. Document trigger-to-display latency.

- [ ] **[REQUIRED-WAVE-3]** Compliance content displacement test completed.
  Procedure: attempt to schedule a non-compliance campaign in a slot reserved for L1
  compliance content (gaming license, liquor license, or equivalent). System must reject
  the scheduling operation. Confirm the rejection appears in the audit log with the
  correct failure reason.

- [ ] **[REQUIRED-WAVE-3]** Entropy report generation test completed.
  Procedure: deliberately corrupt an asset checksum on a test screen (not a production
  screen). Confirm an entropy report is generated within 60 minutes and surfaces in the
  operator dashboard with the correct severity level.

---

## Section 5: Access Control [REQUIRED-WAVE-2]

These items confirm role-based access control is correctly enforced and must be complete
before Wave 2 deploys.

- [ ] **[REQUIRED-WAVE-2]** Cross-tenant isolation confirmed.
  Procedure: log in as a VENUE_OPERATOR belonging to Enterprise A. Attempt to access a
  venue, screen, campaign, or audit record belonging to Enterprise B by direct URL or API
  call. Every attempt must return 403 or 404 — no Enterprise B data must be visible.
  Document the specific endpoints tested.

- [ ] **[REQUIRED-WAVE-2]** SPONSOR_STAKEHOLDER access restrictions confirmed.
  Procedure: log in as a SPONSOR_STAKEHOLDER. Attempt to access: audit log, parity reports,
  entropy reports, constitutional console. All must return 403. Confirm that campaign
  performance reports (the permitted surface) are accessible.

- [ ] **[REQUIRED-WAVE-2]** PLATFORM_ADMIN constitutional console access confirmed.
  Procedure: log in as PLATFORM_ADMIN. Confirm constitutional console is accessible and
  displays: current constitutional state, circuit breaker states, ConstitutionalFreezeLog,
  and StateTransitionLog. Confirm the console is not accessible to any other role.

- [ ] **[REQUIRED-WAVE-2]** ENTERPRISE_ADMIN cannot escalate to PLATFORM_ADMIN.
  Procedure: log in as ENTERPRISE_ADMIN. Attempt to assign the PLATFORM_ADMIN role to any
  principal (including self). Operation must be rejected. Confirm the attempt appears in
  the audit log. Role escalation must only be performed by an existing PLATFORM_ADMIN.

---

## Section 6: Operational [REQUIRED-WAVE-5]

These items confirm the operational support model is in place before full-fleet rollout
at Wave 5. They do not block early waves but must not be deferred to post-launch.

- [ ] **[REQUIRED-WAVE-5]** PLATFORM_ADMIN on-call rotation documented in system with
  minimum 2 people. Confirm that no upcoming hour in the next 30 days has zero PLATFORM_ADMIN
  coverage. System must show green on the on-call coverage check.

- [ ] **[REQUIRED-WAVE-5]** Alert routing tested end-to-end.
  Procedure: trigger a test CRITICAL alert from a circuit breaker in staging. Confirm the
  alert reaches the on-call PLATFORM_ADMIN via the configured notification channel within
  2 minutes. Document the alert ID, trigger time, and delivery time.

- [ ] **[REQUIRED-WAVE-5]** Emergency push channel tested end-to-end.
  Procedure: trigger an emergency content push via the operator console in staging with a
  connected Pi player. Measure time from trigger to emergency asset visible on screen.
  Must be within 60 seconds. Document the measured latency.

- [ ] **[REQUIRED-WAVE-5]** Disaster recovery drill completed.
  At least one of scenarios 1 or 2 from DISASTER-RECOVERY-PLAN.md must have been drilled
  in a non-production environment. RTO target must have been met. Results documented.

- [ ] **[REQUIRED-WAVE-5]** Post-incident review template accessible.
  Confirm that the post-incident review form is accessible from the CMS web at
  `/incidents/:id/review` and that a PLATFORM_ADMIN has confirmed familiarity with the
  required fields.

- [ ] **[REQUIRED-WAVE-5]** Monitoring dashboard complete and verified.
  The following signals must be visible in Grafana (or equivalent) without any
  configuration changes at incident time:
  - Current constitutional state per venue
  - Circuit breaker states (PRECircuitBreaker, ReplayCircuitBreaker, GlobalConstitutionalBreaker)
  - Parity ratio per venue (7-day trend)
  - Entropy status per venue
  - Player heartbeat status (green/missing)
  - Audit record sync lag per player

---

## Sign-off

| Field | Value |
|---|---|
| PLATFORM_ADMIN principal_id | |
| Checklist version | 1.0 |
| Sign-off timestamp (UTC) | |
| Audit log entry ID | |
| Venue(s) covered | |
| Notes / exceptions granted | None |

No exception may be granted to any **[BLOCK]** item. If a BLOCK item cannot be completed,
the venue does not go live. Document the reason in the blockers section of STATE.md and
resolve it before the next go-live attempt.
