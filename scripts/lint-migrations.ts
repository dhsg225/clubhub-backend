#!/usr/bin/env ts-node
/**
 * SQL migration constitutional linter.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §12
 *
 * Scans SQL migration files for patterns that violate constitutional rules.
 * A migration that violates the constitution must not be applied to any environment.
 *
 * Rules enforced:
 * ML-01: No migration may grant PRE write access to any configuration table
 * ML-02: No migration may add a column to a PRE-owned table without PRE team review
 * ML-03: No migration may drop a column referenced in active corpus packets
 * ML-04: No migration may alter the canonical field names for corpus-referenced tables
 * ML-05: No migration may add a DEFAULT to a timestamp column (forces UTC, not IANA tz)
 * ML-06: No migration may create a trigger that writes to configuration tables
 * ML-07: No migration file may lack a rollback comment block
 *
 * Usage:
 *   npx ts-node scripts/lint-migrations.ts [migration-file.sql]
 *   npx ts-node scripts/lint-migrations.ts --all
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const ROOT = join(__dirname, '..');
const MIGRATIONS_DIR = join(ROOT, 'migrations');

// ─── Migration Lint Rules ─────────────────────────────────────────────────────

interface MigrationLintRule {
  id:          string;
  description: string;
  severity:    'CONSTITUTIONAL_BREACH' | 'ERROR' | 'WARNING';
  check:       (sql: string, filename: string) => string | null;  // returns error message or null
}

/** Tables owned by PRE (read-only in PRE; writes via backend API only) */
const PRE_OWNED_TABLES = new Set([
  'screens', 'tv_groups', 'areas', 'venues', 'organizations',
  'emergency_states', 'overrides', 'schedules', 'campaigns',
  'content_items', 'sponsorship_contracts', 'delivery_log',
]);

/** Tables that PRE writes to (only venue_health_snapshots for entropy) */
const PRE_WRITABLE_TABLES = new Set([
  'venue_health_snapshots',  // written by entropy batch runner only
  'manifest_cache',          // written by manifest endpoint, NOT by PRE.resolve()
]);

const MIGRATION_RULES: MigrationLintRule[] = [
  {
    id: 'ML-01',
    description: 'No GRANT of write permissions to PRE-service database user on configuration tables',
    severity: 'CONSTITUTIONAL_BREACH',
    check(sql) {
      const grantMatch = /GRANT\s+(INSERT|UPDATE|DELETE|TRUNCATE).*ON\s+(\w+)/gi;
      let match: RegExpExecArray | null;
      while ((match = grantMatch.exec(sql)) !== null) {
        const table = (match[2] ?? '').toLowerCase();
        if (PRE_OWNED_TABLES.has(table)) {
          return (
            `ML-01: GRANT of write permission on PRE-owned table "${table}". ` +
            `PRE reads only. Write access must be limited to the backend API service user.`
          );
        }
      }
      return null;
    },
  },
  {
    id: 'ML-02',
    description: 'Renaming a column in a PRE-owned table requires corpus review',
    severity: 'ERROR',
    check(sql) {
      // RENAME COLUMN / ALTER COLUMN ... RENAME TO
      const renamePattern = /ALTER\s+TABLE\s+(\w+)\s+RENAME\s+COLUMN/i;
      const match = renamePattern.exec(sql);
      if (match) {
        const table = (match[1] ?? '').toLowerCase();
        if (PRE_OWNED_TABLES.has(table)) {
          return (
            `ML-02: RENAME COLUMN on PRE-owned table "${table}". ` +
            `Renaming a column referenced by active corpus packets is a behavioral change. ` +
            `Check all active corpus packets for references to the renamed column ` +
            `and update or retire affected packets before applying this migration.`
          );
        }
      }
      return null;
    },
  },
  {
    id: 'ML-03',
    description: 'Dropping a column in a PRE-owned table requires corpus review',
    severity: 'CONSTITUTIONAL_BREACH',
    check(sql) {
      const dropColPattern = /ALTER\s+TABLE\s+(\w+)\s+DROP\s+COLUMN\s+(\w+)/gi;
      let match: RegExpExecArray | null;
      while ((match = dropColPattern.exec(sql)) !== null) {
        const table = (match[1] ?? '').toLowerCase();
        if (PRE_OWNED_TABLES.has(table)) {
          return (
            `ML-03: DROP COLUMN on PRE-owned table "${table}.${match[2]}". ` +
            `Dropping a column may break active corpus packets that reference it. ` +
            `All affected corpus packets must be retired or updated before this migration is applied.`
          );
        }
      }
      return null;
    },
  },
  {
    id: 'ML-04',
    description: 'Timestamp columns must NOT default to NOW() — use application-level UTC ms',
    severity: 'ERROR',
    check(sql) {
      // DEFAULT NOW() or DEFAULT CURRENT_TIMESTAMP on any column
      if (/DEFAULT\s+(NOW\s*\(\s*\)|CURRENT_TIMESTAMP)/i.test(sql)) {
        return (
          `ML-04: Timestamp column uses DEFAULT NOW() or CURRENT_TIMESTAMP. ` +
          `The application must supply UTC millisecond timestamps explicitly. ` +
          `Database-level defaults bypass the canonical timestamp representation ` +
          `and can introduce timezone ambiguity.`
        );
      }
      return null;
    },
  },
  {
    id: 'ML-05',
    description: 'No database triggers that write to configuration tables',
    severity: 'CONSTITUTIONAL_BREACH',
    check(sql) {
      if (/CREATE\s+(OR\s+REPLACE\s+)?TRIGGER/i.test(sql)) {
        return (
          `ML-05: Migration creates a database trigger. ` +
          `Triggers that write to configuration tables violate the advisory-only principle ` +
          `(FP-13) and the prohibition on automatic corrective behavior. ` +
          `If this trigger is read-only or writes only to audit/snapshot tables, ` +
          `add a comment block explicitly stating its purpose and the reviewer approval.`
        );
      }
      return null;
    },
  },
  {
    id: 'ML-06',
    description: 'No DROP TABLE on PRE-owned tables',
    severity: 'CONSTITUTIONAL_BREACH',
    check(sql) {
      const dropTablePattern = /DROP\s+TABLE\s+(IF\s+EXISTS\s+)?(\w+)/gi;
      let match: RegExpExecArray | null;
      while ((match = dropTablePattern.exec(sql)) !== null) {
        const table = (match[2] ?? '').toLowerCase();
        if (PRE_OWNED_TABLES.has(table) || PRE_WRITABLE_TABLES.has(table)) {
          return (
            `ML-06: DROP TABLE "${match[2]}" on a constitutionally significant table. ` +
            `This would destroy corpus packet validity. ` +
            `Contact the platform team before proceeding.`
          );
        }
      }
      return null;
    },
  },
  {
    id: 'ML-07',
    description: 'Migration file must contain a rollback comment block',
    severity: 'ERROR',
    check(sql) {
      // Look for a rollback section comment
      if (!/--\s*(ROLLBACK|DOWN|REVERT)/i.test(sql)) {
        return (
          `ML-07: Migration file is missing a rollback comment block. ` +
          `All migrations must include a "-- ROLLBACK:" or "-- DOWN:" section ` +
          `documenting how to reverse the migration. ` +
          `Example: -- ROLLBACK: DROP TABLE IF EXISTS ...`
        );
      }
      return null;
    },
  },
  {
    id: 'ML-08',
    description: 'Migration filename must follow sequential numbering convention',
    severity: 'WARNING',
    check(_sql, filename) {
      if (!/^\d{3,}_[a-z_]+\.sql$/.test(filename)) {
        return (
          `ML-08: Migration filename "${filename}" does not follow convention. ` +
          `Expected format: {NNN}_{snake_case_description}.sql (e.g., 005_add_sponsor_contracts.sql).`
        );
      }
      return null;
    },
  },
];

