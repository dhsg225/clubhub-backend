/**
 * Database migration runner.
 *
 * Constitutional:
 * - Migrations run in strict numeric order
 * - No destructive migrations allowed (DROP TABLE, DROP COLUMN) without explicit annotation
 * - Constitutional-freeze-log migrations can NEVER be rolled back
 * - replay_audit_records must be RANGE partitioned from first migration
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { emit, base } from '@clubhub/telemetry-sdk';

export interface MigrationRecord {
  migration_id: number;
  filename: string;
  applied_at: number;
  checksum: string;
}

export class MigrationRunner {
  constructor(private readonly migrationsDir: string) {}

  async getMigrationFiles(): Promise<string[]> {
    const files = await fs.readdir(this.migrationsDir);
    return files
      .filter((f) => f.endsWith('.sql') && /^V\d+__/.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/^V(\d+)__.*/, '$1'), 10);
        const numB = parseInt(b.replace(/^V(\d+)__.*/, '$1'), 10);
        return numA - numB;
      });
  }

  async lint(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const files = await this.getMigrationFiles();

    // Check for numeric gaps
    for (let i = 0; i < files.length; i++) {
      const expected = i + 1;
      const actual = parseInt((files[i] ?? '').replace(/^V(\d+)__.*/, '$1'), 10);
      if (actual !== expected) {
        errors.push(`Migration sequence gap: expected V${expected}, found V${actual}`);
      }
    }

    // Check for destructive operations in non-annotated migrations
    for (const file of files) {
      const content = await fs.readFile(path.join(this.migrationsDir, file), 'utf-8');
      if (/DROP\s+TABLE/i.test(content) && !content.includes('-- CONSTITUTIONAL: permitted destructive')) {
        errors.push(`${file}: contains DROP TABLE without constitutional annotation`);
      }
      if (/DROP\s+COLUMN/i.test(content) && !content.includes('-- CONSTITUTIONAL: permitted destructive')) {
        errors.push(`${file}: contains DROP COLUMN without constitutional annotation`);
      }
    }

    // Check that V1 creates replay_audit_records as partitioned
    const v1 = files.find((f) => f.startsWith('V1__'));
    if (v1) {
      const content = await fs.readFile(path.join(this.migrationsDir, v1), 'utf-8');
      if (!/PARTITION BY RANGE/i.test(content)) {
        errors.push('V1 migration must create replay_audit_records with PARTITION BY RANGE from the start');
      }
    }

    emit({
      ...base('INFO', 'migration_runner.lint'),
      file_count: files.length,
      error_count: errors.length,
    } as Parameters<typeof emit>[0]);

    return { valid: errors.length === 0, errors };
  }
}
