'use strict';

const { pool } = require('../db');

let _defaultTenantId = null;

/**
 * Load the default tenant UUID from the DB on startup.
 * Called once before routes mount.
 */
async function loadDefaultTenantId() {
  const { rows } = await pool.query(
    "SELECT id FROM tenants WHERE slug = 'default' LIMIT 1"
  );
  if (!rows.length) {
    throw new Error('Default tenant not found — run migrate_013.sql');
  }
  _defaultTenantId = rows[0].id;
  process.env.DEFAULT_TENANT_ID = _defaultTenantId;
  return _defaultTenantId;
}

/**
 * Express middleware: sets req.tenantId on every request.
 *
 * When MULTI_TENANT_ENFORCE=true:
 *   Reads tenant_id from req.user.tenant_id (JWT claim).
 *   Rejects with 403 if absent.
 *
 * When MULTI_TENANT_ENFORCE=false (default):
 *   Uses the cached default tenant UUID.
 */
function injectTenantContext(req, res, next) {
  const enforce = process.env.MULTI_TENANT_ENFORCE === 'true';

  if (enforce) {
    const tenantId = req.user && req.user.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ error: 'TENANT_CONTEXT_MISSING' });
    }
    req.tenantId = tenantId;
  } else {
    req.tenantId = _defaultTenantId;
  }

  next();
}

module.exports = { loadDefaultTenantId, injectTenantContext };
