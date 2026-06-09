/**
 * Entropy Service — scheduled entropy management for playlist diversity
 *
 * Scans venues and fleet for entropy advisories. When entropy drops below
 * acceptable thresholds, issues an entropy_advisory to the PRE inputs
 * so resolution adjusts scheduling variety.
 *
 * Scan intervals (configurable):
 * - Per-venue scan: VENUE_SCAN_INTERVAL_MS (default 1h)
 * - Fleet scan: FLEET_SCAN_INTERVAL_MS (default 6h)
 */

import { startServer } from './app.js';

startServer().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal: entropy-service failed to start', err);
  process.exit(1);
});
