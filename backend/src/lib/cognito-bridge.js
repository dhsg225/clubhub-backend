'use strict';

/**
 * cognito-bridge.js — BL-045 / D-020
 *
 * Backend-to-backend bridge to Cognito Guru GCFs.
 * Venue operators never see Cognito — ClubHub calls it as an invisible engine.
 *
 * Graceful degradation: all functions log a warning and skip when
 * COGNITO_SERVICE_KEY is not set. No crash, no error thrown.
 */

const { pool } = require('../db');

/**
 * Auto-provision a Cognito Guru client for a ClubHub tenant.
 *
 * Calls the bridge GCF provision endpoint, stores the returned
 * cognito_client_id + cognito_project_id in cognito_mappings.
 *
 * @param {string} tenantId  — ClubHub tenant UUID
 * @param {string} venueName — display name for the Cognito client
 */
async function provisionVenue(tenantId, venueName) {
  const serviceKey = process.env.COGNITO_SERVICE_KEY;
  const baseUrl    = process.env.COGNITO_GCF_BASE_URL;

  if (!serviceKey) {
    console.warn(JSON.stringify({
      ts: new Date().toISOString(), level: 'WARN',
      event: 'cognito.provision_skipped',
      tenant_id: tenantId,
      reason: 'COGNITO_SERVICE_KEY not set',
    }));
    return null;
  }

  if (!baseUrl) {
    console.warn(JSON.stringify({
      ts: new Date().toISOString(), level: 'WARN',
      event: 'cognito.provision_skipped',
      tenant_id: tenantId,
      reason: 'COGNITO_GCF_BASE_URL not set',
    }));
    return null;
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/clubhub-bridge?endpoint=provision&v=1`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': serviceKey,
      },
      body: JSON.stringify({
        venue_id: tenantId,
        venue_name: venueName,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(JSON.stringify({
        ts: new Date().toISOString(), level: 'ERROR',
        event: 'cognito.provision_failed',
        tenant_id: tenantId,
        status: response.status,
        body,
      }));
      return null;
    }

    const data = await response.json();
    const clientId  = data.cognito_client_id || data.client_id || null;
    const projectId = data.cognito_project_id || data.project_id || null;

    if (!clientId) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(), level: 'ERROR',
        event: 'cognito.provision_no_client_id',
        tenant_id: tenantId,
        response_data: data,
      }));
      return null;
    }

    // Store mapping
    await pool.query(
      `INSERT INTO cognito_mappings (clubhub_tenant_id, cognito_client_id, cognito_project_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (clubhub_tenant_id) DO UPDATE
         SET cognito_client_id  = EXCLUDED.cognito_client_id,
             cognito_project_id = EXCLUDED.cognito_project_id`,
      [tenantId, clientId, projectId]
    );

    console.log(JSON.stringify({
      ts: new Date().toISOString(), level: 'INFO',
      event: 'cognito.provision_success',
      tenant_id: tenantId,
      cognito_client_id: clientId,
      cognito_project_id: projectId,
    }));

    return { clientId, projectId };
  } catch (err) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(), level: 'ERROR',
      event: 'cognito.provision_error',
      tenant_id: tenantId,
      error: err.message,
    }));
    return null;
  }
}

/**
 * Look up the Cognito client ID for a ClubHub tenant.
 * Returns null if not mapped.
 */
async function getCognitoClientId(tenantId) {
  const { rows } = await pool.query(
    'SELECT cognito_client_id FROM cognito_mappings WHERE clubhub_tenant_id = $1',
    [tenantId]
  );
  return rows.length ? rows[0].cognito_client_id : null;
}

module.exports = { provisionVenue, getCognitoClientId };
