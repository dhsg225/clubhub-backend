/**
 * Shadow Service — parity comparison for canary promotion governance
 *
 * Receives pre-computed PRE + legacy outputs. NEVER calls pre-engine.resolve() directly.
 *
 * Compares PRE output checksums against legacy system output checksums.
 * Divergences are classified (CLASS 0-4) and trigger rollback conditions at
 * CLASS_3 and CLASS_4 per constitutional canary governance.
 *
 * Constitutional constraint: this service is read-only with respect to PRE.
 * It observes divergence — never causes it.
 */

import { startServer } from './app.js';

startServer().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal: shadow-service failed to start', err);
  process.exit(1);
});
