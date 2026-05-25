/**
 * Read-only access to replay audit records.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 */

import type { ReplayAuditRecord } from './replay-audit-types';
import type { ReplayAuditWriter } from './replay-audit-writer';

export class ReplayAuditReader {
  constructor(private readonly writer: ReplayAuditWriter) {}

  getByScreenId(screenId: string): ReplayAuditRecord[] {
    return this.writer.getAll().filter(r => r.screen_id === screenId).slice();
  }

  getWindow(startMs: number, endMs: number): ReplayAuditRecord[] {
    return this.writer.getAll()
      .filter(r => r.at >= startMs && r.at <= endMs)
      .slice();
  }

  getByDivergenceClass(cls: number): ReplayAuditRecord[] {
    return this.writer.getAll().filter(r => r.divergence_class === cls).slice();
  }

  getById(auditRecordId: string): ReplayAuditRecord | undefined {
    return this.writer.getAll().find(r => r.audit_record_id === auditRecordId);
  }
}
