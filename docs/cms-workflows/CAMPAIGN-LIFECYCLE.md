# Campaign Lifecycle

**Document type:** Operational workflow specification
**Audience:** ENTERPRISE_ADMIN, REGIONAL_MANAGER, VENUE_OPERATOR, platform engineers
**Depends on:** PRE-REFERENCE-IMPLEMENTATION-v1.md, CLUBHUB_SYSTEM_CONTRACTS.md, REPLAY-AND-LIVE-PARITY-ARCHITECTURE-v1.md, PREVIEW-SYSTEMS-SPEC-v1.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Overview

A campaign is a time-bounded content schedule that resolves at PRE level L3. It is the primary unit of intentional programming — distinct from overrides (point-in-time interventions) and sponsorships (commercial contracts at L4). Every campaign creates a durable CorpusVersion binding that persists for the lifetime of the deployment; this binding is the mechanism by which PRE determinism is guaranteed at publish time.

This document covers the full lifecycle of a campaign from creation to archive, including the constitutional implications of each state transition.

---

## 2. Campaign States

```
DRAFT → REVIEW → APPROVED → SCHEDULED → ACTIVE → PAUSED → EXPIRED → ARCHIVED
                   ↑                       ↓
                   └──────── PAUSED ───────┘
```

| State      | Description                                                                    |
|------------|--------------------------------------------------------------------------------|
| DRAFT      | Created but not submitted for review. No PRE invocation. No corpus binding.    |
| REVIEW     | Submitted for approval. PreviewSession required before APPROVED transition.    |
| APPROVED   | All approvers confirmed. CorpusVersion binding is established at this point.   |
| SCHEDULED  | Approved and time-indexed. PRE will resolve this campaign at its start time.   |
| ACTIVE     | Currently resolving via PRE at L3. Generates ReplayAuditRecords on each tick.  |
| PAUSED     | Operator-suspended mid-run. PRE skips L3 for this campaign. Pause logged.      |
| EXPIRED    | Past end time. No longer eligible for PRE resolution. Corpus binding retained. |
| ARCHIVED   | Administratively closed. Immutable. Corpus binding retained for replay audit.  |

### 2.1 Terminal States

ARCHIVED is the only true terminal state. EXPIRED campaigns may be cloned (creating a new DRAFT) but cannot be reactivated. Campaigns with any associated ReplayAuditRecord can never be deleted from the system — only archived.

---

## 3. State Transitions

### 3.1 DRAFT → REVIEW

**Trigger actor:** VENUE_OPERATOR+ (any role above floor)

**Pre-conditions checked:**
- Campaign has at least one content slot defined
- Schedule window is in the future
- No obviously conflicting schedule detected (soft check at this stage — hard check at APPROVED)
- Content assets referenced in the campaign exist in the corpus

**Audit record emitted:** `campaign.submitted_for_review` with `campaign_id`, `submitted_by`, `submitted_at`, `schedule_window`, `content_slot_count`

**Constitutional validation:** None triggered at this stage. PRE is not invoked.

### 3.2 REVIEW → APPROVED

**Trigger actor:**
- Single-approver path: REGIONAL_MANAGER+ for venue-scoped campaigns
- Multi-approver path: Two ENTERPRISE_ADMIN approvals required for enterprise-scoped campaigns
- Compliance path: ENTERPRISE_ADMIN+ required for campaigns touching L1 compliance slots (see §4.3)

**Pre-conditions checked:**
1. PreviewSession confirmation recorded (REQUIRED — see §4.1)
2. Schedule conflict detection against all SCHEDULED and ACTIVE campaigns in scope (hard block if conflict found)
3. Competing sponsorship check — campaign content must not displace contracted sponsor SOV below threshold
4. Content integrity verification — each asset checksum confirmed against corpus manifest
5. Compliance content check — mandatory compliance slots verified as present if venue requires them
6. CorpusVersion binding feasibility — PRE determinism pre-verified against the proposed corpus state

**Actions taken at APPROVED transition:**
- CorpusVersion binding created: `corpus_version_id` stamped onto campaign record
- PRE determinism re-verified using the binding's corpus snapshot
- Conflict detection finalised and locked (no further schedule changes permitted without re-review)

**Audit record emitted:** `campaign.approved` with `campaign_id`, `approved_by[]`, `corpus_version_id`, `pre_determinism_check_passed`, `schedule_window`, `conflict_check_result`

