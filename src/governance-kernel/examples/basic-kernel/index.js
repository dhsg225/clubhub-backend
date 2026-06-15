'use strict';
/**
 * basic-kernel/index.js
 *
 * Minimal governance kernel boot + core API usage example.
 *
 * Run: node index.js
 * Requires: DATABASE_URL env var pointing to a PostgreSQL instance
 */

const { Pool } = require('pg');

// Import only from api/ — never from core/
const AuthorityCoordinator = require('../../api/AuthorityCoordinator');
const FreezeController     = require('../../api/FreezeController');
const AuditLedger          = require('../../api/AuditLedger');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // ── 1. Initialize kernel APIs via dependency injection ──────────────────
  const authorityCoordinator = new AuthorityCoordinator({ pool });
  const freezeController     = new FreezeController({ pool });
  const auditLedger          = new AuditLedger({ pool });

  await authorityCoordinator.init();
  await freezeController.init();
  await auditLedger.init();
  console.log('[boot] Governance kernel initialized');

  // ── 2. Read authority epoch (CACHE_COHERENT) ────────────────────────────
  const epoch = await authorityCoordinator.getEpoch();
  console.log('[epoch] Current authority epoch:', epoch);

  // ── 3. Freeze deployment (LINEARIZED) ───────────────────────────────────
  await freezeController.freeze('example freeze', pool);
  const frozen = await freezeController.isFrozenStrong(pool);
  console.log('[freeze] frozen=%s epoch=%s', frozen.frozen, frozen.epoch);

  // ── 4. Append audit entries (DB_AUTHORITATIVE) ───────────────────────────
  await auditLedger.appendEntry({
    action:      'example.freeze',
    operator_id: 'example-operator',
    detail:      { reason: 'example freeze' },
  });
  await auditLedger.appendEntry({
    action:      'example.read',
    operator_id: 'example-operator',
    detail:      { epoch },
  });
  const entries = await auditLedger.getRecent(5);
  console.log('[audit] Appended %d audit entries', entries.length);

  // ── 5. Increment epoch (LINEARIZED) ─────────────────────────────────────
  console.log('[epoch] Incrementing epoch (LINEARIZED)...');
  const newEpoch = await authorityCoordinator.incrementEpoch(pool);
  console.log('[epoch] New epoch:', newEpoch);

  // ── 6. Unfreeze (LINEARIZED) ─────────────────────────────────────────────
  await freezeController.unfreeze('example unfreeze', pool);
  const unfrozen = await freezeController.isFrozenStrong(pool);
  console.log('[unfreeze] frozen=%s', unfrozen.frozen);

  console.log('[done] Basic kernel example complete');
  await pool.end();
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
