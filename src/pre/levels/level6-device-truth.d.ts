/**
 * LEVEL_6 — Device truth annotation.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §6.6
 * Always has outcome RESOLVED.
 */
import type { PRE_Input, ScreenDeliveryLogRecord, PlaylistItem, ReasonTraceDeviceTruthLevel } from '../types';
export interface Level6Result {
    confidence_score: number;
    trace: ReasonTraceDeviceTruthLevel;
}
export declare function annotateLevel6(input: PRE_Input, playlist: PlaylistItem[], lastDelivery: ScreenDeliveryLogRecord | null, playlistChecksum: string): Level6Result;
//# sourceMappingURL=level6-device-truth.d.ts.map