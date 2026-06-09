# Canary Corpus Deployment Playbook

**Version:** 1.0
**Maintained by:** PLATFORM_ADMIN
**Last reviewed:** 2026-05-26
**Required role:** ENTERPRISE_ADMIN (stage advancement), PLATFORM_ADMIN (constitutional oversight)

---

## When to Use This Playbook

Use this playbook any time a new corpus version is deployed that represents a significant
change to PRE resolution behavior. This includes:

- New campaign slots or slot weight changes
- New resolution level weights at any of the 7 levels
- Changes to compliance content classification or displacement rules
- New corpus structure (added or removed resolution keys)
- Any change where staging parity testing cannot fully predict production behavior

Minor corpus updates (content metadata changes, sponsor name updates, non-structural
changes that do not affect resolution logic) may not require the full canary process.
ENTERPRISE_ADMIN must confirm the scope of change before deciding whether this playbook
applies. When in doubt, use this playbook.

### The irreversibility of AUTHORITATIVE promotion

AUTHORITATIVE promotion cannot be reversed. Once a corpus version is promoted to
AUTHORITATIVE, the previous AUTHORITATIVE version is no longer the operational baseline.
Rolling back after AUTHORITATIVE promotion requires a new canary cycle (or the emergency
fast-track path with ENTERPRISE_ADMIN sign-off at each stage). Plan accordingly.

---

## Pre-Canary Prerequisites

Complete every item before starting Stage 1. The canary process must not begin with any
prerequisite incomplete.

- [ ] New corpus version published and signed by corpus-publisher service using the
  production signing key. Confirm: `corpus_version_id`, `signed_at` timestamp, and
  `checksum` recorded.

- [ ] Corpus version validated in staging environment. Full vector suite passing at
  documented counts. Staging validation must have run against the exact corpus artifact
  that will be deployed to production (same checksum).

- [ ] No active CRITICAL entropy alerts in any target venue. Check entropy dashboard
  before beginning. A venue with an active CRITICAL entropy alert must have the alert
  resolved before it enters any canary stage.

- [ ] ENTERPRISE_ADMIN confirmed available for human approval steps throughout the canary
  period. Canary stages cannot be unattended — someone must review gate evaluations before
  advancement. Identify who will cover if the primary ENTERPRISE_ADMIN is unavailable.

- [ ] Rollback corpus version identified and confirmed signed. The version immediately
  preceding the new version must have a valid signature and be available for immediate
  re-deployment. Confirm `rollback_corpus_version_id` before proceeding.

- [ ] PLATFORM_ADMIN notified that a canary is beginning. PLATFORM_ADMIN does not approve
  stage advancement but must be aware a canary is in progress so they can monitor
  constitutional state and respond quickly if a circuit breaker trips.

---

## Stage 1: SHADOW_ONLY

**Minimum duration:** 48 hours
**Parity gate:** Not applicable — observation only
**Advancement requires:** ENTERPRISE_ADMIN approval

### What happens at this stage

The new corpus runs alongside the current corpus on 1-2 internal venues. PRE is invoked
twice for each scheduling decision: once with the current corpus (authoritative result)
and once with the new corpus (shadow result). Both results are recorded in `parity_records`.
The current corpus result is what players actually serve. No user-visible change occurs.

### Actions

1. ENTERPRISE_ADMIN: select 1-2 internal venues (not compliance-critical venues, not
   venues with gaming or liquor license requirements).

2. ENTERPRISE_ADMIN: enable shadow mode for selected venues:
   ```
   POST /shadow/enable/:venue_id
   Body: { corpus_version_id: "[new_version_id]", human_approval_token: "[token ≥8 chars]" }
   ```

3. Confirm: player-runtime on selected venues begins dual-running. Check `parity_records`
   for first entries within 15 minutes of enabling.

4. Monitor throughout the 48h window:
   - **Grafana — parity_ratio for shadow venues.** Target: ≥ 0.999 within first 24h.
     A parity ratio below 0.999 at 24h is a warning, not an automatic rollback, but
     requires investigation before advancing.
   - **Grafana — CLASS_3/4 divergence count.** Target: 0 throughout. Any CLASS_3 or
     CLASS_4 divergence triggers immediate rollback (see Rollback Procedures below).
   - **Entropy status.** Confirm entropy remains clean on shadow venues throughout.

5. At 48h: ENTERPRISE_ADMIN reviews parity report. If parity_ratio ≥ 0.999 and 0
   CLASS_3/4 events, ENTERPRISE_ADMIN may approve advancement to Stage 2.

### Advancement decision criteria

| Metric | Required value |
|---|---|
| Parity ratio at 48h | ≥ 0.999 |
| CLASS_3 divergences | 0 |
| CLASS_4 divergences | 0 |
| Total invocations logged | ≥ 100 (sufficient for statistical signal) |
| Entropy alerts during window | 0 CRITICAL |

