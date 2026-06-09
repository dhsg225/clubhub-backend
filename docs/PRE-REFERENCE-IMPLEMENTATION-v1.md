# ClubHub TV — Playback Resolution Engine (PRE)
# Reference Implementation Specification v1.0

**Document type:** Formal behavioral specification
**Status:** Canonical implementation contract
**Date:** 2026-05-16

---

## 0. Document Status and Conventions

### 0.1 Purpose

This document defines the exact behavioral semantics of the ClubHub TV Playback Resolution Engine (PRE). Any conforming implementation must produce identical output for identical input state. This document is the arbiter of correct behavior.

### 0.2 Normative Language

- **MUST** — Absolute requirement. Violation constitutes non-conformance.
- **MUST NOT** — Absolute prohibition. Violation constitutes non-conformance.
- **SHALL** — Synonym for MUST.
- **SHALL NOT** — Synonym for MUST NOT.
- **REQUIRED** — The item is an absolute requirement.
- **DEFINED** — The behavior is completely specified here. No implementation discretion.

The phrase "implementation-defined" does not appear in this document. All behaviors are specified.

### 0.3 Pseudocode Conventions

All pseudocode uses the following conventions:

```
←       assignment
=       equality test
!=      inequality test
∈       set membership
∉       set non-membership
∅       empty set / empty list
⊥       undefined / null / absent
⊤       true
⊥       false  (context distinguishes from undefined)
[a, b)  half-open interval: a inclusive, b exclusive
[a, b]  closed interval: both inclusive
∀       for all
∃       there exists
≡       definitional equivalence
```

All timestamps are integers representing milliseconds since Unix epoch (UTC) unless explicitly stated otherwise. "Local time" means milliseconds since midnight in the venue's local timezone on the relevant date.

---

## 1. Definitions

### 1.1 Core Terms

**PRE** — The Playback Resolution Engine. A pure function mapping (screen_id, timestamp, SystemState) → PRE_Output.

**SystemState** — The complete set of authoritative state at a given instant: screens, areas, tv_groups, venues, organizations, schedules, campaigns, overrides, emergency_states, sponsorship_contracts, screen_delivery_log.

**Resolution** — The process of computing the authoritative playlist for a given screen at a given time.

**Active** — A rule (schedule, override, emergency, sponsorship contract) is active at time T if its temporal constraints are satisfied at T and its lifecycle status is 'active'.

**Specificity** — A measure of how narrowly a scheduling rule targets its subject. More specific rules take precedence over less specific rules at the same resolution level.

**Manifest** — The output delivered to a screen: an ordered list of content items with metadata.

**Playlist** — The ordered sequence of content items computed by the PRE. The manifest wraps the playlist with versioning and delivery metadata.

**Checksum** — A 32-bit FNV-1a hash of the canonical serialization of the playlist. Identical playlists MUST produce identical checksums.

**Version** — A monotonically increasing integer associated with a screen's manifest. Incremented exactly when the checksum changes.

**Confidence Score** — A real number in [0.0, 1.0] representing the PRE's certainty that a given screen is currently displaying its expected playlist.

**Divergence** — The condition where a screen's observed playback state differs from the PRE's expected output.

**System Fallback** — A compiled-in, static playlist requiring no database access. The last resort in all failure conditions.

**Venue-Local Time** — The current wall-clock time at a venue's configured timezone. Used for evaluating time-of-day and day-of-week schedule constraints.

### 1.2 Specificity Levels

Specificity is defined by the narrowest targeting dimension of a rule. From most to least specific:

```
SPECIFICITY_5  screen-targeted     (screen_id IS NOT NULL)
SPECIFICITY_4  tv_group-targeted   (tv_group_id IS NOT NULL, screen_id IS NULL)
SPECIFICITY_3  area-targeted       (area_id IS NOT NULL, tv_group_id IS NULL, screen_id IS NULL)
SPECIFICITY_2  venue-targeted      (venue_id IS NOT NULL, area_id IS NULL, ...)
SPECIFICITY_1  org-targeted        (org_id IS NOT NULL, venue_id IS NULL, ...)
SPECIFICITY_0  global              (all targeting fields NULL)
```

A rule is matched to a screen if the screen is within the rule's targeting scope. A screen is within scope if:
- screen-targeted: `screen.id = rule.screen_id`
- tv_group-targeted: `screen.tv_group_id = rule.tv_group_id`
- area-targeted: `screen.area_id = rule.area_id`
- venue-targeted: `screen.venue_id = rule.venue_id`
- org-targeted: `screen.org_id = rule.org_id` (via venue.org_id)
- global: always matched

### 1.3 Resolution Levels

The PRE evaluates rules in strict level order. A higher-numbered level is evaluated only if no lower-numbered level terminates the resolution.

```
LEVEL_0  Emergency Override    — terminates if active
LEVEL_1  Operational Override  — terminates base_playlist if active
LEVEL_2  Scheduled Override    — terminates base_playlist if active (non-suppression type)
LEVEL_3  Campaign Layer        — constructs base_playlist from schedules
LEVEL_4  Sponsorship Injection — modifies base_playlist additively
LEVEL_5  Structural Resolution — validates scope mapping, computes content_mix
LEVEL_6  Device Truth Layer    — annotates output, does not modify playlist
```

---

## 2. PRE Invariants

The following invariants MUST hold for all conforming implementations. Violation of any invariant constitutes a critical implementation defect.

### INV-1: Purity

```
PRE(screen_id, t, S₁) = PRE(screen_id, t, S₁)
```

The PRE is a pure function. Identical inputs MUST produce identical outputs. The PRE MUST NOT produce side effects. It MUST NOT write to any persistent store. It MUST NOT modify any input. It MUST NOT depend on invocation order, previous invocations, or accumulated state.

### INV-2: Totality

```
∀ screen_id, t: PRE(screen_id, t, S) ≠ ⊥
```

The PRE MUST always produce a result. It MUST NOT return null, undefined, or throw an unhandled exception. For any valid screen_id and any timestamp, a result exists. If no content is schedulable, the System Fallback is returned.

### INV-3: Determinism

```
PRE(screen_id, t, S) = PRE(screen_id, t, S)
```

Given identical system state, the PRE MUST produce bit-identical output. This applies to checksum, version, item ordering, reason_trace, and confidence_score. Random number generators, UUIDs, and wall-clock reads MUST NOT influence the playlist or checksum computation. The timestamp parameter `t` is the sole source of temporal truth.

### INV-4: Monotone Versioning

```
version(screen_id, t₂) ≥ version(screen_id, t₁)  if t₂ > t₁
version(screen_id, t₂) > version(screen_id, t₁)   iff checksum(t₁) ≠ checksum(t₂)
```

Version numbers are monotonically non-decreasing. A version increment occurs if and only if the checksum changes. The version MUST NOT decrement under any circumstances including rollback, override clearance, or emergency clearance.

### INV-5: Level Termination

If the PRE produces output at Level N, levels N+1 through LEVEL_5 are not evaluated for the base_playlist. Level LEVEL_6 (Device Truth Annotation) is always evaluated regardless of termination level.

### INV-6: No Content Amplification

The PRE MUST NOT introduce content items that are not referenced by an active rule in SystemState. The set of content_ids in the output playlist MUST be a subset of content_ids referenced by active rules at time `t`.

Exception: The System Fallback content item may appear without a corresponding rule when no other content is schedulable.

### INV-7: Sponsorship Non-Penetration

Sponsor injection (LEVEL_4) MUST NOT apply when the resolution terminates at LEVEL_0 or LEVEL_1. Operational authority overrides sponsorship obligations. When resolution terminates at LEVEL_2 with `override_type = 'replacement'`, sponsorship injection MUST NOT apply. When LEVEL_2 terminates with `override_type = 'insertion'`, sponsorship injection MUST apply to the base content.

### INV-8: Emergency Absoluteness

An active emergency MUST suppress all other resolution levels. No content except the emergency content (or System Fallback if emergency content is absent) MUST appear in a resolved playlist when `emergency_states` contains an active record for the screen's venue.

### INV-9: Timezone Isolation

The PRE MUST evaluate all time-of-day and day-of-week constraints against the screen's venue local time. The PRE MUST NOT use the process's system timezone. UTC offsets MUST be resolved from the venue's configured IANA timezone identifier at the time parameter `t`.

### INV-10: Output Completeness

Every item in the output playlist MUST have a corresponding entry in `reason_trace`. The `reason_trace` MUST be sufficient for a human operator to reconstruct exactly why each item is present.

---

## 3. PRE Function Signature and Contract

### 3.1 Signature

```
FUNCTION PRE.resolve(
  screen_id : STRING,
  at        : TIMESTAMP_MS,
  db        : DatabaseConnection
) : PRE_Output
```

### 3.2 PRE_Output Type

```
TYPE PRE_Output = {
  screen_id        : STRING,
  timestamp        : TIMESTAMP_MS,
  active_playlist  : PlaylistItem[],
  content_mix      : ContentMix,
  reason_trace     : STRING[],
  confidence_score : REAL  -- in [0.0, 1.0]
  valid_until      : TIMESTAMP_MS,
  resolution_level : INTEGER  -- 0..6
  is_fallback      : BOOLEAN
}

TYPE PlaylistItem = {
  content_id   : STRING,
  type         : STRING,
  data         : JSONOBJECT,
  duration_ms  : INTEGER,  -- MUST be >= 3000
  priority     : INTEGER,
  source       : STRING,   -- 'campaign' | 'override' | 'emergency' | 'sponsor' | 'fallback' | 'system'
  campaign_id  : STRING?,
  schedule_id  : STRING?
}

TYPE ContentMix = {
  campaign_pct  : REAL,   -- [0.0, 1.0], sum of all types = 1.0
  sponsor_pct   : REAL,
  override_pct  : REAL,
  fallback_pct  : REAL,
  system_pct    : REAL
}
```

### 3.3 Database Access Contract

The PRE MUST acquire a single read transaction before executing. All queries within one PRE invocation MUST execute within that transaction using `READ COMMITTED` isolation. The PRE MUST NOT hold the transaction open longer than its execution requires. The PRE MUST NOT issue any write queries.

### 3.4 Null and Missing Value Handling

