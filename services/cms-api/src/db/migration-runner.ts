/**
 * Migration runner — executes SQL migration files in order against PostgreSQL.
 *
 * Constitutional requirements:
 * - V1 must contain PARTITION BY RANGE (verified before execution)
 * - No DROP TABLE on constitutional tables
 * - Migration order enforced by version number
 * - Each migration is wrapped in a transaction
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { Pool } from 'pg';

export interface MigrationFile {
  readonly version: number;
  readonly filename: string;
  readonly path: string;
  readonly checksum: string;
}

export interface MigrationResult {
  readonly version: number;
  readonly filename: string;
  readonly status: 'applied' | 'skipped' | 'failed';
  readonly error?: string;
}

const CONSTITUTIONAL_TABLES = [
  'replay_audit_records',
  'corpus_versions',
  'constitutional_freeze_log',
];

/** Load and sort migration files from a directory. */
export function loadMigrations(migrationsDir: string): MigrationFile[] {
  const files = fs.readdirSync(migrationsDir)
    .filter((f: string) => f.match(/^V\d+__.+\.sql$/))
    .sort((a: string, b: string) => {
      const va = parseInt(a.split('__')[0]!.slice(1), 10);
      const vb = parseInt(b.split('__')[0]!.slice(1), 10);
      return va - vb;
    });

  return files.map((filename: string) => {
    const filePath = path.join(migrationsDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const checksum = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    const version = parseInt(filename.split('__')[0]!.slice(1), 10);
    return { version, filename, path: filePath, checksum };
  });
}

/** Lint migration files for constitutional requirements. */
export function lintMigrations(migrations: MigrationFile[]): string[] {
  const errors: string[] = [];

  const v1 = migrations.find(m => m.version === 1);
  if (!v1) {
    errors.push('No V1 migration found — V1 is required');
  } else {
    const content = fs.readFileSync(v1.path, 'utf-8').toUpperCase();
    if (!content.includes('PARTITION BY RANGE')) {
      errors.push('V1 must create replay_audit_records with PARTITION BY RANGE');
    }
    if (!content.includes('ENFORCE_APPEND_ONLY')) {
      errors.push('V1 must define enforce_append_only() trigger function');
    }
  }

  for (const m of migrations) {
    const content = fs.readFileSync(m.path, 'utf-8');
    for (const table of CONSTITUTIONAL_TABLES) {
      const dropPattern = new RegExp(`DROP\\s+TABLE.*${table}`, 'i');
      if (dropPattern.test(content)) {
        errors.push(`${m.filename}: DROP TABLE on constitutional table ${table} is forbidden`);
      }
    }
  }

  return errors;
}

/** Apply pending migrations to the database. */
export async function runMigrations(
  pool: Pool,
  migrationsDir: string,
): Promise<MigrationResult[]> {
  const migrations = loadMigrations(migrationsDir);
  const errors = lintMigrations(migrations);
  if (errors.length > 0) {
    throw new Error(`Migration lint failed:\n${errors.join('\n')}`);
  }

  // Ensure schema_migrations table exists (it's created in V1, but we need to check)
  // Use a separate check before running V1
  const client = await pool.connect();
  try {
    // Check if schema_migrations exists
    const tableCheck = await client.query<{ exists: boolean }>(`
      SELECT EXISTS(
        SELECT FROM information_schema.tables
        WHERE table_name = 'schema_migrations'
      ) AS exists
    `);

    const migrationsTableExists = tableCheck.rows[0]?.exists ?? false;
    const appliedVersions = new Set<number>();

    if (migrationsTableExists) {
      const applied = await client.query<{ migration_id: number }>('SELECT migration_id FROM schema_migrations');
      applied.rows.forEach(r => appliedVersions.add(r.migration_id));
    }

    const results: MigrationResult[] = [];

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) {
        results.push({ version: migration.version, filename: migration.filename, status: 'skipped' });
        continue;
      }

      const sql = fs.readFileSync(migration.path, 'utf-8');
      console.log(`[migration-runner] Applying V${migration.version}: ${migration.filename}`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        results.push({ version: migration.version, filename: migration.filename, status: 'applied' });
        appliedVersions.add(migration.version);
        console.log(`[migration-runner] V${migration.version} applied`);
      } catch (err) {
        await client.query('ROLLBACK');
        const error = err instanceof Error ? err.message : String(err);
        results.push({ version: migration.version, filename: migration.filename, status: 'failed', error });
        console.error(`[migration-runner] V${migration.version} failed: ${error}`);
        throw new Error(`Migration V${migration.version} failed: ${error}`);
      }
    }

    return results;
  } finally {
    client.release();
  }
}

/** CLI entry point for migration runner. */
async function main(): Promise<void> {
  const pool = new Pool({
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
    database: process.env['DB_NAME'] ?? 'clubhub',
    user: process.env['DB_USER'] ?? 'clubhub_app',
    password: process.env['DB_PASSWORD'] ?? '',
  });

  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  console.log(`[migration-runner] Running migrations from: ${migrationsDir}`);

  try {
    const results = await runMigrations(pool, migrationsDir);
    const applied = results.filter(r => r.status === 'applied').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    console.log(`[migration-runner] Done: ${applied} applied, ${skipped} skipped`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.includes('migration-runner')) {
  main().catch(err => {
    console.error('[migration-runner] Fatal:', err);
    process.exit(1);
  });
}
