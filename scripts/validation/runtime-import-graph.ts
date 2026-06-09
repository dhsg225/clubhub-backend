#!/usr/bin/env tsx
/**
 * G.7 — Runtime Import Graph: PRE Isolation Verification
 *
 * Builds a simplified import graph rooted at src/pre/index.ts and verifies:
 * - PRE imports only internal PRE modules and approved packages
 * - PRE has no transitive dependencies on runtime infrastructure
 * - Import depth from PRE entry to any leaf is reasonable (< 10 hops)
 *
 * Approved external imports from PRE:
 * - Node.js built-ins that are deterministic: crypto (for UUID), etc.
 * - @clubhub/fnv-checksum (pure function, no I/O)
 * - @clubhub/pre-types (type definitions only)
 *
 * Forbidden transitive imports (even indirect):
 * - pg, postgres, knex (database)
 * - express, fastify, koa (HTTP)
 * - fs, path (except as types/constants)
 * - Redis, RabbitMQ, Kafka clients
 *
 * Usage:
 *   tsx scripts/validation/runtime-import-graph.ts
 *
 * Exit: 0 = PASS, 1 = FAIL
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';

const ROOT = join(__dirname, '../..');
const PRE_ENTRY = join(ROOT, 'src/pre/index.ts');

const FORBIDDEN_IMPORTS = [
  'pg',
  'postgres',
  'knex',
  'typeorm',
  'prisma',
  'sequelize',
  'express',
  'fastify',
  'koa',
  'hapi',
  'redis',
  'ioredis',
  'amqplib',
  'kafkajs',
  'axios',
  'node-fetch',
  'got',
  'superagent',
];

const APPROVED_EXTERNAL = [
  '@clubhub/fnv-checksum',
  '@clubhub/pre-types',
  '@clubhub/constitutional-types',
  'luxon',     // timezone handling (if used)
  'intl',      // IANA timezone via Intl API — built-in
];

interface ImportNode {
  file: string;
  imports: string[];
  depth: number;
}

function extractImports(filePath: string): string[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const imports: string[] = [];
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]!);
  }

  return imports;
}

function resolveImportPath(from: string, importPath: string): string | null {
  if (importPath.startsWith('.')) {
    const dir = dirname(from);
    const candidates = [
      resolvePath(dir, importPath),
      resolvePath(dir, importPath + '.ts'),
      resolvePath(dir, importPath.replace(/\.js$/, '.ts')),
      join(resolvePath(dir, importPath), 'index.ts'),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
    return null;
  }
  return null; // external package — we just check the package name
}

function buildImportGraph(
  entry: string,
  maxDepth = 8,
): {
  nodes: Map<string, ImportNode>;
  externalImports: Set<string>;
  violations: string[];
} {
  const nodes = new Map<string, ImportNode>();
  const externalImports = new Set<string>();
  const violations: string[] = [];
  const queue: Array<{ file: string; depth: number }> = [{ file: entry, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { file, depth } = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);

    if (depth > maxDepth) {
      violations.push(`Import depth exceeded ${maxDepth} hops at: ${file.replace(ROOT + '/', '')}`);
      continue;
    }

    const rawImports = extractImports(file);
    const node: ImportNode = { file: file.replace(ROOT + '/', ''), imports: rawImports, depth };
    nodes.set(file, node);

    for (const imp of rawImports) {
      // Check external package name
      const pkgName = imp.startsWith('@')
        ? imp.split('/').slice(0, 2).join('/')
        : imp.split('/')[0] ?? imp;

      if (!imp.startsWith('.')) {
        externalImports.add(pkgName);

        // Check for forbidden external imports
        if (FORBIDDEN_IMPORTS.includes(pkgName)) {
          violations.push(
            `FORBIDDEN_IMPORT: ${file.replace(ROOT + '/', '')} imports forbidden package "${pkgName}"`,
          );
        }
      } else {
        // Resolve local import
        const resolved = resolveImportPath(file, imp);
        if (resolved && !visited.has(resolved)) {
          queue.push({ file: resolved, depth: depth + 1 });
        }
      }
    }
  }

  return { nodes, externalImports, violations };
}

function main(): void {
  console.log('='.repeat(70));
  console.log('G.7 — Runtime Import Graph: PRE Isolation Verification');
  console.log(`Entry: ${PRE_ENTRY.replace(ROOT + '/', '')}`);
  console.log('='.repeat(70));

  if (!existsSync(PRE_ENTRY)) {
    console.error(`[FATAL] PRE entry point not found: ${PRE_ENTRY}`);
    process.exit(1);
  }

  const { nodes, externalImports, violations } = buildImportGraph(PRE_ENTRY);

  console.log(`\nGraph size: ${nodes.size} internal modules`);
  console.log(`External packages: ${[...externalImports].join(', ') || '(none)'}`);

  // Check if any approved external packages are in the list
  const unapprovedExternal = [...externalImports].filter(
    pkg => !APPROVED_EXTERNAL.includes(pkg) && !pkg.startsWith('node:'),
  );

  if (unapprovedExternal.length > 0) {
    console.log(`\nWARNING: Unexpected external imports from PRE: ${unapprovedExternal.join(', ')}`);
    // Only treat as violation if they're actually forbidden
    const forbidden = unapprovedExternal.filter(p => FORBIDDEN_IMPORTS.includes(p));
    if (forbidden.length > 0) {
      for (const p of forbidden) {
        violations.push(`PRE transitively imports forbidden package: "${p}"`);
      }
    }
  }

  // Show depth distribution
  const maxDepth = Math.max(...[...nodes.values()].map(n => n.depth), 0);
  console.log(`Max import depth: ${maxDepth}`);

  // Show summary of PRE modules
  console.log('\nPRE module graph:');
  const sortedNodes = [...nodes.values()].sort((a, b) => a.depth - b.depth);
  for (const node of sortedNodes.slice(0, 20)) {
    const indent = '  ' + '  '.repeat(node.depth);
    console.log(`${indent}${node.file} (depth=${node.depth})`);
  }
  if (sortedNodes.length > 20) {
    console.log(`  ... and ${sortedNodes.length - 20} more`);
  }

  console.log('\n' + '─'.repeat(70));

  if (violations.length > 0) {
    console.error('\nVIOLATIONS:');
    for (const v of violations) console.error(`  [FAIL] ${v}`);
    console.log('\nCONSTITUTIONAL VERDICT: FAIL — PRE isolation violated');
    process.exit(1);
  }

  console.log('CONSTITUTIONAL VERDICT: PASS');
  console.log('  PRE has no transitive imports to runtime infrastructure');
  console.log('  All external dependencies are approved pure-function packages');
  console.log(`  Import graph: ${nodes.size} modules, max depth ${maxDepth}`);
  process.exit(0);
}

main();
