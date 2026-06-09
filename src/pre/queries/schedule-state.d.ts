/**
 * Query: schedule-state
 *
 * Pure function over SystemStateSnapshot. No DB. No side effects. No writes.
 */
import type { SystemStateSnapshot, ScheduleRecord } from '../types';
/**
 * Return all schedules that are:
 *   - scoped to this screen's hierarchy (screen, tv_group, area, or venue)
 *   - active at `at` per scheduleActive() (handles window, DOW, time-of-day)
 *
 * No sort applied here — callers (level3) apply their own deduplication and ordering.
 */
export declare function getActiveSchedules(state: SystemStateSnapshot, at: number, ianaTimezone: string): ScheduleRecord[];
//# sourceMappingURL=schedule-state.d.ts.map