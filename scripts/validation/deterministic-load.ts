#!/usr/bin/env ts-node
/**
 * Deterministic load validation.
 *
 * Validates that 1000 identical PRE invocations produce identical hashes.
 * Any hash variance = CLASS_4 constitutional failure.
 *
 * Uses GOLD-001 corpus fixture as the canonical test input.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { resolve } from '../../src/pre/index';
import type { PRE_Input } from '../../src/pre/types';

const ROOT = join(__dirname, '../..');

// ─── Load GOLD-001 fixture ────────────────────────────────────────────────────

const fixtureRaw = readFileSync(join(ROOT, 'corpus/golden/GOLD-001.json'), 'utf8');
const fixture = JSON.parse(fixtureRaw) as { input: PRE_Input; expected_output: { playlist_checksum: string } };

const input: PRE_Input = fixture.input;
const expectedChecksum: string = fixture.expected_output.playlist_checksum;

// ─── Run 1000 invocations ─────────────────────────────────────────────────────

const INVOCATION_COUNT = 1000;
const checksums = new Set<string>();
const startMs = Date.now();

let allPassed = true;

for (let i = 0; i < INVOCATION_COUNT; i++) {
  const output = resolve(input);
  checksums.add(output.playlist_checksum);

  if (output.playlist_checksum !== expectedChecksum) {
    console.error(`FAIL: Invocation ${i + 1} produced unexpected checksum: ${output.playlist_checksum} (expected ${expectedChecksum})`);
    allPassed = false;
  }
}

const durationMs = Date.now() - startMs;

// ─── Report ──────────────────────────────────────────────────────────────────

if (checksums.size !== 1) {
  console.error(`\nCLASS_4 CONSTITUTIONAL FAILURE: ${checksums.size} distinct checksums produced across ${INVOCATION_COUNT} identical invocations.`);
  console.error('Distinct checksums:', [...checksums]);
  process.exit(1);
}

const [singleChecksum] = [...checksums];

if (singleChecksum !== expectedChecksum) {
  console.error(`\nFAIL: All ${INVOCATION_COUNT} invocations produced consistent checksum ${singleChecksum}, but expected ${expectedChecksum}`);
  process.exit(1);
}

if (!allPassed) {
  console.error(`\nFAIL: Some invocations produced unexpected checksums (see above)`);
  process.exit(1);
}

console.log(`PASS: ${INVOCATION_COUNT} identical invocations → single checksum: ${singleChecksum}`);
console.log(`Duration: ${durationMs}ms (${(durationMs / INVOCATION_COUNT).toFixed(2)}ms/invocation avg)`);
console.log('Deterministic load validation: PASS');
process.exit(0);