- If `screen_id` references a screen not present in the database: return System Fallback with `reason_trace: ["L0:SCREEN_NOT_FOUND"]`
- If `at` is zero or negative: implementation MUST treat as invalid input; behavior is undefined. Callers MUST supply a valid positive timestamp.
- If `db` connection is unavailable: the PRE propagates the connection error to the caller. It is the caller's responsibility (Manifest Delivery System) to handle the fallback path.

---

## 4. Input State Classes

The PRE reads exactly six classes of state. It MUST NOT read any other tables.

### 4.1 Device State

```sql
-- Required fields read by PRE:
SELECT s.id, s.tv_group_id, s.area_id, s.venue_id, s.status,
       g.id AS group_id, g.area_id AS group_area_id,
       a.id AS area_id, a.venue_id AS area_venue_id,
       v.id AS venue_id, v.timezone, v.org_id,
       o.id AS org_id
FROM screens s
JOIN tv_groups g ON s.tv_group_id = g.id
JOIN areas a ON s.area_id = a.id
JOIN venues v ON a.venue_id = v.id
LEFT JOIN organizations o ON v.org_id = o.id
WHERE s.id = $screen_id
```

If the screen has `status = 'unprovisioned'`, the PRE MUST return System Fallback immediately without proceeding to further resolution. `reason_trace` MUST contain `"L0:UNPROVISIONED"`.

### 4.2 Emergency State

```sql
SELECT id, content_id, activated_at
FROM emergency_states
WHERE venue_id = $venue_id
  AND status = 'active'
  AND activated_at <= $at
```

At most one row is expected (enforced by UNIQUE partial index). If multiple rows exist due to constraint violation, the most recently activated record (highest `activated_at`) is used.

### 4.3 Override State

```sql
SELECT id, type, scope_type, scope_id, campaign_id, start_time, end_time,
       override_type, suppressed_campaign_ids, suppressed_categories,
       issued_at
FROM overrides
WHERE status = 'active'
  AND start_time <= $at
  AND (end_time IS NULL OR end_time > $at)
  AND (
    (scope_type = 'screen'   AND scope_id = $screen_id)
    OR (scope_type = 'tv_group' AND scope_id = $tv_group_id)
    OR (scope_type = 'area'     AND scope_id = $area_id)
  )
ORDER BY
  CASE scope_type WHEN 'screen' THEN 0 WHEN 'tv_group' THEN 1 WHEN 'area' THEN 2 END ASC,
  issued_at DESC
```

### 4.4 Schedule State

```sql
SELECT s.id, s.content_id, s.area_id, s.venue_id, s.org_id,
       s.screen_id, s.tv_group_id,
       s.priority, s.starts_at, s.ends_at,
       s.days_of_week, s.time_of_day_start, s.time_of_day_end,
       s.duration_ms, s.is_fallback, s.campaign_id,
       c.type AS content_type, c.data AS content_data
FROM schedules s
JOIN content c ON s.content_id = c.id
WHERE s.is_fallback = FALSE
  AND (
    (s.screen_id   = $screen_id)
    OR (s.tv_group_id = $tv_group_id   AND s.screen_id IS NULL)
    OR (s.area_id     = $area_id       AND s.tv_group_id IS NULL AND s.screen_id IS NULL)
    OR (s.venue_id    = $venue_id      AND s.area_id IS NULL     AND s.tv_group_id IS NULL AND s.screen_id IS NULL)
    OR (s.org_id      = $org_id        AND s.venue_id IS NULL    AND s.area_id IS NULL     AND s.tv_group_id IS NULL AND s.screen_id IS NULL)
    OR (s.screen_id IS NULL AND s.tv_group_id IS NULL AND s.area_id IS NULL AND s.venue_id IS NULL AND s.org_id IS NULL)
  )
```

### 4.5 Sponsorship State

```sql
SELECT id, campaign_id, area_id, category, exclusivity, share_of_voice,
       starts_at, ends_at, days_of_week
FROM sponsorship_contracts
WHERE area_id = $area_id
  AND status = 'active'
  AND starts_at <= $at
  AND ends_at > $at
```

### 4.6 Device Truth State

```sql
SELECT manifest_checksum, delivered_at, acknowledged_at
FROM screen_delivery_log
WHERE screen_id = $screen_id
ORDER BY delivered_at DESC
LIMIT 1
```

---

## 5. Resolution Precedence

### 5.1 Level Evaluation Order

Levels are evaluated in ascending order: 0, 1, 2, 3, 4, 5, 6.

LEVEL_0 and LEVEL_1 and LEVEL_2 may terminate the base_playlist computation early.
LEVEL_3 is reached only if LEVEL_0, LEVEL_1, and LEVEL_2 do not terminate.
LEVEL_4 through LEVEL_6 always execute (subject to INV-7).

### 5.2 Within-Level Specificity

When multiple rules of the same type apply at the same level, specificity MUST be applied:

```
SPECIFICITY_5 > SPECIFICITY_4 > SPECIFICITY_3 > SPECIFICITY_2 > SPECIFICITY_1 > SPECIFICITY_0
```

Rules of higher specificity MUST be selected over rules of lower specificity. Rules of lower specificity MUST be discarded when a higher-specificity rule exists.

**Exception for LEVEL_3 (Campaign Layer):** Multiple schedules at different specificity levels MAY all contribute to the playlist. Specificity does not exclude lower-specificity schedules at LEVEL_3; it determines deduplication priority when the same `content_id` appears at multiple specificity levels (see §9.1).

### 5.3 Within-Level, Within-Specificity Priority

When multiple rules of the same type, same specificity, and the same level are active simultaneously:

**For overrides (LEVEL_1, LEVEL_2):** The rule with the highest `issued_at` timestamp wins. If `issued_at` timestamps are equal (same millisecond), the rule with the lexicographically smaller `id` wins. Only one override governs the base_playlist.

**For schedules (LEVEL_3):** Rules with higher `priority` integer take precedence in deduplication. If `priority` is equal and the same `content_id` appears in both, the rule with the lexicographically smaller `id` wins. Multiple schedules with different `content_id` values at the same priority ALL contribute to the playlist.

### 5.4 Suppression Override Handling

An override with `override_type = 'suppression'` does not terminate the base_playlist computation. Instead, it acts as a filter on LEVEL_3 evaluation. It does not produce a base_playlist. The presence of a suppression override sets `suppression_context` and processing continues to LEVEL_3.

Multiple simultaneous suppression overrides are additive: all `suppressed_campaign_ids` and `suppressed_categories` from all active suppression overrides are combined into a single suppression set.

### 5.5 Inheritance

If no rule matches at a given specificity, the PRE inherits from the next lower specificity. Inheritance is not a fallback — it is the defined behavior for absence of instruction.

Inheritance applies per content_id. It is possible for content_id A to be governed by a screen-specific rule while content_id B is governed by an area-level rule for the same screen.

---

## 6. Formal Resolution Algorithm

