import { Pool } from 'pg';

let _pool: Pool | null = null;

export function initPool(): Pool {
  if (_pool !== null) return _pool;
  _pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  _pool.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[audit-service:db-pool] error:', err.message);
  });
  return _pool;
}

export function getPool(): Pool {
  if (_pool === null) throw new Error('[audit-service] Pool not initialized — call initPool() first');
  return _pool;
}

export async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_events (
      event_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type   TEXT        NOT NULL,
      payload      JSONB       NOT NULL DEFAULT '{}',
      screen_id    TEXT,
      venue_id     TEXT,
      recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_events_type_time
      ON audit_events (event_type, recorded_at DESC)
  `);
}

export async function closePool(): Promise<void> {
  if (_pool !== null) {
    await _pool.end();
    _pool = null;
  }
}
