/**
 * Screen repository — queries screen context for PRE.resolve().
 *
 * Maps DB schema to PRE's SystemStateSnapshot entities.
 * All queries use explicit ORDER BY — never rely on implicit DB ordering.
 */
import type { ScreenRecord, TvGroupRecord, AreaRecord, VenueRecord, OrganizationRecord } from '../pre-types.js';
import { query } from '../pool.js';

interface DbScreen {
  screen_id: string;
  hardware_id: string | null;
  venue_id: string;
  screen_zone_id: string | null;
  name: string;
  commissioning_state: string;
  last_heartbeat_at: string | null;
}

interface DbScreenZone {
  screen_zone_id: string;
  venue_id: string;
  name: string;
  zone_type: string;
}

interface DbVenue {
  venue_id: string;
  name: string;
  timezone: string;
  enterprise_group_id: string;
  regional_org_id: string | null;
  deleted_at: string | null;
}

interface DbEnterpriseGroup {
  enterprise_group_id: string;
  name: string;
}

/** Fetch screen record by screen_id. Returns null if not found. */
export async function fetchScreen(screenId: string): Promise<ScreenRecord | null> {
  const rows = await query<DbScreen>(
    'SELECT screen_id, hardware_id, venue_id, screen_zone_id, name, commissioning_state, last_heartbeat_at FROM screens WHERE screen_id = $1',
    [screenId],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.screen_id,
    tv_group_id: null,        // tv_group concept maps to screen_zone at parent level
    area_id: row.screen_zone_id,
    venue_id: row.venue_id,
    status: mapCommissioningToStatus(row.commissioning_state),
    last_seen_at: row.last_heartbeat_at ? new Date(row.last_heartbeat_at).getTime() : null,
    last_checksum: null,      // populated from screen_delivery_log
  };
}

function mapCommissioningToStatus(state: string): 'active' | 'inactive' | 'maintenance' {
  if (state === 'OPERATIONAL') return 'active';
  if (state === 'DECOMMISSIONED') return 'inactive';
  return 'maintenance';
}

/** Fetch screen zone as TvGroupRecord (parent zone). Returns null if no zone. */
export async function fetchTvGroup(screenZoneId: string): Promise<TvGroupRecord | null> {
  const rows = await query<DbScreenZone>(
    'SELECT screen_zone_id, venue_id, name, zone_type FROM screen_zones WHERE screen_zone_id = $1',
    [screenZoneId],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.screen_zone_id,
    area_id: null,   // screen_zones are the bottom of hierarchy — no parent zone
    name: row.name,
  };
}

/** Fetch venue record. Returns null if not found or soft-deleted. */
export async function fetchVenue(venueId: string): Promise<VenueRecord | null> {
  const rows = await query<DbVenue>(
    'SELECT venue_id, name, timezone, enterprise_group_id, regional_org_id, deleted_at FROM venues WHERE venue_id = $1',
    [venueId],
  );
  const row = rows[0];
  if (!row || row.deleted_at !== null) return null;

  return {
    id: row.venue_id,
    name: row.name,
    timezone: row.timezone,
    is_active: row.deleted_at === null,
    org_id: row.regional_org_id ?? row.enterprise_group_id,
  };
}

/** Fetch organization record.
 *
 * The orgId may be either an enterprise_group_id or a regional_org_id.
 * Try enterprise_groups first; if not found, try regional_organizations.
 */
export async function fetchOrganization(orgId: string): Promise<OrganizationRecord | null> {
  // Try enterprise_groups first
  const egRows = await query<DbEnterpriseGroup>(
    'SELECT enterprise_group_id, name FROM enterprise_groups WHERE enterprise_group_id = $1',
    [orgId],
  );
  if (egRows[0]) {
    return { id: egRows[0].enterprise_group_id, name: egRows[0].name };
  }

  // Try regional_organizations
  const roRows = await query<{ regional_org_id: string; name: string }>(
    'SELECT regional_org_id, name FROM regional_organizations WHERE regional_org_id = $1',
    [orgId],
  );
  if (roRows[0]) {
    return { id: roRows[0].regional_org_id, name: roRows[0].name };
  }

  return null;
}