If any criterion is not met, extend Stage 1. Do not advance with unmet criteria.

---

## Stage 2: INTERNAL_CANARY

**Minimum duration:** 24 hours (after ≥ 0.999 parity held for 48h in Stage 1)
**Parity gate:** ≥ 0.999 over 24h, 0 CLASS_3/4
**Advancement requires:** ENTERPRISE_ADMIN approval with human_approval_token

### Actions

1. ENTERPRISE_ADMIN reviews the Stage 1 gate evaluation from Grafana. Takes a screenshot
   or exports the parity ratio trend for the record.

2. ENTERPRISE_ADMIN advances to Stage 2:
   ```
   POST /canary/advance
   Body: {
     corpus_version_id: "[new_version_id]",
     from_stage: "SHADOW_ONLY",
     to_stage: "INTERNAL_CANARY",
     human_approval_token: "[token ≥8 chars]",
     gate_evaluation_ref: "[screenshot or report ID]"
   }
   ```

3. System deploys new corpus to internal venues. Internal venues now serve from new
   corpus. Shadow comparison continues for parity tracking.

4. Monitor same signals as Stage 1. Add: confirm player heartbeats remain green on
   internal venues after corpus switch.

### Advancement decision criteria

Same as Stage 1 but measured over the 24h of Stage 2.

---

## Stage 3: SINGLE_VENUE

**Minimum duration:** 72 hours
**Parity gate:** ≥ 0.999 over 72h, 0 CLASS_3/4
**Advancement requires:** ENTERPRISE_ADMIN approval with human_approval_token

### Venue selection criteria

Select a venue that meets all of the following:
- Not subject to gaming license compliance content requirements
- Not subject to liquor license compliance content requirements
- Not a venue that is contractually guaranteed specific content (sponsor exclusivity agreements)
- Low traffic (lower risk if parity diverges and requires rollback)

### Actions

1. Select the target venue and record `venue_id` and selection rationale.

2. ENTERPRISE_ADMIN advances to Stage 3 with the selected venue:
   ```
   POST /canary/advance
   Body: {
     corpus_version_id: "[new_version_id]",
     from_stage: "INTERNAL_CANARY",
     to_stage: "SINGLE_VENUE",
     target_venue_ids: ["[venue_id]"],
     human_approval_token: "[token ≥8 chars]"
   }
   ```

3. Monitor: parity ratio, CLASS_3/4 count, entropy for the specific venue. Also check:
   - Corpus applied correctly: entropy scan returns clean for the venue
   - Player heartbeat: green on that venue's screens throughout
   - Compliance content: if venue has any compliance slots, confirm they are being served
     correctly (correct content, correct duration, correct frequency)

### Advancement decision criteria

| Metric | Required value |
|---|---|
| Parity ratio over 72h | ≥ 0.999 |
| CLASS_3 divergences | 0 |
| CLASS_4 divergences | 0 |
| Entropy status | Clean throughout |
| Compliance content served | Confirmed correct (if applicable) |

---

## Stage 4: MULTI_VENUE

**Minimum duration:** 48 hours per batch
**Parity gate:** ≥ 0.999 over 48h, 0 CLASS_3/4
**Advancement requires:** ENTERPRISE_ADMIN approval with human_approval_token

### Actions

Select 3-5 additional venues. Include at least 1 venue with compliance content
requirements (gaming or liquor license) if any exist in the fleet, to confirm compliance
content displacement rules behave correctly with the new corpus.

Same monitoring as Stage 3, extended to all selected venues. Each venue must individually
meet the parity gate. A single venue with a CLASS_3 divergence triggers rollback for that
venue (and investigation of whether the new corpus is safe for the fleet).

---

## Stage 5: FLEET_WIDE

**Minimum duration:** 24 hours
**Parity gate:** ≥ 0.999 over 24h, 0 CLASS_3/4 across all venues
**Advancement requires:** ENTERPRISE_ADMIN approval with human_approval_token

### Actions

Deploy to all remaining venues. At this scale, monitoring should shift to aggregate views:
- Fleet-wide parity ratio (aggregate across all venues)
- Per-venue parity ratio alerts (alert if any single venue drops below 0.999)
- Fleet-wide CLASS_3/4 count (must remain 0)

If even one venue shows a CLASS_3 divergence at fleet-wide stage, pause advancement and
investigate before promoting to AUTHORITATIVE.

---

## Stage 6: AUTHORITATIVE Promotion

**This is an irreversible constitutional operation. Read carefully before proceeding.**

The AUTHORITATIVE promotion records a CanaryPromotionLog entry that cannot be deleted.
The previous AUTHORITATIVE corpus version is no longer the operational baseline.

