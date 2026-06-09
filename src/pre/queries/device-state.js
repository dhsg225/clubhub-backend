"use strict";
/**
 * Query: device-state
 *
 * Pure function over SystemStateSnapshot. No DB. No side effects. No writes.
 * Returns the resolved hierarchy context for the screen under evaluation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScreenContext = getScreenContext;
/**
 * Return the screen's fully-resolved hierarchy context from the snapshot.
 * Returns null if the snapshot's screen field is missing or the venue is missing.
 */
function getScreenContext(state) {
    if (!state.screen || !state.venue) {
        return null;
    }
    return {
        screen: state.screen,
        tv_group: state.tv_group ?? null,
        area: state.area ?? null,
        venue: state.venue,
        organization: state.organization,
    };
}
//# sourceMappingURL=device-state.js.map