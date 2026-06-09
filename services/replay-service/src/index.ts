/**
 * Replay Service — Cloud-side audit storage
 *
 * Append-only service. DELETE /audit/:id is constitutionally forbidden.
 * POST /audit/batch is the only write path.
 *
 * All records are hash-chained. Each record's hash depends on the previous
 * record's hash, forming an immutable audit ledger.
 *
 * Constitutional constraint: audit records MUST NOT be deleted or mutated.
 * Correction records are added as new entries referencing the original.
 */

import { startServer } from './app.js';

startServer().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal: replay-service failed to start', err);
  process.exit(1);
});
