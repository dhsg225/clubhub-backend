/**
 * State repository — queries operational state for PRE.resolve().
 *
 * Fetches all dynamic state needed to construct SystemStateSnapshot.
 * All queries:
 * - Use explicit ORDER BY (no implicit ordering)
 * - Use parameterized queries only (no string interpolation)
 * - Are read-only (no mutations)
 */
import type {
  EmergencyStateRecord,
  OverrideRecord,
  ScheduleRecord,
  CampaignRecord,
  ContentItemRecord,
  SponsorshipContractRecord,
  ScreenDeliveryLogRecord,
  ResolutionLevel,
} from '../pre-types.js';
import { query } from '../pool.js';

// ─── Emergency State ──────────────────────────────────────────────────────────

interface DbEmergencyEvent {
  emergency_id: string;
  venue_id: string;
  emergency_type: string;
  note: string | null;
  created_at: string;
}

/** Fetch active emergency for a venue. Returns null if none. */
export async function fetchActiveEmergency(venueId: string): Promise<EmergencyStateRecord | null> {
  // Emergency content: use a fallback content_id for now (will be real asset in V5+)
  const EMERGENCY_CONTENT_ID = '00000000-0000-0000-0000-000000000000';

  const rows = await query<DbEmergencyEvent>(
    `SELECT emergency_id, venue_id, emergency_type, note, created_at
     FROM emergency_events
     WHERE venue_id = $1 AND cleared_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [venueId],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.emergency_id,
    venue_id: row.venue_id,
    content_id: EMERGENCY_CONTENT_ID,
    is_global: row.emergency_type === 'FLEET_EMERGENCY',
    is_active: true,
    activated_at: new Date(row.created_at).getTime(),
    reason: row.note,
  };
}

// ─── Overrides ────────────────────────────────────────────────────────────────

interface DbOverride {
  override_id: string;
  venue_id: string;
  override_type: string;
  resolution_level: number;
  active_from_utc: string;
  active_until_utc: string | null;
  cancelled_at: string | null;
  created_by: string;
}

/** Fetch active overrides for a screen's context (venue-level for Wave 1). */
export async function fetchActiveOverrides(
  venueId: string,
  screenId: string,
  atMs: number,
): Promise<OverrideRecord[]> {
  const atTs = new Date(atMs).toISOString();

  const rows = await query<DbOverride>(
    `SELECT override_id, venue_id, override_type, resolution_level,
            active_from_utc, active_until_utc, cancelled_at, created_by
     FROM overrides
     WHERE venue_id = $1
       AND active_from_utc <= $2
       AND (active_until_utc IS NULL OR active_until_utc > $2)
       AND cancelled_at IS NULL
     ORDER BY resolution_level ASC, active_from_utc DESC`,
    [venueId, atTs],
  );

  return rows.map((row): OverrideRecord => ({
    id: row.override_id,
    content_id: '00000000-0000-0000-0000-000000000000', // Wave 1: override content TBD
    target_type: 'venue',
    target_id: row.venue_id,
    starts_at: new Date(row.active_from_utc).getTime(),
    expires_at: row.active_until_utc ? new Date(row.active_until_utc).getTime() : null,
    is_operational: row.resolution_level <= 1,
    priority: 0,
    reason: null,
    issued_by: row.created_by,
  }));
}

// ─── Schedules + Campaigns ────────────────────────────────────────────────────

interface DbSchedule {
  schedule_id: string;
  campaign_id: string;
  days_of_week: number[];
  start_time_hhmm: number;
  end_time_hhmm: number;
  valid_from_utc: string;
  valid_until_utc: string | null;
  target_type: string;
  target_id: string;
  specificity: number;
  is_operational: boolean;
  is_fallback: boolean;
  priority: number;
}

interface DbCampaign {
  campaign_id: string;
  name: string;
  status: string;
}

/** Convert HHMM integer to minutes (e.g. 900 -> 540). */
function hhmmToMinutes(hhmm: number): number {
  const hours = Math.floor(hhmm / 100);
  const minutes = hhmm % 100;
  return hours * 60 + minutes;
}

/** Fetch active schedules for a venue. */
export async function fetchActiveSchedules(
  venueId: string,
  atMs: number,
): Promise<ScheduleRecord[]> {
  const atTs = new Date(atMs).toISOString();

  const rows = await query<DbSchedule>(
    `SELECT s.schedule_id, s.campaign_id, s.days_of_week,
            s.start_time_hhmm, s.end_time_hhmm,
            s.valid_from_utc, s.valid_until_utc,
            s.target_type, s.target_id, s.specificity,
            s.is_operational, s.is_fallback, s.priority
     FROM schedules s
     JOIN campaigns c ON c.campaign_id = s.campaign_id
     WHERE c.venue_id = $1
       AND s.valid_from_utc <= $2
       AND (s.valid_until_utc IS NULL OR s.valid_until_utc > $2)
       AND c.status IN ('APPROVED', 'SCHEDULED', 'ACTIVE')
     ORDER BY s.specificity DESC, s.priority DESC, s.schedule_id ASC`,
    [venueId, atTs],
  );

  return rows.map((row): ScheduleRecord => ({
    id: row.schedule_id,
    campaign_id: row.campaign_id,
    content_id: null,
    target_type: row.target_type as ScheduleRecord['target_type'],
    target_id: row.target_id,
    specificity: row.specificity,
    starts_at: new Date(row.valid_from_utc).getTime(),
    expires_at: row.valid_until_utc ? new Date(row.valid_until_utc).getTime() : null,
    days_of_week: row.days_of_week,
    start_time_minutes: hhmmToMinutes(row.start_time_hhmm),
    end_time_minutes: hhmmToMinutes(row.end_time_hhmm),
    is_active: true,
    is_fallback: row.is_fallback,
    priority: row.priority,
  }));
}

/** Fetch campaigns for a venue (APPROVED/ACTIVE status only). */
export async function fetchActiveCampaigns(venueId: string): Promise<CampaignRecord[]> {
  const rows = await query<DbCampaign>(
    `SELECT campaign_id, name, status
     FROM campaigns
     WHERE venue_id = $1
       AND status IN ('APPROVED', 'SCHEDULED', 'ACTIVE')
     ORDER BY campaign_id ASC`,
    [venueId],
  );

  return rows.map((row): CampaignRecord => ({
    id: row.campaign_id,
    name: row.name,
    status: 'published', // maps approved/active -> published for PRE
  }));
}

// ─── Content Items ────────────────────────────────────────────────────────────

interface DbContentAsset {
  content_asset_id: string;
  duration_ms: number | null;
  media_type: string;
}

/** Fetch content items for campaigns. */
export async function fetchContentForCampaigns(campaignIds: string[]): Promise<ContentItemRecord[]> {
  if (campaignIds.length === 0) return [];

  // Build parameterized IN clause
  const placeholders = campaignIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query<DbContentAsset & { campaign_id: string }>(
    `SELECT ca.content_asset_id, ca.duration_ms, ca.media_type, ci.campaign_id
     FROM campaign_items ci
     JOIN content_assets ca ON ca.content_asset_id = ci.content_asset_id
     WHERE ci.campaign_id IN (${placeholders})
       AND ca.deleted_at IS NULL
     ORDER BY ci.campaign_id ASC, ci.position ASC NULLS LAST, ci.campaign_item_id ASC`,
    campaignIds,
  );

  return rows.map((row): ContentItemRecord => ({
    id: row.content_asset_id,
    duration_ms: row.duration_ms ?? 10_000, // default 10s for images
    type: row.media_type,
    is_active: true,
  }));
}

// ─── Sponsorships ─────────────────────────────────────────────────────────────

interface DbSponsorshipContract {
  sponsorship_id: string;
  area_id: string | null;
  venue_id: string;
  content_asset_id: string;
  sov_pct: string;  // numeric comes as string from pg
  starts_at: string;
  expires_at: string | null;
}

/** Fetch active sponsorship contracts for a venue. */
export async function fetchActiveSponsorships(
  venueId: string,
  atMs: number,
): Promise<SponsorshipContractRecord[]> {
  // sponsorship_contracts table added in V5 — check if exists first
  const atTs = new Date(atMs).toISOString();

  try {
    const rows = await query<DbSponsorshipContract>(
      `SELECT sponsorship_id, area_id, venue_id, content_asset_id, sov_pct, starts_at, expires_at
       FROM sponsorship_contracts
       WHERE venue_id = $1
         AND is_active = true
         AND starts_at <= $2
         AND (expires_at IS NULL OR expires_at > $2)
       ORDER BY sponsorship_id ASC`,
      [venueId, atTs],
    );

    return rows.map((row): SponsorshipContractRecord => ({
      id: row.sponsorship_id,
      area_id: row.area_id ?? row.venue_id,
      content_id: row.content_asset_id,
      sov_pct: parseFloat(row.sov_pct),
      starts_at: new Date(row.starts_at).getTime(),
      expires_at: row.expires_at ? new Date(row.expires_at).getTime() : null,
      is_active: true,
    }));
  } catch {
    // If table doesn't exist yet (pre-V5), return empty
    return [];
  }
}

// ─── Last Delivery ────────────────────────────────────────────────────────────

interface DbDeliveryLog {
  delivery_id: string;
  screen_id: string;
  delivered_at: string;
  playlist_checksum: string;
  resolution_level: number;
}

/** Fetch most recent delivery for a screen. */
export async function fetchLastDelivery(screenId: string): Promise<ScreenDeliveryLogRecord | null> {
  try {
    const rows = await query<DbDeliveryLog>(
      `SELECT delivery_id, screen_id, delivered_at, playlist_checksum, resolution_level
       FROM screen_delivery_log
       WHERE screen_id = $1
       ORDER BY delivered_at DESC
       LIMIT 1`,
      [screenId],
    );
    const row = rows[0];
    if (!row) return null;

    return {
      id: row.delivery_id,
      screen_id: row.screen_id,
      delivered_at: new Date(row.delivered_at).getTime(),
      checksum: row.playlist_checksum,
      resolution_level: row.resolution_level as ResolutionLevel,
    };
  } catch {
    return null;
  }
}