### 3.3 APPROVED → SCHEDULED

**Trigger:** Automatic at campaign start_time - configurable_lead_time (default: 1 hour)

**Actions taken:**
- Campaign indexed into PRE schedule at L3 for all screens in scope
- Entropy pre-scan: corpus assets for this campaign verified present on target devices
- If entropy gap detected: ASSET_RESYNC triggered automatically; campaign held in APPROVED until resync completes

**Audit record emitted:** `campaign.scheduled` with `campaign_id`, `indexed_at`, `target_screen_ids[]`, `entropy_preflight_result`

### 3.4 SCHEDULED → ACTIVE

**Trigger:** Automatic at campaign `start_time` (PRE clock tick)

**Actions taken:**
- PRE begins resolving this campaign at L3 for scheduled screens
- First ReplayAuditRecord emitted for this campaign
- Shadow comparison begins if deployment group is in SHADOW_ONLY or canary stage

**Audit record emitted:** `campaign.activated` with `campaign_id`, `activated_at`, `pre_level`, `corpus_version_id`, `playlist_checksum`

### 3.5 ACTIVE → PAUSED

**Trigger actor:** VENUE_OPERATOR+ (venue-scoped); REGIONAL_MANAGER+ (regional or fleet-scoped)

**Pre-conditions checked:**
- Pause reason recorded (required field)
- Expected resume time recorded (optional but audited if missing)

**Behavior when paused:**
- PRE skips this campaign at L3; next eligible L3 campaign or L4 content fills the slot
- Screens do not show a gap — resolution waterfall continues below L3

**Audit record emitted:** `campaign.paused` with `campaign_id`, `paused_by`, `pause_reason`, `expected_resume_at`

### 3.6 PAUSED → ACTIVE (Resume)

**Trigger actor:** Same role or higher as the actor who paused

**Actions taken:**
- PRE resumes resolving campaign at L3 at next tick
- Gap in delivery noted in proof-of-play records for sponsor impact audit if sponsorships were affected

**Audit record emitted:** `campaign.resumed` with `campaign_id`, `resumed_by`, `resumed_at`, `gap_duration_s`

### 3.7 ACTIVE / PAUSED → EXPIRED

**Trigger:** Automatic at campaign `end_time`

**Actions taken:**
- PRE removes campaign from L3 index
- Corpus binding retained (read-only)
- ReplayAuditRecords from this campaign sealed (append complete)

**Audit record emitted:** `campaign.expired` with `campaign_id`, `expired_at`, `total_active_duration_s`, `total_paused_duration_s`

### 3.8 EXPIRED → ARCHIVED

**Trigger actor:** ENTERPRISE_ADMIN+ (manual) or automatic after retention_period (default: 90 days post-expiry for campaigns with no replay audit references; replay-referenced campaigns are never auto-archived — they require explicit ENTERPRISE_ADMIN action)

**Audit record emitted:** `campaign.archived` with `campaign_id`, `archived_by`, `archived_at`, `has_replay_audit_references`

---

## 4. Campaign Creation

### 4.1 Preview Requirement

Every campaign MUST have a confirmed PreviewSession before the REVIEW → APPROVED transition can proceed. The system enforces this as a hard gate — approval actions are disabled in the UI and rejected at the API until `preview_confirmed: true` is set on the campaign record.

A PreviewSession for approval purposes must be:
- A SCHEDULE_WALK preview covering the full campaign window, or
- A POINT_IN_TIME preview for each unique schedule segment within the campaign

The approver who runs the preview must be the same approver who signs the APPROVED transition, or a co-approver in the multi-approver path. Preview sessions run by a different user do not satisfy the gate.

Preview confirmation is recorded as: `preview_session_id`, `previewed_by`, `previewed_at`, `preview_type`, `schedule_segments_covered`.

### 4.2 Template vs. From-Scratch

**From-scratch:** Operator defines all schedule segments, content slots, and targeting manually. Valid for any scope. Requires full conflict detection pass.

**Template-based:** Operator selects an approved campaign template (created and maintained by ENTERPRISE_ADMIN+). Template provides:
- Default schedule segments (operator adjusts dates, not structure)
- Pre-validated content slot assignments for vertical (golf, club, hotel)
- Pre-approved compliance slot layout — reduces compliance review burden

