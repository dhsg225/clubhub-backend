'use strict';

/**
 * media.js — BL-041: signed Bunny upload token endpoint
 *
 * POST /media/upload-token
 *   Validates tenant context, generates a scoped upload URL for direct browser→Bunny PUT.
 *   No file bytes touch Node.js — the client PUTs directly to Bunny CDN.
 *
 * Returns: { upload_url, auth_header, cdn_url }
 *   upload_url  — Bunny Storage API PUT target (tenant-scoped path)
 *   auth_header — { AccessKey } for the PUT request
 *   cdn_url     — public CDN URL for the uploaded file (store in content data JSONB)
 */

const express = require('express');
const crypto  = require('node:crypto');
const path    = require('node:path');

const router = express.Router();

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4']);

// POST /media/upload-token
router.post('/upload-token', (req, res) => {
  const apiKey          = process.env.BUNNY_API_KEY;
  const storageZone     = process.env.BUNNY_STORAGE_ZONE;
  const cdnBaseUrl      = process.env.BUNNY_CDN_BASE_URL;
  const storageHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';

  // Graceful degradation when Bunny is not configured
  if (!apiKey || !storageZone || !cdnBaseUrl) {
    return res.status(501).json({ error: 'Media storage not configured' });
  }

  const { filename } = req.body || {};
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
  // This neutralises H-CHR-01 (GPU memory crash on oversized images)
  const isVideo = ext === 'mp4';
  const cdn_url = isVideo
    ? cdn_url_raw  // Video: no optimizer transform
    : `${cdn_url_raw}?width=1920&height=1080&mode=max&format=webp&quality=85`;

  res.json({
    upload_url,
    auth_header: { AccessKey: apiKey },
    cdn_url,
    cdn_url_raw,
    cdn_base_url: cdnBaseUrl,
  });
});

module.exports = router;
