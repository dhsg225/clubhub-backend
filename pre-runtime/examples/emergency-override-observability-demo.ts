/**
 * emergency-override-observability-demo.ts
 *
 * Human-readable operational output for the Emergency Content Override scenario.
 *
 * A non-engineer watching this run should be able to understand:
 *   - What content was playing before the emergency
 *   - Who declared the emergency and when
 *   - What content replaced it
 *   - What the system verified after the fact
 *   - Whether the audit trail is intact
 *
 * This file has no assertions. It renders the scenario for human review.
 * It is intended for: operator training, incident reviews, deployment sign-off.
 */

import {
  GovernedClock,
  Corpus,
  TraceStore,
  replayEntry,
  verify,
  createPlayerMachine,
  createPREResolutionMachine,
  createIncidentMachine,
  createOperatorSessionMachine,
  PLAYER_CONFIG,
  PRE_RESOLUTION_CONFIG,
  INCIDENT_CONFIG,
  OPERATOR_SESSION_CONFIG,
} from '../src/index';

import {
  registerMachine,
  guardedResolve,
  guardedTransition,
  guardedCorpusAdd,
  _resetRegistry,
} from '../src/integration-guard-layer';

import { evaluateExecutionPermission } from '../src/execution-policy-orchestrator';

import {
  checkSystemIntegrity,
  type RegisteredMachineEntry,
} from '../src/system-integrity-checker';

import {
  NORMAL_INPUT,
  EMERGENCY_INPUT,
  T0_NORMAL,
  T1_EMERGENCY,
  AUTHORITY_CHAIN,
} from './emergency-override-fixture';

import type { PREOutput, CorpusEntry } from '../src/index';
import type { ReplayResult } from '../src/index';

// ─── DISPLAY HELPERS ─────────────────────────────────────────────────────────

const LINE = '─'.repeat(64);
const DLINE = '═'.repeat(64);

function header(title: string): void {
  console.log(`\n${DLINE}`);
  console.log(`  ${title}`);
  console.log(DLINE);
}

function section(title: string): void {
  console.log(`\n${LINE}`);
  console.log(`  ${title}`);
  console.log(LINE);
}

function field(label: string, value: string, indent = 2): void {
  const pad = ' '.repeat(indent);
  console.log(`${pad}${label.padEnd(28)} ${value}`);
}

function status(label: string, ok: boolean, detail?: string): void {
  const icon = ok ? '✓' : '✗';
  const suffix = detail ? `  (${detail})` : '';
  console.log(`  ${icon}  ${label}${suffix}`);
}

function renderResolutionPath(output: PREOutput): void {
  console.log(`\n  Decision path:`);
  for (const step of output.resolution_path) {
    const icon = step.result === 'WIN' ? '→' : step.result === 'EXPIRED' ? '⊘' : '·';
    console.log(`    ${icon}  Step ${step.step}: evaluated="${step.evaluated}" result=${step.result} reason=${step.reason}`);
  }
}

function renderOutput(label: string, output: PREOutput): void {
  section(label);
  field('Resolution ID:',    output.resolution_id);
  field('Scope:',            output.scope_id);
  field('Governed time:',    output.governed_timestamp);
  field('Effective content:', output.effective_content);
  field('Resolution level:', `${output.resolution_level} (${levelLabel(output.resolution_level)})`);
  field('Winner ID:',        output.resolution_winner_id ?? '(schedule default)');
  field('Trace ID:',         output.trace_id.slice(0, 24) + '...');
  field('Input hash:',       output.input_hash.slice(0, 24) + '...');
  field('Output hash:',      output.output_hash.slice(0, 24) + '...');
  renderResolutionPath(output);
}

function renderCorpusEntry(label: string, entry: CorpusEntry): void {
  section(label);
  field('Corpus entry ID:', entry.corpus_entry_id);
  field('Entry hash:',      entry.entry_hash.slice(0, 24) + '...');
  field('Prior hash:',      entry.prior_entry_hash ? entry.prior_entry_hash.slice(0, 24) + '...' : '(first in chain)');
  field('Chain position:',  entry.prior_entry_hash ? 'linked to prior entry' : 'chain head');
}

function renderReplayResult(label: string, entry: CorpusEntry, result: ReplayResult): void {
  section(label);
  field('Corpus entry ID:',     result.corpus_entry_id);
  field('Replay succeeded:',    result.replayed_output !== null ? 'YES' : 'NO');
  if (result.error) {
    field('Error:',             result.error);
    return;
  }
  field('Original hash:',       result.original_output.output_hash.slice(0, 24) + '...');
  field('Replayed hash:',       result.replayed_output!.output_hash.slice(0, 24) + '...');
  const matches = result.replayed_output!.output_hash === result.original_output.output_hash;
  field('Hash match:',          matches ? 'IDENTICAL ✓' : 'MISMATCH ✗');
  field('Effective content:',   result.replayed_output!.effective_content);
}

