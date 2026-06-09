/**
 * Minimal SystemStateSnapshot fixture builder for contract vector tests.
 *
 * Vectors call buildMinimalState() to get a baseline state, then override
 * specific fields to construct the test scenario.
 */

import type {
  SystemStateSnapshot,
  ScreenRecord,
  TvGroupRecord,
  AreaRecord,
  VenueRecord,
  OrganizationRecord,
  ContentItemRecord,
  PRE_Input,
} from '../../src/pre/types';

export const AT = 1_748_000_000_000; // Fixed evaluation timestamp (UTC ms)

export const SCREEN: ScreenRecord = {
  id:            'screen-001',
  tv_group_id:   'tvg-001',
  area_id:       'area-001',
  venue_id:      'venue-001',
  status:        'active',
  last_seen_at:  null,
  last_checksum: null,
};

export const TV_GROUP: TvGroupRecord = {
  id:      'tvg-001',
  area_id: 'area-001',
  name:    'Main Group',
};

export const AREA: AreaRecord = {
  id:       'area-001',
  venue_id: 'venue-001',
  name:     'Main Area',
};

export const VENUE: VenueRecord = {
  id:        'venue-001',
  name:      'Test Venue',
  timezone:  'America/Chicago',
  is_active: true,
  org_id:    'org-001',
};

export const ORG: OrganizationRecord = {
  id:   'org-001',
  name: 'Test Org',
};

export const CONTENT_A: ContentItemRecord = {
  id:          'content-a',
  duration_ms: 15_000,
  type:        'video',
  is_active:   true,
};

export const CONTENT_B: ContentItemRecord = {
  id:          'content-b',
  duration_ms: 10_000,
  type:        'image',
  is_active:   true,
};

export function buildMinimalState(overrides: Partial<SystemStateSnapshot> = {}): SystemStateSnapshot {
  return {
    screen:        SCREEN,
    tv_group:      TV_GROUP,
    area:          AREA,
    venue:         VENUE,
    organization:  ORG,
    emergency:     null,
    overrides:     [],
    schedules:     [],
    campaigns:     [],
    content_items: [CONTENT_A, CONTENT_B],
    sponsorships:  [],
    last_delivery: null,
    ...overrides,
  };
}

export function buildInput(stateOverrides: Partial<SystemStateSnapshot> = {}): PRE_Input {
  return {
    screen_id:    SCREEN.id,
    at:           AT,
    system_state: buildMinimalState(stateOverrides),
  };
}

// ─── Assertion helpers ────────────────────────────────────────────────────────

let _pass = 0;
let _fail = 0;

export function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  PASS: ${message}`);
    _pass++;
  } else {
    console.error(`  FAIL: ${message}`);
    _fail++;
  }
}

export function assertEqual<T>(actual: T, expected: T, message: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  PASS: ${message}`);
    _pass++;
  } else {
    console.error(`  FAIL: ${message}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
    _fail++;
  }
}

export function summary(scriptName: string): never {
  console.log(`\n${scriptName}: ${_pass} passed, ${_fail} failed`);
  process.exit(_fail > 0 ? 1 : 0);
}
