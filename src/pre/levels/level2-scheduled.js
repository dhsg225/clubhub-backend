"use strict";
/**
 * LEVEL_2 — Scheduled override resolution.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.3
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLevel2 = resolveLevel2;
const constants_1 = require("../constants");
function resolveLevel2(input, overrides) {
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
                weight: 1,
                source: constants_1.LEVEL_2_SCHEDULED,
                sponsored: false,
            },
        ],
        terminatingLevel: constants_1.LEVEL_2_SCHEDULED,
        traceEntry: {
            outcome: 'RESOLVED',
            reason: `L2:SCHEDULED_OVERRIDE:id=${override.id},target=${override.target_id},reason=${reasonText}`,
            override_id: override.id,
            target_type: override.target_type,
            target_id: override.target_id,
            content_id: contentId,
        },
    };
}
//# sourceMappingURL=level2-scheduled.js.map