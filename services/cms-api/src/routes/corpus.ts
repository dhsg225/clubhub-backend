/**
 * Corpus delivery endpoint.
 *
 * GET /api/v2/screens/:screen_id/corpus
 *
 * Returns the current content corpus for a screen. The player-runtime polls
 * this every 60s to obtain asset_urls (content_id → cdn_url) for local caching
 * and to populate asset_path on playlist items before Chromium render.
 *
 * Response shape is consumed directly by player-runtime/src/orchestrator.ts
 * and validated by corpus-cache.ts using fnv1a32(canonicalizeJson(corpus_data)).
 *
 * corpus_version_id: stable hex derived from sorted active content_asset_ids.
 *   Changes only when the active content set changes — player skips apply if unchanged.
 *
 * asset_urls: content_asset_id → { url: cdn_url, expires_at_ms }
 *   cdn_url from content_assets is treated as non-expiring (static host).
 *   expires_at_ms set to now + 30 days — a fixed CDN URL never expires but
 *   the player needs a value to track urgency of re-sync.
 */
import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { fnv1a32, canonicalizeJson } from '@clubhub/fnv-checksum';
import { query } from '../db/pool.js';

interface CorpusParams {
  screen_id: string;
}

interface ContentAssetRow {
  content_asset_id: string;
  cdn_url: string;
  media_type: string;
  duration_ms: number | null;
}

export async function registerCorpusRoutes(app: FastifyInstance): Promise<void> {

  app.get<{ Params: CorpusParams }>(
    '/api/v2/screens/:screen_id/corpus',
    async (request, reply) => {
      const { screen_id } = request.params;
      const nowMs = Date.now();

      // 1. Verify screen exists and get venue_id
      const screens = await query<{ screen_id: string; venue_id: string }>(
        'SELECT screen_id, venue_id FROM screens WHERE screen_id = $1',
        [screen_id],
      );
      if (screens.length === 0) {
        return reply.code(404).send({ error: 'Screen not found', screen_id });
      }
      const { venue_id } = screens[0]!;

      // 2. Get active campaigns for this venue
      const campaigns = await query<{ campaign_id: string }>(
        `SELECT campaign_id FROM campaigns
         WHERE venue_id = $1 AND status IN ('APPROVED', 'SCHEDULED', 'ACTIVE')`,
        [venue_id],
      );
      const campaignIds = campaigns.map(c => c.campaign_id);

      // 3. Get content assets for active campaigns (with cdn_url)
      let assets: ContentAssetRow[] = [];
      if (campaignIds.length > 0) {
        const placeholders = campaignIds.map((_, i) => `$${i + 1}`).join(', ');
        assets = await query<ContentAssetRow>(
          `SELECT DISTINCT ca.content_asset_id, ca.cdn_url, ca.media_type, ca.duration_ms
           FROM campaign_items ci
           JOIN content_assets ca ON ca.content_asset_id = ci.content_asset_id
           WHERE ci.campaign_id IN (${placeholders})
             AND ca.deleted_at IS NULL
           ORDER BY ca.content_asset_id ASC`,
          campaignIds,
        );
      }

      // 4. Build asset_urls map: content_asset_id → { url, expires_at_ms }
      // cdn_url is a static host URL — no signed expiry. Set expires_at_ms to 30 days
      // from now so the player's urgency threshold (4h) never fires on static URLs.
      const expiresAtMs = nowMs + 30 * 24 * 60 * 60 * 1000;
      const asset_urls: Record<string, { url: string; expires_at_ms: number }> = {};
      for (const asset of assets) {
        asset_urls[asset.content_asset_id] = {
          url: asset.cdn_url,
          expires_at_ms: expiresAtMs,
        };
      }

      // 5. corpus_data — minimal content manifest (stored on player, not used for render)
      const corpus_data = {
        venue_id,
        asset_count: assets.length,
        content_ids: assets.map(a => a.content_asset_id),
      };

      // 6. checksum — must match corpus-cache.ts verifyChecksum()
      //    fnv1a32(canonicalizeJson(corpus_data)).toString(16).padStart(8, '0')
      const checksum = fnv1a32(canonicalizeJson(corpus_data)).toString(16).padStart(8, '0');

      // 7. corpus_version_id — stable identifier for this exact content set.
      //    Hash of sorted asset IDs — changes only when active content changes.
      //    Player skips corpus apply when version_id is unchanged (no wasted writes).
      const versionSource = assets.map(a => a.content_asset_id).join(',');
      const corpus_version_id = versionSource
        ? createHash('sha256').update(versionSource).digest('hex').slice(0, 16)
        : 'empty-venue-' + venue_id.slice(0, 8);

      return reply.send({
        corpus_version_id,
        checksum,
        fetched_at: nowMs,
        effective_at: nowMs,
        corpus_data,
        asset_urls,
      });
    },
  );
}
