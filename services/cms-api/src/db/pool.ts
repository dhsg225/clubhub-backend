/**
 * PostgreSQL connection pool.
 *
 * Uses pg (node-postgres) with a typed pool factory.
 * All database access goes through this pool — never raw connections.
 */
import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

let _pool: Pool | null = null;

export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly max: number;       // max pool size
  readonly idleTimeoutMs: number;
  readonly connectionTimeoutMs: number;
}

export function createPool(config: DatabaseConfig): Pool {
  const pgConfig: PoolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.max,
    idleTimeoutMillis: config.idleTimeoutMs,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    // Constitutional: never allow session_replication_role bypass
    // All connections use DEFAULT role (enforced in db-init.sh via REVOKE)
  };

  const pool = new Pool(pgConfig);

  pool.on('error', (err) => {
    console.error('[db-pool] Unexpected pool error:', err.message);
  });

  return pool;
}

/** Initialize the global pool from environment variables. */
export function initPool(): Pool {
  if (_pool !== null) return _pool;

  const config: DatabaseConfig = {
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
    database: process.env['DB_NAME'] ?? 'clubhub',
    user: process.env['DB_USER'] ?? 'clubhub_app',
    password: process.env['DB_PASSWORD'] ?? '',
    max: parseInt(process.env['DB_POOL_MAX'] ?? '10', 10),
    idleTimeoutMs: 30_000,
    connectionTimeoutMs: 5_000,
  };

  _pool = createPool(config);
  return _pool;
}

/** Get the initialized pool. Throws if not initialized. */
export function getPool(): Pool {
  if (_pool === null) {
    throw new Error('[db-pool] Pool not initialized — call initPool() first');
  }
  return _pool;
}

/** Execute a typed query. Returns rows. */
export async function query<T extends QueryResultRow>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const pool = getPool();
  const result: QueryResult<T> = await pool.query<T>(sql, params);
  return result.rows;
}

/** Execute a query within a transaction. Rolls back on error. */
export async function withTransaction<T>(
  fn: (query: <R extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txQuery = async <R extends QueryResultRow>(sql: string, params?: unknown[]): Promise<R[]> => {
      const result: QueryResult<R> = await client.query<R>(sql, params);
      return result.rows;
    };
    const result = await fn(txQuery);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Close the pool gracefully. */
export async function closePool(): Promise<void> {
  if (_pool !== null) {
    await _pool.end();
    _pool = null;
  }
}
