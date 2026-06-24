'use strict';

/**
 * ai.js — BL-047 + BL-049
 *
 * POST /ai/generate       — AI copy generation via Cognito bridge
 * POST /ai/generate-image — AI image generation via Cognito bridge → Bunny CDN
 */

const express = require('express');
const crypto  = require('node:crypto');
const path    = require('node:path');
const { pool } = require('../db');

const router = express.Router();

const UNSUPPORTED_TEMPLATES = new Set(['menu_board']);

// ── POST /ai/generate — text copy generation (BL-047) ───────────────────────

router.post('/generate', async (req, res) => {
  const serviceKey = process.env.COGNITO_SERVICE_KEY;
  const baseUrl    = process.env.COGNITO_GCF_BASE_URL;

  if (!serviceKey || !baseUrl) {
    return res.status(501).json({ error: 'AI generation not configured' });
  }

  const { template_type, context } = req.body || {};

  if (!template_type) {
    return res.status(400).json({ error: 'template_type is required' });
  }

  if (UNSUPPORTED_TEMPLATES.has(template_type)) {
    return res.status(400).json({ error: `AI generation not supported for ${template_type}` });
  }

  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/clubhub-bridge?endpoint=ai_generate&v=1`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': serviceKey,
      },
      body: JSON.stringify({
        venue_id: req.tenantId,
        template_slug: template_type,
        context: context || {},
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[ai] Cognito bridge error: HTTP ${response.status} — ${errBody}`);
      return res.status(502).json({ error: 'AI generation failed' });
    }

    const data = await response.json();
    res.json({ fields: data.generated || {} });
  } catch (err) {
    console.error(`[ai] Cognito bridge call failed: ${err.message}`);
    res.status(502).json({ error: 'AI generation unavailable' });
  }
});

// ── POST /ai/generate-image — AI image generation (BL-049) ──────────────────

router.post('/generate-image', async (req, res) => {
  const serviceKey       = process.env.COGNITO_SERVICE_KEY;
  const baseUrl          = process.env.COGNITO_GCF_BASE_URL;
  const bunnyApiKey      = process.env.BUNNY_API_KEY;
  const storageZone      = process.env.BUNNY_STORAGE_ZONE;
  const cdnBaseUrl       = process.env.BUNNY_CDN_BASE_URL;
  const storageHostname  = process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';

  if (!serviceKey || !baseUrl) {
    return res.status(501).json({ error: 'AI image generation not configured (COGNITO_SERVICE_KEY required)' });
  }

  if (!bunnyApiKey || !storageZone || !cdnBaseUrl) {
    return res.status(501).json({ error: 'Media storage not configured (Bunny CDN required)' });
  }

  const { prompt, template_type, aspect } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    // Step 1: Call Cognito bridge to generate the image
    const cognitoUrl = `${baseUrl.replace(/\/+$/, '')}/clubhub-bridge?endpoint=ai_image&v=1`;
    const cognitoRes = await fetch(cognitoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': serviceKey,
      },
      body: JSON.stringify({
        venue_id: req.tenantId,
        prompt: prompt.trim(),
        aspect: aspect || 'landscape',
        template_type: template_type || undefined,
      }),
      signal: AbortSignal.timeout(30_000), // image gen can be slow
    });

    if (!cognitoRes.ok) {
      const errBody = await cognitoRes.text();
      console.error(`[ai-image] Cognito bridge error: HTTP ${cognitoRes.status} — ${errBody}`);
      return res.status(502).json({ error: 'AI image generation failed' });
    }

    const cognitoData = await cognitoRes.json();
    const imageUrl = cognitoData.image_url;

    if (!imageUrl) {
      return res.status(502).json({ error: 'AI returned no image URL' });
    }

    // Step 2: Download the generated image
    const imageRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!imageRes.ok) {
      return res.status(502).json({ error: `Failed to download generated image: HTTP ${imageRes.status}` });
    }

    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    const contentType = imageRes.headers.get('content-type') || 'image/png';
    const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
      : contentType.includes('webp') ? 'webp' : 'png';

    // Step 3: Upload to Bunny CDN
    const tenantId = req.tenantId;
    const fileId = crypto.randomUUID();
    const storagePath = `tenants/${tenantId}/ai-${fileId}.${ext}`;
    const bunnyUploadUrl = `https://${storageHostname}/${storageZone}/${storagePath}`;

    const putRes = await fetch(bunnyUploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': bunnyApiKey,
        'Content-Type': contentType,
      },
      body: imageBuffer,
    });

    if (!putRes.ok) {
      return res.status(502).json({ error: `Bunny upload failed: HTTP ${putRes.status}` });
    }

    const cdn_url_raw = `${cdnBaseUrl.replace(/\/+$/, '')}/${storagePath}`;
    const cdn_url = `${cdn_url_raw}?width=1920&height=1080&mode=max&format=webp&quality=85`;

    // Step 4: Auto-catalogue in media_library
    try {
      await pool.query(
        `INSERT INTO media_library (tenant_id, filename, cdn_url, cdn_url_raw, file_size, media_type)
         VALUES ($1, $2, $3, $4, $5, 'image')`,
        [tenantId, `ai-generated-${fileId}.${ext}`, cdn_url, cdn_url_raw, imageBuffer.length]
      );
    } catch (catalogErr) {
      console.error('[ai-image] media_library insert failed:', catalogErr.message);
    }

    res.json({ cdn_url, cdn_url_raw, prompt: prompt.trim() });
  } catch (err) {
    console.error(`[ai-image] Error: ${err.message}`);
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'AI image generation timed out — try again' });
    }
    res.status(502).json({ error: 'AI image generation unavailable' });
  }
});

module.exports = router;
