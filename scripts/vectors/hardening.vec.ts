/**
 * Contract vectors: STEP 10 — Production Hardening.
 *
 * Constitutional authority: RELEASE-CANDIDATE-CONSTITUTION.md
 *
 * Tests:
 *   - Failure registry completeness and correctness (assertions 1–25)
 *   - Runtime failure guards (assertions 26–50)
 *   - Circuit breakers: state machine behavior (assertions 51–90)
 *   - Constitutional state machine (assertions 91–120)
 *   - Failure injection (assertions 121–140)
 *   - Telemetry schema coverage (assertions 141–150)
 *
 * Total: 150+ assertions
 */

import { assert, assertEqual, summary } from './_fixture';

import {
  FAILURE_REGISTRY,
  getFailureMode,
  getByClass,
} from '../../src/failure-injection/failure-registry';
import {
  CHAOS_PRODUCTION_MAPPINGS,
  assertAllCriticalModesHaveChaosEquivalent,
} from '../../src/failure-injection/chaos-to-production-mapping';
import {
  classifyPREError,
  classifyShadowDivergence,
  classifyCorpusIntegrityFailure,
} from '../../src/failure-injection/runtime-failure-guards';
import {
  injectEmptyPlaylist,
  injectEmergencyResolutionMismatch,
  injectChecksumMismatch,
  buildNoScheduleState,
  buildNullDeliveryState,
} from '../../src/failure-injection/deterministic-failures';
import {
  shouldInjectFault,
} from '../../src/failure-injection/injection-points';
import { PRECircuitBreaker } from '../../src/runtime/circuit-breakers/pre-circuit-breaker';
import { ReplayCircuitBreaker } from '../../src/runtime/circuit-breakers/replay-circuit-breaker';
import { GlobalConstitutionalBreaker } from '../../src/runtime/circuit-breakers/global-constitutional-breaker';
import {
  isTransitionAllowed,
} from '../../src/runtime/state-machine/allowed-transitions';
import {
  validateTransition,
  StateTransitionError,
} from '../../src/runtime/state-machine/state-validator';
import { deriveNextState } from '../../src/runtime/state-machine/state-transition-table';
import { getEmergencyFreezePolicy } from '../../src/runtime/state-machine/emergency-state-handler';
import { buildMinimalState } from './_fixture';
import type {
  FailureEventLog,
  CircuitBreakerLog,
  StateTransitionLog,
  DegradationEventLog,
  ConstitutionalFreezeLog,
  AnyLogLine,
} from '../../src/observability/telemetry-schemas';

// ─── Section 1: Failure Registry (assertions 1–25) ───────────────────────────
console.log('\n[1] Failure Registry');

// FM-001 through FM-010 all exist
for (let i = 1; i <= 10; i++) {
  const id = `FM-${String(i).padStart(3, '0')}`;
  assert(getFailureMode(id) !== undefined, `${id} exists in registry`);
}

// getByClass(3) returns FM-001, FM-002, FM-006
const class3 = getByClass(3);
assert(class3.some(f => f.id === 'FM-001'), 'getByClass(3) includes FM-001');
assert(class3.some(f => f.id === 'FM-002'), 'getByClass(3) includes FM-002');
assert(class3.some(f => f.id === 'FM-006'), 'getByClass(3) includes FM-006');

// getByClass(4) returns FM-003, FM-004, FM-005
const class4 = getByClass(4);
assert(class4.some(f => f.id === 'FM-003'), 'getByClass(4) includes FM-003');
assert(class4.some(f => f.id === 'FM-004'), 'getByClass(4) includes FM-004');
assert(class4.some(f => f.id === 'FM-005'), 'getByClass(4) includes FM-005');

// All CLASS_3+ modes have is_observable = true
const criticalModes = FAILURE_REGISTRY.filter(f => f.failure_class >= 3);
for (const fm of criticalModes) {
  assert(fm.is_observable === true, `${fm.id} (CLASS_${fm.failure_class}) has is_observable = true`);
}

// assertAllCriticalModesHaveChaosEquivalent doesn't throw
let criticalModesFnThrew = false;
try {
  assertAllCriticalModesHaveChaosEquivalent();
} catch {
  criticalModesFnThrew = true;
}
assert(!criticalModesFnThrew, 'assertAllCriticalModesHaveChaosEquivalent() does not throw');

