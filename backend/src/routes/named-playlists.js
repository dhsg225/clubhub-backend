const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// GET /named_playlists — list all with card count
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, ordering_rule,
             jsonb_array_length(items) AS card_count,
             created_at, updated_at
      FROM named_playlists
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /named_playlists:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /named_playlists — create
router.post('/', async (req, res) => {
  const { name, ordering_rule = 'sequential', items = [] } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (name.length > 120) {
    return res.status(400).json({ error: 'name must be 120 characters or fewer' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO named_playlists (name, ordering_rule, items)
       VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), ordering_rule, JSON.stringify(items)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /named_playlists:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /named_playlists/:id — fetch one with enriched card data
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM named_playlists WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

    const playlist = result.rows[0];
    const items = Array.isArray(playlist.items) ? playlist.items : [];
    const contentIds = items.map((i) => i.content_id).filter(Boolean);

    const contentMap = {};
    if (contentIds.length > 0) {
      const contentResult = await pool.query(
        'SELECT id, template_type, data FROM content WHERE id = ANY($1)',
        [contentIds]
      );
      for (const row of contentResult.rows) {
        contentMap[row.id] = row;
      }
    }

    const enrichedItems = items.map((item) => ({
      ...item,
      card: contentMap[item.content_id] ?? null,
    }));

    res.json({ ...playlist, items: enrichedItems });
  } catch (err) {
    console.error('GET /named_playlists/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /named_playlists/:id — partial update
router.put('/:id', async (req, res) => {
  const { name, ordering_rule, items } = req.body;

  const updates = [];
  const values = [];
  let idx = 1;

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name cannot be empty' });
    }
    if (name.length > 120) {
      return res.status(400).json({ error: 'name must be 120 characters or fewer' });
    }
    updates.push(`name = $${idx++}`);
    values.push(name.trim());
  }
  if (ordering_rule !== undefined) {
    updates.push(`ordering_rule = $${idx++}`);
    values.push(ordering_rule);
  }
  if (items !== undefined) {
    updates.push(`items = $${idx++}`);
    values.push(JSON.stringify(items));
  }

  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE named_playlists SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /named_playlists/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /named_playlists/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM named_playlists WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('DELETE /named_playlists/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
