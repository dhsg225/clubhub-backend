/**
 * Snapshot builder — assembles SystemStateSnapshot from PostgreSQL.
 *
 * This is the bridge between the database and PRE.resolve().
 * PRE is pure — all DB reads happen here, then the snapshot is passed to PRE.
 *
 * Constitutional rules:
 * - All queries are read-only
 * - Deterministic ordering enforced at query level (explicit ORDER BY)
 * - No implicit DB ordering relied upon
 * - PRE never sees raw DB types — only mapped PRE types
 */
import type { SystemStateSnapshot } from './pre-types.js';
import {
  fetchScreen,
  fetchTvGroup,
  fetchVenue,
  fetchOrganization,
} from './repositories/screen-repository.js';
import {
  fetchActiveEmergency,
  fetchActiveOverrides,
  fetchActiveSchedules,
  fetchActiveCampaigns,
  fetchContentForCampaigns,
  fetchActiveSponsorships,
  fetchLastDelivery,
} from './repositories/state-repository.js';

export class SnapshotBuildError extends Error {
  constructor(
    message: string,
    public readonly screenId: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'SnapshotBuildError';
  }
}

/**
 * Build a SystemStateSnapshot for PRE.resolve() from live database state.
 *
 * @param screenId - The stable logical screen identifier
 * @param atMs - UTC milliseconds — the deterministic evaluation timestamp
 * @returns SystemStateSnapshot ready for PRE.resolve()
 */
export async function buildSystemStateSnapshot(
  screenId: string,
  atMs: number,
): Promise<SystemStateSnapshot> {
  // ─── Step 1: Fetch screen context ────────────────────────────────────────
  const screen = await fetchScreen(screenId);
  if (!screen) {
    throw new SnapshotBuildError(`Screen not found: ${screenId}`, screenId);
  }

  // ─── Step 2: Fetch venue ──────────────────────────────────────────────────
  const venue = await fetchVenue(screen.venue_id);
  if (!venue) {
    throw new SnapshotBuildError(`Venue not found for screen: ${screen.venue_id}`, screenId);
  }

  // ─── Step 3: Fetch organization ───────────────────────────────────────────
  const organization = await fetchOrganization(venue.org_id);
  if (!organization) {
    throw new SnapshotBuildError(`Organization not found: ${venue.org_id}`, screenId);
  }

  // ─── Step 4: Fetch TV group (screen zone) ────────────────────────────────
  const tvGroup = screen.area_id ? await fetchTvGroup(screen.area_id) : null;

  // ─── Step 5: Parallel fetch of operational state ─────────────────────────
  const [
    emergency,
    overrides,
    schedules,
    campaigns,
    sponsorships,
    lastDelivery,
  ] = await Promise.all([
    fetchActiveEmergency(screen.venue_id),
    fetchActiveOverrides(screen.venue_id, screenId, atMs),
    fetchActiveSchedules(screen.venue_id, atMs),
    fetchActiveCampaigns(screen.venue_id),
    fetchActiveSponsorships(screen.venue_id, atMs),
    fetchLastDelivery(screenId),
  ]);

  // ─── Step 6: Fetch content items for active campaigns ────────────────────
  const campaignIds = campaigns.map(c => c.id);
  const contentItems = await fetchContentForCampaigns(campaignIds);

  // ─── Assemble snapshot ────────────────────────────────────────────────────
  const snapshot: SystemStateSnapshot = {
    screen,
    tv_group: tvGroup,
    area: null,       // area is a sub-zone concept — reserved for future
    venue,
    organization,
    emergency,
    overrides,
    schedules,
    campaigns,
    content_items: contentItems,
    sponsorships,
    last_delivery: lastDelivery,
  };

  return snapshot;
}
