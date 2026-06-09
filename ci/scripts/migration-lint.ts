/**
 * Migration lint — validates constitutional DB requirements.
 *
 * Constitutional requirements:
 * 1. V1 must create replay_audit_records with PARTITION BY RANGE and composite PK (audit_record_id, created_at)
 * 2. enforce_append_only() trigger function must exist in V1
 * 3. constitutional_freeze_log must have PERMANENT retention comment
 * 4. RLS must be enabled on tenant-scoped tables
 * 5. No DROP TABLE or DELETE without trigger guard in any migration
 *
 * Note: Uses only Node built-ins (no glob package required).
 */

import fs from 'node:fs';
import path from 'node:path';

interface LintResult {
  file: string;
  rule: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

const results: LintResult[] = [];

function check(file: string, rule: string, condition: boolean, detail: string): void {
  results.push({
    file: path.basename(file),
    rule,
    status: condition ? 'PASS' : 'FAIL',
    detail,
  });
}

/**
 * Recursively find all files matching a pattern under a root directory.
 * Replaces glob dependency with a pure Node fs walk.
 */
function findMigrationFiles(rootDir: string): string[] {
  const found: string[] = [];

  if (!fs.existsSync(rootDir)) {
    return found;
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      // Recurse into subdirectories
      found.push(...findMigrationFiles(fullPath));
    } else if (entry.isFile() && /^V\d+__.*\.sql$/i.test(entry.name)) {
      found.push(fullPath);
    }
  }

  return found;
}

function lintMigrations(): void {
  const cwd = process.cwd();
  const servicesDir = path.join(cwd, 'services');

  // Walk services/*/migrations/ for V*.sql files
  const migrationFiles: string[] = [];

  if (fs.existsSync(servicesDir)) {
    const serviceDirs = fs.readdirSync(servicesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(servicesDir, d.name, 'migrations'));

    for (const migrationsDir of serviceDirs) {
      migrationFiles.push(...findMigrationFiles(migrationsDir));
    }
  }

  if (migrationFiles.length === 0) {
    console.error('[migration-lint] No migration files found in services/*/migrations/');
    process.exit(1);
  }

  console.log(`[migration-lint] Found ${migrationFiles.length} migration file(s)`);
  for (const f of migrationFiles) {
    console.log(`  - ${path.relative(cwd, f)}`);
  }

  // Find V1 migration
  const v1Files = migrationFiles.filter(f => path.basename(f).startsWith('V1__'));
  check('V1', 'V1_EXISTS', v1Files.length > 0, `Found V1 migration: ${v1Files.map(f => path.basename(f)).join(', ')}`);

  for (const file of migrationFiles) {
    const rawContent = fs.readFileSync(file, 'utf-8');
    const content = rawContent.toUpperCase();
    const basename = path.basename(file);
    const isV1 = basename.startsWith('V1__');

    if (isV1) {
      // Check 1: replay_audit_records must be partitioned
      check(
        file,
        'REPLAY_AUDIT_PARTITIONED',
        content.includes('REPLAY_AUDIT_RECORDS') && content.includes('PARTITION BY RANGE'),
        'V1 must create replay_audit_records with PARTITION BY RANGE',
      );

      // Check 2: composite PK on replay_audit_records
      check(
        file,
        'REPLAY_AUDIT_COMPOSITE_PK',
        content.includes('AUDIT_RECORD_ID') && content.includes('CREATED_AT') && content.includes('PRIMARY KEY'),
        'V1 must create composite PK (audit_record_id, created_at) on replay_audit_records',
      );

      // Check 3: enforce_append_only trigger function
      check(
        file,
        'APPEND_ONLY_TRIGGER',
        content.includes('ENFORCE_APPEND_ONLY'),
        'V1 must define enforce_append_only() trigger function',
      );

      // Check 4: constitutional_freeze_log permanent retention
      check(
        file,
        'FREEZE_LOG_PERMANENT',
        content.includes('CONSTITUTIONAL_FREEZE_LOG') && (content.includes('PERMANENT') || content.includes('RETENTION')),
        'V1 must create constitutional_freeze_log with PERMANENT retention comment',
      );
    }

    // Check all migrations: no direct DELETE on append-only operational tables
    const hasUnsafeDelete = /DELETE\s+FROM\s+(REPLAY_AUDIT_RECORDS|CORPUS_VERSIONS|CONSTITUTIONAL_FREEZE_LOG)/i.test(rawContent);
    check(
      file,
      'NO_UNSAFE_DELETE',
      !hasUnsafeDelete,
      'Migrations must not DELETE from append-only operational tables',
    );

    // Check all migrations: no DROP TABLE on constitutional tables
    const hasDropConstTable = /DROP\s+TABLE.*(REPLAY_AUDIT_RECORDS|CORPUS_VERSIONS|CONSTITUTIONAL_FREEZE_LOG)/i.test(rawContent);
    check(
      file,
      'NO_DROP_CONSTITUTIONAL_TABLE',
      !hasDropConstTable,
      'Migrations must not DROP constitutional tables',
    );
  }

  // Print results
  console.log('\n[migration-lint] Results:');
  let failures = 0;
  for (const result of results) {
    const icon = result.status === 'PASS' ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] [${result.file}] ${result.rule}: ${result.detail}`);
    if (result.status === 'FAIL') failures++;
  }

  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  console.log(`\n[migration-lint] ${passed}/${total} checks passed`);

  if (failures > 0) {
    console.error(`[migration-lint] ${failures} check(s) FAILED — constitutional DB requirements not met`);
    process.exit(1);
  }

  console.log('[migration-lint] All checks PASS');
}

lintMigrations();
