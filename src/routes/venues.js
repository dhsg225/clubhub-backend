'use strict';

const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// GET /venues
router.get('/', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM venues ORDER BY created_at ASC');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /venues/:id
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM venues WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /venues
router.post('/', async (req, res) => {
  const { id, name, timezone = 'UTC' } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  try {
    const r = await pool.query(
      'INSERT INTO venues (id, name, timezone) VALUES ($1, $2, $3) RETURNING *',
      [id, name, timezone]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Venue id already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /venues/:id
router.patch('/:id', async (req, res) => {
  const { name, timezone } = req.body;
  try {
    const r = await pool.query(
      `UPDATE venues SET
         name     = COALESCE($1, name),
         timezone = COALESCE($2, timezone)
       WHERE id = $3 RETURNING *`,
      [name, timezone, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
