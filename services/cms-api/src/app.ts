/**
 * CMS API — Fastify application.
 *
 * Wave 1 routes:
 * - GET /resolve/:screen_id    — PRE resolution endpoint
 * - GET /preview/:screen_id    — Preview resolution (PREVIEW: prefix)
 * - GET /entropy/:venue_id     — Entropy snapshot
 * - GET /health/live           — Liveness
 * - GET /health/ready          — Readiness
 * - GET /health/runtime        — Runtime state
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { initPool } from './db/pool.js';
import { loadConfig } from './config.js';
import { registerHealthRoutes } from './health.js';
import { registerResolveRoutes } from './routes/resolve.js';
import { registerHealthRuntimeRoutes } from './routes/health-runtime.js';
import { registerMetricsRoutes } from './routes/metrics.js';
import { registerEntropyRoutes } from './routes/entropy.js';
import { registerAuditRoutes } from './routes/audit.js';
import { registerFleetHealthRoutes } from './routes/fleet-health.js';
import { registerCorpusRollbackRoutes } from './routes/corpus-rollback.js';
import { registerProvisioningRoutes } from './routes/provisioning.js';
import { registerRemoteCommandRoutes } from './routes/remote-commands.js';
import { registerMaintenanceRoutes } from './routes/maintenance.js';
import { registerAssetApprovalRoutes } from './routes/asset-approval.js';
import { registerDeploymentApprovalRoutes } from './routes/deployment-approval.js';
import { registerReEnrollmentRoutes } from './routes/re-enrollment.js';
import { registerFreezeStatusRoutes } from './routes/freeze-status.js';
import { registerContentRoutes } from './routes/content.js';
import { registerCampaignRoutes } from './routes/campaigns.js';
import { registerCorpusRoutes } from './routes/corpus.js';
import { authPreHandler } from './auth/fastify-auth.js';
import { registerDevAuthRoutes } from './routes/dev-auth.js';

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig();

  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // ─── Database ─────────────────────────────────────────────────────────────
  const pool = initPool();

  // Verify DB connection on startup
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  app.log.info('Database connection established');

  // ─── Auth ─────────────────────────────────────────────────────────────────
  app.addHook('preHandler', authPreHandler);

  // ─── Routes ───────────────────────────────────────────────────────────────
  await app.register(registerHealthRoutes);
  await app.register(registerResolveRoutes);
  await app.register(registerHealthRuntimeRoutes);
  await app.register(registerMetricsRoutes);
  await app.register(registerEntropyRoutes);
  await app.register(registerAuditRoutes);
  await app.register(registerFleetHealthRoutes);
  await app.register(registerCorpusRollbackRoutes);
  await app.register(registerProvisioningRoutes);
  await app.register(registerRemoteCommandRoutes);
  await app.register(registerMaintenanceRoutes);
  await app.register(registerAssetApprovalRoutes);
  await app.register(registerDeploymentApprovalRoutes);
  await app.register(registerReEnrollmentRoutes);
  await app.register(registerFreezeStatusRoutes);
  await app.register(registerContentRoutes);
  await app.register(registerCampaignRoutes);
  await app.register(registerCorpusRoutes);
  await app.register(registerDevAuthRoutes);

  return app;
}

export async function startServer(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp();

  try {
    const address = await app.listen({
      port: config.port,
      host: config.host,
    });
    app.log.info(`CMS API listening on ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
