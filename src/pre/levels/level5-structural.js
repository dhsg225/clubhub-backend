"use strict";
/**
 * LEVEL_5 — Structural / system fallback.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.5
 * Always has outcome RESOLVED (normalizes playlist or applies system fallback).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLevel5 = resolveLevel5;
const constants_1 = require("../constants");
const SOURCE_NAMES = {
    0: 'emergency',
    1: 'override',
    2: 'scheduled_override',
    3: 'campaign',
    4: 'sponsorship',
    5: 'system',
};
function resolveLevel5(playlist, fallbackReason) {
    if (playlist.length > 0) {
        // Determine dominant source for trace
        const sourceName = SOURCE_NAMES[playlist[0].source] ?? 'unknown';
        return {
            playlist,
            isFallback: false,
            trace: {
                outcome: 'RESOLVED',
                reason: `L5:NORMALIZED:${playlist.length}_item,source=${sourceName}`,
            },
        };
    }
    return {
        playlist: [
            {
                content_id: constants_1.SYSTEM_FALLBACK_CONTENT_ID,
                duration_ms: constants_1.SYSTEM_FALLBACK_DURATION_MS,
                weight: constants_1.DEFAULT_PLAYLIST_ITEM_WEIGHT,
                source: constants_1.LEVEL_5_STRUCTURAL,
                sponsored: false,
            },
        ],
        isFallback: true,
        trace: {
            outcome: 'RESOLVED',
            reason: fallbackReason ?? 'L5:SYSTEM_FALLBACK:no_content_sources_active',
        },
    };
}
//# sourceMappingURL=level5-structural.js.map