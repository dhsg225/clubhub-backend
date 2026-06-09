/**
 * @clubhub/constitutional-types
 *
 * Constitutional system type definitions.
 * Zero runtime dependencies — types and enums only.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md
 */

export const FAILURE_CLASSES = {
  CLASS_0: 0, // normal
  CLASS_1: 1, // tolerated
  CLASS_2: 2, // warning
  CLASS_3: 3, // constitutional — blocks deploy
  CLASS_4: 4, // catastrophic — all-stop
  CLASS_5: 5, // system halt
} as const;

export type FailureClass = (typeof FAILURE_CLASSES)[keyof typeof FAILURE_CLASSES];

export const CONSTITUTIONAL_STATES = {
  INITIALIZING: 'INITIALIZING',
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  CONSTITUTIONAL_RISK: 'CONSTITUTIONAL_RISK',
  SHADOW_ONLY: 'SHADOW_ONLY',
  PRE_DISABLED: 'PRE_DISABLED',
  READ_ONLY: 'READ_ONLY',
  EMERGENCY_FREEZE: 'EMERGENCY_FREEZE',
} as const;

export type ConstitutionalState =
  (typeof CONSTITUTIONAL_STATES)[keyof typeof CONSTITUTIONAL_STATES];

export const CANARY_STAGES = {
  SHADOW_ONLY: 'SHADOW_ONLY',
  INTERNAL_CANARY: 'INTERNAL_CANARY',
  SINGLE_VENUE: 'SINGLE_VENUE',
  MULTI_VENUE: 'MULTI_VENUE',
  FLEET_WIDE: 'FLEET_WIDE',
  AUTHORITATIVE: 'AUTHORITATIVE',
} as const;

export type CanaryStage = (typeof CANARY_STAGES)[keyof typeof CANARY_STAGES];

export const CANARY_STAGE_ORDER: readonly CanaryStage[] = [
  CANARY_STAGES.SHADOW_ONLY,
  CANARY_STAGES.INTERNAL_CANARY,
  CANARY_STAGES.SINGLE_VENUE,
  CANARY_STAGES.MULTI_VENUE,
  CANARY_STAGES.FLEET_WIDE,
  CANARY_STAGES.AUTHORITATIVE,
] as const;

export type DivergenceClass = 0 | 1 | 2 | 3 | 4;

/** Base telemetry log line — all log types extend this */
export interface BaseLogLine {
  readonly ts: number;
  readonly severity: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  readonly event_type: string;
  readonly request_id: string | null;
  readonly replay_id: string | null;
}
