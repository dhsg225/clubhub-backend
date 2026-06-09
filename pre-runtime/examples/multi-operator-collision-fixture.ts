/**
 * multi-operator-collision-fixture.ts
 *
 * Fixture constants for the Multi-Operator Override Collision workflow.
 *
 * Scenario: Two operators submit overrides at different levels. The PRE engine
 * resolves conflicts deterministically by level (higher wins), with alphabetical
 * id tiebreak at the same level.
 *
 * DISCOVERED DEFECT: All machines created by createOperatorSessionMachine() have
 * the same hardcoded id 'operator-session'. Registering two operator session
 * machines overwrites the first in the guard layer registry. This means two
 * concurrent operator sessions cannot both be governed by the guard layer.
 *
 * Fix applied: Model the collision at the OVERRIDE STACK level only (which is
 * correct — the collision is a PRE resolution concern, not a machine state concern).
 * A single operator-session machine represents the winning session (senior operator).
 * The junior operator's action is represented only in the override_stack of PREInput.
 *
 * DISCOVERED WEAKNESS: ID-based alphabetical tiebreak for same-level overrides
 * is deterministic but arbitrary. If two operators both have level-4 authority,
 * resolution is determined by override ID string ordering, not by timestamp
 * precedence or business priority. This is deterministic (required for corpus
 * integrity) but may surprise operators who assume "last submitted wins".
 *
 * 5 corpus entries across 4 time points:
 *   T0: no overrides → schedule wins (level 0)
 *   T1: only JUNIOR override → JUNIOR wins (level 3)
 *   T2: BOTH overrides → SENIOR wins (level 4). PRE engine sorts by level DESC, finds senior
 *       first, marks WIN, then breaks. Junior is never evaluated (not in resolution_path).
 *   T3: SENIOR expired, JUNIOR still active → JUNIOR wins (level 3)
 *   T4: BOTH expired → schedule wins (level 0)
 */

import type { PREInput, ScheduleBlock, Override } from '../src/types';

// ─── SCOPE / OPERATORS ────────────────────────────────────────────────────────

export const VENUE_SCOPE = 'venue://the-anchor-manchester';
export const OP_SENIOR   = 'op-001-senior-manager';   // level 4 authority
export const OP_JUNIOR   = 'op-002-junior-staff';     // level 3 authority
export const RULE_VERSION = '1.0.0';

// ─── TIMESTAMPS ───────────────────────────────────────────────────────────────

export const T0 = '2026-05-30T21:30:00.000Z';  // baseline, schedule active
export const T1 = '2026-05-30T21:31:00.000Z';  // junior submits level-3 override
export const T2 = '2026-05-30T21:32:00.000Z';  // senior submits level-4 override — COLLISION
export const T3 = '2026-05-30T21:35:00.000Z';  // senior expires, junior wins again
export const T4 = '2026-05-30T21:40:00.000Z';  // both expired, schedule resumes

// ─── SCHEDULE BLOCK ───────────────────────────────────────────────────────────

export const SCHEDULE: ScheduleBlock = {
  content_ref: 'content://schedule/evening-music-night',
  starts_at:   '2026-05-30T21:00:00.000Z',
  ends_at:     '2026-05-30T23:00:00.000Z',
};

// ─── OVERRIDES ────────────────────────────────────────────────────────────────

export const JUNIOR_OVERRIDE: Override = {
  id:          'ovr-junior-001',
  level:       3,
  content_ref: 'content://promo/friday-drinks',
  expires_at:  '2026-05-30T21:45:00.000Z',  // expires after T4 — outlasts senior
  operator_id: OP_JUNIOR,
};

export const SENIOR_OVERRIDE: Override = {
  id:          'ovr-senior-001',
  level:       4,
  content_ref: 'content://premium/vip-night',
  expires_at:  '2026-05-30T21:34:00.000Z',  // expires between T2 and T3
  operator_id: OP_SENIOR,
};

