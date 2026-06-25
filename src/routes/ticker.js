'use strict';

const express  = require('express');
const { pool } = require('../db');

const router = express.Router();

// GET /ticker?screen_id=:id
router.get('/', async (req, res) => {
  const { screen_id } = req.query;
  if (!screen_id) return res.status(400).json({ error: 'screen_id required' });
  try {
    const r = await pool.query(
      'SELECT * FROM ticker_items WHERE screen_id = $1 AND tenant_id = $2 ORDER BY display_order ASC, created_at ASC',
      [screen_id, req.tenantId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /ticker
router.post('/', async (req, res) => {
  const { screen_id, text, display_order, active } = req.body || {};
  if (!screen_id) return res.status(400).json({ error: 'screen_id required' });
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text required' });
  if (text.length > 280) return res.status(400).json({ error: 'text must be 280 characters or fewer' });
  try {
    const r = await pool.query(
      `INSERT INTO ticker_items (screen_id, text, display_order, active, tenant_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [screen_id, text, display_order ?? 0, active !== false, req.tenantId]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'screen not found' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /ticker/:id
router.patch('/:id', async (req, res) => {
  const { text, display_order, active } = req.body || {};
  if (text !== undefined && (typeof text !== 'string' || text.length > 280)) {
    return res.status(400).json({ error: 'text must be a string of 280 characters or fewer' });
  }
  try {
    const r = await pool.query(
      `UPDATE ticker_items
       SET text          = COALESCE($2, text),
           display_order = COALESCE($3, display_order),
           active        = COALESCE($4, active)
       WHERE id = $1 AND tenant_id = $5 RETURNING *`,
      [req.params.id, text ?? null, display_order ?? null, active ?? null, req.tenantId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /ticker/:id
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM ticker_items WHERE id = $1 AND tenant_id = $2 RETURNING id', [req.params.id, req.tenantId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
