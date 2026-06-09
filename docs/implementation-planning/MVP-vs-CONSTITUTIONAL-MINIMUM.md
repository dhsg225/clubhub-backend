# MVP-vs-CONSTITUTIONAL-MINIMUM.md

**Document type:** Engineering implementation planning
**Status:** Engineering-ready — decisions here bind all engineers and define the line between acceptable shortcuts and constitutional violations
**Authority:** ENGINEERING-CONSTITUTION-v1.md, EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md
**Last updated:** 2026-05-26

---

## Purpose

This document answers the hardest question in implementation: what can we defer?

Under time pressure, engineers and product managers will propose shortcuts. Most of them are reasonable. Some of them are not — they are not "shortcuts" at all, they are reductions in the constitutional guarantees that make the platform trustworthy.

This document provides a decision framework. Before any shortcut is accepted, apply the test at the bottom of this document. If the shortcut fails the test, it is not a shortcut — it is a constitutional violation, and it must be built on schedule regardless of time pressure.

---

## Constitutional Minimum

The constitutional minimum is the set of properties that must be true for the system to be safe to operate. These are not features — they are preconditions for any operation. A system that violates the constitutional minimum may appear to work. It may even appear to work well. But it has undefined behavior at the edges, and when those edges are reached, the consequences are unpredictable.

### CM-1: PRE runs locally on player (never a remote call per invocation)

**What this means:** `PRE.resolve()` executes on the Pi, using the local corpus, without any network call per invocation. The result is deterministic given the corpus and the invocation time. A cloud outage does not affect PRE resolution.

