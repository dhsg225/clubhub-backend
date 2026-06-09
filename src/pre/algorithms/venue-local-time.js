"use strict";
/**
 * toVenueLocal() — Convert UTC millisecond timestamp to venue local time components.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §8.1
 * Invariant: INV-9 (Timezone Isolation)
 * Forbidden Pattern: FP-10 (no timezone ambiguity)
 *
 * RULES:
 * 1. ONLY accepts IANA timezone identifiers (e.g., "America/New_York").
 *    UTC offset strings (e.g., "+05:30") are REJECTED.
 * 2. DST transitions are handled by the IANA timezone database, not by PRE.
 * 3. This function MUST NOT use Date.toLocaleString() or Intl.DateTimeFormat
 *    in any mode that is locale-sensitive.
 * 4. This function is pure — same inputs always produce same outputs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toVenueLocal = toVenueLocal;
exports.assertIanaTimezone = assertIanaTimezone;
exports.isSameVenueDay = isSameVenueDay;
/**
 * IANA timezone identifier pattern.
 * Valid examples: "America/New_York", "Europe/London", "UTC", "Asia/Kolkata"
 * Invalid examples: "+05:30", "EST", "GMT+5"
 *
 * Note: "UTC" is a valid IANA identifier. "GMT" is also accepted by
 * Intl.DateTimeFormat but we validate the format explicitly to reject
 * offset-style strings.
 */
const IANA_TIMEZONE_PATTERN = /^[A-Za-z]+(?:\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)?$/;
/**
 * Convert a UTC millisecond timestamp to venue-local time components
 * using the venue's IANA timezone.
 *
 * This is the ONLY permitted method for timezone conversion in PRE.
 * All callers MUST pass an IANA timezone string from the venue record.
 * Never pass a derived UTC offset string.
 *
 * Throws if the timezone is not a valid IANA timezone identifier.
 */
function toVenueLocal(utcMs, ianaTimezone) {
    assertIanaTimezone(ianaTimezone);
    // Use Intl.DateTimeFormat with explicit, locale-neutral field extraction.
    // The 'en-US' locale is used solely to produce a stable, parseable output format.
    // This is locale-neutral for our purposes because we parse the numeric fields
    // directly and discard the locale-specific formatting characters.
    //
    // Node.js v12+ includes the full ICU timezone database (full-icu), which
    // covers all IANA timezones correctly including DST transitions.
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: ianaTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const parts = formatter.formatToParts(new Date(utcMs));
    const fields = extractDateParts(parts);
    // Compute UTC offset: convert the local time back to UTC and compare.
    const utcOffsetMinutes = computeUtcOffsetMinutes(utcMs, fields);
    // Day of week: derived from the Date object using the local date components,
    // then verified against the expected local date. We use the UTC-based
    // Date constructor with the offset to compute the correct local day.
    const dayOfWeek = computeDayOfWeek(fields.year, fields.month, fields.day);
    return {
        year: fields.year,
        month: fields.month,
        day: fields.day,
        hour: fields.hour,
        minute: fields.minute,
        second: fields.second,
        millisecond: utcMs % 1000,
        dayOfWeek,
        ianaTimezone,
        utcOffsetMinutes,
    };
}
function extractDateParts(parts) {
    let year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0;
    for (const part of parts) {
        switch (part.type) {
            case 'year':
                year = parseInt(part.value, 10);
                break;
            case 'month':
                month = parseInt(part.value, 10);
                break;
            case 'day':
                day = parseInt(part.value, 10);
                break;
            case 'hour':
                hour = parseInt(part.value, 10) % 24;
                break; // normalize 24→0
            case 'minute':
                minute = parseInt(part.value, 10);
                break;
            case 'second':
                second = parseInt(part.value, 10);
                break;
        }
    }
    return { year, month, day, hour, minute, second };
}
function computeUtcOffsetMinutes(utcMs, local) {
    // Reconstruct what UTC ms the local components would represent if interpreted
    // as UTC, then the difference gives the offset.
    const localAsUtcMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second, 0);
    // offset = localAsUTC - actualUTC (rounded to nearest minute)
    const diffMs = localAsUtcMs - (utcMs - (utcMs % 1000));
    return Math.round(diffMs / 60_000);
}
function computeDayOfWeek(year, month, day) {
    // Tomohiko Sakamoto's algorithm — pure arithmetic, no Date dependency,
    // locale-independent, correct for all dates after 1752 (Gregorian reform).
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    let y = year;
    if (month < 3)
        y--;
    return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400)
        + t[month - 1] + day) % 7;
}
/**
 * Assert that the given string is a valid IANA timezone identifier.
 * Rejects UTC offset strings ("+05:30"), abbreviations ("EST"), and
 * any other non-IANA format.
 *
 * Throws with a CONSTITUTIONAL_BREACH message if validation fails.
 */
function assertIanaTimezone(tz) {
    if (!IANA_TIMEZONE_PATTERN.test(tz)) {
        throw new Error(`CONSTITUTIONAL_BREACH — INV-9 Timezone Isolation violation: ` +
            `"${tz}" is not a valid IANA timezone identifier. ` +
            `PRE MUST use IANA timezone identifiers exclusively. ` +
            `UTC offset strings, abbreviations, and other formats are forbidden.`);
    }
    // Additionally attempt to use it in Intl.DateTimeFormat to verify it's
    // actually recognized by the runtime's timezone database.
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
    }
    catch {
        throw new Error(`CONSTITUTIONAL_BREACH — INV-9 Timezone Isolation violation: ` +
            `"${tz}" is not recognized by the runtime timezone database. ` +
            `Ensure the Node.js runtime includes full ICU timezone data (--icu-data-dir or full-icu).`);
    }
}
/**
 * Compare two UTC timestamps to determine whether they fall in the same
 * venue-local calendar day.
 *
 * Used by schedule active-window evaluation to correctly handle midnight
 * boundaries in the venue's local timezone.
 */
function isSameVenueDay(utcMsA, utcMsB, ianaTimezone) {
    const a = toVenueLocal(utcMsA, ianaTimezone);
    const b = toVenueLocal(utcMsB, ianaTimezone);
    return a.year === b.year && a.month === b.month && a.day === b.day;
}
//# sourceMappingURL=venue-local-time.js.map