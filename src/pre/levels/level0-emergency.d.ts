/**
 * LEVEL_0 — Emergency resolution.
 *
 * If an emergency is active, ALL screens receive the emergency content immediately.
 * This level terminates resolution — no further levels are evaluated for base content.
 * Sponsorship injection (LEVEL_4) and structural (LEVEL_5) are SKIPPED (null traces).
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.1
 */
import type { PRE_Input, EmergencyStateRecord } from '../types';
import type { LevelResult } from './types';
export declare function resolveLevel0(input: PRE_Input, emergency: EmergencyStateRecord | null): LevelResult | null;
//# sourceMappingURL=level0-emergency.d.ts.map