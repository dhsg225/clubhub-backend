'use strict';
/**
 * routes.js — Governed OTA runtime route factory.
 *
 * Returns an Express router with governed routes.
 * All mutating routes are protected by OperatorAuthority.requireAuth().
 * All operator actions append to AuditLedger via governed-operators.js.
 *
 * Routes:
 *   GET  /runtime/status          — lifecycle + deployment context (VIEWER)
 *   GET  /runtime/snapshot        — full runtime snapshot (OPERATOR)
 *   POST /deployment/promote      — wave promotion (OPERATOR)
 *   POST /deployment/freeze       — freeze deployment (OPERATOR)
 *   POST /deployment/unfreeze     — unfreeze deployment (ADMIN)
 *   POST /deployment/rollback     — rollback (ADMIN)
 *   POST /deployment/complete     — mark complete (OPERATOR)
 *   GET  /incidents               — list active incidents (VIEWER)
 *   POST /incidents               — create incident (OPERATOR)
 *   POST /incidents/:id/transition — transition state (OPERATOR)
 *   POST /incidents/:id/archive   — archive (OPERATOR)
 *   GET  /config                  — get config snapshot (VIEWER)
 *   POST /config                  — update config (ADMIN)
 *
 * All routes preserve:
 *   - Existing OTA API external behavior
 *   - ADMIN/OPERATOR/VIEWER role semantics
 *   - JTI protections via OperatorAuthority middleware
 */

/* global require, module */

