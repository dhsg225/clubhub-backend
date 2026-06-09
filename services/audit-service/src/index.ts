/**
 * Audit Service — constitutional event audit log
 *
 * NOTE: audit-service and replay-service may merge in Wave 2.
 * Keep these separate until the Wave 2 architecture decision clarifies
 * whether constitutional event audit (state transitions, operator actions)
 * should share the same storage and API as PRE replay audit.
 *
 * Current scope:
 * - Constitutional state transition audit (HEALTHY -> DEGRADED, etc.)
 * - Operator action audit (who triggered emergency, who promoted canary)
 * - Corpus publication audit trail
 *
 * replay-service scope (separate):
 * - PRE.resolve() invocation replay records (per-screen, per-cycle)
 */

import { startServer } from './app.js';

startServer().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal: audit-service failed to start', err);
  process.exit(1);
});
