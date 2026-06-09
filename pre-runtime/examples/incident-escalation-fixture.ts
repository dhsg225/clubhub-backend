/**
 * incident-escalation-fixture.ts
 *
 * Fixture constants for the Incident Escalation workflow.
 *
 * Scenario: A live venue experiences an incident that escalates through the full
 * incident machine lifecycle — NOMINAL → WATCHING → DECLARED → CONTAINED →
 * RESOLVING → RESOLVED → POST_INCIDENT → NOMINAL.
 *
 * The emergency content override is activated when the incident is DECLARED and
 * the PRE emergency flag is set manually in the PREInput. This documents a
 * runtime weakness: there is NO automatic coupling between incident machine state
 * and emergency_active in PREInput. The operator must set emergency_active=false
 * when the incident is RESOLVING to restore normal schedule content.
 *
 * DISCOVERED WEAKNESS:
 *   PRE engine emergency_active flag is not automatically linked to incident machine
 *   state. When incident transitions DECLARED → CONTAINED → RESOLVING, the operator
 *   must explicitly set emergency_active=false in the next PREInput. No enforcement
 *   exists at the PRE layer — a stale emergency flag would cause EMERGENCY_CONTENT
 *   to persist even after the incident machine reaches RESOLVED. This is a
 *   constitutional gap that must be closed at the API/operator layer.
 */

import type { PREInput, ScheduleBlock } from '../src/types';

// ─── SCOPE / OPERATOR ─────────────────────────────────────────────────────────

export const VENUE_SCOPE  = 'venue://the-anchor-manchester';
export const OP_MANAGER   = 'op-001-anchor-manager';
export const RULE_VERSION = '1.0.0';

// ─── TIMESTAMPS ───────────────────────────────────────────────────────────────

export const T0 = '2026-05-30T20:00:00.000Z';  // normal evening operation
export const T1 = '2026-05-30T20:05:00.000Z';  // anomaly watching
export const T2 = '2026-05-30T20:10:00.000Z';  // incident declared, emergency content
export const T3 = '2026-05-30T20:15:00.000Z';  // incident contained (still emergency)
export const T4 = '2026-05-30T20:20:00.000Z';  // resolving — emergency cleared, schedule resumes
export const T5 = '2026-05-30T20:25:00.000Z';  // resolved, post-incident, fully normal

// ─── SCHEDULE BLOCK ───────────────────────────────────────────────────────────

export const NORMAL_SCHEDULE: ScheduleBlock = {
  content_ref: 'content://schedule/evening-music-night',
  starts_at:   '2026-05-30T20:00:00.000Z',
  ends_at:     '2026-05-30T23:00:00.000Z',
};

// ─── PRE INPUTS ───────────────────────────────────────────────────────────────

/** T0: Normal evening operation. Schedule active, no emergency. */
export const INPUT_T0_NORMAL: PREInput = {
  resolution_id:      'res-inc-001',
  corpus_entry_id:    'res-inc-001',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T0,
  rule_version:       RULE_VERSION,
  override_stack:     [],
  schedule_block:     NORMAL_SCHEDULE,
  emergency_active:   false,
  emergency_scope:    null,
  device_state:       'ONLINE',
};

/** T2: Incident declared. Emergency content override active at level 6. */
export const INPUT_T2_EMERGENCY: PREInput = {
  resolution_id:      'res-inc-002',
  corpus_entry_id:    'res-inc-002',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T2,
  rule_version:       RULE_VERSION,
  override_stack:     [],
  schedule_block:     NORMAL_SCHEDULE,
  emergency_active:   true,
  emergency_scope:    VENUE_SCOPE,  // venue-scoped emergency
  device_state:       'ONLINE',
};

/** T3: Incident contained. Emergency still active — operator has not cleared it yet. */
export const INPUT_T3_CONTAINED: PREInput = {
  resolution_id:      'res-inc-003',
  corpus_entry_id:    'res-inc-003',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T3,
  rule_version:       RULE_VERSION,
  override_stack:     [],
  schedule_block:     NORMAL_SCHEDULE,
  emergency_active:   true,       // still true — incident not yet resolved at PRE layer
  emergency_scope:    VENUE_SCOPE,
  device_state:       'ONLINE',
};

/** T4: Incident resolving. Operator clears emergency flag. Schedule resumes. */
export const INPUT_T4_RESOLVING: PREInput = {
  resolution_id:      'res-inc-004',
  corpus_entry_id:    'res-inc-004',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T4,
  rule_version:       RULE_VERSION,
  override_stack:     [],
  schedule_block:     NORMAL_SCHEDULE,
  emergency_active:   false,      // operator manually clears — THIS IS THE WEAKNESS
  emergency_scope:    null,
  device_state:       'ONLINE',
};

/** T5: Fully resolved. Normal schedule continues. */
export const INPUT_T5_NORMAL: PREInput = {
  resolution_id:      'res-inc-005',
  corpus_entry_id:    'res-inc-005',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T5,
  rule_version:       RULE_VERSION,
  override_stack:     [],
  schedule_block:     NORMAL_SCHEDULE,
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

export const EXPECTED_T2 = {
  effective_content:    'EMERGENCY_CONTENT',
  resolution_level:     6,
  resolution_winner_id: 'EMERGENCY',
};

export const EXPECTED_T3 = {
  effective_content:    'EMERGENCY_CONTENT',
  resolution_level:     6,
  resolution_winner_id: 'EMERGENCY',
};

export const EXPECTED_T4 = {
  effective_content:    'content://schedule/evening-music-night',
  resolution_level:     0,
  resolution_winner_id: null,
};

export const EXPECTED_T5 = {
  effective_content:    'content://schedule/evening-music-night',
  resolution_level:     0,
  resolution_winner_id: null,
};
