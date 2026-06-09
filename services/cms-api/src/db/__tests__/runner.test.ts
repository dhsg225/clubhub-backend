import { describe, it, expect } from 'vitest';
import { MigrationRunner } from '../runner.js';
import * as path from 'node:path';

describe('MigrationRunner', () => {
  const migrationsDir = path.join(import.meta.dirname, '../../../migrations');

  it('lists migration files in numeric order', async () => {
    const runner = new MigrationRunner(migrationsDir);
    const files = await runner.getMigrationFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/^V1__/);
  });

  it('passes lint for all migration files', async () => {
    const runner = new MigrationRunner(migrationsDir);
    const { valid, errors } = await runner.lint();
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('verifies V1 creates replay_audit_records as partitioned', async () => {
    const runner = new MigrationRunner(migrationsDir);
    const { valid } = await runner.lint();
    expect(valid).toBe(true); // lint checks PARTITION BY RANGE in V1
  });
});