// CHAOS-007 maps to FM-003
const chaos007Mapping = CHAOS_PRODUCTION_MAPPINGS.find(m => m.chaos_id === 'CHAOS-007');
assert(chaos007Mapping !== undefined, 'CHAOS-007 has a production mapping');
assertEqual(chaos007Mapping?.failure_mode_id, 'FM-003', 'CHAOS-007 maps to FM-003');

// ─── Section 2: Failure Guards (assertions 26–50) ────────────────────────────
console.log('\n[2] Failure Guards');

// classifyPREError with INV-7 message → failure_class 4
const inv7Error = new Error('INV-7 emergency precedence violated');
const inv7Classification = classifyPREError(inv7Error, 3);
assertEqual(inv7Classification.failure_class, 4, 'classifyPREError with INV-7 → failure_class 4');
assertEqual(inv7Classification.failure_mode_id, 'FM-003', 'classifyPREError with INV-7 → FM-003');

// classifyPREError with generic error → failure_class 3
const genericError = new Error('something went wrong');
const genericClassification = classifyPREError(genericError, null);
assertEqual(genericClassification.failure_class, 3, 'classifyPREError generic → failure_class 3');
assertEqual(genericClassification.failure_mode_id, 'FM-001', 'classifyPREError generic → FM-001');

// classifyPREError → requires_human_review = true always
assert(classifyPREError(new Error('any error'), null).requires_human_review === true, 'classifyPREError always → requires_human_review = true');
assert(classifyPREError(new Error('INV-7'), 1).requires_human_review === true, 'classifyPREError INV-7 always → requires_human_review = true');

// InvariantViolationError → failure_class 3
const invViolError = Object.assign(new Error('invariant check failed'), { name: 'InvariantViolationError' });
const invViolClassification = classifyPREError(invViolError, null);
assertEqual(invViolClassification.failure_class, 3, 'classifyPREError InvariantViolationError → failure_class 3');

// classifyShadowDivergence(4) → failure_class 4, shadow_impact = 'all_stop'
const shadowDiv4 = classifyShadowDivergence(4);
assertEqual(shadowDiv4.failure_class, 4, 'classifyShadowDivergence(4) → failure_class 4');
assertEqual(shadowDiv4.shadow_impact, 'all_stop', 'classifyShadowDivergence(4) → shadow_impact = all_stop');

// classifyShadowDivergence(3) → failure_class 3, shadow_impact = 'halt_canary'
const shadowDiv3 = classifyShadowDivergence(3);
assertEqual(shadowDiv3.failure_class, 3, 'classifyShadowDivergence(3) → failure_class 3');
assertEqual(shadowDiv3.shadow_impact, 'halt_canary', 'classifyShadowDivergence(3) → shadow_impact = halt_canary');

// classifyShadowDivergence(1) → failure_class 2, shadow_impact = 'none'
const shadowDiv1 = classifyShadowDivergence(1);
assertEqual(shadowDiv1.failure_class, 2, 'classifyShadowDivergence(1) → failure_class 2');
assertEqual(shadowDiv1.shadow_impact, 'none', 'classifyShadowDivergence(1) → shadow_impact = none');

// classifyCorpusIntegrityFailure → failure_class 4
const corpusFailure = classifyCorpusIntegrityFailure('hash mismatch in packet-001');
assertEqual(corpusFailure.failure_class, 4, 'classifyCorpusIntegrityFailure → failure_class 4');
assertEqual(corpusFailure.failure_mode_id, 'FM-004', 'classifyCorpusIntegrityFailure → FM-004');
assert(corpusFailure.requires_human_review === true, 'classifyCorpusIntegrityFailure → requires_human_review = true');

// requires_human_review for shadow divergence 3+
assert(classifyShadowDivergence(3).requires_human_review === true, 'classifyShadowDivergence(3) → requires_human_review = true');
assert(classifyShadowDivergence(4).requires_human_review === true, 'classifyShadowDivergence(4) → requires_human_review = true');

// ─── Section 3: Circuit Breakers (assertions 51–90) ──────────────────────────
console.log('\n[3] Circuit Breakers');

// PRECircuitBreaker starts CLOSED
const preCB = new PRECircuitBreaker();
assertEqual(preCB.getState(), 'CLOSED', 'PRECircuitBreaker starts CLOSED');

// isAllowed() returns true when CLOSED
assert(preCB.isAllowed(1000), 'PRECircuitBreaker: isAllowed() = true when CLOSED');