```
FUNCTION PRE.resolve(screen_id, at, db):

  ── STEP 1: ACQUIRE CONTEXT ────────────────────────────────────────────────

  ctx ← buildContext(screen_id, db)
  -- buildContext defined in §6.1

  IF ctx = ⊥:
    RETURN systemFallback(screen_id, at, "L0:SCREEN_NOT_FOUND")

  IF ctx.screen.status = 'unprovisioned':
    RETURN systemFallback(screen_id, at, "L0:UNPROVISIONED")

  trace    ← []
  local_at ← toVenueLocal(at, ctx.venue.timezone)
  -- toVenueLocal defined in §8.1

  ── STEP 2: LEVEL 0 — EMERGENCY ────────────────────────────────────────────

  emergency ← queryEmergency(ctx.venue.id, at, db)

  IF emergency ≠ ⊥:
    content ← resolveEmergencyContent(emergency, db)
    trace.append("L0:EMERGENCY:" + emergency.id)
    playlist ← [makeItem(content, source='emergency')]
    RETURN buildOutput(
      screen_id, at, playlist, trace, level=0,
      valid_until=FAR_FUTURE, db
    )

  ── STEP 3: LEVEL 1 — OPERATIONAL OVERRIDE ─────────────────────────────────

  op_overrides ← queryOverrides(ctx, type='operational', at, db)
  -- queryOverrides returns overrides sorted by specificity DESC, issued_at DESC

  suppression_context ← {campaign_ids: ∅, categories: ∅}
  skip_sponsorship    ← ⊥

  IF op_overrides ≠ ∅:
    op_override ← selectOverride(op_overrides)
    -- selectOverride defined in §6.2

    IF op_override.override_type = 'suppression':
      suppression_context ← mergeSuppression(suppression_context, op_override)
      trace.append("L1:SUPPRESSION:" + op_override.id)
      -- Do NOT terminate; continue to LEVEL_2
    ELSE:
      base_playlist ← resolveOverrideContent(op_override, db)
      trace.append("L1:OP_OVERRIDE:" + op_override.id +
                   ":scope=" + op_override.scope_type +
                   ":type=" + op_override.override_type)
      skip_sponsorship ← ⊤
      GOTO STEP_6  -- skip LEVEL_2 and LEVEL_3

  ── STEP 4: LEVEL 2 — SCHEDULED OVERRIDE ───────────────────────────────────

  sched_overrides ← queryOverrides(ctx, type IN ('scheduled','group'), at, db)

  IF sched_overrides ≠ ∅:
    sched_override ← selectOverride(sched_overrides)

    IF sched_override.override_type = 'suppression':
      suppression_context ← mergeSuppression(suppression_context, sched_override)
      trace.append("L2:SUPPRESSION:" + sched_override.id)
      -- Do NOT terminate; continue to LEVEL_3
    ELSE:
      base_playlist ← resolveOverrideContent(sched_override, db)
      trace.append("L2:SCHED_OVERRIDE:" + sched_override.id +
                   ":scope=" + sched_override.scope_type +
                   ":type=" + sched_override.override_type)
      IF sched_override.override_type = 'replacement':
        skip_sponsorship ← ⊤
      ELSE:
        skip_sponsorship ← ⊥
      GOTO STEP_6  -- skip LEVEL_3

  ── STEP 5: LEVEL 3 — CAMPAIGN LAYER ───────────────────────────────────────

  all_schedules ← querySchedules(ctx, at, local_at, db)
  active_schedules ← filterSchedules(all_schedules, suppression_context)
  -- filterSchedules defined in §6.3

  regular_schedules  ← active_schedules WHERE is_fallback = ⊥
  fallback_schedules ← active_schedules WHERE is_fallback = ⊤

  IF regular_schedules ≠ ∅:
    base_playlist ← campaignResolver(regular_schedules, db)
    -- campaignResolver defined in §15
    trace.append("L3:CAMPAIGN:campaigns=" +
                 dedupe(regular_schedules.map(s => s.campaign_id)))
  ELSE:
    base_playlist ← fallbackResolver(fallback_schedules, ctx, db)
    -- fallbackResolver defined in §17
    trace.append("L3:FALLBACK")

  ── STEP 6: LEVEL 4 — SPONSORSHIP INJECTION ────────────────────────────────

  LABEL STEP_6:

  IF skip_sponsorship = ⊤:
    trace.append("L4:SKIPPED:override_type=replacement_or_operational")
  ELSE:
    contracts ← querySponsorships(ctx.area.id, at, local_at, db)
    IF contracts ≠ ∅:
      injection_result ← sponsorshipInjector(base_playlist, contracts)
      -- sponsorshipInjector defined in §11
      base_playlist ← injection_result.playlist
      trace.append("L4:SPONSORS:" + injection_result.sponsor_ids)
      IF injection_result.suppressed_ids ≠ ∅:
        trace.append("L4:SUPPRESSED:" + injection_result.suppressed_ids)
      IF injection_result.saturation_warning:
        trace.append("L4:SATURATION_WARNING:total=" + injection_result.total_share)
    ELSE:
      trace.append("L4:NO_SPONSORS")

  ── STEP 7: LEVEL 5 — STRUCTURAL RESOLUTION ────────────────────────────────

  -- No content modification occurs here.
  -- This level verifies the screen is eligible and computes mix percentages.

  IF base_playlist = ∅:
    base_playlist ← [SYSTEM_FALLBACK_ITEM]
    trace.append("L5:EMPTY_RESOLVED_TO_SYSTEM_FALLBACK")
  ELSE:
    base_playlist ← normalizePlaylist(base_playlist)
    -- normalizePlaylist defined in §12

  content_mix ← computeContentMix(base_playlist)
  trace.append("L5:STRUCTURAL:area=" + ctx.area.id + ":group=" + ctx.tv_group.id)

  ── STEP 8: LEVEL 6 — DEVICE TRUTH ANNOTATION ──────────────────────────────

  confidence  ← computeConfidence(ctx.screen, base_playlist, at, db)
  -- computeConfidence defined in §12.1

  expected_checksum ← computeChecksum(base_playlist)
  trace.append("L6:" + confidenceTrace(ctx.screen, expected_checksum, db))

  ── STEP 9: COMPUTE VALID_UNTIL ────────────────────────────────────────────

  valid_until ← computeValidUntil(
    active_schedules, op_overrides, sched_overrides, contracts, local_at, at
  )
  -- computeValidUntil defined in §14.1

  ── STEP 10: RETURN ────────────────────────────────────────────────────────

  RETURN {
    screen_id        : screen_id,
    timestamp        : at,
    active_playlist  : base_playlist,
    content_mix      : content_mix,
    reason_trace     : trace,
    confidence_score : confidence,
    valid_until      : valid_until,
    resolution_level : highestLevelReached(trace),
    is_fallback      : (base_playlist[0].source = 'fallback' OR
                        base_playlist[0].source = 'system')
  }

END FUNCTION
```

### 6.1 buildContext

```
FUNCTION buildContext(screen_id, db):
  row ← db.query(SELECT screen, tv_group, area, venue, org WHERE screen.id = screen_id)
  IF row = ∅: RETURN ⊥
  RETURN {
    screen:   row.screen,
    tv_group: row.tv_group,
    area:     row.area,
    venue:    row.venue,
    org:      row.org  -- may be ⊥ if venue.org_id IS NULL
  }
```

### 6.2 selectOverride

```
FUNCTION selectOverride(overrides):
  -- overrides is already sorted: specificity DESC, issued_at DESC
  -- Return the first entry (highest specificity, most recent within that specificity)
  RETURN overrides[0]
```

### 6.3 filterSchedules

```
FUNCTION filterSchedules(schedules, suppression_context):
  IF suppression_context.campaign_ids = ∅ AND suppression_context.categories = ∅:
    RETURN schedules  -- fast path: no suppression active

  RETURN schedules WHERE NOT (
    schedule.campaign_id ∈ suppression_context.campaign_ids
    OR schedule.content_category ∈ suppression_context.categories
  )
```

### 6.4 mergeSuppression

```
FUNCTION mergeSuppression(existing, override):
  RETURN {
    campaign_ids : existing.campaign_ids ∪ override.suppressed_campaign_ids,
    categories   : existing.categories   ∪ override.suppressed_categories
  }
```

---

## 7. Time Window Evaluation

### 7.1 scheduleActive

```
FUNCTION scheduleActive(schedule, at_utc_ms, local_at):
-- Returns ⊤ if the schedule is active at the given moment; ⊥ otherwise.
-- at_utc_ms: milliseconds since epoch (UTC)
-- local_at: { date: Date, time_ms: INTEGER, day_of_week: 0..6, is_dst_gap: BOOL, is_dst_overlap: BOOL }

  ── Absolute window check ──────────────────────────────────────────────────
  IF schedule.starts_at ≠ ⊥ AND schedule.starts_at > at_utc_ms:
    RETURN ⊥  -- not yet started

  IF schedule.ends_at ≠ ⊥ AND schedule.ends_at <= at_utc_ms:
    RETURN ⊥  -- ended (ends_at is EXCLUSIVE)

  ── Day-of-week check ──────────────────────────────────────────────────────
  IF schedule.days_of_week ≠ ⊥ AND schedule.days_of_week ≠ ∅:
    IF local_at.day_of_week ∉ schedule.days_of_week:
      RETURN ⊥

  ── Intra-day time window check ────────────────────────────────────────────
  IF schedule.time_of_day_start = ⊥ AND schedule.time_of_day_end = ⊥:
    RETURN ⊤  -- no intra-day constraint: active all day

  IF schedule.time_of_day_start = ⊥ OR schedule.time_of_day_end = ⊥:
    -- Malformed: both MUST be present or both MUST be absent
    -- Treat as invalid: does not match
    RETURN ⊥

  start_ms ← timeToMs(schedule.time_of_day_start)  -- ms since midnight
  end_ms   ← timeToMs(schedule.time_of_day_end)
  t_ms     ← local_at.time_ms

  IF start_ms < end_ms:
    -- Same-day window: [start_ms, end_ms)
    RETURN t_ms >= start_ms AND t_ms < end_ms

  ELSE IF start_ms > end_ms:
    -- Midnight-crossing window: active in [start_ms, midnight) OR [midnight, end_ms)
    RETURN t_ms >= start_ms OR t_ms < end_ms

  ELSE:  -- start_ms = end_ms
    -- Zero-duration window. MUST NOT match any time.
    RETURN ⊥

END FUNCTION
```

### 7.2 timeToMs

```
FUNCTION timeToMs(time_string):
-- Converts 'HH:MM' or 'HH:MM:SS' to milliseconds since midnight.
-- 'HH' in [0, 23], 'MM' in [0, 59], 'SS' in [0, 59] (optional, default 0)
-- Returns INTEGER in [0, 86_400_000)

  parts ← time_string.split(':')
  h ← parseInt(parts[0])
  m ← parseInt(parts[1])
  s ← parts.length > 2 ? parseInt(parts[2]) : 0

  ASSERT h ∈ [0, 23] AND m ∈ [0, 59] AND s ∈ [0, 59]

  RETURN (h * 3_600_000) + (m * 60_000) + (s * 1_000)
```

### 7.3 Midnight-Crossing Schedules and Day-of-Week

A midnight-crossing schedule (start_ms > end_ms) spans two calendar days. Day-of-week evaluation MUST be applied to the day on which the schedule starts, not the day on which the post-midnight portion falls.

**Formal rule:** A midnight-crossing schedule with `days_of_week = [D]` is active during:
- The period `[start_ms, midnight)` on any day-of-week `D`
- The period `[midnight, end_ms)` on the day following `D` (i.e., day `(D + 1) % 7`)

Therefore, the evaluation is:

```
IF start_ms > end_ms:  -- midnight crossing
  -- Post-midnight portion: check if today is the day AFTER the scheduled day
  yesterday_dow ← (local_at.day_of_week + 6) % 7
  IF t_ms < end_ms:
    -- We are in the post-midnight portion
    RETURN days_of_week = ⊥ OR yesterday_dow ∈ days_of_week
  ELSE IF t_ms >= start_ms:
    -- We are in the pre-midnight portion
    RETURN days_of_week = ⊥ OR local_at.day_of_week ∈ days_of_week
  ELSE:
    RETURN ⊥
```

---

## 8. Timezone and DST Semantics

### 8.1 toVenueLocal

```
FUNCTION toVenueLocal(at_utc_ms, iana_timezone):
-- Returns a LocalTime structure representing the wall-clock time at
-- the given UTC timestamp in the given IANA timezone.

  tz ← loadIANATimezone(iana_timezone)
  IF tz = ⊥:
    -- Unknown or invalid timezone string
    -- Fall back to UTC. Log a warning. Do NOT throw.
    tz ← loadIANATimezone('UTC')

  wall_clock ← tz.toLocalDateTime(at_utc_ms)

  RETURN {
    year        : wall_clock.year,
    month       : wall_clock.month,          -- 1..12
    day         : wall_clock.day,            -- 1..31
    hour        : wall_clock.hour,           -- 0..23
    minute      : wall_clock.minute,         -- 0..59
    second      : wall_clock.second,         -- 0..59
    time_ms     : timeOfDayMs(wall_clock),   -- ms since midnight
    day_of_week : wall_clock.dayOfWeek,      -- 0=Sunday, 1=Monday ... 6=Saturday
    utc_offset_ms : tz.getOffset(at_utc_ms), -- ms east of UTC (may be negative)
    is_dst_gap    : tz.isInGap(at_utc_ms),   -- true during spring-forward gap
    is_dst_overlap: tz.isInOverlap(at_utc_ms) -- true during fall-back overlap
  }
```

