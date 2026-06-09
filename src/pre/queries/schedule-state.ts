/**
 * Query: schedule-state
 *
 * Pure function over SystemStateSnapshot. No DB. No side effects. No writes.
 */

import type { SystemStateSnapshot, ScheduleRecord } from '../types';
import { scheduleActive } from '../algorithms/schedule-active';

/**
 * Return all schedules that are:
 *   - scoped to this screen's hierarchy (screen, tv_group, area, or venue)
 *   - active at `at` per scheduleActive() (handles window, DOW, time-of-day)
 *
 * No sort applied here — callers (level3) apply their own deduplication and ordering.
 */
export function getActiveSchedules(
  state: SystemStateSnapshot,
  at: number,
  ianaTimezone: string
): ScheduleRecord[] {
  const { screen, tv_group, area, venue } = state;

  return state.schedules.filter((s) => {
    // Scope match: target_type + target_id must match screen hierarchy
    let scopeMatch = false;
    switch (s.target_type) {
      case 'screen':
        scopeMatch = s.target_id === screen.id;
        break;
      case 'tv_group':
        scopeMatch = tv_group !== null && s.target_id === tv_group.id;
        break;
      case 'area':
        scopeMatch = area !== null && s.target_id === area.id;
        break;
      case 'venue':
        scopeMatch = s.target_id === venue.id;
        break;
    }
    if (!scopeMatch) return false;

    // Delegate time/window/DOW evaluation to scheduleActive()
    return scheduleActive(s, at, ianaTimezone).active;
  });
}