### Pre-promotion review

Before calling the advancement API, ENTERPRISE_ADMIN must review and document all of
the following:

1. **Full parity report** — export the Grafana parity ratio trend covering the entire
   canary period from Stage 1 to present. Confirm the trend has been stable, not just
   the most recent 24h.

2. **CLASS_3 count in last 72h** — must be 0.

3. **CLASS_4 count ever during canary** — must be 0. Any CLASS_4 event at any stage is
   disqualifying. The canary must start over with a revised corpus.

4. **Parity ratio over 7 days** — must be ≥ 0.9999 (note: higher threshold than stage
   gates). This higher threshold applies only to the AUTHORITATIVE promotion gate.

5. **Total invocations** — must be ≥ 1000 across the full canary period. Fewer
   invocations means insufficient statistical confidence in parity results.

6. **Compliance content** — if any compliance venues are in the canary, confirm compliance
   content was served correctly throughout. No compliance failures during the canary period.

### Promotion action

```
POST /canary/advance
Body: {
  corpus_version_id: "[new_version_id]",
  from_stage: "FLEET_WIDE",
  to_stage: "AUTHORITATIVE",
  human_approval_token: "[token ≥8 chars]",
  parity_report_snapshot_ref: "[Grafana export ID or URL]",
  invocation_count_confirmed: [count],
  class3_count_72h: 0,
  class4_count_ever: 0,
  parity_ratio_7d: [ratio]
}
```

### What the system records

On AUTHORITATIVE promotion, the system writes a `CanaryPromotionLog` record containing:
- `corpus_version_id`
- `principal_id` of the ENTERPRISE_ADMIN who approved
- `human_approval_token` (for audit traceability — not stored in plaintext if sensitive)
- `timestamp`
- `parity_report_snapshot` (captured from the gate evaluation)
- `invocation_count`, `class3_count_72h`, `class4_count_ever`, `parity_ratio_7d`

This log is append-only and cannot be modified after creation.

### Post-promotion confirmation

After promotion:
1. Confirm all venues show the new corpus as authoritative (check corpus version reported
   in heartbeats).
2. Run a final entropy scan across all venues to confirm no corpus integrity issues from
   the promotion event.
3. Monitor parity ratio for 24h post-promotion (shadow comparison now compares new
   authoritative against itself — ratio should be 1.000).
4. PLATFORM_ADMIN acknowledges completion.

---

## Rollback Procedures

### Trigger conditions

| Trigger | Action |
|---|---|
| CLASS_3 divergence at any stage | Immediate rollback |
| CLASS_4 divergence at any stage | Immediate rollback + PLATFORM_ADMIN page |
| Parity ratio below 0.990 for >1h | ENTERPRISE_ADMIN investigation; likely rollback |
| CRITICAL entropy on canary venue | Pause canary; resolve entropy first |
| GlobalConstitutionalBreaker trips | Canary automatically paused; follow INCIDENT-RESPONSE-RUNBOOK.md |

### Rollback procedure

1. ENTERPRISE_ADMIN confirms rollback corpus version (`rollback_corpus_version_id`
   identified in pre-canary prerequisites).

2. Execute rollback:
   ```
   POST /canary/rollback
   Body: {
     corpus_version_id: "[new_version_id]",
     rollback_to_version_id: "[rollback_corpus_version_id]",
     human_approval_token: "[token ≥8 chars]",
     reason: "[brief description of what triggered rollback]"
   }
   ```

3. Confirm: all canary venues revert to the rollback corpus version. Check player
   heartbeats and entropy status after rollback.

4. **Root cause investigation is required before the canary resumes.** Do not re-start
   the canary with the same corpus version without understanding why the divergence
   occurred. Document the root cause in the incident log.

5. If the cause is in the corpus, the corpus must be revised and re-signed. The new
   corpus version starts the canary from Stage 1.

---

## Timing Reference

| Path | Minimum total duration |
|---|---|
| Full canary (SHADOW_ONLY → AUTHORITATIVE) | 10 days |
| Fast-track (SINGLE_VENUE → AUTHORITATIVE) | 96 hours |

### Fast-track path

The fast-track path (skipping SHADOW_ONLY and INTERNAL_CANARY) is reserved for emergency
corpus fixes where the production risk of the current corpus exceeds the risk of an
abbreviated canary. ENTERPRISE_ADMIN sign-off is required at every stage of the fast-track
path, and PLATFORM_ADMIN must be notified and acknowledge the fast-track decision.

The fast-track path does not reduce any gate criteria — parity thresholds and CLASS_3/4
requirements are identical. Only the minimum stage durations are reduced.

Do not use fast-track for new features. Fast-track is for emergency corrections only.