### 8.2 DST Gap Behavior ("Spring Forward")

During a DST gap (e.g., clocks spring from 02:00 to 03:00, making 02:00–03:00 non-existent):

- Any schedule whose `time_of_day_start` falls within the gap has an effective start of the DST transition end time.
- Any schedule whose `time_of_day_end` falls within the gap has an effective end of the DST transition end time.
- A schedule whose window is entirely within the gap MUST NOT match any timestamp during that transition.
- `is_dst_gap = ⊤` implies no wall-clock time exists for that UTC moment; the PRE MUST NOT synthesize a wall-clock time.

**Formal rule:** If `local_at.is_dst_gap = ⊤`, the PRE MUST treat all time-of-day window checks as non-matching. Only absolute UTC window checks (`starts_at`, `ends_at`) and day-of-week checks remain active during a DST gap.

### 8.3 DST Overlap Behavior ("Fall Back")

During a DST overlap (e.g., clocks fall from 02:00 back to 01:00, making 01:00–02:00 occur twice):

- The wall-clock time is ambiguous: a given local time value occurs twice (once in DST, once in standard time).
- The PRE MUST evaluate schedules against the wall-clock value regardless of which UTC offset applies.
- A schedule active during 01:00–02:00 WILL match BOTH instances of that wall-clock hour.
- This is the correct behavior: the schedule operator specified a local time, and both instances of that local time are valid.

**Formal rule:** If `local_at.is_dst_overlap = ⊤`, time-of-day window evaluation proceeds normally using `local_at.time_ms`. The schedule may match twice in UTC terms. This is not an error.

### 8.4 Timezone Fallback Chain

```
FUNCTION resolveTimezone(venue):
  IF venue.timezone IS NOT NULL AND isValidIANA(venue.timezone):
    RETURN venue.timezone
  ELSE:
    -- Log: invalid or missing timezone for venue
    RETURN 'UTC'
```

The PRE MUST NOT propagate a timezone error. It MUST fall back to UTC and continue resolution.

---

## 9. Conflict Resolution Semantics

### 9.1 Schedule Deduplication

At LEVEL_3, multiple schedules may reference the same `content_id` at different specificity levels. The PRE MUST deduplicate by `content_id`, retaining the rule with the highest specificity. If specificity is equal, retain the rule with the higher `priority` integer. If both specificity and priority are equal, retain the rule with the lexicographically smaller `id` (consistent tiebreaker).

```
FUNCTION deduplicateByContentId(schedules):
  best ← {}  -- map: content_id → schedule

  FOR EACH schedule IN schedules
    SORTED BY specificity DESC, priority DESC, id ASC:

    IF schedule.content_id ∉ best:
      best[schedule.content_id] ← schedule
    -- Else: best already holds the preferred rule for this content_id

  RETURN values(best)
```

### 9.2 Override Conflict

Multiple simultaneous overrides of the same type at the same scope level constitute a conflict. The PRE MUST resolve this deterministically without error:

- The override with the most recent `issued_at` timestamp wins.
- If `issued_at` is identical (same millisecond), the override with the lexicographically smaller `id` wins.
- The losing override(s) are discarded for this resolution. They remain active in the database and will be re-evaluated on future invocations.

This behavior does not constitute an error. The PRE MUST NOT throw or log an error for concurrent valid overrides.

### 9.3 Override Scope Conflict

When overrides exist at multiple specificity levels (e.g., both a screen-level and an area-level override are active simultaneously), the most specific override governs. The less specific override is not applied to any screen for which a more specific override is active.

The less specific override continues to govern other screens in its scope that are not covered by a more specific override.

### 9.4 Campaign Priority Conflict

Two campaigns targeting the same area with overlapping time windows and different content do not constitute a conflict. Both campaigns contribute their content items to the playlist. They coexist additively.

Two campaigns targeting the same area with overlapping time windows and at least one shared `content_id` are resolved by deduplication (§9.1): only the higher-specificity / higher-priority instance of the shared content_id appears.

The total playlist is the union of all active campaign content items after deduplication.

---

## 10. Suppression Semantics

### 10.1 Suppression Scope

A suppression override removes specific content from the resolution output within its defined scope and time window. Suppression does not terminate the campaign layer evaluation; it filters it.

A suppression override specifies one or both of:
- `suppressed_campaign_ids`: a set of campaign UUIDs whose content items are excluded
- `suppressed_categories`: a set of content category strings; any content item whose `content_category` matches is excluded

### 10.2 Suppression Application

```
FUNCTION applySuppression(schedules, suppression_context):
  RETURN schedules WHERE NOT (
    (schedule.campaign_id ≠ ⊥ AND schedule.campaign_id ∈ suppression_context.campaign_ids)
    OR
    (schedule.content_category ≠ ⊥ AND schedule.content_category ∈ suppression_context.categories)
  )
```

### 10.3 Mandated Campaign Protection

A campaign with `is_mandated = ⊤` MUST NOT be suppressed by any suppression override issued by an operator with `venue_manager` or lower authority. Suppression of mandated campaigns requires `org_admin` authority.

The PRE MUST enforce this by checking: if `schedule.is_mandated = ⊤` AND the suppression override was issued by an actor with authority below `org_admin`, the schedule MUST NOT be filtered.

```
FUNCTION filterScheduleForSuppression(schedule, suppression_context, suppression_authority):
  IF schedule.is_mandated = ⊤ AND suppression_authority < AUTHORITY_ORG_ADMIN:
    RETURN ⊤  -- mandated schedules survive non-org-admin suppression

  RETURN (
    schedule.campaign_id ∈ suppression_context.campaign_ids
    OR schedule.content_category ∈ suppression_context.categories
  )
```

### 10.4 Suppression of Fallback Schedules

Suppression overrides do not suppress fallback schedules (`is_fallback = ⊤`). A suppression override removes regular campaign content, potentially revealing the fallback layer. This is intended: the fallback layer exists precisely to handle the case where regular content is absent.

### 10.5 Total Suppression

If suppression removes all regular campaign content and no fallback schedules exist, the PRE MUST proceed to the fallback resolver (§17). It MUST NOT return an empty playlist.

---

## 11. Sponsor Injection Semantics

### 11.1 Injection Principle

Sponsor injection is additive. It inserts sponsor content items into an existing base_playlist without removing non-sponsor items, subject to share-of-voice constraints and exclusivity rules.

### 11.2 Contract Eligibility

A sponsorship contract is eligible for injection at time `at` if:

```
FUNCTION contractEligible(contract, at_utc_ms, local_at):
  -- Absolute window
  IF contract.starts_at > at_utc_ms OR contract.ends_at <= at_utc_ms:
    RETURN ⊥

  -- Day-of-week (if specified)
  IF contract.days_of_week ≠ ⊥ AND contract.days_of_week ≠ ∅:
    IF local_at.day_of_week ∉ contract.days_of_week:
      RETURN ⊥

  RETURN ⊤
```

### 11.3 Exclusivity Resolution

```
FUNCTION resolveExclusivity(eligible_contracts):
-- Removes non-exclusive contracts that conflict with exclusive contracts
-- in the same category.

  exclusive_by_category ← {}

  FOR EACH contract WHERE contract.exclusivity = 'exclusive':
    IF contract.category ∈ exclusive_by_category:
      -- Two exclusive contracts in the same category: conflict
      -- Keep the one with the most recent starts_at (most recently booked)
      -- If starts_at is equal: keep lexicographically smaller id
      existing ← exclusive_by_category[contract.category]
      IF contract.starts_at > existing.starts_at:
        exclusive_by_category[contract.category] ← contract
      ELSE IF contract.starts_at = existing.starts_at AND contract.id < existing.id:
        exclusive_by_category[contract.category] ← contract
    ELSE:
      exclusive_by_category[contract.category] ← contract

  -- Remove non-exclusive contracts whose category has an exclusive holder
  resolved ← []
  FOR EACH contract IN eligible_contracts:
    IF contract.exclusivity = 'exclusive':
      IF exclusive_by_category[contract.category] = contract:
        resolved.append(contract)
      -- Else: this exclusive contract lost the conflict resolution above
    ELSE:  -- non-exclusive
      IF contract.category ∉ exclusive_by_category:
        resolved.append(contract)
      -- Else: non-exclusive suppressed by exclusive in same category

  RETURN resolved
```

### 11.4 Saturation Enforcement

```
CONSTANT MAX_SPONSOR_CAPACITY  ← 0.60   -- 60% of playlist
CONSTANT SATURATION_WARNING_AT ← 0.40   -- 40% triggers advisory

FUNCTION enforceSaturation(contracts):
  total_share ← SUM(contract.share_of_voice FOR contract IN contracts)
  saturation_warning ← total_share >= SATURATION_WARNING_AT
  saturation_exceeded ← total_share > MAX_SPONSOR_CAPACITY

  IF NOT saturation_exceeded:
    RETURN { contracts, saturation_warning, total_share }

  -- Proportional reduction: scale all shares down to fit within MAX_SPONSOR_CAPACITY
  scale_factor ← MAX_SPONSOR_CAPACITY / total_share
  FOR EACH contract IN contracts:
    contract.effective_share ← contract.share_of_voice × scale_factor
    -- Round to 4 decimal places
    contract.effective_share ← round(contract.effective_share, 4)

  RETURN { contracts, saturation_warning: ⊤, total_share: MAX_SPONSOR_CAPACITY }
```

### 11.5 Injection Algorithm

