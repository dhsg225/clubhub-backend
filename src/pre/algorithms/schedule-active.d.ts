/**
 * scheduleActive() — Determine whether a schedule is active at a given UTC timestamp.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §7 (Schedule Evaluation)
 * Invariant: INV-9 (Timezone Isolation), INV-3 (Determinism)
 *
 * EVALUATION RULES (in order):
 * 1. Absolute window: [starts_at, expires_at) — half-open interval.
 *    - starts_at is inclusive: at >= starts_at
 *    - expires_at is exclusive: at < expires_at
 *    - If expires_at is null: schedule is open-ended (active indefinitely after starts_at)
 * 2. Day-of-week constraint: if days_of_week is non-empty, the venue-local day of week
 *    must be in the set.
 * 3. Time-of-day constraint: if start_time / end_time are set, the venue-local time
 *    must fall in [start_time, end_time) half-open interval.
 * 4. All constraints are ANDed. A schedule is active only if ALL active constraints pass.
 *
 * TIMEZONE: All time-of-day and day-of-week evaluation uses venue-local time via
 * toVenueLocal(). The UTC timestamp is NEVER used for time-of-day comparisons.
 */
export interface ScheduleRecord {
    id: string;
    starts_at: number;
    expires_at: number | null;
    days_of_week: number[];
    /** Venue-local time-of-day start, as minutes-since-midnight (0–1439). null = no constraint. */
    start_time_minutes: number | null;
    /** Venue-local time-of-day end (exclusive), as minutes-since-midnight (0–1440). null = no constraint. */
    end_time_minutes: number | null;
    is_active: boolean;
}
export interface ScheduleActiveResult {
    active: boolean;
    reason: 'INACTIVE_FLAG' | 'BEFORE_WINDOW' | 'AFTER_WINDOW' | 'DAY_OF_WEEK_MISMATCH' | 'TIME_OF_DAY_BEFORE' | 'TIME_OF_DAY_AFTER' | 'ACTIVE';
}
/**
 * Evaluate whether a schedule is active at the given UTC timestamp,
 * using the venue's IANA timezone for local-time constraints.
 *
 * This function is pure and deterministic. It does not read from any
 * external source and does not produce side effects.
 */
export declare function scheduleActive(schedule: ScheduleRecord, atUtcMs: number, ianaTimezone: string): ScheduleActiveResult;
/**
 * Filter an array of schedules to those that are active at the given timestamp.
 * Returns a new array sorted by specificity descending (most specific first),
 * with id as a tiebreaker for total ordering.
 *
 * Specificity enum values are numerically comparable: higher = more specific.
 */
export declare function activeSchedules(schedules: Array<ScheduleRecord & {
    specificity: number;
}>, atUtcMs: number, ianaTimezone: string): Array<ScheduleRecord & {
    specificity: number;
}>;
/**
 * Compute venue-local minutes-since-midnight for a time string "HH:MM".
 * Used when constructing schedule records from time-of-day strings.
 *
 * Input: "HH:MM" format, 24-hour clock.
 * Output: number of minutes since midnight (0–1439), or 1440 for "24:00".
 */
export declare function parseTimeOfDayMinutes(timeStr: string): number;
//# sourceMappingURL=schedule-active.d.ts.map