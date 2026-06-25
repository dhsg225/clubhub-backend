'use strict';
/**
 * agent-execution-basic/index.js
 *
 * Demonstrates running a workflow via AgentRuntime with DeterministicContext.
 *
 * Run: node index.js
 * Requires: DATABASE_URL env var
 */

const { Pool } = require('pg');

const AuditLedger          = require('../../api/AuditLedger');
const AuthorityCoordinator = require('../../api/AuthorityCoordinator');
const FreezeController     = require('../../api/FreezeController');
const IncidentManager      = require('../../api/IncidentManager');
const ConfigAuthority      = require('../../api/ConfigAuthority');
const OperatorAuthority    = require('../../api/OperatorAuthority');
const { createEventBus }   = require('../../event-bus');

const { createGovernanceSDK } = require('../../../governance-sdk');
const { createAgentRuntime }  = require('../../../agent-runtime');

async function main() {
  const pool     = new Pool({ connectionString: process.env.DATABASE_URL });
  const eventBus = createEventBus();

  // ── 1. Boot kernel APIs ───────────────────────────────────────────────────
  const authorityCoordinator = new AuthorityCoordinator({ pool, eventBus });
  const freezeController     = new FreezeController({ pool, eventBus });
  const incidentManager      = new IncidentManager({ pool, eventBus });
  const configAuthority      = new ConfigAuthority({ pool, eventBus });
  const operatorAuthority    = new OperatorAuthority({ pool });
  const auditLedger          = new AuditLedger({ pool, eventBus });

  await Promise.all([
    authorityCoordinator.init(), freezeController.init(), incidentManager.init(),
    configAuthority.init(), operatorAuthority.init(), auditLedger.init(),
  ]);

  // ── 2. Create SDK ─────────────────────────────────────────────────────────
  const sdk = createGovernanceSDK({
    authorityCoordinator, freezeController, incidentManager,
    configAuthority, operatorAuthority, auditLedger, eventBus, pool,
  });

  // ── 3. Create agent runtime ───────────────────────────────────────────────
  const kernelClock = authorityCoordinator.clock?.();  // DeterministicClock
  const runtime = createAgentRuntime({ sdkClient: sdk.client, kernelClock, eventBus });

  console.log('[boot] Agent runtime initialized');
  console.log('[state] current:', runtime.snapshot().stateMachine.currentState);

  // ── 4. Subscribe to lifecycle events ──────────────────────────────────────
  eventBus.subscribe('agent.*', (ev) => {
    console.log('[events]', ev.event_type, JSON.stringify(ev.payload));
  });
  eventBus.subscribe('workflow.*', (ev) => {
    console.log('[events]', ev.event_type, JSON.stringify(ev.payload));
  });

  // ── 5. Register workflow ───────────────────────────────────────────────────
  const workflow = {
    id:         'basic-audit-workflow',
    replayable: true,
    steps: [
      { step_index: 0, action: 'audit.append', args: { action: 'example.agent.run', operator_id: 'agent-example' }, consistencyLevel: 'DB_AUTHORITATIVE' },
    ],
  };
  runtime.registerWorkflow(workflow);

  // ── 6. Run workflow ────────────────────────────────────────────────────────
  console.log('[run] Starting workflow: basic-audit-workflow');
  const result = await runtime.run('basic-audit-workflow');
  console.log('[run] result:', result.status);

  // ── 7. Shutdown ───────────────────────────────────────────────────────────
  runtime.shutdown();
  console.log('[state] current:', runtime.snapshot().stateMachine.currentState);

  console.log('[done] Agent execution basic example complete');
  await pool.end();
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
