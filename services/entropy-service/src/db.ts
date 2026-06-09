import { Pool } from 'pg';

let _pool: Pool | null = null;

export function initPool(): Pool {
  if (_pool !== null) return _pool;
  _pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  _pool.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[entropy-service:db-pool] error:', err.message);
  });
  return _pool;
}

export function getPool(): Pool {
  if (_pool === null) throw new Error('[entropy-service] Pool not initialized — call initPool() first');
  return _pool;
}

export async function closePool(): Promise<void> {
  if (_pool !== null) {
    await _pool.end();
    _pool = null;
  }
}
