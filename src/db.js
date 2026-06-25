const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://clubhub:clubhub@localhost:5432/clubhub',

  // HIGH-1: Explicit pool sizing.
  //
  // max: 10 is safe for the current scale (5–20 screens) and leaves plenty of
  // Postgres headroom (default max_connections=100, leaving 90 for admin/migrations).
  // When you grow past ~150 screens, bump this to 25. Past ~500, bump to 50 and
  // also increase Postgres max_connections in postgresql.conf.
  //
  // idleTimeoutMillis: players poll every 15s. The pg default (10s) closes idle
  // connections between poll bursts, forcing a fresh TCP+auth handshake on every
  // active cycle. 30s keeps connections warm across at least one full poll interval.
  //
  // connectionTimeoutMillis: how long a caller waits if all connections are in use.
  // 5s was tight under a cold-start burst with many screens. 8s gives the queue
  // time to drain without holding HTTP requests open long enough to alarm operators.
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000,
});

pool.on('error', (err) => {
  console.error('Unexpected pg pool error:', err.message);
});

// Retry connection on startup (Docker race condition handling)
async function waitForDb(retries = 10, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Database connected');
      return;
    } catch (err) {
      console.log(`DB not ready, retrying in ${delay}ms... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Could not connect to database after retries');
}

module.exports = { pool, waitForDb };
