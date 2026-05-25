/**
 * Replay API — read-only access to audit records.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Routes:
 *   GET /replay/:packet_id — retrieve audit record by ID
 */

import type { ReplayAuditRecord } from '../audit/replay-audit-types';
import type { ReplayAuditWriter } from '../audit/replay-audit-writer';
import { assertDeterministicResponse, assertReadOnlyRoute } from './api-contracts';

// ─── API Types ────────────────────────────────────────────────────────────────

export interface ReplayApiRequest {
  packet_id: string;
  correlation_id: string;
}

export interface ReplayApiResponse {
  correlation_id: string;
  record: ReplayAuditRecord | null;
  found: boolean;
  /** Checksum verification result */
  integrity_valid: boolean;
}

// ─── Replay Request Handler ───────────────────────────────────────────────────

/**
 * Handle a replay audit lookup request.
 * Read-only. Returns record with integrity verification.
 */
export function handleReplayRequest(
  request: ReplayApiRequest,
  auditWriter: ReplayAuditWriter,
): ReplayApiResponse {
  assertReadOnlyRoute('handleReplayRequest');

  const record = auditWriter.getAll().find(r => r.audit_record_id === request.packet_id) ?? null;

  const found = record !== null;
  const integrity_valid = found ? auditWriter.verifyRecord(record as ReplayAuditRecord) : false;

  const response: ReplayApiResponse = {
    correlation_id: request.correlation_id,
    record,
    found,
    integrity_valid,
  };

  assertDeterministicResponse(response);

  return response;
}
