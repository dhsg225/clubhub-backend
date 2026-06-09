/**
 * State Authority Registry — canonical governed state domains for ClubHub TV.
 *
 * Every governed domain declares:
 *   allowed_mutators        — which components may issue mutations
 *   allowed_transition_paths — legal (from, to) state pairs
 *   replayable              — mutations can be replayed deterministically
 *   persistent              — mutations write to durable storage
 *
 * Exported:
 *   STATE_DOMAINS           — full domain registry
 *   VALID_TRANSITIONS       — O(1) lookup set: 'domain:FROM->TO'
 *   MUTATION_OPERATIONS     — canonical operation names
 *   assertLegalTransition() — throws IllegalTransitionError on violation
 */

export const STATE_DOMAINS = Object.freeze({
  rollout: {
    allowed_mutators:          ['runner'],
    allowed_transition_paths:  [
      ['PENDING',     'RING_1'],
      ['RING_1',      'RING_2'],
      ['RING_2',      'RING_3'],
      ['RING_3',      'COMPLETE'],
      ['RING_1',      'ROLLED_BACK'],
      ['RING_2',      'ROLLED_BACK'],
      ['RING_3',      'ROLLED_BACK'],
    ],
    replayable:  true,
    persistent:  true,
  },

  screen: {
    allowed_mutators:          ['fleet', 'chaos', 'metrics'],
    allowed_transition_paths:  [
      ['UNKNOWN',    'ACTIVE'],
      ['ACTIVE',     'OFFLINE'],
      ['OFFLINE',    'RECOVERING'],
      ['RECOVERING', 'ACTIVE'],
      ['ACTIVE',     'REBOOTING'],
      ['REBOOTING',  'RECOVERING'],
    ],
    replayable:  true,
    persistent:  false,
  },

  manifest: {
    allowed_mutators:          ['chaos', 'suite'],
    allowed_transition_paths:  [
      ['EMPTY',     'POPULATED'],
      ['POPULATED', 'CHANGED'],
      ['POPULATED', 'CLEARED'],
      ['CHANGED',   'CHANGED'],
      ['CHANGED',   'CLEARED'],
      ['CLEARED',   'POPULATED'],
    ],
    replayable:  true,
    persistent:  false,
  },

  chaos: {
    allowed_mutators:          ['chaos', 'suite'],
    allowed_transition_paths:  [
      ['IDLE',       'INJECTING'],
      ['INJECTING',  'RECOVERING'],
      ['RECOVERING', 'IDLE'],
    ],
    replayable:  true,
    persistent:  false,
  },

  suite: {
    allowed_mutators:          ['runner'],
    allowed_transition_paths:  [
      ['PENDING', 'RUNNING'],
      ['RUNNING', 'PASSED'],
      ['RUNNING', 'FAILED'],
      ['RUNNING', 'SKIPPED'],
    ],
    replayable:  true,
    persistent:  false,
  },

  metrics: {
    allowed_mutators:          ['metrics', 'fleet', 'runner'],
    allowed_transition_paths:  [
      ['CLEAN',       'COLLECTING'],
      ['COLLECTING',  'COLLECTING'],
      ['COLLECTING',  'BREACHED'],
      ['BREACHED',    'COLLECTING'],
      ['COLLECTING',  'FINALIZED'],
      ['BREACHED',    'FINALIZED'],
    ],
    replayable:  true,
    persistent:  false,
  },

  replay: {
    allowed_mutators:          ['runner'],
    allowed_transition_paths:  [
      ['IDLE',       'LOADING'],
      ['LOADING',    'READY'],
      ['READY',      'REPLAYING'],
      ['REPLAYING',  'VALIDATING'],
      ['VALIDATING', 'PASSED'],
      ['VALIDATING', 'FAILED'],
    ],
    replayable:  false,  // replay domain itself is not re-replayable
    persistent:  false,
  },

  recovery: {
    allowed_mutators:          ['recovery-governor'],
    allowed_transition_paths:  [
      ['IDLE',      'STARTED'],
      ['STARTED',   'COMPLETED'],
      ['STARTED',   'FAILED'],
      ['FAILED',    'STARTED'],    // retry
      ['STARTED',   'ESCALATED'],
      ['FAILED',    'ESCALATED'],
    ],
    replayable:  true,
    persistent:  false,
  },
});

// O(1) lookup set for transition legality. Key: 'domain:FROM->TO'
export const VALID_TRANSITIONS = new Set();
for (const [domain, def] of Object.entries(STATE_DOMAINS)) {
  for (const [from, to] of def.allowed_transition_paths) {
    VALID_TRANSITIONS.add(`${domain}:${from}->${to}`);
  }
}

export const MUTATION_OPERATIONS = Object.freeze({
  TRANSITION: 'TRANSITION',  // Governed state-machine transition
  SET_STATE:  'SET_STATE',   // Initial or reset state assignment
  APPEND:     'APPEND',      // Append to a governed collection
  CLEAR:      'CLEAR',       // Clear a governed collection
  SNAPSHOT:   'SNAPSHOT',    // Point-in-time capture
  ROLLBACK:   'ROLLBACK',    // Revert to previous state
});

export class IllegalTransitionError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name    = 'IllegalTransitionError';
    this.domain  = context.domain  ?? null;
    this.from    = context.from    ?? null;
    this.to      = context.to      ?? null;
  }
}

/**
 * Assert that a state transition is legal in the given domain.
 * Throws IllegalTransitionError immediately on violation.
 *
 * @param {string} domain  Domain key (must exist in STATE_DOMAINS)
 * @param {string} from    Current state label
 * @param {string} to      Target state label
 */
export function assertLegalTransition(domain, from, to) {
  if (!STATE_DOMAINS[domain]) {
    throw new IllegalTransitionError(
      `Unknown governed domain: '${domain}'`,
      { domain, from, to }
    );
  }
  if (from === to) return; // self-transition always legal (idempotent)
  const key = `${domain}:${from}->${to}`;
  if (!VALID_TRANSITIONS.has(key)) {
    throw new IllegalTransitionError(
      `Illegal transition in domain '${domain}': ${from} → ${to}`,
      { domain, from, to }
    );
  }
}
