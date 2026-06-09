"use strict";
/**
 * INV-9: Timezone Isolation
 *
 * PRE must use ONLY IANA timezone identifiers from the venue record.
 * UTC offset strings, timezone abbreviations, and server-local timezone
 * must NEVER be used for schedule evaluation.
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.9
 * PRE-REFERENCE-IMPLEMENTATION-v1.md §8.1 (toVenueLocal)
 * Forbidden Pattern: FP-10 (timezone ambiguity)
 *
 * Runtime enforcement:
 * assertIanaTimezone() in venue-local-time.ts throws if a non-IANA string
 * is passed to toVenueLocal(). This invariant assertion provides a second
 * line of defense by verifying the venue timezone at the input level.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const venue_local_time_1 = require("../../pre/algorithms/venue-local-time");
(0, index_1.registerInvariant)({
    id: 'INV-9',
    description: 'Venue timezone is a valid IANA identifier; no UTC offsets, no abbreviations',
    severity: 'CONSTITUTIONAL_BREACH',
    assert(_output, input) {
        const timezone = input.system_state.venue.timezone;
        // 1. Timezone field must be a non-empty string
        if (typeof timezone !== 'string' || timezone.length === 0) {
            return {
                invariantId: 'INV-9',
                passed: false,
                severity: 'CONSTITUTIONAL_BREACH',
                message: `Timezone isolation violation: venue.timezone is "${timezone}". ` +
                    `Must be a non-empty IANA timezone string (e.g., "America/Chicago").`,
            };
        }
        // 2. Must pass IANA validation (assertIanaTimezone throws on failure)
        try {
            (0, venue_local_time_1.assertIanaTimezone)(timezone);
        }
        catch (err) {
            return {
                invariantId: 'INV-9',
                passed: false,
                severity: 'CONSTITUTIONAL_BREACH',
                message: `Timezone isolation violation: venue.timezone="${timezone}" failed IANA validation. ` +
                    `Error: ${String(err)}`,
                detail: { timezone, venue_id: input.system_state.venue.id },
            };
        }
        // 3. Timezone must not look like a UTC offset (e.g., "+05:30", "-08:00", "UTC+5")
        // The IANA check above catches most cases; these patterns are belt-and-suspenders.
        const UTC_OFFSET_PATTERNS = [
            /^[+-]\d{2}:\d{2}$/, // "+05:30", "-08:00"
            /^UTC[+-]\d+/i, // "UTC+5", "UTC-8"
            /^GMT[+-]\d+/i, // "GMT+5"
            /^[A-Z]{2,4}$/, // "EST", "PST", "IST" (3-4 letter abbreviations)
        ];
        for (const pattern of UTC_OFFSET_PATTERNS) {
            if (pattern.test(timezone)) {
                return {
                    invariantId: 'INV-9',
                    passed: false,
                    severity: 'CONSTITUTIONAL_BREACH',
                    message: `Timezone isolation violation: venue.timezone="${timezone}" matches a ` +
                        `UTC offset or timezone abbreviation pattern. ` +
                        `Only IANA timezone identifiers are permitted. ` +
                        `UTC offset interpretation is timestamp-dependent (DST); IANA identifiers are stable.`,
                    detail: { timezone, matched_pattern: pattern.source },
                };
            }
        }
        return {
            invariantId: 'INV-9',
            passed: true,
            severity: 'CONSTITUTIONAL_BREACH',
            message: `Timezone isolation holds: venue.timezone="${timezone}" is a valid IANA identifier`,
        };
    },
});
//# sourceMappingURL=inv9-timezone-isolation.js.map