#!/usr/bin/env ts-node
/**
 * Replay audit stability verification.
 *
 * Builds 100 audit records, verifies all checksums consistent.
 */

import { buildAuditRecord, ReplayAuditWriter } from '../../src/audit/replay-audit-writer';
import { verifyReplayAuditIntegrity } from '../../src/audit/retention-policy';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolve } from '../../src/pre/index';
import type { PRE_Input } from '../../src/pre/types';

const ROOT = join(__dirname, '../..');
const fixture = JSON.parse(readFileSync(join(ROOT, 'corpus/golden/GOLD-001.json'), 'utf8')) as { input: PRE_Input };
const input: PRE_Input = fixture.input;
const preOutput = resolve(input);

const writer = new ReplayAuditWriter();
const RECORD_COUNT = 100;

// ─── Build 100 audit records ──────────────────────────────────────────────────

for (let i = 0; i < RECORD_COUNT; i++) {
  const record = buildAuditRecord(
    input.screen_id,
    input.at + i,        // vary `at` to get unique audit_record_ids
    `corr-${i.toString().padStart(4, '0')}`,
    preOutput,
    null,
    null,
    null,
    true,
  );
  writer.write(record);
}

// ─── Verify integrity ─────────────────────────────────────────────────────────

const result = verifyReplayAuditIntegrity(writer);

if (result.total !== RECORD_COUNT) {
  console.error(`FAIL: Expected ${RECORD_COUNT} records, got ${result.total}`);
  process.exit(1);
}

if (result.corrupted > 0) {
  console.error(`FAIL: ${result.corrupted} corrupted records: ${result.corrupted_ids.join(', ')}`);
  process.exit(1);
}

// Verify each record individually
let individualFails = 0;
for (const record of writer.getAll()) {
  if (!writer.verifyRecord(record)) {
    console.error(`FAIL: Record ${record.audit_record_id} failed individual verification`);
    individualFails++;
  }
}

if (individualFails > 0) {
  console.error(`FAIL: ${individualFails} records failed individual verification`);
  process.exit(1);
}

// Verify duplicate ID detection
let threwOnDuplicate = false;
try {
  const record = writer.getAll()[0];
  if (record !== undefined) {
    writer.write(record);
  }
} catch {
  threwOnDuplicate = true;
}
if (!threwOnDuplicate) {
  console.error('FAIL: ReplayAuditWriter did not throw on duplicate audit_record_id');
  process.exit(1);
}

console.log(`PASS: ${RECORD_COUNT} audit records built and verified`);
console.log(`PASS: ${result.valid}/${result.total} checksums valid`);
console.log('PASS: Duplicate ID detection works');
console.log('Replay stability validation: PASS');
process.exit(0);
