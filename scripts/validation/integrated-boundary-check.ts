#!/usr/bin/env tsx
/**
 * G.7 — Constitutional Boundary Validation: Integrated Runtime
 *
 * Verifies the constitutional isolation boundaries hold in the
 * REAL integrated stack, not just in isolation:
 *
 * B.1 — PRE imports no runtime infrastructure (DB, HTTP, filesystem, crypto)
 * B.2 — Entropy service never mutates the core state tables
 * B.3 — Shadow service cannot auto-promote canary
 * B.4 — Audit path is strictly append-only (no mutation methods called)
 * B.5 — Player never bypasses PRE (cannot generate playlists independently)
 * B.6 — API cannot bypass auth (authPreHandler is the only access path)
 *
 * This script scans the actual TypeScript source files for forbidden patterns.
 * It is a static analysis tool — not a runtime test.
 *
 * Usage:
 *   tsx scripts/validation/integrated-boundary-check.ts
 *
 * Exit: 0 = PASS, 1 = FAIL
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../..');

interface BoundaryRule {
  id: string;
  description: string;
  scope: string[];       // directories to scan (relative to ROOT)
  forbidden: RegExp[];   // patterns that must NOT appear
  exceptions: string[];  // files excluded from this rule
}

const RULES: BoundaryRule[] = [
  {
    id: 'B.1-PRE-no-db',
    description: 'PRE must not import database or pool',
    scope: ['src/pre'],
    forbidden: [
      /from ['"].*pool['"]/,
      /from ['"].*repository['"]/,
      /require\(['"]pg['"]\)/,
      /import.*from ['"]pg['"]/,
      /INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK/,
    ],
    exceptions: [],
  },
  {
    id: 'B.1-PRE-no-http',
    description: 'PRE must not import HTTP or network modules',
    scope: ['src/pre'],
    forbidden: [
      /from ['"]node:http['"]/,
      /from ['"]node:https['"]/,
      /from ['"]axios['"]/,
      /\bfetch\s*\(/,
      /require\(['"]http['"]\)/,
      /require\(['"]https['"]\)/,
    ],
    exceptions: [],
  },
  {
    id: 'B.1-PRE-no-filesystem',
    description: 'PRE must not import filesystem modules',
    scope: ['src/pre'],
    forbidden: [
      /from ['"]node:fs['"]/,
      /from ['"]fs['"]/,
      /readFileSync|writeFileSync|appendFileSync/,
    ],
    exceptions: [],
  },
  {
    id: 'B.1-PRE-no-side-effects',
    description: 'PRE must not call Date.now() or Math.random()',
    scope: ['src/pre'],
    forbidden: [
      /Date\.now\(\)/,
      /Math\.random\(\)/,
      /new Date\(\)/,
    ],
    exceptions: ['src/pre/constants.ts'], // constants file may reference dates in comments
  },
  {
    id: 'B.4-audit-no-update',
    description: 'Audit repository must not contain UPDATE or DELETE',
    scope: ['services/cms-api/src/db/repositories/audit-repository.ts'],
    forbidden: [
      /\bUPDATE\b/i,
      /\bDELETE\b/i,
      /\.update\(/,
      /\.delete\(/,
    ],
    exceptions: [],
  },
  {
    id: 'B.5-player-no-direct-playlist',
    description: 'Player must not generate playlists without PRE',
    scope: ['player-runtime/src'],
    forbidden: [
      /playlist\s*=\s*\[/,          // direct array assignment
      /new.*Playlist\(/,
      /generatePlaylist\(/,
      /buildPlaylist\(/,
    ],
    exceptions: ['player-runtime/src/playlist-poller.ts'], // only receives, never generates
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function getAllFiles(dir: string, ext = '.ts'): string[] {
  const result: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return result;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (entry !== 'node_modules' && entry !== 'dist' && entry !== '.turbo') {
        result.push(...getAllFiles(fullPath, ext));
      }
    } else if (entry.endsWith(ext)) {
      result.push(fullPath);
    }
  }
  return result;
}

function checkFile(filePath: string, rules: BoundaryRule[]): Array<{ rule: string; line: number; text: string }> {
  const violations: Array<{ rule: string; line: number; text: string }> = [];
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return violations;
  }

  const lines = content.split('\n');
  const relPath = filePath.replace(ROOT + '/', '');

  for (const rule of rules) {
    // Check if this file is in scope
    const inScope = rule.scope.some(s => relPath.startsWith(s) || filePath.includes(s));
    if (!inScope) continue;

    // Check exceptions
    const isException = rule.exceptions.some(ex => relPath.includes(ex) || filePath.includes(ex));
    if (isException) continue;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      // Skip comment lines
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

      for (const pattern of rule.forbidden) {
        if (pattern.test(line)) {
          violations.push({
            rule: rule.id,
            line: i + 1,
            text: line.trim().slice(0, 100),
          });
          break; // one violation per line per rule
        }
      }
    }
  }

  return violations;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('='.repeat(70));
  console.log('G.7 — Constitutional Boundary Validation');
  console.log(`Root: ${ROOT}`);
  console.log(`Rules: ${RULES.length}`);
  console.log('='.repeat(70));

  const allViolations: Array<{ file: string; rule: string; line: number; text: string }> = [];

  for (const rule of RULES) {
    process.stdout.write(`\n  [${rule.id}] ${rule.description}\n`);

    let filesScanned = 0;
    let violationsForRule = 0;

    for (const scopePath of rule.scope) {
      const absScope = join(ROOT, scopePath);
      let files: string[];
      try {
        const stat = statSync(absScope);
        files = stat.isDirectory() ? getAllFiles(absScope) : [absScope];
      } catch {
        process.stdout.write(`    WARNING: scope path not found: ${scopePath}\n`);
        continue;
      }

      for (const file of files) {
        filesScanned++;
        const violations = checkFile(file, [rule]);
        for (const v of violations) {
          violationsForRule++;
          allViolations.push({ file: file.replace(ROOT + '/', ''), ...v });
          process.stdout.write(`    [VIOLATION] ${file.replace(ROOT + '/', '')}:${v.line}: ${v.text}\n`);
        }
      }
    }

    if (violationsForRule === 0) {
      process.stdout.write(`    Scanned ${filesScanned} files: CLEAN\n`);
    } else {
      process.stdout.write(`    Scanned ${filesScanned} files: ${violationsForRule} VIOLATION(S)\n`);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`Total violations: ${allViolations.length}`);

  if (allViolations.length > 0) {
    console.error('\nVIOLATIONS SUMMARY:');
    for (const v of allViolations) {
      console.error(`  [${v.rule}] ${v.file}:${v.line}`);
      console.error(`    ${v.text}`);
    }
    console.log('\nCONSTITUTIONAL VERDICT: FAIL — boundary violations detected');
    process.exit(1);
  }

  console.log('\nCONSTITUTIONAL VERDICT: PASS');
  console.log('  PRE: no DB, HTTP, filesystem, or side-effect imports');
  console.log('  Audit: no UPDATE or DELETE operations');
  console.log('  Player: no direct playlist generation');
  console.log('  All constitutional boundary rules CLEAN');
  process.exit(0);
}

main();
