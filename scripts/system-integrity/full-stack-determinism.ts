#!/usr/bin/env ts-node
/**
 * Full-stack determinism verification.
 *
 * Runs PRE + Shadow + Entropy together 100 times with the same state.
 * Asserts: all PRE checksums identical, all shadow comparison results identical,
 * all entropy scores identical.
 *
 * Uses GOLD-001 as the test state.
 */

import * as fs from 'fs';
import * as path from 'path';

import { resolve } from '../../src/pre/index';
import type { PRE_Input, PRE_Output } from '../../src/pre/types';
import { compareLegacyVsPRE } from '../../src/shadow/comparison/manifest-comparator';
import type { LegacyOutput } from '../../src/shadow/types';
import { computeEntropyScore } from '../../src/entropy/entropy-score';
import type { MetricResult } from '../../src/entropy/types';

const GOLD_001_PATH = path.join(__dirname, '../../corpus/golden/GOLD-001.json');

function run(): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const raw = JSON.parse(fs.readFileSync(GOLD_001_PATH, 'utf8'));
  const input: PRE_Input = raw.input;

  let pass = 0;
  let fail = 0;

  function assertOk(condition: boolean, message: string): void {
    if (condition) {
      pass++;
      console.log(`  PASS: ${message}`);
    } else {
      fail++;
      console.error(`  FAIL: ${message}`);
    }
  }

  // ─── PRE determinism: 100 runs ───────────────────────────────────────────
  console.log('\n[1] PRE determinism (100 runs)');
  const preOutputs: PRE_Output[] = [];
  for (let i = 0; i < 100; i++) {
    preOutputs.push(resolve(input));
  }

  const firstOutput = preOutputs[0];
  if (!firstOutput) {
    console.error('  FAIL: PRE returned no output');
    process.exit(1);
  }

  const firstChecksum = firstOutput.playlist_checksum;
  const firstResolutionLevel = firstOutput.resolution_level;
  let allPreMatch = true;
  for (let i = 1; i < 100; i++) {
    const output = preOutputs[i];
    if (!output || output.playlist_checksum !== firstChecksum) {
      allPreMatch = false;
      if (output) {
        console.error(`  Run ${i}: checksum mismatch — expected ${firstChecksum}, got ${output.playlist_checksum}`);
      }
    }
    if (!output || output.resolution_level !== firstResolutionLevel) {
      allPreMatch = false;
    }
  }
  assertOk(allPreMatch, 'All 100 PRE checksums are identical');
  assertOk(preOutputs.every(o => o.resolution_level === firstResolutionLevel), 'All 100 PRE resolution levels are identical');
  assertOk(firstChecksum === raw.expected_output.playlist_checksum, `PRE checksum matches GOLD-001 expected (${raw.expected_output.playlist_checksum})`);

  // ─── Shadow comparison determinism: 100 runs ────────────────────────────
  console.log('\n[2] Shadow comparison determinism (100 runs)');

  // Build a LegacyOutput that matches the PRE output (identical content → divergence_class = null)
  const buildLegacyFromPRE = (output: PRE_Output): LegacyOutput => ({
    screen_id: output.screen_id,
    playlist_checksum: output.playlist_checksum,
    content_ids: output.playlist.map(p => p.content_id),
    duration_ms_sequence: output.playlist.map(p => p.duration_ms),
    is_fallback: output.is_fallback,
    resolution_note: null,
  });

  const shadowResults = [];
  for (let i = 0; i < 100; i++) {
    const output = preOutputs[i];
    if (!output) continue;
    const legacy = buildLegacyFromPRE(output);
    const result = compareLegacyVsPRE(`invocation-${i}`, legacy, output);
    shadowResults.push(result);
  }

  const firstShadow = shadowResults[0];
  if (!firstShadow) {
    console.error('  FAIL: shadow produced no results');
    process.exit(1);
  }

  const firstLegacyHash = firstShadow.legacy_hash;
  const firstPreHash = firstShadow.pre_hash;
  const firstDivClass = firstShadow.divergence_class;
  let allShadowMatch = true;
  for (let i = 1; i < 100; i++) {
    const r = shadowResults[i];
    if (!r || r.legacy_hash !== firstLegacyHash || r.pre_hash !== firstPreHash || r.divergence_class !== firstDivClass) {
      allShadowMatch = false;
    }
  }
  assertOk(allShadowMatch, 'All 100 shadow comparison results are identical');
  assertOk(firstShadow.divergence_class === null, 'Shadow comparison with identical inputs produces divergence_class = null (identical)');

  // ─── Entropy score determinism: 100 runs ────────────────────────────────
  console.log('\n[3] Entropy score determinism (100 runs)');
  const AT = input.at;

  // MetricResult requires a status and label field — check the type
  const minimalMetrics: MetricResult[] = [
    'M-01','M-02','M-03','M-04','M-05','M-06','M-07','M-08','M-09','M-10','M-11','M-12',
  ].map(id => ({
    metric_id: id,
    value: 0.1,
    raw_value: 5,
    unit: 'percent',
    threshold_warn: 0.5,
    threshold_critical: 0.8,
    explanation: `Test metric ${id}`,
    contributing_factors: [] as string[],
    computed_at: AT,
    label: 'healthy' as const,
    status: 'healthy' as const,
  }));

  const entropyScores = [];
  for (let i = 0; i < 100; i++) {
    entropyScores.push(computeEntropyScore(minimalMetrics, AT, 'screen-001', 'venue-001'));
  }

  const firstEntropyScore = entropyScores[0];
  if (!firstEntropyScore) {
    console.error('  FAIL: entropy produced no results');
    process.exit(1);
  }

  const firstScore = firstEntropyScore.composite;
  const firstLabel = firstEntropyScore.label;
  let allEntropyMatch = true;
  for (let i = 1; i < 100; i++) {
    const s = entropyScores[i];
    if (!s || s.composite !== firstScore || s.label !== firstLabel) {
      allEntropyMatch = false;
    }
  }
  assertOk(allEntropyMatch, 'All 100 entropy scores are identical');
  assertOk(typeof firstScore === 'number' && firstScore >= 0 && firstScore <= 1, 'Entropy score is in [0, 1]');

  // ─── Report ──────────────────────────────────────────────────────────────
  console.log(`\nfull-stack-determinism: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error('\nFAIL — determinism violations detected');
    process.exit(1);
  }
  console.log('\nPASS — full-stack determinism verified (100 runs each)');
  process.exit(0);
}

run();
