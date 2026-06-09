/**
 * emergency-override-fixture.ts
 *
 * Canonical, reusable fixture for the Emergency Content Override scenario.
 *
 * ALL values are deterministic. No randomness. No wall clock.
 * Timestamps are fixed ISO8601 UTC strings.
 * IDs are stable, human-readable strings — no UUIDs.
 *
 * This fixture is the single source of truth for:
 *   - What inputs are canonical for this scenario
 *   - What timestamps are authoritative
 *   - What the authority chain looks like
 *   - What output semantics are expected
 *
 * Expected output HASHES are not encoded here because they are derived
 * deterministically from inputs by the PRE engine. The test suite verifies
 * the actual engine output matches these semantic expectations.
 */

import type { PREInput, Override, ScheduleBlock } from '../src/index';

// ─── CANONICAL TIMESTAMPS ────────────────────────────────────────────────────

/**
 * T0: Normal operation time. Schedule is active. No emergency.
 * Player is LIVE. PRE resolves to scheduled sports content.
 */
export const T0_NORMAL = '2026-05-30T10:00:00.000Z';

/**
 * T1: Emergency time. Incident declared. Operator elevates session.
 * PRE resolves to EMERGENCY_CONTENT, overriding all scheduled content.
 */
export const T1_EMERGENCY = '2026-05-30T10:05:00.000Z';

/**
 * T2: Post-emergency time (used for expiry comparisons).
 * Overrides placed at T1 that expire at T2 should be expired at T2.
 */
export const T2_POST_EMERGENCY = '2026-05-30T10:10:00.000Z';

// ─── CANONICAL IDENTITIES ─────────────────────────────────────────────────────

export const VENUE_SCOPE_ID = 'venue://the-anchor-manchester';
export const OPERATOR_ID = 'op-001-anchor-manager';
export const RULE_VERSION = '1.0.0';
export const INCIDENT_SOURCE_ID = 'monitor://safety-system';

// Resolution IDs are stable strings, not random UUIDs
export const NORMAL_RESOLUTION_ID = 'res-normal-001';
export const EMERGENCY_RESOLUTION_ID = 'res-emergency-001';

// ─── AUTHORITY CHAIN ─────────────────────────────────────────────────────────
//
// Describes who took what action at what time.
// This is the auditable trail from normal → emergency state.

export const AUTHORITY_CHAIN = Object.freeze([
  {
    step: 1,
    actor: 'system',
    authority: 'BACKEND' as const,
    action: 'Player startup — INITIALIZING → SYNCING → LIVE',
    timestamp: T0_NORMAL,
  },
  {
    step: 2,
    actor: 'system',
    authority: 'BACKEND' as const,
    action: 'PRE resolves normal schedule content',
    timestamp: T0_NORMAL,
  },
  {
    step: 3,
    actor: INCIDENT_SOURCE_ID,
    authority: 'BACKEND' as const,
    action: 'Safety monitor detects anomaly — incident WATCHING declared',
    timestamp: T1_EMERGENCY,
  },
  {
    step: 4,
    actor: OPERATOR_ID,
    authority: 'OPERATOR' as const,
    action: 'Operator declares emergency — incident DECLARED',
    timestamp: T1_EMERGENCY,
  },
  {
    step: 5,
    actor: OPERATOR_ID,
    authority: 'OPERATOR' as const,
    action: 'Operator session elevated to ELEVATED for emergency action',
    timestamp: T1_EMERGENCY,
  },
  {
    step: 6,
    actor: OPERATOR_ID,
    authority: 'OPERATOR' as const,
    action: 'PRE resolves emergency content — EMERGENCY_CONTENT takes effect',
    timestamp: T1_EMERGENCY,
  },
]);

// ─── CANONICAL SCHEDULE BLOCK ─────────────────────────────────────────────────

/**
 * Active schedule at T0: sports lounge main feed.
 * Runs 09:00–11:00 on 2026-05-30. Active during T0, still active at T1
 * but suppressed by emergency activation.
 */
export const NORMAL_SCHEDULE_BLOCK: ScheduleBlock = Object.freeze({
  content_ref: 'content://schedule/sports-lounge-main',
  starts_at: '2026-05-30T09:00:00.000Z',
  ends_at: '2026-05-30T11:00:00.000Z',
});

// ─── CANONICAL INPUTS ────────────────────────────────────────────────────────

/**
 * Normal operation input at T0.
 *
 * - No emergency active
 * - Schedule block is active (T0 is between starts_at and ends_at)
 * - No overrides in stack
 * - Expected winner: schedule → content://schedule/sports-lounge-main at level 0
 */
export const NORMAL_INPUT: PREInput = Object.freeze({
  resolution_id: NORMAL_RESOLUTION_ID,
  scope_id: VENUE_SCOPE_ID,
  governed_timestamp: T0_NORMAL,
  rule_version: RULE_VERSION,
  override_stack: [],
  schedule_block: NORMAL_SCHEDULE_BLOCK,
  emergency_active: false,
  emergency_scope: null,
  device_state: 'ONLINE' as const,
  corpus_entry_id: NORMAL_RESOLUTION_ID, // pre-assigned for corpus alignment
});

/**
 * Emergency operation input at T1.
 *
 * - emergency_active: true
 * - emergency_scope: venue-specific (not fleet-wide)
 * - Override stack still empty — emergency takes precedence at engine level 6
 * - Expected winner: EMERGENCY → EMERGENCY_CONTENT at level 6
 *
 * Per PRE engine: when emergency_active=true and scope matches, the engine
 * immediately returns EMERGENCY_CONTENT without evaluating the override stack.
 */
