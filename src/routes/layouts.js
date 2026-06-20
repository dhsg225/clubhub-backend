'use strict';

/**
 * layouts.js — BL-048 Part 1
 *
 * CRUD for DB-backed screen layouts.
 * System layouts (is_system = true) can be patched but not deleted.
 * Custom layouts can be deleted only when no screens reference them.
 */

const express  = require('express');
const { pool } = require('../db');

const router = express.Router();

// GET /layouts — list all, ordered by sort_order
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT slug, display_name, definition, is_system, sort_order, created_at FROM layouts ORDER BY sort_order ASC, created_at ASC'
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /layouts — create custom layout
router.post('/', async (req, res) => {
  const { slug, display_name, definition, sort_order } = req.body || {};

  if (!slug || typeof slug !== 'string' || !slug.trim()) {
    return res.status(400).json({ error: 'slug is required' });
  }
  if (slug.length > 60) {
    return res.status(400).json({ error: 'slug must be 60 characters or fewer' });
  }
  if (!display_name || typeof display_name !== 'string') {
    return res.status(400).json({ error: 'display_name is required' });
  }
  if (!definition || typeof definition !== 'object') {
    return res.status(400).json({ error: 'definition (JSONB object) is required' });
  }

  try {
    const r = await pool.query(
      `INSERT INTO layouts (slug, display_name, definition, is_system, sort_order)
       VALUES ($1, $2, $3, false, $4) RETURNING *`,
      [slug.trim(), display_name.trim(), JSON.stringify(definition), sort_order ?? 0]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'slug already exists' });
    res.status(500).json({ error: err.message });
  }
});

// GET /layouts/:slug — single layout
router.get('/:slug', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM layouts WHERE slug = $1', [req.params.slug]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /layouts/:slug — update display_name and/or definition
router.patch('/:slug', async (req, res) => {
  const { display_name, definition, sort_order } = req.body || {};

  try {
    const r = await pool.query(
      `UPDATE layouts SET
         display_name = COALESCE($2, display_name),
         definition   = COALESCE($3, definition),
         sort_order   = COALESCE($4, sort_order)
       WHERE slug = $1 RETURNING *`,
      [
        req.params.slug,
        display_name ?? null,
        definition ? JSON.stringify(definition) : null,
        sort_order ?? null,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /layouts/:slug — reject system layouts and in-use layouts
router.delete('/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    // Check existence + system flag
    const layout = await pool.query('SELECT is_system FROM layouts WHERE slug = $1', [slug]);
    if (!layout.rows.length) return res.status(404).json({ error: 'Not found' });
    if (layout.rows[0].is_system) {
      return res.status(409).json({ error: 'Cannot delete a system layout' });
    }

    // Check if any screens reference this layout
    const usage = await pool.query('SELECT COUNT(*)::int AS cnt FROM screens WHERE screen_layout = $1', [slug]);
    if (usage.rows[0].cnt > 0) {
      return res.status(409).json({ error: `Layout in use by ${usage.rows[0].cnt} screen(s)` });
    }

    await pool.query('DELETE FROM layouts WHERE slug = $1', [slug]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
