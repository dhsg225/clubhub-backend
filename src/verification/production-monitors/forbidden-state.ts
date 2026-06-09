/**
 * FORBIDDEN state production monitors.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §4.5
 * Constitutional reference: PRE-REFERENCE-IMPLEMENTATION-v1.md §FORBIDDEN-1 through FORBIDDEN-10
 *
 * These monitors run on a schedule (every 15 minutes per FORBIDDEN_STATE_MONITOR_INTERVAL_MS)
 * and emit structured alerts when any FORBIDDEN state is detected.
 *
 * FORBIDDEN states are database-level invariants that the PRE depends on being true.
 * They cannot be asserted at PRE.resolve() time alone — they require querying the
 * database for structural consistency properties.
 *
 * Severity: All FORBIDDEN state detections are CONSTITUTIONAL_BREACH.
 * Response: Alert immediately; do not auto-correct (advisory-only principle).
 */

import { FORBIDDEN_STATE_MONITOR_INTERVAL_MS } from '../../pre/constants';

// ─── Monitor Types ────────────────────────────────────────────────────────────

export interface ForbiddenStateViolation {
  forbidden_id:   string;       // e.g., "FORBIDDEN-1"
  description:    string;
  detected_at:    number;       // UTC ms
  severity:       'CONSTITUTIONAL_BREACH';
  /** Rows that are in the forbidden state */
  affected_rows:  unknown[];
  /** Recommended operator action (advisory — never auto-executed) */
  advisory_action: string;
}

export interface ForbiddenStateMonitorResult {
  checked_at:  number;
  violations:  ForbiddenStateViolation[];
  clean:       boolean;
}

