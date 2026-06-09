"use strict";
/**
 * Query: sponsorship-state
 *
 * Pure function over SystemStateSnapshot. No DB. No side effects. No writes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveSponsorships = getActiveSponsorships;
/**
 * Return all sponsorship contracts that are:
 *   - is_active === true
 *   - starts_at <= at
 *   - expires_at === null || expires_at > at
 *   - area_id matches state.area?.id (sponsorships are area-scoped)
 *
 * Returns empty array if state.area is null (no area = no sponsorship possible).
 */
function getActiveSponsorships(state, at) {
    if (state.area === null)
        return [];
    const areaId = state.area.id;
    return state.sponsorships.filter((c) => {
        if (!c.is_active)
            return false;
        if (c.starts_at > at)
            return false;
        if (c.expires_at !== null && c.expires_at <= at)
            return false;
        if (c.area_id !== areaId)
            return false;
        return true;
    });
}
//# sourceMappingURL=sponsorship-state.js.map