/**
 * LEVEL_4 — Sponsorship injection.
 *
 * Constitutional authority: PRE-REFERENCE-IMPLEMENTATION-v1.md §5.4
 */

import type { PRE_Input, SponsorshipContractRecord, PlaylistItem, ContentItemRecord, ReasonTraceSponsorshipLevel } from '../types';
import {
  LEVEL_4_SPONSORSHIP,
  SOV_WARNING_THRESHOLD,
  SOV_MAX_EFFECTIVE,
  SYSTEM_FALLBACK_CONTENT_ID,
  SYSTEM_FALLBACK_DURATION_MS,
} from '../constants';
import { weightedPlaylistResolver } from '../algorithms/swrr';

export interface Level4Result {
  playlist: PlaylistItem[];
  trace:    ReasonTraceSponsorshipLevel;
}

export function applyLevel4(
  input: PRE_Input,
  basePlaylist: PlaylistItem[],
  contracts: SponsorshipContractRecord[],
  skipSponsorship: boolean
): Level4Result {
  const noContracts = contracts.length === 0;

  if (skipSponsorship || noContracts || basePlaylist.length === 0) {
    return {
      playlist: basePlaylist,
      trace: {
        outcome:            'SKIP',
        reason:             'L4:SKIP:no_active_sponsorship_contracts',
        contracts_active:   0,
        total_sov_pct:      0,
        sov_warning_active: false,
        injected_items:     0,
      },
    };
  }

  const totalSov = contracts.reduce((sum, c) => sum + c.sov_pct, 0);
  const sovWarningActive = totalSov > SOV_WARNING_THRESHOLD;
  const effectiveTotalSov = Math.min(totalSov, SOV_MAX_EFFECTIVE);
  const wBase = basePlaylist.reduce((sum, item) => sum + item.weight, 0);

  const sponsoredItems: PlaylistItem[] = [];
  for (const contract of contracts) {
    const contentItem: ContentItemRecord | undefined = input.system_state.content_items.find(
      (c) => c.id === contract.content_id
    );
    const contentId = contentItem ? contract.content_id : SYSTEM_FALLBACK_CONTENT_ID;
    const durationMs = contentItem ? contentItem.duration_ms : SYSTEM_FALLBACK_DURATION_MS;
    const sponsorWeight = Math.max(1, Math.round((contract.sov_pct / (1 - effectiveTotalSov)) * wBase));
    sponsoredItems.push({
      content_id:  contentId,
      duration_ms: durationMs,
      weight:      sponsorWeight,
      source:      LEVEL_4_SPONSORSHIP,
      sponsored:   true,
    });
  }

  const ordered = weightedPlaylistResolver([...basePlaylist, ...sponsoredItems]);

  return {
    playlist: ordered,
    trace: {
      outcome:            'RESOLVED',
      reason:             `L4:RESOLVED:contracts=${contracts.length}`,
      contracts_active:   contracts.length,
      total_sov_pct:      Math.round(totalSov * 10000) / 10000,
      sov_warning_active: sovWarningActive,
      injected_items:     sponsoredItems.length,
    },
  };
}
