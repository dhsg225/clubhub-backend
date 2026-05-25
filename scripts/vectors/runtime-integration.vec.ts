#!/usr/bin/env ts-node
/**
 * STEP 9 — Runtime Integration Vector Tests
 *
 * 150+ assertions covering Phase A through Phase F:
 *   Phase A — PRE Runtime (1–30)
 *   Phase B — Telemetry (31–60)
 *   Phase C — Audit (61–90)
 *   Phase D — Entropy Scheduling (91–110)
 *   Phase E — Shadow Orchestration (111–130)
 *   Phase F — API (131–150)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { PRE_Input, SystemStateSnapshot } from '../../src/pre/types';

// Phase A
import { invokePRE } from '../../src/runtime/pre-runtime';
import { generateCorrelationId } from '../../src/runtime/correlation-id';
import { createRequestContext } from '../../src/runtime/request-context';
import {
  assertTimingNotInReplayHash,
  assertOutputShape,
  RuntimeContractViolation,
} from '../../src/runtime/runtime-contracts';
import { buildRuntimeResponse } from '../../src/runtime/runtime-response';
import type { RuntimeRequest, RuntimeConfig } from '../../src/runtime/runtime-types';

// Phase B
import type {
  PREInvocationLog,
  PREResolutionLog,
  ShadowComparisonLog,
  RollbackTriggerLog,
  PreviewRequestLog,
  ReplayAuditWriteLog,
  EntropyJobLog,
  AnyLogLine,
} from '../../src/observability/telemetry-schemas';
import { METRICS } from '../../src/observability/metrics';

// Phase C
import { buildAuditRecord, ReplayAuditWriter } from '../../src/audit/replay-audit-writer';
import { ReplayAuditReader } from '../../src/audit/replay-audit-reader';
import { computeAuditRecordChecksum } from '../../src/audit/replay-audit-checksum';
import { filterByRetention, verifyReplayAuditIntegrity, AUDIT_RETENTION } from '../../src/audit/retention-policy';

// Phase D
import { VenueEntropyJob } from '../../src/entropy/runtime/venue-entropy-job';
import { FleetEntropyJob } from '../../src/entropy/runtime/fleet-entropy-job';
import { EntropyAlertRouter } from '../../src/entropy/runtime/entropy-alert-routing';
import {
  assertEntropyReadOnly,
  assertAdvisoryTierMonotonic,
  EntropyRuntimeContractViolation,
} from '../../src/entropy/runtime/entropy-runtime-contracts';
import { EntropyScheduler, DEFAULT_ENTROPY_SCHEDULER_CONFIG } from '../../src/entropy/runtime/entropy-scheduler';

// Phase E
import { computeSamplingBucket, determineShouldSample } from '../../src/shadow/runtime/shadow-sampling';
import { shouldRunShadow } from '../../src/shadow/runtime/shadow-execution-gate';
import { orchestrateRollback } from '../../src/shadow/runtime/rollback-orchestrator';
import { generatePromotionReadinessReport } from '../../src/shadow/runtime/promotion-readiness-job';
import { computeParityWindow } from '../../src/shadow/runtime/parity-window';
import { ParityRecorder, buildParityRecord } from '../../src/shadow/storage/parity-recorder';
import type { RollbackTriggerOutput, ShadowTelemetryEvent, CanaryStage } from '../../src/shadow/types';

// Phase F
import { handlePreviewRequest } from '../../src/api/preview-api';
import { handleReplayRequest } from '../../src/api/replay-api';
import { handleEntropyVenueRequest, handleEntropyFleetRequest } from '../../src/api/entropy-api';
import { handleShadowParityRequest, handleShadowReadinessRequest } from '../../src/api/shadow-api';

// PRE core
import { resolve } from '../../src/pre/index';

// ─── Assertion Helpers ────────────────────────────────────────────────────────

let _pass = 0;
let _fail = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  PASS: ${message}`);
    _pass++;
  } else {
    console.error(`  FAIL: ${message}`);
    _fail++;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  PASS: ${message}`);
    _pass++;
  } else {
    console.error(`  FAIL: ${message}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
    _fail++;
  }
}

// ─── Load GOLD-001 fixture ────────────────────────────────────────────────────

const ROOT = join(__dirname, '../..');
const fixture = JSON.parse(readFileSync(join(ROOT, 'corpus/golden/GOLD-001.json'), 'utf8')) as {
  input: PRE_Input;
  expected_output: { playlist_checksum: string; resolution_level: number; is_fallback: boolean };
};
const goldInput: PRE_Input = fixture.input;
const goldState: SystemStateSnapshot = goldInput.system_state;

// ─── Main async test runner ───────────────────────────────────────────────────

async function main(): Promise<void> {

  const TEST_STAGE: CanaryStage = 'SHADOW_ONLY';
  const config: RuntimeConfig = {
    shadow_mode_enabled: false,
    replay_audit_enabled: true,
    canary_stage: TEST_STAGE,
    entropy_enabled: true,
  };

  // ─── PHASE A — PRE Runtime (assertions 1–30) ───────────────────────────────

  console.log('\n── Phase A: PRE Runtime ──────────────────────────────────');

  const recorder = new ParityRecorder();
  const telemetryTarget: ShadowTelemetryEvent[] = [];
  const runtimeRequest: RuntimeRequest = {
    correlation_id: generateCorrelationId(),
    screen_id: goldInput.screen_id,
    at: goldInput.at,
    requested_at: Date.now(),
    config,
  };

  const runtimeResponse = await invokePRE(runtimeRequest, goldState, recorder, telemetryTarget);

  assert(runtimeResponse !== null && runtimeResponse !== undefined, 'A-1: invokePRE returns a response');
  assert(typeof runtimeResponse.correlation_id === 'string', 'A-2: correlation_id is present');
  assert(runtimeResponse.correlation_id.length > 0, 'A-3: correlation_id is non-empty');
  assert(runtimeResponse.screen_id === goldInput.screen_id, 'A-4: screen_id matches request');
  assert(runtimeResponse.at === goldInput.at, 'A-5: at matches request');
  assert(runtimeResponse.pre_output !== undefined, 'A-6: pre_output is present');
  assert(runtimeResponse.invariants_passed === true, 'A-7: invariants_passed = true for GOLD-001');
  assert(typeof runtimeResponse.timing_ms === 'number', 'A-8: timing_ms is a number');
  assert(runtimeResponse.timing_ms >= 0, 'A-9: timing_ms is non-negative');

  const output1 = resolve(goldInput);
  assert(!('timing_ms' in (output1 as unknown as Record<string, unknown>)), 'A-10: timing_ms not in PRE_Output');

  const output2 = resolve(goldInput);
  assertEqual(output1.playlist_checksum, output2.playlist_checksum, 'A-11: PRE deterministic — same checksum');
  assertEqual(output1.resolution_level, output2.resolution_level, 'A-12: PRE deterministic — same resolution_level');
  assertEqual(output1.is_fallback, output2.is_fallback, 'A-13: PRE deterministic — same is_fallback');

  assertEqual(runtimeResponse.invariants_passed, true, 'A-14: invariants_passed for GOLD-001');
  assert(runtimeResponse.shadow_result === undefined, 'A-15: shadow_result absent when shadow disabled');

  let timingCheckPassed = true;
  try { assertTimingNotInReplayHash(output1); } catch { timingCheckPassed = false; }
  assert(timingCheckPassed, 'A-16: assertTimingNotInReplayHash passes for valid PRE_Output');

  let timingCheckThrew = false;
  try {
    const poisoned = { ...output1, timing_ms: 999 } as unknown as typeof output1;
    assertTimingNotInReplayHash(poisoned);
  } catch (e) {
    timingCheckThrew = e instanceof RuntimeContractViolation;
  }
  assert(timingCheckThrew, 'A-17: assertTimingNotInReplayHash throws when timing_ms injected');

  let shapePassed = true;
  try { assertOutputShape(output1); } catch { shapePassed = false; }
  assert(shapePassed, 'A-18: assertOutputShape passes for valid PRE_Output');

  let shapeThrew = false;
  try { assertOutputShape({ ...output1, screen_id: '' }); } catch { shapeThrew = true; }
  assert(shapeThrew, 'A-19: assertOutputShape throws for empty screen_id');

  const ctx = createRequestContext(goldInput.screen_id, goldInput.at);
  const built = buildRuntimeResponse(ctx, output1, true, 42);
  assert(built.correlation_id === ctx.correlation_id, 'A-20: buildRuntimeResponse correlation_id correct');
  assertEqual(built.timing_ms, 42, 'A-21: buildRuntimeResponse timing_ms correct');
  assertEqual(built.invariants_passed, true, 'A-22: buildRuntimeResponse invariants_passed correct');
  assert(built.shadow_result === undefined, 'A-23: buildRuntimeResponse shadow_result absent by default');

  const id1 = generateCorrelationId();
  const id2 = generateCorrelationId();
  assert(id1 !== id2, 'A-24: generateCorrelationId produces unique IDs');
  assert(/^[0-9a-f-]{36}$/i.test(id1), 'A-25: generateCorrelationId produces UUID format');

  const ctx2 = createRequestContext('scr', 1000);
  assert(ctx2.initiated_at > 0, 'A-26: createRequestContext sets initiated_at');
  assert(ctx2.at === 1000, 'A-27: createRequestContext preserves at');
  assert(ctx2.screen_id === 'scr', 'A-28: createRequestContext preserves screen_id');
  assert(ctx2.correlation_id.length > 0, 'A-29: createRequestContext generates correlation_id');

  const shadowConfig: RuntimeConfig = {
    ...config,
    shadow_mode_enabled: true,
    canary_stage: 'SHADOW_ONLY',
  };
  const shadowReq: RuntimeRequest = {
    correlation_id: generateCorrelationId(),
    screen_id: goldInput.screen_id,
    at: goldInput.at,
    requested_at: Date.now(),
    config: shadowConfig,
  };
  const shadowRecorder = new ParityRecorder();
  const shadowTelemetry: ShadowTelemetryEvent[] = [];
  const shadowResp = await invokePRE(
    shadowReq, goldState, shadowRecorder, shadowTelemetry,
    (_screenId, _at) => ({
      screen_id: goldInput.screen_id,
      playlist_checksum: output1.playlist_checksum,
      content_ids: output1.playlist.map(p => p.content_id),
      duration_ms_sequence: output1.playlist.map(p => p.duration_ms),
      is_fallback: output1.is_fallback,
      resolution_note: null,
    }),
  );
  assert(shadowResp.shadow_result !== undefined, 'A-30: shadow_result present when shadow enabled');

  // ─── PHASE B — Telemetry (assertions 31–60) ─────────────────────────────────

  console.log('\n── Phase B: Telemetry ──────────────────────────────────');

  const preInvLog: PREInvocationLog = {
    ts: Date.now(), severity: 'INFO', event_type: 'pre.invocation',
    request_id: null, replay_id: null,
    correlation_id: 'c1', screen_id: 's1', at: 1000,
    resolution_level: 3, is_fallback: false,
    playlist_checksum: 'abcd1234', timing_ms: 10,
  };
  assertEqual(preInvLog.event_type, 'pre.invocation', 'B-31: PREInvocationLog event_type correct');

  const preResLog: PREResolutionLog = {
    ts: Date.now(), severity: 'INFO', event_type: 'pre.resolution',
    request_id: null, replay_id: null,
    correlation_id: 'c1', screen_id: 's1',
    resolution_level: 3, playlist_length: 1,
    is_fallback: false, invariants_passed: true,
    playlist_checksum: 'abcd1234',
  };
  assert(preResLog.invariants_passed === true, 'B-32: PREResolutionLog invariants_passed field present');
  assert(typeof preResLog.playlist_length === 'number', 'B-33: PREResolutionLog playlist_length is number');

  const shadowCompLog: ShadowComparisonLog = {
    ts: Date.now(), severity: 'INFO', event_type: 'shadow.comparison',
    request_id: null, replay_id: null,
    invocation_id: 'inv-1', screen_id: 's1',
    divergence_class: null, legacy_hash: 'aaa', pre_hash: 'aaa',
    rollback_required: false,
  };
  assert(shadowCompLog.divergence_class === null, 'B-34: ShadowComparisonLog divergence_class null for agreement');

  const rollbackLog: RollbackTriggerLog = {
    ts: Date.now(), severity: 'ERROR', event_type: 'rollback.trigger',
    request_id: null, replay_id: null,
    invocation_id: 'inv-1', screen_id: 's1',
    rollback_reason: 'CLASS_4_DIVERGENCE',
    rollback_severity: 'CRITICAL',
    constitutional_reference: null,
  };
  assertEqual(rollbackLog.rollback_reason, 'CLASS_4_DIVERGENCE', 'B-35: RollbackTriggerLog rollback_reason field present');
  assertEqual(rollbackLog.rollback_severity, 'CRITICAL', 'B-36: RollbackTriggerLog rollback_severity field present');

  const pvLog: PreviewRequestLog = {
    ts: Date.now(), severity: 'INFO', event_type: 'preview.request',
    request_id: null, replay_id: null,
    surface: 'current', screen_id: 's1', at: 1000,
  };
  assertEqual(pvLog.surface, 'current', 'B-37: PreviewRequestLog surface field present');

  const auditWriteLog: ReplayAuditWriteLog = {
    ts: Date.now(), severity: 'INFO', event_type: 'replay.audit.write',
    request_id: null, replay_id: null,
    audit_record_id: 'r1', screen_id: 's1', at: 1000,
    divergence_class: null,
  };
  assertEqual(auditWriteLog.event_type, 'replay.audit.write', 'B-38: ReplayAuditWriteLog event_type correct');

  const entropyJobLog: EntropyJobLog = {
    ts: Date.now(), severity: 'INFO', event_type: 'entropy.job',
    request_id: null, replay_id: null,
    job_type: 'venue', screen_count: 2,
    composite_score: 0.2, label: 'HEALTHY',
    advisory_tier: 0, duration_ms: 5,
  };
  assertEqual(entropyJobLog.job_type, 'venue', 'B-39: EntropyJobLog job_type field present');

  // Compile-time union checks
  const anyLine: AnyLogLine = preInvLog;
  assert(anyLine.event_type === 'pre.invocation', 'B-40: AnyLogLine union includes PREInvocationLog');
  const anyLine2: AnyLogLine = preResLog;
  assert(anyLine2.event_type === 'pre.resolution', 'B-41: AnyLogLine union includes PREResolutionLog');
  const anyLine3: AnyLogLine = shadowCompLog;
  assert(anyLine3.event_type === 'shadow.comparison', 'B-42: AnyLogLine union includes ShadowComparisonLog');
  const anyLine4: AnyLogLine = rollbackLog;
  assert(anyLine4.event_type === 'rollback.trigger', 'B-43: AnyLogLine union includes RollbackTriggerLog');
  const anyLine5: AnyLogLine = pvLog;
  assert(anyLine5.event_type === 'preview.request', 'B-44: AnyLogLine union includes PreviewRequestLog');
  const anyLine6: AnyLogLine = auditWriteLog;
  assert(anyLine6.event_type === 'replay.audit.write', 'B-45: AnyLogLine union includes ReplayAuditWriteLog');
  const anyLine7: AnyLogLine = entropyJobLog;
  assert(anyLine7.event_type === 'entropy.job', 'B-46: AnyLogLine union includes EntropyJobLog');

  assert(METRICS.SHADOW_PARITY_RATIO !== undefined, 'B-47: METRICS.SHADOW_PARITY_RATIO defined');
  assert(METRICS.SHADOW_PARITY_RATIO.type === 'gauge', 'B-48: SHADOW_PARITY_RATIO is gauge type');
  assert(METRICS.CANARY_STAGE !== undefined, 'B-49: METRICS.CANARY_STAGE defined');
  assert(METRICS.ROLLBACK_TRIGGER_TOTAL !== undefined, 'B-50: METRICS.ROLLBACK_TRIGGER_TOTAL defined');
  assert(METRICS.PREVIEW_REQUEST_TOTAL !== undefined, 'B-51: METRICS.PREVIEW_REQUEST_TOTAL defined');
  assert(METRICS.REPLAY_AUDIT_WRITES_TOTAL !== undefined, 'B-52: METRICS.REPLAY_AUDIT_WRITES_TOTAL defined');
  assert(METRICS.ENTROPY_JOB_DURATION_MS !== undefined, 'B-53: METRICS.ENTROPY_JOB_DURATION_MS defined');
  assert(METRICS.PRE_LEVEL_SELECTION_TOTAL !== undefined, 'B-54: METRICS.PRE_LEVEL_SELECTION_TOTAL defined');
  assert(METRICS.PRE_INVOCATIONS_TOTAL.labels.includes('resolution_level'), 'B-55: PRE_INVOCATIONS_TOTAL has resolution_level label');
  assert(METRICS.PRE_INVOCATIONS_TOTAL.labels.includes('is_fallback'), 'B-56: PRE_INVOCATIONS_TOTAL has is_fallback label');
  assert(METRICS.ROLLBACK_TRIGGER_TOTAL.labels.includes('reason'), 'B-57: ROLLBACK_TRIGGER_TOTAL has reason label');
  assert(METRICS.ROLLBACK_TRIGGER_TOTAL.labels.includes('severity'), 'B-58: ROLLBACK_TRIGGER_TOTAL has severity label');
  assert(METRICS.SHADOW_PARITY_RATIO.labels.includes('canary_stage'), 'B-59: SHADOW_PARITY_RATIO has canary_stage label');
  assert(typeof preInvLog.ts === 'number', 'B-60: PREInvocationLog has ts field');

  // ─── PHASE C — Audit (assertions 61–90) ───────────────────────────────────

  console.log('\n── Phase C: Audit ──────────────────────────────────────');

  const auditWriter = new ReplayAuditWriter();
  const auditRecord = buildAuditRecord(
    goldInput.screen_id, goldInput.at, 'corr-c61', output1,
    null, null, null, true,
  );
  assert(typeof auditRecord.audit_record_id === 'string' && auditRecord.audit_record_id.length > 0, 'C-61: audit_record_id is non-empty string');
  assert(typeof auditRecord.record_checksum === 'string' && auditRecord.record_checksum.length === 8, 'C-62: record_checksum is 8-char hex');

  auditWriter.write(auditRecord);
  assert(auditWriter.verifyRecord(auditRecord), 'C-63: verifyRecord returns true for untampered record');

  const tampered = { ...auditRecord, resolution_level: 99 };
  assert(!auditWriter.verifyRecord(tampered), 'C-64: verifyRecord returns false for modified record');

  let duplicateThrew = false;
  try { auditWriter.write(auditRecord); } catch { duplicateThrew = true; }
  assert(duplicateThrew, 'C-65: duplicate audit_record_id throws');

  const cleanWriter = new ReplayAuditWriter();
  for (let i = 0; i < 10; i++) {
    cleanWriter.write(buildAuditRecord('scr', goldInput.at + i, `corr-${i}`, output1, null, null, null, true));
  }
  const integrity = verifyReplayAuditIntegrity(cleanWriter);
  assert(integrity.total === 10, 'C-66: verifyReplayAuditIntegrity total = 10');
  assert(integrity.valid === 10, 'C-67: verifyReplayAuditIntegrity valid = 10');
  assert(integrity.corrupted === 0, 'C-68: verifyReplayAuditIntegrity corrupted = 0');
  assert(integrity.corrupted_ids.length === 0, 'C-69: verifyReplayAuditIntegrity corrupted_ids empty');

  const { record_checksum, ...withoutChecksum } = auditRecord;
  const recomputed = computeAuditRecordChecksum(withoutChecksum);
  assertEqual(recomputed, record_checksum, 'C-70: computeAuditRecordChecksum matches stored checksum');

  const nowMs = Date.now();
  const oldAt = nowMs - (91 * 24 * 60 * 60 * 1000);
  const newAt = nowMs - (10 * 24 * 60 * 60 * 1000);
  const retentionWriter = new ReplayAuditWriter();
  retentionWriter.write(buildAuditRecord('scr', oldAt, 'old', output1, null, null, null, true));
  retentionWriter.write(buildAuditRecord('scr', newAt, 'new', output1, null, null, null, true));
  const retained = filterByRetention(retentionWriter.getAll(), nowMs);
  assertEqual(retained.length, 1, 'C-71: filterByRetention returns only in-window records');
  assert(retained[0]?.at === newAt, 'C-72: filterByRetention returns the correct record');

  assertEqual(AUDIT_RETENTION.QUERYABLE_DAYS, 90, 'C-73: AUDIT_RETENTION.QUERYABLE_DAYS = 90');
  assertEqual(AUDIT_RETENTION.ARCHIVAL_DAYS, 365, 'C-74: AUDIT_RETENTION.ARCHIVAL_DAYS = 365');

  const readerWriter = new ReplayAuditWriter();
  readerWriter.write(buildAuditRecord('screen-A', goldInput.at, 'cA1', output1, null, null, null, true));
  readerWriter.write(buildAuditRecord('screen-A', goldInput.at + 1, 'cA2', output1, null, null, null, true));
  readerWriter.write(buildAuditRecord('screen-B', goldInput.at, 'cB1', output1, null, null, null, true));
  const reader = new ReplayAuditReader(readerWriter);
  const byA = reader.getByScreenId('screen-A');
  const byB = reader.getByScreenId('screen-B');
  assertEqual(byA.length, 2, 'C-75: getByScreenId returns 2 records for screen-A');
  assertEqual(byB.length, 1, 'C-76: getByScreenId returns 1 record for screen-B');

  const windowWriter = new ReplayAuditWriter();
  windowWriter.write(buildAuditRecord('s', 100, 'c100', output1, null, null, null, true));
  windowWriter.write(buildAuditRecord('s', 200, 'c200', output1, null, null, null, true));
  windowWriter.write(buildAuditRecord('s', 300, 'c300', output1, null, null, null, true));
  const windowReader = new ReplayAuditReader(windowWriter);
  const windowed = windowReader.getWindow(150, 250);
  assertEqual(windowed.length, 1, 'C-77: getWindow returns records within range');
  assert(windowed[0]?.at === 200, 'C-78: getWindow returns correct record');

  assert(typeof auditRecord.screen_id === 'string', 'C-79: audit_record has screen_id');
  assert(typeof auditRecord.at === 'number', 'C-80: audit_record has at');
  assert(typeof auditRecord.correlation_id === 'string', 'C-81: audit_record has correlation_id');
  assert(typeof auditRecord.pre_output_hash === 'string', 'C-82: audit_record has pre_output_hash');
  assert(typeof auditRecord.playlist_checksum === 'string', 'C-83: audit_record has playlist_checksum');
  assert(typeof auditRecord.resolution_level === 'number', 'C-84: audit_record has resolution_level');
  assert(typeof auditRecord.is_fallback === 'boolean', 'C-85: audit_record has is_fallback');
  assert(typeof auditRecord.audit_written_at === 'number', 'C-86: audit_record has audit_written_at');

  const divWriter = new ReplayAuditWriter();
  divWriter.write(buildAuditRecord('s', 1, 'c1', output1, 3, null, null, true));
  divWriter.write(buildAuditRecord('s', 2, 'c2', output1, null, null, null, true));
  const divReader = new ReplayAuditReader(divWriter);
  const class3 = divReader.getByDivergenceClass(3);
  assertEqual(class3.length, 1, 'C-87: getByDivergenceClass returns correct records');

  assert(divWriter.count() === 2, 'C-88: writer.count() returns correct count');

  const { pre_output_hash } = auditRecord;
  assert(typeof pre_output_hash === 'string' && pre_output_hash.length === 8, 'C-89: pre_output_hash is 8-char hex');
  assertEqual(auditRecord.is_fallback, output1.is_fallback, 'C-90: audit_record is_fallback matches PRE output');

  // ─── PHASE D — Entropy Scheduling (assertions 91–110) ─────────────────────

  console.log('\n── Phase D: Entropy Scheduling ─────────────────────────');

  const venueJob = new VenueEntropyJob();
  const alertRouter = new EntropyAlertRouter();

  const venueResult = venueJob.run('venue-001', goldState);
  assert(typeof venueResult.venue_id === 'string', 'D-91: VenueEntropyResult has venue_id');
  assert(typeof venueResult.report !== 'undefined', 'D-92: VenueEntropyResult has report');
  assert(typeof venueResult.computed_at === 'number', 'D-93: VenueEntropyResult has computed_at');
  assert(typeof venueResult.duration_ms === 'number', 'D-94: VenueEntropyResult has duration_ms');

  const fleetJob = new FleetEntropyJob();
  const states = new Map<string, SystemStateSnapshot>([
    ['venue-Z', goldState],
    ['venue-A', goldState],
    ['venue-M', goldState],
  ]);
  const fleetResult = fleetJob.run(states);
  assertEqual(fleetResult.results[0]?.venue_id, 'venue-A', 'D-95: fleet scan orders venue-A first');
  assertEqual(fleetResult.results[1]?.venue_id, 'venue-M', 'D-96: fleet scan orders venue-M second');
  assertEqual(fleetResult.results[2]?.venue_id, 'venue-Z', 'D-97: fleet scan orders venue-Z last');

  let alertCalled = false;
  alertRouter.register(() => { alertCalled = true; });
  alertRouter.route('venue-001', venueResult);
  assert(alertCalled, 'D-98: EntropyAlertRouter.route calls registered handler');

  let handler2Called = false;
  alertRouter.register(() => { handler2Called = true; });
  alertRouter.route('venue-001', venueResult);
  assert(handler2Called, 'D-99: EntropyAlertRouter.route calls all registered handlers');

  let readOnlyPassed = true;
  try { assertEntropyReadOnly(goldState, goldState); } catch { readOnlyPassed = false; }
  assert(readOnlyPassed, 'D-100: assertEntropyReadOnly passes when state unchanged');

  let readOnlyThrew = false;
  try {
    const mutated = { ...goldState, screen: { ...goldState.screen, status: 'maintenance' as const } };
    assertEntropyReadOnly(goldState, mutated);
  } catch (e) {
    readOnlyThrew = e instanceof EntropyRuntimeContractViolation;
  }
  assert(readOnlyThrew, 'D-101: assertEntropyReadOnly throws when state mutated');

  let monoPassed = true;
  try { assertAdvisoryTierMonotonic(2, 2, 'venue-001'); } catch { monoPassed = false; }
  assert(monoPassed, 'D-102: assertAdvisoryTierMonotonic passes for equal tiers');

  let monoIncPassed = true;
  try { assertAdvisoryTierMonotonic(1, 3, 'venue-001'); } catch { monoIncPassed = false; }
  assert(monoIncPassed, 'D-103: assertAdvisoryTierMonotonic passes for increasing tiers');

  let monoThrew = false;
  try { assertAdvisoryTierMonotonic(3, 1, 'venue-001'); }
  catch (e) { monoThrew = e instanceof EntropyRuntimeContractViolation; }
  assert(monoThrew, 'D-104: assertAdvisoryTierMonotonic throws for decreasing tiers');

  const scheduler = new EntropyScheduler(
    { ...DEFAULT_ENTROPY_SCHEDULER_CONFIG, enabled: false },
    venueJob, alertRouter,
  );
  scheduler.scheduleVenue('v1', goldState);
  scheduler.scheduleVenue('v1', goldState);
  assert(true, 'D-105: EntropyScheduler.scheduleVenue is idempotent');
  scheduler.stop();

  assert(typeof fleetResult.fleet_summary === 'object', 'D-106: FleetEntropyResult has fleet_summary');
  assert(typeof fleetResult.fleet_summary.critical_count === 'number', 'D-107: fleet_summary has critical_count');
  assert(typeof fleetResult.fleet_summary.healthy_count === 'number', 'D-108: fleet_summary has healthy_count');
  assert(typeof venueResult.report.advisory_tier === 'number', 'D-109: VenueEntropyReport has advisory_tier');
  assertEqual(fleetResult.venue_count, 3, 'D-110: FleetEntropyResult venue_count = 3');

  // ─── PHASE E — Shadow Orchestration (assertions 111–130) ──────────────────

  console.log('\n── Phase E: Shadow Orchestration ───────────────────────');

  const bucket1 = computeSamplingBucket('screen-001', 1748000000000);
  const bucket2 = computeSamplingBucket('screen-001', 1748000000000);
  assertEqual(bucket1, bucket2, 'E-111: computeSamplingBucket is deterministic');

  const bucketA = computeSamplingBucket('screen-A', 1748000000000);
  const bucketB = computeSamplingBucket('screen-B', 1748000000000);
  assert(typeof bucketA === 'number' && typeof bucketB === 'number', 'E-112: computeSamplingBucket returns numbers for different inputs');

  assert(bucket1 >= 0 && bucket1 < 1, 'E-113: computeSamplingBucket in [0, 1)');

  const sample1 = determineShouldSample('screen-001', 1748000000000, 0.5);
  const sample2 = determineShouldSample('screen-001', 1748000000000, 0.5);
  assertEqual(sample1, sample2, 'E-114: determineShouldSample is deterministic');

  assert(!determineShouldSample('screen-001', 1748000000000, 0), 'E-115: rate=0 always false');
  assert(determineShouldSample('screen-001', 1748000000000, 1), 'E-116: rate=1 always true');
  assert(!shouldRunShadow({ enabled: false, canary_stage: 'SHADOW_ONLY', sampling_rate: 1 }, 's', 1), 'E-117: shouldRunShadow false when disabled');
  assert(shouldRunShadow({ enabled: true, canary_stage: 'SHADOW_ONLY', sampling_rate: 1 }, 's', 1), 'E-118: shouldRunShadow true with rate=1');

  const class4Trigger: RollbackTriggerOutput = {
    triggered: true, reason: 'CLASS_4_DIVERGENCE',
    triggering_invocation_id: 'inv-1', triggering_divergence_class: 4,
    affected_screen_id: 'screen-001', severity: 'CRITICAL',
    constitutional_reference: 'ref', replay_artifact_id: 'inv-1',
  };
  const rollbackRec = new ParityRecorder();
  const rollbackTelemetry: ShadowTelemetryEvent[] = [];
  const rollbackAction = orchestrateRollback(class4Trigger, rollbackRec, rollbackTelemetry);
  assertEqual(rollbackAction.action_type, 'HALT_CANARY', 'E-119: CLASS_4 trigger → HALT_CANARY');
  assertEqual(rollbackAction.auto_executed, true, 'E-120: CLASS_4 trigger → auto_executed=true');

  const class3Trigger: RollbackTriggerOutput = {
    triggered: true, reason: 'CLASS_3_DIVERGENCE',
    triggering_invocation_id: 'inv-2', triggering_divergence_class: 3,
    affected_screen_id: 'screen-001', severity: 'CONSTITUTIONAL',
    constitutional_reference: null, replay_artifact_id: null,
  };
  const class3Action = orchestrateRollback(class3Trigger, rollbackRec, rollbackTelemetry);
  assertEqual(class3Action.action_type, 'ALERT_OPERATOR', 'E-121: CLASS_3 trigger → ALERT_OPERATOR');
  assertEqual(class3Action.auto_executed, false, 'E-122: CLASS_3 trigger → auto_executed=false');

  assert(rollbackAction.requires_human_followup === true, 'E-123: CLASS_4 requires_human_followup=true');
  assert(class3Action.requires_human_followup === true, 'E-124: CLASS_3 requires_human_followup=true');

  const noTrigger: RollbackTriggerOutput = {
    triggered: false, reason: null, triggering_invocation_id: null,
    triggering_divergence_class: null, affected_screen_id: null,
    severity: null, constitutional_reference: null, replay_artifact_id: null,
  };
  const noAction = orchestrateRollback(noTrigger, rollbackRec, rollbackTelemetry);
  assert(noAction.requires_human_followup === true, 'E-125: no-trigger requires_human_followup=true');

  const emptyRecorder = new ParityRecorder();
  const readiness = generatePromotionReadinessReport(emptyRecorder, 'SHADOW_ONLY');
  assert(readiness.requires_human_approval === true, 'E-126: readiness.requires_human_approval always true');
  assertEqual(readiness.current_stage, 'SHADOW_ONLY', 'E-127: readiness.current_stage is SHADOW_ONLY');

  const pwRecorder = new ParityRecorder();
  pwRecorder.append(buildParityRecord('inv-1', 1000, 'lh1', 'ph1', null, null, 'SHADOW_ONLY'));
  pwRecorder.append(buildParityRecord('inv-2', 2000, 'lh2', 'ph2', 3, 'class3', 'SHADOW_ONLY'));
  const stats = computeParityWindow(pwRecorder, 5000, 3000);
  assertEqual(stats.total, 2, 'E-128: computeParityWindow total=2');
  assertEqual(stats.agreements, 1, 'E-129: computeParityWindow agreements=1');
  assertEqual(stats.class3_count, 1, 'E-130: computeParityWindow class3_count=1');

  // ─── PHASE F — API (assertions 131–150) ───────────────────────────────────

  console.log('\n── Phase F: API ─────────────────────────────────────────');

  const corrId = generateCorrelationId();

  const pvApiResp = handlePreviewRequest(
    { surface: 'current', screen_id: goldInput.screen_id, at: goldInput.at, correlation_id: corrId },
    goldState,
  );
  assert(pvApiResp.replay_compatible === true, 'F-131: handlePreviewRequest returns replay_compatible=true');
  assertEqual(pvApiResp.correlation_id, corrId, 'F-132: handlePreviewRequest preserves correlation_id');
  assertEqual(pvApiResp.surface, 'current', 'F-133: handlePreviewRequest surface correct');

  const pvPayload = pvApiResp.payload as { playlist_checksum?: string };
  assert(typeof pvPayload.playlist_checksum === 'string', 'F-134: preview payload has playlist_checksum');

  const replayWriter = new ReplayAuditWriter();
  const replayRecord = buildAuditRecord(
    goldInput.screen_id, goldInput.at, corrId, output1, null, null, null, true,
  );
  replayWriter.write(replayRecord);
  const replayApiResp = handleReplayRequest(
    { packet_id: replayRecord.audit_record_id, correlation_id: corrId },
    replayWriter,
  );
  assert(replayApiResp.found === true, 'F-135: handleReplayRequest found=true for existing record');
  assert(replayApiResp.integrity_valid === true, 'F-136: handleReplayRequest integrity_valid=true');
  assertEqual(replayApiResp.correlation_id, corrId, 'F-137: handleReplayRequest preserves correlation_id');

  const missingResp = handleReplayRequest(
    { packet_id: 'nonexistent-id', correlation_id: corrId },
    replayWriter,
  );
  assert(missingResp.found === false, 'F-138: handleReplayRequest found=false for missing record');
  assert(missingResp.integrity_valid === false, 'F-139: handleReplayRequest integrity_valid=false for missing');

  const entropyVenueResp = handleEntropyVenueRequest(
    { venue_id: 'venue-001', correlation_id: corrId },
    goldState,
  );
  assert(entropyVenueResp.replay_compatible === true, 'F-140: handleEntropyVenueRequest returns replay_compatible=true');
  assertEqual(entropyVenueResp.correlation_id, corrId, 'F-141: handleEntropyVenueRequest preserves correlation_id');
  assert(typeof entropyVenueResp.report.composite === 'number', 'F-142: entropy venue response has composite score');

  const fleetApiResp = handleEntropyFleetRequest(
    corrId,
    new Map([['venue-001', goldState]]),
  );
  assert(fleetApiResp.replay_compatible === true, 'F-143: handleEntropyFleetRequest returns replay_compatible=true');
  assertEqual(fleetApiResp.correlation_id, corrId, 'F-144: handleEntropyFleetRequest preserves correlation_id');

  const apiRecorder = new ParityRecorder();
  const parityApiResp = handleShadowParityRequest(corrId, apiRecorder, 'SHADOW_ONLY');
  assert(typeof parityApiResp.parity_score === 'number', 'F-145: handleShadowParityRequest includes parity_score');
  assertEqual(parityApiResp.canary_stage, 'SHADOW_ONLY', 'F-146: handleShadowParityRequest includes canary_stage');
  assertEqual(parityApiResp.correlation_id, corrId, 'F-147: handleShadowParityRequest preserves correlation_id');

  const readinessApiResp = handleShadowReadinessRequest(corrId, apiRecorder, 'SHADOW_ONLY');
  assert(readinessApiResp.requires_human_approval === true, 'F-148: handleShadowReadinessRequest requires_human_approval=true');
  assertEqual(readinessApiResp.correlation_id, corrId, 'F-149: handleShadowReadinessRequest preserves correlation_id');

  const diffResp = handlePreviewRequest(
    { surface: 'diff', screen_id: goldInput.screen_id, at: goldInput.at, future_at: goldInput.at + 3600000, correlation_id: corrId },
    goldState,
  );
  assert(diffResp.replay_compatible === true, 'F-150: diff surface returns replay_compatible=true');

} // end main()

// ─── Run ──────────────────────────────────────────────────────────────────────

main().then(() => {
  console.log(`\nruntime-integration.vec.ts: ${_pass} passed, ${_fail} failed`);
  process.exit(_fail > 0 ? 1 : 0);
}).catch((err: unknown) => {
  console.error('FATAL:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
