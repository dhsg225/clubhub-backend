/**
 * Query: override-state
 *
 * Pure function over SystemStateSnapshot. No DB. No side effects. No writes.
 */

import type { SystemStateSnapshot, OverrideRecord } from '../types';

/**
 * Target specificity values for sorting.
 * Higher specificity = more specific scope = higher priority.
 */
const SPECIFICITY: Record<OverrideRecord['target_type'], number> = {
  screen:   4,
  tv_group: 3,
  area:     2,
  venue:    1,
};

/**
 * Return all overrides that are:
 *   - scoped to this screen's hierarchy (screen, tv_group, area, or venue)
 *   - matching is_operational flag
 *   - active at `at`: starts_at <= at && (expires_at === null || expires_at > at)
 *
 * Sorted by: specificity DESC, then starts_at DESC (most recent first, as tiebreaker).
 * This means the first element is the highest-priority override.
 */
export function getActiveOverrides(
  state: SystemStateSnapshot,
  at: number,
  isOperational: boolean
): OverrideRecord[] {
  const { screen, tv_group, area, venue } = state;

  return state.overrides
    .filter((o) => {
      // Operational flag match
      if (o.is_operational !== isOperational) return false;

      // Time window: starts_at <= at && (expires_at === null || expires_at > at)
      if (o.starts_at > at) return false;
      if (o.expires_at !== null && o.expires_at <= at) return false;

      // Scope matching: target_type + target_id must match the screen's hierarchy
      switch (o.target_type) {
        case 'screen':
          return o.target_id === screen.id;
        case 'tv_group':
          return tv_group !== null && o.target_id === tv_group.id;
        case 'area':
          return area !== null && o.target_id === area.id;
        case 'venue':
          return o.target_id === venue.id;
        default:
          return false;
      }
    })
    .sort((a, b) => {
      const specDiff = SPECIFICITY[b.target_type] - SPECIFICITY[a.target_type];
      if (specDiff !== 0) return specDiff;
      // Tiebreaker: more recent starts_at first
      return b.starts_at - a.starts_at;
    });
}
