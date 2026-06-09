'use strict';
/**
 * plugin-runtime/index.js
 *
 * Demonstrates OTA plugin runtime integration with governance kernel.
 *
 * Run: node index.js
 * Requires: DATABASE_URL env var
 */

const { Pool } = require('pg');

// Governance kernel API layer only — never core/
const AuthorityCoordinator = require('../../api/AuthorityCoordinator');
const FreezeController     = require('../../api/FreezeController');
const IncidentManager      = require('../../api/IncidentManager');
const ConfigAuthority      = require('../../api/ConfigAuthority');
const OperatorAuthority    = require('../../api/OperatorAuthority');
const AuditLedger          = require('../../api/AuditLedger');
const { createEventBus }   = require('../../event-bus');

// OTA plugin runtime — receives all deps via init()
const { createOTARuntime } = require('../../plugins/ota-runtime');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // ── 1. Boot governance kernel APIs ───────────────────────────────────────
  const eventBus             = createEventBus();
  const authorityCoordinator = new AuthorityCoordinator({ pool, eventBus });
  const freezeController     = new FreezeController({ pool, eventBus });
  const incidentManager      = new IncidentManager({ pool, eventBus });
  const configAuthority      = new ConfigAuthority({ pool, eventBus });
  const operatorAuthority    = new OperatorAuthority({ pool });
  const auditLedger          = new AuditLedger({ pool, eventBus });

  await Promise.all([
    authorityCoordinator.init(),
    freezeController.init(),
    incidentManager.init(),
    configAuthority.init(),
    operatorAuthority.init(),
    auditLedger.init(),
  ]);
  console.log('[boot] Governance kernel initialized');

  // Subscribe to events to observe governance actions
  eventBus.subscribe('governance.*', (event) => {
    console.log('[events]  ', event.event_type, JSON.stringify(event.payload ?? {}));
  });

  // ── 2. Boot OTA plugin runtime via dependency injection ──────────────────
  const runtime = createOTARuntime();
  await runtime.init({
    authorityCoordinator,
    freezeController,
    incidentManager,
    configAuthority,
    operatorAuthority,
    auditLedger,
    eventBus,
  });
  console.log('[boot] OTA plugin runtime initialized');
  console.log('[lifecycle] Runtime state:', runtime.lifecycle.currentState());

  // ── 3. Promote a deployment wave ──────────────────────────────────────────
  const ring = 'prod-eu-west-1';
  console.log('[promote] Promoting wave 0 on ring:', ring);

  await runtime.governedDeployment.promoteWave(ring, 0, {
    operator_id: 'example-operator',
    artifact_id: 'firmware-v2.1.0',
  });
  console.log('[promote] Wave promotion complete');

  // ── 4. Read runtime snapshot ──────────────────────────────────────────────
  const snap = runtime.snapshot();
  console.log('[snapshot]', JSON.stringify({
    lifecycle: snap.lifecycle.currentState,
    epoch:     snap.authority?.epoch,
    frozen:    snap.freeze?.frozen,
  }));

  console.log('[done] Plugin runtime example complete');
  await pool.end();
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
