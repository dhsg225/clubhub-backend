"use strict";
/**
 * LEVEL_0 — Emergency resolution.
 *
 * If an emergency is active, ALL screens receive the emergency content immediately.
 * This level terminates resolution — no further levels are evaluated for base content.
 * Sponsorship injection (LEVEL_4) and structural (LEVEL_5) are SKIPPED (null traces).
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.1
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLevel0 = resolveLevel0;
const constants_1 = require("../constants");
function resolveLevel0(input, emergency) {
    if (emergency === null) {
        return null;
    }
    const contentItem = input.system_state.content_items.find((c) => c.id === emergency.content_id);
    const contentId = contentItem ? emergency.content_id : constants_1.SYSTEM_EMERGENCY_FALLBACK_ID;
    const durationMs = contentItem ? contentItem.duration_ms : constants_1.SYSTEM_FALLBACK_DURATION_MS;
    const scopeLabel = emergency.is_global ? 'global' : 'venue-scoped';
    const reasonText = emergency.reason || 'no-reason';
    return {
        playlist: [
            {
                content_id: contentId,
                duration_ms: durationMs,
                weight: constants_1.DEFAULT_PLAYLIST_ITEM_WEIGHT,
                source: constants_1.LEVEL_0_EMERGENCY,
                sponsored: false,
            },
        ],
        terminatingLevel: constants_1.LEVEL_0_EMERGENCY,
        traceEntry: {
            outcome: 'RESOLVED',
            reason: `L0:EMERGENCY:id=${emergency.id},${scopeLabel},reason=${reasonText}`,
            emergency_id: emergency.id,
            content_id: contentId,
        },
    };
}
//# sourceMappingURL=level0-emergency.js.map