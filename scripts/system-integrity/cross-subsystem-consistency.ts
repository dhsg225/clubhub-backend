#!/usr/bin/env ts-node
/**
 * Cross-subsystem consistency check.
 *
 * Verifies:
 * - assertAllCriticalModesHaveChaosEquivalent() passes
 * - All failure modes have is_observable = true
 * - All CLASS_3+ failure modes have requires_human_review = true
 * - CHAOS_PRODUCTION_MAPPINGS covers all 7 chaos scenarios
 */

import { FAILURE_REGISTRY, getByClass } from '../../src/failure-injection/failure-registry';
import { CHAOS_PRODUCTION_MAPPINGS, assertAllCriticalModesHaveChaosEquivalent } from '../../src/failure-injection/chaos-to-production-mapping';
import { classifyPREError, classifyShadowDivergence } from '../../src/failure-injection/runtime-failure-guards';

let pass = 0;
let fail = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    pass++;
    console.log(`  PASS: ${message}`);
  } else {
    fail++;
    console.error(`  FAIL: ${message}`);
  }
}

// ─── 1. assertAllCriticalModesHaveChaosEquivalent passes ─────────────────────
console.log('\n[1] assertAllCriticalModesHaveChaosEquivalent');
try {
  assertAllCriticalModesHaveChaosEquivalent();
  assert(true, 'assertAllCriticalModesHaveChaosEquivalent() does not throw');
} catch (e) {
  assert(false, `assertAllCriticalModesHaveChaosEquivalent() threw: ${(e as Error).message}`);
}

// ─── 2. All failure modes have is_observable = true ──────────────────────────
console.log('\n[2] All failure modes observable');
for (const fm of FAILURE_REGISTRY) {
  assert(fm.is_observable === true, `${fm.id} (${fm.name}) has is_observable = true`);
}

// ─── 3. All CLASS_3+ modes: classifyPREError returns requires_human_review=true
console.log('\n[3] CLASS_3+ failure modes require human review');
const class3Plus = FAILURE_REGISTRY.filter(f => f.failure_class >= 3);
for (const fm of class3Plus) {
  assert(fm.failure_class >= 3, `${fm.id} is CLASS_${fm.failure_class} (>= 3)`);
}

// Verify classifyPREError always returns requires_human_review=true
const genericErr = new Error('generic PRE error');
assert(classifyPREError(genericErr, null).requires_human_review === true, 'classifyPREError generic → requires_human_review = true');

const inv7Err = new Error('INV-7 emergency precedence failure');
assert(classifyPREError(inv7Err, 3).requires_human_review === true, 'classifyPREError INV-7 → requires_human_review = true');

const invViolation = new Error('INV-2 violation');
const invViolError = Object.assign(new Error('INV-2 violation'), { name: 'InvariantViolationError' });
assert(classifyPREError(invViolError, null).requires_human_review === true, 'classifyPREError InvariantViolationError → requires_human_review = true');

// Verify classifyShadowDivergence for CLASS_3+
assert(classifyShadowDivergence(3).requires_human_review === true, 'classifyShadowDivergence(3) → requires_human_review = true');
assert(classifyShadowDivergence(4).requires_human_review === true, 'classifyShadowDivergence(4) → requires_human_review = true');

// ─── 4. CHAOS_PRODUCTION_MAPPINGS covers all 7 chaos scenarios ───────────────
console.log('\n[4] Chaos production mappings cover all 7 scenarios');
const expectedChaos = ['CHAOS-001','CHAOS-002','CHAOS-003','CHAOS-004','CHAOS-005','CHAOS-006','CHAOS-007'];
const mappedChaos = new Set(CHAOS_PRODUCTION_MAPPINGS.map(m => m.chaos_id));
for (const id of expectedChaos) {
  assert(mappedChaos.has(id), `${id} has a production mapping`);
}
assert(CHAOS_PRODUCTION_MAPPINGS.length >= 7, `CHAOS_PRODUCTION_MAPPINGS has at least 7 entries (got ${CHAOS_PRODUCTION_MAPPINGS.length})`);

// ─── Report ──────────────────────────────────────────────────────────────────
console.log(`\ncross-subsystem-consistency: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exit(1);
}
console.log('\nPASS');
process.exit(0);
