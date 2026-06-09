"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleActive = scheduleActive;
exports.activeSchedules = activeSchedules;
exports.parseTimeOfDayMinutes = parseTimeOfDayMinutes;
const venue_local_time_1 = require("./venue-local-time");
/**
 * Evaluate whether a schedule is active at the given UTC timestamp,
 * using the venue's IANA timezone for local-time constraints.
 *
 * This function is pure and deterministic. It does not read from any
 * external source and does not produce side effects.
 */
function scheduleActive(schedule, atUtcMs, ianaTimezone) {
    // Rule 0: operator-controlled active flag
    if (!schedule.is_active) {
        return { active: false, reason: 'INACTIVE_FLAG' };
    }
    // Rule 1a: starts_at inclusive lower bound
    if (atUtcMs < schedule.starts_at) {
        return { active: false, reason: 'BEFORE_WINDOW' };
    }
    // Rule 1b: expires_at exclusive upper bound (null = open-ended, skip check)
    if (schedule.expires_at !== null && atUtcMs >= schedule.expires_at) {
        return { active: false, reason: 'AFTER_WINDOW' };
    }
    // Rules 2 and 3 require venue-local time
    const local = (0, venue_local_time_1.toVenueLocal)(atUtcMs, ianaTimezone);
    // Rule 2: day-of-week constraint (only if non-empty)
    if (schedule.days_of_week.length > 0) {
        if (!schedule.days_of_week.includes(local.dayOfWeek)) {
            return { active: false, reason: 'DAY_OF_WEEK_MISMATCH' };
        }
    }
    // Rule 3: time-of-day constraint (only if configured)
    if (schedule.start_time_minutes !== null && schedule.end_time_minutes !== null) {
        const localMinutes = local.hour * 60 + local.minute;
        if (localMinutes < schedule.start_time_minutes) {
            return { active: false, reason: 'TIME_OF_DAY_BEFORE' };
        }
        // End time is exclusive (half-open interval)
        if (localMinutes >= schedule.end_time_minutes) {
            return { active: false, reason: 'TIME_OF_DAY_AFTER' };
        }
    }
    return { active: true, reason: 'ACTIVE' };
}
/**
 * Filter an array of schedules to those that are active at the given timestamp.
 * Returns a new array sorted by specificity descending (most specific first),
 * with id as a tiebreaker for total ordering.
 *
 * Specificity enum values are numerically comparable: higher = more specific.
 */
function activeSchedules(schedules, atUtcMs, ianaTimezone) {
    return schedules
        .filter(s => scheduleActive(s, atUtcMs, ianaTimezone).active)
        .sort((a, b) => {
        const specDiff = b.specificity - a.specificity;
        if (specDiff !== 0)
            return specDiff;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}
/**
 * Compute venue-local minutes-since-midnight for a time string "HH:MM".
 * Used when constructing schedule records from time-of-day strings.
 *
 * Input: "HH:MM" format, 24-hour clock.
 * Output: number of minutes since midnight (0–1439), or 1440 for "24:00".
 */
function parseTimeOfDayMinutes(timeStr) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
    if (!match) {
        throw new Error(`parseTimeOfDayMinutes: invalid time string "${timeStr}". ` +
            `Expected format: "HH:MM" (24-hour clock).`);
    }
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) {
        throw new Error(`parseTimeOfDayMinutes: out-of-range time "${timeStr}". ` +
            `Valid range: "00:00" through "24:00".`);
    }
    return hours * 60 + minutes;
}
//# sourceMappingURL=schedule-active.js.map