#!/usr/bin/env ts-node
/**
 * Fixture authoring helper — computes and injects all three hashes for a replay packet.
 *
 * Constitutional authority: REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md §3.6
 *
 * Usage:
 *   npx ts-node scripts/author-fixture.ts <input-file.json> [output-file.json]
 *
 * Takes a replay packet JSON file WITHOUT hash fields (or with placeholder hashes),
 * computes the correct hashes, injects them, and writes the sealed packet.
 *
 * This script is the ONLY authorized way to create or update corpus packets.
 * Manual hash computation is forbidden — it introduces human error.
 */

import { readFileSync, writeFileSync } from 'fs';
import { canonicalizeJson } from '../src/pre/algorithms/canonicalize-json';
import { fnv1a32 } from '../src/pre/algorithms/fnv1a32';
import { computePacketHash } from '../src/pre/algorithms/sha256';

function authorFixture(inputPath: string, outputPath: string): void {
  const raw = readFileSync(inputPath, 'utf8');
  const packet = JSON.parse(raw) as Record<string, unknown>;

  // Compute input_hash
  const inputHash = fnv1a32(canonicalizeJson(packet['input']));
  packet['input_hash'] = inputHash;

  // Compute output_hash
  const outputHash = fnv1a32(canonicalizeJson(packet['expected_output']));
  packet['output_hash'] = outputHash;

  // Compute packet_hash (must be last — excludes itself)
  delete packet['packet_hash'];
  const packetHash = computePacketHash(packet);
  packet['packet_hash'] = packetHash;

  const sealed = canonicalizeJson(packet);
  writeFileSync(outputPath, sealed + '\n', 'utf8');

  console.log(`✓ Authored fixture: ${outputPath}`);
  console.log(`  input_hash:  ${inputHash}`);
  console.log(`  output_hash: ${outputHash}`);
  console.log(`  packet_hash: ${packetHash}`);
}

function updateCorpusIndex(packetPath: string, packet: Record<string, unknown>): void {
  const indexPath = require('path').join(__dirname, '..', 'corpus', 'CORPUS-INDEX.json');
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as {
    schema_version: string;
    generated_at: number;
    total_packets: number;
    active_packets: number;
    archived_packets: number;
    packets: unknown[];
  };

  const relPath = require('path').relative(
    require('path').join(__dirname, '..', 'corpus'),
    packetPath
  );

  // Check if already in index
  const existingIdx = index.packets.findIndex(
    (p: unknown) => (p as Record<string, unknown>)['packet_id'] === packet['packet_id']
  );

  const entry = {
    packet_id:    packet['packet_id'],
    file_path:    relPath,
    corpus_class: packet['corpus_class'],
    status:       packet['status'],
    description:  packet['description'],
    captured_at:  packet['captured_at'],
    packet_hash:  packet['packet_hash'],
  };

  if (existingIdx >= 0) {
    index.packets[existingIdx] = entry;
  } else {
    index.packets.push(entry);
  }

  index.generated_at    = Date.now();
  index.total_packets   = index.packets.length;
  index.active_packets  = index.packets.filter((p: unknown) =>
    (p as Record<string, unknown>)['status'] === 'active').length;
  index.archived_packets = index.packets.filter((p: unknown) =>
    (p as Record<string, unknown>)['status'] === 'archived').length;

  writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
  console.log(`  Updated CORPUS-INDEX.json`);
}

// Main
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: author-fixture.ts <input.json> [output.json]');
  process.exit(1);
}

const inputPath  = args[0] as string;
const outputPath = args[1] ?? inputPath;

authorFixture(inputPath, outputPath);

// Parse the authored file and update corpus index
const authored = JSON.parse(readFileSync(outputPath, 'utf8')) as Record<string, unknown>;
updateCorpusIndex(outputPath, authored);
