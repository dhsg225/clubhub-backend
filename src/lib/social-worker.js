'use strict';

const { pool } = require('../db');
const log = require('./logger');
const { getCognitoClientId } = require('./cognito-bridge');

/**
 * startSocialWorker — polls social_jobs every 30 s.
 *
 * BL-046: When COGNITO_SERVICE_KEY is set, calls the Cognito Guru social_schedule
 * bridge GCF. When not set, preserves original stub behaviour (log only, mark sent).
 *
 * Returns a handle with a stop() method.
 */
function startSocialWorker() {
  const POLL_INTERVAL_MS = 30_000;

  const handle = setInterval(async () => {
    try {
      // Fetch pending jobs with their content data for the social post text
      const result = await pool.query(
        `SELECT sj.*, c.template_type, c.data AS content_data
         FROM social_jobs sj
         LEFT JOIN content c ON c.id = sj.content_id
         WHERE sj.status = 'pending'
         ORDER BY sj.created_at ASC
         LIMIT 10`
      );

      for (const job of result.rows) {
        await processJob(job);
      }
    } catch (err) {
      log.error('social.worker_error', { error: err.message });
    }
  }, POLL_INTERVAL_MS);

  return {
    stop() {
      clearInterval(handle);
    },
  };
}

/**
 * Process a single social_jobs row.
 */
async function processJob(job) {
  const serviceKey = process.env.COGNITO_SERVICE_KEY;
  const baseUrl    = process.env.COGNITO_GCF_BASE_URL;

  // When COGNITO_SERVICE_KEY not set: preserve stub behaviour (log + mark sent)
  if (!serviceKey || !baseUrl) {
    log.info('social.would_post', {
      job_id: job.id,
      platform: job.platform,
      content_id: job.content_id,
      tenant_id: job.tenant_id,
    });
    await pool.query(
      "UPDATE social_jobs SET status = 'sent', sent_at = NOW() WHERE id = $1",
      [job.id]
    );
    return;
  }

  // Check if tenant is mapped to a Cognito client
  const clientId = await getCognitoClientId(job.tenant_id);
  if (!clientId) {
    log.warn('social.no_cognito_mapping', {
      job_id: job.id,
      tenant_id: job.tenant_id,
      action: 'leaving_pending',
    });
    return; // Leave pending — venue not yet provisioned in Cognito
  }

  // Derive text + media_url from the content data JSONB
  const contentData = job.content_data || {};
  const text = derivePostText(contentData, job.template_type);
  const mediaUrl = contentData.media_url || null;

  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/clubhub-bridge?endpoint=social_schedule&v=1`;
    const body = {
      venue_id: job.tenant_id,
      platforms: [job.platform],
      content: {
        text,
        ...(mediaUrl ? { media_url: mediaUrl } : {}),
      },
      schedule_at: 'now',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': serviceKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const data = await res.json();
      const cognitoPostId = data.job_id || null;

      await pool.query(
        "UPDATE social_jobs SET status = 'sent', sent_at = NOW(), cognito_post_id = $2 WHERE id = $1",
        [job.id, cognitoPostId]
      );

      log.info('social.published', {
        job_id: job.id,
        platform: job.platform,
        content_id: job.content_id,
        cognito_post_id: cognitoPostId,
      });
    } else {
      const errBody = await res.text().catch(() => '');
      await pool.query(
        "UPDATE social_jobs SET status = 'failed' WHERE id = $1",
        [job.id]
      );

      log.error('social.publish_failed', {
        job_id: job.id,
        platform: job.platform,
        status: res.status,
        error: errBody,
      });
    }
  } catch (err) {
    await pool.query(
      "UPDATE social_jobs SET status = 'failed' WHERE id = $1",
      [job.id]
    );

    log.error('social.publish_error', {
      job_id: job.id,
      platform: job.platform,
      error: err.message,
    });
  }
}

/**
 * Derive a social post text from card data JSONB.
 */
function derivePostText(data, templateType) {
  const title = data.title || data.event_name || data.sponsor_name || data.headline || '';
  const sub   = data.subtitle || data.description || data.tagline || '';
  if (title && sub) return `${title} — ${sub}`;
  return title || sub || `New ${(templateType || 'content').replace(/_/g, ' ')}`;
}

module.exports = { startSocialWorker };
