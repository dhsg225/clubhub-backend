'use strict';
/**
 * ota.js
 *
 * OTA delivery routes. Implements OTA_GOVERNANCE.md delivery path.
 *
 * POST /ota/upload     — receive OTA package metadata, create rollout
 * GET  /ota/status     — return active rollout snapshot
 * POST /ota/promote    — attempt ring promotion with fleet metrics
 * POST /ota/rollback   — initiate manual rollback
 * POST /ota/freeze     — freeze rollout
 * POST /ota/unfreeze   — lift freeze
 */

const express = require('express');
const crypto  = require('node:crypto');
const { pool } = require('../db');
const { RolloutStore }     = require('../lib/rollout-store');
const { emit, EVENTS }     = require('../lib/events');
const policyEngine         = require('../lib/policy-engine');
const autonomousRollout    = require('../lib/autonomous-rollout');
const fleetConsensus       = require('../lib/fleet-consensus');
const operatorLedger       = require('../lib/operator-ledger');
const { requireOperatorAuth } = require('../middleware/operatorAuth');

const router = express.Router();

// Governed threshold accessor — reads from the governed-config singleton.
// The singleton is initialised in index.js before any requests are served.
// Falls back to {} if called before singleton is ready (startup race safety).
function _getThresholds() {
  const governedConfig = require('../lib/governed-config');
  const inst = governedConfig.getInstance();
  return inst ? inst.getAll() : {};
}

// ── Helper: load active rollout ───────────────────────────────────────────────

async function _loadActiveOrFail(res) {
  const store = await RolloutStore.loadActive(pool, _getThresholds());
  if (!store) {
    res.status(404).json({ error: 'No active rollout. Use POST /ota/upload to create one.' });
    return null;
  }
  return store;
}

// ── POST /ota/upload ─────────────────────────────────────────────────────────

