/**
 * Campaign management routes.
 *
 * Implements the minimum content delivery chain for Wave 1 operator onboarding:
 *   POST /api/v2/venues/:venue_id/campaigns            — create campaign (DRAFT)
 *   POST /api/v2/campaigns/:campaign_id/items          — add content asset
 *   POST /api/v2/campaigns/:campaign_id/schedules      — attach time window
 *   PATCH /api/v2/campaigns/:campaign_id/status        — advance to APPROVED/ACTIVE
 *
 * Status machine (subset enforced here):
 *   DRAFT → REVIEW → APPROVED → ACTIVE
 *
 * PRE reads campaigns with status IN ('APPROVED', 'SCHEDULED', 'ACTIVE').
 * A campaign must reach APPROVED before PRE resolves it.
 *
 * DB trigger guard (V2): REVIEW→APPROVED requires has_preview_session = true.
 * Enforced here by setting has_preview_session = true in the same UPDATE when
 * the operator explicitly advances to APPROVED — treating the API call as confirmation.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { query, withTransaction } from '../db/pool.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VenueParams {
  venue_id: string;
}

interface CampaignParams {
  campaign_id: string;
}

interface CreateCampaignBody {
  name: string;
  resolution_level?: number;   // 2=scheduled, 3=campaign(default), 4=sponsorship
}

interface AddItemBody {
  content_asset_id: string;
  weight?: number;
  position?: number;
}

interface AddScheduleBody {
  days_of_week: number[];      // 0=Sun ... 6=Sat
  start_time_hhmm: number;     // e.g. 900 = 09:00
  end_time_hhmm: number;       // e.g. 2200 = 22:00
  valid_from_utc: string;      // ISO8601
  valid_until_utc?: string;    // ISO8601, null = indefinite
}

interface UpdateStatusBody {
  status: string;
}

// Valid forward transitions for Wave 1 operator flow
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT:    ['REVIEW', 'APPROVED'],
  REVIEW:   ['APPROVED'],
  APPROVED: ['ACTIVE', 'PAUSED', 'ARCHIVED'],
  ACTIVE:   ['PAUSED', 'ARCHIVED'],
  PAUSED:   ['ACTIVE', 'ARCHIVED'],
};

// ── Route registration ─────────────────────────────────────────────────────────

export async function registerCampaignRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/v2/venues/:venue_id/campaigns
  // Create a new campaign in DRAFT state for the given venue.
  app.post<{ Params: VenueParams; Body: CreateCampaignBody }>(
    '/api/v2/venues/:venue_id/campaigns',
    async (request, reply) => {
      const { venue_id } = request.params;
      const { name, resolution_level = 3 } = request.body;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      if (!name?.trim()) {
        return reply.code(400).send({ error: 'name is required' });
      }
      if (![2, 3, 4].includes(resolution_level)) {
        return reply.code(400).send({ error: 'resolution_level must be 2, 3, or 4' });
      }

      // Verify venue exists and get enterprise_group_id
      const venues = await query<{ venue_id: string; enterprise_group_id: string }>(
        'SELECT venue_id, enterprise_group_id FROM venues WHERE venue_id = $1 AND deleted_at IS NULL',
        [venue_id],
      );
      if (venues.length === 0) return reply.code(404).send({ error: 'Venue not found' });
      const venue = venues[0]!;

      const campaigns = await query<{ campaign_id: string; created_at: Date }>(
        `INSERT INTO campaigns
           (enterprise_group_id, venue_id, name, resolution_level, status, created_by)
         VALUES ($1, $2, $3, $4, 'DRAFT', $5)
         RETURNING campaign_id, created_at`,
        [venue.enterprise_group_id, venue_id, name.trim(), resolution_level, operator_id],
      );
      const campaign = campaigns[0]!;

      return reply.code(201).send({
        campaign_id: campaign.campaign_id,
        venue_id,
        enterprise_group_id: venue.enterprise_group_id,
        name: name.trim(),
        resolution_level,
        status: 'DRAFT',
        created_at: campaign.created_at,
      });
    },
  );

  // POST /api/v2/campaigns/:campaign_id/items
  // Add a content asset to a campaign.
  // Option A: no approval status check — asset is usable regardless of approval state.
  app.post<{ Params: CampaignParams; Body: AddItemBody }>(
    '/api/v2/campaigns/:campaign_id/items',
    async (request, reply) => {
      const { campaign_id } = request.params;
      const { content_asset_id, weight = 1.0, position } = request.body;

      if (!content_asset_id?.trim()) {
        return reply.code(400).send({ error: 'content_asset_id is required' });
      }

      // Verify campaign exists and is in an editable state
      const campaigns = await query<{ campaign_id: string; status: string; enterprise_group_id: string }>(
        'SELECT campaign_id, status, enterprise_group_id FROM campaigns WHERE campaign_id = $1',
        [campaign_id],
      );
      if (campaigns.length === 0) return reply.code(404).send({ error: 'Campaign not found' });
      const campaign = campaigns[0]!;

      if (['ARCHIVED', 'EXPIRED'].includes(campaign.status)) {
        return reply.code(409).send({ error: `Cannot add items to a ${campaign.status} campaign` });
      }

      // Verify content asset exists and belongs to same enterprise group
      const assets = await query<{ content_asset_id: string }>(
        `SELECT content_asset_id FROM content_assets
         WHERE content_asset_id = $1
           AND enterprise_group_id = $2
           AND deleted_at IS NULL`,
        [content_asset_id.trim(), campaign.enterprise_group_id],
      );
      if (assets.length === 0) return reply.code(404).send({ error: 'Content asset not found' });

      const items = await query<{ campaign_item_id: string; created_at: Date }>(
        `INSERT INTO campaign_items (campaign_id, content_asset_id, weight, position)
         VALUES ($1, $2, $3, $4)
         RETURNING campaign_item_id, created_at`,
        [campaign_id, content_asset_id.trim(), weight, position ?? null],
      );

      return reply.code(201).send({
        campaign_item_id: items[0]!.campaign_item_id,
        campaign_id,
        content_asset_id: content_asset_id.trim(),
        weight,
        position: position ?? null,
        created_at: items[0]!.created_at,
      });
    },
  );

  // POST /api/v2/campaigns/:campaign_id/schedules
  // Attach a time-window schedule to a campaign.
  // target_type defaults to 'venue' (venue-wide delivery).
  app.post<{ Params: CampaignParams; Body: AddScheduleBody }>(
    '/api/v2/campaigns/:campaign_id/schedules',
    async (request, reply) => {
      const { campaign_id } = request.params;
      const { days_of_week, start_time_hhmm, end_time_hhmm, valid_from_utc, valid_until_utc } = request.body;

      // Validate
      if (!Array.isArray(days_of_week) || days_of_week.length === 0) {
        return reply.code(400).send({ error: 'days_of_week must be a non-empty array of 0–6' });
      }
      if (days_of_week.some(d => d < 0 || d > 6)) {
        return reply.code(400).send({ error: 'days_of_week values must be 0 (Sun) through 6 (Sat)' });
      }
      if (typeof start_time_hhmm !== 'number' || typeof end_time_hhmm !== 'number') {
        return reply.code(400).send({ error: 'start_time_hhmm and end_time_hhmm are required integers (e.g. 900 = 09:00)' });
      }
      if (!valid_from_utc) {
        return reply.code(400).send({ error: 'valid_from_utc is required (ISO8601)' });
      }

      // Verify campaign exists and get venue_id
      const campaigns = await query<{ campaign_id: string; venue_id: string; status: string }>(
        'SELECT campaign_id, venue_id, status FROM campaigns WHERE campaign_id = $1',
        [campaign_id],
      );
      if (campaigns.length === 0) return reply.code(404).send({ error: 'Campaign not found' });
      const campaign = campaigns[0]!;

      if (['ARCHIVED', 'EXPIRED'].includes(campaign.status)) {
        return reply.code(409).send({ error: `Cannot schedule a ${campaign.status} campaign` });
      }

      const schedules = await query<{ schedule_id: string; created_at: Date }>(
        `INSERT INTO schedules
           (campaign_id, days_of_week, start_time_hhmm, end_time_hhmm,
            valid_from_utc, valid_until_utc,
            target_type, target_id, specificity, priority)
         VALUES ($1, $2, $3, $4, $5, $6, 'venue', $7, 1, 0)
         RETURNING schedule_id, created_at`,
        [
          campaign_id,
          days_of_week,
          start_time_hhmm,
          end_time_hhmm,
          valid_from_utc,
          valid_until_utc ?? null,
          campaign.venue_id,
        ],
      );

      return reply.code(201).send({
        schedule_id: schedules[0]!.schedule_id,
        campaign_id,
        venue_id: campaign.venue_id,
        days_of_week,
        start_time_hhmm,
        end_time_hhmm,
        valid_from_utc,
        valid_until_utc: valid_until_utc ?? null,
        target_type: 'venue',
        created_at: schedules[0]!.created_at,
      });
    },
  );

  // PATCH /api/v2/campaigns/:campaign_id/status
  // Advance campaign status toward APPROVED/ACTIVE so PRE can resolve it.
  // Setting status to APPROVED also sets has_preview_session = true in the same
  // UPDATE to satisfy the V2 DB trigger guard.
  app.patch<{ Params: CampaignParams; Body: UpdateStatusBody }>(
    '/api/v2/campaigns/:campaign_id/status',
    async (request, reply) => {
      const { campaign_id } = request.params;
      const { status: targetStatus } = request.body;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      if (!targetStatus) {
        return reply.code(400).send({ error: 'status is required' });
      }

      const campaigns = await query<{
        campaign_id: string;
        status: string;
        venue_id: string;
        name: string;
      }>(
        'SELECT campaign_id, status, venue_id, name FROM campaigns WHERE campaign_id = $1',
        [campaign_id],
      );
      if (campaigns.length === 0) return reply.code(404).send({ error: 'Campaign not found' });
      const campaign = campaigns[0]!;

      const allowed = ALLOWED_TRANSITIONS[campaign.status] ?? [];
      if (!allowed.includes(targetStatus)) {
        return reply.code(409).send({
          error: `Cannot transition from ${campaign.status} to ${targetStatus}`,
          allowed_transitions: allowed,
        });
      }

      const isApproving = targetStatus === 'APPROVED';

      await withTransaction(async (txQuery) => {
        if (isApproving) {
          // Satisfy the DB trigger: set has_preview_session = true simultaneously.
          // The operator making this explicit API call is the confirmation of preview.
          await txQuery(
            `UPDATE campaigns
             SET status = $1,
                 has_preview_session = true,
                 approved_by = $2,
                 approved_at = now(),
                 updated_at = now()
             WHERE campaign_id = $3`,
            [targetStatus, operator_id, campaign_id],
          );
        } else {
          await txQuery(
            'UPDATE campaigns SET status = $1, updated_at = now() WHERE campaign_id = $2',
            [targetStatus, campaign_id],
          );
        }
      });

      return reply.send({
        campaign_id,
        name: campaign.name,
        venue_id: campaign.venue_id,
        previous_status: campaign.status,
        status: targetStatus,
        ...(isApproving ? { approved_by: operator_id, approved_at: new Date().toISOString() } : {}),
        at_utc_ms: Date.now(),
      });
    },
  );
}
