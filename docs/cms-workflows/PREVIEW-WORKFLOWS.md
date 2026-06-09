# Preview Workflows

**Document type:** Operational workflow specification
**Audience:** All operator roles, SPONSOR_STAKEHOLDER (limited access), platform engineers
**Depends on:** PRE-REFERENCE-IMPLEMENTATION-v1.md, PREVIEW-SYSTEMS-SPEC-v1.md, CAMPAIGN-LIFECYCLE.md, OVERRIDE-LIFECYCLE.md, CLUBHUB_SYSTEM_CONTRACTS.md
**Version:** 1.0
**Status:** CANONICAL

---

## 1. Overview

Preview is how operators build confidence in PRE output before publishing changes that affect live screens. It is the primary mechanism by which the platform fulfills its commitment to operational predictability — operators should never be surprised by what PRE resolves, because they can always ask PRE exactly what it will do at any future point.

**The key architectural property:** Preview calls PRE.resolve() with a future `at` value against the current (or hypothetical) corpus state. Because PRE is a pure function — same inputs always produce same outputs — preview output is deterministic. What you see in preview is exactly what will play, given the same corpus state at delivery time.

Preview is read-only. It produces no audit records in the canonical workflow_traces table (only in ephemeral preview session records). It does not affect screen state. It does not trigger entropy scans. It does not modify any campaign, override, or sponsorship state.

---

## 2. Preview Types

### 2.1 POINT_IN_TIME Preview

**What it does:** Calls PRE.resolve() for a specific `screen_id` (or set of screen_ids) at a specific future `at` timestamp. Returns the resolved playlist that would play at that exact moment.

**Use case:**
- "What will screen 7 show at 6:30pm during Friday happy hour?"
- "Does my campaign content resolve correctly during the sponsorship window?"
- "What plays immediately after this override expires?"

**Inputs required:**
- `at`: ISO 8601 timestamp (must be in the future; maximum lookahead: configurable, default 30 days)
- `screen_ids[]`: One or more screens to preview
- `corpus_version_id`: Which corpus version to use (defaults to current active version)

**Output:**
- `playlist_checksum` for each screen at the specified time
- Resolved content items with PRE level indicator for each item
- Explanation: which resolution level won and why (see §5 — Explainability)
- `preview_session_id`: Ephemeral session reference

**Latency:** Synchronous; PRE is called directly. Typical response: <50ms.

### 2.2 SCHEDULE_WALK Preview

**What it does:** Calls PRE.resolve() across a time range, sampling at configurable intervals, and returns the sequence of resolved playlists as an ordered timeline.

**Use case:**
- "Show me the next 7 days of content on the main bar screen"
- "Walk me through the campaign period so I can confirm it looks right before I approve it"
- Approval-linked preview for campaign approval workflows

**Inputs required:**
- `from`: Start of preview window
- `to`: End of preview window (maximum range: configurable, default 7 days)
- `screen_ids[]`: Screens to preview
- `resolution_interval`: How often to sample (default: 15 minutes; minimum: 1 minute)
- `corpus_version_id`: Defaults to current active version

**Output:**
- Ordered sequence of `(timestamp, playlist_checksum, resolved_items[], pre_level)` tuples for each screen
- Summary: total unique content items, PRE level distribution over the period, sponsorship SOV projection
- `preview_session_id`

**Latency:** Asynchronous for ranges exceeding 24 hours. A `preview_job_id` is returned immediately; results are polled or delivered via webhook. For ranges ≤24 hours, synchronous response within 5 seconds.

### 2.3 WHAT_IF Preview

**What it does:** Calls PRE.resolve() with a hypothetical modification to the corpus or schedule — a campaign not yet published, an override not yet created, or an emergency not yet declared — and shows what would resolve.

**Use case:**
- "If I publish this campaign, what does the schedule look like next Tuesday?"
- "If I create a 4-hour override starting at 2pm, what gets displaced?"
- "If a VENUE_EMERGENCY were declared right now, what would play?"

**Inputs required:**
- `base_input`: Standard POINT_IN_TIME or SCHEDULE_WALK input
- `hypothetical`: One of:
  - `{type: "campaign", campaign_draft_id: "..."}` — preview as if this campaign were ACTIVE
  - `{type: "override", override_draft: {...}}` — preview as if this override were in effect
  - `{type: "emergency", emergency_type: "VENUE_EMERGENCY"}` — preview emergency content resolution
  - `{type: "corpus_version", corpus_version_id: "..."}` — preview against a different corpus version

