#!/usr/bin/env ts-node
/**
 * Determinism regression check — runs the replay harness N times and
 * verifies that output hashes are identical across all runs.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §3 (determinism invariant)
 * Invariant reference: INV-3 (determinism)
 *
 * A non-deterministic PRE is a CONSTITUTIONAL_BREACH. Any output hash that
 * differs across runs with the same input indicates use of Date.now(),
 * Math.random(), non-deterministic iteration order, or similar violations.
 *
 * Usage:
 *   npx ts-node scripts/determinism-check.ts [--runs N]
 *
 * Default: 5 runs
 * Exit code 0 = all hashes stable across all runs
 * Exit code 1 = hash instability detected (non-determinism found)
 */

import * as path from 'path';
import { runReplayHarness } from '../src/verification/replay/harness';
import type { ReplayRunReport } from '../src/verification/replay/types';

const RUNS = (() => {
  const idx = process.argv.indexOf('--runs');
  if (idx >= 0 && process.argv[idx + 1]) {
    return parseInt(process.argv[idx + 1] as string, 10) || 5;
  }
  return 5;
})();

interface PacketHashRecord {
  packet_id: string;
  hashes: (string | null)[];
  stable: boolean;
}

async function runDeterminismCheck(): Promise<void> {
  console.log(`=== DETERMINISM REGRESSION CHECK ===`);
  console.log(`Runs: ${RUNS}`);
  console.log(`Starting at: ${new Date().toISOString()}`);
  console.log('');

  const reports: ReplayRunReport[] = [];

  for (let i = 1; i <= RUNS; i++) {
    process.stdout.write(`Run ${i}/${RUNS}... `);
    const report = await runReplayHarness({
      corpusPath: path.resolve(__dirname, '../corpus'),
      outputPath: path.resolve(__dirname, '../replay-output'),
    });
    reports.push(report);
    console.log(
      `passed: ${report.passed}/${report.total_packets}, ` +
      `failed: ${report.failed}, ` +
      `duration: ${report.completed_at - report.started_at}ms`
    );
  }

  console.log('');
  console.log('--- Hash stability analysis ---');

  // Collect all packet IDs from first run
  const packetIds = (reports[0]?.results ?? []).map(r => r.packet_id);

  const hashRecords: PacketHashRecord[] = [];
  let anyInstability = false;

  for (const packetId of packetIds) {
    const hashes: (string | null)[] = [];
    for (const report of reports) {
      const result = report.results.find(r => r.packet_id === packetId);
      hashes.push(result?.actual_output_hash ?? null);
    }

    const uniqueHashes = new Set(hashes.filter(h => h !== null));
    const stable = uniqueHashes.size <= 1;

    if (!stable) {
      anyInstability = true;
    }

    hashRecords.push({ packet_id: packetId, hashes, stable });
  }

  // Print per-packet hash table
  for (const rec of hashRecords) {
    const status = rec.stable ? 'STABLE' : 'UNSTABLE';
    const hashDisplay = rec.hashes.every(h => h === rec.hashes[0])
      ? (rec.hashes[0] ?? 'null') + ` (all ${RUNS} runs)`
      : rec.hashes.join(' | ');
    console.log(`  [${status}] ${rec.packet_id}`);
    console.log(`           hashes: ${hashDisplay}`);
  }

  console.log('');
  console.log('--- Summary ---');
  const stableCount = hashRecords.filter(r => r.stable).length;
  console.log(`Stable:   ${stableCount}/${hashRecords.length}`);
  console.log(`Unstable: ${hashRecords.length - stableCount}/${hashRecords.length}`);

  if (anyInstability) {
    console.error('');
    console.error('DETERMINISM FAILURE: Hash instability detected.');
    console.error('This is a CONSTITUTIONAL_BREACH (INV-3 violation).');
    console.error('PRE.resolve() must be pure and deterministic.');
    console.error('Check for: Date.now(), Math.random(), Map/Set iteration, or side effects.');
    process.exit(1);
  } else {
    console.log('');
    console.log('DETERMINISM CONFIRMED: All output hashes stable across ' + RUNS + ' runs.');
    console.log('INV-3 (determinism invariant) satisfied.');
    process.exit(0);
  }
}

runDeterminismCheck().catch((err: unknown) => {
  console.error('Determinism check failed with error:', (err as Error).message);
  process.exit(1);
});
