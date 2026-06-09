/**
 * scheduled-content-fixture.ts
 *
 * Fixture constants for the Scheduled Content Change workflow.
 *
 * Scenario: The Anchor Manchester transitions from afternoon sports schedule
 * to evening music night. An operator with ELEVATED session authority approves
 * the new schedule. The PRE engine resolves each schedule_block deterministically.
 *
 * Discovered weakness documented inline:
 *   The "schedule approval" has no formal governance coupling — the operator
 *   ELEVATED state is convention only. PRE engine resolves schedule_block
 *   based solely on timestamp comparison, not operator authorisation state.
 */

import type { PREInput, ScheduleBlock, Override } from '../src/types';

// ─── SCOPE / OPERATOR CONSTANTS ───────────────────────────────────────────────

export const VENUE_SCOPE   = 'venue://the-anchor-manchester';
export const OP_SCHEDULER  = 'op-002-scheduler';
export const RULE_VERSION  = '1.0.0';

// ─── TIMESTAMPS ───────────────────────────────────────────────────────────────

/** T0: Current afternoon sports schedule is active. */
export const T0 = '2026-05-30T14:00:00.000Z';

/** T1: Operator proposes / approves new evening schedule (session goes ELEVATED). */
export const T1 = '2026-05-30T14:10:00.000Z';

/** T2: New evening music schedule becomes active. Old ends_at is exclusive at 18:00. */
export const T2 = '2026-05-30T18:00:00.000Z';

// ─── SCHEDULE BLOCKS ──────────────────────────────────────────────────────────

export const OLD_SCHEDULE: ScheduleBlock = {
  content_ref: 'content://schedule/afternoon-sports',
  starts_at:   '2026-05-30T12:00:00.000Z',
  ends_at:     '2026-05-30T18:00:00.000Z',   // exclusive — T2 is NOT in this window
};

export const NEW_SCHEDULE: ScheduleBlock = {
  content_ref: 'content://schedule/evening-music-night',
  starts_at:   '2026-05-30T18:00:00.000Z',   // T2 is exactly the start — inclusive
  ends_at:     '2026-05-30T23:00:00.000Z',
};

// ─── OVERRIDE EXAMPLES ────────────────────────────────────────────────────────
//
// A level-3 GAME_NIGHT override submitted at T1 that expires before T2 demonstrates
// how an operator override can temporarily suppress the schedule, then yield back
// to the NEW_SCHEDULE when it expires.

/** Level-3 game night override active between T1 and 17:59 — suppresses OLD_SCHEDULE. */
export const GAME_NIGHT_OVERRIDE: Override = {
  id:          'ovr-game-night-001',
  level:       3,
  content_ref: 'content://promo/friday-game-night',
  expires_at:  '2026-05-30T17:59:00.000Z',   // expires before T2 — schedule resumes
  operator_id: OP_SCHEDULER,
};

/** Same override but with null expiry — would permanently suppress until removed. */
export const PERMANENT_GAME_NIGHT_OVERRIDE: Override = {
  id:          'ovr-game-night-002',
  level:       3,
  content_ref: 'content://promo/friday-game-night',
  expires_at:  null,
  operator_id: OP_SCHEDULER,
};

// ─── PRE INPUTS ───────────────────────────────────────────────────────────────

/** T0: Afternoon sports schedule is active. No overrides. */
export const INPUT_T0_OLD_SCHEDULE: PREInput = {
  resolution_id:    'res-sched-001',
  corpus_entry_id:  'res-sched-001',
  scope_id:         VENUE_SCOPE,
  governed_timestamp: T0,
  rule_version:     RULE_VERSION,
  override_stack:   [],
  schedule_block:   OLD_SCHEDULE,
  emergency_active: false,
  emergency_scope:  null,
  device_state:     'ONLINE',
};

/** T2: Evening music schedule is active. Old schedule window has closed. */
export const INPUT_T2_NEW_SCHEDULE: PREInput = {
  resolution_id:    'res-sched-002',
  corpus_entry_id:  'res-sched-002',
  scope_id:         VENUE_SCOPE,
  governed_timestamp: T2,
  rule_version:     RULE_VERSION,
  override_stack:   [],
  schedule_block:   NEW_SCHEDULE,
  emergency_active: false,
  emergency_scope:  null,
  device_state:     'ONLINE',
};

// ─── EXPECTED OUTCOMES ────────────────────────────────────────────────────────

export const EXPECTED_OLD = {
  effective_content: 'content://schedule/afternoon-sports',
  resolution_level:  0,
  resolution_winner_id: null,
};

export const EXPECTED_NEW = {
  effective_content: 'content://schedule/evening-music-night',
  resolution_level:  0,
  resolution_winner_id: null,
};

// ─── RESOLUTION IDS ───────────────────────────────────────────────────────────

export const RES_ID_OLD = 'res-sched-001';
export const RES_ID_NEW = 'res-sched-002';