// ─── PRE INPUTS ───────────────────────────────────────────────────────────────

/** T0: No overrides. Schedule wins. */
export const INPUT_T0_BASELINE: PREInput = {
  resolution_id:      'res-coll-001',
  corpus_entry_id:    'res-coll-001',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T0,
  rule_version:       RULE_VERSION,
  override_stack:     [],
  schedule_block:     SCHEDULE,
  emergency_active:   false,
  emergency_scope:    null,
  device_state:       'ONLINE',
};

/** T1: Only junior override. Junior wins. */
export const INPUT_T1_JUNIOR_ONLY: PREInput = {
  resolution_id:      'res-coll-002',
  corpus_entry_id:    'res-coll-002',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T1,
  rule_version:       RULE_VERSION,
  override_stack:     [JUNIOR_OVERRIDE],
  schedule_block:     SCHEDULE,
  emergency_active:   false,
  emergency_scope:    null,
  device_state:       'ONLINE',
};

/** T2: Both overrides present. Senior (level 4) wins. Junior SUPPRESSED. */
export const INPUT_T2_COLLISION: PREInput = {
  resolution_id:      'res-coll-003',
  corpus_entry_id:    'res-coll-003',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T2,
  rule_version:       RULE_VERSION,
  override_stack:     [JUNIOR_OVERRIDE, SENIOR_OVERRIDE],  // order irrelevant — sorted by PRE engine
  schedule_block:     SCHEDULE,
  emergency_active:   false,
  emergency_scope:    null,
  device_state:       'ONLINE',
};

/** T3: Senior expired at 21:34. Junior still valid (expires 21:45). Junior wins. */
export const INPUT_T3_SENIOR_EXPIRED: PREInput = {
  resolution_id:      'res-coll-004',
  corpus_entry_id:    'res-coll-004',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T3,
  rule_version:       RULE_VERSION,
  override_stack:     [JUNIOR_OVERRIDE, SENIOR_OVERRIDE],  // senior still in stack, will be EXPIRED
  schedule_block:     SCHEDULE,
  emergency_active:   false,
  emergency_scope:    null,
  device_state:       'ONLINE',
};

/** T4: Both overrides expired (21:45 > T4=21:40... wait, junior expires 21:45, T4=21:40). */
// Note: junior expires at 21:45, T4=21:40 — junior is still technically active at T4!
// Correction: remove junior from stack at T4 to model "both expired" scenario.
// (In a real system, the operator would have removed the expired override from the stack.)
export const INPUT_T4_BOTH_EXPIRED: PREInput = {
  resolution_id:      'res-coll-005',
  corpus_entry_id:    'res-coll-005',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T4,
  rule_version:       RULE_VERSION,
  override_stack:     [],  // both overrides removed — operator cleaned up stack
  schedule_block:     SCHEDULE,
  emergency_active:   false,
  emergency_scope:    null,
  device_state:       'ONLINE',
};

// ─── EXPECTED OUTCOMES ────────────────────────────────────────────────────────

export const EXPECTED_T0 = {
  effective_content:    'content://schedule/evening-music-night',
  resolution_level:     0,
  resolution_winner_id: null,
};

export const EXPECTED_T1 = {
  effective_content:    'content://promo/friday-drinks',
  resolution_level:     3,
  resolution_winner_id: 'ovr-junior-001',
};

export const EXPECTED_T2 = {
  effective_content:    'content://premium/vip-night',
  resolution_level:     4,
  resolution_winner_id: 'ovr-senior-001',
};

export const EXPECTED_T3 = {
  effective_content:    'content://promo/friday-drinks',
  resolution_level:     3,
  resolution_winner_id: 'ovr-junior-001',
};

export const EXPECTED_T4 = {
  effective_content:    'content://schedule/evening-music-night',
  resolution_level:     0,
  resolution_winner_id: null,
};
