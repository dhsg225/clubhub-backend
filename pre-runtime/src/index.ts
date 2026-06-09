/**
 * PRE Runtime — public API
 *
 * System components:
 *   GovernedClock   — controlled time source (must be set before any governed operation)
 *   resolve         — PRE execution engine (deterministic, pure core)
 *   Corpus          — hash-chained corpus store
 *   TraceStore      — immutable append-only trace
 *   replayEntry     — single-entry replay
 *   replayAll       — batch replay
 *   verify          — divergence detection
 *   verifyDeterminism — N-run determinism check
 *   createXxxMachine — 6 state machine factories
 */

export { GovernedClock } from './governed-clock';
export { resolve, _resolve } from './pre-engine';
export { canonicalJSON } from './canonical-json';
export { sha256, hashObject } from './hash';
export { TraceStore } from './trace-store';
export { Corpus } from './corpus';
export { replayEntry, replayAll } from './replay-engine';
export { verify, verifyDeterminism } from './verification';
export { StateMachine } from './state-machine';
export {
  createPlayerMachine,
  createPREResolutionMachine,
  createOperatorSessionMachine,
  createIncidentMachine,
  createReplaySessionMachine,
  createUISurfaceMachine,
  PLAYER_CONFIG,
  PRE_RESOLUTION_CONFIG,
  OPERATOR_SESSION_CONFIG,
  INCIDENT_CONFIG,
  REPLAY_SESSION_CONFIG,
  UI_SURFACE_CONFIG,
} from './machines';

export type {
  PREInput,
  PREOutput,
  PREResult,
  PREFailure,
  PREFailureCode,
  PRETraceEvent,
  ResolutionStep,
  Override,
  ScheduleBlock,
  TransitionRequest,
  StateMutationEvent,
  StateSnapshot,
  CorpusEntry,
  VerificationResult,
  FailureClass,
  FieldDiff,
} from './types';

export type { StateMachineConfig, ForbiddenRule } from './state-machine';
export type { ReplayResult } from './replay-engine';
