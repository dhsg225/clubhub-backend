/**
 * Audit repository — append-only replay audit record writer.
 *
 * Constitutional rules:
 * - Records are NEVER updated or deleted
 * - record_checksum covers all fields except itself
 * - Uses DB transaction for each write
 */
import { fnv1a32, canonicalizeJson } from '@clubhub/fnv-checksum';
import type { PRE_Output } from '../pre-types.js';
import { withTransaction } from '../pool.js';
import * as crypto from 'node:crypto';

export interface AuditRecord {
  readonly audit_record_id: string;
  readonly created_at: string;     // ISO timestamp
  readonly screen_id: string;
  readonly venue_id: string;
  readonly at_utc_ms: number;
  readonly correlation_id: string;
  readonly playlist_checksum: string;
  readonly resolution_level: number;
  readonly is_fallback: boolean;
  readonly invariants_passed: boolean;
  readonly record_checksum: string;
}

/** Compute the record_checksum (fnv1a32 of all fields except record_checksum itself). */
function computeRecordChecksum(record: Omit<AuditRecord, 'record_checksum'>): string {
  return fnv1a32(canonicalizeJson(record)).toString(16).padStart(8, '0');
}

/**
 * Persist a replay audit record.
 * Throws on DB error — audit failures are not silent.
 */
export async function writeAuditRecord(
  preOutput: PRE_Output,
  screenId: string,
  venueId: string,
  atMs: number,
  correlationId: string,
  invariantsPassed: boolean,
): Promise<AuditRecord> {
  const auditRecordId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const recordWithoutChecksum = {
    audit_record_id: auditRecordId,
    created_at: createdAt,
    screen_id: screenId,
    venue_id: venueId,
    at_utc_ms: atMs,
    correlation_id: correlationId,
    playlist_checksum: preOutput.playlist_checksum,
    resolution_level: preOutput.resolution_level,
    is_fallback: preOutput.is_fallback,
    invariants_passed: invariantsPassed,
  };

  const record_checksum = computeRecordChecksum(recordWithoutChecksum);
  const record: AuditRecord = { ...recordWithoutChecksum, record_checksum };

  await withTransaction(async (txQuery) => {
    await txQuery(
      `INSERT INTO replay_audit_records (
        audit_record_id, created_at, screen_id, venue_id,
        at_utc_ms, correlation_id, playlist_checksum,
        resolution_level, is_fallback, invariants_passed, record_checksum
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        record.audit_record_id,
        record.created_at,
        record.screen_id,
        record.venue_id,
        record.at_utc_ms,
        record.correlation_id,
        record.playlist_checksum,
        record.resolution_level,
        record.is_fallback,
        record.invariants_passed,
        record.record_checksum,
      ],
    );
  });

  return record;
}

/** Write a delivery log entry (for PRE's last_delivery confidence scoring). */
export async function writeDeliveryLog(
  screenId: string,
  playlistChecksum: string,
  resolutionLevel: number,
): Promise<void> {
  await withTransaction(async (txQuery) => {
    await txQuery(
      `INSERT INTO screen_delivery_log (screen_id, playlist_checksum, resolution_level)
       VALUES ($1, $2, $3)`,
      [screenId, playlistChecksum, resolutionLevel],
    );
  });
}
