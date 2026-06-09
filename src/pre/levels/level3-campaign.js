"use strict";
/**
 * LEVEL_3 — Campaign / schedule resolution.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.3, §5.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLevel3 = resolveLevel3;
const constants_1 = require("../constants");
const swrr_1 = require("../algorithms/swrr");
const venue_local_time_1 = require("../algorithms/venue-local-time");
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/**
 * Expand a campaign-linked schedule (content_id=null) into one virtual schedule entry
 * per active content item in the state. The state is pre-filtered to contain only
 * content items for active campaigns for this screen.
 *
 * Override content is excluded: any content_id that appears in an override record
 * must not leak into campaign resolution when that override expires.
 */
function expandCampaignSchedule(schedule, contentItems, overrideContentIds) {
    return contentItems
        .filter((c) => c.is_active && !overrideContentIds.has(c.id))
        .map((c) => ({ ...schedule, content_id: c.id }));
}
function deduplicateByContentId(schedules) {
    const best = new Map();
    for (const schedule of schedules) {
        const contentId = schedule.content_id;
        if (contentId === null)
            continue;
        const existing = best.get(contentId);
        if (!existing) {
            best.set(contentId, { schedule });
            continue;
        }
        const ex = existing.schedule;
        // Rule 1: higher specificity wins
        if (schedule.specificity > ex.specificity) {
            best.set(contentId, { schedule });
            continue;
        }
        if (schedule.specificity < ex.specificity) {
            continue;
        }
        // Rule 2: higher priority wins
        if (schedule.priority > ex.priority) {
            best.set(contentId, { schedule });
            continue;
        }
        if (schedule.priority < ex.priority) {
            continue;
        }
        // Rule 3: lexicographically smaller id wins
        if (schedule.id < ex.id) {
            best.set(contentId, { schedule });
        }
    }
    return Array.from(best.values()).map((d) => d.schedule);
}
function resolveLevel3(input, schedules) {
    const regularSchedules = schedules.filter((s) => !s.is_fallback);
    const fallbackSchedules = schedules.filter((s) => s.is_fallback);
    const candidateSchedules = regularSchedules.length > 0 ? regularSchedules : fallbackSchedules;
    const isFallback = regularSchedules.length === 0 && fallbackSchedules.length > 0;
    // Build set of content_ids claimed by any override — these must not leak into campaign
    const overrideContentIds = new Set(input.system_state.overrides
        .map((o) => o.content_id)
        .filter((id) => id !== null));
    // Expand campaign-linked schedules (content_id=null) to concrete content_id entries
    const expanded = [];
    for (const schedule of candidateSchedules) {
        if (schedule.content_id !== null) {
            expanded.push(schedule);
        }
        else if (schedule.campaign_id !== null) {
            expanded.push(...expandCampaignSchedule(schedule, input.system_state.content_items, overrideContentIds));
        }
        // content_id=null AND campaign_id=null → skip (no resolvable content)
    }
    const deduped = deduplicateByContentId(expanded);
    if (deduped.length === 0) {
        return {
            playlist: [],
            terminatingLevel: constants_1.LEVEL_3_CAMPAIGN,
            traceEntry: { outcome: 'SKIP', reason: 'no-active-schedules' },
        };
    }
    // For trace: use the "winning" schedule (highest specificity/priority after dedup)
    const winning = [...deduped].sort((a, b) => {
        if (b.specificity !== a.specificity)
            return b.specificity - a.specificity;
        if (b.priority !== a.priority)
            return b.priority - a.priority;
        return a.id < b.id ? -1 : 1;
    })[0];
    const campaign = input.system_state.campaigns.find((c) => c.id === winning.campaign_id) ?? null;
    const targetTypeUpper = winning.target_type.toUpperCase();
    const playlistItems = deduped.map((schedule) => {
        const contentItem = input.system_state.content_items.find((c) => c.id === schedule.content_id);
        const contentId = contentItem ? schedule.content_id : constants_1.SYSTEM_FALLBACK_CONTENT_ID;
        const durationMs = contentItem ? contentItem.duration_ms : constants_1.SYSTEM_FALLBACK_DURATION_MS;
        return {
            content_id: contentId,
            duration_ms: durationMs,
            weight: Math.max(1, schedule.priority),
            source: constants_1.LEVEL_3_CAMPAIGN,
            sponsored: false,
        };
    });
    const ordered = (0, swrr_1.weightedPlaylistResolver)(playlistItems);
    const wonBy = deduped.length === 1 ? 'only_active_rule' : 'highest_specificity';
    // DOW constraint annotation: include when the winning schedule has DOW constraints
    let dowSuffix = '';
    if (winning.days_of_week.length > 0) {
        const venueLocal = (0, venue_local_time_1.toVenueLocal)(input.at, input.system_state.venue.timezone);
        const dayName = DOW_NAMES[venueLocal.dayOfWeek];
        dowSuffix = `,dow_constraint=${dayName}_active`;
    }
    const reasonStr = `L3:CAMPAIGN:schedule_id=${winning.id},campaign=${campaign?.name ?? 'unknown'},specificity=${targetTypeUpper},won_by=${wonBy}${dowSuffix}`;
    return {
        playlist: ordered,
        terminatingLevel: constants_1.LEVEL_3_CAMPAIGN,
        traceEntry: {
            outcome: isFallback ? 'FALLBACK' : 'RESOLVED',
            reason: reasonStr,
            campaign_id: campaign?.id ?? null,
            campaign_name: campaign?.name ?? null,
            schedule_id: winning.id,
            specificity: winning.specificity,
            won_by: wonBy,
        },
    };
}
//# sourceMappingURL=level3-campaign.js.map