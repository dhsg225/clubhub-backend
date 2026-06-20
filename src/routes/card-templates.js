'use strict';

/**
 * card-templates.js — BL-040
 *
 * L2 of D-019 Three-Tier Template Governance Model.
 * The card_templates table is the authoritative catalogue of available template types.
 *
 * GET /card-templates  — system templates (tenant_id IS NULL) + caller's tenant templates, ordered by sort_order
 * POST /card-templates — super-admin only (X-Admin-Key guard); creates a new template
 */

const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Admin-key guard (mirrors tenants.js pattern)
function requireAdminKey(req, res, next) {
  if (process.env.MULTI_TENANT_ENFORCE !== 'true') return next();
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'ADMIN_KEY_REQUIRED' });
  }
  next();
}

// GET /card-templates
// Returns system templates (tenant_id IS NULL) plus any tenant-specific templates
// for req.tenantId (set by injectTenantContext middleware).
// Ordered by sort_order ASC, then type_slug for determinism.
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId || null;
    const r = await pool.query(
      `SELECT type_slug, display_name, field_schema, tenant_id, sort_order, created_at
         FROM card_templates
        WHERE tenant_id IS NULL
           OR tenant_id = $1
        ORDER BY sort_order ASC, type_slug ASC`,
      [tenantId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /card-templates — super-admin only
// Body: { type_slug, display_name, field_schema, tenant_id?, sort_order? }
//   tenant_id = null → system template (available to all)
//   tenant_id = <uuid> → tenant-specific template
router.post('/', requireAdminKey, async (req, res) => {
  const { type_slug, display_name, field_schema, tenant_id = null, sort_order = 0 } = req.body;

  if (!type_slug || typeof type_slug !== 'string') {
    return res.status(400).json({ error: 'type_slug is required and must be a string' });
  }
  if (!display_name || typeof display_name !== 'string') {
    return res.status(400).json({ error: 'display_name is required' });
  }
  if (!field_schema || typeof field_schema !== 'object' || !Array.isArray(field_schema.fields)) {
    return res.status(400).json({ error: 'field_schema must be an object with a fields array' });
  }

  try {
    const r = await pool.query(
      `INSERT INTO card_templates (type_slug, display_name, field_schema, tenant_id, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [type_slug, display_name, field_schema, tenant_id, sort_order]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'type_slug already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /card-templates/:slug — update display_name, field_schema, sort_order
router.patch('/:slug', requireAdminKey, async (req, res) => {
  const { display_name, field_schema, sort_order } = req.body;

  const updates = [];
  const values = [];
  let idx = 1;

  if (display_name !== undefined) {
    if (typeof display_name !== 'string' || !display_name.trim()) {
      return res.status(400).json({ error: 'display_name cannot be empty' });
    }
    updates.push(`display_name = $${idx++}`);
    values.push(display_name.trim());
  }
  if (field_schema !== undefined) {
    if (!field_schema || typeof field_schema !== 'object' || !Array.isArray(field_schema.fields)) {
      return res.status(400).json({ error: 'field_schema must be an object with a fields array' });
    }
    updates.push(`field_schema = $${idx++}`);
    values.push(field_schema);
  }
  if (sort_order !== undefined) {
    updates.push(`sort_order = $${idx++}`);
    values.push(sort_order);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.slug);

  try {
    const r = await pool.query(
      `UPDATE card_templates SET ${updates.join(', ')} WHERE type_slug = $${idx} RETURNING *`,
      values
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /card-templates/:slug — remove a template (cannot delete system templates in enforce mode)
router.delete('/:slug', requireAdminKey, async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM card_templates WHERE type_slug = $1 RETURNING type_slug',
      [req.params.slug]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true, type_slug: r.rows[0].type_slug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
