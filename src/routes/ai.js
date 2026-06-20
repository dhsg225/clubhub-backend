'use strict';

/**
 * ai.js — BL-047: AI card authoring via Cognito Guru bridge
 *
 * POST /ai/generate
 *   Accepts { template_type, context }
 *   Calls Cognito bridge GCF ai_generate endpoint
 *   Returns { fields: { ...generated } }
 *
 * 501 when COGNITO_SERVICE_KEY not set.
 * 400 when template_type is 'menu_board' (structured data, not copywriting).
 */

const express = require('express');

const router = express.Router();

const UNSUPPORTED_TEMPLATES = new Set(['menu_board']);

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

module.exports = router;
