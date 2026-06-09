/**
 * Asset approval workflow.
 *
 * Every content_asset requires a second-approver before use in campaigns.
 * Uploader and approver cannot be the same person.
 *
 * Workflow:
 *   POST /api/v2/assets/:id/approval-request   — uploader requests approval
 *   GET  /api/v2/assets/pending-approval        — reviewer sees pending queue
 *   POST /api/v2/assets/:id/approve             — reviewer approves
 *   POST /api/v2/assets/:id/reject              — reviewer rejects (reason required)
 *
 * Campaign guard:
 *   Assets with status != 'APPROVED' cannot be added to campaigns.
 *   Enforced at campaign_items INSERT via DB trigger or application layer.
 *   Here we enforce at the approval route level.
 *
 * Operational notes:
 *   - Approval status is stored in asset_approval_requests, not on content_assets
 *   - This preserves immutability of content_assets
 *   - Campaign guard queries asset_approval_requests for APPROVED status
 *
 * What operators will do wrong:
 *   - Try to approve their own upload → blocked (CONSTRAINT different_reviewer)
 *   - Approve without watching the asset → UI must require "I have reviewed this"
 *   - Reject with empty reason → blocked (reason required)
 *   - Upload then immediately add to campaign (before approval) → blocked
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { query } from '../db/pool.js';

export async function registerAssetApprovalRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/v2/assets/:asset_id/approval-request
  app.post<{ Params: { asset_id: string } }>(
    '/api/v2/assets/:asset_id/approval-request',
    async (request, reply) => {
      const { asset_id } = request.params;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      // Verify asset exists
      const assets = await query<{
        content_asset_id: string;
        enterprise_group_id: string;
        filename: string;
        media_type: string;
      }>(
        'SELECT content_asset_id, enterprise_group_id, filename, media_type FROM content_assets WHERE content_asset_id = $1 AND deleted_at IS NULL',
        [asset_id],
      );
      if (assets.length === 0) return reply.code(404).send({ error: 'Asset not found' });

      // Check for existing pending request
      const existing = await query<{ request_id: string; status: string }>(
        `SELECT request_id, status FROM asset_approval_requests
         WHERE content_asset_id = $1 AND status IN ('PENDING', 'APPROVED')`,
        [asset_id],
      );
      if (existing.length > 0 && existing[0]!.status === 'APPROVED') {
        return reply.code(409).send({ error: 'Asset is already approved' });
      }
      if (existing.length > 0 && existing[0]!.status === 'PENDING') {
        return reply.code(409).send({
          error: 'Approval request already pending',
          request_id: existing[0]!.request_id,
        });
      }

      const rows = await query<{ request_id: string }>(
        `INSERT INTO asset_approval_requests
           (content_asset_id, enterprise_group_id, requested_by)
         VALUES ($1, $2, $3)
         RETURNING request_id`,
        [asset_id, assets[0]!.enterprise_group_id, operator_id],
      );

      return reply.code(201).send({
        request_id: rows[0]!.request_id,
        asset_id,
        filename: assets[0]!.filename,
        status: 'PENDING',
        message: 'A second approver must review this asset before it can be used in campaigns.',
      });
    },
  );

  // GET /api/v2/assets/pending-approval — reviewer's queue
  app.get<{ Querystring: { enterprise_group_id?: string } }>(
    '/api/v2/assets/pending-approval',
    async (request, reply) => {
      const { enterprise_group_id } = request.query;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      const params: unknown[] = [operator_id];
      let filter = '';
      if (enterprise_group_id) {
        params.push(enterprise_group_id);
        filter = `AND ar.enterprise_group_id = $${params.length}`;
      }

      const rows = await query<{
        request_id: string;
        content_asset_id: string;
        filename: string;
        media_type: string;
        file_size_bytes: number;
        cdn_url: string;
        requested_by: string;
        requested_at: Date;
      }>(
        `SELECT ar.request_id, ar.content_asset_id, a.filename, a.media_type,
                a.file_size_bytes, a.cdn_url, ar.requested_by, ar.requested_at
         FROM asset_approval_requests ar
         JOIN content_assets a USING (content_asset_id)
         WHERE ar.status = 'PENDING'
           AND ar.requested_by != $1
           ${filter}
         ORDER BY ar.requested_at ASC`,
        params,
      );

      return reply.send({ pending: rows, count: rows.length, at_utc_ms: Date.now() });
    },
  );

  // POST /api/v2/assets/:asset_id/approve
  app.post<{
    Params: { asset_id: string };
    Body: { request_id: string; review_note?: string; confirmed_review: boolean };
  }>(
    '/api/v2/assets/:asset_id/approve',
    async (request, reply) => {
      const { asset_id } = request.params;
      const { request_id, review_note, confirmed_review } = request.body;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      if (!confirmed_review) {
        return reply.code(400).send({
          error: 'confirmed_review: true required — you must confirm you have reviewed this asset',
        });
      }

      const requests = await query<{
        requested_by: string;
        enterprise_group_id: string;
        status: string;
      }>(
        `SELECT requested_by, enterprise_group_id, status
         FROM asset_approval_requests
         WHERE request_id = $1 AND content_asset_id = $2`,
        [request_id, asset_id],
      );

      if (requests.length === 0) return reply.code(404).send({ error: 'Approval request not found' });
      if (requests[0]!.status !== 'PENDING') {
        return reply.code(409).send({ error: `Request is already ${requests[0]!.status}` });
      }
      if (requests[0]!.requested_by === operator_id) {
        return reply.code(403).send({ error: 'You cannot approve your own upload' });
      }

      await query(
        `UPDATE asset_approval_requests
         SET status = 'APPROVED', reviewed_by = $1, reviewed_at = now(), review_note = $2
         WHERE request_id = $3`,
        [operator_id, review_note ?? null, request_id],
      );

      return reply.send({
        asset_id,
        request_id,
        status: 'APPROVED',
        approved_by: operator_id,
        at_utc_ms: Date.now(),
      });
    },
  );

  // POST /api/v2/assets/:asset_id/reject
  app.post<{
    Params: { asset_id: string };
    Body: { request_id: string; review_note: string };
  }>(
    '/api/v2/assets/:asset_id/reject',
    async (request, reply) => {
      const { asset_id } = request.params;
      const { request_id, review_note } = request.body;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      if (!review_note?.trim()) {
        return reply.code(400).send({ error: 'review_note (rejection reason) is required' });
      }

      const requests = await query<{ requested_by: string; status: string }>(
        `SELECT requested_by, status FROM asset_approval_requests
         WHERE request_id = $1 AND content_asset_id = $2`,
        [request_id, asset_id],
      );
      if (requests.length === 0) return reply.code(404).send({ error: 'Not found' });
      if (requests[0]!.status !== 'PENDING') {
        return reply.code(409).send({ error: `Request is already ${requests[0]!.status}` });
      }
      if (requests[0]!.requested_by === operator_id) {
        return reply.code(403).send({ error: 'You cannot reject your own upload' });
      }

      await query(
        `UPDATE asset_approval_requests
         SET status = 'REJECTED', reviewed_by = $1, reviewed_at = now(), review_note = $2
         WHERE request_id = $3`,
        [operator_id, review_note, request_id],
      );

      return reply.send({
        asset_id,
        request_id,
        status: 'REJECTED',
        review_note,
        at_utc_ms: Date.now(),
      });
    },
  );

  // GET /api/v2/assets/:asset_id/approval-status
  app.get<{ Params: { asset_id: string } }>(
    '/api/v2/assets/:asset_id/approval-status',
    async (request, reply) => {
      const { asset_id } = request.params;

      const rows = await query<{
        request_id: string;
        status: string;
        requested_by: string;
        requested_at: Date;
        reviewed_by: string | null;
        reviewed_at: Date | null;
        review_note: string | null;
      }>(
        `SELECT request_id, status, requested_by, requested_at, reviewed_by, reviewed_at, review_note
         FROM asset_approval_requests
         WHERE content_asset_id = $1
         ORDER BY requested_at DESC
         LIMIT 1`,
        [asset_id],
      );

      if (rows.length === 0) {
        return reply.send({ asset_id, status: 'NO_REQUEST', approved: false });
      }

      return reply.send({
        asset_id,
        approved: rows[0]!.status === 'APPROVED',
        ...rows[0],
      });
    },
  );
}
