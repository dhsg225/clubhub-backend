'use strict';

/**
 * media.js — BL-041 + BL-050
 *
 * POST /media/upload-token — generate Bunny upload URL, auto-catalogue in media_library
 * GET  /media/library      — browse previously uploaded media for reuse
 */

const express = require('express');
const crypto  = require('node:crypto');
const path    = require('node:path');
const { pool } = require('../db');

const router = express.Router();

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4']);

// POST /media/upload-token
router.post('/upload-token', async (req, res) => {
  const apiKey          = process.env.BUNNY_API_KEY;
  const storageZone     = process.env.BUNNY_STORAGE_ZONE;
  const cdnBaseUrl      = process.env.BUNNY_CDN_BASE_URL;
  const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';

  // Graceful degradation when Bunny is not configured
  if (!apiKey || !storageZone || !cdnBaseUrl) {
    return res.status(501).json({ error: 'Media storage not configured' });
  }

  const { filename, file_size } = req.body || {};
  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: 'filename is required' });
  }

  const ext = path.extname(filename).slice(1).toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return res.status(400).json({
      error: `Invalid file extension. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
    });
  }

  const tenantId = req.tenantId;
  const fileId   = crypto.randomUUID();
  const storagePath = `tenants/${tenantId}/${fileId}.${ext}`;

  const upload_url = `https://${storageHostname}/${storageZone}/${storagePath}`;

  // Raw CDN URL (for upload reference)
  const cdn_url_raw = `${cdnBaseUrl.replace(/\/+$/, '')}/${storagePath}`;

  // Optimized CDN URL for Pi playback — Bunny Optimizer downscales + converts to WebP
  const isVideo = ext === 'mp4';
  const cdn_url = isVideo
    ? cdn_url_raw
    : `${cdn_url_raw}?width=1920&height=1080&mode=max&format=webp&quality=85`;

  // BL-050: auto-catalogue in media_library
  try {
    await pool.query(
      `INSERT INTO media_library (tenant_id, filename, cdn_url, cdn_url_raw, file_size, media_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, filename, cdn_url, cdn_url_raw, file_size || null, isVideo ? 'video' : 'image']
    );
  } catch (catalogErr) {
    // Non-fatal — upload token still works even if catalogue fails
    console.error('media_library insert failed:', catalogErr.message);
  }

  res.json({
    upload_url,
    auth_header: { AccessKey: apiKey },
    cdn_url,
    cdn_url_raw,
    cdn_base_url: cdnBaseUrl,
  });
});

// GET /media/library — browse uploaded media for reuse
router.get('/library', async (req, res) => {
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  try {
    const r = await pool.query(
      `SELECT id, filename, cdn_url, cdn_url_raw, file_size, media_type, created_at
       FROM media_library
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.tenantId, limit, offset]
    );
    const countR = await pool.query(
      'SELECT COUNT(*)::int AS total FROM media_library WHERE tenant_id = $1',
      [req.tenantId]
    );
    res.json({
      items: r.rows,
      total: countR.rows[0]?.total ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
