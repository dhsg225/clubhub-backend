/**
 * Contract vector: LEVEL_4 — Sponsorship injection
 *
 * Tests:
 *   V4-1: skipSponsorship=true → playlist unchanged
 *   V4-2: No contracts → playlist unchanged, SKIP trace
 *   V4-3: Single contract at 25% SOV → sponsor items injected
 *   V4-4: Total SOV > 30% → sov_warning_active=true
 *   V4-5: Unknown contract content_id → system fallback content for sponsor item
 */

import { applyLevel4 } from '../../src/pre/levels/level4-sponsorship';
import {
  LEVEL_3_CAMPAIGN,
  LEVEL_4_SPONSORSHIP,
  SYSTEM_FALLBACK_CONTENT_ID,
  SOV_WARNING_THRESHOLD,
} from '../../src/pre/constants';
import type { PlaylistItem, SponsorshipContractRecord } from '../../src/pre/types';
import { buildInput, AT, CONTENT_A, CONTENT_B, assert, assertEqual, summary } from './_fixture';

console.log('=== LEVEL_4 Sponsorship Injection — Contract Vectors ===\n');

function makeSponsorItem(content_id: string, weight: number = 100): PlaylistItem {
  return { content_id, duration_ms: 15_000, weight, source: LEVEL_3_CAMPAIGN, sponsored: false };
}

function makeContract(partial: Partial<SponsorshipContractRecord> & { id: string; content_id: string; sov_pct: number }): SponsorshipContractRecord {
  return {
    area_id:    'area-001',
    starts_at:  AT - 3_600_000,
    expires_at: null,
    is_active:  true,
    ...partial,
  };
}

const baseInput = buildInput();
const basePlaylist: PlaylistItem[] = [makeSponsorItem(CONTENT_A.id, 100)];

// ─── V4-1: skipSponsorship=true ────────────────────────────────────────────────
console.log('V4-1: skipSponsorship=true → unchanged playlist');
{
  const contract = makeContract({ id: 'c-001', content_id: CONTENT_B.id, sov_pct: 0.25 });
  const result = applyLevel4(baseInput, basePlaylist, [contract], true);

  assertEqual(result.playlist.length, basePlaylist.length, 'playlist length unchanged');
  assertEqual(result.trace.outcome, 'SKIP', 'trace outcome SKIP');
  assertEqual(result.trace.injected_items, 0, 'no injected items');
}

// ─── V4-2: No contracts ───────────────────────────────────────────────────────
console.log('\nV4-2: No contracts → SKIP trace');
{
  const result = applyLevel4(baseInput, basePlaylist, [], false);

  assertEqual(result.playlist, basePlaylist, 'playlist unchanged');
  assertEqual(result.trace.outcome, 'SKIP', 'trace outcome SKIP');
  assertEqual(result.trace.contracts_active, 0, 'contracts_active = 0');
}

// ─── V4-3: Single contract at 25% SOV ────────────────────────────────────────
console.log('\nV4-3: 25% SOV contract → sponsor items injected');
{
  const contract = makeContract({ id: 'c-002', content_id: CONTENT_B.id, sov_pct: 0.25 });
  const result = applyLevel4(baseInput, basePlaylist, [contract], false);

  const sponsoredItems = result.playlist.filter(p => p.sponsored);
  const baseItems = result.playlist.filter(p => !p.sponsored);

  assert(sponsoredItems.length > 0, 'sponsor items injected');
  assert(baseItems.length > 0, 'base items preserved');
  assertEqual(sponsoredItems[0]!.content_id, CONTENT_B.id, 'sponsor content_id correct');
  assertEqual(sponsoredItems[0]!.source, LEVEL_4_SPONSORSHIP, 'sponsor source = LEVEL_4');
  assertEqual(sponsoredItems[0]!.sponsored, true, 'sponsored = true');
  assertEqual(result.trace.outcome, 'RESOLVED', 'trace outcome RESOLVED');
  assertEqual(result.trace.contracts_active, 1, 'contracts_active = 1');
  assertEqual(result.trace.total_sov_pct, 0.25, 'total_sov_pct = 0.25');
  assertEqual(result.trace.sov_warning_active, false, 'no SOV warning at 25%');
}

// ─── V4-4: SOV > SOV_WARNING_THRESHOLD ───────────────────────────────────────
console.log('\nV4-4: SOV > 30% → sov_warning_active=true');
{
  const contract = makeContract({ id: 'c-003', content_id: CONTENT_B.id, sov_pct: 0.40 });
  const result = applyLevel4(baseInput, basePlaylist, [contract], false);

  assert(result.trace.total_sov_pct > SOV_WARNING_THRESHOLD, `total_sov_pct (${result.trace.total_sov_pct}) > threshold (${SOV_WARNING_THRESHOLD})`);
  assertEqual(result.trace.sov_warning_active, true, 'sov_warning_active = true');
}

// ─── V4-5: Unknown contract content_id → system fallback for sponsor item ────
console.log('\nV4-5: Unknown contract content_id → system fallback content in sponsor slot');
{
  const contract = makeContract({ id: 'c-004', content_id: 'content-sponsor-gone', sov_pct: 0.20 });
  const result = applyLevel4(baseInput, basePlaylist, [contract], false);

  const sponsoredItems = result.playlist.filter(p => p.sponsored);
  assert(sponsoredItems.length > 0, 'sponsor slot created');
  assertEqual(sponsoredItems[0]!.content_id, SYSTEM_FALLBACK_CONTENT_ID, 'unknown sponsor → system fallback');
}

summary('level4-sponsorship.vec');
