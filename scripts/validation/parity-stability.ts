#!/usr/bin/env ts-node
/**
 * Parity stability verification.
 *
 * Verifies shadow comparison is deterministic.
 * Same inputs → same divergence_class, same hashes, always.
 */

import { compareLegacyVsPRE } from '../../src/shadow/comparison/manifest-comparator';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolve } from '../../src/pre/index';
import type { PRE_Input } from '../../src/pre/types';
import type { LegacyOutput } from '../../src/shadow/types';

const ROOT = join(__dirname, '../..');
const fixture = JSON.parse(readFileSync(join(ROOT, 'corpus/golden/GOLD-001.json'), 'utf8')) as { input: PRE_Input };
const input: PRE_Input = fixture.input;
const preOutput = resolve(input);

// Build a matching legacy output (agreement case)
const legacyAgreement: LegacyOutput = {
  screen_id: preOutput.screen_id,
  playlist_checksum: preOutput.playlist_checksum,
  content_ids: preOutput.playlist.map(p => p.content_id),
  duration_ms_sequence: preOutput.playlist.map(p => p.duration_ms),
  is_fallback: preOutput.is_fallback,
  resolution_note: null,
};

// Build a divergent legacy output
const legacyDivergent: LegacyOutput = {
  screen_id: preOutput.screen_id,
  playlist_checksum: 'aaaaaaaa',
  content_ids: ['different-content'],
  duration_ms_sequence: [15000],
  is_fallback: false,
  resolution_note: null,
};

const RUNS = 50;
let failures = 0;

// ─── Verify agreement case is stable ─────────────────────────────────────────

const invId = 'inv-parity-stability-test';
const firstAgreement = compareLegacyVsPRE(invId, legacyAgreement, preOutput);

for (let i = 0; i < RUNS; i++) {
  const result = compareLegacyVsPRE(invId, legacyAgreement, preOutput);
  if (result.divergence_class !== firstAgreement.divergence_class) {
    console.error(`FAIL run ${i}: divergence_class changed: ${firstAgreement.divergence_class} → ${result.divergence_class}`);
    failures++;
  }
  if (result.pre_hash !== firstAgreement.pre_hash) {
    console.error(`FAIL run ${i}: pre_hash changed`);
    failures++;
  }
  if (result.legacy_hash !== firstAgreement.legacy_hash) {
    console.error(`FAIL run ${i}: legacy_hash changed`);
    failures++;
  }
}

// ─── Verify divergent case is stable ─────────────────────────────────────────

const firstDivergent = compareLegacyVsPRE(invId, legacyDivergent, preOutput);

for (let i = 0; i < RUNS; i++) {
  const result = compareLegacyVsPRE(invId, legacyDivergent, preOutput);
  if (result.divergence_class !== firstDivergent.divergence_class) {
    console.error(`FAIL divergent run ${i}: divergence_class changed`);
    failures++;
  }
  if (result.pre_hash !== firstDivergent.pre_hash) {
    console.error(`FAIL divergent run ${i}: pre_hash changed`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\nFAIL: ${failures} parity stability failures`);
  process.exit(1);
}

console.log(`PASS: ${RUNS} agreement comparison runs — stable (divergence_class=${firstAgreement.divergence_class ?? 'null'})`);
console.log(`PASS: ${RUNS} divergent comparison runs — stable (divergence_class=${firstDivergent.divergence_class})`);
console.log('Parity stability validation: PASS');
process.exit(0);
