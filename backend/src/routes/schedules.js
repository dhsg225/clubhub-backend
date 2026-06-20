'use strict';

const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// POST /schedules
router.post('/', async (req, res) => {
  const {
    content_id      = null,
    playlist_id     = null,
    venue_id        = null,
    screen_id       = null,
    screen_group    = null,
    priority        = 10,
    starts_at       = null,
    ends_at         = null,
    days_of_week    = null,
    time_of_day_start = null,
    time_of_day_end   = null,
    duration        = 10,
    is_fallback     = false,
    zone_name       = 'main',
  } = req.body;

  if (!content_id && !playlist_id) {
    return res.status(400).json({ error: 'content_id or playlist_id required' });
  }
  if (content_id && playlist_id) {
    return res.status(400).json({ error: 'provide content_id or playlist_id, not both' });
  }
  if (!venue_id && !screen_id) {
    return res.status(400).json({ error: 'venue_id or screen_id required' });
  }
  if (screen_id && screen_id.length > 100) {
    return res.status(400).json({ error: 'screen_id must be 100 characters or fewer' });
  }
  if (starts_at && ends_at && new Date(ends_at) <= new Date(starts_at)) {
    return res.status(400).json({ error: 'ends_at must be after starts_at' });
  }
  if (days_of_week && (!time_of_day_start || !time_of_day_end)) {
    return res.status(400).json({ error: 'days_of_week requires time_of_day_start and time_of_day_end' });
  }
  // FIX-5: minimum duration guard — a 0s or near-0s duration causes the player to
  // spin in a tight setTimeout loop, locking up Chromium/Electron on the Pi.
  if (Number(duration) < 3) {
    return res.status(400).json({ error: 'duration must be at least 3 seconds' });
  }
  // Validate days_of_week values are in range [0-6] (0=Sun … 6=Sat).
  // The engine filters bad values defensively, but bad data in the DB is still bad data.
  if (Array.isArray(days_of_week) && days_of_week.length > 0) {
    if (!days_of_week.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return res.status(400).json({ error: 'days_of_week values must be integers 0–6 (0=Sun, 6=Sat)' });
    }
  }
  if (!zone_name || typeof zone_name !== 'string' || zone_name.trim().length === 0) {
    return res.status(400).json({ error: 'zone_name must be a non-empty string' });
  }
  if (zone_name.length > 40) {
    return res.status(400).json({ error: 'zone_name must be 40 characters or fewer' });
  }

  try {
    const r = await pool.query(
      `INSERT INTO schedules
         (content_id, playlist_id, venue_id, screen_id, screen_group, priority,
          starts_at, ends_at, days_of_week, time_of_day_start, time_of_day_end,
          duration, is_fallback, zone_name, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        content_id || null, playlist_id || null,
        venue_id, screen_id, screen_group, priority,
        starts_at, ends_at, days_of_week, time_of_day_start, time_of_day_end,
        duration, is_fallback, zone_name, req.tenantId,
      ]
    );

    // Bust manifest cache for affected screen(s) so next poll gets fresh data
    if (screen_id) {
      await pool.query('DELETE FROM manifest_cache WHERE screen_id = $1', [screen_id]);
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'INFO', event: 'manifest.cache_bust', reason: 'schedule_created', screen_id }));
    } else if (venue_id) {
      await pool.query(
        'DELETE FROM manifest_cache WHERE screen_id IN (SELECT id FROM screens WHERE venue_id = $1)',
        [venue_id]
      );
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'INFO', event: 'manifest.cache_bust', reason: 'schedule_created', venue_id }));
    }

    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('POST /schedules:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /schedules?content_id=&screen_id=&venue_id=
router.get('/', async (req, res) => {
  const { content_id, screen_id, venue_id } = req.query;
  const conds = [];
  const vals  = [];

  if (content_id) { conds.push(`s.content_id = $${vals.length + 1}`); vals.push(content_id); }
  if (screen_id)  { conds.push(`s.screen_id  = $${vals.length + 1}`); vals.push(screen_id);  }
  if (venue_id)   { conds.push(`s.venue_id   = $${vals.length + 1}`); vals.push(venue_id);   }

  conds.push(`s.tenant_id = $${vals.length + 1}`); vals.push(req.tenantId);
  const where = `WHERE ${conds.join(' AND ')}`;

  try {
    const r = await pool.query(
      `SELECT s.*, np.name AS playlist_name
       FROM schedules s
       LEFT JOIN named_playlists np ON np.id = s.playlist_id
       ${where}
       ORDER BY s.priority DESC, s.created_at ASC`,
      vals
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /schedules/:id
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM schedules WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /schedules/:id
router.delete('/:id', async (req, res) => {
  try {
    // Get schedule before deleting so we can bust the right cache entries
    const sched = await pool.query('SELECT * FROM schedules WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);

    await pool.query('DELETE FROM schedules WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);

    if (sched.rows.length) {
      const s = sched.rows[0];
      if (s.screen_id) {
        await pool.query('DELETE FROM manifest_cache WHERE screen_id = $1', [s.screen_id]);
        console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'INFO', event: 'manifest.cache_bust', reason: 'schedule_deleted', screen_id: s.screen_id }));
      } else if (s.venue_id) {
        await pool.query(
          'DELETE FROM manifest_cache WHERE screen_id IN (SELECT id FROM screens WHERE venue_id = $1)',
          [s.venue_id]
        );
        console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'INFO', event: 'manifest.cache_bust', reason: 'schedule_deleted', venue_id: s.venue_id }));
      }
    }

    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
