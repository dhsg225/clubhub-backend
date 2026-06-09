import { hashRecordExcluding } from '@clubhub/fnv-checksum';

export interface ReplayAuditRecord {
  readonly audit_record_id: string;
  readonly created_at: number;
  readonly screen_id: string;
  readonly venue_id: string;
  readonly at: number;
  readonly correlation_id: string;
  readonly playlist_checksum: string;
  readonly resolution_level: number;
  readonly is_fallback: boolean;
  readonly invariants_passed: boolean;
  readonly record_checksum: string;
}

export function verifyRecordIntegrity(record: ReplayAuditRecord): boolean {
  const expected = hashRecordExcluding(
    record as unknown as Record<string, unknown>,
    'record_checksum',
  );
  return record.record_checksum === expected;
}

export function verifyChainIntegrity(records: readonly ReplayAuditRecord[]): {
  valid: boolean;
  invalidRecords: string[];
} {
  const invalidRecords: string[] = [];
  for (const record of records) {
    if (!verifyRecordIntegrity(record)) {
      invalidRecords.push(record.audit_record_id);
    }
  }
  return { valid: invalidRecords.length === 0, invalidRecords };
}