**Enterprise template inheritance:** Enterprise-scoped templates are applied top-down. A REGIONAL_MANAGER may instantiate a regional variant of an enterprise template; the variant inherits all L1 compliance slots and cannot remove them. Additions are permitted; removals require ENTERPRISE_ADMIN re-approval.

### 4.3 Compliance Content Enforcement

Campaigns that touch compliance slots (content required by venue license, regulatory agreement, or enterprise policy) are subject to elevated approval rules:

- L1 compliance slots cannot be removed from a campaign at any scope below ENTERPRISE_ADMIN
- Any campaign that modifies the timing, duration, or content of a compliance slot requires ENTERPRISE_ADMIN+ as the final approver, regardless of whether the campaign is venue-scoped
- Compliance content preview is mandatory: the approver must confirm in the PreviewSession that compliance content appears at the required frequency and duration

Compliance violations at campaign publish are CLASS_3 events and block the deploy.

---

## 5. Approval Workflow

### 5.1 Single-Approver Path (Venue Scope)

Applies when: campaign targets a single venue, no compliance slot modifications, no enterprise template modifications.

| Step | Actor             | Action                                                          |
|------|-------------------|-----------------------------------------------------------------|
| 1    | VENUE_OPERATOR    | Submits campaign for review                                     |
| 2    | REGIONAL_MANAGER  | Reviews campaign, runs PreviewSession, confirms preview        |
| 3    | REGIONAL_MANAGER  | Approves (or rejects with reason)                              |
| 4    | System            | CorpusVersion binding created; APPROVED state set              |

### 5.2 Multi-Approver Path (Enterprise Scope)

Applies when: campaign targets multiple venues, or touches compliance slots, or modifies enterprise template.

| Step | Actor              | Action                                                          |
|------|--------------------|-----------------------------------------------------------------|
| 1    | REGIONAL_MANAGER+  | Submits campaign for review                                     |
| 2    | ENTERPRISE_ADMIN   | Primary review — compliance check, conflict check, preview     |
| 3    | ENTERPRISE_ADMIN   | First approval                                                  |
| 4    | ENTERPRISE_ADMIN   | Second approval (different user from step 3)                  |
| 5    | System             | CorpusVersion binding created; APPROVED state set              |

Both approvers must independently confirm a PreviewSession. The system records both `preview_session_id` values on the campaign approval record.

---

## 6. Conflict Detection

### 6.1 Schedule Conflict

Detected at REVIEW → APPROVED transition. Two campaigns conflict if they overlap in time AND share any target screen.

**Resolution options when conflict detected:**
1. Approver rejects the incoming campaign (returns to DRAFT with conflict explanation)
2. Approver accepts with explicit acknowledgment — records which campaign takes precedence at L3 (higher priority_score wins; equal scores → newer campaign wins)
3. Approver modifies schedule to eliminate overlap (returns to DRAFT for re-review)

Unresolved conflicts block the APPROVED transition. The system will not silently resolve conflicts.

### 6.2 Competing Sponsorship Conflict

Detected at REVIEW → APPROVED. A campaign conflicts with a sponsorship if its schedule displaces contracted sponsor airtime below the SOV threshold defined in the sponsorship contract.

The system calculates projected SOV impact at approval time. If projected SOV for any active sponsorship falls below threshold:
1. The approver is shown the projected impact
2. The approver must explicitly acknowledge the SOV impact to proceed
3. The acknowledgment is recorded on the approval record and delivered to any active SPONSOR_STAKEHOLDER for that sponsorship

This is a soft block (approver can proceed with acknowledgment), not a hard block — because operational priorities sometimes legitimately displace sponsor content. The accountability mechanism is the acknowledgment record and the proof-of-play audit.

### 6.3 Duplicate Content Detection

Campaigns are checked for content-level duplication against other ACTIVE and SCHEDULED campaigns on the same screens. Identical `playlist_checksum` values across campaigns generate a WARNING — not a block — because some duplicate content (e.g., seasonal defaults) is intentional.

---

## 7. Rollback

### 7.1 Shadow Mode Divergence Triggers

If an ACTIVE campaign causes CLASS_2+ divergence in shadow comparison mode (PRE output vs. legacy output), the following automatic response is triggered:

1. Shadow orchestrator logs `shadow.divergence.class_2` event with `campaign_id`, `screen_ids[]`, `divergence_delta`, `corpus_version_id`
2. Campaign is automatically PAUSED (not expired — it can be resumed after investigation)
3. REGIONAL_MANAGER is notified with divergence detail
4. Entropy re-scan is triggered for all affected screens

