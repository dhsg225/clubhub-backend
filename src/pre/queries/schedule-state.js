"use strict";
/**
 * Query: schedule-state
 *
 * Pure function over SystemStateSnapshot. No DB. No side effects. No writes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveSchedules = getActiveSchedules;
const schedule_active_1 = require("../algorithms/schedule-active");
/**
 * Return all schedules that are:
 *   - scoped to this screen's hierarchy (screen, tv_group, area, or venue)
 *   - active at `at` per scheduleActive() (handles window, DOW, time-of-day)
 *
 * No sort applied here — callers (level3) apply their own deduplication and ordering.
 */
function getActiveSchedules(state, at, ianaTimezone) {
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
        if (!scopeMatch)
            return false;
        // Delegate time/window/DOW evaluation to scheduleActive()
        return (0, schedule_active_1.scheduleActive)(s, at, ianaTimezone).active;
    });
}
//# sourceMappingURL=schedule-state.js.map