**Output:** Same as the base preview type, plus:
- `delta_from_current`: What would change vs. the current corpus/schedule (diff of playlist_checksums)
- `sponsor_sov_impact`: Projected SOV change for any active sponsorships in the preview window
- Clear labeling: preview surfaces are marked HYPOTHETICAL to prevent confusion with current state

**Audit note:** WHAT_IF previews are not recorded as approval-eligible preview sessions. They are exploratory tools. An approver who runs a WHAT_IF preview must separately run a POINT_IN_TIME or SCHEDULE_WALK preview on the actual (non-hypothetical) state to satisfy the campaign approval preview requirement.

### 2.4 COMPARISON Preview

**What it does:** Runs PRE.resolve() and the legacy resolver for the same inputs and presents the outputs side by side. Used to understand divergence during shadow verification.

**Use case:**
- "Why is shadow comparison showing divergence for screen 3 at 8pm?"
- "Before I approve this campaign, can I see how PRE differs from legacy?"
- Onboarding SHADOW_VERIFICATION review

**Inputs required:**
- Same as POINT_IN_TIME or SCHEDULE_WALK
- `legacy_resolver_version`: Which legacy resolver to compare against (defaults to current legacy)

**Output:**
- PRE output and legacy output side by side
- Match/mismatch indicator per tick
- Explanation of divergence for mismatched ticks (which resolution level differs and why)

**Availability:** COMPARISON preview requires the legacy resolver to be available. During OPERATIONAL phase venues (no legacy active), COMPARISON preview returns a notice that legacy resolver is not active for this venue. The venue's shadow verification period data is used as a historical comparison reference instead.

---

## 3. Preview Authority

### 3.1 VENUE_OPERATOR

May run POINT_IN_TIME and SCHEDULE_WALK previews for screens within their assigned venue. Cannot preview screens at other venues. Cannot access COMPARISON preview (which requires shadow verification data, a REGIONAL_MANAGER concern).

May run WHAT_IF previews for overrides within their authority scope. May not run WHAT_IF previews for campaigns (they cannot publish campaigns, so previewing them is not operationally meaningful for their role).

### 3.2 REGIONAL_MANAGER

Full preview access across all venues in their region. Can run all preview types including COMPARISON. Can run WHAT_IF previews for campaigns within their approval scope.

### 3.3 ENTERPRISE_ADMIN

Full preview access across all venues in their enterprise. Can run all preview types. Can run WHAT_IF against any corpus version including future planned versions.

### 3.4 PLATFORM_ADMIN

Full preview access across all venues on the platform. Can preview against any corpus version. Can preview system-level constitutional scenarios (e.g., "what resolves during EMERGENCY_FREEZE for all venues").

### 3.5 SPONSOR_STAKEHOLDER

May run POINT_IN_TIME preview only, restricted to screens and time windows within their contracted sponsorship scope. They can see what content resolves at L4 for their contracted slots. They cannot see content from other levels (L0-L3) in detail — they see only "your content will/will not play at this time."

This prevents a SPONSOR_STAKEHOLDER from using preview to reconnaissance competitor content or operational schedule details.

### 3.6 AUDITOR

Read-only access to all preview types across their assigned scope. AUDITOR cannot create campaigns or overrides, but can preview any hypothetical scenario for investigation purposes.

---

## 4. Preview Sessions

### 4.1 Session Structure

Every preview invocation creates an ephemeral preview session:

```
preview_session_id: UUID
created_by: user_id
created_at: timestamp
preview_type: POINT_IN_TIME | SCHEDULE_WALK | WHAT_IF | COMPARISON
inputs: {at, screen_ids[], corpus_version_id, hypothetical?}
output_checksum: SHA-256 of preview output (for reference integrity)
expires_at: created_at + 24h (sessions are ephemeral)
canonical: false  ← preview sessions are never canonical audit records
```

Preview sessions are NOT written to the workflow_traces canonical audit table. They are stored in a separate ephemeral preview_sessions table with a 24-hour TTL. This is intentional — preview operations must not pollute the canonical audit record.

### 4.2 Approval-Eligible Preview Sessions

For campaign approval workflows, a preview session becomes "approval-eligible" when it meets all of:
1. `preview_type` is POINT_IN_TIME (full campaign window single point) or SCHEDULE_WALK (full campaign window)
2. `created_by` matches the approver user_id
3. `scope_covers_campaign_window: true` — system verifies the preview covered the full campaign schedule window
4. `has_hypothetical: false` — cannot be a WHAT_IF session

An approval-eligible preview session is stamped onto the campaign approval record as `preview_session_id`. It is the evidence that the approver saw what they were approving.