A CLASS_3 shadow divergence on an active campaign triggers:
1. Automatic campaign PAUSED
2. PRE_DISABLED constitutional state for the affected deployment group
3. ENTERPRISE_ADMIN notification
4. Canary stage reset to SHADOW_ONLY for the affected group

### 7.2 Manual Rollback

REGIONAL_MANAGER+ can manually rollback a campaign by:
1. Pausing the campaign (ACTIVE → PAUSED)
2. Explicitly activating the previously-active campaign for the time period (if one exists)

Rollback is not automatic for CLASS_1 divergence — it requires operator judgment.

---

## 8. Archive vs. Delete

**Delete is not permitted** for campaigns that have:
- Any associated ReplayAuditRecord (generated once campaign enters ACTIVE state)
- Any associated PreviewSession confirmation used in an approval path
- Any CorpusVersion binding referenced by another campaign or deployment record

Attempting to delete such a campaign returns HTTP 409 with `reason: REPLAY_AUDIT_REFERENCE_EXISTS`.

**Archive** renders the campaign immutable and removes it from operational views, but retains:
- All ReplayAuditRecords (append-only, forever)
- CorpusVersion binding (read-only reference)
- Approval records and PreviewSession confirmations
- All state transition audit records

Archived campaigns can be viewed in the audit/forensic interface but cannot be edited, cloned, or scheduled.

---

## 9. Constitutional Implications at Campaign Publish

When a campaign transitions from APPROVED to SCHEDULED (the "publish" moment), the following constitutional operations occur:

1. **CorpusVersion binding confirmed:** The `corpus_version_id` established at APPROVED is re-verified as still valid. If the corpus has changed since APPROVED, the campaign is held and ENTERPRISE_ADMIN is notified.

2. **PRE determinism re-verified:** PRE.resolve() is invoked in simulation mode against the full schedule including this campaign. All invocations must produce identical output across 5 independent runs. Any nondeterminism blocks the publish with `DETERMINISM_CHECK_FAILED`.

3. **Entropy preflight:** All target screens are polled for corpus asset presence. Missing assets trigger ASSET_RESYNC before the campaign is indexed.

4. **Replay audit seed record:** A `campaign.corpus_binding_confirmed` audit record is written before the campaign enters the PRE schedule. This record is the anchor for all subsequent replay verification of this campaign's output.

These operations are not optional and cannot be skipped by any role including PLATFORM_ADMIN.

---

## 10. Audit Record Reference

| Event                              | Emitted At                      | Required Fields                                                             |
|------------------------------------|---------------------------------|-----------------------------------------------------------------------------|
| `campaign.submitted_for_review`    | DRAFT → REVIEW                  | campaign_id, submitted_by, schedule_window, content_slot_count              |
| `campaign.preview_confirmed`       | Preview gate satisfied          | campaign_id, preview_session_id, previewed_by, schedule_segments_covered   |
| `campaign.approved`                | REVIEW → APPROVED               | campaign_id, approved_by[], corpus_version_id, pre_determinism_check_passed |
| `campaign.corpus_binding_confirmed`| APPROVED → SCHEDULED            | campaign_id, corpus_version_id, binding_verified_at                         |
| `campaign.scheduled`               | Indexed into PRE schedule       | campaign_id, target_screen_ids[], entropy_preflight_result                 |
| `campaign.activated`               | SCHEDULED → ACTIVE              | campaign_id, activated_at, pre_level, corpus_version_id, playlist_checksum |
| `campaign.paused`                  | ACTIVE → PAUSED                 | campaign_id, paused_by, pause_reason                                        |
| `campaign.resumed`                 | PAUSED → ACTIVE                 | campaign_id, resumed_by, gap_duration_s                                     |
| `campaign.expired`                 | End time reached                | campaign_id, total_active_duration_s, total_paused_duration_s               |
| `campaign.archived`                | EXPIRED → ARCHIVED              | campaign_id, archived_by, has_replay_audit_references                       |
| `campaign.rollback_triggered`      | CLASS_2+ shadow divergence      | campaign_id, divergence_class, screen_ids[], corpus_version_id              |

All records are append-only. Record integrity is verified by the hash-chain mechanism in the workflow_traces table.
