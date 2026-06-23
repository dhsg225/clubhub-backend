'use strict';

const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// GET /widgets — list all, ordered by sort_order
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT slug, display_name, description, config_schema, sort_order, created_at FROM widgets ORDER BY sort_order ASC, slug ASC'
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /widgets/:slug — single widget
router.get('/:slug', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT slug, display_name, description, config_schema, sort_order, created_at FROM widgets WHERE slug = $1',
      [req.params.slug]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
