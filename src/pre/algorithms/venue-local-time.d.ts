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
/**
 * Local time components extracted from a UTC timestamp in a given IANA timezone.
 */
export interface VenueLocalTime {
    /** Full year (e.g., 2026) */
    year: number;
    /** Month 1–12 */
    month: number;
    /** Day of month 1–31 */
    day: number;
    /** Hour 0–23 (24-hour clock) */
    hour: number;
    /** Minute 0–59 */
    minute: number;
    /** Second 0–59 */
    second: number;
    /** Milliseconds 0–999 */
    millisecond: number;
    /** Day of week 0=Sunday through 6=Saturday */
    dayOfWeek: number;
    /** The IANA timezone identifier used for this conversion */
    ianaTimezone: string;
    /** UTC offset in minutes at the given timestamp (positive = east of UTC) */
    utcOffsetMinutes: number;
}
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
export declare function toVenueLocal(utcMs: number, ianaTimezone: string): VenueLocalTime;
/**
 * Assert that the given string is a valid IANA timezone identifier.
 * Rejects UTC offset strings ("+05:30"), abbreviations ("EST"), and
 * any other non-IANA format.
 *
 * Throws with a CONSTITUTIONAL_BREACH message if validation fails.
 */
export declare function assertIanaTimezone(tz: string): void;
/**
 * Compare two UTC timestamps to determine whether they fall in the same
 * venue-local calendar day.
 *
 * Used by schedule active-window evaluation to correctly handle midnight
 * boundaries in the venue's local timezone.
 */
export declare function isSameVenueDay(utcMsA: number, utcMsB: number, ianaTimezone: string): boolean;
//# sourceMappingURL=venue-local-time.d.ts.map