```
FUNCTION sponsorshipInjector(base_playlist, raw_contracts):

  eligible  ← raw_contracts.filter(c => contractEligible(c))
  resolved  ← resolveExclusivity(eligible)
  result    ← enforceSaturation(resolved)

  suppressed_ids ← eligible.map(c => c.id) MINUS resolved.map(c => c.id)

  IF resolved = ∅:
    RETURN { playlist: base_playlist, sponsor_ids: ∅, suppressed_ids, saturation_warning: ⊥, total_share: 0 }

  -- Compute effective playlist length
  -- sponsor items are injected to achieve their share_of_voice percentage
  -- base items fill the remaining percentage

  total_positions ← computeTotalPositions(base_playlist, resolved)
  -- See §11.6 for computeTotalPositions

  -- Build interleaved sequence using weighted round-robin
  all_items ← []

  -- Add base items with weight = (1 - total_sponsor_share) × WEIGHT_SCALE
  base_weight ← round((1.0 - result.total_share) × WEIGHT_SCALE)
  FOR EACH item IN base_playlist:
    all_items.append({ item, weight: base_weight / base_playlist.length })

  -- Add sponsor items
  FOR EACH contract IN resolved:
    sponsor_items ← fetchSponsorContent(contract)
    per_item_weight ← round((contract.effective_share / sponsor_items.length) × WEIGHT_SCALE)
    FOR EACH sponsor_item IN sponsor_items:
      all_items.append({ item: sponsor_item, weight: per_item_weight })

  interleaved ← smoothWeightedRoundRobin(all_items)
  -- smoothWeightedRoundRobin defined in §16.2

  RETURN {
    playlist         : interleaved,
    sponsor_ids      : resolved.map(c => c.id),
    suppressed_ids   : suppressed_ids,
    saturation_warning : result.saturation_warning,
    total_share      : result.total_share
  }
```

### 11.6 Total Positions

```
CONSTANT WEIGHT_SCALE ← 100

FUNCTION computeTotalPositions(base_playlist, contracts):
-- Minimum positions needed to represent all shares as integers.
  shares ← [round((1 - SUM(c.share_of_voice FOR c IN contracts)) × 100)]
           ++ contracts.map(c => round(c.effective_share × 100))
  RETURN SUM(shares)
  -- Result is in [1, 200]; capped implicitly by MAX_SPONSOR_CAPACITY
```

---

## 12. Playlist Normalization

After all resolution levels complete, the playlist MUST be normalized before output.

### 12.1 Normalization Steps (applied in order)

```
FUNCTION normalizePlaylist(items):

  ── Step N1: Remove items with missing or inaccessible content ─────────────
  items ← items WHERE item.content_id ≠ ⊥ AND item.data ≠ ⊥

  ── Step N2: Enforce minimum duration ─────────────────────────────────────
  FOR EACH item IN items:
    IF item.duration_ms < 3_000:
      item.duration_ms ← 3_000
      -- Log: duration_ms below minimum; clamped to 3000

  ── Step N3: Remove zero-duration items (after clamping, these cannot exist) ─
  -- This step is a safety net; N2 guarantees duration_ms >= 3000

  ── Step N4: Canonical data serialization ─────────────────────────────────
  FOR EACH item IN items:
    item.data ← canonicalizeJson(item.data)
    -- canonicalizeJson defined in §16.1

  ── Step N5: Deduplicate content_id (by priority, then specificity, then id) ─
  items ← deduplicateByContentId(items)
  -- Deduplication is by source priority within the same resolution pass.
  -- Sponsor items are never deduplicated against non-sponsor items.

  ── Step N6: Assign source labels ─────────────────────────────────────────
  FOR EACH item IN items:
    IF item.source = ⊥:
      item.source ← inferSource(item)

  ── Step N7: Validate final playlist is non-empty ─────────────────────────
  IF items = ∅:
    RETURN [SYSTEM_FALLBACK_ITEM]

  RETURN items
```

### 12.2 computeContentMix

```
FUNCTION computeContentMix(items):
  total ← items.length
  IF total = 0: RETURN { campaign_pct: 0, sponsor_pct: 0, override_pct: 0, fallback_pct: 0, system_pct: 1.0 }

  counts ← { campaign: 0, sponsor: 0, override: 0, fallback: 0, system: 0 }
  FOR EACH item IN items:
    counts[item.source] ← counts[item.source] + 1

  RETURN {
    campaign_pct  : counts.campaign  / total,
    sponsor_pct   : counts.sponsor   / total,
    override_pct  : counts.override  / total,
    fallback_pct  : counts.fallback  / total,
    system_pct    : counts.system    / total
  }
  -- Note: sum of all pct values MUST equal 1.0 (floating point tolerance: ±0.001)
```

---

## 13. Confidence Score Semantics

### 13.1 Definition

The confidence score is a real number in [0.0, 1.0] representing the degree to which the PRE can certify that a screen is currently displaying its expected playlist.

A score of 1.0 means: the screen is active, recently confirmed the current manifest, and no divergence is detected.
A score of 0.0 means: the screen is offline, or no delivery confirmation exists, or confirmation is so stale as to be meaningless.

### 13.2 Computation

```
CONSTANT POLL_INTERVAL_MS         ← 15_000
CONSTANT STALE_THRESHOLD_NOMINAL  ← 30_000     -- one missed poll
CONSTANT STALE_THRESHOLD_DEGRADED ← 300_000    -- 5 minutes
CONSTANT STALE_THRESHOLD_OFFLINE  ← 1_800_000  -- 30 minutes

FUNCTION computeConfidence(screen, expected_playlist, at, db):

  IF screen.status = 'unprovisioned' OR screen.status = 'assigned':
    RETURN 0.0  -- never confirmed playback

  IF screen.status = 'offline':
    RETURN 0.0

  last_delivery ← queryLastDelivery(screen.id, db)
  IF last_delivery = ⊥:
    RETURN 0.0

  -- Staleness: time since last confirmed delivery
  staleness ← at - (last_delivery.acknowledged_at ?? last_delivery.delivered_at)

  -- Base confidence from staleness
  IF staleness <= STALE_THRESHOLD_NOMINAL:
    base ← 1.0
  ELSE IF staleness <= STALE_THRESHOLD_DEGRADED:
    -- Linear interpolation from 1.0 to 0.7
    t ← (staleness - STALE_THRESHOLD_NOMINAL) / (STALE_THRESHOLD_DEGRADED - STALE_THRESHOLD_NOMINAL)
    base ← 1.0 - (t × 0.3)
  ELSE IF staleness <= STALE_THRESHOLD_OFFLINE:
    -- Linear interpolation from 0.7 to 0.0
    t ← (staleness - STALE_THRESHOLD_DEGRADED) / (STALE_THRESHOLD_OFFLINE - STALE_THRESHOLD_DEGRADED)
    base ← 0.7 - (t × 0.7)
  ELSE:
    base ← 0.0

  -- Divergence penalty
  expected_checksum ← computeChecksum(expected_playlist)
  IF last_delivery.manifest_checksum ≠ expected_checksum:
    -- Screen is using a different manifest than expected
    base ← base × 0.5

  -- Floor at 0.0, ceiling at 1.0
  RETURN clamp(round(base, 4), 0.0, 1.0)
```

### 13.3 Confidence Score is Annotation Only

The confidence score MUST NOT influence the computed playlist. It MUST NOT cause a different playlist to be served. It is informational output for operators and monitoring systems. It does not affect `valid_until`.

---

## 14. Cache Coherency Rules

### 14.1 valid_until Computation

`valid_until` is the earliest future timestamp at which the current resolution output is guaranteed to remain identical. After `valid_until`, the PRE output MUST be recomputed — it may or may not have changed, but validity cannot be guaranteed.

```
CONSTANT MAX_VALID_DURATION ← 86_400_000  -- 24 hours
CONSTANT MIN_VALID_DURATION ← 5_000       -- 5 seconds

FUNCTION computeValidUntil(schedules, overrides, contracts, local_at, at):

  candidates ← []

  -- Active schedules: expire when their ends_at arrives
  FOR EACH schedule IN schedules WHERE schedule.ends_at ≠ ⊥:
    candidates.append(schedule.ends_at)

  -- Active schedules: expire at next intra-day boundary
  FOR EACH schedule IN schedules WHERE schedule.time_of_day_end ≠ ⊥:
    next_boundary ← nextOccurrenceOf(schedule.time_of_day_end, local_at, at)
    candidates.append(next_boundary)

  -- Inactive schedules that will become active: starts_at in the future
  -- (These are not in the current active set but affect future resolution)
  -- Note: This requires querying upcoming schedules; see §4.4 extension below.
  -- For simplicity, if upcoming schedules exist, valid_until MUST NOT exceed
  -- the earliest upcoming starts_at.

  -- Active overrides: expire at end_time
  FOR EACH override IN overrides WHERE override.end_time ≠ ⊥:
    candidates.append(override.end_time)

  -- Sponsorship contracts: expire at ends_at
  FOR EACH contract IN contracts WHERE contract.ends_at ≠ ⊥:
    candidates.append(contract.ends_at)

  -- Next day-of-week transition: midnight of current day in venue local time
  midnight ← nextMidnight(local_at, at)
  candidates.append(midnight)

  IF candidates = ∅:
    RETURN at + MAX_VALID_DURATION

  earliest ← MIN(candidates)

  -- Apply bounds
  RETURN clamp(earliest, at + MIN_VALID_DURATION, at + MAX_VALID_DURATION)
```

### 14.2 Cache Invalidation Triggers

The following events MUST invalidate the manifest cache for all affected screens. "Invalidation" means removal of the cached entry, forcing recomputation on the next request.

| Event | Screens Invalidated | Synchrony |
|---|---|---|
| `emergency.activated` | All screens in venue | Synchronous |
| `emergency.cleared` | All screens in venue | Synchronous |
| `override.created` (operational) | All screens in scope | Synchronous |
| `override.cleared` | All screens in scope | Synchronous |
| `override.expired` | All screens in scope | Asynchronous (≤ 2s) |
| `campaign.published` | All screens in targeted areas | Asynchronous (≤ 2s) |
| `campaign.rolled_back` | All screens in targeted areas | Asynchronous (≤ 2s) |
| `sponsorship.cancelled` | All screens in affected area | Asynchronous (≤ 2s) |
| `screen.assigned` | That screen | Synchronous |
| `content.updated` | All screens referencing that content_id | Asynchronous (≤ 2s) |

### 14.3 Stale Cache Serving

A cached entry is considered stale if `NOW() > computed_at + 5_000ms`. Stale entries MUST trigger a PRE recomputation. A stale entry MUST NOT be served as current.

**Exception:** If the PRE computation fails due to database unavailability, a stale entry MAY be served. The response MUST include a header indicating stale state. The stale entry MUST expire after `MAX_STALE_AGE = 60_000ms`. After `MAX_STALE_AGE`, the System Fallback MUST be served.

### 14.4 Cache Coherency After Emergency

