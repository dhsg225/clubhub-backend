/**
 * @clubhub/corpus-schema
 *
 * Corpus package schema definitions and validators.
 * Used by: cms-api (authoring validation), player-runtime (ingestion),
 *          corpus-publisher (signing validation).
 *
 * Constitutional: corpus is DATA to the CMS — never CODE.
 * cms-api MUST NOT import @clubhub/pre-engine.
 */

import type { SystemStateSnapshot } from '@clubhub/pre-types';
import { fnv1a32, canonicalizeJson } from '@clubhub/fnv-checksum';

// Re-export the import so it is used (satisfies verbatimModuleSyntax)
export type { SystemStateSnapshot };

export interface CorpusPackage {
  readonly version: string;
  readonly venue_id: string;
  readonly created_at: number;
  readonly corpus: SerializedCorpus;
  readonly checksum: string; // fnv1a32(canonicalizeJson(corpus))
  readonly signature?: string; // set by corpus-publisher
}

export interface SerializedCorpus {
  readonly venue_id: string;
  readonly campaigns: readonly SerializedCampaign[];
  readonly schedules: readonly SerializedSchedule[];
  readonly overrides: readonly SerializedOverride[];
  readonly emergency_slots: readonly SerializedEmergencySlot[];
  readonly compliance_slots: readonly SerializedComplianceSlot[];
}

export interface SerializedCampaign {
  readonly campaign_id: string;
  readonly resolution_level: 2 | 3 | 4; // L2=venue schedule, L3=campaign, L4=sponsor
  readonly content_ids: readonly string[];
  readonly duration_ms_sequence: readonly number[];
}

export interface SerializedSchedule {
  readonly schedule_id: string;
  readonly campaign_id: string;
  readonly days_of_week: readonly number[]; // 0=Sun, 6=Sat
  readonly start_time_hhmm: number; // e.g. 900 = 09:00
  readonly end_time_hhmm: number;
  readonly valid_from_utc: number; // ms timestamp
  readonly valid_until_utc: number | null;
}

export interface SerializedOverride {
  readonly override_id: string;
  readonly resolution_level: 0 | 1 | 2;
  readonly content_ids: readonly string[];
  readonly duration_ms_sequence: readonly number[];
  readonly active_from_utc: number;
  readonly active_until_utc: number | null;
}

export interface SerializedEmergencySlot {
  readonly slot_id: string;
  readonly content_ids: readonly string[];
  readonly duration_ms_sequence: readonly number[];
}

export interface SerializedComplianceSlot {
  readonly slot_id: string;
  readonly resolution_level: 1; // always L1
  readonly content_ids: readonly string[];
  readonly minimum_frequency_per_hour: number; // e.g. 2 = minimum 2x per hour
  readonly compliance_type: 'RESPONSIBLE_GAMBLING' | 'LIQUOR_LICENCE' | 'GENERAL';
}

export function computeCorpusChecksum(corpus: SerializedCorpus): string {
  return fnv1a32(canonicalizeJson(corpus as unknown as Record<string, unknown>))
    .toString(16)
    .padStart(8, '0');
}

export function validateCorpusPackage(pkg: CorpusPackage): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const expectedChecksum = computeCorpusChecksum(pkg.corpus);
  if (pkg.checksum !== expectedChecksum) {
    errors.push(
      `Corpus checksum mismatch: expected ${expectedChecksum}, got ${pkg.checksum}`,
    );
  }
  if (!pkg.venue_id) errors.push('Missing venue_id');
  if (!pkg.version) errors.push('Missing version');
  if (pkg.created_at <= 0) errors.push('Invalid created_at');
  return { valid: errors.length === 0, errors };
}