Approval-eligible sessions are retained for 90 days (not the normal 24h TTL) because they are referenced by campaign audit records.

---

## 5. Preview and Explainability

Every preview response includes an explanation of the resolution decision. The explanation engine is the same one used for operational state explainability (see EXPLAINABILITY-UX-SPEC-v1.md). In preview context:

- **Which level resolved:** "L3 — Campaign: 'Summer Golf Promotion' won this slot"
- **Why higher levels didn't resolve:** "L0: No active emergency. L1: No active override in effect at this time. L2: No scheduled override in this window."
- **Why this level over alternatives at the same level:** "Two L3 campaigns scheduled for this window; 'Summer Golf Promotion' has higher priority_score (80) vs 'Spring Welcome' (60)"
- **What else was evaluated:** Full resolution trace showing all candidates considered and elimination reason for each

Operators use this explanation to understand not just what will play but why, and what would change if a condition were different (leading naturally to WHAT_IF preview usage).

---

## 6. Preview Availability by Constitutional State

| Constitutional State  | POINT_IN_TIME | SCHEDULE_WALK | WHAT_IF  | COMPARISON |
|-----------------------|---------------|---------------|----------|------------|
| HEALTHY               | Available     | Available     | Available | Available  |
| DEGRADED              | Available     | Available     | Available | Available  |
| CONSTITUTIONAL_RISK   | Available     | Available     | Limited* | Available  |
| SHADOW_ONLY           | Available     | Available     | Available | Available  |
| PRE_DISABLED          | Unavailable** | Unavailable** | Unavailable | Available (legacy only) |
| READ_ONLY             | Available     | Available     | Unavailable*** | Available |
| EMERGENCY_FREEZE      | Unavailable   | Unavailable   | Unavailable | Unavailable |

*WHAT_IF in CONSTITUTIONAL_RISK: available but outputs labeled with a constitutional warning indicating PRE is under investigation and hypothetical output may not reflect actual future behavior.

**PRE_DISABLED: PRE cannot be invoked for preview or live resolution. COMPARISON preview can still run the legacy resolver path to show what legacy would resolve.

***WHAT_IF in READ_ONLY: disabled because READ_ONLY means no mutations are permitted and hypothetical scenarios that assume mutations are misleading.

### 6.1 EMERGENCY_FREEZE Behavior

During EMERGENCY_FREEZE, preview is completely unavailable. This is a deliberate design choice: during a constitutional emergency, operators need to focus on the recovery procedure (CONSTITUTIONAL-FREEZE-PROCEDURES.md), not on exploring future content schedules. Preview availability would create a false sense that normal operation is accessible when the system is in a halt state.

After the freeze exits to READ_ONLY, preview (except WHAT_IF) becomes available again immediately.

---

## 7. Compliance Content in Preview

When previewing content for a venue with mandatory compliance slots, the preview output includes compliance content at its scheduled positions. Operators see exactly what the compliance-mandated content is and when it appears.

For campaign approval:
- The approver must confirm in their SCHEDULE_WALK preview that compliance content appears at the required frequency and duration
- If the campaign under review interferes with a compliance slot, the preview output flags the interference as `COMPLIANCE_CONFLICT: true` for that tick
- A compliance conflict detected in preview does not automatically block the preview — it highlights the issue for approver attention
- The REVIEW → APPROVED transition is blocked if any `COMPLIANCE_CONFLICT: true` ticks appear in the approval-linked preview session

This gives approvers full visibility into compliance implications before approving.

---

## 8. Approval-Linked Preview — Required Steps

For campaigns requiring PreviewSession confirmation (all campaigns, per CAMPAIGN-LIFECYCLE.md §4.1):

1. Campaign is in REVIEW state
2. Approver opens the campaign in the operator UI
3. Approver selects "Preview before approving" — this opens a SCHEDULE_WALK preview pre-populated with the campaign's full schedule window and scope
4. Approver reviews the schedule walk output
5. If satisfied: approver clicks "Confirm preview" — this creates the approval-eligible preview session
6. Approval action is now available (previously grayed out)
7. Approver proceeds with approval

Steps 3-6 cannot be skipped. The approval action is not available without a confirmed preview session. This is enforced at the API level — not just the UI. A direct API call to approve a campaign without a valid preview session returns HTTP 409 with `reason: PREVIEW_SESSION_REQUIRED`.

The requirement exists because preview is the mechanism by which approvers take operational responsibility. An approver who approves without reviewing the preview output is approving something they haven't seen. The platform enforces that approvers see what they're approving.
