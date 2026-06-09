"use strict";
/**
 * Query: device-truth
 *
 * Pure function over SystemStateSnapshot. No DB. No side effects. No writes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLastDelivery = getLastDelivery;
/**
 * Return the last known delivery log record for this screen.
 * Returns null if no delivery has been recorded.
 */
function getLastDelivery(state) {
    return state.last_delivery ?? null;
}
//# sourceMappingURL=device-truth.js.map