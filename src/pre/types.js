"use strict";
/**
 * PRE type definitions.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §3, §4, §5, §6
 * These types define the exact input/output contract of PRE.resolve().
 *
 * IMPORTANT: These types MUST match the canonical field names used in
 * replay packets. Any change to a field name or type is a schema version
 * bump and requires corpus migration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESOLUTION_LEVELS = void 0;
// ─── Resolution Levels ────────────────────────────────────────────────────────
exports.RESOLUTION_LEVELS = {
    LEVEL_0_EMERGENCY: 0,
    LEVEL_1_OPERATIONAL: 1,
    LEVEL_2_SCHEDULED: 2,
    LEVEL_3_CAMPAIGN: 3,
    LEVEL_4_SPONSORSHIP: 4,
    LEVEL_5_STRUCTURAL: 5,
    LEVEL_6_DEVICE_TRUTH: 6,
};
//# sourceMappingURL=types.js.map