router.post('/upload', requireOperatorAuth(), async (req, res) => {
  const { update_id, target_version, sha256, size_bytes, uploaded_by, metadata } = req.body || {};

  if (!update_id || !target_version || !sha256) {
    return res.status(400).json({ error: 'update_id, target_version, and sha256 are required' });
  }
  if (update_id.length > 255) {
    return res.status(400).json({ error: 'update_id must be ≤ 255 characters' });
  }
  if (!/^[0-9a-f]{64}$/i.test(sha256)) {
    return res.status(400).json({ error: 'sha256 must be a 64-character hex string (SHA-256)' });
  }

  try {
    const store = await RolloutStore.create(
      pool,
      { updateId: update_id, targetVersion: target_version, totalScreens: 0 },
      _getThresholds()
    );

    // Record the package metadata
    await pool.query(
      `INSERT INTO ota_packages (update_id, target_version, sha256, size_bytes, uploaded_by, ring_target, metadata)
       VALUES ($1, $2, $3, $4, $5, 0, $6)`,
      [update_id, target_version, sha256, size_bytes ?? null, uploaded_by ?? null, JSON.stringify(metadata ?? {})]
    );

    res.status(201).json({
      ok: true,
      update_id,
      target_version,
      state: store.state,
      sha256,
      message: 'OTA package registered. Rollout in PENDING state. Use POST /ota/promote to begin staging.',
    });
  } catch (err) {
    if (err.message?.includes('Cannot create rollout')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET /ota/status ──────────────────────────────────────────────────────────

router.get('/status', async (req, res) => {
  try {
    const store = await RolloutStore.loadActive(pool, _getThresholds());
    if (!store) {
      return res.json({ active: false, rollout: null });
    }

    // Fetch package metadata
    const pkgRes = await pool.query(
      'SELECT sha256, size_bytes, uploaded_at, uploaded_by FROM ota_packages WHERE update_id = $1',
      [store.updateId]
    );

    res.json({
      active: true,
      rollout: store.snapshot(),
      package: pkgRes.rows[0] ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ota/promote ────────────────────────────────────────────────────────

router.post('/promote', requireOperatorAuth(), async (req, res) => {
  try {
    const store = await _loadActiveOrFail(res);
    if (!store) return;

    // Metrics from request body (caller must provide fleet health snapshot)
    const metrics = req.body?.metrics ?? {};

    // Policy-governed promotion evaluation — must ALLOW before touching store
    const snapshot = store.snapshot();
    const evaluation = autonomousRollout.evaluatePromotion({
      currentState:         snapshot.state,
      metrics:              {
        fleetSuccessRate:      metrics.fleet_success_rate      ?? 0,
        ringHealthScore:       metrics.ring_health_score       ?? 0,
        desyncCount:           metrics.desync_count            ?? 0,
        adoptionPct:           metrics.adoption_pct            ?? 0,
        recoveryFailures:      metrics.recovery_failures       ?? 0,
        manifestRejectionRate: metrics.manifest_rejection_rate ?? 0,
      },
      observationElapsedMs:  metrics.observation_elapsed_ms   ?? 0,
      observationWindowMs:   metrics.observation_window_ms    ?? 0,
      consensusStatus:       fleetConsensus.getStatus().status,
      authorityLeaseSafe:    !fleetConsensus.isRolloutFrozen(),
      policyEngine,
      thresholds:            _getThresholds(),
    });

    if (evaluation.outcome !== 'PROMOTE') {
      return res.status(403).json({
        ok:         false,
        outcome:    evaluation.outcome,
        reason:     evaluation.reason,
        policy:     evaluation.policy_decision,
        evaluated_at: evaluation.evaluated_at,
      });
    }

    const result = await store.promoteRing(metrics);

    emit(result.promoted ? EVENTS.OTA.RING_PROMOTED : EVENTS.OTA.RING_FROZEN, req, {
      update_id:  store.updateId,
      result,
      evaluation,
    });

    res.json({ ok: result.promoted, result, evaluation, snapshot: store.snapshot() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ota/rollback ───────────────────────────────────────────────────────

router.post('/rollback', requireOperatorAuth(), async (req, res) => {
  try {
    const store = await _loadActiveOrFail(res);
    if (!store) return;

    const reason = req.body?.reason ?? 'operator_manual_rollback';
    const result = await store.rollback(reason);

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ ok: true, result, snapshot: store.snapshot() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ota/freeze ─────────────────────────────────────────────────────────

router.post('/freeze', requireOperatorAuth(), async (req, res) => {
  try {
    const store = await _loadActiveOrFail(res);
    if (!store) return;

    const reason = req.body?.reason ?? 'operator_manual_freeze';
    const result = await store.transition('FROZEN', reason);

    if (!result.ok) return res.status(400).json({ error: result.error });

    try {
      operatorLedger.appendEntry({
        operator_id:      req.body?.operator_id ?? 'api',
        action_type:      'rollout_freeze',
        justification:    reason,
        related_incident: req.body?.incident_id ?? null,
        approval_chain:   [],
      });
    } catch { /* ledger failure must not block freeze response */ }

    res.json({ ok: true, snapshot: store.snapshot() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ota/unfreeze ───────────────────────────────────────────────────────

router.post('/unfreeze', requireOperatorAuth(), async (req, res) => {
  try {
    const store = await _loadActiveOrFail(res);
    if (!store) return;

    const reason = req.body?.reason ?? 'operator_lifted';
    const result = await store.liftFreeze(reason);

    if (!result.ok) return res.status(400).json({ error: result.error });

    try {
      operatorLedger.appendEntry({
        operator_id:      req.body?.operator_id ?? 'api',
        action_type:      'rollout_unfreeze',
        justification:    reason,
        related_incident: req.body?.incident_id ?? null,
        approval_chain:   [],
      });
    } catch { /* ledger failure must not block unfreeze response */ }

    res.json({ ok: true, snapshot: store.snapshot() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /ota/packages/:update_id ────────────────────────────────────────────
// Pi-side OTA polling: fetch package metadata for a specific update

router.get('/packages/:update_id', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM ota_packages WHERE update_id = $1',
      [req.params.update_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Package not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
