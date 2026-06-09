/**
 * Query: override-state
 *
 * Pure function over SystemStateSnapshot. No DB. No side effects. No writes.
 */
import type { SystemStateSnapshot, OverrideRecord } from '../types';
/**
 * Return all overrides that are:
 *   - scoped to this screen's hierarchy (screen, tv_group, area, or venue)
 *   - matching is_operational flag
 *   - active at `at`: starts_at <= at && (expires_at === null || expires_at > at)
 *
 * Sorted by: specificity DESC, then starts_at DESC (most recent first, as tiebreaker).
 * This means the first element is the highest-priority override.
 */
export declare function getActiveOverrides(state: SystemStateSnapshot, at: number, isOperational: boolean): OverrideRecord[];
//# sourceMappingURL=override-state.d.ts.map