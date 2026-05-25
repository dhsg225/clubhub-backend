/**
 * Audit record retention policy.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 */

import { computeAuditRecordChecksum } from './replay-audit-checksum';
import type { ReplayAuditRecord } from './replay-audit-types';
import type { ReplayAuditWriter } from './replay-audit-writer';

// ─── Retention Windows ────────────────────────────────────────────────────────

export const AUDIT_RETENTION = {
  QUERYABLE_DAYS: 90,
  ARCHIVAL_DAYS: 365,
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns records within queryable retention window (90 days).
 */
export function filterByRetention(
  records: readonly ReplayAuditRecord[],
  nowMs: number
): ReplayAuditRecord[] {
  const cutoff = nowMs - AUDIT_RETENTION.QUERYABLE_DAYS * MS_PER_DAY;
  return records.filter(r => r.at >= cutoff).slice();
}

// ─── Integrity Verification ───────────────────────────────────────────────────

/**
 * Verify all audit records in store have valid checksums.
 */
export function verifyReplayAuditIntegrity(writer: ReplayAuditWriter): {
  total: number;
  valid: number;
  corrupted: number;
  corrupted_ids: string[];
} {
  const all = writer.getAll();
  const corrupted_ids: string[] = [];

  for (const record of all) {
    const { record_checksum, ...rest } = record;
    const recomputed = computeAuditRecordChecksum(rest);
    if (recomputed !== record_checksum) {
      corrupted_ids.push(record.audit_record_id);
    }
  }

  return {
    total: all.length,
    valid: all.length - corrupted_ids.length,
    corrupted: corrupted_ids.length,
    corrupted_ids,
  };
}
