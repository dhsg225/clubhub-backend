/**
 * Maps a CorpusPackage (serialized format from CMS) to the PRE_Input required
 * by @clubhub/pre-engine's resolve().
 *
 * Constitutional:
 * - All content derived from corpus — no external data fetched here
 * - Emergency slots marked is_active=false by default; activation is a separate signal
 * - Screen/venue identity injected from config, not corpus (corpus is venue-scoped data)
 */
import type { CorpusPackage } from '@clubhub/corpus-schema';
import type {
  PRE_Input,
  SystemStateSnapshot,
  ScreenRecord,
  VenueRecord,
  OrganizationRecord,
  CampaignRecord,
  ContentItemRecord,
  ScheduleRecord,
  OverrideRecord,
  EmergencyStateRecord,
} from '@clubhub/pre-engine';

function hhmm_to_minutes(hhmm: number): number {
  return Math.floor(hhmm / 100) * 60 + (hhmm % 100);
}

export function buildPREInput(
  corpus: CorpusPackage,
  screenId: string,
  venueId: string,
  at: number,
): PRE_Input {
  const screen: ScreenRecord = {
    id: screenId,
    tv_group_id: null,
    area_id: null,
    venue_id: venueId,
    status: 'active',
    last_seen_at: at,
    last_checksum: corpus.checksum,
  };

  const venue: VenueRecord = {
    id: venueId,
    name: venueId,
    timezone: 'Etc/UTC',
    is_active: true,
    org_id: 'default',
  };

  const organization: OrganizationRecord = {
    id: 'default',
    name: 'default',
  };

  // Build campaigns
  const campaigns: CampaignRecord[] = corpus.corpus.campaigns.map((c) => ({
    id: c.campaign_id,
    name: c.campaign_id,
    status: 'published' as const,
  }));

  // Collect all content items (deduplicated by content_id)
  const contentMap = new Map<string, ContentItemRecord>();

  const collectContent = (contentIds: readonly string[], durationSeq: readonly number[]) => {
    contentIds.forEach((cid, i) => {
      if (!contentMap.has(cid)) {
        contentMap.set(cid, {
          id: cid,
          duration_ms: durationSeq[i] ?? 30_000,
          type: 'video',
          is_active: true,
        });
      }
    });
  };

  for (const c of corpus.corpus.campaigns) {
    collectContent(c.content_ids, c.duration_ms_sequence);
  }
  for (const o of corpus.corpus.overrides) {
    collectContent(o.content_ids, o.duration_ms_sequence);
  }
  for (const e of corpus.corpus.emergency_slots) {
    collectContent(e.content_ids, e.duration_ms_sequence);
  }
  for (const cs of corpus.corpus.compliance_slots) {
    collectContent(cs.content_ids, []);
  }

  // Map schedules
  const schedules: ScheduleRecord[] = corpus.corpus.schedules.map((s) => ({
    id: s.schedule_id,
    campaign_id: s.campaign_id,
    content_id: null,
    target_type: 'venue' as const,
    target_id: venueId,
    specificity: 1,
    starts_at: s.valid_from_utc,
    expires_at: s.valid_until_utc,
    days_of_week: [...s.days_of_week],
    start_time_minutes: hhmm_to_minutes(s.start_time_hhmm),
    end_time_minutes: hhmm_to_minutes(s.end_time_hhmm),
    is_active: true,
    is_fallback: false,
    priority: 0,
  }));

  // Map overrides — one OverrideRecord per content_id
  const overrides: OverrideRecord[] = corpus.corpus.overrides.flatMap((o) =>
    o.content_ids.map((cid) => ({
      id: `${o.override_id}-${cid}`,
      content_id: cid,
      target_type: 'venue' as const,
      target_id: venueId,
      starts_at: o.active_from_utc,
      expires_at: o.active_until_utc,
      is_operational: o.resolution_level === 1,
      priority: o.resolution_level,
      reason: null,
      issued_by: null,
    })),
  );

  // Emergency: not active by default — activation requires an explicit signal
  const emergency: EmergencyStateRecord | null =
    corpus.corpus.emergency_slots.length > 0
      ? {
          id: corpus.corpus.emergency_slots[0]!.slot_id,
          venue_id: venueId,
          content_id: corpus.corpus.emergency_slots[0]!.content_ids[0] ?? '',
          is_global: true,
          is_active: false,
          activated_at: at,
          reason: null,
        }
      : null;

  const system_state: SystemStateSnapshot = {
    screen,
    tv_group: null,
    area: null,
    venue,
    organization,
    emergency,
    overrides,
    schedules,
    campaigns,
    content_items: Array.from(contentMap.values()),
    sponsorships: [],
    last_delivery: null,
  };

  return { screen_id: screenId, at, system_state };
}
