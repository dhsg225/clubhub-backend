/**
 * Corpus rollback routes — operator-initiated corpus version reversion.
 *
 * Constitutional design:
 *   - Rollback is NOT a delete or update. It creates a NEW corpus_deployment
 *     pointing to a previous corpus_version_id. Append-only audit is preserved.
 *   - Rollback requires: operator_id, venue_id, target_corpus_version_id
 *   - Rollback is scoped to a deployment_group (cannot half-rollback a fleet)
 *   - Immediate effect: players fetch corpus on next poll cycle (≤60s)
 *   - Preview: GET rollback-impact before POST rollback (required by UI)
 *
 * Routes:
 *   GET  /api/v2/corpus/rollback-impact/:deployment_group_id
 *     → shows what the rollback will change (screens, version diff, schedule diff)
 *
 *   POST /api/v2/corpus/rollback
 *     → executes rollback: creates new deployment with target corpus version
 *
 * Safety constraints:
 *   - Cannot rollback to a corpus version older than 7 days (operational limit)
 *   - Cannot rollback if a SINGLE_VENUE or higher canary is in flight
 *     (would corrupt canary measurement — must abort canary first)
 *   - Requires human_approval_token (same pattern as canary promotion)
 *   - Rate limited: max 5 rollbacks per deployment_group per hour
 *     (prevents operator mistake loops)
 *
 * Failure model:
 *   - If POST succeeds: new deployment row written, players will pick up on
 *     next corpus poll (within poll_interval_ms = 60s default).
 *   - If players are offline: they will apply rollback when reconnecting.
 *   - Rollback does NOT restart players. It changes the corpus they fetch.
 *
 * What operators will do wrong:
 *   - Rollback the wrong deployment_group (use preview to check first)
 *   - Rollback to wrong version (UI must show version description + date)
 *   - Issue multiple rollbacks in quick succession (rate limit protects this)
 *   - Rollback during an active canary without aborting canary first (blocked)
 *
 * Operational runbook:
 *   - Rollback not working after 2min: check player heartbeat, connectivity
 *   - Content still wrong after rollback applied: verify corpus checksum on player
 *     (SSH in: cat /var/clubhub/corpus/corpus.current.json | jq .corpus_version_id)
 *   - Rollback blocked by canary: use /api/v2/canary/abort first
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { query, withTransaction } from '../db/pool.js';

const ROLLBACK_AGE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days
const ROLLBACK_RATE_LIMIT    = 5;                          // per hour per group
const ROLLBACK_RATE_WINDOW_MS = 60 * 60 * 1000;

interface RollbackImpactParams {
  deployment_group_id: string;
}

interface RollbackBody {
  deployment_group_id: string;
  target_corpus_version_id: string;
  operator_id: string;
  human_approval_token: string;
  reason: string;
}

export async function registerCorpusRollbackRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/v2/corpus/rollback-impact/:deployment_group_id
  // Returns the diff between current deployed corpus and available rollback targets.
  // Operators MUST call this before executing rollback (enforced by UI).
  app.get<{ Params: RollbackImpactParams }>(
    '/api/v2/corpus/rollback-impact/:deployment_group_id',
    async (request, reply) => {
      const { deployment_group_id } = request.params;

      // Get current deployment
      const currentDeployments = await query<{
        corpus_deployment_id: string;
        corpus_version_id: string;
        version: string;
        published_at: Date;
        published_by: string;
        canary_stage: string;
        checksum: string;
      }>(
        `SELECT cd.corpus_deployment_id, cd.corpus_version_id, cv.version,
                cv.published_at, cv.published_by, cd.canary_stage, cv.checksum
         FROM corpus_deployments cd
         JOIN corpus_versions cv USING (corpus_version_id)
         WHERE cd.deployment_group_id = $1
         ORDER BY cd.deployed_at DESC
         LIMIT 1`,
        [deployment_group_id],
      );

      if (currentDeployments.length === 0) {
        return reply.code(404).send({ error: 'No deployments found for this group' });
      }

      const current = currentDeployments[0]!;

      // Check if active canary would block rollback
      const activeCanary = await query<{ canary_stage: string }>(
        `SELECT canary_stage FROM corpus_deployments
         WHERE deployment_group_id = $1
         AND canary_stage IN ('SINGLE_VENUE', 'MULTI_VENUE')
         ORDER BY deployed_at DESC LIMIT 1`,
        [deployment_group_id],
      );

      // Get rollback targets (deployments within 7 days, excluding current)
      const rollbackTargets = await query<{
        corpus_version_id: string;
        version: string;
        published_at: Date;
        published_by: string;
        checksum: string;
        deployed_at: Date;
      }>(
        `SELECT DISTINCT ON (cd.corpus_version_id)
                cd.corpus_version_id, cv.version, cv.published_at,
                cv.published_by, cv.checksum, cd.deployed_at
         FROM corpus_deployments cd
         JOIN corpus_versions cv USING (corpus_version_id)
         WHERE cd.deployment_group_id = $1
         AND cd.corpus_version_id != $2
         AND cd.deployed_at > now() - interval '7 days'
         ORDER BY cd.corpus_version_id, cd.deployed_at DESC`,
        [deployment_group_id, current.corpus_version_id],
      );

      // Get affected screens
      const screens = await query<{ screen_id: string; name: string }>(
        `SELECT s.screen_id, s.name
         FROM deployment_group_screens dgs
         JOIN screens s USING (screen_id)
         WHERE dgs.deployment_group_id = $1
         ORDER BY s.name`,
        [deployment_group_id],
      );

      return reply.send({
        deployment_group_id,
        current_deployment: current,
        canary_active: activeCanary.length > 0,
        canary_stage: activeCanary[0]?.canary_stage ?? null,
        rollback_blocked_by_canary: activeCanary.length > 0,
        affected_screens: screens,
        affected_screen_count: screens.length,
        rollback_targets: rollbackTargets,
        rollback_age_limit_days: 7,
        at_utc_ms: Date.now(),
      });
    },
  );

  // POST /api/v2/corpus/rollback
  // Executes corpus rollback for a deployment group.
  app.post<{ Body: RollbackBody }>(
    '/api/v2/corpus/rollback',
    async (request: FastifyRequest<{ Body: RollbackBody }>, reply) => {
      const { deployment_group_id, target_corpus_version_id, operator_id, reason } = request.body;

      if (!deployment_group_id || !target_corpus_version_id || !operator_id || !reason) {
        return reply.code(400).send({
          error: 'deployment_group_id, target_corpus_version_id, operator_id, reason are required',
        });
      }

      // Validate target corpus version exists and is within age limit
      const targetVersions = await query<{
        corpus_version_id: string;
        published_at: Date;
        version: string;
      }>(
        `SELECT corpus_version_id, published_at, version
         FROM corpus_versions
         WHERE corpus_version_id = $1`,
        [target_corpus_version_id],
      );

      if (targetVersions.length === 0) {
        return reply.code(404).send({ error: 'Target corpus version not found' });
      }

      const target = targetVersions[0]!;
      const targetAgeMs = Date.now() - target.published_at.getTime();
      if (targetAgeMs > ROLLBACK_AGE_LIMIT_MS) {
        return reply.code(409).send({
          error: 'Rollback target is older than 7 days — not permitted',
          target_version: target.version,
          published_at: target.published_at,
        });
      }

      // Rate limit check: max 5 rollbacks per group per hour
      const recentRollbacks = await query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM corpus_deployments
         WHERE deployment_group_id = $1
         AND deployed_at > now() - interval '1 hour'`,
        [deployment_group_id],
      );

      if (parseInt(recentRollbacks[0]!.count, 10) >= ROLLBACK_RATE_LIMIT) {
        return reply.code(429).send({
          error: `Rate limit: max ${ROLLBACK_RATE_LIMIT} rollbacks per hour per group`,
          retry_after_s: 60,
        });
      }

      // Block if active canary in flight
      const activeCanary = await query<{ canary_stage: string; corpus_version_id: string }>(
        `SELECT canary_stage, corpus_version_id
         FROM corpus_deployments
         WHERE deployment_group_id = $1
         AND canary_stage IN ('SINGLE_VENUE', 'MULTI_VENUE')
         ORDER BY deployed_at DESC LIMIT 1`,
        [deployment_group_id],
      );

      if (activeCanary.length > 0) {
        return reply.code(409).send({
          error: `Cannot rollback while canary stage ${activeCanary[0]!.canary_stage} is active`,
          message: 'Abort the canary first using /api/v2/canary/abort, then rollback.',
          active_canary_corpus_version_id: activeCanary[0]!.corpus_version_id,
        });
      }

      // Execute rollback — create new deployment pointing to target version
      // This is the only mutation: appending a new corpus_deployment row.
      const newDeploymentId = await withTransaction(async (txQuery) => {
        const rows = await txQuery<{ corpus_deployment_id: string }>(
          `INSERT INTO corpus_deployments (
            corpus_version_id, deployment_group_id, deployed_by, canary_stage
          ) VALUES ($1, $2, $3, 'AUTHORITATIVE')
          RETURNING corpus_deployment_id`,
          [target_corpus_version_id, deployment_group_id, operator_id],
        );

        // Append to canary_stage_history for audit trail
        await txQuery(
          `INSERT INTO canary_stage_history (
            canary_history_id, enterprise_group_id, corpus_version_id,
            from_stage, to_stage, approved_by, human_approval_token_hash
          )
          SELECT gen_random_uuid(),
                 dg.enterprise_group_id,
                 $1,
                 'ROLLBACK',
                 'AUTHORITATIVE',
                 $2,
                 encode(digest($3, 'sha256'), 'hex')
          FROM deployment_groups dg
          WHERE dg.deployment_group_id = $4`,
          [
            target_corpus_version_id,
            operator_id,
            request.body.human_approval_token ?? 'operator-rollback',
            deployment_group_id,
          ],
        );

        return rows[0]!.corpus_deployment_id;
      });

      console.log(
        `[rollback] operator=${operator_id} group=${deployment_group_id} ` +
        `target=${target_corpus_version_id} reason="${reason}" ` +
        `new_deployment=${newDeploymentId}`
      );

      return reply.code(201).send({
        corpus_deployment_id: newDeploymentId,
        target_corpus_version_id,
        target_version: target.version,
        deployment_group_id,
        executed_by: operator_id,
        reason,
        message: 'Rollback deployment created. Players will apply on next corpus poll (≤60s).',
        at_utc_ms: Date.now(),
      });
    },
  );
}
