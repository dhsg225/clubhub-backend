#!/usr/bin/env ts-node
/**
 * Constitutional boundary check.
 *
 * Static check: verify no file in src/pre/ imports from
 * src/runtime/, src/shadow/, src/entropy/, src/audit/, src/api/
 *
 * PRE must have no knowledge of these subsystems.
 * Reports all violations.
 */

import * as fs from 'fs';
import * as path from 'path';

const PRE_DIR = path.join(__dirname, '../../src/pre');
const FORBIDDEN_IMPORT_PATTERNS = [
  '../runtime',
  '../shadow',
  '../entropy',
  '../audit',
  '../api',
];

function walkDir(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      results.push(fullPath);
    }
  }
  return results;
}

function checkFile(filePath: string): { file: string; violations: string[] } {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    // Check for import statements and require calls
    if (/^\s*(import|export)/.test(line) || /require\(/.test(line)) {
      for (const forbidden of FORBIDDEN_IMPORT_PATTERNS) {
        if (line.includes(`'${forbidden}`) || line.includes(`"${forbidden}`)) {
          violations.push(`  Line ${i + 1}: ${line.trim()}`);
        }
      }
    }
  }

  return { file: filePath, violations };
}

let totalViolations = 0;
let cleanFiles = 0;

const tsFiles = walkDir(PRE_DIR);
console.log(`\nChecking ${tsFiles.length} files in src/pre/ for boundary violations...\n`);

for (const filePath of tsFiles) {
  const result = checkFile(filePath);
  const relativePath = path.relative(process.cwd(), filePath);

  if (result.violations.length > 0) {
    console.error(`  VIOLATION in ${relativePath}:`);
    for (const v of result.violations) {
      console.error(v);
    }
    totalViolations += result.violations.length;
  } else {
    console.log(`  PASS: ${relativePath} — no boundary violations`);
    cleanFiles++;
  }
}

console.log(`\nconstitutional-boundary-check: ${cleanFiles} files clean, ${totalViolations} violations found`);

if (totalViolations > 0) {
  console.error('\nFAIL — PRE boundary violations detected. PRE must not import from runtime, shadow, entropy, audit, or api.');
  process.exit(1);
}

console.log('\nPASS — PRE boundary is clean');
process.exit(0);
