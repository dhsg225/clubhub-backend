#!/usr/bin/env ts-node
/**
 * Seeds the initial corpus fixtures (GOLD-003 through GOLD-005, EDGE-001 through EDGE-003, CHAOS-001).
 * Computes all three hashes and writes sealed packets to corpus/.
 *
 * This is a one-time seeding script. After initial seeding, new fixtures are added
 * via author-fixture.ts individually.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { canonicalizeJson } from '../src/pre/algorithms/canonicalize-json';
import { fnv1a32 } from '../src/pre/algorithms/fnv1a32';
import { computePacketHash } from '../src/pre/algorithms/sha256';

const ROOT = join(__dirname, '..');

function playlistChecksum(playlist: unknown[]): string {
  return fnv1a32(canonicalizeJson(playlist));
}

function sealPacket(packet: Record<string, unknown>): Record<string, unknown> {
  packet['input_hash']  = fnv1a32(canonicalizeJson(packet['input']));
  packet['output_hash'] = fnv1a32(canonicalizeJson(packet['expected_output']));
  delete packet['packet_hash'];
  packet['packet_hash'] = computePacketHash(packet);
  return packet;
}

function writePacket(packet: Record<string, unknown>, filePath: string): void {
  writeFileSync(filePath, canonicalizeJson(packet) + '\n', 'utf8');
  console.log(`✓ ${filePath.split('/').pop()} — output_hash=${packet['output_hash']}`);
}

const BASE = {
  packet_version: '1.0.0',
  captured_at: 1748044800000,
  capture_source: 'manual_authored',
  captured_by: 'platform-team',
  pre_impl_version: '0.1.0',
  constitution_version: 'v1',
  incident_id: null,
  milestone_tag: null,
  status: 'active',
  archived_at: null,
  archived_by: null,
  archived_reason: null,
  retirement_record_id: null,
  superseded_by: null,
};

const VENUE_CHICAGO = {
  id: 'venue-001',
  is_active: true,
  name: 'Test Venue Chicago',
  org_id: 'org-001',
  timezone: 'America/Chicago',
};

const ORG = { id: 'org-001', name: 'Test Organization' };

const EMPTY_TRACE_PREFIX = {
  level_0_emergency: null,
  level_1_operational: null,
  level_2_scheduled: null,
};

// ─── GOLD-003: Emergency Override ─────────────────────────────────────────────
// Active emergency → LEVEL_0, only emergency content in playlist.
// Tests INV-7 (Emergency Absoluteness).

const gold003Playlist = [{ content_id: 'emergency-content-001', duration_ms: 10000, source: 0, sponsored: false, weight: 100 }];
const gold003 = sealPacket({
  ...BASE,
  packet_id: 'a1b2c3d4-0003-4000-8000-000000000003',
  corpus_class: 'golden',
  description: 'GOLD-003: Active emergency overrides all other content. LEVEL_0 resolution. Emergency content is sole playlist item. Tests INV-7 (Emergency Absoluteness).',
  invariants_under_test: ['INV-7', 'INV-2', 'INV-6'],
  specification_refs: ['PRE §4.1', 'CONST §10.7', 'FIXTURES §4.5'],
  input: {
    screen_id: 'screen-003',
    at: 1748390400000,
    system_state: {
      area: { id: 'area-001', name: 'Main Dining', venue_id: 'venue-001' },
      campaigns: [{ id: 'camp-001', name: 'Summer Menu 2026', status: 'published' }],
      content_items: [
        { duration_ms: 30000, id: 'content-001', is_active: true, type: 'video' },
        { duration_ms: 10000, id: 'emergency-content-001', is_active: true, type: 'emergency' },
      ],
      emergency: {
        id: 'emergency-001',
        activated_at: 1748390000000,
        content_id: 'emergency-content-001',
        is_active: true,
        is_global: false,
        reason: 'Fire alarm — evacuation in progress',
        venue_id: 'venue-001',
      },
      last_delivery: null,
      organization: ORG,
      overrides: [],
      schedules: [{
        campaign_id: 'camp-001', content_id: null, days_of_week: [], end_time_minutes: null,
        expires_at: null, id: 'sched-001', is_active: true, is_fallback: false, priority: 100,
        specificity: 3, start_time_minutes: null, starts_at: 1748304000000,
        target_id: 'area-001', target_type: 'area',
      }],
      screen: { area_id: 'area-001', id: 'screen-003', last_checksum: null, last_seen_at: null, status: 'active', tv_group_id: null, venue_id: 'venue-001' },
      sponsorships: [],
      tv_group: null,
      venue: VENUE_CHICAGO,
    },
  },
  expected_output: {
    confidence_score: 0.5,
    content_mix: { campaign_pct: 0.0, fallback_pct: 0.0, override_pct: 0.0, sponsor_pct: 0.0, system_pct: 0.0 },
    is_fallback: false,
    output_schema_version: '1.0.0',
    playlist: gold003Playlist,
    playlist_checksum: playlistChecksum(gold003Playlist),
    reason_trace: {
      ...EMPTY_TRACE_PREFIX,
      level_0_emergency: { content_id: 'emergency-content-001', emergency_id: 'emergency-001', outcome: 'RESOLVED', reason: 'L0:EMERGENCY:id=emergency-001,venue-scoped,reason=Fire alarm — evacuation in progress' },
      level_1_operational: null,
      level_2_scheduled: null,
      level_3_campaign: null,
      level_4_sponsorship: null,
      level_5_structural: null,
      level_6_device_truth: { checksum_match: false, confidence_score: 0.5, last_seen_ms_ago: null, outcome: 'RESOLVED', reason: 'L6:CONFIDENCE:0.5000,no_delivery_log' },
    },
    resolution_level: 0,
    resolved_at: 1748390400000,
    screen_id: 'screen-003',
    version: 1,
  },
});

// ─── GOLD-004: Operational Override (LEVEL_1) ─────────────────────────────────

const gold004Playlist = [{ content_id: 'override-content-001', duration_ms: 20000, source: 1, sponsored: false, weight: 100 }];
const gold004 = sealPacket({
  ...BASE,
  packet_id: 'a1b2c3d4-0004-4000-8000-000000000004',
  corpus_class: 'golden',
  description: 'GOLD-004: Operational override (is_operational=true) takes precedence over campaign schedule. LEVEL_1 resolution. Tests INV-5 (Level Termination).',
  invariants_under_test: ['INV-5', 'INV-2', 'INV-6'],
  specification_refs: ['PRE §4.2', 'CONST §10.5'],
  input: {
    screen_id: 'screen-004',
    at: 1748390400000,
    system_state: {
      area: { id: 'area-001', name: 'Main Dining', venue_id: 'venue-001' },
      campaigns: [{ id: 'camp-001', name: 'Summer Menu 2026', status: 'published' }],
      content_items: [
        { duration_ms: 30000, id: 'content-001', is_active: true, type: 'video' },
        { duration_ms: 20000, id: 'override-content-001', is_active: true, type: 'video' },
      ],
      emergency: null,
      last_delivery: null,
      organization: ORG,
      overrides: [{
        content_id: 'override-content-001',
        expires_at: null,
        id: 'override-001',
        is_operational: true,
        issued_by: 'manager-001',
        priority: 200,
        reason: 'Special event promotion',
        starts_at: 1748304000000,
        target_id: 'screen-004',
        target_type: 'screen',
      }],
      schedules: [{
        campaign_id: 'camp-001', content_id: null, days_of_week: [], end_time_minutes: null,
        expires_at: null, id: 'sched-001', is_active: true, is_fallback: false, priority: 100,
        specificity: 3, start_time_minutes: null, starts_at: 1748304000000,
        target_id: 'area-001', target_type: 'area',
      }],
      screen: { area_id: 'area-001', id: 'screen-004', last_checksum: null, last_seen_at: null, status: 'active', tv_group_id: null, venue_id: 'venue-001' },
      sponsorships: [],
      tv_group: null,
      venue: VENUE_CHICAGO,
    },
  },
  expected_output: {
    confidence_score: 0.5,
    content_mix: { campaign_pct: 0.0, fallback_pct: 0.0, override_pct: 1.0, sponsor_pct: 0.0, system_pct: 0.0 },
    is_fallback: false,
    output_schema_version: '1.0.0',
    playlist: gold004Playlist,
    playlist_checksum: playlistChecksum(gold004Playlist),
    reason_trace: {
      level_0_emergency: null,
      level_1_operational: { content_id: 'override-content-001', outcome: 'RESOLVED', override_id: 'override-001', reason: 'L1:OPERATIONAL_OVERRIDE:id=override-001,target=screen-004,reason=Special event promotion' },
      level_2_scheduled: null,
      level_3_campaign: null,
      level_4_sponsorship: null,
      level_5_structural: null,
      level_6_device_truth: { checksum_match: false, confidence_score: 0.5, last_seen_ms_ago: null, outcome: 'RESOLVED', reason: 'L6:CONFIDENCE:0.5000,no_delivery_log' },
    },
    resolution_level: 1,
    resolved_at: 1748390400000,
    screen_id: 'screen-004',
    version: 1,
  },
});

// ─── GOLD-005: System Fallback (LEVEL_5) ──────────────────────────────────────
// No emergency, no overrides, no active campaign schedules, no sponsorships.
// PRE falls to LEVEL_5 structural fallback. Tests INV-2 (Totality).

const gold005Playlist = [{ content_id: 'system:fallback:v1', duration_ms: 30000, source: 5, sponsored: false, weight: 100 }];
const gold005 = sealPacket({
  ...BASE,
  packet_id: 'a1b2c3d4-0005-4000-8000-000000000005',
  corpus_class: 'golden',
  description: 'GOLD-005: All resolution levels skip. PRE falls to LEVEL_5 system fallback. Output contains system:fallback:v1. Tests INV-2 (Totality) — system always produces output.',
  invariants_under_test: ['INV-2', 'INV-5', 'INV-10'],
  specification_refs: ['PRE §9.1', 'CONST §10.2', 'FIXTURES §4.7'],
  input: {
    screen_id: 'screen-005',
    at: 1748390400000,
    system_state: {
      area: { id: 'area-001', name: 'Main Dining', venue_id: 'venue-001' },
      campaigns: [],
      content_items: [],
      emergency: null,
      last_delivery: null,
      organization: ORG,
      overrides: [],
      schedules: [],
      screen: { area_id: 'area-001', id: 'screen-005', last_checksum: null, last_seen_at: null, status: 'active', tv_group_id: null, venue_id: 'venue-001' },
      sponsorships: [],
      tv_group: null,
      venue: VENUE_CHICAGO,
    },
  },
  expected_output: {
    confidence_score: 0.5,
    content_mix: { campaign_pct: 0.0, fallback_pct: 0.0, override_pct: 0.0, sponsor_pct: 0.0, system_pct: 1.0 },
    is_fallback: true,
    output_schema_version: '1.0.0',
    playlist: gold005Playlist,
    playlist_checksum: playlistChecksum(gold005Playlist),
    reason_trace: {
      level_0_emergency: null,
      level_1_operational: null,
      level_2_scheduled: null,
      level_3_campaign: null,
      level_4_sponsorship: null,
      level_5_structural: { outcome: 'RESOLVED', reason: 'L5:SYSTEM_FALLBACK:no_content_sources_active' },
      level_6_device_truth: { checksum_match: false, confidence_score: 0.5, last_seen_ms_ago: null, outcome: 'RESOLVED', reason: 'L6:CONFIDENCE:0.5000,no_delivery_log' },
    },
    resolution_level: 5,
    resolved_at: 1748390400000,
    screen_id: 'screen-005',
    version: 1,
  },
});

// ─── EDGE-001: Schedule with day-of-week constraint — active ──────────────────
// Schedule has days_of_week=[1] (Monday). at=1748390400000 is 2026-05-27T19:00:00Z.
// In America/Chicago (CDT = UTC-5), that is 2026-05-27T14:00:00 CDT = Wednesday (day 3).
// Wait — need a timestamp that IS Monday for this to test the "active" case.
// 2026-05-25 is a Monday. 2026-05-25T19:00:00Z = 2026-05-25T14:00:00 CDT (Monday = day 1).
// at = 1748203200000 (2026-05-25T19:00:00Z)

const edge001Playlist = [{ content_id: 'content-001', duration_ms: 30000, source: 3, sponsored: false, weight: 100 }];
const edge001 = sealPacket({
  ...BASE,
  packet_id: 'a1b2c3d4-e001-4000-8000-000000000101',
  corpus_class: 'edge_case',
  description: 'EDGE-001: Schedule with days_of_week=[1] (Monday-only). Evaluation time is Monday 2026-05-25T14:00:00 CDT. Schedule is active. Tests day-of-week constraint with IANA timezone.',
  invariants_under_test: ['INV-3', 'INV-9'],
  specification_refs: ['PRE §7.2', 'FIXTURES §5'],
  input: {
    screen_id: 'screen-e01',
    at: 1748203200000,
    system_state: {
      area: { id: 'area-001', name: 'Main Dining', venue_id: 'venue-001' },
      campaigns: [{ id: 'camp-001', name: 'Summer Menu 2026', status: 'published' }],
      content_items: [{ duration_ms: 30000, id: 'content-001', is_active: true, type: 'video' }],
      emergency: null,
      last_delivery: null,
      organization: ORG,
      overrides: [],
      schedules: [{
        campaign_id: 'camp-001', content_id: null, days_of_week: [1],
        end_time_minutes: null, expires_at: null, id: 'sched-dow-001',
        is_active: true, is_fallback: false, priority: 100, specificity: 3,
        start_time_minutes: null, starts_at: 1748044800000,
        target_id: 'area-001', target_type: 'area',
      }],
      screen: { area_id: 'area-001', id: 'screen-e01', last_checksum: null, last_seen_at: null, status: 'active', tv_group_id: null, venue_id: 'venue-001' },
      sponsorships: [],
      tv_group: null,
      venue: VENUE_CHICAGO,
    },
  },
  expected_output: {
    confidence_score: 0.5,
    content_mix: { campaign_pct: 1.0, fallback_pct: 0.0, override_pct: 0.0, sponsor_pct: 0.0, system_pct: 0.0 },
    is_fallback: false,
    output_schema_version: '1.0.0',
    playlist: edge001Playlist,
    playlist_checksum: playlistChecksum(edge001Playlist),
    reason_trace: {
      level_0_emergency: null,
      level_1_operational: null,
      level_2_scheduled: null,
      level_3_campaign: { campaign_id: 'camp-001', campaign_name: 'Summer Menu 2026', outcome: 'RESOLVED', reason: 'L3:CAMPAIGN:schedule_id=sched-dow-001,campaign=Summer Menu 2026,specificity=AREA,won_by=only_active_rule,dow_constraint=Monday_active', schedule_id: 'sched-dow-001', specificity: 3, won_by: 'only_active_rule' },
      level_4_sponsorship: { contracts_active: 0, injected_items: 0, outcome: 'SKIP', reason: 'L4:SKIP:no_active_sponsorship_contracts', sov_warning_active: false, total_sov_pct: 0.0 },
      level_5_structural: { outcome: 'RESOLVED', reason: 'L5:NORMALIZED:1_item,source=campaign' },
      level_6_device_truth: { checksum_match: false, confidence_score: 0.5, last_seen_ms_ago: null, outcome: 'RESOLVED', reason: 'L6:CONFIDENCE:0.5000,no_delivery_log' },
    },
    resolution_level: 3,
    resolved_at: 1748203200000,
    screen_id: 'screen-e01',
    version: 1,
  },
});

// ─── EDGE-002: Schedule with day-of-week constraint — inactive ─────────────────
// Same schedule (days_of_week=[1]) but at is Wednesday → schedule inactive → fallback.

const edge002Playlist = [{ content_id: 'system:fallback:v1', duration_ms: 30000, source: 5, sponsored: false, weight: 100 }];
const edge002 = sealPacket({
  ...BASE,
  packet_id: 'a1b2c3d4-e002-4000-8000-000000000102',
  corpus_class: 'edge_case',
  description: 'EDGE-002: Schedule with days_of_week=[1] (Monday-only). Evaluation time is Wednesday 2026-05-27T14:00:00 CDT. Schedule is inactive due to DOW constraint. Falls to LEVEL_5 system fallback.',
  invariants_under_test: ['INV-2', 'INV-3', 'INV-9'],
  specification_refs: ['PRE §7.2', 'FIXTURES §5'],
  input: {
    screen_id: 'screen-e02',
    at: 1748390400000,
    system_state: {
      area: { id: 'area-001', name: 'Main Dining', venue_id: 'venue-001' },
      campaigns: [{ id: 'camp-001', name: 'Summer Menu 2026', status: 'published' }],
      content_items: [{ duration_ms: 30000, id: 'content-001', is_active: true, type: 'video' }],
      emergency: null,
      last_delivery: null,
      organization: ORG,
      overrides: [],
      schedules: [{
        campaign_id: 'camp-001', content_id: null, days_of_week: [1],
        end_time_minutes: null, expires_at: null, id: 'sched-dow-001',
        is_active: true, is_fallback: false, priority: 100, specificity: 3,
        start_time_minutes: null, starts_at: 1748044800000,
        target_id: 'area-001', target_type: 'area',
      }],
      screen: { area_id: 'area-001', id: 'screen-e02', last_checksum: null, last_seen_at: null, status: 'active', tv_group_id: null, venue_id: 'venue-001' },
      sponsorships: [],
      tv_group: null,
      venue: VENUE_CHICAGO,
    },
  },
  expected_output: {
    confidence_score: 0.5,
    content_mix: { campaign_pct: 0.0, fallback_pct: 0.0, override_pct: 0.0, sponsor_pct: 0.0, system_pct: 1.0 },
    is_fallback: true,
    output_schema_version: '1.0.0',
    playlist: edge002Playlist,
    playlist_checksum: playlistChecksum(edge002Playlist),
    reason_trace: {
      level_0_emergency: null,
      level_1_operational: null,
      level_2_scheduled: null,
      level_3_campaign: null,
      level_4_sponsorship: null,
      level_5_structural: { outcome: 'RESOLVED', reason: 'L5:SYSTEM_FALLBACK:no_content_sources_active,schedule_dow_mismatch' },
      level_6_device_truth: { checksum_match: false, confidence_score: 0.5, last_seen_ms_ago: null, outcome: 'RESOLVED', reason: 'L6:CONFIDENCE:0.5000,no_delivery_log' },
    },
    resolution_level: 5,
    resolved_at: 1748390400000,
    screen_id: 'screen-e02',
    version: 1,
  },
});

// ─── EDGE-003: Expired override — falls through to campaign ───────────────────
// An operational override exists but expires_at is in the past.
// PRE skips LEVEL_1, resolves at LEVEL_3.

const edge003Playlist = [{ content_id: 'content-001', duration_ms: 30000, source: 3, sponsored: false, weight: 100 }];
const edge003 = sealPacket({
  ...BASE,
  packet_id: 'a1b2c3d4-e003-4000-8000-000000000103',
  corpus_class: 'edge_case',
  description: 'EDGE-003: Override with expires_at in the past is treated as inactive. PRE skips LEVEL_1 and resolves campaign at LEVEL_3. Tests half-open interval semantics [starts_at, expires_at).',
  invariants_under_test: ['INV-3', 'INV-5'],
  specification_refs: ['PRE §4.2', 'PRE §7.1', 'FIXTURES §5'],
  input: {
    screen_id: 'screen-e03',
    at: 1748390400000,
    system_state: {
      area: { id: 'area-001', name: 'Main Dining', venue_id: 'venue-001' },
      campaigns: [{ id: 'camp-001', name: 'Summer Menu 2026', status: 'published' }],
      content_items: [
        { duration_ms: 30000, id: 'content-001', is_active: true, type: 'video' },
        { duration_ms: 20000, id: 'override-content-001', is_active: true, type: 'video' },
      ],
      emergency: null,
      last_delivery: null,
      organization: ORG,
      overrides: [{
        content_id: 'override-content-001',
        expires_at: 1748390399000,
        id: 'override-expired-001',
        is_operational: true,
        issued_by: 'manager-001',
        priority: 200,
        reason: 'Past event',
        starts_at: 1748304000000,
        target_id: 'screen-e03',
        target_type: 'screen',
      }],
      schedules: [{
        campaign_id: 'camp-001', content_id: null, days_of_week: [], end_time_minutes: null,
        expires_at: null, id: 'sched-001', is_active: true, is_fallback: false, priority: 100,
        specificity: 3, start_time_minutes: null, starts_at: 1748304000000,
        target_id: 'area-001', target_type: 'area',
      }],
      screen: { area_id: 'area-001', id: 'screen-e03', last_checksum: null, last_seen_at: null, status: 'active', tv_group_id: null, venue_id: 'venue-001' },
      sponsorships: [],
      tv_group: null,
      venue: VENUE_CHICAGO,
    },
  },
  expected_output: {
    confidence_score: 0.5,
    content_mix: { campaign_pct: 1.0, fallback_pct: 0.0, override_pct: 0.0, sponsor_pct: 0.0, system_pct: 0.0 },
    is_fallback: false,
    output_schema_version: '1.0.0',
    playlist: edge003Playlist,
    playlist_checksum: playlistChecksum(edge003Playlist),
    reason_trace: {
      level_0_emergency: null,
      level_1_operational: { outcome: 'SKIP', reason: 'L1:SKIP:override_expired,expires_at=1748390399000,at=1748390400000' },
      level_2_scheduled: null,
      level_3_campaign: { campaign_id: 'camp-001', campaign_name: 'Summer Menu 2026', outcome: 'RESOLVED', reason: 'L3:CAMPAIGN:schedule_id=sched-001,campaign=Summer Menu 2026,specificity=AREA,won_by=only_active_rule', schedule_id: 'sched-001', specificity: 3, won_by: 'only_active_rule' },
      level_4_sponsorship: { contracts_active: 0, injected_items: 0, outcome: 'SKIP', reason: 'L4:SKIP:no_active_sponsorship_contracts', sov_warning_active: false, total_sov_pct: 0.0 },
      level_5_structural: { outcome: 'RESOLVED', reason: 'L5:NORMALIZED:1_item,source=campaign' },
      level_6_device_truth: { checksum_match: false, confidence_score: 0.5, last_seen_ms_ago: null, outcome: 'RESOLVED', reason: 'L6:CONFIDENCE:0.5000,no_delivery_log' },
    },
    resolution_level: 3,
    resolved_at: 1748390400000,
    screen_id: 'screen-e03',
    version: 1,
  },
});

// ─── CHAOS-001: DB unavailable — PRE receives empty system state ───────────────
// When DB is unavailable, PRE receives a minimal system state with no content sources.
// PRE must return LEVEL_5 system fallback (not crash).

const chaos001Playlist = [{ content_id: 'system:fallback:v1', duration_ms: 30000, source: 5, sponsored: false, weight: 100 }];
const chaos001 = sealPacket({
  ...BASE,
  packet_id: 'a1b2c3d4-c001-4000-8000-000000000201',
  corpus_class: 'chaos',
  description: 'CHAOS-001: DB unavailable — minimal system state (no schedules, overrides, content). PRE must return system fallback at LEVEL_5. Tests INV-2 (Totality) under degraded conditions.',
  invariants_under_test: ['INV-2', 'INV-3'],
  specification_refs: ['PRE §9.1', 'VERIFY §8', 'FIXTURES §8'],
  input: {
    screen_id: 'screen-c01',
    at: 1748390400000,
    system_state: {
      area: null,
      campaigns: [],
      content_items: [],
      emergency: null,
      last_delivery: null,
      organization: ORG,
      overrides: [],
      schedules: [],
      screen: { area_id: null, id: 'screen-c01', last_checksum: null, last_seen_at: null, status: 'active', tv_group_id: null, venue_id: 'venue-001' },
      sponsorships: [],
      tv_group: null,
      venue: VENUE_CHICAGO,
    },
  },
  expected_output: {
    confidence_score: 0.5,
    content_mix: { campaign_pct: 0.0, fallback_pct: 0.0, override_pct: 0.0, sponsor_pct: 0.0, system_pct: 1.0 },
    is_fallback: true,
    output_schema_version: '1.0.0',
    playlist: chaos001Playlist,
    playlist_checksum: playlistChecksum(chaos001Playlist),
    reason_trace: {
      level_0_emergency: null,
      level_1_operational: null,
      level_2_scheduled: null,
      level_3_campaign: null,
      level_4_sponsorship: null,
      level_5_structural: { outcome: 'RESOLVED', reason: 'L5:SYSTEM_FALLBACK:db_degraded_no_content' },
      level_6_device_truth: { checksum_match: false, confidence_score: 0.5, last_seen_ms_ago: null, outcome: 'RESOLVED', reason: 'L6:CONFIDENCE:0.5000,no_delivery_log' },
    },
    resolution_level: 5,
    resolved_at: 1748390400000,
    screen_id: 'screen-c01',
    version: 1,
  },
});

// ─── Write all sealed packets ─────────────────────────────────────────────────

mkdirSync(join(ROOT, 'corpus', 'golden'), { recursive: true });
mkdirSync(join(ROOT, 'corpus', 'edge_cases'), { recursive: true });
mkdirSync(join(ROOT, 'corpus', 'chaos'), { recursive: true });

const fixtures: Array<{ packet: Record<string, unknown>; path: string }> = [
  { packet: gold003, path: join(ROOT, 'corpus', 'golden', 'GOLD-003.json') },
  { packet: gold004, path: join(ROOT, 'corpus', 'golden', 'GOLD-004.json') },
  { packet: gold005, path: join(ROOT, 'corpus', 'golden', 'GOLD-005.json') },
  { packet: edge001, path: join(ROOT, 'corpus', 'edge_cases', 'EDGE-001.json') },
  { packet: edge002, path: join(ROOT, 'corpus', 'edge_cases', 'EDGE-002.json') },
  { packet: edge003, path: join(ROOT, 'corpus', 'edge_cases', 'EDGE-003.json') },
  { packet: chaos001, path: join(ROOT, 'corpus', 'chaos', 'CHAOS-001.json') },
];

for (const { packet, path } of fixtures) {
  writePacket(packet, path);
}

// ─── Update corpus index ──────────────────────────────────────────────────────

import { readFileSync } from 'fs';
import { relative } from 'path';

const indexPath = join(ROOT, 'corpus', 'CORPUS-INDEX.json');
const index = JSON.parse(readFileSync(indexPath, 'utf8')) as {
  schema_version: string;
  generated_at: number;
  total_packets: number;
  active_packets: number;
  archived_packets: number;
  packets: unknown[];
};

for (const { packet, path } of fixtures) {
  const relPath = relative(join(ROOT, 'corpus'), path);
  const existingIdx = index.packets.findIndex(
    (p: unknown) => (p as Record<string, unknown>)['packet_id'] === packet['packet_id']
  );
  const entry = {
    packet_id: packet['packet_id'],
    file_path: relPath,
    corpus_class: packet['corpus_class'],
    status: packet['status'],
    description: (packet['description'] as string).slice(0, 100),
    captured_at: packet['captured_at'],
    packet_hash: packet['packet_hash'],
  };
  if (existingIdx >= 0) {
    index.packets[existingIdx] = entry;
  } else {
    index.packets.push(entry);
  }
}

index.generated_at = Date.now();
index.total_packets = index.packets.length;
index.active_packets = index.packets.filter((p: unknown) =>
  (p as Record<string, unknown>)['status'] === 'active').length;
index.archived_packets = index.packets.filter((p: unknown) =>
  (p as Record<string, unknown>)['status'] === 'archived').length;

writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
console.log(`\n✓ CORPUS-INDEX.json updated: ${index.total_packets} total, ${index.active_packets} active`);