function createRouter(deps = {}) {
  const {
    governedDeployment,
    governedIncidents,
    governedConfig,
    governedOperators,
    deploymentRuntime,
    lifecycle,
    replayHooks,
    pool,                  // pg.Pool — passed through to governed-* for LINEARIZED ops
  } = deps;

  // Express router — dynamically required to avoid coupling at module level
  const express = require('express');
  const router  = express.Router();

  const ROLES = governedOperators.ROLES;

  // ── Status / snapshot ─────────────────────────────────────────────────────

  router.get('/runtime/status', governedOperators.requireAuth(ROLES.VIEWER), (req, res) => {
    res.json({
      lifecycle:   lifecycle.snapshot(),
      deployment:  deploymentRuntime.getDeploymentContext(),
      replay:      replayHooks.status(),
      frozen:      governedDeployment.isFrozen(),
      epoch:       governedDeployment.getEpoch(),
    });
  });

  router.get('/runtime/snapshot', governedOperators.requireAuth(ROLES.OPERATOR), (req, res) => {
    res.json({
      lifecycle:   lifecycle.snapshot(),
      deployment:  deploymentRuntime.snapshot(),
      config:      governedConfig.snapshot(),
      replay:      replayHooks.status(),
      frozen:      governedDeployment.isFrozen(),
      epoch:       governedDeployment.getEpoch(),
      incidents:   governedIncidents.getActive(),
    });
  });

  // ── Deployment ────────────────────────────────────────────────────────────

  router.post('/deployment/promote', governedOperators.requireAuth(ROLES.OPERATOR), async (req, res) => {
    try {
      const { ring, wave_index, artifact_id, node_count, justification } = req.body ?? {};
      if (ring == null || wave_index == null) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'ring and wave_index required' });
      }
      const result = await governedDeployment.promoteWave(ring, wave_index, {
        operator_id:  req.operatorId,
        justification,
        artifact_id,
        node_count,
      });
      deploymentRuntime.updateProgress(ring, wave_index, node_count, { epoch: result.epoch });
      governedOperators.appendAction({
        action_type:  'deployment_wave_promoted',
        operator_id:  req.operatorId,
        justification: justification ?? `Promote ring=${ring} wave=${wave_index}`,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      _handleError(res, err);
    }
  });

  router.post('/deployment/freeze', governedOperators.requireAuth(ROLES.OPERATOR), async (req, res) => {
    try {
      const { reason, justification } = req.body ?? {};
      if (!reason) return res.status(400).json({ error: 'BAD_REQUEST', message: 'reason required' });
      const result = await governedDeployment.freezeDeployment(reason, pool, {
        operator_id:  req.operatorId,
        justification: justification ?? reason,
      });
      if (lifecycle.isActive()) lifecycle.transition('FROZEN', reason);
      governedOperators.appendAction({
        action_type:  'deployment_frozen',
        operator_id:  req.operatorId,
        justification: justification ?? reason,
      });
      res.json({ ok: true, frozen: true, result });
    } catch (err) {
      _handleError(res, err);
    }
  });

  router.post('/deployment/unfreeze', governedOperators.requireAuth(ROLES.ADMIN), async (req, res) => {
    try {
      const { reason, justification } = req.body ?? {};
      if (!reason) return res.status(400).json({ error: 'BAD_REQUEST', message: 'reason required' });
      governedDeployment.unfreezeDeployment(reason, {
        operator_id:  req.operatorId,
        justification: justification ?? reason,
      });
      if (lifecycle.isFrozen()) lifecycle.transition('ACTIVE', reason);
      governedOperators.appendAction({
        action_type:  'deployment_unfrozen',
        operator_id:  req.operatorId,
        justification: justification ?? reason,
      });
      res.json({ ok: true, frozen: false });
    } catch (err) {
      _handleError(res, err);
    }
  });

  router.post('/deployment/rollback', governedOperators.requireAuth(ROLES.ADMIN), async (req, res) => {
    try {
      const { reason, artifact_id, target_artifact_id, justification } = req.body ?? {};
      if (!reason) return res.status(400).json({ error: 'BAD_REQUEST', message: 'reason required' });
      const result = await governedDeployment.rollbackDeployment(reason, pool, {
        operator_id:  req.operatorId,
        justification: justification ?? reason,
        artifact_id,
        target_artifact_id,
      });
      deploymentRuntime.markRolledBack({ reason });
      governedOperators.appendAction({
        action_type:  'deployment_rollback',
        operator_id:  req.operatorId,
        justification: justification ?? reason,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      _handleError(res, err);
    }
  });

  router.post('/deployment/complete', governedOperators.requireAuth(ROLES.OPERATOR), async (req, res) => {
    try {
      const { artifact_id, justification } = req.body ?? {};
      const result = await governedDeployment.completeDeployment({
        operator_id:  req.operatorId,
        justification: justification ?? 'Deployment completed',
        artifact_id,
      });
      deploymentRuntime.markComplete();
      if (lifecycle.isFrozen()) {
        // Auto-unfreeze after completion is OPERATOR decision — route does not auto-unfreeze
      }
      governedOperators.appendAction({
        action_type:  'deployment_complete',
        operator_id:  req.operatorId,
        justification: justification ?? 'Deployment completed',
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      _handleError(res, err);
    }
  });

  // ── Incidents ─────────────────────────────────────────────────────────────

  router.get('/incidents', governedOperators.requireAuth(ROLES.VIEWER), (req, res) => {
    res.json({ incidents: governedIncidents.getActive() });
  });

  router.post('/incidents', governedOperators.requireAuth(ROLES.OPERATOR), async (req, res) => {
    try {
      const { type, severity, causal_chain, justification } = req.body ?? {};
      if (!type || !severity) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'type and severity required' });
      }
      const incident = await governedIncidents.create(type, severity, causal_chain ?? {}, {
        operator_id:  req.operatorId,
        justification: justification ?? `Incident created by operator`,
      });
      governedOperators.appendAction({
        action_type:  'incident_created',
        operator_id:  req.operatorId,
        justification: justification ?? `Incident created: ${type}`,
      });
      res.json({ ok: true, incident });
    } catch (err) {
      _handleError(res, err);
    }
  });

  router.post('/incidents/:id/transition', governedOperators.requireAuth(ROLES.OPERATOR), async (req, res) => {
    try {
      const { to_state, reason, linearized } = req.body ?? {};
      if (!to_state || !reason) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'to_state and reason required' });
      }
      let result;
      if (linearized && pool) {
        result = await governedIncidents.transitionStrong(pool, req.params.id, to_state, reason, {
          operator_id: req.operatorId,
        });
      } else {
        result = await governedIncidents.transition(req.params.id, to_state, reason, {
          operator_id: req.operatorId,
        });
      }
      governedOperators.appendAction({
        action_type:  'incident_transitioned',
        operator_id:  req.operatorId,
        justification: reason,
      });
      res.json({ ok: true, result });
    } catch (err) {
      _handleError(res, err);
    }
  });

  router.post('/incidents/:id/archive', governedOperators.requireAuth(ROLES.OPERATOR), async (req, res) => {
    try {
      const { justification } = req.body ?? {};
      await governedIncidents.archive(req.params.id, {
        operator_id:  req.operatorId,
        justification: justification ?? `Archive incident ${req.params.id}`,
      });
      governedOperators.appendAction({
        action_type:  'incident_archived',
        operator_id:  req.operatorId,
        justification: justification ?? `Archive incident ${req.params.id}`,
      });
      res.json({ ok: true });
    } catch (err) {
      _handleError(res, err);
    }
  });

  // ── Config ────────────────────────────────────────────────────────────────

  router.get('/config', governedOperators.requireAuth(ROLES.VIEWER), (req, res) => {
    res.json({
      snapshot: governedConfig.snapshot(),
      frozen:   governedConfig.isFrozen(),
    });
  });

  router.post('/config', governedOperators.requireAuth(ROLES.ADMIN), (req, res) => {
    try {
      const { changes, justification } = req.body ?? {};
      if (!changes || typeof changes !== 'object') {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'changes object required' });
      }
      if (!justification) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'justification required' });
      }
      const snap = governedConfig.update(changes, {
        justification,
        operator_id: req.operatorId,
      });
      governedOperators.appendAction({
        action_type:  'config_changed',
        operator_id:  req.operatorId,
        justification,
        after_state_hash: snap?.config_hash ?? null,
      });
      res.json({ ok: true, snapshot: snap });
    } catch (err) {
      _handleError(res, err);
    }
  });

  return router;
}

function _handleError(res, err) {
  const code = err.code ?? 'INTERNAL_ERROR';
  const status =
    code === 'REPLAY_ISOLATION_VIOLATION' ? 409 :
    code === 'DEPLOYMENT_FROZEN'           ? 409 :
    500;
  res.status(status).json({ error: code, message: err.message });
}

module.exports = { createRouter };
