'use strict';
/**
 * agent-runtime/index.js
 *
 * Factory + exports for the Agent Runtime.
 * createAgentRuntime(deps) is the primary entry point.
 */

const { AgentRuntime }                                     = require('./runtime');
const { AgentStateMachine, AGENT_STATES, VALID_TRANSITIONS } = require('./state-machine');
const { DeterministicContext }                             = require('./deterministic-context');
const { WorkflowExecutor }                                 = require('./executor');
const { DeterministicScheduler }                           = require('./scheduler');

/**
 * createAgentRuntime(deps)
 *
 * deps shape:
 *   { sdkClient, kernelClock, eventBus, replayHooks, seed? }
 */
function createAgentRuntime(deps) {
  return new AgentRuntime(deps);
}

module.exports = {
  createAgentRuntime,
  AgentRuntime,
  AgentStateMachine,
  AGENT_STATES,
  VALID_TRANSITIONS,
  DeterministicContext,
  WorkflowExecutor,
  DeterministicScheduler,
};
