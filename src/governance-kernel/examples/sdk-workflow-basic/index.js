'use strict';
/**
 * sdk-workflow-basic/index.js
 *
 * Creates and executes a basic governance SDK workflow.
 *
 * Run: node index.js
 * Requires: DATABASE_URL env var
 */

const { Pool } = require('pg');

// Kernel API layer
const AuthorityCoordinator = require('../../api/AuthorityCoordinator');
const FreezeController     = require('../../api/FreezeController');
const IncidentManager      = require('../../api/IncidentManager');
const ConfigAuthority      = require('../../api/ConfigAuthority');
const OperatorAuthority    = require('../../api/OperatorAuthority');
const AuditLedger          = require('../../api/AuditLedger');
const { createEventBus }   = require('../../event-bus');

// Governance SDK
const { createGovernanceSDK } = require('../../../governance-sdk');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const eventBus = createEventBus();

  // ── 1. Boot kernel APIs ───────────────────────────────────────────────────
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

  // ── 2. Create SDK ─────────────────────────────────────────────────────────
  const sdk = createGovernanceSDK({
    authorityCoordinator, freezeController, incidentManager,
    configAuthority, operatorAuthority, auditLedger, eventBus, pool,
  });
  console.log('[boot] SDK initialized');

  // ── 3. Subscribe to workflow events ──────────────────────────────────────
  eventBus.subscribe('workflow.*', (ev) => {
    console.log('[events]', ev.event_type, JSON.stringify(ev.payload));
  });

  // ── 4. Define a workflow ──────────────────────────────────────────────────
  sdk.workflowEngine.define({
    id:         'deploy-and-audit',
    replayable: true,
    steps: [
      {
        action:           'audit.append',
        args:             { action: 'example.step1', operator_id: 'sdk-example' },
        consistencyLevel: 'DB_AUTHORITATIVE',
      },
      {
        action:           'audit.append',
        args:             { action: 'example.step2', operator_id: 'sdk-example' },
        consistencyLevel: 'DB_AUTHORITATIVE',
      },
    ],
  });
  console.log('[workflow] Defined: deploy-and-audit (2 steps)');

  // ── 5. Execute the workflow ───────────────────────────────────────────────
  const trace = await sdk.workflowEngine.execute('deploy-and-audit');
  console.log('[result] status:', trace.status);

  console.log('[done] SDK workflow basic example complete');
  await pool.end();
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
