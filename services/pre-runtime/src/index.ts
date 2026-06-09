/**
 * Player Runtime — edge process running on Raspberry Pi
 *
 * Invokes PRE.resolve() loop, manages local corpus, buffers audit records.
 *
 * Architecture:
 * - Local WebSocket server on ws://localhost:7777 (player-ui connects here)
 * - No inbound HTTP — outbound sync only (corpus pull, audit push)
 * - PRE.resolve() runs every playlist-cycle (30s default)
 * - Audit records are buffered locally and flushed to replay-service in batches
 *
 * Constitutional constraints:
 * - Emergency overlay cannot be suppressed by resolve() output
 * - Corpus sync failure falls back to last-known-good corpus
 * - Audit flush failure queues records — never drops
 */

import { startRuntime } from './runtime.js';

startRuntime().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal: pre-runtime failed to start', err);
  process.exit(1);
});