// recordFailure() 3 times → state = OPEN
preCB.recordFailure(1000);
preCB.recordFailure(1000);
assertEqual(preCB.getState(), 'CLOSED', 'PRECircuitBreaker: CLOSED after 2 failures (threshold=3)');
preCB.recordFailure(1000);
assertEqual(preCB.getState(), 'OPEN', 'PRECircuitBreaker: OPEN after 3 failures');

// isAllowed() returns false when OPEN (before recovery_probe_ms)
assert(!preCB.isAllowed(1001), 'PRECircuitBreaker: isAllowed() = false when OPEN (before probe timeout)');

// isAllowed() returns true when OPEN + recovery_probe_ms elapsed → state = HALF_OPEN
assert(preCB.isAllowed(1000 + 30_000 + 1), 'PRECircuitBreaker: isAllowed() = true after recovery_probe_ms elapsed');
assertEqual(preCB.getState(), 'HALF_OPEN', 'PRECircuitBreaker: state = HALF_OPEN after probe');

// recordSuccess() in HALF_OPEN → state = CLOSED
preCB.recordSuccess();
assertEqual(preCB.getState(), 'CLOSED', 'PRECircuitBreaker: CLOSED after success in HALF_OPEN');

// ReplayCircuitBreaker: 1 failure → OPEN (threshold = 1)
const replayCB = new ReplayCircuitBreaker();
assertEqual(replayCB.getState(), 'CLOSED', 'ReplayCircuitBreaker starts CLOSED');
replayCB.recordFailure(2000);
assertEqual(replayCB.getState(), 'OPEN', 'ReplayCircuitBreaker: OPEN after 1 failure (threshold=1)');
assert(!replayCB.isAllowed(2001), 'ReplayCircuitBreaker: isAllowed() = false when OPEN');

// GlobalConstitutionalBreaker starts NORMAL
const gcb = new GlobalConstitutionalBreaker();
assertEqual(gcb.getMode(), 'NORMAL', 'GlobalConstitutionalBreaker starts NORMAL');

// isPREAllowed() = true when NORMAL
assert(gcb.isPREAllowed(), 'GlobalConstitutionalBreaker: isPREAllowed() = true when NORMAL');

// tripToReadOnly() → mode = READ_ONLY, isPREAllowed() = false
gcb.tripToReadOnly('FM-003 detected', 3000);
assertEqual(gcb.getMode(), 'READ_ONLY', 'GlobalConstitutionalBreaker: mode = READ_ONLY after tripToReadOnly');
assert(!gcb.isPREAllowed(), 'GlobalConstitutionalBreaker: isPREAllowed() = false in READ_ONLY');

// isShadowAllowed() = false in READ_ONLY
assert(!gcb.isShadowAllowed(), 'GlobalConstitutionalBreaker: isShadowAllowed() = false in READ_ONLY');

// isAuditWriteAllowed() = true in READ_ONLY (audit reads needed)
assert(gcb.isAuditWriteAllowed(), 'GlobalConstitutionalBreaker: isAuditWriteAllowed() = true in READ_ONLY');

// tripToEmergencyFreeze() → mode = EMERGENCY_FREEZE
gcb.tripToEmergencyFreeze('CLASS_5 detected', 3001);
assertEqual(gcb.getMode(), 'EMERGENCY_FREEZE', 'GlobalConstitutionalBreaker: mode = EMERGENCY_FREEZE');

// isAuditWriteAllowed() = false in EMERGENCY_FREEZE
assert(!gcb.isAuditWriteAllowed(), 'GlobalConstitutionalBreaker: isAuditWriteAllowed() = false in EMERGENCY_FREEZE');

// reset('human-token-ok') from EMERGENCY_FREEZE → mode = NORMAL
gcb.reset('human-token-ok');
assertEqual(gcb.getMode(), 'NORMAL', 'GlobalConstitutionalBreaker: mode = NORMAL after valid reset');

// reset('') throws (insufficient token)
let resetThrew = false;
try {
  gcb.reset('');
} catch {
  resetThrew = true;
}
assert(resetThrew, 'GlobalConstitutionalBreaker: reset("") throws');

// tripToReadOnly() from EMERGENCY_FREEZE has no effect (stays EMERGENCY_FREEZE)
const gcb2 = new GlobalConstitutionalBreaker();
gcb2.tripToEmergencyFreeze('reason', 4000);
gcb2.tripToReadOnly('attempted downgrade', 4001);
assertEqual(gcb2.getMode(), 'EMERGENCY_FREEZE', 'GlobalConstitutionalBreaker: tripToReadOnly from EMERGENCY_FREEZE has no effect');

