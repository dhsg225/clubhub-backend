/**
 * Degraded state factory — canonical base states for chaos scenarios.
 *
 * Constitutional authority: VERIFICATION-AND-SAFETY-SYSTEMS-v1.md §8
 *
 * Each factory function returns a COMPLETE, VALID SystemStateSnapshot that
 * represents a specific operational context. Chaos scenarios call these to
 * get a base state, then inject specific faults via the fault injectors.
 *
 * CRITICAL: All states are deterministic. No Math.random(). No Date.now().
 * Use the `at` parameter for all timestamps.
 */

import type {
  SystemStateSnapshot,
  ScreenRecord,
  TvGroupRecord,
  AreaRecord,
  VenueRecord,
  OrganizationRecord,
  ContentItemRecord,
  ScheduleRecord,
  OverrideRecord,
  EmergencyStateRecord,
} from '../../pre/types';

// ─── Canonical Test IDs ───────────────────────────────────────────────────────

export const CHAOS_SCREEN_ID    = 'chaos-screen-001';
export const CHAOS_TVGROUP_ID   = 'chaos-tvg-001';
export const CHAOS_AREA_ID      = 'chaos-area-001';
export const CHAOS_VENUE_ID     = 'chaos-venue-001';
export const CHAOS_ORG_ID       = 'chaos-org-001';
export const CHAOS_CONTENT_A_ID = 'chaos-content-a';
export const CHAOS_CONTENT_B_ID = 'chaos-content-b';
export const CHAOS_CONTENT_C_ID = 'chaos-content-c';
export const CHAOS_SCHEDULE_ID  = 'chaos-schedule-001';
export const CHAOS_OVERRIDE_ID  = 'chaos-override-001';
export const CHAOS_EMERGENCY_ID = 'chaos-emergency-001';

// ─── Fixed Records ────────────────────────────────────────────────────────────

const CHAOS_SCREEN: ScreenRecord = {
  id:            CHAOS_SCREEN_ID,
  tv_group_id:   CHAOS_TVGROUP_ID,
  area_id:       CHAOS_AREA_ID,
  venue_id:      CHAOS_VENUE_ID,
  status:        'active',
  last_seen_at:  null,
  last_checksum: null,
};

const CHAOS_TV_GROUP: TvGroupRecord = {
  id:      CHAOS_TVGROUP_ID,
  area_id: CHAOS_AREA_ID,
  name:    'Chaos Test Group',
};

const CHAOS_AREA: AreaRecord = {
  id:       CHAOS_AREA_ID,
  venue_id: CHAOS_VENUE_ID,
  name:     'Chaos Test Area',
};

const CHAOS_VENUE: VenueRecord = {
  id:        CHAOS_VENUE_ID,
  name:      'Chaos Test Venue',
  timezone:  'America/Chicago',
  is_active: true,
  org_id:    CHAOS_ORG_ID,
};

const CHAOS_ORG: OrganizationRecord = {
  id:   CHAOS_ORG_ID,
  name: 'Chaos Test Organization',
};

const CHAOS_CONTENT_A: ContentItemRecord = {
  id:          CHAOS_CONTENT_A_ID,
  duration_ms: 15_000,
  type:        'video',
  is_active:   true,
};

const CHAOS_CONTENT_B: ContentItemRecord = {
  id:          CHAOS_CONTENT_B_ID,
  duration_ms: 10_000,
  type:        'image',
  is_active:   true,
};

const CHAOS_CONTENT_C: ContentItemRecord = {
  id:          CHAOS_CONTENT_C_ID,
  duration_ms: 20_000,
  type:        'video',
  is_active:   true,
};

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Minimal valid state: one screen, one venue, no campaigns/schedules/content.
 * Used as base for scenarios testing fallback behavior (CHAOS-001, CHAOS-002).
 */
export function buildMinimalState(overrides?: Partial<SystemStateSnapshot>): SystemStateSnapshot {
  return {
    screen:        CHAOS_SCREEN,
    tv_group:      CHAOS_TV_GROUP,
    area:          CHAOS_AREA,
    venue:         CHAOS_VENUE,
    organization:  CHAOS_ORG,
    emergency:     null,
    overrides:     [],
    schedules:     [],
    campaigns:     [],
    content_items: [],
    sponsorships:  [],
    last_delivery: null,
    ...overrides,
  };
}