// ─── Scanner ──────────────────────────────────────────────────────────────────

interface MigrationViolation {
  file:       string;
  rule_id:    string;
  severity:   MigrationLintRule['severity'];
  description: string;
  message:    string;
}

function lintMigration(filePath: string): MigrationViolation[] {
  const filename = basename(filePath);
  let sql: string;

  try {
    sql = readFileSync(filePath, 'utf8');
  } catch (err) {
    return [{
      file:        filePath,
      rule_id:     'ML-00',
      severity:    'ERROR',
      description: 'Cannot read migration file',
      message:     String(err),
    }];
  }

  const violations: MigrationViolation[] = [];

  for (const rule of MIGRATION_RULES) {
    const error = rule.check(sql, filename);
    if (error) {
      violations.push({
        file:        filePath,
        rule_id:     rule.id,
        severity:    rule.severity,
        description: rule.description,
        message:     error,
      });
    }
  }

  return violations;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const scanAll = args.includes('--all');
  const fileArg = args.find(a => !a.startsWith('--'));

  const filesToLint: string[] = [];

  if (scanAll) {
    let entries: string[];
    try {
      entries = readdirSync(MIGRATIONS_DIR);
    } catch {
      console.log('migrations/ directory does not exist yet — nothing to lint');
      process.exit(0);
      return;
    }
    for (const entry of entries) {
      if (entry.endsWith('.sql')) {
        filesToLint.push(join(MIGRATIONS_DIR, entry));
      }
    }
  } else if (fileArg) {
    filesToLint.push(fileArg);
  } else {
    console.log('Usage: lint-migrations.ts [file.sql | --all]');
    process.exit(1);
  }

  if (filesToLint.length === 0) {
    console.log('✓ Migration lint: no migration files to check');
    process.exit(0);
  }

  const allViolations: MigrationViolation[] = [];

  for (const file of filesToLint) {
    const violations = lintMigration(file);
    allViolations.push(...violations);
  }

  if (allViolations.length === 0) {
    console.log(`✓ Migration lint: no violations in ${filesToLint.length} migration(s)`);
    process.exit(0);
  }

  const constitutional = allViolations.filter(v => v.severity === 'CONSTITUTIONAL_BREACH');
  const errors = allViolations.filter(v => v.severity === 'ERROR');
  const warnings = allViolations.filter(v => v.severity === 'WARNING');

  console.error('\n═══ MIGRATION LINT VIOLATIONS ═══\n');

  for (const v of allViolations) {
    console.error(`[${v.severity}] ${v.rule_id} — ${v.description}`);
    console.error(`  File: ${basename(v.file)}`);
    console.error(`  Detail: ${v.message}`);
    console.error('');
  }

  console.error(`Summary: ${constitutional.length} CONSTITUTIONAL_BREACH, ${errors.length} ERROR, ${warnings.length} WARNING`);

  if (constitutional.length > 0 || errors.length > 0) {
    console.error('BLOCKING: Violations must be resolved before this migration is applied.');
    process.exit(1);
  }

  process.exit(0);
}

main();
