/**
 * venue-disconnect-fixture.ts
 *
 * Fixture constants for the Venue Disconnect workflow.
 *
 * Scenario: The Anchor Manchester loses network connectivity, operates offline
 * for several minutes, then reconnects and reconciles.
 *
 * DISCOVERED WEAKNESS 1: PRE engine does not factor device_state into resolution
 * decisions. An OFFLINE device resolves identically to an ONLINE device given the
 * same inputs. This means:
 *   - Corpus entries from offline operation look identical to online entries
 *   - Auditors cannot distinguish offline-mode execution from online execution
 *     just from the corpus (device_state is stored in PREInput, but has no
 *     effect on the resolution algorithm)
 *   - No enforcement that operator overrides cannot be applied while offline
 *
 * DISCOVERED WEAKNESS 2: The player state machine has no 'OFFLINE' state.
 * When the venue is physically offline, the player remains in DEGRADED. The
 * device_state field in PREInput records the network state, but the player
 * state machine models operational state. These are distinct concepts that
 * are not automatically synchronised.
 *
 * Player transitions for disconnect:
 *   LIVE → DEGRADED (at T1: connectivity dropping)
 *   DEGRADED → DEGRADED (at T2: fully offline — no OFFLINE state exists)
 *   DEGRADED → SYNCING (at T3: reconnection event)
 *   SYNCING → LIVE (at T4: reconciliation complete)
 */

import type { PREInput, ScheduleBlock, Override } from '../src/types';

// ─── SCOPE / CONSTANTS ────────────────────────────────────────────────────────

export const VENUE_SCOPE  = 'venue://the-anchor-manchester';
export const RULE_VERSION = '1.0.0';

// ─── TIMESTAMPS ───────────────────────────────────────────────────────────────

export const T0 = '2026-05-30T21:00:00.000Z';  // online, normal
export const T1 = '2026-05-30T21:05:00.000Z';  // DEGRADED (connectivity dropping)
export const T2 = '2026-05-30T21:10:00.000Z';  // OFFLINE (fully disconnected)
export const T3 = '2026-05-30T21:15:00.000Z';  // reconnection event
export const T4 = '2026-05-30T21:20:00.000Z';  // ONLINE again, reconciliation

// ─── SCHEDULE BLOCK ───────────────────────────────────────────────────────────

export const SCHEDULE: ScheduleBlock = {
  content_ref: 'content://schedule/evening-music-night',
  starts_at:   '2026-05-30T20:00:00.000Z',
  ends_at:     '2026-05-30T23:00:00.000Z',
};

// ─── CACHED OVERRIDE ─────────────────────────────────────────────────────────
//
// This override represents a local cache of an operator-issued promo.
// It has no expiry so it persists through the offline period.
// It wins over the schedule (level 3 > level 0).

export const CACHED_OVERRIDE: Override = {
  id:          'ovr-local-001',
  level:       3,
  content_ref: 'content://promo/anchor-local',
  expires_at:  null,
  operator_id: 'system-cache',
};

// ─── PRE INPUTS ───────────────────────────────────────────────────────────────

/** T0: Online, normal. Cached override active. */
export const INPUT_T0_ONLINE: PREInput = {
  resolution_id:      'res-disc-001',
  corpus_entry_id:    'res-disc-001',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T0,
  rule_version:       RULE_VERSION,
  override_stack:     [CACHED_OVERRIDE],
  schedule_block:     SCHEDULE,
  emergency_active:   false,
  emergency_scope:    null,
  device_state:       'ONLINE',
};

/** T1: DEGRADED. Override still cached. device_state=DEGRADED has no PRE effect. */
export const INPUT_T1_DEGRADED: PREInput = {
  resolution_id:      'res-disc-002',
  corpus_entry_id:    'res-disc-002',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T1,
  rule_version:       RULE_VERSION,
  override_stack:     [CACHED_OVERRIDE],
  schedule_block:     SCHEDULE,
  emergency_active:   false,
  emergency_scope:    null,
  device_state:       'DEGRADED',
};

/** T2: OFFLINE. device_state=OFFLINE has no PRE resolution effect. Same output as T0/T1. */
export const INPUT_T2_OFFLINE: PREInput = {
  resolution_id:      'res-disc-003',
  corpus_entry_id:    'res-disc-003',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T2,
  rule_version:       RULE_VERSION,
  override_stack:     [CACHED_OVERRIDE],
  schedule_block:     SCHEDULE,
  emergency_active:   false,
  emergency_scope:    null,
  device_state:       'OFFLINE',
};

/** T4: Back ONLINE. Reconciliation — same override still valid. */
export const INPUT_T4_RECONCILED: PREInput = {
  resolution_id:      'res-disc-004',
  corpus_entry_id:    'res-disc-004',
  scope_id:           VENUE_SCOPE,
  governed_timestamp: T4,
  rule_version:       RULE_VERSION,
  override_stack:     [CACHED_OVERRIDE],
  schedule_block:     SCHEDULE,
  emergency_active:   false,
  emergency_scope:    null,
  device_state:       'ONLINE',
};

// ─── EXPECTED OUTCOMES ────────────────────────────────────────────────────────
//
// All 4 resolutions produce the same content because:
//   - CACHED_OVERRIDE (level 3) wins over schedule (level 0) regardless of device_state
//   - The PRE engine is blind to device_state — this is the weakness

export const EXPECTED_ALL = {
  effective_content:    'content://promo/anchor-local',
  resolution_level:     3,
  resolution_winner_id: 'ovr-local-001',
};