export const EMERGENCY_INPUT: PREInput = Object.freeze({
  resolution_id: EMERGENCY_RESOLUTION_ID,
  scope_id: VENUE_SCOPE_ID,
  governed_timestamp: T1_EMERGENCY,
  rule_version: RULE_VERSION,
  override_stack: [],
  schedule_block: NORMAL_SCHEDULE_BLOCK, // schedule still present but suppressed by emergency
  emergency_active: true,
  emergency_scope: VENUE_SCOPE_ID,       // venue-scoped emergency
  device_state: 'ONLINE' as const,
  corpus_entry_id: EMERGENCY_RESOLUTION_ID, // pre-assigned for corpus alignment
});

// ─── CANONICAL EXPECTED SEMANTICS ────────────────────────────────────────────
//
// These are semantic assertions — what the output SHOULD contain.
// The test suite verifies these against actual engine output.
// Hashes are not pre-encoded here; the engine computes them deterministically.

export const EXPECTED_NORMAL = Object.freeze({
  effective_content: 'content://schedule/sports-lounge-main',
  resolution_level: 0,
  resolution_winner_id: null as string | null,
  resolution_path_length: 1,
  resolution_path_first_step: {
    evaluated: 'schedule',
    result: 'WIN' as const,
    reason: 'SCHEDULE_ACTIVE',
  },
});

export const EXPECTED_EMERGENCY = Object.freeze({
  effective_content: 'EMERGENCY_CONTENT',
  resolution_level: 6,
  resolution_winner_id: 'EMERGENCY',
  resolution_path_length: 1,
  resolution_path_first_step: {
    evaluated: 'emergency',
    result: 'WIN' as const,
    reason: 'EMERGENCY_ACTIVE',
  },
});

// ─── MACHINE TRANSITION SCRIPTS ──────────────────────────────────────────────
//
// Canonical sequence of machine transitions for this scenario.
// Each entry is a tuple: [machineKey, toState, authority, sourceId, reason, timestamp]

export type MachineKey = 'player' | 'pre-resolution' | 'incident' | 'operator-session';

export interface TransitionScript {
  readonly machineKey: MachineKey;
  readonly toState: string;
  readonly authority: 'OPERATOR' | 'BACKEND' | 'RECOVERY' | 'SCHEDULED';
  readonly sourceId: string;
  readonly reason: string;
  readonly governedTimestamp: string;
}

export const TRANSITION_SCRIPT: readonly TransitionScript[] = Object.freeze([
  // T0: Player starts up
  { machineKey: 'player', toState: 'SYNCING',        authority: 'BACKEND',   sourceId: 'system',            reason: 'System startup',               governedTimestamp: T0_NORMAL    },
  { machineKey: 'player', toState: 'LIVE',            authority: 'BACKEND',   sourceId: 'system',            reason: 'Sync complete, PRE resolved',   governedTimestamp: T0_NORMAL    },

  // T0: PRE resolution machine starts normal resolution
  { machineKey: 'pre-resolution', toState: 'RESOLVING', authority: 'BACKEND', sourceId: 'pre-resolver',     reason: 'Normal content resolution',     governedTimestamp: T0_NORMAL    },
  { machineKey: 'pre-resolution', toState: 'RESOLVED',  authority: 'BACKEND', sourceId: 'pre-resolver',     reason: 'Normal resolution complete',    governedTimestamp: T0_NORMAL    },

  // T1: Incident declared
  { machineKey: 'incident', toState: 'WATCHING',      authority: 'BACKEND',   sourceId: INCIDENT_SOURCE_ID,  reason: 'Safety anomaly detected',       governedTimestamp: T1_EMERGENCY },
  { machineKey: 'incident', toState: 'DECLARED',      authority: 'OPERATOR',  sourceId: OPERATOR_ID,         reason: 'Operator declares emergency',   governedTimestamp: T1_EMERGENCY },

  // T1: Player enters INCIDENT mode
  { machineKey: 'player',  toState: 'INCIDENT',       authority: 'BACKEND',   sourceId: 'system',            reason: 'Incident declared',             governedTimestamp: T1_EMERGENCY },

  // T1: Operator session elevation
  { machineKey: 'operator-session', toState: 'AUTHENTICATING', authority: 'OPERATOR', sourceId: OPERATOR_ID, reason: 'Emergency login',              governedTimestamp: T1_EMERGENCY },
  { machineKey: 'operator-session', toState: 'AUTHENTICATED',  authority: 'OPERATOR', sourceId: OPERATOR_ID, reason: 'Auth credentials accepted',    governedTimestamp: T1_EMERGENCY },
  { machineKey: 'operator-session', toState: 'ELEVATED',       authority: 'OPERATOR', sourceId: OPERATOR_ID, reason: 'Emergency session elevation',  governedTimestamp: T1_EMERGENCY },

  // T1: PRE resolution machine cycles for emergency resolution
  { machineKey: 'pre-resolution', toState: 'RESOLVING', authority: 'OPERATOR', sourceId: OPERATOR_ID,        reason: 'Emergency override resolution', governedTimestamp: T1_EMERGENCY },
  { machineKey: 'pre-resolution', toState: 'RESOLVED',  authority: 'OPERATOR', sourceId: OPERATOR_ID,        reason: 'Emergency resolution complete', governedTimestamp: T1_EMERGENCY },
]);
