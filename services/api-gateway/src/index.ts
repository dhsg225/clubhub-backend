/**
 * API Gateway — routes all external requests
 *
 * Enforces:
 * - TLS termination (in production; terminate at gateway)
 * - Auth token verification (JWT validation before forwarding)
 * - Rate limiting (per-org, per-endpoint)
 * - Constitutional state propagation (rejects writes during READ_ONLY/EMERGENCY_FREEZE)
 *
 * Upstream services:
 * - CMS_API_URL — all /api/v1/cms/* requests
 * - REPLAY_SERVICE_URL — all /api/v1/replay/* requests
 * - ENTROPY_SERVICE_URL — all /api/v1/entropy/* requests
 */

import { startServer } from './app.js';

startServer().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal: api-gateway failed to start', err);
  process.exit(1);
});
