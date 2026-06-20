'use strict';

const express    = require('express');
const crypto     = require('node:crypto');
const { pool }   = require('../db');
const screenAuth = require('../middleware/screenAuth');
const { emit, EVENTS } = require('../lib/events');

const router = express.Router();

// GET /screens?venue_id=
router.get('/', async (req, res) => {
  const { venue_id } = req.query;
  try {
    const r = venue_id
      ? await pool.query(
          'SELECT * FROM screens WHERE venue_id = $1 ORDER BY created_at ASC',
          [venue_id]
        )
      : await pool.query('SELECT * FROM screens ORDER BY venue_id, created_at ASC');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /screens/:id
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM screens WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /screens
router.post('/', async (req, res) => {
  const { id, venue_id, name, screen_group } = req.body;
  if (!id || !venue_id) return res.status(400).json({ error: 'id and venue_id required' });
  if (id.length > 100) return res.status(400).json({ error: 'Screen id must be 100 characters or fewer' });
  try {
    const r = await pool.query(
      'INSERT INTO screens (id, venue_id, name, screen_group) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, venue_id, name ?? null, screen_group ?? null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Screen id already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /screens/:id/heartbeat — called by player on each poll
router.patch('/:id/heartbeat', async (req, res) => {
  try {
    const {
      assets_required_count,
      assets_verified_count,
      content_readiness_state,
      last_corpus_sync_at,
    } = req.body || {};
    await pool.query(
      `UPDATE screens
       SET last_seen_at             = NOW(),
           assets_required_count   = COALESCE($2, assets_required_count),
           assets_verified_count   = COALESCE($3, assets_verified_count),
           content_readiness_state = COALESCE($4, content_readiness_state),
           last_corpus_sync_at     = COALESCE($5, last_corpus_sync_at)
       WHERE id = $1`,
      [
        req.params.id,
        assets_required_count ?? null,
        assets_verified_count ?? null,
        content_readiness_state ?? null,
        last_corpus_sync_at ?? null,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /screens/:id — update screen settings (layout_template, etc.)
router.patch('/:id', async (req, res) => {
  const ALLOWED_LAYOUTS = ['fullscreen', 'split_horizontal', 'news_bar', 'quad'];
  const { layout_template } = req.body;

  if (!layout_template) {
    return res.status(400).json({ error: 'layout_template required' });
  }
  if (!ALLOWED_LAYOUTS.includes(layout_template)) {
    return res.status(400).json({ error: `layout_template must be one of: ${ALLOWED_LAYOUTS.join(', ')}` });
  }

  try {
    const r = await pool.query(
      'UPDATE screens SET layout_template = $1 WHERE id = $2 RETURNING *',
      [layout_template, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /screens/enroll — first-boot enrollment (SECURITY_MODEL.md §2.1)
router.post('/enroll', async (req, res) => {
  const { screen_id, enrollment_token } = req.body || {};
  if (!screen_id || !enrollment_token) {
    return res.status(400).json({ error: 'screen_id and enrollment_token are required' });
  }

  try {
    if (screenAuth.ENFORCE) {
      function _hashToken(t) {
        return crypto.createHash('sha256').update(t).digest('hex').slice(0, 64);
      }

      const tokenHash = _hashToken(enrollment_token);
      const r = await pool.query(
        `SELECT et.id, et.screen_id, et.status, et.expires_at,
                s.failed_enrollments, s.enrollment_locked_until
         FROM enrollment_tokens et
         JOIN screens s ON s.id = et.screen_id
         WHERE et.token_hash = $1 AND et.screen_id = $2`,
        [tokenHash, screen_id]
      );

      if (!r.rows.length) {
        emit(EVENTS.SECURITY.ENROLLMENT_REJECTED, req, { screen_id, reason: 'token_not_found' });
        // Increment failed attempts and lock if threshold exceeded
        await pool.query(
          `UPDATE screens SET failed_enrollments = COALESCE(failed_enrollments, 0) + 1,
           enrollment_locked_until = CASE
             WHEN COALESCE(failed_enrollments, 0) + 1 >= $1
             THEN NOW() + INTERVAL '1 hour'
             ELSE enrollment_locked_until
           END
           WHERE id = $2`,
          [screenAuth._security.max_failed_enrollments, screen_id]
        );
        return res.status(401).json({ error: 'Invalid enrollment token' });
      }

      const row = r.rows[0];

      if (row.enrollment_locked_until && new Date(row.enrollment_locked_until) > new Date()) {
        emit(EVENTS.SECURITY.ENROLLMENT_REJECTED, req, { screen_id, reason: 'enrollment_locked' });
        return res.status(429).json({ error: 'Enrollment locked. Try again later.' });
      }

      if (row.status !== 'PENDING') {
        emit(EVENTS.SECURITY.ENROLLMENT_REJECTED, req, { screen_id, reason: `token_status:${row.status}` });
        return res.status(401).json({ error: 'Enrollment token already used or revoked' });
      }

      if (new Date(row.expires_at) < new Date()) {
        emit(EVENTS.SECURITY.ENROLLMENT_REJECTED, req, { screen_id, reason: 'token_expired' });
        return res.status(401).json({ error: 'Enrollment token expired' });
      }

      // Mark OET as used
      await pool.query(
        `UPDATE enrollment_tokens SET status = 'USED', used_at = NOW() WHERE id = $1`,
        [row.id]
      );
      // Reset failed enrollment counter
      await pool.query(
        `UPDATE screens SET failed_enrollments = 0, enrollment_locked_until = NULL WHERE id = $1`,
        [screen_id]
      );
    }

    const token = await screenAuth.issueSessionToken(screen_id);

    emit(EVENTS.SCREEN.REGISTERED, req, {
      screen_id,
      firmware_version: req.body?.firmware_version ?? 'unknown',
    });

    res.json({
      ok: true,
      screen_id,
      token,
      expires_in_ms: screenAuth._security.session_token_expiry_ms,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
