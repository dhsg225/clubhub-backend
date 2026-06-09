/**
 * Replay harness — main replay runner.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §3.1
 *
 * Execution sequence per packet:
 * 1. Load packet (verify all 3 hashes)
 * 2. Build in-memory DB from SystemStateSnapshot (write-intercepting)
 * 3. Invoke PRE.resolve(screen_id, at, db) — pure function only
 * 4. Run all invariant assertions on the actual output
 * 5. Compute actual_output_hash
 * 6. Compare actual_output_hash to packet.output_hash
 * 7. If hashes differ: classify divergence
 * 8. Emit ReplayResult
 * 9. Archive result to outputPath/{run_id}/
 *
 * PRE IS NOT IMPLEMENTED YET — harness uses a stub that will be replaced
 * when src/pre/index.ts is implemented. The harness is fully functional
 * except for the PRE.resolve() call itself.
 *
 * Parallel execution is FORBIDDEN. The harness runs packets sequentially.
 * Parallel execution would interleave DB state across packets, violating
 * the isolation guarantee of each packet's in-memory DB.
 */

import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { canonicalizeJson } from '../../pre/algorithms/canonicalize-json';
import { fnv1a32 } from '../../pre/algorithms/fnv1a32';
import { CORPUS_SCHEMA_VERSION } from '../../pre/constants';
import { runAllInvariants } from '../invariants/index';
import { InvariantViolationError } from '../invariants/types';
import { loadPacket } from './packet-loader';
import { buildInMemoryDb } from './in-memory-db';
import { diffOutputs } from '../divergence/diff';
import { classifyDivergence } from '../divergence/classifier';
import {
  type ReplayHarnessOptions,
  type ReplayRunReport,
  type ReplayResult,
  type ReplayPacket,
  type CorpusIndex,
} from './types';
import type { DivergenceReport } from '../divergence/types';
import type { PRE_Input, PRE_Output } from '../../pre/types';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

// ─── PRE Stub ─────────────────────────────────────────────────────────────────

/**
 * PRE resolver interface. The actual PRE.resolve() implementation will be
 * imported from src/pre/index.ts once it exists. Until then, this stub
 * throws to make it explicit that the PRE is not yet implemented.
 */
type PRE_Resolver = (input: PRE_Input) => PRE_Output;

function loadPRE(): PRE_Resolver {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pre = require('../../pre/index') as { resolve: PRE_Resolver };
    return pre.resolve;
  } catch {
    // PRE not yet implemented — return a stub that throws
    return (_input: PRE_Input): PRE_Output => {
      throw new Error(
        'PRE.resolve() is not yet implemented. ' +
        'Create src/pre/index.ts with the PRE.resolve() function before running replay.'
      );
    };
  }
}

// ─── Harness Entry Point ──────────────────────────────────────────────────────

/**
 * Run the full replay harness.
 *
 * Discovers all active corpus packets (filtered by opts.filter if provided),
 * executes them sequentially, and returns a ReplayRunReport.
 *
 * Throws if:
 * - corpusPath does not contain a valid CORPUS-INDEX.json
 * - outputPath cannot be created
 *
 * Does NOT throw on individual packet failures — these are captured in
 * the ReplayRunReport.
 */
export async function runReplayHarness(
  opts: ReplayHarnessOptions
): Promise<ReplayRunReport> {
  const runId = randomUUID();
  const startedAt = Date.now();

  // Create output directory for this run
  const runOutputPath = join(opts.outputPath, runId);
  mkdirSync(runOutputPath, { recursive: true });

  // Load PRE resolver
  const preResolve = loadPRE();

  // Load corpus index
  const index = loadCorpusIndex(opts.corpusPath);

  // Filter packets
  const packetEntries = filterPackets(index, opts.filter ?? {});

  const results: ReplayResult[] = [];
  const divergences: DivergenceReport[] = [];

  // Execute packets sequentially (parallel is FORBIDDEN — see file header)
  for (const entry of packetEntries) {
    const filePath = resolve(opts.corpusPath, entry.file_path);
    const result = await executePacket(filePath, preResolve);
    results.push(result);

    if (result.divergence) {
      divergences.push(result.divergence);
    }
  }

  const completedAt = Date.now();

  // Compute aggregate counts
  const passed            = results.filter(r => r.status === 'PASS').length;
  const failed            = results.filter(r => r.status !== 'PASS').length;
  const integrityFailures = results.filter(r => r.status === 'INTEGRITY_FAILURE').length;

  const overallResult: ReplayRunReport['overall_result'] =
    integrityFailures > 0 ? 'INTEGRITY_FAILURE' :
    failed > 0            ? 'FAIL' :
    'PASS';

  const report: ReplayRunReport = {
    run_id:                runId,
    started_at:            startedAt,
    completed_at:          completedAt,
    pre_impl_version:      getPREImplVersion(),
    corpus_schema_version: CORPUS_SCHEMA_VERSION,
    total_packets:         results.length,
    passed,
    failed,
    integrity_failures:    integrityFailures,
    divergences,
    results,
    overall_result:        overallResult,
  };

  // Archive report to output directory
  writeFileSync(
    join(runOutputPath, 'replay-report.json'),
    canonicalizeJson(report as unknown),
    'utf8'
  );

  return report;
}

