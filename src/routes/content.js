const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// POST /content
router.post('/', async (req, res) => {
  const { template_type, data, expires_at, cross_post } = req.body;

  if (!template_type || !data) {
    return res.status(400).json({ error: 'template_type and data are required' });
  }

  // Strip expires_at from data JSONB to avoid duplication — it now lives in its own column
  const cleanData = { ...data };
  delete cleanData.expires_at;

  try {
    const result = await pool.query(
      'INSERT INTO content (template_type, data, expires_at, tenant_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [template_type, JSON.stringify(cleanData), expires_at || null, req.tenantId]
    );

    // BL-038/BL-046: enqueue social cross-post jobs if requested
    if (cross_post === true) {
      const platforms = Array.isArray(req.body.platforms) ? req.body.platforms : ['facebook'];
      try {
        for (const platform of platforms) {
          await pool.query(
            'INSERT INTO social_jobs (content_id, platform, tenant_id) VALUES ($1, $2, $3)',
            [result.rows[0].id, platform, req.tenantId]
          );
        }
      } catch (jobErr) {
        // Non-fatal: content created, social job failed — log and continue
        console.error('social_jobs insert failed:', jobErr.message);
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /content:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /content (list all) — includes computed lifecycle status from schedules
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        CASE
          WHEN COUNT(s.id) = 0 THEN 'draft'
          WHEN EXISTS (
            SELECT 1 FROM schedules s2
            WHERE s2.content_id = c.id
              AND (s2.starts_at IS NULL OR s2.starts_at <= NOW())
              AND (s2.ends_at   IS NULL OR s2.ends_at   >  NOW())
          ) THEN 'active'
          WHEN (
            SELECT MIN(s3.starts_at)
            FROM schedules s3
            WHERE s3.content_id = c.id AND s3.starts_at > NOW()
          ) IS NOT NULL THEN 'scheduled'
          ELSE 'expired'
        END AS status
      FROM content c
      LEFT JOIN schedules s ON s.content_id = c.id
      WHERE c.tenant_id = $1
        AND (c.expires_at IS NULL OR c.expires_at > NOW())
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [req.tenantId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /content/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM content WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /content/:id
router.delete('/:id', async (req, res) => {
  try {
    // FIX-7: Invalidate manifest cache BEFORE deleting content.
    // ON DELETE CASCADE removes schedules after the content row is gone, so we
    // must read the schedule targeting info now, while it still exists.
    //
    // Three targeting cases:
    //   screen-level  → bust that screen's cache entry directly
    //   venue-level   → bust all screens belonging to that venue
    //   global (both NULL) → bust all screens (content was everywhere)
    await pool.query(
      `DELETE FROM manifest_cache
       WHERE screen_id IN (
         -- Screen-specific schedules
         SELECT s.screen_id
         FROM   schedules s
         WHERE  s.content_id = $1 AND s.screen_id IS NOT NULL
         UNION
         -- Venue-wide schedules: all screens in that venue
         SELECT sc.id
         FROM   schedules s
         JOIN   screens sc ON sc.venue_id = s.venue_id
         WHERE  s.content_id = $1 AND s.screen_id IS NULL AND s.venue_id IS NOT NULL
         UNION
         -- Global schedules (no venue/screen filter): all screens
         SELECT sc.id
         FROM   screens sc
         WHERE  EXISTS (
           SELECT 1 FROM schedules
           WHERE content_id = $1 AND screen_id IS NULL AND venue_id IS NULL
         )
       )`,
      [req.params.id]
    );
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'INFO', event: 'manifest.cache_bust', reason: 'content_deleted', content_id: req.params.id }));
    await pool.query('DELETE FROM content WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