/**
 * State with active campaign content items and a venue-level schedule.
 * Used for scenarios that need content to resolve against (CHAOS-003 through CHAOS-007).
 *
 * The schedule is a venue-level schedule active at `at` — days_of_week empty means
 * it applies any day (no day restriction). Expires 2 hours after `at`.
 */
export function buildCampaignState(at: number, overrides?: Partial<SystemStateSnapshot>): SystemStateSnapshot {
  const schedule: ScheduleRecord = {
    id:                 CHAOS_SCHEDULE_ID,
    campaign_id:        null,
    content_id:         CHAOS_CONTENT_A_ID,
    target_type:        'venue',
    target_id:          CHAOS_VENUE_ID,
    specificity:        1,
    starts_at:          at - 60 * 60 * 1000,  // started 1 hour ago
    expires_at:         at + 2 * 60 * 60 * 1000, // expires 2 hours from now
    days_of_week:       [],                     // no day restriction
    start_time_minutes: null,
    end_time_minutes:   null,
    is_active:          true,
    is_fallback:        false,
    priority:           10,
  };

  return {
    screen:        CHAOS_SCREEN,
    tv_group:      CHAOS_TV_GROUP,
    area:          CHAOS_AREA,
    venue:         CHAOS_VENUE,
    organization:  CHAOS_ORG,
    emergency:     null,
    overrides:     [],
    schedules:     [schedule],
    campaigns:     [],
    content_items: [CHAOS_CONTENT_A, CHAOS_CONTENT_B, CHAOS_CONTENT_C],
    sponsorships:  [],
    last_delivery: null,
    ...overrides,
  };
}

/**
 * State with an active venue-level emergency.
 * Emergency content_id is CHAOS_CONTENT_A_ID.
 * Used for CHAOS-007 (emergency during poll storm).
 */
export function buildEmergencyState(at: number, overrides?: Partial<SystemStateSnapshot>): SystemStateSnapshot {
  const emergency: EmergencyStateRecord = {
    id:           CHAOS_EMERGENCY_ID,
    venue_id:     CHAOS_VENUE_ID,
    content_id:   CHAOS_CONTENT_A_ID,
    is_global:    false,
    is_active:    true,
    activated_at: at - 5 * 60 * 1000,  // activated 5 minutes ago
    reason:       'chaos-007-emergency-test',
  };

  return {
    screen:        CHAOS_SCREEN,
    tv_group:      CHAOS_TV_GROUP,
    area:          CHAOS_AREA,
    venue:         CHAOS_VENUE,
    organization:  CHAOS_ORG,
    emergency,
    overrides:     [],
    schedules:     [],
    campaigns:     [],
    content_items: [CHAOS_CONTENT_A, CHAOS_CONTENT_B, CHAOS_CONTENT_C],
    sponsorships:  [],
    last_delivery: null,
    ...overrides,
  };
}

/**
 * State with an active venue-level operational override.
 * Override target is the venue — applies to all screens in the venue.
 * Used as base for CHAOS-004 (event bus lag).
 */
export function buildOverrideState(at: number, overrides?: Partial<SystemStateSnapshot>): SystemStateSnapshot {
  const override: OverrideRecord = {
    id:             CHAOS_OVERRIDE_ID,
    content_id:     CHAOS_CONTENT_B_ID,
    target_type:    'venue',
    target_id:      CHAOS_VENUE_ID,
    starts_at:      at - 60 * 60 * 1000,    // started 1 hour ago
    expires_at:     at + 60 * 60 * 1000,    // expires in 1 hour
    is_operational: true,
    priority:       100,
    reason:         'chaos-004-lag-test',
    issued_by:      'chaos-004',
  };

  return {
    screen:        CHAOS_SCREEN,
    tv_group:      CHAOS_TV_GROUP,
    area:          CHAOS_AREA,
    venue:         CHAOS_VENUE,
    organization:  CHAOS_ORG,
    emergency:     null,
    overrides:     [override],
    schedules:     [],
    campaigns:     [],
    content_items: [CHAOS_CONTENT_A, CHAOS_CONTENT_B, CHAOS_CONTENT_C],
    sponsorships:  [],
    last_delivery: null,
    ...overrides,
  };
}
