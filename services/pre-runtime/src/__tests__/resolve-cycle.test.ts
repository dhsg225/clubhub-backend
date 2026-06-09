/**
 * Integration test: PRE.resolve() cycle via corpus-mapper.
 *
 * Tests that a complete resolve cycle (CorpusPackage → PRE_Input → PRE_Output)
 * completes without errors and produces valid output structure.
 */
import { describe, it, expect } from 'vitest';
import { resolve } from '@clubhub/pre-engine';
import type { CorpusPackage } from '@clubhub/corpus-schema';
import { computeCorpusChecksum } from '@clubhub/corpus-schema';
import { buildPREInput } from '../corpus-mapper.js';

function makeMinimalCorpus(overrides: Partial<CorpusPackage['corpus']> = {}): CorpusPackage {
  const corpus = {
    venue_id: 'venue-001',
    campaigns: [],
    schedules: [],
    overrides: [],
    emergency_slots: [],
    compliance_slots: [],
    ...overrides,
  };
  return {
    version: 'v1.0.0',
    venue_id: 'venue-001',
    created_at: Date.now(),
    corpus,
    checksum: computeCorpusChecksum(corpus),
  };
}

describe('resolve cycle', () => {
  it('completes with empty corpus — returns fallback output', () => {
    const corpus = makeMinimalCorpus();
    const at = Date.now();
    const input = buildPREInput(corpus, 'screen-001', 'venue-001', at);

    expect(input.screen_id).toBe('screen-001');
    expect(input.at).toBe(at);
    expect(input.system_state.screen.id).toBe('screen-001');
    expect(input.system_state.venue.id).toBe('venue-001');

    const output = resolve(input);

    expect(output.screen_id).toBe('screen-001');
    expect(typeof output.playlist_checksum).toBe('string');
    expect(output.playlist_checksum.length).toBeGreaterThan(0);
    expect(Array.isArray(output.playlist)).toBe(true);
    expect(typeof output.resolution_level).toBe('number');
    expect(output.is_fallback).toBe(true); // empty corpus → fallback
    expect(output.output_schema_version).toBe('1.0.0');
  });

  it('maps campaign content into PRE_Input correctly', () => {
    const corpus = makeMinimalCorpus({
      campaigns: [
        {
          campaign_id: 'camp-001',
          resolution_level: 3,
          content_ids: ['content-abc', 'content-def'],
          duration_ms_sequence: [15000, 20000],
        },
      ],
      schedules: [
        {
          schedule_id: 'sched-001',
          campaign_id: 'camp-001',
          days_of_week: [1, 2, 3, 4, 5],
          start_time_hhmm: 900,   // 09:00
          end_time_hhmm: 1700,    // 17:00
          valid_from_utc: 0,
          valid_until_utc: null,
        },
      ],
    });

    const input = buildPREInput(corpus, 'screen-001', 'venue-001', Date.now());

    expect(input.system_state.campaigns).toHaveLength(1);
    expect(input.system_state.campaigns[0]!.id).toBe('camp-001');

    expect(input.system_state.content_items).toHaveLength(2);
    const abc = input.system_state.content_items.find((c) => c.id === 'content-abc');
    expect(abc?.duration_ms).toBe(15000);

    expect(input.system_state.schedules).toHaveLength(1);
    expect(input.system_state.schedules[0]!.start_time_minutes).toBe(9 * 60);   // 540
    expect(input.system_state.schedules[0]!.end_time_minutes).toBe(17 * 60);    // 1020

    // Resolve still completes (content not currently active at epoch+0 — fallback expected)
    const output = resolve(input);
    expect(output).toBeDefined();
    expect(typeof output.playlist_checksum).toBe('string');
  });

  it('hhmm_to_minutes: midnight and end-of-day', () => {
    const corpus = makeMinimalCorpus({
      campaigns: [{ campaign_id: 'c', resolution_level: 3, content_ids: ['x'], duration_ms_sequence: [10000] }],
      schedules: [
        {
          schedule_id: 's1',
          campaign_id: 'c',
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          start_time_hhmm: 0,     // 00:00 midnight
          end_time_hhmm: 2359,    // 23:59
          valid_from_utc: 0,
          valid_until_utc: null,
        },
      ],
    });
    const input = buildPREInput(corpus, 'screen-001', 'venue-001', Date.now());
    expect(input.system_state.schedules[0]!.start_time_minutes).toBe(0);
    expect(input.system_state.schedules[0]!.end_time_minutes).toBe(23 * 60 + 59);
  });
});
