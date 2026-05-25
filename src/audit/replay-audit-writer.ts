/**
 * Append-only audit record store.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * In-memory implementation — production would use DB append-only table.
 * NEVER updates or overwrites records.
 */

import { randomUUID } from 'crypto';
import { fnv1a32 } from '../pre/algorithms/fnv1a32';
import { canonicalizeJson } from '../pre/algorithms/canonicalize-json';
import { computeAuditRecordChecksum } from './replay-audit-checksum';
import type { ReplayAuditRecord } from './replay-audit-types';
import type { PRE_Output } from '../pre/types';

export type { ReplayAuditRecord };

// ─── Audit Writer ─────────────────────────────────────────────────────────────

/**
 * Append-only audit record store.
 * Records are immutable after insertion.
 */
export class ReplayAuditWriter {
  private readonly records: ReplayAuditRecord[] = [];

  /**
   * Append record. Throws if audit_record_id already exists.
   */
  write(record: ReplayAuditRecord): void {
    const exists = this.records.some(r => r.audit_record_id === record.audit_record_id);
    if (exists) {
      throw new Error(
        `ReplayAuditWriter: duplicate audit_record_id "${record.audit_record_id}". ` +
        'Audit records are immutable and cannot be overwritten.'
      );
    }
    this.records.push(record);
  }

  /**
   * Verify record integrity by recomputing the checksum and comparing.
   */
  verifyRecord(record: ReplayAuditRecord): boolean {
    const { record_checksum, ...rest } = record;
    const recomputed = computeAuditRecordChecksum(rest);
    return recomputed === record_checksum;
  }

  /** Get all records (read-only view) */
  getAll(): readonly ReplayAuditRecord[] {
    return this.records;
  }

  count(): number {
    return this.records.length;
  }
}

// ─── Audit Record Builder ─────────────────────────────────────────────────────

/**
 * Build a complete ReplayAuditRecord with checksum.
 */
export function buildAuditRecord(
  screenId: string,
  at: number,
  correlationId: string,
  preOutput: PRE_Output,
  divergenceClass: number | null,
  entropyScore: number | null,
  shadowParity: number | null,
  invariantsPassed: boolean,
): ReplayAuditRecord {
  const audit_record_id = randomUUID();
  const audit_written_at = Date.now();

  const pre_output_hash = fnv1a32(canonicalizeJson(preOutput));

  const withoutChecksum: Omit<ReplayAuditRecord, 'record_checksum'> = {
    audit_record_id,
    screen_id: screenId,
    at,
    correlation_id: correlationId,
    pre_output_hash,
    playlist_checksum: preOutput.playlist_checksum,
    resolution_level: preOutput.resolution_level,
    is_fallback: preOutput.is_fallback,
    divergence_class: divergenceClass,
    entropy_score_snapshot: entropyScore,
    shadow_parity_snapshot: shadowParity,
    invariants_passed: invariantsPassed,
    audit_written_at,
  };

  const record_checksum = computeAuditRecordChecksum(withoutChecksum);

  return { ...withoutChecksum, record_checksum };
}
