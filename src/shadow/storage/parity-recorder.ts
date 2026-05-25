/**
 * Immutable append-only parity record store.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §7
 *
 * Records are NEVER mutated or overwritten after insertion.
 * Every comparison produces a parity record — replay parity is constitutional authority.
 */

import { fnv1a32 } from '../../pre/algorithms/fnv1a32';
import { canonicalizeJson } from '../../pre/algorithms/canonicalize-json';
import type { CanaryStage, ParityRecord } from '../types';

// Re-export for convenience
export type { ParityRecord };

// ─── Recorder ─────────────────────────────────────────────────────────────────

/**
 * Immutable append-only parity record store.
 * In-memory implementation (production would persist to DB).
 */
export class ParityRecorder {
  private readonly records: ParityRecord[] = [];

  /** Append a new parity record. Throws if record with same invocation_id exists. */
  append(record: ParityRecord): void {
    const exists = this.records.some(r => r.invocation_id === record.invocation_id);
    if (exists) {
      throw new Error(
        `ParityRecorder: duplicate invocation_id "${record.invocation_id}". ` +
        `Parity records are immutable and cannot be overwritten.`
      );
    }
    this.records.push(record);
  }

  /** Get all records (read-only view) */
  getAll(): readonly ParityRecord[] {
    return this.records;
  }

  /** Get records in a time window [startMs, endMs] inclusive */
  getWindow(startMs: number, endMs: number): ParityRecord[] {
    return this.records.filter(r => r.timestamp >= startMs && r.timestamp <= endMs);
  }

  /** Get records by divergence class */
  getByClass(cls: number): ParityRecord[] {
    return this.records.filter(r => r.divergence_class === cls);
  }

  /** Count records matching a predicate */
  count(predicate: (r: ParityRecord) => boolean): number {
    return this.records.filter(predicate).length;
  }
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Build a ParityRecord with its deterministic_checksum.
 *
 * deterministic_checksum = fnv1a32(canonicalizeJson(record_without_checksum))
 */
export function buildParityRecord(
  invocation_id: string,
  timestamp: number,
  legacy_output_hash: string,
  pre_output_hash: string,
  divergence_class: number | null,
  diff_summary: string | null,
  canary_stage: CanaryStage,
): ParityRecord {
  // Compute checksum over all fields except the checksum itself
  const checksumInput = {
    invocation_id,
    timestamp,
    legacy_output_hash,
    pre_output_hash,
    divergence_class,
    diff_summary,
    replay_reference: invocation_id,
    canary_stage,
  };

  const deterministic_checksum = fnv1a32(canonicalizeJson(checksumInput));

  return {
    invocation_id,
    timestamp,
    legacy_output_hash,
    pre_output_hash,
    divergence_class,
    diff_summary,
    replay_reference: invocation_id,
    canary_stage,
    deterministic_checksum,
  };
}
