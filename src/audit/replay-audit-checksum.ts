/**
 * Deterministic checksum for replay audit records.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 */

import { fnv1a32 } from '../pre/algorithms/fnv1a32';
import { canonicalizeJson } from '../pre/algorithms/canonicalize-json';
import type { ReplayAuditRecord } from './replay-audit-types';

/**
 * Compute a deterministic checksum for a ReplayAuditRecord.
 * Excludes the record_checksum field itself from the computation.
 */
export function computeAuditRecordChecksum(
  record: Omit<ReplayAuditRecord, 'record_checksum'>
): string {
  return fnv1a32(canonicalizeJson(record));
}
