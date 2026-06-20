'use strict';

const { pool } = require('../db');
const log = require('./logger');

/**
 * startSocialWorker — polls social_jobs every 30 s, logs what it would post,
 * and marks jobs as sent. Returns a handle with a stop() method.
 */
function startSocialWorker() {
  const POLL_INTERVAL_MS = 30_000;

  const handle = setInterval(async () => {
    try {
      const result = await pool.query(
        "SELECT * FROM social_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10"
      );
      for (const job of result.rows) {
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

module.exports = { startSocialWorker };
