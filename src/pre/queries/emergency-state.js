"use strict";
/**
 * Query: emergency-state
 *
 * Pure function over SystemStateSnapshot. No DB. No side effects. No writes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveEmergency = getActiveEmergency;
/**
 * Return the active emergency record if one exists and is currently active at `at`.
 * Returns null if no emergency is active.
 *
 * Active conditions:
 *   - state.emergency is not null
 *   - emergency.is_active === true
 *   - emergency.activated_at <= at
 */
function getActiveEmergency(state, at) {
    const e = state.emergency;
    if (e === null)
        return null;
    if (!e.is_active)
        return null;
    if (e.activated_at > at)
        return null;
    return e;
}
//# sourceMappingURL=emergency-state.js.map