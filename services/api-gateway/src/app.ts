import Fastify, { type FastifyInstance } from 'fastify';
import httpProxy from '@fastify/http-proxy';
import type { ConstitutionalState } from '@clubhub/constitutional-types';
import { loadConfig, type ApiGatewayConfig } from './config.js';
import { registerHealthRoutes } from './health.js';
import { verifyAndForwardIdentity, stripVerifiedHeaders } from './auth-proxy.js';
import { checkConstitutionalPermission } from './constitutional-middleware.js';

/** Build a testable app instance without starting the HTTP server. */
export async function buildApp(
  config: ApiGatewayConfig,
  /** Injectable for tests — defaults to 'OPERATIONAL' in production. */
  getConstitutionalState: () => ConstitutionalState = () => 'HEALTHY',
): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.NODE_ENV !== 'development' });

  // ── Health routes (no auth required) ──────────────────────────────────────
  await registerHealthRoutes(app);

  // ── Strip injected X-Verified-* headers before any processing ─────────────
  // Prevents header injection attacks from upstream clients.
  app.addHook('preHandler', stripVerifiedHeaders);

  // ── Auth middleware — verify JWT and forward identity headers ──────────────
  // Skips /health/* routes.
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/health')) return;
    await verifyAndForwardIdentity(req, reply);
  });

  // ── Constitutional state middleware ────────────────────────────────────────
  // Blocks mutations in READ_ONLY; blocks all non-emergency routes in EMERGENCY_FREEZE.
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/health')) return;
    const state = getConstitutionalState();
    const check = checkConstitutionalPermission({ method: req.method, path: req.url }, state);
    if (!check.allowed) {
      await reply.code(check.httpStatus ?? 503).send({ error: check.reason });
    }
  });

  // ── Proxy routes ───────────────────────────────────────────────────────────
  // /screens/* and /venues/* → cms-api
  await app.register(httpProxy, {
    upstream: config.CMS_API_URL,
    prefix: '/screens',
    rewritePrefix: '/screens',
    http2: false,
  });
  await app.register(httpProxy, {
    upstream: config.CMS_API_URL,
    prefix: '/venues',
    rewritePrefix: '/venues',
    http2: false,
  });
  // /replay/* → replay-service
  await app.register(httpProxy, {
    upstream: config.REPLAY_SERVICE_URL,
    prefix: '/replay',
    rewritePrefix: '/replay',
    http2: false,
  });
  // /entropy/* → entropy-service
  await app.register(httpProxy, {
    upstream: config.ENTROPY_SERVICE_URL,
    prefix: '/entropy',
    rewritePrefix: '/entropy',
    http2: false,
  });

  return app;
}

export async function startServer(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp(config);
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
}
