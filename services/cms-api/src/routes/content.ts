/**
 * Content asset routes.
 *
 * Creates content_assets and queues them for approval.
 * Approval workflow (two-approver) is handled by asset-approval.ts.
 *
 * POST /api/v2/enterprises/:enterprise_group_id/content-assets
 *   — operator provides an already-hosted cdn_url (no file upload here)
 *   — creates content_asset + approval request in one transaction
 *   — asset is usable in campaigns immediately (approval status tracked separately)
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { withTransaction } from '../db/pool.js';

interface CreateAssetParams {
  enterprise_group_id: string;
}

interface CreateAssetBody {
  filename: string;
  media_type: string;
  cdn_url: string;
  file_size_bytes: number;
  checksum_sha256: string;
  duration_ms?: number;         // null/omit for images
  compliance_type?: string;
  is_compliance_asset?: boolean;
}

export async function registerContentRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/v2/enterprises/:enterprise_group_id/content-assets
  // Create a content asset from an already-hosted URL.
  // Operator must provide cdn_url — file upload is out of scope for Wave 1.
  // An approval request is created automatically. Approval status is visible
  // via GET /api/v2/assets/pending-approval but does not block campaign use.
  app.post<{ Params: CreateAssetParams; Body: CreateAssetBody }>(
    '/api/v2/enterprises/:enterprise_group_id/content-assets',
    async (request, reply) => {
      const { enterprise_group_id } = request.params;
      const {
        filename,
        media_type,
        cdn_url,
        file_size_bytes,
        checksum_sha256,
        duration_ms,
        compliance_type,
        is_compliance_asset,
      } = request.body;

      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      // Validate required fields
      if (!filename?.trim()) return reply.code(400).send({ error: 'filename is required' });
      if (!media_type?.trim()) return reply.code(400).send({ error: 'media_type is required' });
      if (!cdn_url?.trim()) return reply.code(400).send({ error: 'cdn_url is required' });
      if (!file_size_bytes || file_size_bytes <= 0) return reply.code(400).send({ error: 'file_size_bytes must be a positive integer' });
      if (!checksum_sha256?.trim()) return reply.code(400).send({ error: 'checksum_sha256 is required' });

      const result = await withTransaction(async (txQuery) => {
        // Verify enterprise group exists
        const groups = await txQuery<{ enterprise_group_id: string }>(
          'SELECT enterprise_group_id FROM enterprise_groups WHERE enterprise_group_id = $1 AND deleted_at IS NULL',
          [enterprise_group_id],
        );
        if (groups.length === 0) return null;

        // Insert content asset
        const assets = await txQuery<{ content_asset_id: string; created_at: Date }>(
          `INSERT INTO content_assets
             (enterprise_group_id, filename, media_type, cdn_url, file_size_bytes,
              checksum_sha256, duration_ms, compliance_type, is_compliance_asset)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING content_asset_id, created_at`,
          [
            enterprise_group_id,
            filename.trim(),
            media_type.trim(),
            cdn_url.trim(),
            file_size_bytes,
            checksum_sha256.trim(),
            duration_ms ?? null,
            compliance_type ?? null,
            is_compliance_asset ?? false,
          ],
        );
        const asset = assets[0]!;

        // Auto-create approval request
        const requests = await txQuery<{ request_id: string }>(
          `INSERT INTO asset_approval_requests
             (content_asset_id, enterprise_group_id, requested_by)
           VALUES ($1, $2, $3)
           RETURNING request_id`,
          [asset.content_asset_id, enterprise_group_id, operator_id],
        );

        return {
          content_asset_id: asset.content_asset_id,
          approval_request_id: requests[0]!.request_id,
          created_at: asset.created_at,
        };
      });

      if (!result) {
        return reply.code(404).send({ error: 'Enterprise group not found' });
      }

      return reply.code(201).send({
        content_asset_id: result.content_asset_id,
        enterprise_group_id,
        filename: filename.trim(),
        media_type: media_type.trim(),
        cdn_url: cdn_url.trim(),
        approval_request_id: result.approval_request_id,
        approval_status: 'PENDING',
        created_at: result.created_at,
      });
    },
  );
}
