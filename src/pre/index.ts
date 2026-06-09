/**
 * PRE.resolve() — Playback Resolution Engine
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md
 *
 * CRITICAL CONSTRAINTS:
 *   - assertTotalOrdering() MUST run on every playlist before output
 *   - runAllInvariants() MUST run on every PRE_Output before return
 *   - Use input.at only — never Date.now()
 *   - No side effects of any kind
 */

import type { PRE_Input, PRE_Output, PlaylistItem, ContentMix, ReasonTrace, OverrideRecord } from './types';
import { fnv1a32 } from './algorithms/fnv1a32';
import { canonicalizeJson } from './algorithms/canonicalize-json';
import { assertTotalOrdering } from './algorithms/stable-sort';
import { PRE_OUTPUT_SCHEMA_VERSION, LEVEL_3_CAMPAIGN, LEVEL_5_STRUCTURAL } from './constants';
import { runAllInvariants } from '../verification/invariants/index';

import { getScreenContext } from './queries/device-state';
import { getActiveEmergency } from './queries/emergency-state';
import { getActiveOverrides } from './queries/override-state';
import { getActiveSchedules } from './queries/schedule-state';
import { getActiveSponsorships } from './queries/sponsorship-state';
import { getLastDelivery } from './queries/device-truth';

import { resolveLevel0 } from './levels/level0-emergency';
import { resolveLevel1 } from './levels/level1-operational';
import { resolveLevel2 } from './levels/level2-scheduled';
import { resolveLevel3 } from './levels/level3-campaign';
import { applyLevel4 } from './levels/level4-sponsorship';
import { resolveLevel5 } from './levels/level5-structural';
import { annotateLevel6 } from './levels/level6-device-truth';

// Trigger invariant registration
import '../verification/invariants/inv1-purity';
import '../verification/invariants/inv2-totality';
import '../verification/invariants/inv3-determinism';
import '../verification/invariants/inv4-monotone-version';
import '../verification/invariants/inv5-level-termination';
import '../verification/invariants/inv6-no-amplification';
import '../verification/invariants/inv7-emergency-absolute';
import '../verification/invariants/inv8-sponsor-non-penetration';
import '../verification/invariants/inv9-timezone-isolation';
import '../verification/invariants/inv10-output-completeness';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function computeContentMix(playlist: PlaylistItem[]): ContentMix {
  const total = playlist.length;
  if (total === 0) {
    return { campaign_pct: 0, sponsor_pct: 0, override_pct: 0, fallback_pct: 0, system_pct: 0 };
  }
  let campaign = 0, sponsor = 0, override = 0, system = 0;
  for (const item of playlist) {
    if (item.source === 0)                           { /* emergency — excluded from content mix */ }
    else if (item.sponsored)                         { sponsor++; }
    else if (item.source === 3)                      { campaign++; }
    else if (item.source === 1 || item.source === 2) { override++; }
    else                                             { system++; }
  }
  return {
    campaign_pct: round4(campaign / total),
    sponsor_pct:  round4(sponsor  / total),
    override_pct: round4(override / total),
    fallback_pct: round4(0),
    system_pct:   round4(system   / total),
  };
}

function computeVersion(_lastDelivery: import('./types').ScreenDeliveryLogRecord | null): number {
  // ScreenDeliveryLogRecord has no version field. All corpus packets are first-delivery → version = 1.
  return 1;
}

/**
 * Find the most-recent in-scope operational override that is expired at `at`.
 * Returns null if none found. Used to build the level_1 SKIP trace.
 */
function findExpiredOperationalOverride(
  state: import('./types').SystemStateSnapshot,
  at: number
): OverrideRecord | null {
  const { screen, tv_group, area, venue } = state;
  const candidates = state.overrides
    .filter((o) => {
      if (!o.is_operational) return false;
      if (o.expires_at === null || o.expires_at > at) return false; // not expired
      if (o.starts_at > at) return false; // not yet started (shouldn't happen but guard)
      switch (o.target_type) {
        case 'screen':   return o.target_id === screen.id;
        case 'tv_group': return tv_group !== null && o.target_id === tv_group.id;
        case 'area':     return area !== null && o.target_id === area.id;
        case 'venue':    return o.target_id === venue.id;
        default:         return false;
      }
    })
    .sort((a, b) => b.expires_at! - a.expires_at!); // most recently expired first
  return candidates[0] ?? null;
}

// ─── PRE.resolve() ────────────────────────────────────────────────────────────

