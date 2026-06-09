/**
 * PostgreSQL pool for shadow-service.
 */
import { Pool } from 'pg';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL is required');
    _pool = new Pool({ connectionString: url, max: 5 });
    _pool.on('error', (err) => {
      console.error('[shadow-service:db] Pool error:', err.message);
    });
  }
  return _pool;
}

export async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS parity_records (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      canary_run_id     TEXT        NOT NULL,
      screen_id         TEXT        NOT NULL,
      venue_id          TEXT        NOT NULL,
      divergence_class  INTEGER     NOT NULL,
      rollback_required BOOLEAN     NOT NULL,
      pre_output_hash   TEXT        NOT NULL,
      legacy_output_hash TEXT       NOT NULL,
      inserted_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_parity_records_canary_run
      ON parity_records (canary_run_id)
  `);
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
