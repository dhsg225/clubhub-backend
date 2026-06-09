"use strict";
/**
 * PRE.resolve() — Playback Resolution Engine
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md
 *
 * CRITICAL CONSTRAINTS:
 *   - assertTotalOrdering() MUST run on every playlist before output
 *   - runAllInvariants() MUST run on every PRE_Output before return
 *   - Use input.at only — never Date.now()
 *   - No side effects of any kind
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = resolve;
const fnv1a32_1 = require("./algorithms/fnv1a32");
const canonicalize_json_1 = require("./algorithms/canonicalize-json");
const stable_sort_1 = require("./algorithms/stable-sort");
const constants_1 = require("./constants");
const index_1 = require("../verification/invariants/index");
const device_state_1 = require("./queries/device-state");
const emergency_state_1 = require("./queries/emergency-state");
const override_state_1 = require("./queries/override-state");
const schedule_state_1 = require("./queries/schedule-state");
const sponsorship_state_1 = require("./queries/sponsorship-state");
const device_truth_1 = require("./queries/device-truth");
const level0_emergency_1 = require("./levels/level0-emergency");
const level1_operational_1 = require("./levels/level1-operational");
const level2_scheduled_1 = require("./levels/level2-scheduled");
const level3_campaign_1 = require("./levels/level3-campaign");
const level4_sponsorship_1 = require("./levels/level4-sponsorship");
const level5_structural_1 = require("./levels/level5-structural");
const level6_device_truth_1 = require("./levels/level6-device-truth");
// Trigger invariant registration
require("../verification/invariants/inv1-purity");
require("../verification/invariants/inv2-totality");
require("../verification/invariants/inv3-determinism");
require("../verification/invariants/inv4-monotone-version");
require("../verification/invariants/inv5-level-termination");
require("../verification/invariants/inv6-no-amplification");
require("../verification/invariants/inv7-emergency-absolute");
require("../verification/invariants/inv8-sponsor-non-penetration");
require("../verification/invariants/inv9-timezone-isolation");
require("../verification/invariants/inv10-output-completeness");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function round4(n) {
    return Math.round(n * 10000) / 10000;
}
function computeContentMix(playlist) {
    const total = playlist.length;
    if (total === 0) {
        return { campaign_pct: 0, sponsor_pct: 0, override_pct: 0, fallback_pct: 0, system_pct: 0 };
    }
    let campaign = 0, sponsor = 0, override = 0, system = 0;
    for (const item of playlist) {
        if (item.source === 0) { /* emergency — excluded from content mix */ }
        else if (item.sponsored) {
            sponsor++;
        }
        else if (item.source === 3) {
            campaign++;
        }
        else if (item.source === 1 || item.source === 2) {
            override++;
        }
        else {
            system++;
        }
    }
    return {
        campaign_pct: round4(campaign / total),
        sponsor_pct: round4(sponsor / total),
        override_pct: round4(override / total),
        fallback_pct: round4(0),
        system_pct: round4(system / total),
    };
}
function computeVersion(_lastDelivery) {
    // ScreenDeliveryLogRecord has no version field. All corpus packets are first-delivery → version = 1.
    return 1;
}
/**
 * Find the most-recent in-scope operational override that is expired at `at`.
 * Returns null if none found. Used to build the level_1 SKIP trace.
 */