// ─── Packet Execution ─────────────────────────────────────────────────────────

async function executePacket(
  filePath: string,
  preResolve: PRE_Resolver
): Promise<ReplayResult> {
  const t0 = Date.now();

  // Step 1: Load and verify packet
  const loadResult = loadPacket(filePath);

  if (loadResult.error || !loadResult.packet) {
    return {
      packet_id:            'unknown',
      packet_class:         'golden',
      status:               'INTEGRITY_FAILURE',
      actual_output_hash:   null,
      expected_output_hash: '',
      divergence:           null,
      error_message:        loadResult.errorDetail ?? loadResult.error ?? 'Unknown load error',
      execution_ms:         Date.now() - t0,
    };
  }

  const packet: ReplayPacket = loadResult.packet;

  // Step 2: Build in-memory DB (write-intercepting)
  const db = buildInMemoryDb(packet.input.system_state);

  // Step 3: Invoke PRE.resolve()
  let actualOutput: PRE_Output;
  try {
    actualOutput = preResolve({
      screen_id:    packet.input.screen_id,
      at:           packet.input.at,
      system_state: packet.input.system_state,
    });
  } catch (err) {
    // InvariantViolationError from write-intercept or invariant assertion
    if (err instanceof InvariantViolationError) {
      return {
        packet_id:            packet.packet_id,
        packet_class:         packet.corpus_class,
        status:               'INVARIANT_VIOLATION',
        actual_output_hash:   null,
        expected_output_hash: packet.output_hash,
        divergence:           null,
        invariant_results:    [err.result],
        error_message:        err.message,
        execution_ms:         Date.now() - t0,
      };
    }

    return {
      packet_id:            packet.packet_id,
      packet_class:         packet.corpus_class,
      status:               'EXECUTION_ERROR',
      actual_output_hash:   null,
      expected_output_hash: packet.output_hash,
      divergence:           null,
      error_message:        String(err),
      execution_ms:         Date.now() - t0,
    };
  }

  // Step 4: Run invariant assertions on actual output
  const preInput: PRE_Input = {
    screen_id:    packet.input.screen_id,
    at:           packet.input.at,
    system_state: packet.input.system_state,
  };

  try {
    runAllInvariants(actualOutput, preInput);
  } catch (err) {
    if (err instanceof InvariantViolationError) {
      return {
        packet_id:            packet.packet_id,
        packet_class:         packet.corpus_class,
        status:               'INVARIANT_VIOLATION',
        actual_output_hash:   null,
        expected_output_hash: packet.output_hash,
        divergence:           null,
        invariant_results:    [err.result],
        error_message:        err.message,
        execution_ms:         Date.now() - t0,
      };
    }
  }

  // Step 5: Compute actual output hash
  const actualOutputHash = fnv1a32(canonicalizeJson(actualOutput as unknown));

  // Step 6: Compare hashes
  if (actualOutputHash === packet.output_hash) {
    return {
      packet_id:            packet.packet_id,
      packet_class:         packet.corpus_class,
      status:               'PASS',
      actual_output_hash:   actualOutputHash,
      expected_output_hash: packet.output_hash,
      divergence:           null,
      execution_ms:         Date.now() - t0,
    };
  }

  // Step 7: Classify divergence
  const fieldDiffs = diffOutputs(packet.expected_output, actualOutput);
  const divergence = classifyDivergence(
    packet.packet_id,
    fieldDiffs,
    packet.output_hash,
    actualOutputHash,
    { system_state: { emergency: packet.input.system_state.emergency } }
  );

  return {
    packet_id:            packet.packet_id,
    packet_class:         packet.corpus_class,
    status:               'BEHAVIORAL_DIVERGENCE',
    actual_output_hash:   actualOutputHash,
    expected_output_hash: packet.output_hash,
    divergence,
    execution_ms:         Date.now() - t0,
  };
}

// ─── Corpus Index Loading ─────────────────────────────────────────────────────

function loadCorpusIndex(corpusPath: string): CorpusIndex {
  const indexPath = join(corpusPath, 'CORPUS-INDEX.json');
  let raw: string;
  try {
    raw = readFileSync(indexPath, 'utf8');
  } catch {
    throw new Error(
      `Cannot read CORPUS-INDEX.json at "${indexPath}". ` +
      `The corpus directory must contain a valid CORPUS-INDEX.json file.`
    );
  }
  return JSON.parse(raw) as CorpusIndex;
}

function filterPackets(
  index: CorpusIndex,
  filter: NonNullable<ReplayHarnessOptions['filter']>
) {
  return index.packets.filter(entry => {
    if ((filter.status ?? 'active') === 'active' && entry.status !== 'active') {
      return false;
    }
    if (filter.class && !filter.class.includes(entry.corpus_class)) {
      return false;
    }
    if (filter.packetIds && !filter.packetIds.includes(entry.packet_id)) {
      return false;
    }
    return true;
  });
}

function getPREImplVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../../package.json') as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
