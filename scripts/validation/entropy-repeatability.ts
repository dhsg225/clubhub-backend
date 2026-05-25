#!/usr/bin/env ts-node
/**
 * Entropy repeatability verification.
 *
 * Verifies entropy calculations are deterministic.
 * Same state → same scores, always.
 */

import { computeScreenEntropy } from '../../src/entropy/entropy-runner';
import { computeVenueEntropy } from '../../src/entropy/venue-entropy-runner';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { PRE_Input } from '../../src/pre/types';

const ROOT = join(__dirname, '../..');
const fixture = JSON.parse(readFileSync(join(ROOT, 'corpus/golden/GOLD-001.json'), 'utf8')) as { input: PRE_Input };
const state = fixture.input.system_state;
const at = fixture.input.at;

const RUNS = 50;
let failures = 0;

// ─── Screen entropy repeatability ────────────────────────────────────────────

const firstScreen = computeScreenEntropy(state, at);

for (let i = 0; i < RUNS; i++) {
  const result = computeScreenEntropy(state, at);

  if (result.composite !== firstScreen.composite) {
    console.error(`FAIL screen run ${i}: composite changed: ${firstScreen.composite} → ${result.composite}`);
    failures++;
  }
  if (result.label !== firstScreen.label) {
    console.error(`FAIL screen run ${i}: label changed: ${firstScreen.label} → ${result.label}`);
    failures++;
  }
  if (result.advisory_tier !== firstScreen.advisory_tier) {
    console.error(`FAIL screen run ${i}: advisory_tier changed`);
    failures++;
  }
  if (result.metrics.length !== firstScreen.metrics.length) {
    console.error(`FAIL screen run ${i}: metrics count changed`);
    failures++;
  }
}

// ─── Venue entropy repeatability ─────────────────────────────────────────────

const firstVenue = computeVenueEntropy([state], at);

for (let i = 0; i < RUNS; i++) {
  const result = computeVenueEntropy([state], at);

  if (result.composite !== firstVenue.composite) {
    console.error(`FAIL venue run ${i}: composite changed`);
    failures++;
  }
  if (result.label !== firstVenue.label) {
    console.error(`FAIL venue run ${i}: label changed`);
    failures++;
  }
  if (result.advisory_tier !== firstVenue.advisory_tier) {
    console.error(`FAIL venue run ${i}: advisory_tier changed`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\nFAIL: ${failures} entropy repeatability failures`);
  process.exit(1);
}

console.log(`PASS: ${RUNS} screen entropy runs — stable (composite=${firstScreen.composite.toFixed(4)}, label=${firstScreen.label})`);
console.log(`PASS: ${RUNS} venue entropy runs — stable (composite=${firstVenue.composite.toFixed(4)}, label=${firstVenue.label})`);
console.log('Entropy repeatability validation: PASS');
process.exit(0);
