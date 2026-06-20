'use strict';

const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Admin-key guard: when MULTI_TENANT_ENFORCE=true, require X-Admin-Key header
function requireAdminKey(req, res, next) {
  if (process.env.MULTI_TENANT_ENFORCE !== 'true') return next();
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'ADMIN_KEY_REQUIRED' });
  }
  next();
}

// GET /tenants — list all
router.get('/', requireAdminKey, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, name, slug, created_at FROM tenants ORDER BY created_at ASC');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /tenants — create
router.post('/', requireAdminKey, async (req, res) => {
  const { name, slug } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
  if (slug.length > 50) return res.status(400).json({ error: 'slug must be 50 characters or fewer' });
  try {
    const r = await pool.query(
      'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING *',
      [name, slug]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'slug already exists' });
    res.status(500).json({ error: err.message });
  }
});

// GET /tenants/:id — fetch one
router.get('/:id', requireAdminKey, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM tenants WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /tenants/:id — update name/slug
router.patch('/:id', requireAdminKey, async (req, res) => {
  const { name, slug } = req.body;
  try {
    const r = await pool.query(
      `UPDATE tenants SET
         name = COALESCE($1, name),
         slug = COALESCE($2, slug)
       WHERE id = $3 RETURNING *`,
      [name, slug, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'slug already exists' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
