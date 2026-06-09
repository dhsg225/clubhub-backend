"use strict";
/**
 * LEVEL_4 — Sponsorship injection.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.4
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyLevel4 = applyLevel4;
const constants_1 = require("../constants");
const swrr_1 = require("../algorithms/swrr");
function applyLevel4(input, basePlaylist, contracts, skipSponsorship) {
    const noContracts = contracts.length === 0;
    if (skipSponsorship || noContracts || basePlaylist.length === 0) {
        return {
            playlist: basePlaylist,
            trace: {
                outcome: 'SKIP',
                reason: 'L4:SKIP:no_active_sponsorship_contracts',
                contracts_active: 0,
                total_sov_pct: 0,
                sov_warning_active: false,
                injected_items: 0,
            },
        };
    }
    const totalSov = contracts.reduce((sum, c) => sum + c.sov_pct, 0);
    const sovWarningActive = totalSov > constants_1.SOV_WARNING_THRESHOLD;
    const effectiveTotalSov = Math.min(totalSov, constants_1.SOV_MAX_EFFECTIVE);
    const wBase = basePlaylist.reduce((sum, item) => sum + item.weight, 0);
    const sponsoredItems = [];
    for (const contract of contracts) {
        const contentItem = input.system_state.content_items.find((c) => c.id === contract.content_id);
        const contentId = contentItem ? contract.content_id : constants_1.SYSTEM_FALLBACK_CONTENT_ID;
        const durationMs = contentItem ? contentItem.duration_ms : constants_1.SYSTEM_FALLBACK_DURATION_MS;
        const sponsorWeight = Math.max(1, Math.round((contract.sov_pct / (1 - effectiveTotalSov)) * wBase));
        sponsoredItems.push({
            content_id: contentId,
            duration_ms: durationMs,
            weight: sponsorWeight,
            source: constants_1.LEVEL_4_SPONSORSHIP,
            sponsored: true,
        });
    }
    const ordered = (0, swrr_1.weightedPlaylistResolver)([...basePlaylist, ...sponsoredItems]);
    return {
        playlist: ordered,
        trace: {
            outcome: 'RESOLVED',
            reason: `L4:RESOLVED:contracts=${contracts.length}`,
            contracts_active: contracts.length,
            total_sov_pct: Math.round(totalSov * 10000) / 10000,
            sov_warning_active: sovWarningActive,
            injected_items: sponsoredItems.length,
        },
    };
}
//# sourceMappingURL=level4-sponsorship.js.map