#!/usr/bin/env tsx
/**
 * G.1 — Real DB Replay Validation: Corpus Fixture Determinism
 *
 * Runs all 9 active corpus fixtures through the real PRE engine 100 times each.
 * Any output variance is a constitutional failure.
 *
 * Does NOT require a live database — corpus fixtures embed full system_state.
 * This validates PRE engine determinism in isolation from the DB layer.
 *
 * Usage:
 *   tsx scripts/validation/real-db-replay.ts
 *
 * Exit: 0 = all PASS, 1 = any failure
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { resolve } from '../../src/pre/index';
import { canonicalizeJson } from '../../src/pre/algorithms/canonicalize-json';
import { fnv1a32 } from '../../src/pre/algorithms/fnv1a32';
import type { PRE_Input, PRE_Output } from '../../src/pre/types';

const ROOT = join(__dirname, '../..');
const RUNS_PER_FIXTURE = 100;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CorpusIndexEntry {
  packet_id: string;
  file_path: string;
  corpus_class: string;
  status: 'active' | 'retired';
  description: string;
  packet_hash: string;
}

interface CorpusIndex {
  packets: CorpusIndexEntry[];
}

interface ReplayPacket {
  packet_id: string;
  corpus_class: string;
  status: string;
  input: PRE_Input;
  input_hash: string;
  expected_output: PRE_Output;
  output_hash: string;
  invariants_under_test: string[];
}

interface FixtureResult {
  packet_id: string;
  corpus_class: string;
  passed: boolean;
  runs: number;
  stable_checksum: string | null;
  expected_checksum: string;
  checksum_match: boolean;
  hash_match: boolean;
  actual_output_hash: string;
  expected_output_hash: string;
  variance_detected: boolean;
  failure_reason: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeOutputHash(output: PRE_Output): string {
  return createHash('sha256').update(canonicalizeJson(output)).digest('hex');
}

function replayAuthoritative(output: PRE_Output): object {
  // Fields that must be stable across runs (exclude resolved_at timing annotation)
  return {
    screen_id: output.screen_id,
    resolution_level: output.resolution_level,
    is_fallback: output.is_fallback,
    playlist: output.playlist,
    content_mix: output.content_mix,
    playlist_checksum: output.playlist_checksum,
    reason_trace: output.reason_trace,
    output_schema_version: output.output_schema_version,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function runFixtureDeterminism(packet: ReplayPacket): FixtureResult {
  const checksums = new Set<string>();
  const outputHashes = new Set<string>();

  for (let i = 0; i < RUNS_PER_FIXTURE; i++) {
    let output: PRE_Output;
    try {
      output = resolve(packet.input);
    } catch (err) {
      return {
        packet_id: packet.packet_id,
        corpus_class: packet.corpus_class,
        passed: false,
        runs: i,
        stable_checksum: null,
        expected_checksum: packet.expected_output.playlist_checksum,
        checksum_match: false,
        hash_match: false,
        actual_output_hash: '',
        expected_output_hash: packet.output_hash,
        variance_detected: false,
        failure_reason: `resolve() threw on run ${i}: ${String(err)}`,
      };
    }

    checksums.add(output.playlist_checksum);
    outputHashes.add(computeOutputHash(replayAuthoritative(output) as PRE_Output));
  }

  const stable_checksum = [...checksums][0] ?? null;
  const actual_output_hash = [...outputHashes][0] ?? '';

  const variance_detected = checksums.size > 1 || outputHashes.size > 1;
  const checksum_match = stable_checksum === packet.expected_output.playlist_checksum;
  const hash_match = actual_output_hash === packet.output_hash;

  const failures: string[] = [];
  if (variance_detected) {
    failures.push(
      `NONDETERMINISM: ${checksums.size} distinct checksums, ${outputHashes.size} distinct hashes across ${RUNS_PER_FIXTURE} runs`,
    );
  }
  if (!checksum_match) {
    failures.push(
      `CHECKSUM_MISMATCH: actual=${stable_checksum} expected=${packet.expected_output.playlist_checksum}`,
    );
  }
  if (!hash_match) {
    failures.push(
      `HASH_MISMATCH: actual=${actual_output_hash.slice(0, 16)}... expected=${packet.output_hash.slice(0, 16)}...`,
    );
  }

  return {
    packet_id: packet.packet_id,
    corpus_class: packet.corpus_class,
    passed: failures.length === 0,
    runs: RUNS_PER_FIXTURE,
    stable_checksum,
    expected_checksum: packet.expected_output.playlist_checksum,
    checksum_match,
    hash_match,
    actual_output_hash,
    expected_output_hash: packet.output_hash,
    variance_detected,
    failure_reason: failures.length > 0 ? failures.join('; ') : null,
  };
}

function main(): void {
  console.log('='.repeat(70));
  console.log('G.1 — Real DB Replay Validation: Corpus Fixture Determinism');
  console.log(`Runs per fixture: ${RUNS_PER_FIXTURE}`);
  console.log('='.repeat(70));

  const index = JSON.parse(
    readFileSync(join(ROOT, 'corpus/CORPUS-INDEX.json'), 'utf-8'),
  ) as CorpusIndex;

  const activePackets = index.packets.filter(p => p.status === 'active');
  console.log(`\nLoaded ${activePackets.length} active corpus packets\n`);

  const results: FixtureResult[] = [];
  let totalRuns = 0;

  for (const entry of activePackets) {
    const packetPath = join(ROOT, 'corpus', entry.file_path);
    let packet: ReplayPacket;
    try {
      packet = JSON.parse(readFileSync(packetPath, 'utf-8')) as ReplayPacket;
    } catch (err) {
      console.error(`  [LOAD_FAIL] ${entry.packet_id}: cannot load ${entry.file_path}: ${String(err)}`);
      results.push({
        packet_id: entry.packet_id,
        corpus_class: entry.corpus_class,
        passed: false,
        runs: 0,
        stable_checksum: null,
        expected_checksum: '',
        checksum_match: false,
        hash_match: false,
        actual_output_hash: '',
        expected_output_hash: entry.packet_hash,
        variance_detected: false,
        failure_reason: `Load failed: ${String(err)}`,
      });
      continue;
    }

    process.stdout.write(`  Running ${entry.packet_id} (${entry.corpus_class}) × ${RUNS_PER_FIXTURE}... `);
    const result = runFixtureDeterminism(packet);
    totalRuns += result.runs;
    results.push(result);

    if (result.passed) {
      console.log(`PASS (checksum=${result.stable_checksum})`);
    } else {
      console.log(`FAIL`);
      console.log(`    reason: ${result.failure_reason}`);
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n' + '─'.repeat(70));
  console.log(`Results: ${passed}/${results.length} PASS  |  ${failed} FAIL`);
  console.log(`Total PRE invocations: ${totalRuns.toLocaleString()}`);

  if (failed > 0) {
    console.log('\nFAILED PACKETS:');
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  [FAIL] ${r.packet_id}: ${r.failure_reason}`);
    }
    console.log('\nCONSTITUTIONAL VERDICT: FAIL — replay corpus not stable against real PRE');
    process.exit(1);
  }

  console.log('\nCONSTITUTIONAL VERDICT: PASS');
  console.log(`  All ${activePackets.length} active corpus fixtures deterministic across ${RUNS_PER_FIXTURE} runs each`);
  console.log(`  Zero nondeterminism detected in ${totalRuns.toLocaleString()} total PRE invocations`);
  process.exit(0);
}

main();
