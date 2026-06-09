/**
 * INV-5: Level Termination
 *
 * Resolution terminates at exactly one level. Once a level resolves the output,
 * lower-priority levels are not evaluated. The resolution_level field records
 * which level terminated resolution.
 *
 * The reason_trace must be consistent: exactly one level has outcome 'RESOLVED',
 * and all lower-priority levels must have outcome 'SKIP' or null.
 *
 * Constitutional authority: ENGINEERING-CONSTITUTION-v1.md §10.5
 * PRE-REFERENCE-IMPLEMENTATION-v1.md §2 (Resolution Algorithm)
 *
 * Level priority (highest to lowest):
 *   LEVEL_0 > LEVEL_1 > LEVEL_2 > LEVEL_3 > LEVEL_4 > LEVEL_5 > LEVEL_6
 */
export {};
//# sourceMappingURL=inv5-level-termination.d.ts.map