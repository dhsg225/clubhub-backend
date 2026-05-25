#!/usr/bin/env ts-node
/**
 * Failure mode validation.
 *
 * For each failure mode in FAILURE_REGISTRY:
 * - Verify it has a non-empty description
 * - Verify failure_class is in [0,1,2,3,4,5]
 * - Verify recovery_policy is non-empty
 * - Verify the chaos_equivalent (if non-null) maps back via CHAOS_PRODUCTION_MAPPINGS
 */

import { FAILURE_REGISTRY } from '../../src/failure-injection/failure-registry';
import { CHAOS_PRODUCTION_MAPPINGS } from '../../src/failure-injection/chaos-to-production-mapping';

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

const VALID_CLASSES = new Set([0, 1, 2, 3, 4, 5]);
const chaosMappingSet = new Set(CHAOS_PRODUCTION_MAPPINGS.map(m => m.chaos_id));

console.log(`\nValidating ${FAILURE_REGISTRY.length} failure modes...\n`);

for (const fm of FAILURE_REGISTRY) {
  assert(
    typeof fm.description === 'string' && fm.description.length > 0,
    `${fm.id}: has non-empty description`
  );

  assert(
    VALID_CLASSES.has(fm.failure_class),
    `${fm.id}: failure_class ${fm.failure_class} is in [0,1,2,3,4,5]`
  );

  assert(
    typeof fm.recovery_policy === 'string' && fm.recovery_policy.length > 0,
    `${fm.id}: has non-empty recovery_policy`
  );

  if (fm.chaos_equivalent !== null) {
    assert(
      chaosMappingSet.has(fm.chaos_equivalent),
      `${fm.id}: chaos_equivalent '${fm.chaos_equivalent}' exists in CHAOS_PRODUCTION_MAPPINGS`
    );
  } else {
    assert(true, `${fm.id}: chaos_equivalent is null (no chaos mapping required)`);
  }

  assert(
    typeof fm.id === 'string' && fm.id.startsWith('FM-'),
    `${fm.id}: id follows FM-NNN format`
  );

  assert(
    typeof fm.name === 'string' && fm.name.length > 0,
    `${fm.id}: has non-empty name`
  );
}

// ─── Global checks ────────────────────────────────────────────────────────────
assert(FAILURE_REGISTRY.length >= 10, `Registry has at least 10 failure modes (got ${FAILURE_REGISTRY.length})`);

// All IDs are unique
const ids = FAILURE_REGISTRY.map(f => f.id);
const uniqueIds = new Set(ids);
assert(uniqueIds.size === ids.length, 'All failure mode IDs are unique');

// ─── Report ──────────────────────────────────────────────────────────────────
console.log(`\nfailure-mode-validation: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exit(1);
}
console.log('\nPASS');
process.exit(0);