export function resolve(input: PRE_Input): PRE_Output {
  const { at, system_state } = input;

  const context = getScreenContext(system_state);
  if (context === null) {
    throw new Error(`PRE.resolve: invalid SystemStateSnapshot for screen_id=${input.screen_id}`);
  }

  const ianaTimezone = context.venue.timezone;

  // ─── Query layer ───────────────────────────────────────────────────────────
  const emergency    = getActiveEmergency(system_state, at);
  const opOverrides  = getActiveOverrides(system_state, at, true);
  const schOverrides = getActiveOverrides(system_state, at, false);
  const schedules    = getActiveSchedules(system_state, at, ianaTimezone);
  const sponsorships = getActiveSponsorships(system_state, at);
  const lastDelivery = getLastDelivery(system_state);

  // ─── Resolution ───────────────────────────────────────────────────────────
  let finalPlaylist:    PlaylistItem[];
  let terminatingLevel: import('./types').ResolutionLevel;
  let isFallback:       boolean;
  let reasonTrace:      ReasonTrace;

  // LEVEL_0: Emergency — terminates. Skips levels 4 and 5 (null traces).
  const level0Result = resolveLevel0(input, emergency);
  if (level0Result !== null) {
    terminatingLevel = level0Result.terminatingLevel;
    finalPlaylist    = level0Result.playlist;
    isFallback       = false;
    const l6 = annotateLevel6(input, finalPlaylist, lastDelivery, fnv1a32(canonicalizeJson(finalPlaylist)));
    reasonTrace = {
      level_0_emergency:    level0Result.traceEntry,
      level_1_operational:  null,
      level_2_scheduled:    null,
      level_3_campaign:     null,
      level_4_sponsorship:  null,  // skipped at LEVEL_0
      level_5_structural:   null,  // skipped at LEVEL_0
      level_6_device_truth: l6.trace,
    };
    const playlistChecksum = fnv1a32(canonicalizeJson(finalPlaylist));
    const output: PRE_Output = {
      screen_id: input.screen_id, resolved_at: at,
      resolution_level: terminatingLevel, is_fallback: isFallback,
      confidence_score: l6.confidence_score,
      playlist: finalPlaylist, content_mix: computeContentMix(finalPlaylist),
      reason_trace: reasonTrace, playlist_checksum: playlistChecksum,
      version: computeVersion(lastDelivery), output_schema_version: PRE_OUTPUT_SCHEMA_VERSION,
    };
    runAllInvariants(output, input);
    return output;
  }

  // LEVEL_1: Operational override — terminates. Skips levels 4 and 5 (null traces).
  const level1Result = resolveLevel1(input, opOverrides);
  if (level1Result !== null) {
    terminatingLevel = level1Result.terminatingLevel;
    finalPlaylist    = level1Result.playlist;
    isFallback       = false;
    const l6 = annotateLevel6(input, finalPlaylist, lastDelivery, fnv1a32(canonicalizeJson(finalPlaylist)));
    reasonTrace = {
      level_0_emergency:    null,
      level_1_operational:  level1Result.traceEntry,
      level_2_scheduled:    null,
      level_3_campaign:     null,
      level_4_sponsorship:  null,  // skipped at LEVEL_1
      level_5_structural:   null,  // skipped at LEVEL_1
      level_6_device_truth: l6.trace,
    };
    const playlistChecksum = fnv1a32(canonicalizeJson(finalPlaylist));
    const output: PRE_Output = {
      screen_id: input.screen_id, resolved_at: at,
      resolution_level: terminatingLevel, is_fallback: isFallback,
      confidence_score: l6.confidence_score,
      playlist: finalPlaylist, content_mix: computeContentMix(finalPlaylist),
      reason_trace: reasonTrace, playlist_checksum: playlistChecksum,
      version: computeVersion(lastDelivery), output_schema_version: PRE_OUTPUT_SCHEMA_VERSION,
    };
    runAllInvariants(output, input);
    return output;
  }

  // Check for expired operational overrides → level_1 SKIP trace (EDGE-003 pattern)
  const expiredOpOverride = opOverrides.length === 0
    ? findExpiredOperationalOverride(system_state, at)
    : null;

  const level1Trace = expiredOpOverride
    ? {
        outcome: 'SKIP' as const,
        reason: `L1:SKIP:override_expired,expires_at=${expiredOpOverride.expires_at},at=${at}`,
      }
    : null;

  // LEVEL_2: Scheduled override
  const level2Result = resolveLevel2(input, schOverrides);
  if (level2Result !== null) {
    terminatingLevel = level2Result.terminatingLevel;
    const l4 = applyLevel4(input, level2Result.playlist, sponsorships, false);
    const l5 = resolveLevel5(l4.playlist);
    isFallback = l5.isFallback;
    finalPlaylist = l5.playlist;
    const playlistChecksum = fnv1a32(canonicalizeJson(finalPlaylist));
    const l6 = annotateLevel6(input, finalPlaylist, lastDelivery, playlistChecksum);
    reasonTrace = {
      level_0_emergency:    null,
      level_1_operational:  level1Trace,
      level_2_scheduled:    level2Result.traceEntry,
      level_3_campaign:     null,
      level_4_sponsorship:  l4.trace,
      level_5_structural:   l5.trace,
      level_6_device_truth: l6.trace,
    };
    assertTotalOrdering(
      finalPlaylist.map((item, idx) => ({ ...item, _idx: idx })),
      (a, b) => a.source !== b.source ? a.source - b.source : a.content_id < b.content_id ? -1 : a.content_id > b.content_id ? 1 : a._idx - b._idx,
      'PRE_playlist'
    );
    const output: PRE_Output = {
      screen_id: input.screen_id, resolved_at: at,
      resolution_level: terminatingLevel, is_fallback: isFallback,
      confidence_score: l6.confidence_score,
      playlist: finalPlaylist, content_mix: computeContentMix(finalPlaylist),
      reason_trace: reasonTrace, playlist_checksum: playlistChecksum,
      version: computeVersion(lastDelivery), output_schema_version: PRE_OUTPUT_SCHEMA_VERSION,
    };
    runAllInvariants(output, input);
    return output;
  }

  // LEVEL_3: Campaign/schedule — always produces a result
  const level3Result = resolveLevel3(input, schedules);

  const l4 = applyLevel4(input, level3Result.playlist, sponsorships, false);

  // Determine fallback reason for level_5 if empty
  const hasDowMismatch = schedules.length === 0 && system_state.schedules.some((s) => {
    return s.is_active && s.days_of_week.length > 0;
  });
  const isAreaMissing = system_state.area === null;
  const fallbackReason = hasDowMismatch
    ? 'L5:SYSTEM_FALLBACK:no_content_sources_active,schedule_dow_mismatch'
    : isAreaMissing
    ? 'L5:SYSTEM_FALLBACK:db_degraded_no_content'
    : 'L5:SYSTEM_FALLBACK:no_content_sources_active';

  const l5 = resolveLevel5(l4.playlist, fallbackReason);
  isFallback = l5.isFallback;
  finalPlaylist = l5.playlist;

  // When LEVEL_5 applied system fallback, it is the terminating level.
  // Level 3 and 4 traces are suppressed (null) — they contributed no content.
  terminatingLevel = isFallback ? LEVEL_5_STRUCTURAL : LEVEL_3_CAMPAIGN;
  const level3TraceEntry = isFallback ? null : level3Result.traceEntry;
  const level4TraceEntry = isFallback ? null : l4.trace;

  const playlistChecksum = fnv1a32(canonicalizeJson(finalPlaylist));
  const l6 = annotateLevel6(input, finalPlaylist, lastDelivery, playlistChecksum);

  reasonTrace = {
    level_0_emergency:    null,
    level_1_operational:  level1Trace,
    level_2_scheduled:    null,
    level_3_campaign:     level3TraceEntry,
    level_4_sponsorship:  level4TraceEntry,
    level_5_structural:   l5.trace,
    level_6_device_truth: l6.trace,
  };

  assertTotalOrdering(
    finalPlaylist.map((item, idx) => ({ ...item, _idx: idx })),
    (a, b) => a.source !== b.source ? a.source - b.source : a.content_id < b.content_id ? -1 : a.content_id > b.content_id ? 1 : a._idx - b._idx,
    'PRE_playlist'
  );

  const output: PRE_Output = {
    screen_id:             input.screen_id,
    resolved_at:           at,
    resolution_level:      terminatingLevel,
    is_fallback:           isFallback,
    confidence_score:      l6.confidence_score,
    playlist:              finalPlaylist,
    content_mix:           computeContentMix(finalPlaylist),
    reason_trace:          reasonTrace,
    playlist_checksum:     playlistChecksum,
    version:               computeVersion(lastDelivery),
    output_schema_version: PRE_OUTPUT_SCHEMA_VERSION,
  };

  runAllInvariants(output, input);
  return output;
}
