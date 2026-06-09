#!/usr/bin/env ts-node
/**
 * Compute EDGE-001 replacement fixture data.
 *
 * Uses corrected timestamp 1779735600000 = 2026-05-25T19:00:00Z = 2026-05-25T14:00:00 CDT (Monday)
 * to produce the correct input_hash, output_hash, and packet contents.
 *
 * Run from project root:
 *   npx ts-node scripts/compute-edge001-replacement.ts
 */

import { resolve as preResolve } from '../src/pre/index';
import type { PRE_Input } from '../src/pre/types';
import { fnv1a32 } from '../src/pre/algorithms/fnv1a32';
import { canonicalizeJson } from '../src/pre/algorithms/canonicalize-json';
import { computePacketHash } from '../src/pre/algorithms/sha256';

const AT = 1779735600000; // 2026-05-25T19:00:00Z = 2026-05-25T14:00:00 CDT (Monday)

const systemState = {
  area: { id: 'area-001', name: 'Main Dining', venue_id: 'venue-001' },
  campaigns: [{ id: 'camp-001', name: 'Summer Menu 2026', status: 'published' }],
  content_items: [{ duration_ms: 30000, id: 'content-001', is_active: true, type: 'video' }],
  emergency: null,
  last_delivery: null,
  organization: { id: 'org-001', name: 'Test Organization' },
  overrides: [],
  schedules: [{
    campaign_id: 'camp-001',
    content_id: null,
    days_of_week: [1],
    end_time_minutes: null,
    expires_at: null,
    id: 'sched-dow-001',
    is_active: true,
    is_fallback: false,
    priority: 100,
    specificity: 3,
    start_time_minutes: null,
    starts_at: 1748044800000,
    target_id: 'area-001',
    target_type: 'area' as const,
  }],
  screen: {
    area_id: 'area-001',
    id: 'screen-e01',
    last_checksum: null,
    last_seen_at: null,
    status: 'active' as const,
    tv_group_id: null,
    venue_id: 'venue-001',
  },
  sponsorships: [],
  tv_group: null,
  venue: {
    id: 'venue-001',
    is_active: true,
    name: 'Test Venue Chicago',
    org_id: 'org-001',
    timezone: 'America/Chicago',
  },
};

const input = { at: AT, screen_id: 'screen-e01', system_state: systemState } as unknown as PRE_Input;

console.log('Computing PRE.resolve() output for corrected EDGE-001...');
console.log('Input at:', AT, '=', new Date(AT).toISOString());
console.log('Day of week (0=Sun):', new Date(AT).getUTCDay(), '(UTC), local Monday in Chicago expected');
console.log('');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const output = preResolve(input) as any;

console.log('OUTPUT:');
console.log(JSON.stringify(output, null, 2));
console.log('');

const inputHash = fnv1a32(canonicalizeJson(input));
const outputHash = fnv1a32(canonicalizeJson(output));

console.log('input_hash:', inputHash);
console.log('output_hash:', outputHash);

// Build the full packet (without packet_hash) to compute packet_hash
const PACKET_ID = 'a1b2c3d4-e001-4000-8000-000000000111';
const CAPTURED_AT = 1748476800000; // 2026-05-23T00:00:00Z (today)

const packet = {
  archived_at: null,
  archived_by: null,
  archived_reason: null,
  capture_source: 'manual_authored',
  captured_at: CAPTURED_AT,
  captured_by: 'platform-team',
  constitution_version: 'v1',
  corpus_class: 'edge_case',
  description: 'EDGE-001v2: Schedule with days_of_week=[1] (Monday-only). Evaluation time is Monday 2026-05-25T14:00:00 CDT. Schedule is active. Tests day-of-week constraint with IANA timezone. Replaces EDGE-001 (packet a1b2c3d4-e001-4000-8000-000000000101) which had an incorrect timestamp (1748203200000 resolved to Sunday 2025-05-25, not Monday 2026-05-25).',
  expected_output: output,
  incident_id: null,
  input,
  input_hash: inputHash,
  invariants_under_test: ['INV-3', 'INV-9'],
  milestone_tag: null,
  output_hash: outputHash,
  packet_hash: '', // placeholder — will be replaced
  packet_id: PACKET_ID,
  packet_version: '1.0.0',
  pre_impl_version: '0.1.0',
  retirement_record_id: null,
  specification_refs: ['PRE §7.2', 'FIXTURES §5'],
  status: 'active',
  superseded_by: null,
};

const packetHash = computePacketHash(packet as Record<string, unknown>);
console.log('packet_hash:', packetHash);

// Emit final packet JSON
const finalPacket = { ...packet, packet_hash: packetHash };
console.log('');
console.log('FULL PACKET JSON:');
console.log(JSON.stringify(finalPacket));
