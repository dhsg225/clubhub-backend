import { StateMachine, StateMachineConfig } from './state-machine';

/**
 * All 6 state machine configurations from EXECUTION-STATE-MODEL-v1.md.
 *
 * Each factory function returns a new StateMachine instance
 * configured with the legal transitions and explicit forbidden rules.
 */

// ─── PLAYER STATE MACHINE ────────────────────────────────────────────────────

export const PLAYER_CONFIG: StateMachineConfig = {
  id: 'player',
  initial: 'INITIALIZING',
  transitions: {
    INITIALIZING: ['SYNCING'],
    SYNCING: ['LIVE', 'DEGRADED'],
    LIVE: ['REPLAY', 'DEGRADED', 'INCIDENT', 'SUSPENDED'],
    REPLAY: ['SYNCING', 'SUSPENDED'],         // NOT LIVE — must pass through SYNCING
    DEGRADED: ['SYNCING', 'INCIDENT'],
    INCIDENT: ['LIVE', 'SUSPENDED'],
    SUSPENDED: ['SYNCING'],
    TERMINAL: ['INITIALIZING'],
    ANY: ['TERMINAL'],                         // any state → TERMINAL on unrecoverable failure
  },
  forbidden: [
    {
      from: 'REPLAY',
      to: 'LIVE',
      reason: 'REPLAY → LIVE is forbidden. Must pass through SYNCING for PRE re-authorization (R-07)',
    },
    {
      from: 'SYNCING',
      to: 'REPLAY',
      reason: 'Cannot enter REPLAY from SYNCING. Must be in LIVE first.',
    },
  ],
};

export function createPlayerMachine(): StateMachine {
  return new StateMachine(PLAYER_CONFIG);
}

// ─── PRE RESOLUTION STATE MACHINE ────────────────────────────────────────────

export const PRE_RESOLUTION_CONFIG: StateMachineConfig = {
  id: 'pre-resolution',
  initial: 'UNRESOLVED',
  transitions: {
    UNRESOLVED: ['RESOLVING'],
    RESOLVING: ['RESOLVED', 'FAILED'],
    RESOLVED: ['RESOLVING', 'STALE', 'REPLAY_BOUND'],
    STALE: ['RESOLVING'],
    FAILED: ['RESOLVING'],
    REPLAY_BOUND: ['RESOLVED'],
  },
  forbidden: [
    {
      from: 'STALE',
      to: 'RESOLVED',
      reason: 'STALE → RESOLVED is forbidden. Must pass through RESOLVING for re-authorization.',
    },
  ],
};

export function createPREResolutionMachine(): StateMachine {
  return new StateMachine(PRE_RESOLUTION_CONFIG);
}

// ─── OPERATOR SESSION STATE MACHINE ──────────────────────────────────────────

export const OPERATOR_SESSION_CONFIG: StateMachineConfig = {
  id: 'operator-session',
  initial: 'UNAUTHENTICATED',
  transitions: {
    UNAUTHENTICATED: ['AUTHENTICATING'],
    AUTHENTICATING: ['AUTHENTICATED', 'UNAUTHENTICATED'],
    AUTHENTICATED: ['ELEVATED', 'SESSION_EXPIRING', 'LOCKED'],
    ELEVATED: ['AUTHENTICATED'],
    SESSION_EXPIRING: ['AUTHENTICATED', 'EXPIRED'],
    EXPIRED: ['UNAUTHENTICATED'],
    LOCKED: ['AUTHENTICATING'],
  },
  forbidden: [],
};

export function createOperatorSessionMachine(): StateMachine {
  return new StateMachine(OPERATOR_SESSION_CONFIG);
}

// ─── INCIDENT STATE MACHINE ───────────────────────────────────────────────────

export const INCIDENT_CONFIG: StateMachineConfig = {
  id: 'incident',
  initial: 'NOMINAL',
  transitions: {
    NOMINAL: ['WATCHING'],
    WATCHING: ['DECLARED', 'NOMINAL'],
    DECLARED: ['CONTAINED', 'RESOLVING'],
    CONTAINED: ['RESOLVING'],
    RESOLVING: ['RESOLVED'],
    RESOLVED: ['POST_INCIDENT'],
    POST_INCIDENT: ['NOMINAL'],
  },
  forbidden: [
    {
      from: 'RESOLVING',
      to: 'NOMINAL',
      reason: 'RESOLVING → NOMINAL is forbidden. Must pass through RESOLVED and POST_INCIDENT.',
    },
    {
      from: 'DECLARED',
      to: 'NOMINAL',
      reason: 'DECLARED → NOMINAL is forbidden. Must follow the resolution path.',
    },
  ],
};

export function createIncidentMachine(): StateMachine {
  return new StateMachine(INCIDENT_CONFIG);
}

// ─── REPLAY SESSION STATE MACHINE ────────────────────────────────────────────

export const REPLAY_SESSION_CONFIG: StateMachineConfig = {
  id: 'replay-session',
  initial: 'IDLE',
  transitions: {
    IDLE: ['LOADING'],
    LOADING: ['READY', 'FAILED'],
    READY: ['PLAYING'],
    PLAYING: ['PAUSED', 'SCRUBBING', 'COMPLETE', 'FAILED'],
    PAUSED: ['PLAYING', 'SCRUBBING'],
    SCRUBBING: ['PAUSED'],
    COMPLETE: ['IDLE'],
    FAILED: ['IDLE'],
  },
  forbidden: [],
};

export function createReplaySessionMachine(): StateMachine {
  return new StateMachine(REPLAY_SESSION_CONFIG);
}

// ─── UI SURFACE STATE MACHINE ────────────────────────────────────────────────

export const UI_SURFACE_CONFIG: StateMachineConfig = {
  id: 'ui-surface',
  initial: 'LIVE',
  transitions: {
    LIVE: ['REPLAY', 'PREVIEW', 'STALE', 'DEGRADED', 'PENDING-INTERVENTION'],
    REPLAY: ['LIVE', 'PREVIEW'],
    PREVIEW: ['LIVE', 'PENDING-INTERVENTION'],
    STALE: ['SYNCHRONIZED', 'DEGRADED'],
    DEGRADED: ['LIVE', 'STALE'],
    'PENDING-INTERVENTION': ['LIVE'],
    SYNCHRONIZED: ['LIVE'],
    DIVERGENT: ['LIVE'],
  },
  forbidden: [
    {
      from: 'REPLAY',
      to: 'PENDING-INTERVENTION',
      reason: 'Replay actions must never affect live operational state (R-06).',
    },
    {
      from: 'STALE',
      to: 'PENDING-INTERVENTION',
      reason: 'Consequential actions blocked in STALE state (R-04). Synchronize first.',
    },
    {
      from: 'DIVERGENT',
      to: 'PENDING-INTERVENTION',
      reason: 'Operator must acknowledge divergence before acting (R-19).',
    },
  ],
};

export function createUISurfaceMachine(): StateMachine {
  return new StateMachine(UI_SURFACE_CONFIG);
}
