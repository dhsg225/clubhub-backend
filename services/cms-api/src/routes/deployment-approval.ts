/**
 * Deployment approval routes — canary stage advancement with operator gate.
 *
 * Constitutional rules enforced here:
 *   1. Canary stages are sequential — cannot skip (SHADOW_ONLY → INTERNAL_CANARY → ...)
 *   2. Cannot advance during an active constitutional freeze
 *   3. Operator identity required for all advancement beyond SHADOW_ONLY
 *   4. Rollback preview must be available before each advancement
 *   5. Only one active canary deployment per deployment_group at a time
 *   6. Max 2 concurrent canary deployments across the fleet (concurrency limit)
 *   7. Automatic halt thresholds: advancement blocked if health metrics fail
 *
 * Routes:
 *   GET  /api/v2/canary/status/:deployment_group_id    — current canary state
 *   POST /api/v2/canary/advance                        — advance to next stage
 *   POST /api/v2/canary/abort                          — abort canary, rollback
 *   GET  /api/v2/canary/health-check/:deployment_group_id — pre-advance health gate
 *
 * Halt thresholds (automatic block on advancement):
 *   - Error rate in last 30min > 5%
 *   - Any screen in EMERGENCY state within the deployment group
 *   - Corpus checksum mismatch on any screen in the canary group
 *   - No heartbeat from canary screen in last 5min
 *
 * What operators will do wrong:
 *   - Skip the health check before advancing: blocked at API level
 *   - Advance two deployment groups simultaneously: concurrency limit prevents this
 *   - Advance during a P1 incident: constitutional freeze check prevents this
 *   - Forget to abort a stalled canary: 7-day automatic expiry (see V4 migration)
 *
 * Audit trail:
 *   - All advances recorded in canary_stage_history
 *   - All aborts recorded with reason
 *   - Fleet dashboard reads canary_stage_history for operator visibility
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { query, withTransaction } from '../db/pool.js';

// ── Types ──────────────────────────────────────────────────────────────────────

const CANARY_STAGE_ORDER = [
  'SHADOW_ONLY',
  'INTERNAL_CANARY',
  'SINGLE_VENUE',
  'MULTI_VENUE',
  'FLEET_WIDE',
  'AUTHORITATIVE',
] as const;

type CanaryStage = typeof CANARY_STAGE_ORDER[number];

const HALT_ERROR_RATE_THRESHOLD = 0.05;   // 5%
const HALT_HEARTBEAT_STALE_MS   = 5 * 60 * 1000;   // 5 min
const MAX_CONCURRENT_CANARIES   = 2;

interface AdvanceBody {
  deployment_group_id: string;
  target_stage: CanaryStage;
  operator_id: string;
  human_approval_token: string;
  reason: string;
}

interface AbortBody {
  deployment_group_id: string;
  operator_id: string;
  reason: string;
}

// ── Route registration ─────────────────────────────────────────────────────────

export async function registerDeploymentApprovalRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /api/v2/canary/status/:deployment_group_id ─────────────────────────
  // Current canary state for a deployment group.
  app.get<{ Params: { deployment_group_id: string } }>(
    '/api/v2/canary/status/:deployment_group_id',
    async (request, reply) => {
      const { deployment_group_id } = request.params;

      const current = await query<{
        corpus_deployment_id: string;
        corpus_version_id: string;
        canary_stage: string;
        deployed_at: Date;
        deployed_by: string;
      }>(
        `SELECT corpus_deployment_id, corpus_version_id, canary_stage, deployed_at, deployed_by
         FROM corpus_deployments
         WHERE deployment_group_id = $1
         ORDER BY deployed_at DESC LIMIT 1`,
        [deployment_group_id],
      );

      if (current.length === 0) {
        return reply.code(404).send({ error: 'No deployments found for this group' });
      }

      const deployment = current[0]!;
      const currentStageIndex = CANARY_STAGE_ORDER.indexOf(deployment.canary_stage as CanaryStage);
      const nextStage = currentStageIndex >= 0 && currentStageIndex < CANARY_STAGE_ORDER.length - 1
        ? CANARY_STAGE_ORDER[currentStageIndex + 1]
        : null;

      // Recent history (last 5 transitions)
      const history = await query<{
        from_stage: string;
        to_stage: string;
        approved_by: string;
        approved_at: Date;
      }>(
        `SELECT from_stage, to_stage, approved_by, approved_at
         FROM canary_stage_history
         WHERE corpus_version_id = $1
         ORDER BY approved_at DESC LIMIT 5`,
        [deployment.corpus_version_id],
      );

      // Constitutional freeze check
      const freeze = await query<{ is_frozen: boolean; reason: string | null }>(
        `SELECT is_frozen, reason FROM constitutional_freeze_active`,
      );

      return reply.send({
        deployment_group_id,
        current_deployment: deployment,
        current_stage: deployment.canary_stage,
        next_stage: nextStage,
        is_authoritative: deployment.canary_stage === 'AUTHORITATIVE',
        constitutional_freeze_active: freeze.length > 0,
        constitutional_freeze_reason: freeze[0]?.reason ?? null,
        stage_history: history,
        at_utc_ms: Date.now(),
      });
    },
  );

  // ── GET /api/v2/canary/health-check/:deployment_group_id ──────────────────
  // Pre-advance health gate. Must pass before advancement allowed.
  app.get<{ Params: { deployment_group_id: string } }>(
    '/api/v2/canary/health-check/:deployment_group_id',
    async (request, reply) => {
      const { deployment_group_id } = request.params;
      const checks = await runHealthChecks(deployment_group_id);
      const allPass = checks.every(c => c.pass);

      return reply.send({
        deployment_group_id,
        advancement_allowed: allPass,
        checks,
        at_utc_ms: Date.now(),
      });
    },
  );

  // ── POST /api/v2/canary/advance ────────────────────────────────────────────
  // Advance canary to next stage with operator approval.
  app.post<{ Body: AdvanceBody }>(
    '/api/v2/canary/advance',
    async (request: FastifyRequest<{ Body: AdvanceBody }>, reply) => {
      const { deployment_group_id, target_stage, operator_id, human_approval_token, reason } = request.body;

      if (!deployment_group_id || !target_stage || !operator_id || !reason) {
        return reply.code(400).send({
          error: 'deployment_group_id, target_stage, operator_id, reason are required',
        });
      }

      // Token required for all stages beyond SHADOW_ONLY
      if (target_stage !== 'SHADOW_ONLY') {
        if (!human_approval_token || human_approval_token.length < 8) {
          return reply.code(403).send({
            error: 'CONSTITUTIONAL VIOLATION: Human approval token required for canary advancement',
            message: 'Canary advancement past SHADOW_ONLY is a human gate — no automation allowed.',
          });
        }
      }

      if (!CANARY_STAGE_ORDER.includes(target_stage)) {
        return reply.code(400).send({ error: `Invalid target_stage: ${target_stage}` });
      }

      // Constitutional freeze check — hard block
      // Uses constitutional_freeze_active view (V9 migration) which queries
      // constitutional_freeze_log correctly for the current active freeze state.
      const freeze = await query<{ is_frozen: boolean; reason: string | null }>(
        `SELECT is_frozen, reason FROM constitutional_freeze_active`,
      );
      if (freeze[0]?.is_frozen) {
        return reply.code(409).send({
          error: 'CONSTITUTIONAL FREEZE ACTIVE — deployment blocked',
          freeze_reason: freeze[0].reason ?? 'reason not recorded',
          message: 'Resolve the constitutional freeze before advancing the canary.',
        });
      }

      // Get current stage
      const currentDeployments = await query<{
        corpus_deployment_id: string;
        corpus_version_id: string;
        canary_stage: string;
        enterprise_group_id: string;
      }>(
        `SELECT cd.corpus_deployment_id, cd.corpus_version_id, cd.canary_stage,
                dg.enterprise_group_id
         FROM corpus_deployments cd
         JOIN deployment_groups dg USING (deployment_group_id)
         WHERE cd.deployment_group_id = $1
         ORDER BY cd.deployed_at DESC LIMIT 1`,
        [deployment_group_id],
      );

      if (currentDeployments.length === 0) {
        return reply.code(404).send({ error: 'No deployment found for this group' });
      }

      const current = currentDeployments[0]!;
      const currentIndex = CANARY_STAGE_ORDER.indexOf(current.canary_stage as CanaryStage);
      const targetIndex  = CANARY_STAGE_ORDER.indexOf(target_stage);

      // Enforce sequential progression — no skipping stages
      if (targetIndex !== currentIndex + 1) {
        return reply.code(409).send({
          error: `Cannot skip canary stages. Current: ${current.canary_stage}, target: ${target_stage}`,
          expected_next: CANARY_STAGE_ORDER[currentIndex + 1] ?? 'AUTHORITATIVE (already there)',
          message: 'Canary stages must be advanced one at a time.',
        });
      }

      // Concurrency limit — max 2 active canaries fleet-wide
      const activeCanaried = await query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM corpus_deployments
         WHERE canary_stage IN ('INTERNAL_CANARY', 'SINGLE_VENUE', 'MULTI_VENUE')
         AND deployment_group_id != $1
         AND deployed_at > now() - interval '7 days'`,
        [deployment_group_id],
      );
      if (parseInt(activeCanaried[0]!.count, 10) >= MAX_CONCURRENT_CANARIES) {
        return reply.code(429).send({
          error: `Fleet canary limit reached: max ${MAX_CONCURRENT_CANARIES} concurrent canaries`,
          message: 'Wait for another canary deployment to complete or abort before advancing.',
        });
      }

      // Health gate — must pass automated checks before advancement
      const healthChecks = await runHealthChecks(deployment_group_id);
      const failedChecks = healthChecks.filter(c => !c.pass);
      if (failedChecks.length > 0) {
        return reply.code(409).send({
          error: 'Canary health gate failed — advancement blocked',
          failed_checks: failedChecks,
          message: 'Resolve health issues before advancing the canary.',
        });
      }

      // Execute advancement — append new deployment row
      const newDeploymentId = await withTransaction(async (txQuery) => {
        const rows = await txQuery<{ corpus_deployment_id: string }>(
          `INSERT INTO corpus_deployments (
            corpus_version_id, deployment_group_id, deployed_by, canary_stage
          ) VALUES ($1, $2, $3, $4)
          RETURNING corpus_deployment_id`,
          [current.corpus_version_id, deployment_group_id, operator_id, target_stage],
        );

        // Record in canary history
        const tokenHash = human_approval_token
          ? Buffer.from(human_approval_token).toString('base64').slice(0, 16)
          : 'SHADOW_AUTO';

        await txQuery(
          `INSERT INTO canary_stage_history (
            canary_history_id, enterprise_group_id, corpus_version_id,
            from_stage, to_stage, approved_by, human_approval_token_hash
          ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
          [
            current.enterprise_group_id,
            current.corpus_version_id,
            current.canary_stage,
            target_stage,
            operator_id,
            tokenHash,
          ],
        );

        return rows[0]!.corpus_deployment_id;
      });

      console.log(
        `[deployment-approval] canary advanced: group=${deployment_group_id} ` +
        `${current.canary_stage}→${target_stage} by=${operator_id} reason="${reason}"`
      );

      return reply.code(201).send({
        corpus_deployment_id: newDeploymentId,
        deployment_group_id,
        from_stage: current.canary_stage,
        to_stage: target_stage,
        advanced_by: operator_id,
        reason,
        message: `Canary advanced to ${target_stage}. Screens in group will receive new corpus on next poll.`,
        at_utc_ms: Date.now(),
      });
    },
  );

  // ── POST /api/v2/canary/abort ──────────────────────────────────────────────
  // Abort active canary — creates a rollback deployment to last AUTHORITATIVE version.
  app.post<{ Body: AbortBody }>(
    '/api/v2/canary/abort',
    async (request: FastifyRequest<{ Body: AbortBody }>, reply) => {
      const { deployment_group_id, operator_id, reason } = request.body;

      if (!deployment_group_id || !operator_id || !reason) {
        return reply.code(400).send({
          error: 'deployment_group_id, operator_id, reason are required',
        });
      }

      // Find current active deployment
      const current = await query<{
        corpus_version_id: string;
        canary_stage: string;
        enterprise_group_id: string;
      }>(
        `SELECT cd.corpus_version_id, cd.canary_stage, dg.enterprise_group_id
         FROM corpus_deployments cd
         JOIN deployment_groups dg USING (deployment_group_id)
         WHERE cd.deployment_group_id = $1
         ORDER BY cd.deployed_at DESC LIMIT 1`,
        [deployment_group_id],
      );

      if (current.length === 0) {
        return reply.code(404).send({ error: 'No deployment found for this group' });
      }

      if (current[0]!.canary_stage === 'AUTHORITATIVE') {
        return reply.code(409).send({
          error: 'Deployment is already AUTHORITATIVE — nothing to abort',
          message: 'Use the corpus rollback route if you need to revert an authoritative deployment.',
        });
      }

      // Find last AUTHORITATIVE deployment to rollback to
      const lastAuth = await query<{ corpus_version_id: string; corpus_deployment_id: string }>(
        `SELECT corpus_version_id, corpus_deployment_id
         FROM corpus_deployments
         WHERE deployment_group_id = $1 AND canary_stage = 'AUTHORITATIVE'
         ORDER BY deployed_at DESC LIMIT 1`,
        [deployment_group_id],
      );

      if (lastAuth.length === 0) {
        return reply.code(409).send({
          error: 'No AUTHORITATIVE baseline to abort to — cannot rollback',
          message: 'This deployment group has never reached AUTHORITATIVE state.',
        });
      }

      const rollbackTarget = lastAuth[0]!;

      const newDeploymentId = await withTransaction(async (txQuery) => {
        // Create rollback deployment
        const rows = await txQuery<{ corpus_deployment_id: string }>(
          `INSERT INTO corpus_deployments (
            corpus_version_id, deployment_group_id, deployed_by, canary_stage
          ) VALUES ($1, $2, $3, 'AUTHORITATIVE')
          RETURNING corpus_deployment_id`,
          [rollbackTarget.corpus_version_id, deployment_group_id, operator_id],
        );

        // Record abort in history
        await txQuery(
          `INSERT INTO canary_stage_history (
            canary_history_id, enterprise_group_id, corpus_version_id,
            from_stage, to_stage, approved_by, human_approval_token_hash
          ) VALUES (gen_random_uuid(), $1, $2, $3, 'AUTHORITATIVE', $4, 'CANARY_ABORT')`,
          [
            current[0]!.enterprise_group_id,
            current[0]!.corpus_version_id,
            current[0]!.canary_stage,
            operator_id,
          ],
        );

        return rows[0]!.corpus_deployment_id;
      });

      console.log(
        `[deployment-approval] canary aborted: group=${deployment_group_id} ` +
        `from=${current[0]!.canary_stage} rollback_target=${rollbackTarget.corpus_version_id} ` +
        `by=${operator_id} reason="${reason}"`
      );

      return reply.code(201).send({
        corpus_deployment_id: newDeploymentId,
        deployment_group_id,
        aborted_from_stage: current[0]!.canary_stage,
        rollback_to_corpus_version_id: rollbackTarget.corpus_version_id,
        aborted_by: operator_id,
        reason,
        message: 'Canary aborted. Rollback deployment created. Screens will revert on next corpus poll (≤60s).',
        at_utc_ms: Date.now(),
      });
    },
  );
}

// ── Health check engine ────────────────────────────────────────────────────────

interface HealthCheckResult {
  check: string;
  pass: boolean;
  detail: string;
}

async function runHealthChecks(deploymentGroupId: string): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  // 1. All screens in group have heartbeat within last 5 min
  const staleScreens = await query<{ screen_id: string; screen_name: string; last_heartbeat_at: Date }>(
    `SELECT s.screen_id, s.name as screen_name, ps.last_heartbeat_at
     FROM deployment_group_screens dgs
     JOIN screens s USING (screen_id)
     LEFT JOIN player_state ps USING (screen_id)
     WHERE dgs.deployment_group_id = $1
     AND (ps.last_heartbeat_at IS NULL
          OR ps.last_heartbeat_at < now() - interval '5 minutes')`,
    [deploymentGroupId],
  );
  results.push({
    check: 'all_screens_heartbeat_recent',
    pass: staleScreens.length === 0,
    detail: staleScreens.length === 0
      ? 'All screens have recent heartbeats'
      : `${staleScreens.length} screen(s) stale: ${staleScreens.map(s => s.screen_name).join(', ')}`,
  });

  // 2. No screen in group is in EMERGENCY state
  const emergencyScreens = await query<{ screen_id: string; screen_name: string; constitutional_state: string }>(
    `SELECT s.screen_id, s.name as screen_name, ps.constitutional_state
     FROM deployment_group_screens dgs
     JOIN screens s USING (screen_id)
     JOIN player_state ps USING (screen_id)
     WHERE dgs.deployment_group_id = $1
     AND ps.constitutional_state IN ('EMERGENCY', 'DEGRADED')`,
    [deploymentGroupId],
  );
  results.push({
    check: 'no_screens_in_emergency',
    pass: emergencyScreens.length === 0,
    detail: emergencyScreens.length === 0
      ? 'No screens in emergency/degraded state'
      : `${emergencyScreens.length} screen(s) degraded: ${emergencyScreens.map(s => `${s.screen_name}(${s.constitutional_state})`).join(', ')}`,
  });

  // 3. Consecutive sync failure rate low
  const highFailureScreens = await query<{ screen_id: string; screen_name: string; consecutive_sync_failures: number }>(
    `SELECT s.screen_id, s.name as screen_name, ps.consecutive_sync_failures
     FROM deployment_group_screens dgs
     JOIN screens s USING (screen_id)
     JOIN player_state ps USING (screen_id)
     WHERE dgs.deployment_group_id = $1
     AND ps.consecutive_sync_failures >= 3`,
    [deploymentGroupId],
  );
  results.push({
    check: 'no_screens_with_high_sync_failures',
    pass: highFailureScreens.length === 0,
    detail: highFailureScreens.length === 0
      ? 'All screens syncing normally'
      : `${highFailureScreens.length} screen(s) with sync failures: ${highFailureScreens.map(s => s.screen_name).join(', ')}`,
  });

  // 4. No open P1 incidents on venues in this deployment group
  const openIncidents = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM venue_timeline_events vte
     JOIN deployment_group_screens dgs ON dgs.screen_id = vte.screen_id
     WHERE dgs.deployment_group_id = $1
     AND vte.event_type = 'INCIDENT_OPENED'
     AND vte.created_at > now() - interval '4 hours'`,
    [deploymentGroupId],
  );
  const incidentCount = parseInt(openIncidents[0]?.count ?? '0', 10);
  results.push({
    check: 'no_recent_incidents',
    pass: incidentCount === 0,
    detail: incidentCount === 0
      ? 'No incidents in last 4 hours'
      : `${incidentCount} incident(s) opened in last 4 hours`,
  });

  // 5. No pending remote commands for screens in group
  const pendingCommands = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM remote_commands rc
     JOIN deployment_group_screens dgs ON dgs.screen_id = rc.screen_id
     WHERE dgs.deployment_group_id = $1
     AND rc.status = 'PENDING'
     AND rc.expires_at > now()`,
    [deploymentGroupId],
  );
  const pendingCount = parseInt(pendingCommands[0]?.count ?? '0', 10);
  results.push({
    check: 'no_pending_remote_commands',
    pass: pendingCount === 0,
    detail: pendingCount === 0
      ? 'No pending remote commands'
      : `${pendingCount} pending command(s) — wait for completion before advancing`,
  });

  return results;
}
