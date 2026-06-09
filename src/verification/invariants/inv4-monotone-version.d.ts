/**
 * INV-4: Monotone Versioning
 *
 * The version counter for a screen's manifest is monotonically non-decreasing.
 * If playlist_checksum matches the previous delivery's checksum, version is unchanged.
 * If playlist_checksum differs, version = previous_version + 1.
 * Version MUST never decrease.
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.4
 * PRE-REFERENCE-IMPLEMENTATION-v1.md §6.5 (Version Semantics)
 */
export {};
//# sourceMappingURL=inv4-monotone-version.d.ts.map