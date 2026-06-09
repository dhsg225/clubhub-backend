/**
 * LEVEL_5 — Structural / system fallback.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.5
 * Always has outcome RESOLVED (normalizes playlist or applies system fallback).
 */
import type { PlaylistItem, ReasonTraceLevel } from '../types';
export interface Level5Result {
    playlist: PlaylistItem[];
    isFallback: boolean;
    trace: ReasonTraceLevel;
}
export declare function resolveLevel5(playlist: PlaylistItem[], fallbackReason?: string): Level5Result;
//# sourceMappingURL=level5-structural.d.ts.map