**Why this cannot be deferred:** If PRE is moved to a cloud service (even "temporarily for MVP"), the following guarantees are lost:
- 72h offline autonomy (a remote PRE call requires cloud connectivity)
- Determinism verification (remote PRE can be updated without updating the player — the corpus and the resolver can diverge)
- Audit chain integrity (the audit record's pre_output_hash is computed on-device; if PRE is remote, the player cannot independently verify the output hash)
- The constitutional isolation of PRE from CMS (a remote PRE service would accept CMS requests, making the isolation impossible)

**What "remote PRE" sounds like in practice:** "We can't ship the player-runtime by Week 6, so for now, the Pi will call the CMS API to get a resolved playlist." This is a full constitutional violation. The player will not be able to operate offline. The audit chain will not be generated on-device. The system is fundamentally different from what was designed.

---

### CM-2: Corpus checksum verification on every corpus apply

**What this means:** Every time player-runtime applies a new corpus version, it verifies the fnv1a32 checksum of the downloaded payload before replacing the active corpus. A failed checksum must reject the corpus and retain the current version. After Wave 2: the Ed25519 signature must also be verified.

**Why this cannot be deferred:** Without checksum verification, a partial download or a transmission error silently corrupts the corpus. PRE.resolve() against a corrupt corpus produces undefined output. Audit records are generated against undefined output. The integrity of the audit chain is meaningless if the corpus it references may be corrupt.

**The Wave 1 exception is specific:** In Wave 1, cryptographic signature verification is not required because the signing infrastructure is not yet in place. Checksum verification (fnv1a32) is required in Wave 1. Signature verification is required from Wave 2 onward. This is the full and complete scope of the Wave 1 exception.

---

### CM-3: Audit records generated per-invocation, append-only from the first record

**What this means:** One PRE.resolve() invocation → one audit record. No batch-aggregate records (e.g., "PRE resolved 100 times in the last 5 minutes with the same result, so we wrote one record"). The local ring buffer on the Pi is append-only from the first write.

**Why this cannot be deferred:**
- Append-only is a tamper-evidence property, not an optimization. An audit log that can be modified loses its evidentiary value entirely. This is true even before the cloud service exists — the local buffer must be append-only from the first byte.
- Per-invocation granularity is required for the audit chain integrity check (`GET /replay/integrity/:venue_id`). An integrity check that spans 1-hour gaps (because records were batch-aggregated) cannot detect the failure mode it is designed to catch (a player that stopped resolving playlists for 45 minutes).
- Compliance venues (LICENSED_GAMING, LICENSED_ALCOHOL) have regulatory obligations that specify per-invocation audit records. "We batch-aggregated in MVP" is not a defense to a regulator.

**What "batch aggregate for MVP" sounds like:** "The audit table will have too many rows if we write one per invocation — let's write one per minute with a count field." This is a constitutional violation. Write one record per invocation. Partition the table (as designed in DATABASE-ROLLOUT-PLAN.md) to manage row count.

---

### CM-4: Append-only enforcement at database layer before any audit records are written

**What this means:** The `enforce_append_only()` trigger function must be created and applied to `replay_audit_records`, `parity_records`, `constitutional_freeze_log`, and `canary_stage_history` before the first production audit record is inserted. The application database user must have UPDATE and DELETE revoked on these tables.

**Why this cannot be deferred:** If the first production audit records are inserted before the triggers are in place, those records are not protected by the database-level enforcement. They can be modified or deleted by application bugs or by a developer with database access. The evidentiary value of those records is permanently reduced — there is no way to retroactively apply the tamper-evidence guarantee to records that were written before it was in place.

**The specific risk:** A developer inserts a test record in staging without the triggers, sees the triggers added later, and concludes everything is fine. The triggers protect records written after they were added. The records written before the triggers were added are unprotected. If those records are ever needed for a compliance audit or legal proceeding, the unprotected window will be discovered and will undermine the entire audit chain.

---

### CM-5: Emergency trigger reachable in 2 actions from any venue view

**What this means:** From any page in the venue management UI (venue dashboard, campaign list, schedule view), the emergency trigger must be reachable in at most 2 UI actions (clicks, taps). An action is defined as a deliberate user gesture that produces a state change — a hover menu appearing on hover does not count as an action.

**Why this cannot be deferred:** The emergency system is only as useful as its reachability under stress. A VENUE_OPERATOR who is watching a compliance violation occur on a screen does not have time to navigate through 4 menu levels to find the emergency trigger. If the trigger is buried in a settings submenu, it may as well not exist in a real incident.

**What "defer the emergency UX polish" sounds like:** "We'll put the emergency trigger in the settings page for now and move it to a more prominent location later." This is a constitutional violation — not because of where it is, but because it is more than 2 actions from any venue view. The trigger must be prominent from Wave 3 when the emergency system ships. It cannot be added to a settings page as a placeholder.

---

### CM-6: Human approval token required for canary stage advancement

**What this means:** No canary stage may advance from one stage to the next without a human-provided approval token. The token must be a non-empty string (minimum 8 characters) provided by a PLATFORM_ADMIN out-of-band. The token is hashed and stored in `canary_stage_history` — never stored in plaintext.

**Why this cannot be deferred:** The canary advancement is one of the highest-risk operations in the system. An error in stage advancement can silently deploy a new PRE resolution logic to an entire enterprise fleet. The human approval token is the last safety gate — it ensures that a human explicitly reviewed the promotion readiness report and made a deliberate decision to advance. Without this gate, an automated system (or a code bug) can advance the canary without human review.

**What "ship the canary service without the token for now" sounds like:** "The human approval UI is complex — let's ship the canary service first and add the token requirement in a follow-up." This is a constitutional violation. The `POST /canary/advance` endpoint must require a human_approval_token from day one. There is no version of this endpoint that does not require the token.

---

### CM-7: EMERGENCY_FREEZE exit requires human authorization token

**What this means:** The `GlobalConstitutionalBreaker.reset()` method requires a non-empty human authorization token. The EMERGENCY_FREEZE state has no automatic exit — not on process restart, not on timeout, not on condition resolution.

**Why this cannot be deferred:** EMERGENCY_FREEZE exists for constitutional emergencies — situations where the system's behavior is so uncertain that continuing normal operation would produce unverifiable output. The exit from this state must require a human to explicitly review the situation and authorize the exit. An automatic exit would mean the system could enter and exit EMERGENCY_FREEZE without any human awareness, which defeats the entire purpose of the state.

**The restart exception is intentional:** player-runtime's GlobalConstitutionalBreaker resets to NORMAL on process restart. This is constitutional — a restart requires a human to physically restart the device (or authorize a remote restart). The restart itself is the human action.

---

### CM-8: RLS enforced at database layer (no cross-tenant data leakage)

**What this means:** PostgreSQL Row Level Security policies must be enabled on all enterprise-scoped tables before those tables contain production data from more than one enterprise. The application database user must be subject to RLS (no `BYPASSRLS` privilege for the application user).

**Why this cannot be deferred:** Application-level tenant filtering (WHERE enterprise_group_id = $x) is a defense-in-depth measure — it is not the primary isolation mechanism. A single bug in the application WHERE clause can expose one tenant's data to another tenant. On a multi-tenant platform serving licensed venues, cross-tenant data leakage is a regulatory violation. The database-level RLS must be in place before the second enterprise is onboarded.

**The Wave 1 exception is time-bounded:** In Wave 1, application-level filtering is acceptable because there is only one enterprise (or at most a handful of test enterprises with no production data). The exception expires the moment a second production enterprise is onboarded. RLS must be active before that happens, regardless of the implementation timeline.

---

### CM-9: Preview before campaign approval (API-level enforcement)

**What this means:** The CMS API must enforce that a campaign cannot be approved (transitioned from REVIEW to APPROVED) without a preview confirmation in the current review session. This enforcement is at the API layer — not the UI layer. A direct API call to `POST /campaigns/:id/approve` without a valid preview confirmation token must return 422.

**Why this cannot be deferred:** If preview confirmation is enforced only in the UI (the "approve" button is disabled until the operator views the preview), a technical user can bypass it by calling the API directly. More importantly, a UI bug can make the button enabled when it should not be. API-level enforcement is the only guarantee that no campaign reaches APPROVED state without a preview.

---

### CM-10: Compliance content (L1) cannot be displaced by any campaign or override

**What this means:** Level 1 resolution (operational/compliance content) takes precedence over all other content. No campaign, override, or sponsorship can suppress or replace L1 content. This is enforced in PRE.resolve() at the level resolver level — the L1 resolver terminates the resolution chain.

**Why this cannot be deferred:** This is not a feature — it is an invariant already implemented in `src/pre/levels/level1-operational.ts`. The risk is not in implementing it (it's already implemented) but in testing that the corpus assembly in corpus-publisher correctly marks compliance content as L1 and does not accidentally classify it as L3 (campaign) content.

**What "defer compliance content classification" sounds like:** "We'll mark all content as L3 for now and add L1 classification later." This is not acceptable for a LICENSED_ALCOHOL or LICENSED_GAMING venue. If compliance content is classified as L3, a campaign override can displace it. The classification must be correct from the first corpus published to a compliance venue.

---

### CM-11: Player operates for 72h autonomously (verified before production deploy)

**What this means:** The 72h offline autonomy must be tested — not assumed — before the player-runtime is deployed to a production venue. The test procedure: disconnect the Pi from the network, run player-runtime for 72 hours, reconnect, verify: (a) PRE.resolve() was called continuously throughout, (b) audit records were buffered locally, (c) all audit records sync successfully after reconnection, (d) the corpus was not modified during the offline period.

**Why this cannot be deferred:** If the 72h autonomy requirement is not verified, the platform does not know whether it meets its own specification. This matters most for GRADE_A venues that are deployed with the autonomy guarantee as a contractual commitment.

---

### CM-12: Corpus signing (after Wave 2)

**What this means:** From Wave 2 onward, every corpus package must be signed with the platform's Ed25519 private key. The player-runtime must verify the signature before applying any corpus. The player must reject unsigned corpus packages — it must never apply a corpus that fails signature verification.

**Why this cannot be deferred past Wave 2:** In Wave 1, unsigned corpus is acceptable because the signing infrastructure is not yet in place. In Wave 2, when the signing infrastructure is built, all previously-deployed corpus packages must be replaced with signed versions as part of the Wave 2 deployment. Leaving unsigned corpus in production after Wave 2 ships is a constitutional violation — it means the player may apply a tampered corpus.

---

## MVP Shortcuts That Are Constitutionally Allowed

These are genuinely deferrable. Each one has been evaluated against the constitutional test (below) and found safe to defer.

| # | Shortcut | Earliest wave to defer to | Rationale |
|---|---|---|---|
| S-1 | Preview types P2 (schedule-walk) and P4 (what-if) | Wave 6 | P1 (point-in-time) satisfies the "preview before approval" requirement. P2 and P4 are enhanced views. |
| S-2 | Full shadow/canary governance | Wave 6 | Platform operates safely without canary governance for single-enterprise, single-version deployments. |
| S-3 | Sponsor portal | Wave 6 | Sponsors can receive proof-of-play reports as email CSV exports. The data exists; the portal is a UX convenience. |
| S-4 | Mobile PWA | Wave 4 | Emergency can be triggered via desktop browser on mobile (responsive design) in Waves 1–3. |
| S-5 | Grafana dashboards | Wave 5 | Metrics can be collected to Prometheus before dashboards are built. PLATFORM_ADMIN can query Prometheus directly in Wave 4. |
| S-6 | Multi-region implementation | Post-Wave 7 | Single-region is sufficient for first 12–18 months. Data residency flag is in schema from Wave 1. |
| S-7 | Golf marshal specialized PWA | Wave 7 | Golf venues can use the general mobile PWA for emergency trigger. |
| S-8 | Conference zone content workflow | Wave 7 | Hotels can use the general override system for conference room scheduling. |
| S-9 | Shift handover report generation | Wave 7 | Operators can use the audit log query interface to generate manual shift summaries. |
| S-10 | Weekly digest notification mode | Wave 7 | All notifications can be real-time in Waves 1–6; digest mode is a preference setting. |
| S-11 | Training certification system gating | Wave 7 | Training can be policy-enforced (outside the system) initially. System enforcement is a guard rail. |
| S-12 | POS integration path (QSR) | Post-Wave 7 | QSR restaurants can use the override system for menu content changes. |
| S-13 | On-call staleness detection | Wave 7 | On-call rotation can be maintained as a document initially. System detection is a quality-of-life feature. |
| S-14 | Entropy tolerance level (venue attribute) | Wave 6 | Default entropy thresholds apply to all venues initially. Per-venue tuning is an enhancement. |
| S-15 | GDPR right-to-erasure automation | Wave 7 | GDPR erasure can be handled manually (zero out email/display_name, set gdpr_anonymized_at) initially. |

---

## The Constitutional Test

Apply this test to every proposed shortcut:

> "Does this shortcut make it possible for a system failure to occur that would not have occurred with the full implementation?"

**If YES:** Not a constitutional shortcut. It must be built on schedule regardless of time pressure. Document the risk if it is proposed for deferral and escalate to the Technical Lead.

**If NO:** Constitutional shortcut. Safe to defer. Document the wave it will be implemented in IMPLEMENTATION-WAVES.md.

**If UNCERTAIN:** Apply the secondary test:
> "Does this shortcut affect: (a) correctness of PRE resolution, (b) integrity of the audit chain, (c) cross-tenant data isolation, (d) emergency trigger reachability, (e) human approval authority, or (f) corpus tamper protection?"

If any of (a)–(f) is YES: the shortcut is not safe. Build it.

---

## Worked Examples

### Example 1: "Let's skip the PREVIEW: checksum prefix for now"

**Proposal:** The preview API produces output that looks like a canonical PRE output. For simplicity, the preview output's playlist_checksum does not carry the PREVIEW: prefix in Wave 4.

**Test:** Does this make a failure possible that would not have occurred otherwise?

**Analysis:** If the PREVIEW: prefix is absent, a preview invocation's output has a playlist_checksum that is structurally identical to a canonical audit record's checksum. If a bug causes a preview invocation to write an audit record (e.g., a shared code path that calls `writeAuditRecord()` without checking whether this is a preview invocation), the audit chain will contain a record from a preview invocation, which is not a real production event. The audit chain integrity check will not flag this — the checksum will verify correctly. Sponsors may receive proof-of-play credit for a preview event that never reached a screen.

**Result:** YES — this makes an audit chain corruption possible. The PREVIEW: prefix must be present from day one.

---

### Example 2: "Let's not implement the 72h lead time validation on the API for now"

**Proposal:** The UI warns operators that their campaign must be published 72h before the start_at time, but the CMS API doesn't enforce it. Operators who bypass the UI can publish campaigns with insufficient lead time.

**Test:** Does this make a failure possible that would not have occurred otherwise?

**Analysis:** If a campaign is published with a start_at of 12h from now, the corpus will be published and players will attempt to sync it. If the player's current corpus is valid for 72h after the new corpus becomes effective, the player will begin resolving against the new corpus immediately upon sync (not at the 72h boundary). The 72h autonomy window is designed to cover the corpus delivery period before the effective date. If the delivery lead time is 12h instead of 72h, a player that loses connectivity 12h before the effective date will not have the new corpus and will fall back to LEVEL_5 (structural fallback) at the effective date.

**Result:** YES — insufficient lead time makes playback failure possible during the offline window. API-level validation is required.

---

### Example 3: "Let's defer the sponsor portal to after Wave 7"

**Proposal:** Sponsors access proof-of-play reports via email CSV export through Wave 7. The sponsor portal is implemented post-Wave 7.

**Test:** Does this make a failure possible that would not have occurred otherwise?

**Analysis:** Sponsors receive all their contractually obligated data. The audit records are complete. The CSV export format provides the same data as the portal. The only difference is the delivery mechanism and the portal UX. No system failure mode is introduced by email-based delivery.

**Result:** NO — this is a safe constitutional shortcut. The sponsor portal can be deferred.

---

## Escalation Protocol for Contested Shortcuts

If a proposed shortcut passes the constitutional test in the estimation of the proposing engineer but the Technical Lead believes it does not:

1. Technical Lead documents the disagreement in writing: the proposed shortcut, the proposing engineer's reasoning, and the Technical Lead's reasoning.
2. The Technical Lead's position prevails. The shortcut is not accepted.
3. The disagreement is recorded in the constitutional decision log (maintained as part of the wave retrospective documentation).
4. If the proposing engineer believes the Technical Lead's reasoning is incorrect, they may escalate to the PLATFORM_ADMIN. The PLATFORM_ADMIN may override the Technical Lead on business grounds — but the override must be documented, the risks must be accepted in writing, and the shortcut must be scheduled for implementation in the next wave, not indefinitely deferred.

There is no process for accepting an indefinitely deferred constitutional shortcut. All shortcuts have a wave in which they will be implemented.
