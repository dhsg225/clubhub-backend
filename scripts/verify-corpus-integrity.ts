#!/usr/bin/env ts-node
/**
 * Corpus integrity verification — verifies packet_hash for all active corpus files.
 *
 * Constitutional authority: REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md §12
 *
 * Loads every active packet from corpus/, recomputes packet_hash, and
 * compares to the stored value. Exits with code 1 if any packet fails.
 *
 * Usage:
 *   npx ts-node scripts/verify-corpus-integrity.ts
 *   npx ts-node scripts/verify-corpus-integrity.ts --snapshot  (write daily snapshot)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { canonicalizeJson } from '../src/pre/algorithms/canonicalize-json';
import { computePacketHash, verifyPacketHash } from '../src/pre/algorithms/sha256';
import { fnv1a32 } from '../src/pre/algorithms/fnv1a32';
import type { CorpusIndex } from '../src/verification/replay/types';

const ROOT = join(__dirname, '..');
const CORPUS_PATH = join(ROOT, 'corpus');

function verifyAllPackets(): void {
  const indexPath = join(CORPUS_PATH, 'CORPUS-INDEX.json');
  const index: CorpusIndex = JSON.parse(readFileSync(indexPath, 'utf8'));

  const activePackets = index.packets.filter(p => p.status === 'active');

  console.log(`Verifying ${activePackets.length} active corpus packets...\n`);

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const entry of activePackets) {
    const filePath = join(CORPUS_PATH, entry.file_path);

    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf8');
    } catch {
      console.error(`  FAIL ${entry.packet_id}: Cannot read file "${filePath}"`);
      failed++;
      failures.push(entry.packet_id);
      continue;
    }

    let packet: Record<string, unknown>;
    try {
      packet = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.error(`  FAIL ${entry.packet_id}: JSON parse error in "${filePath}"`);
      failed++;
      failures.push(entry.packet_id);
      continue;
    }

    // Verify packet_hash (SHA-256)
    if (!verifyPacketHash(packet)) {
      const recomputed = computePacketHash(packet);
      console.error(`  FAIL ${entry.packet_id}: packet_hash mismatch`);
      console.error(`       Stored:    ${packet['packet_hash']}`);
      console.error(`       Computed:  ${recomputed}`);
      failed++;
      failures.push(entry.packet_id);
      continue;
    }

    // Verify index packet_hash matches file
    if (entry.packet_hash !== packet['packet_hash']) {
      console.error(`  FAIL ${entry.packet_id}: index packet_hash differs from file`);
      console.error(`       Index:  ${entry.packet_hash}`);
      console.error(`       File:   ${packet['packet_hash']}`);
      failed++;
      failures.push(entry.packet_id);
      continue;
    }

    // Verify input_hash
    const storedInputHash = packet['input_hash'] as string;
    const computedInputHash = fnv1a32(canonicalizeJson(packet['input']));
    if (storedInputHash !== computedInputHash) {
      console.error(`  FAIL ${entry.packet_id}: input_hash mismatch`);
      failed++;
      failures.push(entry.packet_id);
      continue;
    }

    // Verify output_hash
    const storedOutputHash = packet['output_hash'] as string;
    const computedOutputHash = fnv1a32(canonicalizeJson(packet['expected_output']));
    if (storedOutputHash !== computedOutputHash) {
      console.error(`  FAIL ${entry.packet_id}: output_hash mismatch`);
      failed++;
      failures.push(entry.packet_id);
      continue;
    }

    console.log(`  PASS ${entry.packet_id} (${entry.file_path})`);
    passed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${activePackets.length} active packets`);

  // Write snapshot if requested
  if (process.argv.includes('--snapshot')) {
    const date = new Date().toISOString().slice(0, 10);
    const snapshotPath = join(CORPUS_PATH, 'integrity', `corpus-checksum-${date}.sha256`);
    const snapshotLines: string[] = [];

    for (const entry of activePackets) {
      const filePath = join(CORPUS_PATH, entry.file_path);
      try {
        const content = readFileSync(filePath);
        const { sha256Bytes } = require('../src/pre/algorithms/sha256') as typeof import('../src/pre/algorithms/sha256');
        const fileHash = sha256Bytes(content);
        snapshotLines.push(`${fileHash}  ${entry.file_path}`);
      } catch {
        snapshotLines.push(`ERROR  ${entry.file_path}`);
      }
    }

    writeFileSync(snapshotPath, snapshotLines.join('\n') + '\n', 'utf8');
    console.log(`\nSnapshot written: ${snapshotPath}`);
  }

  if (failed > 0) {
    console.error(`\nINTEGRITY FAILURE: ${failed} packet(s) failed verification.`);
    console.error(`Failed: ${failures.join(', ')}`);
    console.error('Investigate corpus corruption before proceeding.');
    process.exit(1);
  }

  console.log('\n✓ All corpus packets verified successfully.');
}

verifyAllPackets();
