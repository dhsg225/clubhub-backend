/**
 * CMS API Service
 *
 * Owns: organizations, venues, screens, campaigns, schedules,
 *       overrides, sponsorships, templates, corpus versions, deployment groups.
 *
 * Constitutional constraint: MUST NOT import @clubhub/pre-engine.
 * Corpus is DATA to this service — never CODE.
 */

import { startServer } from './app.js';

startServer().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal: CMS API failed to start', err);
  process.exit(1);
});
