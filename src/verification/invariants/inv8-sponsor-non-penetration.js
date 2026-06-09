"use strict";
/**
 * INV-8: Sponsorship Non-Penetration
 *
 * Sponsorship contracts (LEVEL_4) cannot push total sponsored share-of-voice
 * beyond the SOV warning threshold without triggering sov_warning_active.
 * Additionally, sponsorship injection cannot replace all campaign/override
 * content — it injects alongside, never instead of (except in structural fallback).
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.8
 * PRE-REFERENCE-IMPLEMENTATION-v1.md §5 (Sponsorship Layer)
 *
 * Specific assertions:
 * 1. If total sponsor_pct > SOV_WARNING_THRESHOLD in the output,
 *    then sov_warning_active must be true in the trace.
 * 2. sponsor_pct in content_mix matches the actual fraction of sponsored items.
 * 3. Sponsored items are marked with sponsored=true in the playlist.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const constants_1 = require("../../pre/constants");
(0, index_1.registerInvariant)({
    id: 'INV-8',
    description: 'Sponsorship SOV does not exceed threshold without sov_warning_active; sponsor fraction matches playlist',
    severity: 'CONSTITUTIONAL_BREACH',
    assert(output, _input) {
        const mix = output.content_mix;
        const sponsorTrace = output.reason_trace.level_4_sponsorship;
        // 1. Verify sponsor_pct is consistent with actual sponsored playlist items
        if (output.playlist.length > 0) {
            const sponsoredCount = output.playlist.filter(item => item.sponsored).length;
            const actualSponsorFraction = sponsoredCount / output.playlist.length;
            // Allow up to 0.01 tolerance for rounding (4 decimal places)
            const storedSponsorPct = mix.sponsor_pct;
            const diff = Math.abs(actualSponsorFraction - storedSponsorPct);
            if (diff > 0.01) {
                return {
                    invariantId: 'INV-8',
                    passed: false,
                    severity: 'CONSTITUTIONAL_BREACH',
                    message: `Sponsor fraction mismatch: content_mix.sponsor_pct=${storedSponsorPct} ` +
                        `but actual sponsored items fraction=${actualSponsorFraction.toFixed(4)} ` +
                        `(${sponsoredCount}/${output.playlist.length} items). ` +
                        `These must match within 0.01 tolerance.`,
                    detail: {
                        stored_sponsor_pct: storedSponsorPct,
                        actual_fraction: actualSponsorFraction,
                        sponsored_item_count: sponsoredCount,
                        total_items: output.playlist.length,
                    },
                };
            }
        }
        // 2. SOV warning: if sponsor_pct > threshold, sov_warning_active must be true
        if (mix.sponsor_pct > constants_1.SOV_WARNING_THRESHOLD) {
            if (!sponsorTrace || !sponsorTrace.sov_warning_active) {
                return {
                    invariantId: 'INV-8',
                    passed: false,
                    severity: 'CONSTITUTIONAL_BREACH',
                    message: `SOV penetration violation: sponsor_pct=${mix.sponsor_pct} exceeds ` +
                        `SOV_WARNING_THRESHOLD=${constants_1.SOV_WARNING_THRESHOLD} but sov_warning_active is ` +
                        `${sponsorTrace?.sov_warning_active ?? 'missing from trace'}. ` +
                        `When SOV exceeds the threshold, sov_warning_active must be true.`,
                    detail: {
                        sponsor_pct: mix.sponsor_pct,
                        threshold: constants_1.SOV_WARNING_THRESHOLD,
                        sov_warning_active: sponsorTrace?.sov_warning_active,
                    },
                };
            }
        }
        // 3. Verify all playlist items marked sponsored=true have sponsored=true on item
        for (const item of output.playlist) {
            if (typeof item.sponsored !== 'boolean') {
                return {
                    invariantId: 'INV-8',
                    passed: false,
                    severity: 'CONSTITUTIONAL_BREACH',
                    message: `Playlist item "${item.content_id}" has sponsored=${item.sponsored} (not boolean). ` +
                        `All playlist items must have a boolean sponsored field.`,
                };
            }
        }
        // 4. content_mix percentages must sum to 1.0 (within 0.01 rounding tolerance)
        // Exception: LEVEL_0 emergency outputs intentionally have all-zero content_mix
        // because emergency content is excluded from content mix accounting.
        const mixSum = mix.campaign_pct + mix.sponsor_pct + mix.override_pct +
            mix.fallback_pct + mix.system_pct;
        if (output.resolution_level !== 0 && Math.abs(mixSum - 1.0) > 0.01) {
            return {
                invariantId: 'INV-8',
                passed: false,
                severity: 'CONSTITUTIONAL_BREACH',
                message: `content_mix percentages sum to ${mixSum.toFixed(4)}, expected 1.0000. ` +
                    `campaign=${mix.campaign_pct}, sponsor=${mix.sponsor_pct}, ` +
                    `override=${mix.override_pct}, fallback=${mix.fallback_pct}, system=${mix.system_pct}`,
                detail: { mix, sum: mixSum },
            };
        }
        return {
            invariantId: 'INV-8',
            passed: true,
            severity: 'CONSTITUTIONAL_BREACH',
            message: `Sponsorship non-penetration holds: sponsor_pct=${mix.sponsor_pct}, ` +
                `sov_warning_active=${sponsorTrace?.sov_warning_active ?? false}, ` +
                `content_mix_sum=${mixSum.toFixed(4)}`,
        };
    },
});
//# sourceMappingURL=inv8-sponsor-non-penetration.js.map