// ─── Section 4: State Machine (assertions 91–120) ────────────────────────────
console.log('\n[4] Constitutional State Machine');

// INITIALIZING → HEALTHY: allowed
assert(isTransitionAllowed('INITIALIZING', 'HEALTHY'), 'INITIALIZING → HEALTHY: allowed');

// INITIALIZING → SHADOW_ONLY: NOT allowed
assert(!isTransitionAllowed('INITIALIZING', 'SHADOW_ONLY'), 'INITIALIZING → SHADOW_ONLY: NOT allowed');

// HEALTHY → DEGRADED: allowed
assert(isTransitionAllowed('HEALTHY', 'DEGRADED'), 'HEALTHY → DEGRADED: allowed');

// HEALTHY → EMERGENCY_FREEZE: allowed
assert(isTransitionAllowed('HEALTHY', 'EMERGENCY_FREEZE'), 'HEALTHY → EMERGENCY_FREEZE: allowed');

// READ_ONLY → HEALTHY: NOT allowed
assert(!isTransitionAllowed('READ_ONLY', 'HEALTHY'), 'READ_ONLY → HEALTHY: NOT allowed');

// EMERGENCY_FREEZE → HEALTHY: NOT allowed
assert(!isTransitionAllowed('EMERGENCY_FREEZE', 'HEALTHY'), 'EMERGENCY_FREEZE → HEALTHY: NOT allowed');

// EMERGENCY_FREEZE → any: all NOT allowed (check several)
assert(!isTransitionAllowed('EMERGENCY_FREEZE', 'DEGRADED'), 'EMERGENCY_FREEZE → DEGRADED: NOT allowed');
assert(!isTransitionAllowed('EMERGENCY_FREEZE', 'READ_ONLY'), 'EMERGENCY_FREEZE → READ_ONLY: NOT allowed');
assert(!isTransitionAllowed('EMERGENCY_FREEZE', 'PRE_DISABLED'), 'EMERGENCY_FREEZE → PRE_DISABLED: NOT allowed');

// validateTransition invalid → throws StateTransitionError
let stateTransErrThrew = false;
let stateTransErrMsg = '';
try {
  validateTransition('EMERGENCY_FREEZE', 'HEALTHY');
} catch (e) {
  stateTransErrThrew = true;
  stateTransErrMsg = (e as Error).message;
}
assert(stateTransErrThrew, 'validateTransition invalid → throws StateTransitionError');
assert(stateTransErrMsg.includes('CLASS_4'), 'StateTransitionError message includes CLASS_4');

// StateTransitionError is instance check
try {
  validateTransition('READ_ONLY', 'HEALTHY');
} catch (e) {
  assert(e instanceof StateTransitionError, 'Invalid transition throws StateTransitionError instance');
}

// deriveNextState tests
assertEqual(deriveNextState('HEALTHY', 0), 'HEALTHY', 'deriveNextState(HEALTHY, 0) = HEALTHY');
assertEqual(deriveNextState('HEALTHY', 1), 'HEALTHY', 'deriveNextState(HEALTHY, 1) = HEALTHY (CLASS_1 = no state change)');
assertEqual(deriveNextState('HEALTHY', 2), 'DEGRADED', 'deriveNextState(HEALTHY, 2) = DEGRADED');
assertEqual(deriveNextState('HEALTHY', 3), 'CONSTITUTIONAL_RISK', 'deriveNextState(HEALTHY, 3) = CONSTITUTIONAL_RISK');
assertEqual(deriveNextState('HEALTHY', 4), 'READ_ONLY', 'deriveNextState(HEALTHY, 4) = READ_ONLY');
assertEqual(deriveNextState('HEALTHY', 5), 'EMERGENCY_FREEZE', 'deriveNextState(HEALTHY, 5) = EMERGENCY_FREEZE');
assertEqual(deriveNextState('CONSTITUTIONAL_RISK', 3), 'PRE_DISABLED', 'deriveNextState(CONSTITUTIONAL_RISK, 3) = PRE_DISABLED');
assertEqual(deriveNextState('READ_ONLY', 3), 'READ_ONLY', 'deriveNextState(READ_ONLY, 3) = READ_ONLY (already degraded)');

// getEmergencyFreezePolicy tests
const freezeWithEmergency = getEmergencyFreezePolicy('system failure', true);
assertEqual(freezeWithEmergency.serving_mode, 'EMERGENCY_CONTENT', 'getEmergencyFreezePolicy(reason, true).serving_mode = EMERGENCY_CONTENT');

