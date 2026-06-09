/**
 * INV-7: Emergency Absoluteness
 *
 * When an active emergency state exists for a venue, the PRE output MUST
 * resolve at LEVEL_0 (Emergency). No other resolution level is permitted
 * when an emergency is active. The emergency content_id must be the sole
 * content item in the playlist.
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.7
 * PRE-REFERENCE-IMPLEMENTATION-v1.md §4.1 (Level 0 Emergency)
 *
 * This is the hardest invariant: it admits NO exceptions.
 * Not override priority, not sponsorship contracts, not fallback behavior.
 * Emergency absolutely takes precedence over all other resolution sources.
 */
export {};
//# sourceMappingURL=inv7-emergency-absolute.d.ts.map