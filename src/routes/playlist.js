const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// POST /playlist/generate
// Body: { screen_id, content_ids?: string[], duration?: number }
router.post('/generate', async (req, res) => {
  const { screen_id = 'screen-1', content_ids, duration = 10 } = req.body;

  try {
    let rows;

    if (content_ids && content_ids.length > 0) {
      const placeholders = content_ids.map((_, i) => `$${i + 1}`).join(',');
      const result = await pool.query(
        `SELECT * FROM content WHERE id IN (${placeholders}) ORDER BY created_at DESC`,
        content_ids
      );
      rows = result.rows;
    } else {
      const result = await pool.query('SELECT * FROM content ORDER BY created_at DESC');
      rows = result.rows;
    }

    const items = rows.map((row) => ({
      content_id: row.id,
      type: row.template_type,
      data: row.data,
      duration: Number(duration),
    }));

    // Get current version to increment
    const existing = await pool.query(
      'SELECT version FROM playlists WHERE screen_id = $1',
      [screen_id]
    );
    const newVersion = existing.rows.length ? existing.rows[0].version + 1 : 1;

    const upsert = await pool.query(
      `INSERT INTO playlists (screen_id, items, version, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (screen_id) DO UPDATE
         SET items = EXCLUDED.items,
             version = EXCLUDED.version,
             updated_at = NOW()
       RETURNING *`,
      [screen_id, JSON.stringify(items), newVersion]
    );

    const p = upsert.rows[0];
    res.json({
      screen_id: p.screen_id,
      items: p.items,
      version: p.version,
      generated_at: p.updated_at,
    });
  } catch (err) {
    console.error('POST /playlist/generate:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
