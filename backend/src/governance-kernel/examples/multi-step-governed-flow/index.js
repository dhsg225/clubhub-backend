'use strict';
/**
 * multi-step-governed-flow/index.js
 *
 * Demonstrates a 4-step governed workflow with full event trace.
 *
 * Run: node index.js
 * Requires: DATABASE_URL env var
 */

const { Pool } = require('pg');

const AuthorityCoordinator = require('../../api/AuthorityCoordinator');
const FreezeController     = require('../../api/FreezeController');
const IncidentManager      = require('../../api/IncidentManager');
const ConfigAuthority      = require('../../api/ConfigAuthority');
const OperatorAuthority    = require('../../api/OperatorAuthority');
const AuditLedger          = require('../../api/AuditLedger');
const { createEventBus }   = require('../../event-bus');
const { createGovernanceSDK } = require('../../../governance-sdk');
const { createAgentRuntime }  = require('../../../agent-runtime');

async function main() {
  const pool     = new Pool({ connectionString: process.env.DATABASE_URL });
  const eventBus = createEventBus();

  // Boot kernel
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

  const sdk     = createGovernanceSDK({
    authorityCoordinator, freezeController, incidentManager,
    configAuthority, operatorAuthority, auditLedger, eventBus, pool,
  });
  const runtime = createAgentRuntime({ sdkClient: sdk.client, kernelClock: null, eventBus });

  console.log('[boot] SDK + Agent runtime initialized');

  // Collect events for trace verification
  const stepEvents = [];
  eventBus.subscribe('workflow.*', (ev) => {
    console.log('[events]', ev.event_type, JSON.stringify(ev.payload));
    if (ev.event_type === 'workflow.step.completed') stepEvents.push(ev.payload);
  });
  eventBus.subscribe('agent.*', (ev) => {
    console.log('[events]', ev.event_type, JSON.stringify(ev.payload));
  });

  // Define 4-step workflow
  const workflow = {
    id:         'governed-deployment-flow',
    replayable: true,
    steps: [
      { step_index: 0, action: 'audit.append', args: { action: 'flow.step1', operator_id: 'multi-example' }, consistencyLevel: 'DB_AUTHORITATIVE' },
      { step_index: 1, action: 'audit.append', args: { action: 'flow.step2', operator_id: 'multi-example' }, consistencyLevel: 'DB_AUTHORITATIVE' },
      { step_index: 2, action: 'audit.append', args: { action: 'flow.step3', operator_id: 'multi-example' }, consistencyLevel: 'DB_AUTHORITATIVE' },
      { step_index: 3, action: 'audit.append', args: { action: 'flow.step4', operator_id: 'multi-example' }, consistencyLevel: 'DB_AUTHORITATIVE' },
    ],
  };

  runtime.registerWorkflow(workflow);
  console.log('[define] Workflow: governed-deployment-flow (%d steps)', workflow.steps.length);

  console.log('[run] Starting agent execution');
  const result = await runtime.run('governed-deployment-flow');

  console.log('[trace] Workflow trace: %d steps %s', result.results?.length ?? 0, result.status);

  // Verify step ordering is deterministic
  const indices = stepEvents.map(e => e.step_index);
  const inOrder = indices.every((v, i) => i === 0 || v > indices[i - 1]);
  if (inOrder) {
    console.log('[trace] All steps deterministic: ✓');
  }

  runtime.shutdown();

  console.log('[done] Multi-step governed flow example complete');
  await pool.end();
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