function levelLabel(level: number): string {
  const labels: Record<number, string> = {
    0: 'Schedule default',
    1: 'Owner baseline',
    2: 'Venue standard',
    3: 'Campaign',
    4: 'Sponsorship',
    5: 'Structural',
    6: 'EMERGENCY',
  };
  return labels[level] ?? 'unknown';
}

// ─── MAIN DEMO ────────────────────────────────────────────────────────────────

function runDemo(): void {
  // Clean state
  GovernedClock.reset();
  Corpus._reset();
  TraceStore._reset();
  _resetRegistry();

  header('EMERGENCY CONTENT OVERRIDE — OPERATIONAL DEMO');
  console.log('  This demo traces a real emergency scenario through the governed system.');
  console.log('  Every action is logged, every decision is hash-stamped, every replay is verified.\n');

  // ── AUTHORITY CHAIN ────────────────────────────────────────────────────────
  section('Authority Chain — Who Did What');
  for (const link of AUTHORITY_CHAIN) {
    console.log(`\n  Step ${link.step}:`);
    field('Actor:',     link.actor,     4);
    field('Authority:', link.authority, 4);
    field('Action:',    link.action,    4);
    field('Timestamp:', link.timestamp, 4);
  }

  // ── SETUP MACHINES ────────────────────────────────────────────────────────
  const playerMachine          = createPlayerMachine();
  const preMachine             = createPREResolutionMachine();
  const incidentMachine        = createIncidentMachine();
  const operatorSessionMachine = createOperatorSessionMachine();

  registerMachine(playerMachine);
  registerMachine(preMachine);
  registerMachine(incidentMachine);
  registerMachine(operatorSessionMachine);

  // ── NORMAL OPERATION ──────────────────────────────────────────────────────
  section('Phase 1 — Normal Operation (T0)');
  GovernedClock.set(T0_NORMAL);
  console.log(`  Clock set to: ${T0_NORMAL}`);
  console.log(`  Venue: ${NORMAL_INPUT.scope_id}`);

  guardedTransition(playerMachine, { toState: 'SYNCING',    authority: 'BACKEND', sourceId: 'system', reason: 'Startup',       governedTimestamp: T0_NORMAL });
  guardedTransition(playerMachine, { toState: 'LIVE',       authority: 'BACKEND', sourceId: 'system', reason: 'Sync complete', governedTimestamp: T0_NORMAL });
  console.log(`\n  Player state:  ${playerMachine.state}`);
  console.log(`  Incident:      ${incidentMachine.state}`);
  console.log(`  Session:       ${operatorSessionMachine.state}`);

  guardedTransition(preMachine, { toState: 'RESOLVING', authority: 'BACKEND', sourceId: 'pre-resolver', reason: 'Normal resolution', governedTimestamp: T0_NORMAL });

  const normalPermission = evaluateExecutionPermission({
    resolutionId: NORMAL_INPUT.resolution_id,
    scopeId: NORMAL_INPUT.scope_id,
    machineId: 'pre-resolution',
    input: NORMAL_INPUT,
    machine: preMachine,
    eligibleStates: ['RESOLVING'],
    knownPriorInputHash: null,
    knownPriorOutputHash: null,
  });

  console.log(`\n  Preflight check (${normalPermission.stageResults.length} stages):`);
  for (const s of normalPermission.stageResults) {
    status(`  Stage: ${s.stage}`, s.passed, s.reason ?? undefined);
  }
  console.log(`\n  Permission: ${normalPermission.granted ? 'GRANTED ✓' : 'DENIED ✗ — ' + normalPermission.denialReason}`);

  const normalR = guardedResolve(NORMAL_INPUT, 'pre-resolution');
  if (!normalR.ok) throw new Error(`Normal resolve failed (guard): ${normalR.failure.code}`);
  const _normalPRE = normalR.value;
  if (!_normalPRE.ok) throw new Error(`Normal resolve failed (PRE): ${_normalPRE.failure.failure_code}`);

  renderOutput('PRE Decision — Normal Content', _normalPRE.output);

  const normalTrace = TraceStore.findPREByTraceId(_normalPRE.output.trace_id)!;
  const normalCorpus = guardedCorpusAdd(NORMAL_INPUT, _normalPRE.output, normalTrace);
  if (!normalCorpus.ok) throw new Error(`Normal corpus add failed: ${normalCorpus.failure.code}`);

  renderCorpusEntry('Corpus Record — Normal Content', normalCorpus.value);

  guardedTransition(preMachine, { toState: 'RESOLVED', authority: 'BACKEND', sourceId: 'pre-resolver', reason: 'Normal complete', governedTimestamp: T0_NORMAL });

  // ── EMERGENCY DECLARED ────────────────────────────────────────────────────
  section('Phase 2 — Emergency Declared (T1)');
  GovernedClock.set(T1_EMERGENCY);
  console.log(`  Clock advanced to: ${T1_EMERGENCY}`);
  console.log(`  Elapsed since normal: ${(Date.parse(T1_EMERGENCY) - Date.parse(T0_NORMAL)) / 1000}s\n`);

  guardedTransition(incidentMachine,        { toState: 'WATCHING',       authority: 'BACKEND',  sourceId: 'monitor://safety-system', reason: 'Safety anomaly detected',    governedTimestamp: T1_EMERGENCY });
  guardedTransition(incidentMachine,        { toState: 'DECLARED',       authority: 'OPERATOR', sourceId: 'op-001-anchor-manager',   reason: 'Operator declares emergency', governedTimestamp: T1_EMERGENCY });
  guardedTransition(playerMachine,          { toState: 'INCIDENT',       authority: 'BACKEND',  sourceId: 'system',                  reason: 'Incident declared',           governedTimestamp: T1_EMERGENCY });
  guardedTransition(operatorSessionMachine, { toState: 'AUTHENTICATING', authority: 'OPERATOR', sourceId: 'op-001-anchor-manager',   reason: 'Emergency login',             governedTimestamp: T1_EMERGENCY });
  guardedTransition(operatorSessionMachine, { toState: 'AUTHENTICATED',  authority: 'OPERATOR', sourceId: 'op-001-anchor-manager',   reason: 'Credentials accepted',        governedTimestamp: T1_EMERGENCY });
  guardedTransition(operatorSessionMachine, { toState: 'ELEVATED',       authority: 'OPERATOR', sourceId: 'op-001-anchor-manager',   reason: 'Emergency elevation granted', governedTimestamp: T1_EMERGENCY });

  console.log(`  Player state:   ${playerMachine.state}`);
  console.log(`  Incident state: ${incidentMachine.state}`);
  console.log(`  Session state:  ${operatorSessionMachine.state}`);

  // ── EMERGENCY RESOLUTION ──────────────────────────────────────────────────
  section('Phase 3 — Emergency PRE Resolution');

  guardedTransition(preMachine, { toState: 'RESOLVING', authority: 'OPERATOR', sourceId: 'op-001-anchor-manager', reason: 'Emergency override resolution', governedTimestamp: T1_EMERGENCY });

  const emergencyPermission = evaluateExecutionPermission({
    resolutionId: EMERGENCY_INPUT.resolution_id,
    scopeId: EMERGENCY_INPUT.scope_id,
    machineId: 'pre-resolution',
    input: EMERGENCY_INPUT,
    machine: preMachine,
    eligibleStates: ['RESOLVING'],
    knownPriorInputHash: null,
    knownPriorOutputHash: null,
  });

  console.log(`  Preflight check (${emergencyPermission.stageResults.length} stages):`);
  for (const s of emergencyPermission.stageResults) {
    status(`  Stage: ${s.stage}`, s.passed, s.reason ?? undefined);
  }
  console.log(`\n  Permission: ${emergencyPermission.granted ? 'GRANTED ✓' : 'DENIED ✗ — ' + emergencyPermission.denialReason}`);

  const emergencyR = guardedResolve(EMERGENCY_INPUT, 'pre-resolution');
  if (!emergencyR.ok) throw new Error(`Emergency resolve failed (guard): ${emergencyR.failure.code}`);
  const _emergencyPRE = emergencyR.value;
  if (!_emergencyPRE.ok) throw new Error(`Emergency resolve failed (PRE): ${_emergencyPRE.failure.failure_code}`);

  renderOutput('PRE Decision — Emergency Override', _emergencyPRE.output);

  const emergencyTrace = TraceStore.findPREByTraceId(_emergencyPRE.output.trace_id)!;
  const emergencyCorpus = guardedCorpusAdd(EMERGENCY_INPUT, _emergencyPRE.output, emergencyTrace);
  if (!emergencyCorpus.ok) throw new Error(`Emergency corpus add failed: ${emergencyCorpus.failure.code}`);

  renderCorpusEntry('Corpus Record — Emergency Override', emergencyCorpus.value);

  guardedTransition(preMachine, { toState: 'RESOLVED', authority: 'OPERATOR', sourceId: 'op-001-anchor-manager', reason: 'Emergency resolution complete', governedTimestamp: T1_EMERGENCY });

  // ── REPLAY RECONSTRUCTION ──────────────────────────────────────────────────
  section('Phase 4 — Replay Reconstruction');
  console.log('  Replaying both corpus entries to verify reconstruction...\n');

  GovernedClock.set(T0_NORMAL);
  const normalReplay: ReplayResult = replayEntry(normalCorpus.value);
  GovernedClock.set(T1_EMERGENCY);

  GovernedClock.set(T1_EMERGENCY);
  const emergencyReplay: ReplayResult = replayEntry(emergencyCorpus.value);
  GovernedClock.set(T1_EMERGENCY);

  renderReplayResult('Replay: Normal Entry', normalCorpus.value, normalReplay);
  renderReplayResult('Replay: Emergency Entry', emergencyCorpus.value, emergencyReplay);

  // ── VERIFICATION STATUS ────────────────────────────────────────────────────
  section('Phase 5 — Verification Status');

  const normalVfy = verify(normalCorpus.value, normalReplay);
  const emergencyVfy = verify(emergencyCorpus.value, emergencyReplay);

  const normalOk = normalVfy.result === 'MATCH';
  const emergencyOk = emergencyVfy.result === 'MATCH';

  status('Normal entry verification', normalOk,
    normalOk ? 'MATCH — no divergence' : `${normalVfy.failure_class}: ${normalVfy.reason}`);
  status('Emergency entry verification', emergencyOk,
    emergencyOk ? 'MATCH — no divergence' : `${emergencyVfy.failure_class}: ${emergencyVfy.reason}`);
  status('Corpus hash chain', Corpus.verifyChain(), Corpus.verifyChain() ? '2-entry chain intact' : 'BROKEN');

  // ── INTEGRITY STATUS ───────────────────────────────────────────────────────
  section('Phase 6 — System Integrity Check');

  const machineEntries: RegisteredMachineEntry[] = [
    { machine: playerMachine,          config: PLAYER_CONFIG           },
    { machine: preMachine,             config: PRE_RESOLUTION_CONFIG   },
    { machine: incidentMachine,        config: INCIDENT_CONFIG         },
    { machine: operatorSessionMachine, config: OPERATOR_SESSION_CONFIG },
  ];

  const integrity = checkSystemIntegrity(machineEntries, 3, 2);
  const integrityOk = integrity.status !== 'INTEGRITY_FAIL';

  console.log(`\n  Overall status: ${integrity.status}  ${integrityOk ? '✓' : '✗'}`);
  console.log(`  Corpus entries audited: ${integrity.corpusEntryCount}`);
  console.log(`  Machines audited:       ${integrity.registeredMachineCount}`);
  console.log('\n  Individual checks:');
  for (const c of integrity.checks) {
    status(`  ${c.id}: ${c.description}`, c.passed,
      c.passed ? undefined : `${c.severity}: ${JSON.stringify(c.detail).slice(0, 80)}`);
  }

  // ── OPERATIONAL SUMMARY ────────────────────────────────────────────────────
  header('OPERATIONAL SUMMARY');

  console.log('  BEFORE EMERGENCY\n');
  field('  Content playing:', normalCorpus.value.output.effective_content);
  field('  Resolution level:', `${normalCorpus.value.output.resolution_level} (${levelLabel(normalCorpus.value.output.resolution_level)})`);
  field('  At time:', normalCorpus.value.input.governed_timestamp);

  console.log('\n  DURING EMERGENCY\n');
  field('  Content playing:', emergencyCorpus.value.output.effective_content);
  field('  Resolution level:', `${emergencyCorpus.value.output.resolution_level} (${levelLabel(emergencyCorpus.value.output.resolution_level)})`);
  field('  At time:', emergencyCorpus.value.input.governed_timestamp);
  field('  Initiated by:', EMERGENCY_INPUT.emergency_scope ?? 'fleet');
  field('  Emergency scope:', EMERGENCY_INPUT.emergency_scope ?? 'fleet');

  console.log('\n  AUDIT TRAIL\n');
  field('  Corpus entries:', String(Corpus.getAll().length));
  field('  Trace events:', String(TraceStore.size()));
  field('  State mutations:', String(TraceStore.getStateEvents().length));
  field('  Chain intact:', Corpus.verifyChain() ? 'YES ✓' : 'NO ✗');
  field('  Replay verified:', (normalOk && emergencyOk) ? 'YES ✓' : 'NO ✗');
  field('  Integrity status:', integrity.status + (integrityOk ? ' ✓' : ' ✗'));

  const allGood = normalOk && emergencyOk && Corpus.verifyChain() && integrityOk;
  console.log(`\n${DLINE}`);
  console.log(allGood
    ? '  ✓ SCENARIO COMPLETE — All systems verified. Audit trail intact.'
    : '  ✗ SCENARIO INCOMPLETE — One or more verification steps failed.');
  console.log(`${DLINE}\n`);
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

if (require.main === module) {
  try {
    runDemo();
    process.exit(0);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n✗ Demo aborted: ${msg}`);
    process.exit(1);
  }
}