An emergency activation MUST synchronously invalidate ALL manifest_cache entries for the venue before the activation HTTP response is sent. The in-process LRU cache MUST be fully cleared (not just the affected venue's entries) at emergency activation and clearance. This ensures no screen can receive a non-emergency manifest through any cache layer during an active emergency.

### 14.5 Version Invariance

The version number stored in `manifest_cache` MUST be preserved across cache invalidations. Invalidation deletes the cache entry; on the subsequent recomputation, if the new checksum matches a previously known checksum (from `manifest_cache.checksum` before deletion), the version MUST NOT be reset. Versions are monotonically increasing per screen and MUST NOT reset.

**Implementation note:** The version must be maintained in a separate, non-invalidated store or re-derived from the history of `screen_delivery_log`. The simplest conforming implementation: store version in a separate `screen_versions` table keyed by `screen_id`, updated only when checksum changes, never deleted on cache invalidation.

---

## 15. Playlist Normalization — Campaign Resolver

### 15.1 campaignResolver

```
FUNCTION campaignResolver(active_schedules, db):
-- Produces a playlist from a set of active, non-fallback schedules.

  ── Fetch content data for all content_ids ─────────────────────────────────
  content_ids ← unique(active_schedules.map(s => s.content_id))
  content_map ← db.query(SELECT id, type, data FROM content WHERE id = ANY(content_ids))
                   .indexBy('id')

  ── Build raw items ────────────────────────────────────────────────────────
  raw_items ← []
  FOR EACH schedule IN active_schedules:
    content ← content_map[schedule.content_id]
    IF content = ⊥:
      -- Content deleted after schedule was created
      -- Log: orphaned schedule reference
      CONTINUE  -- skip this item

    raw_items.append({
      content_id  : schedule.content_id,
      type        : content.type,
      data        : content.data,
      duration_ms : schedule.duration_ms,
      priority    : schedule.priority,
      source      : 'campaign',
      campaign_id : schedule.campaign_id,
      schedule_id : schedule.id,
      specificity : computeSpecificity(schedule)
    })

  ── Deduplicate by content_id ──────────────────────────────────────────────
  deduped ← deduplicateByContentId(raw_items)

  ── Apply weighted ordering ────────────────────────────────────────────────
  IF deduped.length = 1:
    RETURN deduped  -- trivial case: no ordering needed

  RETURN weightedPlaylistResolver(deduped)
  -- weightedPlaylistResolver defined in §16
```

---

## 16. Weighted Scheduling Algorithm

### 16.1 canonicalizeJson

All JSON objects used as input to checksum computation MUST be serialized in canonical form. Canonical form is defined as:
- Object keys sorted lexicographically (Unicode code point order)
- Recursively applied to nested objects
- No extra whitespace
- Null values retained (not omitted)

```
FUNCTION canonicalizeJson(obj):
  IF obj = null OR typeof obj != 'object' OR Array.isArray(obj):
    RETURN JSON.stringify(obj)

  sorted_keys ← Object.keys(obj).sort()
  parts ← []
  FOR EACH key IN sorted_keys:
    parts.append(JSON.stringify(key) + ':' + canonicalizeJson(obj[key]))

  RETURN '{' + parts.join(',') + '}'
```

### 16.2 smoothWeightedRoundRobin

This algorithm produces a maximally smooth interleaving of items with associated integer weights. Given N items with weights [w₁, w₂, ..., wN], it produces a sequence of sum(weights) items where item i appears exactly wᵢ times and the appearances are as evenly distributed as possible.

This is the Nginx SWRR algorithm. It is deterministic for identical inputs.

```
FUNCTION smoothWeightedRoundRobin(weighted_items):
-- weighted_items: [{ item, weight: INTEGER > 0 }]
-- Returns an ordered list of items.

  n      ← weighted_items.length
  total  ← SUM(wi.weight FOR wi IN weighted_items)
  output ← []

  -- current_weight tracks running balance for each item
  current_weight ← [0] × n

  FOR position FROM 0 TO total - 1:
    -- Increment each item's current weight by its effective weight
    FOR i FROM 0 TO n - 1:
      current_weight[i] ← current_weight[i] + weighted_items[i].weight

    -- Select item with highest current_weight
    -- Tie-break: lower array index (preserves determinism)
    best ← argmax(current_weight)

    -- Decrement selected item's weight by total
    current_weight[best] ← current_weight[best] - total

    output.append(weighted_items[best].item)

  RETURN output
```

**Correctness property:** For any completion of the algorithm, item i has appeared exactly `weighted_items[i].weight` times. The maximum gap between any two appearances of the same item is bounded.

### 16.3 weightedPlaylistResolver

```
FUNCTION weightedPlaylistResolver(items):
-- items: PlaylistItem[] each with a weight field (default 100 if absent)

  -- Normalize weights to integers (divide by GCD)
  weights ← items.map(item => item.weight ?? 100)
  g ← gcd_of_all(weights)
  normalized ← weights.map(w => w / g)

  weighted_items ← zip(items, normalized).map((item, w) => { item, weight: w })

  RETURN smoothWeightedRoundRobin(weighted_items)
```

### 16.4 gcd_of_all

```
FUNCTION gcd(a, b):
  WHILE b ≠ 0:
    a, b ← b, a MOD b
  RETURN a

FUNCTION gcd_of_all(numbers):
  result ← numbers[0]
  FOR i FROM 1 TO numbers.length - 1:
    result ← gcd(result, numbers[i])
  RETURN result
```

---

## 17. Fallback Selection Algorithm

### 17.1 Fallback Hierarchy

Fallback is applied in order. The first tier that produces a non-empty playlist terminates fallback selection.

```
Tier 1: Area-level fallback schedules    (is_fallback=⊤, area_id = screen's area)
Tier 2: Venue-level fallback schedules   (is_fallback=⊤, venue_id = screen's venue, area_id IS NULL)
Tier 3: Legacy playlists table           (backward compat: playlists WHERE screen_id = screen.id)
Tier 4: System Fallback                  (compiled-in static content)
```

### 17.2 fallbackResolver

```
FUNCTION fallbackResolver(fallback_schedules, ctx, db):

  ── Tier 1: Area-level fallback schedules ──────────────────────────────────
  area_fallback ← fallback_schedules WHERE schedule.area_id = ctx.area.id
  IF area_fallback ≠ ∅:
    RETURN campaignResolver(area_fallback, db)

  ── Tier 2: Venue-level fallback schedules ─────────────────────────────────
  venue_fallback ← fallback_schedules WHERE
    schedule.venue_id = ctx.venue.id AND schedule.area_id = ⊥
  IF venue_fallback ≠ ∅:
    RETURN campaignResolver(venue_fallback, db)

  ── Tier 3: Legacy playlists (backward compatibility) ─────────────────────
  legacy ← db.query(
    SELECT items FROM playlists WHERE screen_id = ctx.screen.id LIMIT 1
  )
  IF legacy ≠ ⊥ AND legacy.items ≠ ∅:
    items ← legacy.items.map(i => ({
      ...i,
      source: 'fallback',
      schedule_id: ⊥,
      campaign_id: ⊥
    }))
    RETURN normalizePlaylist(items)

  ── Tier 4: System Fallback ────────────────────────────────────────────────
  RETURN [SYSTEM_FALLBACK_ITEM]
```

### 17.3 System Fallback Content

```
CONSTANT SYSTEM_FALLBACK_ITEM ← {
  content_id  : 'system-fallback',
  type        : 'promo_slide',
  data        : { headline: 'ClubHub', subheadline: '' },
  duration_ms : 15_000,
  priority    : 0,
  source      : 'system',
  campaign_id : ⊥,
  schedule_id : ⊥
}
```

The System Fallback item MUST be a compile-time constant. It MUST NOT require database access. It MUST NOT be configurable at runtime in a way that could make it unavailable.

---

## 18. Checksum Semantics

### 18.1 Algorithm

The checksum is a 32-bit FNV-1a hash of the canonical serialization of the playlist.

```
CONSTANT FNV1A_OFFSET_BASIS ← 2_166_136_261
CONSTANT FNV1A_PRIME        ← 16_777_619
CONSTANT FNV1A_MOD          ← 2^32

FUNCTION fnv1a32(input_string):
  hash ← FNV1A_OFFSET_BASIS
  FOR EACH byte IN utf8_encode(input_string):
    hash ← ((hash XOR byte) × FNV1A_PRIME) MOD FNV1A_MOD
  RETURN hash

FUNCTION computeChecksum(playlist):
  item_signatures ← []
  FOR EACH item IN playlist:
    signature ← item.content_id
              + ':' + item.duration_ms.toString()
              + ':' + item.priority.toString()
              + ':' + canonicalizeJson(item.data)
    item_signatures.append(signature)

  combined ← item_signatures.join('|')
  hash     ← fnv1a32(combined)
  RETURN hash.toString(16).padStart(8, '0')  -- 8 hex characters, zero-padded
```

### 18.2 Checksum Invariants

- Items MUST be in their post-normalization order when the checksum is computed.
- The `source` field of a PlaylistItem is NOT included in the checksum. Source is operational metadata; it does not affect playback content.
- The `schedule_id` and `campaign_id` fields are NOT included in the checksum. Same content from a different schedule produces the same checksum.
- If the only change to a playlist is a change in `source`, `schedule_id`, or `campaign_id`, the checksum MUST remain identical.
- A change to `content.data` for any item in the playlist MUST produce a different checksum.

### 18.3 Checksum Stability

Two implementations of the PRE MUST produce identical checksums for identical playlists. The canonicalizeJson function (§16.1) ensures data field serialization is deterministic. Implementors MUST validate against the test vectors in Appendix B.

---

## 19. Version Semantics

### 19.1 Version Increment Rule

```
FUNCTION computeVersion(screen_id, new_checksum, db):
  existing ← db.query(
    SELECT checksum, version FROM screen_versions WHERE screen_id = $screen_id
    FOR UPDATE
  )

  IF existing = ⊥:
    new_version ← 1
  ELSE IF existing.checksum = new_checksum:
    new_version ← existing.version  -- no change
  ELSE:
    new_version ← existing.version + 1  -- checksum changed: increment

  UPSERT screen_versions (screen_id, checksum=new_checksum, version=new_version)

  RETURN new_version
```

### 19.2 Version Properties

- Versions start at 1. Version 0 is forbidden (see §23, FORBIDDEN-3).
- Versions are per-screen. Version sequences for different screens are independent.
- Versions are monotonically non-decreasing. They MUST NOT decrement on rollback, override clearance, or emergency clearance.
- If content is replaced and then restored to its original state (identical checksum), the version does NOT revert to the previous value; it increments to the next integer.

---

## 20. Stale Screen and Divergence Semantics

### 20.1 Divergence Definition

A screen is divergent at time `t` if and only if:

```
divergence(screen, t) ≡
  computeChecksum(PRE(screen.id, t, S).active_playlist)
  ≠
  lastDeliveredChecksum(screen.id)
```

Where `lastDeliveredChecksum` is the `manifest_checksum` from the most recent `screen_delivery_log` row for this screen.

Divergence is a condition, not a state. It is computed on demand. It is not persisted.

### 20.2 Classes of Divergence

**Class A — Transitional Divergence:** The PRE has generated a new manifest (checksum changed) and the screen has not yet polled to receive it. Expected duration: up to 15 seconds (one poll cycle). Not an error.

**Class B — Stale Divergence:** The screen has not polled for longer than `POLL_INTERVAL_MS + JITTER_MAX = 30s`. The screen may be experiencing connectivity issues. `confidence_score` reflects degraded certainty.

**Class C — Extended Divergence:** The screen has not polled for longer than `STALE_THRESHOLD_DEGRADED = 5 min`. Screen status transitions to 'degraded'. Operator notification is appropriate.

**Class D — Offline Divergence:** The screen has not polled for longer than `STALE_THRESHOLD_OFFLINE = 30 min`. Screen status transitions to 'offline'. Content shown on the physical screen is unknown; it reflects whatever was last cached on the device.

### 20.3 Divergence Does Not Affect Resolution

The PRE MUST compute the same playlist regardless of whether a screen is divergent. Divergence affects only `confidence_score` and operational visibility. It does not cause the PRE to serve different content.

---

## 21. Failure Semantics

### 21.1 Database Unavailable

If the database connection fails before the PRE can execute any query:
- The PRE propagates the error to the caller (Manifest Delivery System).
- The MDS serves the in-process LRU cache entry if present and within `MAX_STALE_AGE`.
- If no LRU entry exists or it has exceeded `MAX_STALE_AGE`, the MDS serves the System Fallback manifest directly. The PRE is NOT invoked.

### 21.2 Partial Database Failure

If the database connection fails mid-execution (after some queries succeed):
- The PRE MUST abort the current resolution and propagate the error.
- Partial results MUST NOT be served as a manifest.
- The MDS applies the same fallback logic as §21.1.

### 21.3 Missing Referenced Content

If a schedule references a `content_id` that no longer exists in the `content` table:

```
FUNCTION handleMissingContent(schedule):
  -- Log a warning: orphaned schedule reference
  -- Do NOT throw.
  -- Skip this schedule item; continue resolution with remaining items.
  RETURN ⊥  -- item excluded from playlist
```

If all items in a level resolve to missing content, the PRE MUST continue to the next fallback tier.

### 21.4 Invalid Timezone

If `venue.timezone` is not a valid IANA timezone identifier:
- The PRE MUST NOT throw.
- The PRE MUST fall back to UTC (§8.4).
- All time-of-day schedule evaluations proceed using UTC as the local time.
- A warning MUST be logged identifying the venue and the invalid timezone string.

### 21.5 Empty Campaign

A campaign with no associated content items in `campaign_content_items` MUST be treated as absent. It contributes no items to the playlist. It does not prevent fallback from activating if no other campaigns are active.

### 21.6 Override Referencing Missing Campaign

If an override references a `campaign_id` that no longer exists:
- Log a warning.
- Treat the override as a suppression of nothing (for `suppression` type) or skip it (for other types).
- Do NOT throw. Continue resolution.

### 21.7 Emergency with Missing Content

If `emergency_states.content_id` references a deleted content item:
- Serve the platform default emergency content (SYSTEM_EMERGENCY_FALLBACK).
- Do NOT propagate the content as non-existent.
- The emergency state remains active. The screen shows emergency content.

```
CONSTANT SYSTEM_EMERGENCY_FALLBACK ← {
  content_id  : 'system-emergency',
  type        : 'promo_slide',
  data        : { headline: 'Emergency', subheadline: 'Please follow staff instructions' },
  duration_ms : 10_000,
  priority    : 0,
  source      : 'emergency',
  campaign_id : ⊥,
  schedule_id : ⊥
}
```

---

## 22. State Machines

### 22.1 Screen Status State Machine

```
States: { unprovisioned, assigned, active, degraded, offline }

Transitions:
  unprovisioned → assigned    WHEN: operator assigns screen to venue + area + tv_group
  assigned      → active      WHEN: screen polls and manifest is acknowledged
  active        → degraded    WHEN: last_seen_at < NOW() - 5min AND status = 'active'
                              (evaluated by background job every 60s)
  degraded      → active      WHEN: screen polls successfully (heartbeat recorded)
  degraded      → offline     WHEN: last_seen_at < NOW() - 30min AND status = 'degraded'
                              (evaluated by background job every 60s)
  offline       → active      WHEN: screen polls successfully (heartbeat recorded)
  offline       → unprovisioned  NEVER — offline screens retain their assignment
  assigned      → unprovisioned  WHEN: operator explicitly de-provisions screen

Invariants:
  - A screen in 'unprovisioned' state MUST have tv_group_id IS NULL
  - A screen NOT in 'unprovisioned' MUST have tv_group_id IS NOT NULL
  - Status transition records MUST be written to audit_log
```

### 22.2 Emergency State Machine

```
States: { inactive, active, cleared }
-- 'inactive' is the absence of a row; 'active' and 'cleared' are row statuses.

Transitions:
  inactive → active   WHEN: operator activates emergency for venue
                      EFFECT: synchronous manifest cache bust for all venue screens
  active   → cleared  WHEN: operator clears emergency
                      EFFECT: synchronous manifest cache bust for all venue screens

Invariants:
  - At most one row with status='active' per venue_id (enforced by UNIQUE partial index)
  - 'active' → 'cleared' transition MUST update cleared_at and cleared_by
  - Cleared emergencies MUST NOT be deleted (retained for audit)
  - Emergency activation MUST fail atomically if the database write fails
    (no partial state: either the DB row exists and cache is busted, or neither)
```

### 22.3 Override Lifecycle State Machine

```
States: { active, expired, cleared }

Transitions:
  (created) → active   WHEN: created by operator
  active → expired     WHEN: end_time ≤ NOW() (evaluated by expiration job every 30s)
  active → cleared     WHEN: operator explicitly clears the override

Invariants:
  - end_time = ⊥ (null) means persistent: override remains active until cleared
  - An override with end_time ≤ start_time MUST be rejected at creation (see §23)
  - Expired and cleared overrides are retained in the database (audit trail)
  - Expiration is not instantaneous: up to 30s lag before expiration is processed
    The PRE evaluates end_time directly (not the status field) to determine activity
    This ensures the PRE is authoritative even if the expiration job is delayed
```

**Important:** The PRE MUST evaluate override activity using temporal constraints directly:
```
override_active(override, at) ≡
  override.status = 'active'
  AND override.start_time <= at
  AND (override.end_time = ⊥ OR override.end_time > at)
```

The `status` field alone is not sufficient. An override with `status='active'` but `end_time <= at` MUST be treated as expired by the PRE.

### 22.4 Campaign Lifecycle State Machine

```
States: { draft, published, scheduled, expired, archived }

Transitions:
  draft     → published   WHEN: operator publishes (immediate effect)
  draft     → scheduled   WHEN: operator publishes with future effective date
  scheduled → published   WHEN: effective date arrives (system transition)
  published → archived    WHEN: all schedule windows have ended OR operator archives
  published → draft       WHEN: operator rolls back (snapshot restored, re-draft)
  archived  → draft       WHEN: operator restores from archive

Invariants:
  - Only 'published' and 'scheduled' campaigns generate rows in the 'schedules' table
  - Archiving a campaign MUST delete its rows from the 'schedules' table
  - Rolling back a campaign MUST delete its current rows and restore from rollback_snapshot
```

---

## 23. Forbidden States and Invariant Violations

The following conditions MUST NEVER exist in a conforming system. If detected, they indicate a data integrity failure and MUST trigger an alert.

**FORBIDDEN-1: Two active emergencies for the same venue**
```
SELECT COUNT(*) FROM emergency_states
WHERE venue_id = $v AND status = 'active'
HAVING COUNT(*) > 1
-- Result MUST always be 0
```

**FORBIDDEN-2: Screen with area_id inconsistent with tv_group's area_id**
```
SELECT s.id FROM screens s
JOIN tv_groups g ON s.tv_group_id = g.id
WHERE s.area_id ≠ g.area_id AND s.tv_group_id IS NOT NULL
-- Result MUST always be empty
```

**FORBIDDEN-3: manifest_cache entry with version = 0**
```
SELECT * FROM manifest_cache WHERE version = 0
-- Result MUST always be empty
```

**FORBIDDEN-4: Schedule with starts_at ≥ ends_at (non-null both)**
```
SELECT * FROM schedules WHERE starts_at IS NOT NULL AND ends_at IS NOT NULL AND starts_at >= ends_at
-- Result MUST always be empty
```

**FORBIDDEN-5: Override with end_time ≤ start_time**
```
SELECT * FROM overrides WHERE end_time IS NOT NULL AND end_time <= start_time
-- Result MUST always be empty
```

**FORBIDDEN-6: Sponsorship contract with share_of_voice outside (0, 100]**
```
SELECT * FROM sponsorship_contracts
WHERE share_of_voice <= 0 OR share_of_voice > 100
-- Result MUST always be empty
```

**FORBIDDEN-7: Screen with status ≠ 'unprovisioned' and tv_group_id IS NULL**
```
SELECT * FROM screens
WHERE status NOT IN ('unprovisioned') AND tv_group_id IS NULL
-- Result MUST always be empty after migration phase 3
```

**FORBIDDEN-8: PlaylistItem with duration_ms < 3000 in any manifest_cache entry**
Any item in `manifest_cache.manifest->'items'` with `duration_ms < 3000` indicates a normalization failure.

**FORBIDDEN-9: Version decrement**
For any screen, no stored version in `screen_versions` may be less than a previously stored version. Monotonicity MUST be enforced at the write layer.

**FORBIDDEN-10: Mandate suppression by non-org-admin**
A suppression override issued by an actor with authority below `org_admin` that targets a campaign with `is_mandated = ⊤` MUST be rejected at creation, not silently accepted and then ignored.

---

## 24. Edge Cases

The following edge cases have defined, non-ambiguous behavior.

### EC-1: Schedule with starts_at = ends_at

Rejected at creation. If such a row exists (data integrity failure), `scheduleActive` returns ⊥ for all timestamps. It contributes no content.

### EC-2: Two overrides issued at the same millisecond

Resolved by lexicographically smaller `id` wins (§5.3). This is deterministic and stable.

### EC-3: Campaign with one item and min_separation = 3

The item repeats. The playlist is `[item, item, item, ...]`. Minimum separation is advisory for multi-item playlists. With one item, separation cannot be satisfied; the item repeats unconditionally.

### EC-4: Midnight-crossing schedule on DST "fall back" night

The schedule's pre-midnight and post-midnight windows both execute as defined. The ambiguous hour (which occurs twice) is covered by §8.3. The schedule may appear to run for an extra hour from the operator's perspective, which is the correct wall-clock behavior.

### EC-5: Midnight-crossing schedule on DST "spring forward" night

If the schedule's `time_of_day_end` falls within the gap (e.g., 02:30 in a 02:00→03:00 gap), the schedule effectively ends at the gap start time (02:00 wall clock = 03:00 post-transition). The gap is never reached by `local_at.time_ms`. The schedule ends at the last valid millisecond before the gap.

### EC-6: PRE invoked for a screen mid-assignment (tv_group_id just set)

The PRE reads `READ COMMITTED`. If the assignment is committed before the PRE reads it, the screen receives the new Area's content. If the assignment is not yet committed, the screen is still in 'unprovisioned' state and receives System Fallback. No inconsistency is possible.

### EC-7: Emergency activated during a PRE invocation

If emergency is activated between the time Q1 (emergency query) executes and the time the PRE returns, the current invocation will not reflect the emergency. The emergency will be reflected on the next poll (within 15 seconds). This is acceptable: the cache bust that follows emergency activation ensures no stale manifest is served from cache, and the next invocation will see the emergency at Level 0.

### EC-8: Area with zero assigned screens

The PRE is never invoked for an area directly; it is invoked per screen. An area with no screens has no PRE invocations. No error condition. Schedules targeting that area exist in the database but produce no manifests.

### EC-9: Venue with no configured timezone (timezone IS NULL)

Treated as invalid timezone. PRE falls back to UTC per §8.4.

### EC-10: Weight of zero on a campaign content item

A content item with `weight = 0` is excluded from the playlist. It MUST NOT appear. `weight ≤ 0` is treated as absent. This is enforced during weight normalization (GCD computation cannot proceed with zero weights).

### EC-11: All sponsor contracts suppressed by exclusivity conflict

If exclusivity resolution removes all eligible contracts, the playlist is the base_playlist unmodified. No sponsor content appears. No error.

### EC-12: Override with no campaign_id (insertion type)

An override of `override_type = 'insertion'` with no `campaign_id` is a no-op. The override is active but contributes nothing. This is not an error. The base_playlist passes through unmodified.

### EC-13: Screen polls while manifest is being computed (concurrent requests)

The `SELECT FOR UPDATE` on `manifest_cache` (§19.1) serializes version management. Two concurrent requests for the same screen: the first acquires the lock and writes the manifest; the second finds the cache fresh (within 5s) and returns it. The version is incremented only once.

### EC-14: valid_until in the past

If `computeValidUntil` produces a timestamp <= `at`, the MIN_VALID_DURATION floor (§14.1) ensures `valid_until = at + 5_000ms`. The manifest is valid for at least 5 seconds regardless of upcoming transitions.

---

## Appendix A: Pseudocode Index

| Function | Section | Purpose |
|---|---|---|
| `PRE.resolve` | §6 | Top-level resolution function |
| `buildContext` | §6.1 | Resolve screen→group→area→venue→org |
| `selectOverride` | §6.2 | Select governing override from candidates |
| `filterSchedules` | §6.3 | Apply suppression context to schedule set |
| `mergeSuppression` | §6.4 | Combine suppression override contexts |
| `scheduleActive` | §7.1 | Evaluate time window for a single schedule |
| `timeToMs` | §7.2 | Convert HH:MM to ms since midnight |
| `toVenueLocal` | §8.1 | Convert UTC timestamp to venue local time |
| `resolveTimezone` | §8.4 | Timezone resolution with fallback |
| `deduplicateByContentId` | §9.1 | Remove duplicate content_ids by priority |
| `applySuppression` | §10.2 | Filter schedules by suppression context |
| `filterScheduleForSuppression` | §10.3 | Per-schedule mandate-aware suppression check |
| `contractEligible` | §11.2 | Check if sponsorship contract is active |
| `resolveExclusivity` | §11.3 | Apply exclusivity rules to contract set |
| `enforceSaturation` | §11.4 | Cap and warn on sponsor share excess |
| `sponsorshipInjector` | §11.5 | Inject sponsors into base playlist |
| `computeTotalPositions` | §11.6 | Compute playlist length for injection |
| `normalizePlaylist` | §12.1 | Post-resolution playlist normalization |
| `computeContentMix` | §12.2 | Compute source percentage breakdown |
| `computeConfidence` | §13.2 | Compute confidence score for a screen |
| `computeValidUntil` | §14.1 | Compute manifest expiry timestamp |
| `campaignResolver` | §15.1 | Build playlist from active schedules |
| `canonicalizeJson` | §16.1 | Deterministic JSON serialization |
| `smoothWeightedRoundRobin` | §16.2 | SWRR interleaving algorithm |
| `weightedPlaylistResolver` | §16.3 | Weighted playlist ordering |
| `gcd` / `gcd_of_all` | §16.4 | GCD for weight normalization |
| `fallbackResolver` | §17.2 | Fallback tier selection |
| `computeChecksum` | §18.1 | FNV-1a checksum of playlist |
| `fnv1a32` | §18.1 | FNV-1a 32-bit hash function |
| `computeVersion` | §19.1 | Monotone version increment |
| `override_active` | §22.3 | Temporal override activity check |

---

## Appendix B: Checksum Test Vectors

Implementations MUST validate their `computeChecksum` output against these test vectors before deployment. Discrepancy indicates a non-conformant implementation.

### Vector 1: Single item, simple data

```
Input playlist:
  [{
    content_id  : "abc123",
    duration_ms : 10000,
    priority    : 50,
    data        : { "headline": "Happy Hour", "subheadline": "50% off" }
  }]

Canonical signature:
  "abc123:10000:50:{\"headline\":\"Happy Hour\",\"subheadline\":\"50% off\"}"

Combined string:
  "abc123:10000:50:{\"headline\":\"Happy Hour\",\"subheadline\":\"50% off\"}"

Expected checksum: "9a4b2c1e"
```

### Vector 2: Two items, ordering matters

```
Input playlist (after normalization, in this order):
  [
    {
      content_id: "item-001", duration_ms: 15000, priority: 100,
      data: { "image": "/uploads/promo.jpg", "headline": "Weekend Special" }
    },
    {
      content_id: "item-002", duration_ms: 10000, priority: 50,
      data: { "headline": "ClubHub", "subheadline": "" }
    }
  ]

Item 1 signature:
  "item-001:15000:100:{\"headline\":\"Weekend Special\",\"image\":\"/uploads/promo.jpg\"}"
  -- NOTE: keys sorted: "headline" < "image"

Item 2 signature:
  "item-002:10000:50:{\"headline\":\"ClubHub\",\"subheadline\":\"\"}"

Combined (joined with '|'):
  "item-001:15000:100:{...}|item-002:10000:50:{...}"

Expected checksum: "3f7d9b22"
```

### Vector 3: Data key ordering sensitivity

Two items identical except data key order. MUST produce identical checksum (canonicalization normalizes key order).

```
Item A data: { "b": 2, "a": 1 }
Item B data: { "a": 1, "b": 2 }

Both canonicalize to: {"a":1,"b":2}
Both MUST produce identical checksums.
```

### Vector 4: Source field does not affect checksum

Two playlists identical in content_id, duration_ms, priority, and data but with different `source` values ('campaign' vs 'override') MUST produce identical checksums.

---

## Appendix C: Required Environment Constants

These values MUST be configurable via environment variables and MUST have the specified defaults.

| Constant | Env Var | Default | Unit | Notes |
|---|---|---|---|---|
| `POLL_INTERVAL_MS` | `POLL_INTERVAL_MS` | 15000 | ms | Expected poll cadence |
| `MAX_STALE_AGE` | `INPROCESS_CACHE_TTL_MS` | 60000 | ms | In-process LRU TTL |
| `DB_CACHE_TTL` | `MANIFEST_CACHE_TTL_MS` | 5000 | ms | manifest_cache TTL |
| `MAX_SPONSOR_CAPACITY` | `MAX_SPONSOR_CAPACITY` | 0.60 | ratio | Sponsor share ceiling |
| `SATURATION_WARNING_AT` | `SATURATION_WARNING_AT` | 0.40 | ratio | Sponsor saturation warning |
| `STALE_THRESHOLD_DEGRADED` | `STALE_SCREEN_DEGRADED_MS` | 300000 | ms | 5 min |
| `STALE_THRESHOLD_OFFLINE` | `STALE_SCREEN_OFFLINE_MS` | 1800000 | ms | 30 min |
| `MIN_ITEM_DURATION_MS` | (not configurable) | 3000 | ms | Compile-time constant |
| `MIN_VALID_DURATION` | (not configurable) | 5000 | ms | Compile-time constant |
| `MAX_VALID_DURATION` | (not configurable) | 86400000 | ms | 24 hours; compile-time |
| `WEIGHT_SCALE` | (not configurable) | 100 | integer | SWRR weight scale |

Constants marked "(not configurable)" are compile-time values and MUST NOT be altered via environment configuration.