/** Database interface sufficient for read-only monitoring queries */
export interface MonitorDb {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

// ─── Individual Monitor Queries ────────────────────────────────────────────────

/**
 * FORBIDDEN-1: Two or more active emergency states for the same venue.
 *
 * Only one emergency state may be active per venue at any time.
 * Multiple active emergencies create undefined PRE resolution behavior.
 */
export async function checkForbidden1(db: MonitorDb): Promise<ForbiddenStateViolation | null> {
  const rows = await db.query<{ venue_id: string; active_count: number }>(`
    SELECT venue_id, COUNT(*) as active_count
    FROM emergency_states
    WHERE is_active = true
    GROUP BY venue_id
    HAVING COUNT(*) > 1
  `);

  if (rows.length === 0) return null;

  return {
    forbidden_id: 'FORBIDDEN-1',
    description: 'Multiple active emergency states for the same venue',
    detected_at: Date.now(),
    severity: 'CONSTITUTIONAL_BREACH',
    affected_rows: rows,
    advisory_action:
      'Deactivate all but one emergency state per venue. ' +
      'Investigate how multiple emergencies became active simultaneously.',
  };
}

/**
 * FORBIDDEN-2: Schedule with no active campaign and no direct content_id.
 *
 * A schedule must reference either a published campaign or a direct content_id.
 * Orphaned schedules produce undefined PRE resolution behavior.
 */
export async function checkForbidden2(db: MonitorDb): Promise<ForbiddenStateViolation | null> {
  const rows = await db.query<{ schedule_id: string; campaign_id: string | null; content_id: string | null }>(`
    SELECT s.id as schedule_id, s.campaign_id, s.content_id
    FROM schedules s
    LEFT JOIN campaigns c ON s.campaign_id = c.id AND c.status = 'published'
    WHERE s.is_active = true
      AND s.content_id IS NULL
      AND (s.campaign_id IS NULL OR c.id IS NULL)
  `);

  if (rows.length === 0) return null;

  return {
    forbidden_id: 'FORBIDDEN-2',
    description: 'Active schedule with no published campaign and no direct content_id',
    detected_at: Date.now(),
    severity: 'CONSTITUTIONAL_BREACH',
    affected_rows: rows,
    advisory_action:
      'Either deactivate the orphaned schedules or link them to a published campaign ' +
      'or a valid content_id.',
  };
}

/**
 * FORBIDDEN-3: Override referencing a non-existent content_id.
 *
 * An active override that references a deleted or non-existent content item
 * causes PRE to produce an output with an invalid content_id (INV-6 violation).
 */
export async function checkForbidden3(db: MonitorDb): Promise<ForbiddenStateViolation | null> {
  const rows = await db.query<{ override_id: string; content_id: string }>(`
    SELECT o.id as override_id, o.content_id
    FROM overrides o
    LEFT JOIN content_items ci ON o.content_id = ci.id
    WHERE o.expires_at IS NULL OR o.expires_at > (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      AND ci.id IS NULL
  `);

  if (rows.length === 0) return null;

  return {
    forbidden_id: 'FORBIDDEN-3',
    description: 'Active override references a non-existent content_id',
    detected_at: Date.now(),
    severity: 'CONSTITUTIONAL_BREACH',
    affected_rows: rows,
    advisory_action:
      'Remove or expire the override referencing the missing content_id, ' +
      'or restore the missing content item.',
  };
}

/**
 * FORBIDDEN-4: Screen assigned to an area that belongs to a different venue.
 *
 * Screen-area-venue assignments must be consistent. Cross-venue contamination
 * causes PRE to apply the wrong venue timezone and configuration.
 */
export async function checkForbidden4(db: MonitorDb): Promise<ForbiddenStateViolation | null> {
  const rows = await db.query<{ screen_id: string; screen_venue_id: string; area_venue_id: string }>(`
    SELECT s.id as screen_id, s.venue_id as screen_venue_id, a.venue_id as area_venue_id
    FROM screens s
    JOIN areas a ON s.area_id = a.id
    WHERE s.venue_id != a.venue_id
  `);

  if (rows.length === 0) return null;

  return {
    forbidden_id: 'FORBIDDEN-4',
    description: 'Screen assigned to an area that belongs to a different venue',
    detected_at: Date.now(),
    severity: 'CONSTITUTIONAL_BREACH',
    affected_rows: rows,
    advisory_action:
      'Reassign the screen to the correct area, or correct the venue assignment.',
  };
}

/**
 * FORBIDDEN-5: Sponsorship contract with sov_pct <= 0 or sov_pct > 1.
 *
 * SOV percentages must be in (0, 1]. Zero or negative SOV has undefined behavior.
 * SOV > 1 (100%) would allow sponsorship to crowd out all campaign content.
 */
export async function checkForbidden5(db: MonitorDb): Promise<ForbiddenStateViolation | null> {
  const rows = await db.query<{ contract_id: string; sov_pct: number }>(`
    SELECT id as contract_id, sov_pct
    FROM sponsorship_contracts
    WHERE is_active = true
      AND (sov_pct <= 0 OR sov_pct > 1)
  `);

  if (rows.length === 0) return null;

  return {
    forbidden_id: 'FORBIDDEN-5',
    description: 'Active sponsorship contract with sov_pct out of (0, 1] range',
    detected_at: Date.now(),
    severity: 'CONSTITUTIONAL_BREACH',
    affected_rows: rows,
    advisory_action:
      'Correct the sov_pct to a value in (0, 1]. ' +
      'sov_pct = 0 means no sponsorship; sov_pct > 1 means more than 100% SOV (impossible).',
  };
}

/**
 * FORBIDDEN-6: Venue with null or empty timezone field.
 *
 * PRE requires a valid IANA timezone for every venue. A null or empty timezone
 * causes INV-9 (Timezone Isolation) violation.
 */
export async function checkForbidden6(db: MonitorDb): Promise<ForbiddenStateViolation | null> {
  const rows = await db.query<{ venue_id: string; timezone: string | null }>(`
    SELECT id as venue_id, timezone
    FROM venues
    WHERE is_active = true
      AND (timezone IS NULL OR timezone = '')
  `);

  if (rows.length === 0) return null;

  return {
    forbidden_id: 'FORBIDDEN-6',
    description: 'Active venue with null or empty timezone',
    detected_at: Date.now(),
    severity: 'CONSTITUTIONAL_BREACH',
    affected_rows: rows,
    advisory_action:
      'Set a valid IANA timezone identifier on the venue record before PRE can resolve for it.',
  };
}

/**
 * FORBIDDEN-7: Content item referenced by an active schedule has duration_ms <= 0.
 *
 * All content items must have a positive duration. Zero or negative duration
 * causes undefined SWRR behavior and invalid playlist output.
 */
export async function checkForbidden7(db: MonitorDb): Promise<ForbiddenStateViolation | null> {
  const rows = await db.query<{ content_id: string; duration_ms: number }>(`
    SELECT DISTINCT ci.id as content_id, ci.duration_ms
    FROM content_items ci
    WHERE ci.is_active = true
      AND ci.duration_ms <= 0
      AND EXISTS (
        SELECT 1 FROM schedules s WHERE s.content_id = ci.id AND s.is_active = true
        UNION
        SELECT 1 FROM overrides o WHERE o.content_id = ci.id
      )
  `);

  if (rows.length === 0) return null;

  return {
    forbidden_id: 'FORBIDDEN-7',
    description: 'Active content item with duration_ms <= 0 referenced by active schedule or override',
    detected_at: Date.now(),
    severity: 'CONSTITUTIONAL_BREACH',
    affected_rows: rows,
    advisory_action:
      'Set a positive duration_ms on the content item, or deactivate it.',
  };
}

/**
 * FORBIDDEN-8: Two overrides with the same target and overlapping time windows
 * at the same priority level.
 *
 * Ambiguous override resolution causes PRE to produce nondeterministic output
 * (INV-3 violation) unless resolved by ID tiebreaker.
 */
export async function checkForbidden8(db: MonitorDb): Promise<ForbiddenStateViolation | null> {
  // Detect overlapping overrides at the same priority for the same target
  const rows = await db.query<{ o1_id: string; o2_id: string; target_type: string; target_id: string }>(`
    SELECT o1.id as o1_id, o2.id as o2_id, o1.target_type, o1.target_id
    FROM overrides o1
    JOIN overrides o2 ON o1.id < o2.id
      AND o1.target_type = o2.target_type
      AND o1.target_id = o2.target_id
      AND o1.priority = o2.priority
      AND o1.is_operational = o2.is_operational
      AND (o1.expires_at IS NULL OR o1.expires_at > EXTRACT(EPOCH FROM NOW()) * 1000)
      AND (o2.expires_at IS NULL OR o2.expires_at > EXTRACT(EPOCH FROM NOW()) * 1000)
    LIMIT 20
  `);

  if (rows.length === 0) return null;

  return {
    forbidden_id: 'FORBIDDEN-8',
    description: 'Two active overrides at the same priority for the same target',
    detected_at: Date.now(),
    severity: 'CONSTITUTIONAL_BREACH',
    affected_rows: rows,
    advisory_action:
      'Expire or remove one of the conflicting overrides, or adjust their priorities ' +
      'to create an unambiguous ordering.',
  };
}

/**
 * FORBIDDEN-9: Emergency state with is_active=true but the referenced content_id
 * does not exist in content_items.
 */
export async function checkForbidden9(db: MonitorDb): Promise<ForbiddenStateViolation | null> {
  const rows = await db.query<{ emergency_id: string; content_id: string }>(`
    SELECT e.id as emergency_id, e.content_id
    FROM emergency_states e
    LEFT JOIN content_items ci ON e.content_id = ci.id
    WHERE e.is_active = true
      AND ci.id IS NULL
  `);

  if (rows.length === 0) return null;

  return {
    forbidden_id: 'FORBIDDEN-9',
    description: 'Active emergency state references a non-existent content_id',
    detected_at: Date.now(),
    severity: 'CONSTITUTIONAL_BREACH',
    affected_rows: rows,
    advisory_action:
      'Restore the emergency content item or deactivate the emergency state. ' +
      'An active emergency with missing content causes INV-7 + INV-6 violations simultaneously.',
  };
}

/**
 * FORBIDDEN-10: Screen with status='active' but no venue assignment.
 */
export async function checkForbidden10(db: MonitorDb): Promise<ForbiddenStateViolation | null> {
  const rows = await db.query<{ screen_id: string }>(`
    SELECT s.id as screen_id
    FROM screens s
    LEFT JOIN venues v ON s.venue_id = v.id
    WHERE s.status = 'active'
      AND (s.venue_id IS NULL OR v.id IS NULL)
  `);

  if (rows.length === 0) return null;

  return {
    forbidden_id: 'FORBIDDEN-10',
    description: 'Active screen with no venue assignment or non-existent venue',
    detected_at: Date.now(),
    severity: 'CONSTITUTIONAL_BREACH',
    affected_rows: rows,
    advisory_action:
      'Assign the screen to a valid venue or deactivate it. ' +
      'PRE cannot resolve for a screen with no venue (no timezone, no config).',
  };
}

// ─── Monitor Runner ───────────────────────────────────────────────────────────

const ALL_MONITORS = [
  checkForbidden1,
  checkForbidden2,
  checkForbidden3,
  checkForbidden4,
  checkForbidden5,
  checkForbidden6,
  checkForbidden7,
  checkForbidden8,
  checkForbidden9,
  checkForbidden10,
];

/**
 * Run all FORBIDDEN state monitors against the production database.
 *
 * Returns a result with all violations found.
 * Violations are advisory — this function does NOT auto-correct anything.
 *
 * Caller is responsible for:
 * - Emitting violations to the observability system
 * - Alerting operators on CONSTITUTIONAL_BREACH violations
 *
 * Scheduling: run every FORBIDDEN_STATE_MONITOR_INTERVAL_MS (15 minutes).
 */
export async function runForbiddenStateMonitor(
  db: MonitorDb
): Promise<ForbiddenStateMonitorResult> {
  const checkedAt = Date.now();
  const violations: ForbiddenStateViolation[] = [];

  for (const monitor of ALL_MONITORS) {
    try {
      const violation = await monitor(db);
      if (violation) {
        violations.push(violation);
      }
    } catch (err) {
      // Monitor query itself failed — emit as an error but don't crash the runner
      violations.push({
        forbidden_id: 'MONITOR-ERROR',
        description: `Monitor query failed: ${String(err)}`,
        detected_at: checkedAt,
        severity: 'CONSTITUTIONAL_BREACH',
        affected_rows: [],
        advisory_action: 'Investigate the monitor query failure and restore database connectivity.',
      });
    }
  }

  return {
    checked_at: checkedAt,
    violations,
    clean: violations.length === 0,
  };
}

// Export the interval constant so callers can schedule correctly
export { FORBIDDEN_STATE_MONITOR_INTERVAL_MS };
