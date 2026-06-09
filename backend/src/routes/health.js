'use strict';

const express = require('express');
const { pool } = require('../db');

const router = express.Router();
const START_TIME = Date.now();

// Read version once at startup
let APP_VERSION = 'unknown';
try {
  APP_VERSION = require('../../package.json').version;
} catch { /* ignore */ }

// ── /health/live ─────────────────────────────────────────────────────────────
// Kubernetes/Docker liveness probe: is the Node process alive?
// No DB check — a live process is healthy even during a transient DB outage.
router.get('/live', (_req, res) => {
  res.json({
    status:    'ok',
    uptime_s:  Math.floor(process.uptime()),
    ts:        new Date().toISOString(),
  });
});

// ── /health/ready ─────────────────────────────────────────────────────────────
// Kubernetes/Docker readiness probe: can the backend serve real traffic?
// Checks DB connectivity + manifest cache table reachability.
router.get('/ready', async (_req, res) => {
  const checks = {};
  let allOk = true;

  // DB connectivity
  const dbT0 = Date.now();
  try {
    await pool.query('SELECT 1');
    checks.db = { status: 'ok', latency_ms: Date.now() - dbT0 };
  } catch (err) {
    checks.db = { status: 'error', error: err.message };
    allOk = false;
  }

  // Manifest cache table reachability
  try {
    const r = await pool.query(
      `SELECT COUNT(*) AS cached_screens,
              EXTRACT(EPOCH FROM (NOW() - MIN(computed_at)))::int AS oldest_entry_s
       FROM manifest_cache`
    );
    checks.manifest_cache = {
      status:          'ok',
      cached_screens:  parseInt(r.rows[0].cached_screens, 10),
      oldest_entry_s:  r.rows[0].oldest_entry_s ?? null,
    };
  } catch (err) {
    checks.manifest_cache = { status: 'error', error: err.message };
    allOk = false;
  }

  const mem = process.memoryUsage();
  const status = allOk ? 'ok' : 'degraded';
  res.status(allOk ? 200 : 503).json({
    status,
    version:   APP_VERSION,
    uptime_s:  Math.floor(process.uptime()),
    ts:        new Date().toISOString(),
    checks,
    memory: {
      rss_mb:        Math.round(mem.rss        / 1024 / 1024),
      heap_used_mb:  Math.round(mem.heapUsed   / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal  / 1024 / 1024),
    },
  });
});

// ── /health (backward compat) ─────────────────────────────────────────────────
// Legacy format kept identical so existing Docker healthchecks and the chaos
// test harness don't break. Internally delegates to the ready check logic.
router.get('/', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

module.exports = router;
