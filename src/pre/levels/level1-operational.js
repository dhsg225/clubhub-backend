"use strict";
/**
 * LEVEL_1 — Operational override resolution.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.2
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLevel1 = resolveLevel1;
const constants_1 = require("../constants");
function resolveLevel1(input, overrides) {
    if (overrides.length === 0) {
        return null;
    }
    const override = overrides[0];
    const contentItem = input.system_state.content_items.find((c) => c.id === override.content_id);
    const contentId = contentItem ? override.content_id : constants_1.SYSTEM_FALLBACK_CONTENT_ID;
    const durationMs = contentItem ? contentItem.duration_ms : constants_1.SYSTEM_FALLBACK_DURATION_MS;
    const reasonText = override.reason || 'no-reason';
    return {
        playlist: [
            {
                content_id: contentId,
                duration_ms: durationMs,
                weight: constants_1.DEFAULT_PLAYLIST_ITEM_WEIGHT,
                source: constants_1.LEVEL_1_OPERATIONAL,
                sponsored: false,
            },
        ],
        terminatingLevel: constants_1.LEVEL_1_OPERATIONAL,
        traceEntry: {
            outcome: 'RESOLVED',
            reason: `L1:OPERATIONAL_OVERRIDE:id=${override.id},target=${override.target_id},reason=${reasonText}`,
            override_id: override.id,
            content_id: contentId,
        },
    };
}
//# sourceMappingURL=level1-operational.js.map