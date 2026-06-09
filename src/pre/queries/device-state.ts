/**
 * Query: device-state
 *
 * Pure function over SystemStateSnapshot. No DB. No side effects. No writes.
 * Returns the resolved hierarchy context for the screen under evaluation.
 */

import type { SystemStateSnapshot, ScreenRecord, TvGroupRecord, AreaRecord, VenueRecord, OrganizationRecord } from '../types';

export interface ScreenContext {
  screen:       ScreenRecord;
  tv_group:     TvGroupRecord | null;
  area:         AreaRecord | null;
  venue:        VenueRecord;
  organization: OrganizationRecord;
}

/**
 * Return the screen's fully-resolved hierarchy context from the snapshot.
 * Returns null if the snapshot's screen field is missing or the venue is missing.
 */
export function getScreenContext(state: SystemStateSnapshot): ScreenContext | null {
  if (!state.screen || !state.venue) {
    return null;
  }

  return {
    screen:       state.screen,
    tv_group:     state.tv_group ?? null,
    area:         state.area ?? null,
    venue:        state.venue,
    organization: state.organization,
  };
}
