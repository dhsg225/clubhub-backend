'use strict';

/**
 * Sponsor ingest routes — BL-037
 *
 * POST /sponsor/ticker  — submit a ticker text item (→ ticker_items table)
 * POST /sponsor/card    — submit a sponsor banner (→ content table as sponsor_banner)
 *
 * Both endpoints require tenant context (injectTenantContext middleware applied at mount).
 */

const express  = require('express');
const { pool } = require('../db');

const router = express.Router();

// POST /sponsor/ticker
router.post('/ticker', async (req, res) => {
  const { text, screen_id } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.length > 280) {
    return res.status(400).json({ error: 'text must be 280 characters or fewer' });
  }
  if (!screen_id) {
    return res.status(400).json({ error: 'screen_id is required' });
  }

  try {
    const r = await pool.query(
      `INSERT INTO ticker_items (screen_id, text, display_order, active, tenant_id)
       VALUES ($1, $2, 0, true, $3) RETURNING *`,
      [screen_id, text.trim(), req.tenantId]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'screen not found' });
    res.status(500).json({ error: err.message });
  }
});

// POST /sponsor/card
router.post('/card', async (req, res) => {
  const { sponsor_name, tagline, tier } = req.body || {};

  if (!sponsor_name || typeof sponsor_name !== 'string' || !sponsor_name.trim()) {
    return res.status(400).json({ error: 'sponsor_name is required' });
  }
  if (sponsor_name.length > 40) {
    return res.status(400).json({ error: 'sponsor_name must be 40 characters or fewer' });
  }
  if (tagline && tagline.length > 80) {
    return res.status(400).json({ error: 'tagline must be 80 characters or fewer' });
  }

  const VALID_TIERS = ['Platinum', 'Gold', 'Silver'];
  const resolvedTier = VALID_TIERS.includes(tier) ? tier : 'Gold';

  try {
    const data = {
      sponsor_name: sponsor_name.trim(),
      tagline: tagline ? tagline.trim() : '',
      tier: resolvedTier,
    };
    const r = await pool.query(
      `INSERT INTO content (template_type, data, tenant_id)
       VALUES ('sponsor_banner', $1, $2) RETURNING *`,
      [JSON.stringify(data), req.tenantId]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
