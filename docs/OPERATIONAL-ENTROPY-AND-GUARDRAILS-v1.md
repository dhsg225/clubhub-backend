# OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md
# ClubHub TV — Operational Entropy Detection and Management

**Status:** Canonical Reference
**Depends on:** BACKEND-ARCHITECTURE-v1.md, PRE-REFERENCE-IMPLEMENTATION-v1.md
**Informed by:** Five adversarial operator simulation scenarios (2026-05-17)
**Last updated:** 2026-05-17

---

## Table of Contents

1. [Philosophy and Scope](#1-philosophy-and-scope)
2. [Why Correct Systems Still Drift Operationally](#2-why-correct-systems-still-drift-operationally)
3. [Human-System Failure Modes](#3-human-system-failure-modes)
4. [Drift Taxonomy](#4-drift-taxonomy)
5. [Operational Health Metrics](#5-operational-health-metrics)
6. [Drift Signal Computation Rules](#6-drift-signal-computation-rules)
7. [Staleness Detection](#7-staleness-detection)
8. [Preview Surfaces](#8-preview-surfaces)
9. [PRE Preview Endpoint Specification](#9-pre-preview-endpoint-specification)
10. [Advisory UX Rules](#10-advisory-ux-rules)
11. [Non-Goals](#11-non-goals)
12. [Why PRE Must Remain Pure](#12-why-pre-must-remain-pure)
13. [Entropy Scoring Model](#13-entropy-scoring-model)
14. [Venue Operational Health Model](#14-venue-operational-health-model)
15. [Time-Based Drift Analysis](#15-time-based-drift-analysis)
16. [Observability Architecture](#16-observability-architecture)
17. [Recommended Dashboards](#17-recommended-dashboards)
18. [Operational Review Workflows](#18-operational-review-workflows)
19. [Escalation vs. Blocking Philosophy](#19-escalation-vs-blocking-philosophy)
20. [Future Extensions](#20-future-extensions)

---

## 1. Philosophy and Scope

### 1.1 The Core Assertion

A system can be technically correct at every resolution instant and operationally wrong in aggregate. ClubHub TV's Playback Resolution Engine (PRE) is designed to be deterministic, correct, and total. It will always produce a valid output. It will never produce an incorrect resolution given its inputs.

This guarantee says nothing about whether the inputs reflect operator intent.

Operational entropy is the divergence between what the system is configured to do and what the operators intended to configure. This divergence is not caused by bugs. It is caused by accumulated human decisions — each individually reasonable — that interact across time to produce a state that no single operator would have chosen.

This document defines how ClubHub TV detects, measures, surfaces, and operationally manages this divergence. It does not attempt to reverse it automatically. It does not modify PRE behavior. It does not correct configuration. It makes the invisible visible.

### 1.2 Scope Boundary

This document governs the **operational layer** that sits between the PRE and the human operators who configure the system. It defines:

- What constitutes operational entropy
- How entropy is measured from existing state
- What signals should be surfaced and when
- What advisory UX behaviors are appropriate
- What is explicitly out of scope

This document does not govern:

- PRE resolution logic (governed by PRE-REFERENCE-IMPLEMENTATION-v1.md)
- Data model design (governed by BACKEND-ARCHITECTURE-v1.md)
- Infrastructure deployment (governed by IMPLEMENTATION-ROADMAP-v1.md)

### 1.3 Architectural Position

```
┌─────────────────────────────────────────────────────────┐
│                    OPERATOR INTENT                       │
│            (what operators want to happen)               │
└────────────────────────┬────────────────────────────────┘
                         │  divergence = operational entropy
┌────────────────────────▼────────────────────────────────┐
│                 SYSTEM CONFIGURATION                     │
│    schedules / overrides / campaigns / sponsorships      │
└────────────────────────┬────────────────────────────────┘
                         │  resolved deterministically
┌────────────────────────▼────────────────────────────────┐
│            PLAYBACK RESOLUTION ENGINE (PRE)              │
│      pure function — correct — immutable — trusted       │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    SCREEN PLAYBACK                       │
│           (what actually plays on the screen)            │
└─────────────────────────────────────────────────────────┘

This document governs detection of the gap at the TOP arrow.
It does not modify anything at the BOTTOM arrow.
```

### 1.4 Founding Principle

**Observability is safer than enforcement.**

Every automatic corrective action carries the risk of making a different, worse mistake with no human in the loop. A system that notices drift and tells a human is more trustworthy than a system that corrects drift autonomously. This principle governs every guardrail design decision in this document.

---

## 2. Why Correct Systems Still Drift Operationally

### 2.1 The Local Rationality Problem

Every operator decision that contributes to system entropy is locally rational. No operator ever decides to degrade the system. What happens instead:

An operator faces a problem with incomplete information about system state, incomplete understanding of the configuration model, and time pressure. The available action they can take produces the result they need right now. The longer-term effect on the system is invisible to them at the moment of action.

Six months of individually rational decisions accumulates into a system state that no individual decided to create and that no individual fully understands.

### 2.2 Five Observed Degradation Patterns

The following patterns were derived from adversarial simulation of real-world operator behavior under normal operational pressure. None involves malicious intent. All involve operators doing their best with the tools available.

**Pattern A — Override Accumulation (Scenario 1)**
Operators learn that per-screen overrides solve problems immediately. Area-level scheduling is correct but less responsive to their immediate needs. Over 10 weeks, 35% of screens diverge from their area schedule into a state where the override content is unknown, unreviewed, and permanent. The area schedule remains the official record; it is no longer the operational reality.

**Pattern B — Sponsor Overbooking Drift (Scenario 2)**
Each sponsorship approval is individually within the warning threshold. The warning threshold is first crossed, then persists, then loses signal value through duration. After 5 months, sponsor content exceeds the editorial content ratio on some screens. No single decision caused this. The accumulation did.

**Pattern C — Emergency Feature Misuse (Scenario 3)**
Emergency activation produces instant, guaranteed results. Under time pressure, operators learn to use it as an "immediate flush" rather than an emergency response. Fourteen operational uses in 60 days make the audit trail indistinguishable from an actual emergency. The signal value of the emergency log collapses.

**Pattern D — Campaign Fragmentation (Scenario 4)**
The campaign publish lifecycle has more steps than direct schedule creation. Operators under time pressure bypass it. After 4 months, 70% of active schedules have no campaign parent. The campaign system is structurally intact and operationally irrelevant. Knowledge transfer compounds the problem — new staff are taught the workaround, not the intended model.

**Pattern E — Shadow Scheduling (Scenario 5)**
Without a way to preview what the PRE will actually resolve, operators develop a mental model of "higher priority wins." They create duplicate schedules and inappropriate overrides to force priority behavior. Priority escalation follows: effective priority ranges drift from [0–20] to [0–300]. The original priority scale is meaningless.

### 2.3 Entropy Accumulates Silently

The critical property these patterns share: **the system produces no signal when the gap between intent and configuration grows**. The PRE resolves correctly at each moment. Proof-of-play logs confirm delivery. No alarms fire. From a technical monitoring perspective, everything is working.

The gap between intent and configuration is only visible to a human who holds both the current system state and a memory of what was originally intended. As staff turnover, that human disappears. The gap becomes permanent.

### 2.4 The Prevention Leverage Point

The highest-leverage intervention is not enforcement. It is **making the gap visible before it becomes permanent**.

If an operator can see "this screen is diverging from its area schedule because of an override created 47 days ago," they can decide whether that divergence is still intended. If they cannot see it, they cannot decide. Entropy accumulates through invisibility, not through intention.

---

## 3. Human-System Failure Modes

This section catalogs the classes of human-system interaction that produce entropy. These are not bugs. They are structural gaps between the system's model and operators' mental models.

### 3.1 Mental Model Mismatch

**Definition:** An operator holds a belief about how the system works that is correct for the visible part of the system but wrong for its non-visible parts.

**Example:** An operator who publishes a campaign to an area believes all screens in that area will receive the campaign. If 4 of 12 screens have active per-screen overrides, they will not. The campaign UI shows "published." The operator's belief is false. The system generated no signal.

**Consequence:** Operators make configuration decisions based on incorrect beliefs. Those decisions accumulate into entropy.

### 3.2 Feedback Loop Absence

**Definition:** An action produces a result, but the result is not visible to the person who took the action.

**Example:** An operator creates a schedule with priority 10. Six other schedules for the same area have priorities 15–80. The new schedule will rarely if ever win resolution. The operator is not told this at creation time. They believe the content is running.

**Consequence:** Configuration decisions that have no operational effect are not retracted. Inert configuration accumulates.

### 3.3 Tool-Goal Mismatch

**Definition:** An operator uses a tool for a purpose it was not designed for because no better tool is available.

**Example:** Emergency activation is used as an "immediate flush" mechanism because operational overrides involve waiting for a poll cycle. The emergency tool produces the right result. The semantic damage to the audit trail is invisible and deferred.

**Consequence:** Over time, the semantic meaning of the misused tool degrades. When the tool is needed for its intended purpose, its signal value has been diluted.

### 3.4 Knowledge Transfer Decay

**Definition:** The original rationale for a configuration decision is not preserved. When the person who made the decision leaves, the rationale disappears.

**Example:** A permanent per-screen override was created because a specific screen faces a staff area and needs different content. When the shift manager who created it leaves, the override persists. A replacement manager sees a screen behaving differently from its area peers. They create another override "to fix it." Both overrides are now active. Neither is understood.

**Consequence:** Configuration accumulates because the cost of deletion is perceived as higher than the risk of keeping it. Deletion requires understanding intent; understanding intent requires knowledge that no longer exists.

### 3.5 Urgency-Permanence Conflation

**Definition:** A configuration change made under time pressure with the intent that it be temporary is never reviewed for removal.

**Example:** An override is created urgently before an event. It has `expires_at = NULL` because the operator didn't know how long the event would last. The event ends. The override persists. No review is triggered. The override becomes permanent through inaction rather than decision.

**Consequence:** Temporary configurations accumulate into a permanent background of inert or actively wrong state.

### 3.6 Priority Escalation Pattern

**Definition:** When content doesn't appear to win resolution, operators increase its priority rather than investigating what it is losing to.

**Example:** A schedule created at priority 10 produces insufficient playback frequency. Operator creates a duplicate at priority 50. That also appears insufficient (because another operator ran the same escalation last month). Operator creates a third at priority 100. All three rows are now active. Removing any feels risky.

**Consequence:** The priority space inflates without bound. New content at the original priority range is invisible. The original priority semantics are permanently destroyed.

---

## 4. Drift Taxonomy

Operational entropy in ClubHub TV manifests in six distinct categories. Each category has a definition, a measurable state, and a characteristic progression.

### 4.1 Override Divergence

**Definition:** The percentage of screens in a venue or area whose current PRE resolution is determined by an override rather than their area or venue schedule.

**Normal state:** 0–5%. Per-screen overrides exist for genuinely idiosyncratic screens (screens facing staff areas, screens with unusual aspect ratios, permanent institutional displays).

**Degraded state:** >20%. Per-screen overrides are the primary scheduling mechanism for a significant fraction of the fleet. The area schedule no longer represents operational reality for those screens.

**Progression:** Begins with one or two legitimate exceptions. Grows as operators learn that overrides work faster than area schedule updates. Accelerates after knowledge transfer events (staff changes). Stabilizes at a level determined by the ratio of "override-comfortable" operators to the total operator pool.

**Characteristic signal:** `screens_diverged_from_area_pct` per area, trended over 30 days.

**PRE behavior:** Correct at all times. Specificity ordering is working as designed.

### 4.2 Campaign Fragmentation

**Definition:** The percentage of active schedule rows that have no campaign parent (`campaign_id IS NULL`), in a system where campaign-managed scheduling is the intended primary model.

**Normal state:** <20% of active schedules are campaign-orphaned (direct schedules for genuinely operational content — area-specific one-offs, emergency-replacement permanent content).

**Degraded state:** >60% of active schedules are campaign-orphaned. The campaign system is bypassed as the primary scheduling mechanism.

**Progression:** Begins when operators find campaign publish has more steps than direct schedule creation. Accelerates after each "I just need to add one thing quickly" event. Becomes structural after knowledge transfer (new staff learn direct scheduling, not campaigns).

**Characteristic signal:** `campaign_coverage_pct` per venue, trended weekly.

**PRE behavior:** Correct. Campaign-materialized schedules and direct schedules are equivalent inputs to structural resolution.

### 4.3 Shadow Scheduling

**Definition:** The presence of schedule or override rows that duplicate, contradict, or shadow other active rows in the same scope and time window, without the duplicating rows contributing clearly distinct content.

**Normal state:** Zero or near-zero duplicate content across active rows for the same scope.

**Degraded state:** The same `content_id` appears in multiple active schedule rows for the same scope, or override rows semantically duplicate schedule rows.

**Progression:** Begins when operators cannot preview PRE resolution and develop a model that "more rows = more frequency." Compounds with priority escalation. Stabilizes when operators can no longer distinguish active-and-needed rows from active-and-redundant rows, making deletion feel risky.

**Characteristic signal:** `duplicate_content_pairs` per area, `override_as_schedule_count` (overrides with `expires_at IS NULL` older than 30 days), `max_scope_schedule_count` per time window.

**PRE behavior:** Correct. SWRR interleaving weights duplicated content according to its combined schedule representation. The result is arithmetically correct but does not match any single operator's intent.

### 4.4 Priority Escalation

**Definition:** The progressive inflation of priority values in active schedule rows, where effective priorities drift from the intended baseline range into an inflated range driven by repeated workaround additions.

**Normal state:** Active schedules for a venue occupy a priority range of [0–50]. The distribution is roughly uniform across that range.

**Degraded state:** Active schedules span [0–300] or more. The bottom 50% of the range contains only inert or low-impact rows. Effective priority competition occurs entirely in the top 20% of the actual range.

**Progression:** Begins with the first "content isn't showing enough, increase priority" event. Each such event raises the competitive ceiling. New operators onboarded to the escalated state learn the escalated norms.

**Characteristic signal:** `priority_range_width` per area (max active priority - min active priority), `priority_gini_coefficient` (concentration of effective wins in the top priority decile).

**PRE behavior:** Correct. Priority is a tiebreaker within the same specificity level. A higher priority value legitimately wins. The system resolves correctly; the priority space has simply expanded to encompass workaround intent.

### 4.5 Sponsor Saturation Drift

**Definition:** The progressive accumulation of active sponsorship contracts until total share-of-voice approaches or exceeds the operational comfort threshold, driven by individually small contract additions.

**Normal state:** Total SOV ≤ 50% across all active contracts for a venue. Clear editorial margin.

**Degraded state:** Total SOV 60–80%, persistent for >7 days. Warning signal has become ambient noise. Editorial content is in structural minority in some time windows.

**Critical state:** Any time window where sponsor content comprises >50% of actual resolved content mix, regardless of nominal SOV percentage.

**Progression:** Each contract addition is individually below the block threshold. The warning threshold is crossed and persists. Warning duration erodes the signal value of the warning. The accumulation is never visible as a single decision.

**Characteristic signal:** `sov_warning_active_days` (consecutive days above warning threshold), `editorial_content_pct` (percentage of resolved content that is non-sponsored, sampled per time window), `sov_projection_30d` (projected SOV at each day in the next 30 days based on existing contract dates).

**PRE behavior:** Correct. Sponsorship injection at Level 4 applies contracted weights. The playlist is arithmetically consistent with the contracts.

### 4.6 Emergency Semantic Collapse

**Definition:** The loss of signal value in the emergency activation audit trail, caused by repeated non-emergency operational use of the emergency activation feature.

**Normal state:** Emergency activations are rare (0–2 per month per venue), short or indefinite in duration, and clearly associated with physical events (safety incidents, technical failures).

**Degraded state:** Activations occur weekly, for durations of 1–4 hours, for operational reasons ("sports night," "promo push," "content refresh"). The activation log cannot distinguish these from genuine emergencies without manual review of each entry.

**Progression:** Begins with the first successful operational use — where emergency activation produces the desired immediate result and no adverse consequence follows. The mental model of the feature shifts from "emergency response" to "immediate flush." Frequency increases as more operators learn the pattern.

**Characteristic signal:** `emergency_activations_30d` (rolling monthly count), `emergency_avg_duration_hours` (average active duration), `emergency_reason_completion_rate` (percentage of activations with non-empty reason field), `emergency_business_hours_pct` (percentage of activations during normal business hours — real emergencies are time-agnostic; operational misuse clusters during peak hours).

**PRE behavior:** Correct at every activation. Emergency Level 0 resolution is absolute by design. The semantic collapse is in the audit trail and human interpretation, not in the PRE.

---

## 5. Operational Health Metrics

This section defines the canonical set of operational health metrics for a ClubHub TV venue. All metrics are derivable from existing database state without new data collection.

### 5.1 Metric Catalog

Each metric is defined by its query source, computation logic, update frequency, and interpretation.

---

**M-01: Override Divergence Rate**
```
Definition:   Percentage of screens in a venue/area whose last PRE resolution
              used an override (Level 0, 1, or 2) rather than structural
              scheduling (Level 5).
Source:       manifest_cache.manifest → reason_trace.resolution_level
Computation:  COUNT(screens WHERE last_reason_trace.level IN [0,1,2]) /
              COUNT(total_screens) × 100
Update freq:  On each manifest cache write
Threshold:    ADVISORY > 15%,  REVIEW > 30%
Unit:         Percent
```

---

**M-02: Override Age Distribution**
```
Definition:   Distribution of active override ages in days for a venue.
              Reports p50, p90, and count of permanent (expires_at IS NULL)
              overrides older than 30 days.
Source:       overrides WHERE status = 'active'
Computation:  PERCENTILE(NOW() - issued_at), COUNT WHERE expires_at IS NULL
              AND issued_at < NOW() - INTERVAL '30 days'
Update freq:  Daily
Threshold:    ADVISORY: any permanent override > 30 days old
              REVIEW: any permanent override > 90 days old
Unit:         Days / count
```

---

**M-03: Campaign Coverage Rate**
```
Definition:   Percentage of active non-emergency schedule rows that have a
              non-null campaign_id for a venue.
Source:       schedules WHERE status = 'active' (materialized from campaigns)
Computation:  COUNT(schedules WHERE campaign_id IS NOT NULL) /
              COUNT(all active schedules) × 100
Update freq:  Daily
Threshold:    ADVISORY < 60%,  REVIEW < 30%
Unit:         Percent
```

---

**M-04: Priority Range Width**
```
Definition:   Difference between the maximum and minimum priority values
              among active schedule rows for a venue.
Source:       schedules WHERE expires_at IS NULL OR expires_at > NOW()
Computation:  MAX(priority) - MIN(priority)
Update freq:  On schedule create/delete
Threshold:    ADVISORY > 100,  REVIEW > 200
Unit:         Integer (priority units)
```

---

**M-05: Duplicate Content Pairs**
```
Definition:   Count of (content_id, scope, time_window) combinations
              where the same content_id appears in more than one active
              schedule row for overlapping time windows at the same scope level.
Source:       schedules (joined with self on content_id, scope overlap)
Computation:  COUNT of groups with cardinality > 1
Update freq:  On schedule create/delete
Threshold:    ADVISORY > 3 pairs,  REVIEW > 8 pairs
Unit:         Count
```

---

**M-06: SOV Warning Duration**
```
Definition:   Consecutive calendar days the total SOV for a venue has
              been above SOV_WARNING_THRESHOLD.
Source:       sponsorship_contracts (active contracts summed)
Computation:  Days since SOV first exceeded SOV_WARNING_THRESHOLD without
              falling below it
Update freq:  Daily
Threshold:    ADVISORY > 7 days,  REVIEW > 14 days
Unit:         Days
```

---

**M-07: Editorial Content Rate**
```
Definition:   Percentage of content items in resolved manifests that are
              non-sponsored editorial content, sampled at a representative
              time window (default: 18:00 local time, most recent 7 days).
Source:       manifest_cache + screen_delivery_log
Computation:  COUNT(non-sponsored items) / COUNT(all items) × 100
Update freq:  Daily
Threshold:    ADVISORY < 50%,  REVIEW < 35%
Unit:         Percent
```

---

**M-08: Emergency Activation Rate**
```
Definition:   Count of emergency activations in the rolling 30-day window
              for a venue.
Source:       emergency_states WHERE scope encompasses venue
Computation:  COUNT WHERE activated_at > NOW() - INTERVAL '30 days'
Update freq:  On emergency activate/clear
Threshold:    ADVISORY > 3/month,  REVIEW > 6/month
Unit:         Count per 30 days
```

---

**M-09: Emergency Reason Completion Rate**
```
Definition:   Percentage of emergency activations in the last 90 days
              that have a non-empty reason field.
Source:       emergency_states WHERE activated_at > NOW() - INTERVAL '90 days'
Computation:  COUNT(reason IS NOT NULL AND reason != '') /
              COUNT(*) × 100
Update freq:  Daily
Threshold:    ADVISORY < 70%,  REVIEW < 40%
Unit:         Percent
```

---

**M-10: Orphaned Schedule Count**
```
Definition:   Count of schedule rows with no campaign parent, no expiry,
              and created more than 60 days ago.
Source:       schedules WHERE campaign_id IS NULL AND expires_at IS NULL
              AND created_at < NOW() - INTERVAL '60 days'
Update freq:  Daily
Threshold:    ADVISORY > 5,  REVIEW > 15
Unit:         Count
```

---

**M-11: Override-as-Schedule Count**
```
Definition:   Count of overrides with expires_at IS NULL whose issued_at
              is more than 30 days ago. These have the operational profile
              of permanent schedules, not operational overrides.
Source:       overrides WHERE status = 'active' AND expires_at IS NULL
              AND issued_at < NOW() - INTERVAL '30 days'
Update freq:  Daily
Threshold:    ADVISORY > 3,  REVIEW > 8
Unit:         Count
```

---

**M-12: Screen Configuration Staleness Index**
```
Definition:   Composite index. For each screen, computes the age of the
              most recent intentional configuration change affecting it
              (schedule create, override create, campaign publish).
              Reports the percentage of screens with no configuration
              touch in >90 days.
Source:       audit_log JOIN screens
Computation:  COUNT(screens WHERE most_recent_config_touch > 90 days) /
              COUNT(total_screens) × 100
Update freq:  Daily
Threshold:    ADVISORY > 20%,  REVIEW > 40%
Unit:         Percent
```

---

### 5.2 Metric Grouping

Metrics group into the same six categories as the drift taxonomy:

| Category | Metrics |
|---|---|
| Override Divergence | M-01, M-02, M-11 |
| Campaign Fragmentation | M-03, M-10 |
| Shadow Scheduling | M-05 |
| Priority Escalation | M-04 |
| Sponsor Saturation | M-06, M-07 |
| Emergency Semantic Collapse | M-08, M-09 |
| Cross-category | M-12 |

---

## 6. Drift Signal Computation Rules

### 6.1 Computation Principles

All drift signals must satisfy these requirements:

1. **Derivable from current state only.** No historical event stream required for the computation itself. Trend data is supplementary, not primary.
2. **No side effects.** Signal computation never writes to the schedules, overrides, campaigns, or emergency tables.
3. **Point-in-time correctness.** A signal computed at T reflects the state at T. Recomputing at T+1 reflects T+1 state.
4. **No inference about intent.** Signals report what the system state is, not what it should be. The determination of "should" always belongs to a human operator.

### 6.2 Priority: Derived from PRE Output vs. Derived from Configuration Tables

Where possible, signals should be derived from PRE output (via `manifest_cache.manifest → reason_trace`) rather than from raw configuration tables. PRE output represents the ground truth of what screens are actually receiving, not just what is configured. A schedule row that exists but never wins resolution is invisible to PRE-derived metrics — which is correct, because it is also invisible to the screen.

When PRE output is unavailable or stale for a screen (e.g., unprovisioned screens), fall back to configuration table analysis.

### 6.3 Signal Computation Cadences

| Signal class | Computation trigger | Retention |
|---|---|---|
| Override divergence | On manifest cache write | 90 days rolling |
| Campaign coverage | Daily at 03:00 local | 180 days rolling |
| Priority range | On schedule create/delete | 90 days rolling |
| SOV warning duration | Daily at 03:00 local | 365 days rolling |
| Emergency rate | On emergency state change | 365 days rolling |
| Staleness indices | Daily at 03:00 local | 90 days rolling |

### 6.4 Threshold Definitions

Thresholds are advisory triggers, not enforcement gates. Two levels exist for all metrics:

- **ADVISORY:** Surface the signal passively. Show in venue health dashboard. Include in weekly digest. No active interruption.
- **REVIEW:** Surface the signal actively. Show as prominent indicator on relevant management screens. Include in shift handover snapshot. Recommend operator review.

No signal in this document triggers automatic blocking of any operator action. See §19 for the philosophical basis of this decision.

All threshold values should be stored in `test-config/thresholds.json` under an `operational_health` key if CI enforcement of these signals is required. At the time of this document, they are advisory only and not CI gates.

### 6.5 Override Divergence Computation

```sql
-- Per-area override divergence rate
SELECT
  a.id                           AS area_id,
  a.name                         AS area_name,
  COUNT(s.id)                    AS total_screens,
  COUNT(CASE
    WHEN mc.manifest->>'resolution_level' IN ('0','1','2')
    THEN 1 END)                  AS override_driven_screens,
  ROUND(
    COUNT(CASE
      WHEN mc.manifest->>'resolution_level' IN ('0','1','2')
      THEN 1 END)::numeric
    / NULLIF(COUNT(s.id), 0) * 100, 1
  )                              AS divergence_pct
FROM areas a
JOIN screens s        ON s.area_id = a.id
LEFT JOIN manifest_cache mc ON mc.screen_id = s.id
WHERE s.status = 'active'
GROUP BY a.id, a.name;
```

### 6.6 Campaign Coverage Computation

```sql
-- Campaign coverage rate per venue
SELECT
  v.id                           AS venue_id,
  v.name                         AS venue_name,
  COUNT(sc.id)                   AS total_active_schedules,
  COUNT(CASE
    WHEN sc.campaign_id IS NOT NULL
    THEN 1 END)                  AS campaign_managed,
  ROUND(
    COUNT(CASE
      WHEN sc.campaign_id IS NOT NULL
      THEN 1 END)::numeric
    / NULLIF(COUNT(sc.id), 0) * 100, 1
  )                              AS campaign_coverage_pct
FROM venues v
JOIN schedules sc ON (
  sc.venue_id = v.id OR
  EXISTS (
    SELECT 1 FROM screens s
    JOIN areas a ON s.area_id = a.id
    WHERE a.venue_id = v.id AND s.id = sc.screen_id
  )
)
WHERE (sc.ends_at IS NULL OR sc.ends_at > NOW())
GROUP BY v.id, v.name;
```

### 6.7 SOV Projection Computation

```sql
-- 30-day forward SOV projection: for each day, sum active contracts
SELECT
  gs.day,
  COALESCE(SUM(sp.share_of_voice), 0) AS projected_sov_pct
FROM generate_series(
  NOW()::date,
  (NOW() + INTERVAL '30 days')::date,
  INTERVAL '1 day'
) AS gs(day)
LEFT JOIN sponsorship_contracts sp ON (
  sp.org_id = :org_id
  AND (sp.starts_at IS NULL OR sp.starts_at::date <= gs.day)
  AND (sp.ends_at   IS NULL OR sp.ends_at::date   >= gs.day)
)
GROUP BY gs.day
ORDER BY gs.day;
```

---

## 7. Staleness Detection

### 7.1 Why Staleness Matters

A configuration row that was correct when created and has had no human attention since may no longer be correct. The system has no way to know this — it can only know when a row was last touched, not whether the original intent still holds.

Staleness detection identifies rows that warrant human review. It does not identify rows that are wrong. That determination requires human judgment.

### 7.2 Staleness Classification

**Class A — Permanent with no review:**
Configuration rows with no expiry (`expires_at IS NULL`) and no modification (`updated_at`, if tracked, equals `created_at`) for >30 days.

Applies to: `overrides`, direct `schedules` (no `campaign_id`).

Signal: Candidate for operator review. Not automatically expired.

---

**Class B — Expiry-adjacent:**
Configuration rows whose `expires_at` is within 7 days. These will expire soon. If they represent ongoing operational need, they require renewal. If they are no longer needed, they are self-resolving. Either way, they warrant attention.

Applies to: `overrides`, `sponsorship_contracts`, `campaigns`.

Signal: Expiry reminder. Not automatically renewed.

---

**Class C — Shadow survivors:**
Configuration rows that have never won PRE resolution in the last 30 days (as evidenced by their `content_id` not appearing in `screen_delivery_log` for any screen in their target scope during a period when the row was active).

Applies to: `schedules` (all types).

Signal: Likely inert due to priority escalation or scope mismatch. Candidate for removal review.

**Note:** This requires cross-referencing `screen_delivery_log` with `schedules` and is more computationally expensive than Class A/B. Run daily, not on-demand.

---

**Class D — Operator-absent:**
Override rows where the `issued_by` user has not logged in for >60 days. The person who created the override and would best understand its intent is no longer active. This is not grounds for removal, but it is grounds for ownership reassignment review.

Applies to: `overrides`.

Signal: Ownership audit flag.

---

### 7.3 Staleness Index Computation

The staleness index for a venue is the weighted sum of stale-class items, normalized to a 0–100 score. Lower is better.

```
staleness_index = (
  (class_A_count × 3) +
  (class_C_count × 2) +
  (class_D_count × 1)
) / total_active_configuration_rows × 100
```

Weights reflect severity of the staleness class. Class A (permanent, unreviewed) is the most operationally risky. Class D (orphaned ownership) is the least risky but still warrants attention.

This index is informational. It is never used as an enforcement gate.

---

## 8. Preview Surfaces

### 8.1 The Preview Gap

The single most powerful driver of shadow scheduling, priority escalation, and override accumulation is the absence of a way to answer the question: **"What will actually play on this screen at this time?"**

Without a preview surface, operators cannot verify that their configuration will have the effect they intend. They cannot diagnose why content is not appearing. They cannot confirm that a campaign will reach the screens they expect. They resort to trial-and-error: create a row, wait for the poll cycle, observe whether the desired result occurred, create another row if it did not.

Each trial-and-error cycle creates configuration. Not all of that configuration is cleaned up after the test. Over time, the accumulation of exploratory configuration degrades the system state.

The PRE is already a pure function with no side effects. Calling it with a hypothetical input has zero cost to system state. The preview surface is not a new capability — it is an exposure of an existing one.

### 8.2 Required Preview Surfaces

**Surface P-1: Screen Playback Preview**

Answer: "What would play on screen X at time T?"

Input: `screen_id`, `t` (ISO 8601, default: now)
Output: PRE output including `content_mix`, `reason_trace`, `resolution_level`, `confidence_score`
Implementation: `GET /api/preview/screen/:id?at=ISO8601` (§9)

This is the highest-leverage single feature for entropy prevention. It directly addresses the root cause of shadow scheduling (Scenario 5), override accumulation feedback loop gap (Scenario 1), and campaign fragmentation (Scenario 4 — operators who could verify campaign delivery would not need to duplicate).

---

**Surface P-2: Campaign Delivery Preview**

Answer: "If I publish this campaign, which screens will it reach? Which will it not reach?"

Input: `campaign_id` (in draft or review state)
Output: Per-screen breakdown showing: screens that will receive the campaign (no higher-specificity override), screens that will NOT receive it (active override wins), screens currently unreachable (unprovisioned/offline)
Implementation: `GET /api/campaigns/:id/delivery-preview`

Computed by: For each screen in the campaign's target scope, run `PRE.resolve(screen_id, NOW(), state_with_campaign_published)` and check whether the campaign's content appears in `content_mix`.

This surface directly addresses the "false confidence after campaign publish" failure mode in Scenarios 1 and 4.

---

**Surface P-3: Override Impact Preview**

Answer: "If I create an override targeting scope X, which screens does it affect? Which schedules does it shadow?"

Input: `target_type`, `target_id`, `content_id`, `expires_at` (proposed override parameters)
Output: List of screens affected, their current resolution source (what the override would replace), and any campaigns that would be shadowed
Implementation: `GET /api/overrides/preview`

This surface directly addresses the "override as scheduling tool" failure mode in Scenario 5 and the unaware campaign shadowing in Scenario 1.

---

**Surface P-4: Area Schedule Reality Check**

Answer: "For this area, how many screens are actually receiving the area schedule vs. receiving something else?"

Input: `area_id`
Output: Per-screen breakdown of current `reason_trace.resolution_level`, override details for diverging screens, and `override_divergence_pct` (M-01)
Implementation: `GET /api/areas/:id/screen-resolution-summary`

This surface is the primary operational tool for diagnosing override divergence (Scenario 1).

---

### 8.3 Preview Surface Data Freshness

All preview surfaces call the PRE with the current system state from the database. They do not use cached manifests. The latency of a preview call is the latency of `PRE.resolve()` against live database state — acceptable for interactive use, not suitable for high-frequency polling.

Preview surfaces are explicitly read-only. They do not write to `manifest_cache`, `screen_versions`, or any other table.

---

## 9. PRE Preview Endpoint Specification

### 9.1 Endpoint Contract

```
GET /api/preview/screen/:screen_id
```

#### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `at` | ISO 8601 | `now()` | The moment in time for which to resolve. Must be parseable as a valid timestamp. Future timestamps are allowed. |
| `trace` | boolean | `true` | Include full `reason_trace` in response. Set false to reduce payload for list views. |

#### Response: 200 OK

```json
{
  "screen_id": "bar-tv-01",
  "resolved_at": "2026-05-17T19:00:00.000Z",
  "resolution_level": 5,
  "resolution_source": "structural",
  "is_fallback": false,
  "confidence_score": 0.97,
  "content_mix": [
    {
      "content_id": "uuid-1",
      "duration_ms": 10000,
      "weight": 2,
      "source": "campaign:happy-hour-v2",
      "sponsored": false
    },
    {
      "content_id": "uuid-2",
      "duration_ms": 15000,
      "weight": 1,
      "source": "sponsorship:acme-beer",
      "sponsored": true
    }
  ],
  "reason_trace": {
    "level_0_emergency": null,
    "level_1_operational_override": null,
    "level_2_scheduled_override": null,
    "level_3_campaign": {
      "campaign_id": "uuid-campaign",
      "campaign_name": "Happy Hour v2",
      "schedule_id": "uuid-schedule",
      "won_by": "specificity:area > priority:15"
    },
    "level_4_sponsorship": {
      "contracts_active": 2,
      "total_sov_pct": 63.0,
      "sov_warning_active": true,
      "injected_items": ["uuid-2"]
    },
    "level_5_structural": null,
    "level_6_device_truth": {
      "confidence_score": 0.97,
      "last_seen_ms_ago": 12400,
      "checksum_match": true
    }
  },
  "divergence_advisory": {
    "has_active_overrides": false,
    "area_schedule_diverged": false
  },
  "computed_ms": 14,
  "preview": true
}
```

#### Response: 404 Not Found

```json
{
  "error": "SCREEN_NOT_FOUND",
  "screen_id": "unknown-screen"
}
```

#### Response: 400 Bad Request

```json
{
  "error": "INVALID_AT_PARAMETER",
  "detail": "Parameter 'at' could not be parsed as a valid ISO 8601 timestamp"
}
```

### 9.2 Behavioral Specification

1. **No side effects.** This endpoint MUST NOT write to `manifest_cache`, `screen_versions`, `screen_delivery_log`, `audit_log`, or any other table. It is pure read.

2. **Uses live state.** This endpoint calls `PRE.resolve()` against live database state, bypassing `manifest_cache`. It does not read from or write to the cache.

3. **Future timestamps are valid.** `at` may be in the future. PRE resolution for a future timestamp reflects scheduled content windows at that time. Emergency and override states at a future time are assumed to be current (no time travel of override state is performed).

4. **`preview: true` marker.** The response always includes `"preview": true` to prevent client code from mistakenly treating a preview response as the canonical served manifest.

5. **`divergence_advisory` field.** This field is always present and reports:
   - `has_active_overrides`: whether any override is currently active for this screen's scope chain
   - `area_schedule_diverged`: whether the resolved content differs from what would be resolved if all overrides were absent

6. **Auth.** The preview endpoint requires the same authentication as the schedules and campaign management APIs. It is not publicly accessible.

7. **Rate limiting.** Preview calls are subject to the same rate limiting as other management API calls. They are not on the manifest hot path and do not share its rate limit budget.

8. **`computed_ms` field.** Always present. Allows operators and tooling to observe PRE resolution latency under real load.

### 9.3 Implementation Notes

The implementation is a thin wrapper over `PRE.resolve()`:

```js
// GET /api/preview/screen/:screen_id
router.get('/preview/screen/:screen_id', async (req, res) => {
  const { screen_id } = req.params;
  const at = req.query.at ? new Date(req.query.at).getTime() : Date.now();

  if (isNaN(at)) {
    return res.status(400).json({
      error: 'INVALID_AT_PARAMETER',
      detail: "Parameter 'at' could not be parsed as a valid ISO 8601 timestamp"
    });
  }

  const ctx = await buildContext(screen_id, db);
  if (!ctx) {
    return res.status(404).json({ error: 'SCREEN_NOT_FOUND', screen_id });
  }

  const start = Date.now();
  const result = PRE.resolve(screen_id, at, ctx);
  const computed_ms = Date.now() - start;

  // Divergence advisory: re-resolve with overrides filtered out
  const ctxNoOverrides = { ...ctx, overrides: [] };
  const baseline = PRE.resolve(screen_id, at, ctxNoOverrides);
  const diverged = result.checksum !== baseline.checksum;

  return res.json({
    ...result,
    divergence_advisory: {
      has_active_overrides: ctx.overrides.length > 0,
      area_schedule_diverged: diverged,
    },
    computed_ms,
    preview: true,
  });
});
```

---

## 10. Advisory UX Rules

### 10.1 Governing Principle

Advisory UX surfaces information. It does not make decisions. Every advisory element must be ignorable without consequence to the operator's immediate task. An advisory that blocks a workflow is not an advisory — it is enforcement. This document does not sanction enforcement. See §19.

### 10.2 Advisory Tier Definitions

**Tier 1 — Passive (information):**
Shown as ambient context in the relevant management screen. No special formatting. No call to action required. Example: "3 screens in this area have active overrides."

**Tier 2 — Noticed (soft warning):**
Shown with visual distinction (distinct color, icon, or placement). Operator acknowledges by dismissal or proceeds without acknowledgment. Example: "Override age warning: this override has been active for 47 days with no expiry."

**Tier 3 — Confirmed (friction gate):**
Shown as a modal or inline confirmation before a write action. Operator must take an explicit action (confirm or cancel) to proceed. Used only when the write action has a high probability of creating a configuration pattern associated with entropy. Example: "This content already exists in an active campaign for this area during this time window. Creating a duplicate schedule may cause unintended frequency amplification. Proceed?"

**Tier 3 is the maximum friction level in this document.** There is no Tier 4 (block). See §19.

### 10.3 Per-Action Advisory Rules

**On: Override creation with `expires_at IS NULL`**
- Tier 2: "Permanent overrides act like high-priority schedules and persist until manually removed. If this is operational content rather than a correction, consider using a Schedule or Campaign instead."
- Tier 2 escalates to Tier 3 if: the area already has M-01 > 15% override divergence rate.

**On: Override creation when area has active campaign**
- Tier 2: "This override will shadow [campaign name] for [N] screens in this area. Screens affected: [list]."
- Derived from Surface P-3 (§8.2).

**On: Schedule creation when `content_id` already active in same scope**
- Tier 3: "This content is already active in [source] for this scope during this time window. Creating a duplicate may amplify its frequency beyond intent. Proceed?"

**On: Schedule creation with priority > `(max_active_priority_in_scope × 0.8)`**
- Tier 2: "Schedules above priority [X] may shadow [N] existing schedules in this area. Consider reviewing existing schedule priorities."

**On: Emergency activation (non-`global` scope)**
- Tier 3 (always): "Emergency activation immediately overrides all content for [scope]. Reason (required): [___]. This activation will be logged with your name and timestamp. Confirm?"
- If `emergency_activations_30d > 3`:
  - Add to Tier 3 text: "Note: Emergency has been activated [N] times in the last 30 days for this venue. Consider whether operational overrides are more appropriate."

**On: Sponsorship contract creation when `total_sov + new_contract_sov > SOV_WARNING_THRESHOLD`**
- Tier 3: "Adding this contract will bring total share-of-voice to [X%], which exceeds the advisory threshold of [SOV_WARNING_THRESHOLD%]. This will trigger a standing SOV warning. Current warning has been active for [N] days. Proceed?"

**On: Campaign publish**
- Tier 1: Show delivery preview (Surface P-2). "This campaign will be received by [N] of [total] screens in the target scope. [M] screens have active overrides and will not receive this campaign: [list if M ≤ 5, else 'View full list']."
- No friction gate for publish itself — operator is informed, not blocked.

### 10.4 Advisory Display Rules

1. **Advisories do not stack into noise.** If a single action would trigger multiple advisories, consolidate them into a single advisory block. Show the highest tier that applies. Do not show three separate modals.

2. **Advisories are not persistent banners.** A Tier 2 advisory shown at action time is not a permanent banner on the management screen. It appears when the context is relevant, not as ambient noise.

3. **Tier 3 confirmations remember nothing.** A confirmed Tier 3 dialog does not suppress future instances. The next time the same action would trigger the advisory, it triggers again. The friction should be felt each time, not dismissed once.

4. **Advisory text names the specific entities involved.** "3 screens have overrides" is weaker than "bar-tv-02, bar-tv-07, and bar-tv-11 have overrides." Where entity counts are small (≤ 5), name them. Where counts are large, provide a count and a drill-down link.

5. **Advisories reference the relevant preview surface.** Every advisory about configuration conflict or override shadowing should link to the PRE preview surface (§9) for the affected screens.

---

## 11. Non-Goals

This section explicitly defines what this document does not prescribe. These non-goals are constraints, not oversights. Each represents a deliberate decision about where the system's authority ends and human authority begins.

### 11.1 No Automatic Correction

The system MUST NOT automatically remove, expire, modify, or archive any schedule, override, campaign, or sponsorship contract in response to drift signals.

**Reason:** Automatic correction introduces a second source of mutations — the system itself — that operators must reason about. A schedule that disappears because the system decided it was stale is indistinguishable from a schedule that was maliciously or accidentally deleted. Operators lose trust in the configuration state. The system becomes unauditable.

### 11.2 No Autonomous Priority Rebalancing

The system MUST NOT automatically adjust priority values on existing schedule rows in response to priority escalation signals.

**Reason:** Priority values represent an operator's explicit configuration decision. Automatically lowering priority to "normalize" the range would change playback outcomes without operator authorization.

### 11.3 No Silent Override Expiry

The system MUST NOT automatically expire overrides based on age, even when they are flagged as Class A stale.

**Reason:** An override that looks stale may be intentional. An override that has been active for 90 days may be a permanent operational configuration for a specific screen. Only the operator who created it (or their designated successor) can determine this. Silent expiry removes content from a screen with no warning.

### 11.4 No Automatic SOV Rebalancing

The system MUST NOT automatically cancel or reduce sponsorship contracts in response to SOV warning signals.

**Reason:** Sponsorship contracts are legal and financial commitments. Automatic modification of contract parameters would have commercial consequences beyond the system's authority.

### 11.5 No ML-Driven Inference of Intent

The system MUST NOT use machine learning, heuristics, or pattern matching to infer what an operator "probably" intended and act on that inference.

**Reason:** Inferred intent is unauditable. If the system takes action based on what it believes an operator wanted, and that inference is wrong, the operator has no way to reconstruct why the system acted. All system actions that modify configuration must trace to an explicit human decision.

### 11.6 No Entropy Score as a Gate

The entropy score (§13) and venue operational health model (§14) MUST NOT be used as gates that block operator actions.

**Reason:** An operator managing a venue with a high entropy score has the same right to publish campaigns and create schedules as an operator managing a clean venue. The score is informational. It helps prioritize operational review time. It does not modify rights.

### 11.7 No Cross-Venue Normalization

The system MUST NOT apply drift thresholds or advisory rules that compare one venue to another, generating advisories like "this venue has higher override divergence than similar venues."

**Reason:** Venues have genuinely different operational contexts. A venue with many per-screen permanent configurations is not necessarily worse than one with fewer — it may have more idiosyncratic screens. Cross-venue comparison generates noise without context.

---

## 12. Why PRE Must Remain Pure

### 12.1 The Purity Guarantee

PRE-REFERENCE-IMPLEMENTATION-v1.md §3 defines the PRE as a pure function:

```
PRE(screen_id, t, SystemState) → PRE_Output
```

**Pure** means: given identical inputs, produces identical outputs. No side effects. No state mutation. No network calls. No database writes.

This document does not modify this guarantee. Nothing in the observability and entropy detection layer ever passes modified or synthetic state to the PRE.

### 12.2 Why Drift Detection Must Not Enter the PRE

There is a tempting architectural shortcut: build entropy detection directly into the PRE resolution algorithm. For example, the PRE could:
- Detect when it is about to apply a very old override and flag it
- Detect when two schedules have the same content and emit a warning
- Track emergency activation frequency and modify resolution behavior

This would be an architectural error. Here is why:

**INV-1 (Purity) would be violated.** The PRE as a pure function has no memory of previous invocations. It cannot detect patterns across calls. Any pattern detection requires state — which means side effects — which violates INV-1.

**INV-3 (Determinism) would be threatened.** A PRE that modifies its own behavior based on detected patterns would produce different outputs for the same inputs over time. The checksum and version system depends on INV-3.

**The separation of concerns is architecturally correct.** The PRE is responsible for resolving the current state correctly. The observability layer is responsible for detecting whether the current state reflects operator intent. These are different concerns. Mixing them produces a system where neither concern is handled cleanly.

**Operators would lose trust.** A PRE that "notices" patterns and changes its behavior based on them would be unpredictable to operators. The guarantee "the PRE always resolves according to the configured rules" is the foundation of operator confidence. Any entropy detection that lives inside the PRE erodes this guarantee.

### 12.3 The Correct Architecture

Entropy detection observes PRE output. It does not modify PRE input or behavior.

```
SystemState  ──────────► PRE.resolve() ──────────► PRE_Output
                                │
                                │ (read-only)
                                ▼
                    EntropyDetector.analyze(PRE_Output, SystemState)
                                │
                                ▼
                    ObservabilityLayer.surface(signals)
                                │
                                ▼
                    Operator makes informed decision
```

The EntropyDetector reads PRE output and system state. It writes only to observability tables (signals, health metrics, audit summaries). It never writes to configuration tables. The PRE is never modified.

### 12.4 Immutability as a Correctness Guarantee

The PRE's purity is not merely a design preference — it is a correctness guarantee for the entire platform. Proof-of-play records, manifest version tracking, cache invalidation, and CI testing all depend on the PRE being a function that can be called, reasoned about, and tested in isolation.

If entropy detection logic were embedded in the PRE, the PRE would become non-deterministic under certain accumulation conditions, non-testable in isolation, and non-auditable for the "what would have played" queries that operators need.

The observability architecture in this document deliberately preserves the PRE as a stable, testable, immutable core. All complexity added for entropy detection lives outside it.

---

## 13. Entropy Scoring Model

### 13.1 Purpose

The entropy score is a single dimensionless number in [0, 100] that summarizes the operational health of a venue's configuration. A score of 0 represents a perfectly clean configuration state (all screens on area schedules, all schedules in campaigns, no escalated priorities, no stale overrides). A score of 100 represents the maximum observed degradation across all metric dimensions.

The score is not a grade. It is a triage tool. It tells operators which venues deserve attention during their next operational review cycle. It does not tell them what is wrong — the underlying metrics do that.

### 13.2 Component Weights

| Metric | Weight | Rationale |
|---|---|---|
| M-01 Override Divergence Rate | 25% | Most direct signal of active configuration-intent gap |
| M-03 Campaign Coverage Rate (inverted) | 20% | Reflects structural governance integrity |
| M-04 Priority Range Width (normalized) | 15% | Reflects escalation debt |
| M-06 SOV Warning Duration (normalized) | 15% | Reflects financial and editorial integrity risk |
| M-08 Emergency Activation Rate (normalized) | 10% | Reflects semantic collapse risk |
| M-11 Override-as-Schedule Count (normalized) | 10% | Reflects tool misuse |
| M-12 Configuration Staleness Index | 5% | Reflects knowledge retention risk |

### 13.3 Score Computation

Each component metric is normalized to [0, 100] before weighting. The normalization maps the metric's ADVISORY threshold to 50 and the REVIEW threshold to 80. Values below the ADVISORY threshold map to [0, 50] proportionally. Values above the REVIEW threshold asymptotically approach 100.

```
normalize(value, advisory_threshold, review_threshold):
  if value <= 0:
    return 0
  if value <= advisory_threshold:
    return (value / advisory_threshold) × 50
  if value <= review_threshold:
    return 50 + ((value - advisory_threshold) /
                 (review_threshold - advisory_threshold)) × 30
  else:
    # Asymptotic approach to 100 above review threshold
    excess = value - review_threshold
    return min(100, 80 + 20 × (1 - e^(-excess / review_threshold)))
```

**Note:** For inverted metrics (M-03 Campaign Coverage Rate, where lower is worse), the input value is `100 - metric_value` before normalization.

**Entropy Score:**
```
entropy_score = round(
  0.25 × normalize(M-01, 15, 30)   +
  0.20 × normalize(100-M-03, 40, 70) +
  0.15 × normalize(M-04, 100, 200) +
  0.15 × normalize(M-06, 7, 14)    +
  0.10 × normalize(M-08, 3, 6)     +
  0.10 × normalize(M-11, 3, 8)     +
  0.05 × normalize(M-12, 20, 40)
)
```

### 13.4 Score Interpretation

| Score range | Label | Recommended cadence |
|---|---|---|
| 0–20 | Healthy | Monthly review |
| 21–40 | Nominal | Bi-weekly review |
| 41–60 | Drifting | Weekly review |
| 61–80 | Degraded | Immediate review recommended |
| 81–100 | Critical | Same-day review |

### 13.5 Score Limitations

The entropy score is a summary. It can be misleading in two directions:

**False high:** A venue with many intentional per-screen overrides (e.g., a hotel with hundreds of genuinely idiosyncratic displays) will score high on M-01 even if every override is correct. The score doesn't know the difference between intentional divergence and accidental divergence.

**False low:** A venue where all entropy is concentrated in one metric (e.g., extremely high emergency frequency but clean schedules) may score lower than a venue with moderate degradation across all metrics. The average obscures pathologies.

For these reasons, the score is always displayed alongside the individual component metrics, not in isolation.

---

## 14. Venue Operational Health Model

### 14.1 Health Model Structure

The venue operational health model is a structured summary of all entropy signals for a single venue at a point in time. It is the atomic unit of operational review.

```json
{
  "venue_id": "venue-1",
  "venue_name": "The Rusty Anchor",
  "computed_at": "2026-05-17T03:00:00Z",
  "entropy_score": 47,
  "score_label": "Drifting",
  "metrics": {
    "M-01_override_divergence_pct": { "value": 22, "status": "REVIEW" },
    "M-02_stale_permanent_overrides": { "value": 4, "status": "ADVISORY" },
    "M-03_campaign_coverage_pct": { "value": 51, "status": "ADVISORY" },
    "M-04_priority_range_width": { "value": 85, "status": "NOMINAL" },
    "M-05_duplicate_content_pairs": { "value": 2, "status": "NOMINAL" },
    "M-06_sov_warning_active_days": { "value": 0, "status": "NOMINAL" },
    "M-07_editorial_content_pct": { "value": 72, "status": "NOMINAL" },
    "M-08_emergency_activations_30d": { "value": 5, "status": "REVIEW" },
    "M-09_emergency_reason_completion": { "value": 40, "status": "REVIEW" },
    "M-10_orphaned_schedule_count": { "value": 7, "status": "ADVISORY" },
    "M-11_override_as_schedule_count": { "value": 3, "status": "ADVISORY" },
    "M-12_config_staleness_index": { "value": 18, "status": "NOMINAL" }
  },
  "active_review_items": [
    {
      "category": "Emergency Semantic Collapse",
      "severity": "REVIEW",
      "description": "Emergency activated 5 times in 30 days. 3 of 5 activations had no stated reason.",
      "action_recommendation": "Review emergency activation log and establish operational protocol for when emergency vs. override is appropriate.",
      "related_metrics": ["M-08", "M-09"]
    },
    {
      "category": "Override Divergence",
      "severity": "REVIEW",
      "description": "22% of screens diverged from area schedule via active overrides. 4 permanent overrides are older than 30 days.",
      "action_recommendation": "Review stale overrides in the Bar and Dining areas. Confirm each is still intentional.",
      "related_metrics": ["M-01", "M-02"]
    }
  ],
  "advisory_items": [
    {
      "category": "Campaign Fragmentation",
      "severity": "ADVISORY",
      "description": "49% of active schedules have no campaign parent. 7 direct schedules are older than 60 days with no expiry.",
      "action_recommendation": "Consider consolidating direct schedules into campaigns at next content review cycle.",
      "related_metrics": ["M-03", "M-10"]
    }
  ],
  "trend": {
    "entropy_score_7d_ago": 39,
    "entropy_score_delta": "+8",
    "primary_driver": "emergency_frequency_increase"
  }
}
```

### 14.2 Per-Area Health Sub-Model

For venues with multiple areas, the health model includes per-area breakdowns for the metrics that are area-scoped (M-01, M-02, M-03, M-04, M-05, M-10, M-11).

```json
"areas": [
  {
    "area_id": "area-bar",
    "area_name": "Bar",
    "screens_total": 8,
    "screens_on_override": 3,
    "override_divergence_pct": 37.5,
    "override_divergence_status": "REVIEW",
    "campaign_coverage_pct": 44,
    "campaign_coverage_status": "ADVISORY"
  }
]
```

### 14.3 Health Model Retention

Health model snapshots are computed daily and retained for 90 days. This provides:
- 90-day trend for entropy score
- Per-metric trend visibility
- Before/after comparison for operational interventions

Health model snapshots are written to a dedicated `venue_health_snapshots` table (not defined in current BACKEND-ARCHITECTURE-v1.md — to be added in a subsequent migration when operational tooling is implemented).

---

## 15. Time-Based Drift Analysis

### 15.1 Why Time Is Essential

Many entropy patterns are only visible in trend, not in point-in-time state. A venue with 22% override divergence looks the same whether it reached that state in 3 days (sudden problem) or 8 months (gradual drift). The appropriate response differs significantly.

Time-based drift analysis answers:
- Is this metric getting better or worse?
- At what rate is entropy accumulating?
- Did an operational event (new staff, campaign launch, seasonal change) correlate with a drift increase?

### 15.2 Drift Rate Metrics

For each health metric, compute:

**7-day delta:** `metric_today - metric_7d_ago`. Positive is worsening (for most metrics). Negative is improving.

**30-day trend slope:** Linear regression over the past 30 daily snapshots. Expressed as `units_per_week`. A slope > 0 on override divergence means the venue is accumulating 1 additional percentage point of divergence per week.

**Acceleration:** Second derivative of the 30-day trend. Positive acceleration means the rate of degradation is itself increasing — a leading indicator that the primary driver is compounding.

### 15.3 Event Correlation

The `audit_log` table records all configuration mutations with `occurred_at` timestamps. Time-based drift analysis should surface:

- The 3 most recent major configuration events (campaign publish, bulk override creation, emergency activation) near inflection points in the entropy score trend
- Correlation coefficient between specific event types and metric delta over trailing 30 days

This enables operators to answer "what changed when our override divergence jumped?" without manual log analysis.

### 15.4 Scenario-Specific Time Patterns

**Override Accumulation (Scenario 1):** Override divergence rate trends upward monotonically for 6–10 weeks, then plateaus. The plateau is a stable degraded state. Interventions are most effective before the plateau — during the accumulation phase.

**SOV Drift (Scenario 2):** SOV warning duration is the key time-based metric. A warning that has been active for 0 days is actionable. A warning active for 21 days has likely been normalized by the operator team. The recovery cost is higher.

**Emergency Misuse (Scenario 3):** Emergency activation rate follows an increasing trend with no natural plateau. Once the mental model shift occurs ("emergency = immediate flush"), the rate will increase until a significant disruption (actual emergency event, management intervention, team change).

**Campaign Fragmentation (Scenario 4):** Campaign coverage rate trends downward at a rate correlated with the number of "direct schedule creation" events. The rate of coverage decline accelerates after knowledge transfer events.

**Priority Escalation (Scenario 5):** Priority range width trends upward monotonically. Unlike override divergence, priority escalation has no natural plateau — the range can grow indefinitely. Rate of growth correlates with the frequency of "schedule not winning" support requests.

---

## 16. Observability Architecture

### 16.1 Component Overview

The observability architecture has three layers that explicitly do not interact with the PRE's execution path:

```
┌─────────────────────────────────────────────────────────────┐
│                    COLLECTION LAYER                          │
│                                                             │
│   manifest_cache writes → resolution_level extraction       │
│   schedule/override/campaign mutations → audit_log          │
│   emergency activate/clear → emergency_states               │
│   delivery confirmation → screen_delivery_log               │
└────────────────────────────┬────────────────────────────────┘
                             │ (async, no hot path impact)
┌────────────────────────────▼────────────────────────────────┐
│                  COMPUTATION LAYER                           │
│                                                             │
│   Daily batch job: compute all M-01 through M-12            │
│   Write to: venue_health_snapshots                          │
│   On-demand: recompute for active management sessions       │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                   SURFACE LAYER                              │
│                                                             │
│   GET /api/venues/:id/health          venue health model    │
│   GET /api/areas/:id/screen-summary   area resolution view  │
│   GET /api/preview/screen/:id         PRE preview           │
│   GET /api/campaigns/:id/preview      delivery preview      │
│   Dashboard: Venue Operational Health                        │
│   Shift Handover Snapshot                                    │
└─────────────────────────────────────────────────────────────┘
```

### 16.2 Collection Layer Requirements

**Manifest cache writes** must extract and store `resolution_level` from the PRE output. This does not change the manifest cache schema if `manifest` is stored as JSONB — `manifest->>'resolution_level'` is queryable directly.

**Configuration mutations** are already written to `audit_log` (per BACKEND-ARCHITECTURE-v1.md). The collection layer does not require new audit logging — it requires that the existing audit log is indexed for health metric computation queries. Required index:

```sql
CREATE INDEX IF NOT EXISTS idx_audit_entity_occurred
  ON audit_log(entity_type, entity_id, occurred_at DESC);
```

**Emergency state changes** are already in `emergency_states`. No new collection required.

**Delivery log** is already captured in `screen_delivery_log`. No new collection required.

### 16.3 Computation Layer Design

The daily batch job runs at 03:00 local venue time for each venue. It:
1. Reads all required source tables for the venue
2. Computes M-01 through M-12
3. Computes the entropy score
4. Writes a `venue_health_snapshots` row
5. Emits a `venue.health.computed` event to the event bus for downstream consumers

The daily batch job MUST NOT:
- Write to configuration tables
- Trigger cache invalidation
- Emit events that cause downstream configuration changes

On-demand recomputation (triggered by management API calls) uses the same computation logic but writes to a session cache (TTL: 5 minutes) rather than the persistent snapshot table. This prevents excessive snapshot writes from interactive use.

### 16.4 Surface Layer API Contracts

```
GET /api/venues/:id/health
  Response: VenueHealthModel (§14.1)
  Auth: venue manager or above
  Cache: 5-minute TTL, invalidated on any configuration mutation for the venue

GET /api/venues/:id/health/trend
  Query params: days (default: 30, max: 90)
  Response: Array of VenueHealthModel snapshots, one per day
  Auth: venue manager or above

GET /api/areas/:id/screen-resolution-summary
  Response: Per-screen breakdown of current resolution_level + override details
  Auth: venue manager or above
  Cache: 60-second TTL

GET /api/venues/:id/stale-configurations
  Response: Classified list of Class A, B, C, D stale configuration rows (§7.2)
  Auth: venue manager or above
  Cache: 5-minute TTL
```

### 16.5 Event Bus Integration

Entropy signals that cross into REVIEW territory should be emitted as events on the `event_bus` table for downstream subscription:

```sql
-- Event emitted when any venue metric crosses REVIEW threshold
INSERT INTO event_bus (event_type, payload) VALUES (
  'venue.health.review_threshold_crossed',
  '{
    "venue_id": "...",
    "metric": "M-01",
    "value": 32,
    "threshold": 30,
    "entropy_score": 54
  }'
);
```

Downstream consumers (notification services, weekly digest generators) subscribe to these events. The event bus is write-once; no event modifies configuration.

---

## 17. Recommended Dashboards

### 17.1 Venue Operational Health Dashboard

**Audience:** Venue managers, operations leads
**Update cadence:** Daily snapshot, on-demand refresh available

**Top section: Summary**
- Venue entropy score (gauge, color-coded by range)
- 30-day score trend (sparkline)
- Count of REVIEW-status metrics (badge)
- Count of ADVISORY-status metrics (badge)

**Middle section: Metric detail table**
All 12 metrics displayed in two columns (name, value, status, 7-day delta). Sortable by status. Status shown as colored indicators (green/amber/red). Clicking a metric opens the detail view for that metric.

**Bottom section: Active review items**
Structured list of review items from the health model (§14.1). Each item shows category, description, and action recommendation. Links to the relevant management screen (stale overrides list, area screen summary, etc.).

**Right panel: Screen resolution map**
Visual representation of all screens in the venue, color-coded by their current `resolution_level` (structural = green, override = amber, emergency = red, fallback = grey). Clicking a screen opens the PRE preview for that screen.

---

### 17.2 Screen Resolution Map

**Audience:** Shift managers, venue operators
**Update cadence:** Real-time (polls screen resolution summary endpoint every 60s)

**Display:**
- Grid or floor-plan view of all screens
- Each screen shows: content name (from latest manifest), resolution source ("Area Schedule," "Override: [issuer]," "Emergency"), override age if applicable
- Screens with active overrides older than 30 days shown with staleness indicator
- Screens with `is_fallback = true` shown with distinct fallback indicator

**Action integration:**
- Click any screen to open PRE preview for that screen at current time
- Click overriding row link to open the override detail
- "Review All Overrides" button linking to stale configurations list

---

### 17.3 Stale Configuration Review Screen

**Audience:** Venue managers, during operational review cycles
**Update cadence:** Daily

**Display:**
Tabbed view, one tab per staleness class (A, B, C, D).

For each row:
- Entity type, entity ID, age, scope, created by
- "What is this affecting now?" — links to PRE preview for affected screens
- Action buttons: [Set Expiry] [Add Note] [Mark Reviewed] — not [Delete] (deletion is a separate confirmed action on the override/schedule management screens)

The "Mark Reviewed" action writes to `audit_log` that an operator reviewed this row and confirmed it is still intentional. This creates an audit trail of conscious decisions without forcing removal.

---

### 17.4 Emergency Activation Log

**Audience:** Operations leads, venue managers
**Update cadence:** Real-time

**Display:**
Chronological list of all emergency activations with:
- Activated by, activated at, scope, content, reason (or "[no reason provided]")
- Duration (if cleared) or "[ACTIVE]"
- Category (if `category` field is added per §3 guardrail suggestion)
- Rolling 30-day count badge

**Filter controls:**
- Date range
- Scope filter
- "No reason provided" filter (immediately surfaces M-09 violations)
- Duration filter (>4 hours shows operational misuse pattern)

---

### 17.5 Multi-Venue Operations View

**Audience:** Multi-venue franchise operators, central operations teams
**Update cadence:** Daily

**Display:**
Table of all venues with:
- Venue name
- Entropy score (colored gauge)
- Top REVIEW-status metric name
- 7-day score delta
- Last reviewed timestamp (from audit_log "Mark Reviewed" actions)

Sortable by entropy score descending. Clicking a venue opens the Venue Operational Health Dashboard for that venue.

This view enables operations leads to prioritize their review time across a fleet without requiring them to inspect each venue individually.

---

## 18. Operational Review Workflows

### 18.1 Weekly Entropy Review

**Participants:** Venue manager + shift leads
**Duration:** 15–30 minutes
**Cadence:** Weekly

**Process:**
1. Open Venue Operational Health Dashboard
2. Review REVIEW-status items first. For each: understand what happened, decide whether the configuration is still intentional, take action or mark as reviewed-and-intentional.
3. Review ADVISORY-status items. No action required; awareness only.
4. Review stale configuration list. For permanent overrides >30 days: confirm each is still needed. Set expiry on time-limited ones that were never given one.
5. Review emergency activation log if M-08 > 3. Are all activations for genuine operational needs? If not, discuss team protocol.

**Outcome:** Updated audit trail of reviewed-and-confirmed configurations. Reduction in stale configuration count through natural expiry-setting.

---

### 18.2 Campaign Publish Pre-Check

**Participants:** Marketing/content operator
**Duration:** 2–5 minutes
**Trigger:** Before confirming campaign publish

**Process:**
1. Review campaign delivery preview (Surface P-2): which screens will receive this campaign?
2. Note any screens listed as "will not receive — active override." Are those overrides intentional? If not, this is the moment to review them before publishing.
3. If override divergence is high in the target area, consider whether a team conversation is needed before publishing (the campaign reaching only 60% of target screens may affect campaign effectiveness reporting).
4. Proceed with publish. Advisory is informational — the publish is not blocked.

---

### 18.3 Override Creation Review

**Participants:** Shift manager creating an override
**Duration:** 1–2 minutes
**Trigger:** Whenever an override is created

**Process:**
1. Complete the reason field (mandatory for emergency activations per §10.3 advisory).
2. Set `expires_at` if the override is for a time-limited purpose (event, promotion). The default should not be null.
3. If the advisory surfaces that the override will shadow an active campaign, note which screens are affected. Is that intended?
4. If creating an override for content that could instead be added to the area schedule or campaign, consider whether the campaign/schedule route is more appropriate for ongoing use.

---

### 18.4 Shift Handover

**Participants:** Outgoing shift manager + incoming shift manager
**Duration:** 5 minutes
**Trigger:** Shift change

**Process:**
1. Outgoing manager opens Screen Resolution Map dashboard.
2. Walk incoming manager through any amber or red screens (screens on overrides or fallback).
3. For each override-driven screen: explain the reason for the override and expected duration.
4. Note any emergency activations in the last shift. Were any cleared? Any still active?
5. If an override was created during the shift without an expiry, and the reason was time-limited, set the expiry before leaving.

**Output:** Incoming manager has explicit awareness of any non-standard configuration state. No surprises when screens look unexpected.

---

### 18.5 Post-Incident Configuration Review

**Trigger:** After any genuine emergency activation, technical incident, or content complaint
**Participants:** Venue manager, relevant operator
**Duration:** 10–20 minutes

**Process:**
1. Review the emergency activation log for the incident period.
2. Was the emergency cleared at the right time? Did the PRE restore the correct content?
3. Were any overrides or schedules created during the incident that need expiry or removal?
4. Did the incident reveal a configuration gap (e.g., no emergency default content was configured)?
5. Did the incident reveal a process gap (e.g., the team didn't know how to create an operational override, so they used emergency)?
6. Update team protocols if process gaps are found.

---

## 19. Escalation vs. Blocking Philosophy

### 19.1 The Core Question

At every point where drift is detected, the system design must answer: should this signal prevent the operator from taking the action, or should it inform the operator and allow them to proceed?

This document's answer is consistently: **inform, do not prevent**.

This is not a default position adopted for convenience. It is a principled stance based on the following reasoning.

### 19.2 Why Blocking Is More Expensive Than It Appears

A blocking guardrail that prevents an operator action in cases where the action is actually correct has a direct cost: the operator cannot do their job. They must find a workaround, escalate, or wait. In a venue environment under real operational pressure, this cost is not abstract. A manager who cannot create an override during an event because the system has decided the venue "has too many overrides" will find a workaround — and that workaround will be worse than the blocked action.

Moreover, blocking generates resistance. If operators experience the system as an obstacle, they lose trust in it. They will invest effort in understanding how to circumvent blocks rather than understanding the underlying configuration model. The adversarial relationship is more damaging to long-term configuration quality than the drift the block was meant to prevent.

### 19.3 Why Observability Is Safer

An observability-first approach distributes the decision about how to respond to drift signals to the humans who have context. The system provides the signal; the operator provides the judgment.

This is not only safer — it is more likely to produce correct outcomes. The system cannot know whether a high override divergence rate reflects drift (bad) or intentional per-screen customization (correct). The operator knows. The system should not make that determination autonomously.

The cost of a false positive in an observability system (a signal that fires when nothing is wrong) is low: the operator glances at the signal and dismisses it. The cost of a false positive in an enforcement system (a block that fires when the action is correct) is high: the operator is stopped from doing their job.

### 19.4 The Friction Gate as the Appropriate Boundary

The Tier 3 friction gate (§10.2) is the maximum intervention this document sanctions. It requires an operator to confirm an action before proceeding, and it surfaces the specific reason for the confirmation requirement.

A friction gate is not blocking because:
- The operator can always proceed by confirming
- No expertise or escalation path is required to proceed
- The gate creates an audit trail without requiring a workaround
- The friction is proportional and transparent

A friction gate is not merely advisory because:
- It adds a tangible action cost to the risky behavior
- It cannot be ignored — it requires a response
- It creates a named record that the operator was informed before proceeding

This is the correct middle ground between "the system noticed but said nothing" and "the system prevented the action."

### 19.5 When To Escalate to Blocking (Future Consideration)

This document does not sanction any blocking behavior. If future evidence demonstrates that specific action types reliably cause irreversible harm that advisory and friction cannot adequately prevent, a blocking escalation may be appropriate. The criteria for such a decision would be:

1. The action type has produced documented harm in production
2. The harm is irreversible (not recoverable through a subsequent correct action)
3. The blocking rate for false positives is known and acceptable
4. The operator has an alternative path to achieve the same goal through a safer mechanism

None of the six entropy categories defined in §4 currently meet all four criteria.

---

## 20. Future Extensions

This section documents directions for future enhancement that are explicitly deferred from the current specification. They are recorded here to prevent ad-hoc implementation of these features in ways that would violate the principles of this document.

### 20.1 Historical Intent Preservation

**What:** A structured field on all configuration rows for capturing operator intent at creation time — not a free-text reason field, but a structured record: `intent_category` (enum: `emergency_correction | event | permanent | promotional | test`), `review_date` (suggested date for the next review), and a free-text `notes` field.

**Why deferred:** Requires schema changes and UI investment. More valuable after observability surfaces are in place and operators have established review workflows. Building this before the review workflow exists would produce empty fields.

**Pre-requisite:** §18 operational review workflows must be established first.

---

### 20.2 Override Ownership Transfer

**What:** A mechanism for reassigning ownership of an override when the original `issued_by` user is no longer active. The new owner acknowledges the override and its intent before taking ownership.

**Why deferred:** Requires user account management integration. Currently `issued_by` is a string, not a foreign key to a users table.

**Pre-requisite:** User authentication system (§20 Open Question 1 from IMPLEMENTATION-ROADMAP-v1.md).

---

### 20.3 Campaign Effectiveness Reporting

**What:** Post-campaign reporting that shows: intended delivery scope vs. actual delivery scope (based on `screen_delivery_log`), screens where the campaign was shadowed by overrides, proof-of-play confirmation rates.

**Why deferred:** Requires `screen_delivery_log` to be populated at significant scale. Currently the log structure exists but may not have enough data for meaningful reporting in early operations. More valuable after 60+ days of operational use.

**Pre-requisite:** Phase 4 (Campaign + Sponsorship Layer) and proof-of-play signal capture fully deployed per IMPLEMENTATION-ROADMAP-v1.md.

---

### 20.4 Scheduled Configuration Expiry Reminders

**What:** Notification system (email, webhook, or in-app) that reminds operators of upcoming configuration expirations and prompts review of Class B stale items.

**Why deferred:** Requires notification infrastructure not currently defined. The event bus (§16.5) provides the trigger mechanism — the delivery infrastructure is what's missing.

**Pre-requisite:** Webhook or notification delivery capability. Reference: IMPLEMENTATION-ROADMAP-v1.md Open Question 2 (operator identity model must be resolved first).

---

### 20.5 Priority Rebalancing Assistant

**What:** A read-only recommendation surface that analyzes the current priority distribution for an area and suggests a rebalanced priority scheme. Shows: "If you remap priorities to [suggested distribution], the same ordering relationships would be preserved but the range would be compressed to [0–50]."

**Critically:** The assistant recommends. It does not execute. The operator reviews the suggestion and, if they agree, the implementation executes the remapping only with explicit confirmation and creates an audit trail.

**Why deferred:** This approaches the boundary of automated configuration change (which this document currently prohibits). Permitting it requires a formal security model for bulk configuration mutations, a robust undo mechanism, and explicit operator training. Not appropriate for early operations.

**Pre-requisite:** All other operational tooling in this document must be mature before this feature is built. The risk of early implementation is that operators will use it to "clean up" priority distributions that look messy but are actually intentionally structured.

---

### 20.6 Entropy Trend Alerting

**What:** Proactive notification when entropy score crosses a threshold or increases by more than N points in 7 days. Surfaces the primary driver metric.

**Why deferred:** Requires notification infrastructure (§20.4). Also requires a period of operational baseline establishment before threshold values are meaningful. A new venue in its first month will have a legitimately high entropy score while operators are learning the system; alerting during this period would produce noise.

**Pre-requisite:** §20.4 infrastructure + 90 days of operational data per venue to establish baselines.

---

### 20.7 PRE Hypothetical Resolution

**What:** Extension of the PRE preview endpoint (§9) to support hypothetical state modifications: "What would play on this screen at this time if I added/removed/changed this configuration row — without committing the change?"

**Example:** `GET /api/preview/screen/:id?at=T&hypothetical={"add_override":{"content_id":"...","expires_at":"..."}}`

**Why deferred:** The technical implementation is straightforward (the PRE is already a pure function — passing a modified SystemState is trivial). The UX design for surfacing and composing hypothetical modifications safely is not. A poorly designed hypothetical interface could create confusion between "what I'm previewing" and "what is actually configured." This requires careful design work before implementation.

**Pre-requisite:** PRE preview endpoint (§9) must be deployed and operators must be comfortable with basic preview before hypothetical extension is added.

---

*End of OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md*