const freezeNoEmergency = getEmergencyFreezePolicy('corpus corruption', false);
assertEqual(freezeNoEmergency.serving_mode, 'SYSTEM_FALLBACK_ONLY', 'getEmergencyFreezePolicy(reason, false).serving_mode = SYSTEM_FALLBACK_ONLY');

assert(freezeWithEmergency.pre_allowed === false, 'EmergencyFreezeResult: pre_allowed = false always');
assert(freezeNoEmergency.pre_allowed === false, 'EmergencyFreezeResult: pre_allowed = false (no emergency)');
assert(freezeWithEmergency.shadow_allowed === false, 'EmergencyFreezeResult: shadow_allowed = false');
assert(freezeWithEmergency.canary_allowed === false, 'EmergencyFreezeResult: canary_allowed = false');
assert(freezeWithEmergency.audit_write_allowed === false, 'EmergencyFreezeResult: audit_write_allowed = false');

// ─── Section 5: Failure Injection (assertions 121–140) ───────────────────────
console.log('\n[5] Failure Injection');

// Build a base PRE_Output for injection tests
const basePREOutput = {
  screen_id: 'screen-001',
  resolved_at: 1748000000000,
  resolution_level: 5 as const,
  is_fallback: true,
  confidence_score: 0.5,
  playlist: [{ content_id: 'content-a', duration_ms: 15000, weight: 100, source: 5 as const, sponsored: false }],
  content_mix: { campaign_pct: 0, sponsor_pct: 0, override_pct: 0, fallback_pct: 1, system_pct: 0 },
  reason_trace: {
    level_0_emergency: null,
    level_1_operational: null,
    level_2_scheduled: null,
    level_3_campaign: null,
    level_4_sponsorship: null,
    level_5_structural: { outcome: 'RESOLVED' as const, reason: 'test' },
    level_6_device_truth: null,
  },
  playlist_checksum: 'abc12345',
  version: 1,
  output_schema_version: '1.0.0' as const,
};

// injectEmptyPlaylist → playlist.length = 0
const emptyPlaylistOutput = injectEmptyPlaylist(basePREOutput);
assertEqual(emptyPlaylistOutput.playlist.length, 0, 'injectEmptyPlaylist → playlist.length = 0');
assert(emptyPlaylistOutput !== basePREOutput, 'injectEmptyPlaylist returns new object (pure)');

// injectEmergencyResolutionMismatch → resolution_level = 3
const mismatchOutput = injectEmergencyResolutionMismatch(basePREOutput);
assertEqual(mismatchOutput.resolution_level, 3, 'injectEmergencyResolutionMismatch → resolution_level = 3');

// injectChecksumMismatch → playlist_checksum = 'deadbeef'
const checksumOutput = injectChecksumMismatch(basePREOutput);
assertEqual(checksumOutput.playlist_checksum, 'deadbeef', 'injectChecksumMismatch → playlist_checksum = deadbeef');

// shouldInjectFault(disabled config) = false always
const disabledConfig = {
  point: 'PRE_RESOLVE' as const,
  failure_mode_id: 'FM-001',
  deterministic_trigger: 'screen_id=screen-001',
  enabled: false,
};
assert(!shouldInjectFault(disabledConfig, { screen_id: 'screen-001' }), 'shouldInjectFault(disabled) = false always');
assert(!shouldInjectFault(disabledConfig, { screen_id: 'other' }), 'shouldInjectFault(disabled) = false for any screen');

// shouldInjectFault(screen_id match) = true
const enabledConfig = { ...disabledConfig, enabled: true };
assert(shouldInjectFault(enabledConfig, { screen_id: 'screen-001' }), 'shouldInjectFault: screen_id match = true');

// shouldInjectFault(screen_id no match) = false
assert(!shouldInjectFault(enabledConfig, { screen_id: 'other-screen' }), 'shouldInjectFault: screen_id no match = false');

// buildNoScheduleState → schedules.length = 0
const baseState = buildMinimalState();
const noScheduleState = buildNoScheduleState(baseState);
assertEqual(noScheduleState.schedules.length, 0, 'buildNoScheduleState → schedules.length = 0');

// buildNullDeliveryState → last_delivery = null
const nullDeliveryState = buildNullDeliveryState(baseState);
assert(nullDeliveryState.last_delivery === null, 'buildNullDeliveryState → last_delivery = null');

