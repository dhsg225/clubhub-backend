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
export {};
//# sourceMappingURL=inv9-timezone-isolation.d.ts.map