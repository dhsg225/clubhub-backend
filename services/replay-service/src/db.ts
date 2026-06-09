/**
 * PostgreSQL pool for replay-service.
 * Uses DATABASE_URL — single connection string, no parsed config.
 */
import { Pool } from 'pg';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const url = process.env['DATABASE_URL'];
    if (!url) throw new Error('DATABASE_URL is required');
    _pool = new Pool({ connectionString: url, max: 5 });
    _pool.on('error', (err) => {
      console.error('[replay-service:db] Pool error:', err.message);
    });
  }
  return _pool;
}

export async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS replay_audit_records (
      audit_record_id  TEXT        PRIMARY KEY,
      created_at       BIGINT      NOT NULL,
      screen_id        TEXT        NOT NULL,
      venue_id         TEXT        NOT NULL,
      at               BIGINT      NOT NULL,
      correlation_id   TEXT        NOT NULL,
      playlist_checksum TEXT       NOT NULL,
      resolution_level  INTEGER    NOT NULL,
      is_fallback      BOOLEAN     NOT NULL,
      invariants_passed BOOLEAN    NOT NULL,
      record_checksum  TEXT        NOT NULL,
      inserted_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // Prevent DELETE and UPDATE at the DB layer (append-only enforcement)
  await pool.query(`
    CREATE OR REPLACE RULE no_delete_replay_audit AS
      ON DELETE TO replay_audit_records DO INSTEAD NOTHING
  `);
  await pool.query(`
    CREATE OR REPLACE RULE no_update_replay_audit AS
      ON UPDATE TO replay_audit_records DO INSTEAD NOTHING
  `);
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