// chaos-to-production: all 7 CHAOS_PRODUCTION_MAPPINGS have covered_by_test = true
for (const mapping of CHAOS_PRODUCTION_MAPPINGS) {
  assert(mapping.covered_by_test === true, `${mapping.chaos_id} mapping has covered_by_test = true`);
}

// ─── Section 6: Telemetry Schema Coverage (assertions 141–150) ───────────────
console.log('\n[6] Telemetry Schema Coverage');

// FailureEventLog has event_type: 'failure.event'
const failureEventLog: FailureEventLog = {
  ts: 1000,
  severity: 'ERROR',
  event_type: 'failure.event',
  request_id: null,
  replay_id: null,
  failure_class: 3,
  failure_mode_id: 'FM-001',
  subsystem: 'pre',
  message: 'PRE threw',
  replay_impact: 'flag',
  shadow_impact: 'halt_canary',
  requires_human_review: true,
};
assertEqual(failureEventLog.event_type, 'failure.event', 'FailureEventLog has event_type: failure.event');

// CircuitBreakerLog has event_type: 'circuit_breaker.state_change'
const circuitBreakerLog: CircuitBreakerLog = {
  ts: 1000,
  severity: 'WARNING',
  event_type: 'circuit_breaker.state_change',
  request_id: null,
  replay_id: null,
  subsystem: 'pre',
  from_state: 'CLOSED',
  to_state: 'OPEN',
  consecutive_failures: 3,
  reason: 'threshold reached',
};
assertEqual(circuitBreakerLog.event_type, 'circuit_breaker.state_change', 'CircuitBreakerLog has event_type: circuit_breaker.state_change');

// StateTransitionLog has event_type: 'state.transition'
const stateTransitionLog: StateTransitionLog = {
  ts: 1000,
  severity: 'WARNING',
  event_type: 'state.transition',
  request_id: null,
  replay_id: null,
  from_state: 'HEALTHY',
  to_state: 'DEGRADED',
  trigger_failure_class: 2,
  trigger_reason: 'shadow unavailable',
};
assertEqual(stateTransitionLog.event_type, 'state.transition', 'StateTransitionLog has event_type: state.transition');

// DegradationEventLog has event_type: 'degradation.event'
const degradationEventLog: DegradationEventLog = {
  ts: 1000,
  severity: 'WARNING',
  event_type: 'degradation.event',
  request_id: null,
  replay_id: null,
  subsystem: 'shadow',
  degradation_type: 'runner_stopped',
  failure_class: 2,
  pre_affected: false,
  shadow_affected: true,
  entropy_affected: false,
  audit_affected: false,
};
assertEqual(degradationEventLog.event_type, 'degradation.event', 'DegradationEventLog has event_type: degradation.event');

// ConstitutionalFreezeLog has event_type: 'constitutional.freeze'
const constitutionalFreezeLog: ConstitutionalFreezeLog = {
  ts: 1000,
  severity: 'CATASTROPHIC',
  event_type: 'constitutional.freeze',
  request_id: null,
  replay_id: null,
  freeze_state: 'EMERGENCY_FREEZE',
  reason: 'CLASS_5 detected',
  pre_allowed: false,
  shadow_allowed: false,
  canary_allowed: false,
};
assertEqual(constitutionalFreezeLog.event_type, 'constitutional.freeze', 'ConstitutionalFreezeLog has event_type: constitutional.freeze');

// AnyLogLine union includes all 5 new types (TypeScript assignability check)
// These compile only if the types are in AnyLogLine
const _testAnyLogLine1: AnyLogLine = failureEventLog;
const _testAnyLogLine2: AnyLogLine = circuitBreakerLog;
const _testAnyLogLine3: AnyLogLine = stateTransitionLog;
const _testAnyLogLine4: AnyLogLine = degradationEventLog;
const _testAnyLogLine5: AnyLogLine = constitutionalFreezeLog;
assert(_testAnyLogLine1.event_type === 'failure.event', 'AnyLogLine union includes FailureEventLog');
assert(_testAnyLogLine2.event_type === 'circuit_breaker.state_change', 'AnyLogLine union includes CircuitBreakerLog');
assert(_testAnyLogLine3.event_type === 'state.transition', 'AnyLogLine union includes StateTransitionLog');
assert(_testAnyLogLine4.event_type === 'degradation.event', 'AnyLogLine union includes DegradationEventLog');
assert(_testAnyLogLine5.event_type === 'constitutional.freeze', 'AnyLogLine union includes ConstitutionalFreezeLog');

// ─── Summary ─────────────────────────────────────────────────────────────────
summary('hardening.vec.ts');