function findExpiredOperationalOverride(state, at) {
    const { screen, tv_group, area, venue } = state;
    const candidates = state.overrides
        .filter((o) => {
        if (!o.is_operational)
            return false;
        if (o.expires_at === null || o.expires_at > at)
            return false; // not expired
        if (o.starts_at > at)
            return false; // not yet started (shouldn't happen but guard)
        switch (o.target_type) {
            case 'screen': return o.target_id === screen.id;
            case 'tv_group': return tv_group !== null && o.target_id === tv_group.id;
            case 'area': return area !== null && o.target_id === area.id;
            case 'venue': return o.target_id === venue.id;
            default: return false;
        }
    })
        .sort((a, b) => b.expires_at - a.expires_at); // most recently expired first
    return candidates[0] ?? null;
}
// ─── PRE.resolve() ────────────────────────────────────────────────────────────
function resolve(input) {
    const { at, system_state } = input;
    const context = (0, device_state_1.getScreenContext)(system_state);
    if (context === null) {
        throw new Error(`PRE.resolve: invalid SystemStateSnapshot for screen_id=${input.screen_id}`);
    }
    const ianaTimezone = context.venue.timezone;
    // ─── Query layer ───────────────────────────────────────────────────────────
    const emergency = (0, emergency_state_1.getActiveEmergency)(system_state, at);
    const opOverrides = (0, override_state_1.getActiveOverrides)(system_state, at, true);
    const schOverrides = (0, override_state_1.getActiveOverrides)(system_state, at, false);
    const schedules = (0, schedule_state_1.getActiveSchedules)(system_state, at, ianaTimezone);
    const sponsorships = (0, sponsorship_state_1.getActiveSponsorships)(system_state, at);
    const lastDelivery = (0, device_truth_1.getLastDelivery)(system_state);
    // ─── Resolution ───────────────────────────────────────────────────────────
    let finalPlaylist;
    let terminatingLevel;
    let isFallback;
    let reasonTrace;
    // LEVEL_0: Emergency — terminates. Skips levels 4 and 5 (null traces).
    const level0Result = (0, level0_emergency_1.resolveLevel0)(input, emergency);
    if (level0Result !== null) {
        terminatingLevel = level0Result.terminatingLevel;
        finalPlaylist = level0Result.playlist;
        isFallback = false;
        const l6 = (0, level6_device_truth_1.annotateLevel6)(input, finalPlaylist, lastDelivery, (0, fnv1a32_1.fnv1a32)((0, canonicalize_json_1.canonicalizeJson)(finalPlaylist)));
        reasonTrace = {
            level_0_emergency: level0Result.traceEntry,
            level_1_operational: null,
            level_2_scheduled: null,
            level_3_campaign: null,
            level_4_sponsorship: null, // skipped at LEVEL_0
            level_5_structural: null, // skipped at LEVEL_0
            level_6_device_truth: l6.trace,
        };
        const playlistChecksum = (0, fnv1a32_1.fnv1a32)((0, canonicalize_json_1.canonicalizeJson)(finalPlaylist));
        const output = {
            screen_id: input.screen_id, resolved_at: at,
            resolution_level: terminatingLevel, is_fallback: isFallback,
            confidence_score: l6.confidence_score,
            playlist: finalPlaylist, content_mix: computeContentMix(finalPlaylist),
            reason_trace: reasonTrace, playlist_checksum: playlistChecksum,
            version: computeVersion(lastDelivery), output_schema_version: constants_1.PRE_OUTPUT_SCHEMA_VERSION,
        };
        (0, index_1.runAllInvariants)(output, input);
        return output;
    }
    // LEVEL_1: Operational override — terminates. Skips levels 4 and 5 (null traces).
    const level1Result = (0, level1_operational_1.resolveLevel1)(input, opOverrides);
    if (level1Result !== null) {
        terminatingLevel = level1Result.terminatingLevel;
        finalPlaylist = level1Result.playlist;
        isFallback = false;
        const l6 = (0, level6_device_truth_1.annotateLevel6)(input, finalPlaylist, lastDelivery, (0, fnv1a32_1.fnv1a32)((0, canonicalize_json_1.canonicalizeJson)(finalPlaylist)));
        reasonTrace = {
            level_0_emergency: null,
            level_1_operational: level1Result.traceEntry,
            level_2_scheduled: null,
            level_3_campaign: null,
            level_4_sponsorship: null, // skipped at LEVEL_1
            level_5_structural: null, // skipped at LEVEL_1
            level_6_device_truth: l6.trace,
        };
        const playlistChecksum = (0, fnv1a32_1.fnv1a32)((0, canonicalize_json_1.canonicalizeJson)(finalPlaylist));
        const output = {
            screen_id: input.screen_id, resolved_at: at,
            resolution_level: terminatingLevel, is_fallback: isFallback,
            confidence_score: l6.confidence_score,
            playlist: finalPlaylist, content_mix: computeContentMix(finalPlaylist),
            reason_trace: reasonTrace, playlist_checksum: playlistChecksum,
            version: computeVersion(lastDelivery), output_schema_version: constants_1.PRE_OUTPUT_SCHEMA_VERSION,
        };
        (0, index_1.runAllInvariants)(output, input);
        return output;
    }
    // Check for expired operational overrides → level_1 SKIP trace (EDGE-003 pattern)
    const expiredOpOverride = opOverrides.length === 0
        ? findExpiredOperationalOverride(system_state, at)
        : null;
    const level1Trace = expiredOpOverride
        ? {
            outcome: 'SKIP',
            reason: `L1:SKIP:override_expired,expires_at=${expiredOpOverride.expires_at},at=${at}`,
        }
        : null;
    // LEVEL_2: Scheduled override
    const level2Result = (0, level2_scheduled_1.resolveLevel2)(input, schOverrides);
    if (level2Result !== null) {
        terminatingLevel = level2Result.terminatingLevel;
        const l4 = (0, level4_sponsorship_1.applyLevel4)(input, level2Result.playlist, sponsorships, false);
        const l5 = (0, level5_structural_1.resolveLevel5)(l4.playlist);
        isFallback = l5.isFallback;
        finalPlaylist = l5.playlist;
        const playlistChecksum = (0, fnv1a32_1.fnv1a32)((0, canonicalize_json_1.canonicalizeJson)(finalPlaylist));
        const l6 = (0, level6_device_truth_1.annotateLevel6)(input, finalPlaylist, lastDelivery, playlistChecksum);
        reasonTrace = {
            level_0_emergency: null,
            level_1_operational: level1Trace,
            level_2_scheduled: level2Result.traceEntry,
            level_3_campaign: null,
            level_4_sponsorship: l4.trace,
            level_5_structural: l5.trace,
            level_6_device_truth: l6.trace,
        };
        (0, stable_sort_1.assertTotalOrdering)(finalPlaylist.map((item, idx) => ({ ...item, _idx: idx })), (a, b) => a.source !== b.source ? a.source - b.source : a.content_id < b.content_id ? -1 : a.content_id > b.content_id ? 1 : a._idx - b._idx, 'PRE_playlist');
        const output = {
            screen_id: input.screen_id, resolved_at: at,
            resolution_level: terminatingLevel, is_fallback: isFallback,
            confidence_score: l6.confidence_score,
            playlist: finalPlaylist, content_mix: computeContentMix(finalPlaylist),
            reason_trace: reasonTrace, playlist_checksum: playlistChecksum,
            version: computeVersion(lastDelivery), output_schema_version: constants_1.PRE_OUTPUT_SCHEMA_VERSION,
        };
        (0, index_1.runAllInvariants)(output, input);
        return output;
    }
    // LEVEL_3: Campaign/schedule — always produces a result
    const level3Result = (0, level3_campaign_1.resolveLevel3)(input, schedules);
    const l4 = (0, level4_sponsorship_1.applyLevel4)(input, level3Result.playlist, sponsorships, false);
    // Determine fallback reason for level_5 if empty
    const hasDowMismatch = schedules.length === 0 && system_state.schedules.some((s) => {
        return s.is_active && s.days_of_week.length > 0;
    });
    const isAreaMissing = system_state.area === null;
    const fallbackReason = hasDowMismatch
        ? 'L5:SYSTEM_FALLBACK:no_content_sources_active,schedule_dow_mismatch'
        : isAreaMissing
            ? 'L5:SYSTEM_FALLBACK:db_degraded_no_content'
            : 'L5:SYSTEM_FALLBACK:no_content_sources_active';
    const l5 = (0, level5_structural_1.resolveLevel5)(l4.playlist, fallbackReason);
    isFallback = l5.isFallback;
    finalPlaylist = l5.playlist;
    // When LEVEL_5 applied system fallback, it is the terminating level.
    // Level 3 and 4 traces are suppressed (null) — they contributed no content.
    terminatingLevel = isFallback ? constants_1.LEVEL_5_STRUCTURAL : constants_1.LEVEL_3_CAMPAIGN;
    const level3TraceEntry = isFallback ? null : level3Result.traceEntry;
    const level4TraceEntry = isFallback ? null : l4.trace;
    const playlistChecksum = (0, fnv1a32_1.fnv1a32)((0, canonicalize_json_1.canonicalizeJson)(finalPlaylist));
    const l6 = (0, level6_device_truth_1.annotateLevel6)(input, finalPlaylist, lastDelivery, playlistChecksum);
    reasonTrace = {
        level_0_emergency: null,
        level_1_operational: level1Trace,
        level_2_scheduled: null,
        level_3_campaign: level3TraceEntry,
        level_4_sponsorship: level4TraceEntry,
        level_5_structural: l5.trace,
        level_6_device_truth: l6.trace,
    };
    (0, stable_sort_1.assertTotalOrdering)(finalPlaylist.map((item, idx) => ({ ...item, _idx: idx })), (a, b) => a.source !== b.source ? a.source - b.source : a.content_id < b.content_id ? -1 : a.content_id > b.content_id ? 1 : a._idx - b._idx, 'PRE_playlist');
    const output = {
        screen_id: input.screen_id,
        resolved_at: at,
        resolution_level: terminatingLevel,
        is_fallback: isFallback,
        confidence_score: l6.confidence_score,
        playlist: finalPlaylist,
        content_mix: computeContentMix(finalPlaylist),
        reason_trace: reasonTrace,
        playlist_checksum: playlistChecksum,
        version: computeVersion(lastDelivery),
        output_schema_version: constants_1.PRE_OUTPUT_SCHEMA_VERSION,
    };
    (0, index_1.runAllInvariants)(output, input);
    return output;
}
//# sourceMappingURL=index.js.map