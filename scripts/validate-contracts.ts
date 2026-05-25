#!/usr/bin/env ts-node
/**
 * Constitutional contract scanner — Forbidden Pattern Detector.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §4 (CI stage 05)
 * Forbidden Patterns: FP-01 through FP-15 (ENGINEERING-CONSTITUTION-v1.md §15)
 *
 * Scans source files for patterns that violate constitutional rules.
 * Exits with code 1 if any violations are found (blocking CI gate).
 *
 * Usage:
 *   npx ts-node scripts/validate-contracts.ts [--path src/pre]
 *   npx ts-node scripts/validate-contracts.ts --all
 *
 * Scope defaults to src/pre/ (highest-risk directory).
 * Use --all to scan all src/ directories.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..');

// ─── Forbidden Pattern Definitions ────────────────────────────────────────────

interface ForbiddenPattern {
  id:          string;   // e.g., "FP-02"
  description: string;
  severity:    'CONSTITUTIONAL_BREACH' | 'ERROR' | 'WARNING';
  /** Files/directories this pattern applies to */
  scope:       'pre-only' | 'pre-and-verification' | 'all-src';
  pattern:     RegExp;
  /** Human-readable remediation instruction */
  remediation: string;
}

const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  {
    id: 'FP-02',
    description: 'Side effect in PRE: SQL write operation in src/pre/',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-only',
    pattern: /\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|CREATE\s+TABLE|DROP\s+TABLE|ALTER\s+TABLE|UPSERT)\b/i,
    remediation: 'Remove all write SQL from src/pre/. PRE must be a pure read-only function.',
  },
  {
    id: 'FP-02b',
    description: 'Side effect in PRE: write method call in src/pre/',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-only',
    pattern: /\b(db\.(run|insert|update|delete|upsert)|pool\.(query|execute)\s*\(\s*['"`]\s*(INSERT|UPDATE|DELETE|UPSERT))/i,
    remediation: 'Remove all db write calls from src/pre/. Use db.query() for reads only.',
  },
  {
    id: 'FP-03',
    description: 'Nondeterministic time source: Date.now() in src/pre/ (use the `at` parameter)',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-only',
    pattern: /\bDate\.now\s*\(\)/,
    remediation: 'Use the `at` parameter passed to PRE.resolve(). Never call Date.now() inside PRE.',
  },
  {
    id: 'FP-04',
    description: 'Nondeterministic value: Math.random() in src/pre/',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-only',
    pattern: /\bMath\.random\s*\(\)/,
    remediation: 'Remove Math.random() from src/pre/. PRE must be fully deterministic.',
  },
  {
    id: 'FP-05',
    description: 'Network access in PRE: require/import of http/axios/fetch in src/pre/',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-only',
    pattern: /require\s*\(\s*['"`](http|https|axios|node-fetch|undici|got)['"`]\s*\)|import.*from\s+['"`](http|https|axios|node-fetch|undici|got)['"`]/,
    remediation: 'Remove all network imports from src/pre/. PRE cannot make network requests.',
  },
  {
    id: 'FP-06',
    description: 'File system access in PRE: require/import of fs in src/pre/',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-only',
    pattern: /require\s*\(\s*['"`]fs['"`]\s*\)|import.*from\s+['"`]fs['"`]/,
    remediation: 'Remove fs imports from src/pre/. PRE cannot read files at resolve time.',
  },
  {
    id: 'FP-07',
    description: 'Hardcoded threshold value in PRE (numeric literal that should be in constants.ts)',
    severity: 'ERROR',
    // pre-only scope, but constants.ts itself is exempted in scanFile()
    scope: 'pre-only',
    // Matches suspicious numeric literals — confidence thresholds, SOV thresholds
    // Allow: 0, 1, 2, 3, 4, 5, 6 (level numbers), 100 (weight default), 1000 (ms conversion)
    pattern: /\b(0\.\d{2,}|30000|1800000|16777619|2166136261)\b/,
    remediation:
      'Move numeric threshold to src/pre/constants.ts and reference it by name. ' +
      'Exception: algorithm constants already defined in constants.ts.',
  },
  {
    id: 'FP-08',
    description: 'Locale-sensitive operation in src/pre/ (toLocaleString, Intl.Collator, localeCompare)',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-only',
    pattern: /\b(toLocaleString|toLocaleDateString|toLocaleTimeString|localeCompare|Intl\.Collator)\b/,
    remediation:
      'Use locale-neutral string operations. ' +
      'For timezone: use toVenueLocal() only. For sorting: use Unicode code point order.',
  },
  {
    id: 'FP-09',
    description: 'new Date() without argument in src/pre/ (nondeterministic current time)',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-only',
    // Match `new Date()` without arguments but allow `new Date(someValue)`
    pattern: /new\s+Date\s*\(\s*\)/,
    remediation: 'Do not call new Date() in src/pre/. Use the `at` parameter for the current time.',
  },
  {
    id: 'FP-10',
    description: 'Timezone abbreviation or UTC offset string literal in src/pre/ (INV-9 violation)',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-only',
    // Matches UTC offset strings or common timezone abbreviations
    pattern: /(['"`])(UTC[+-]\d|GMT[+-]\d|[+-]\d{2}:\d{2}|EST|PST|CST|MST|EDT|PDT|CDT|MDT)\1/,
    remediation:
      'Use only IANA timezone identifiers (e.g., "America/New_York"). ' +
      'Never use UTC offset strings or timezone abbreviations.',
  },
  {
    id: 'FP-11',
    description: 'process.env access in src/pre/ (configuration should be passed as parameters)',
    severity: 'ERROR',
    scope: 'pre-only',
    pattern: /\bprocess\.env\b/,
    remediation:
      'Do not read process.env inside src/pre/. ' +
      'Pass configuration values as explicit parameters to PRE.resolve().',
  },
  {
    id: 'FP-12',
    description: 'console.log in src/pre/ (use structured observability logger)',
    severity: 'WARNING',
    scope: 'pre-only',
    pattern: /\bconsole\.(log|error|warn|debug|info)\s*\(/,
    remediation:
      'Replace console.log with structured logging via src/observability/logger.ts. ' +
      'PRE should not emit logs directly — callers handle observability.',
  },
  {
    id: 'FP-13',
    description: 'Automatic corrective write in entropy calculators (advisory-only violation)',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-and-verification',
    // Detect write SQL in entropy directory
    pattern: /\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|UPSERT)\b/i,
    remediation:
      'Entropy calculators are advisory-only. They MUST NOT write to configuration tables. ' +
      'The only permitted write is to venue_health_snapshots.',
  },
  {
    id: 'FP-14',
    description: 'Untyped any in critical paths (type safety violation)',
    severity: 'WARNING',
    scope: 'pre-only',
    pattern: /:\s*any\b(?!\s*\[\])/,
    remediation:
      'Replace `any` with explicit types. Use `unknown` for truly unknown values ' +
      'and narrow with type guards.',
  },
  {
    id: 'FP-15',
    description: 'Mutable export from PRE (PRE state must be immutable)',
    severity: 'ERROR',
    scope: 'pre-only',
    pattern: /export\s+(let|var)\s+/,
    remediation:
      'Use `export const` only. PRE modules must not export mutable bindings.',
  },

  // ─── Entropy-specific guardrails (FP-16 through FP-19) ───────────────────
  // Per OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §11 Non-Goals, §12.3

  {
    id: 'FP-16',
    description: 'entropy_readonly: entropy file assigns to state object fields',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-and-verification',
    // Detect direct assignment to state.* fields or mutation of state array properties
    // Matches: state.field = ..., state.overrides.push, state.schedules.splice, etc.
    pattern: /\bstate\.\w+(\.\w+)?\s*(=(?!=)|\.push\s*\(|\.pop\s*\(|\.splice\s*\(|\.shift\s*\(|\.unshift\s*\()/,
    remediation:
      'Entropy calculators are read-only. They MUST NOT write to state fields or ' +
      'mutate state arrays (state.overrides.push etc). Use read operations only.',
  },
  {
    id: 'FP-17',
    description: 'entropy_no_autocorrect: entropy file calls PRE.resolve or modifies playlist/overrides/schedules',
    severity: 'CONSTITUTIONAL_BREACH',
    // entropy-only: do not flag the PRE source itself
    scope: 'pre-and-verification',
    // Detect imports or calls to PRE resolve from within entropy files (not from PRE itself),
    // or direct mutation of operational record arrays (playlist, overrides, schedules, campaigns)
    pattern: /\b(playlist\.push|overrides\.push|schedules\.push|campaigns\.push|sponsorships\.push)\b/,
    remediation:
      'Entropy calculators MUST NOT modify playlists, overrides, schedules, or campaigns. ' +
      'Entropy is advisory-only. See OPERATIONAL-ENTROPY-AND-GUARDRAILS-v1.md §11.',
  },
  {
    id: 'FP-18',
    description: 'entropy_deterministic: entropy file uses Date.now(), Math.random(), or async operations',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-and-verification',
    // Detect nondeterministic sources in entropy code
    // Excludes comment lines (handled by scanFile comment filter)
    pattern: /\b(Date\.now\s*\(\)|Math\.random\s*\(\)|new\s+Date\s*\(\s*\)|async\s+function|await\s+)/,
    remediation:
      'Entropy calculators MUST be deterministic. Use the `at` parameter for time. ' +
      'No Math.random(), no async operations. Same (state, at) must always produce same output.',
  },
  {
    id: 'FP-19',
    description: 'entropy_advisory_only: entropy output type has apply/execute/mutate method definition',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-and-verification',
    // Detect method definitions with mutating names in entropy module interfaces/classes
    // Matches method bodies: apply(): ..., mutate(x): ..., etc.
    pattern: /^\s*(apply|execute|mutate|patch|commit)\s*\([^)]*\)\s*[:{]/,
    remediation:
      'Entropy output types MUST NOT have mutating methods. Entropy is observation only. ' +
      'Remove apply(), execute(), mutate(), patch(), commit() method definitions from entropy types.',
  },

  // ─── Runtime constitutional guardrails (FP-20 through FP-25) ─────────────
  // Per EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13 — production runtime rules

  {
    id: 'FP-20',
    description: 'runtime_no_pre_mutation: direct mutation of PRE_Output fields in src/runtime/ or src/api/',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'all-src',
    // Detect: preOutput.field = or pre_output.field = assignment (not comparison === or !==)
    pattern: /\b(pre_?output|preOutput)\.\w+\s*=(?!=)/,
    remediation: 'PRE outputs are immutable. Never assign to pre_output.* fields after resolution.',
  },
  {
    id: 'FP-21',
    description: 'telemetry_outside_pre_only: emit() or increment() called inside src/pre/ (telemetry belongs in runtime wrapper)',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'pre-only',
    pattern: /\b(emit|increment|setGauge)\s*\(/,
    remediation: 'Move all telemetry calls to src/runtime/pre-runtime.ts. PRE must not emit telemetry.',
  },
  {
    id: 'FP-22',
    description: 'replay_packet_immutable: audit record fields overwritten after creation',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'all-src',
    pattern: /\b(auditRecord|audit_record|replayRecord)\.\w+\s*=/,
    remediation: 'Replay audit records are immutable. Build with buildAuditRecord() and never reassign fields.',
  },
  {
    id: 'FP-23',
    description: 'no_hidden_runtime_fallback: silent catch-and-return in runtime path (hides failures)',
    severity: 'ERROR',
    scope: 'all-src',
    // Detect catch blocks that return null/undefined without logging
    pattern: /catch\s*\([^)]*\)\s*\{[^}]*return\s*(null|undefined)\s*;?\s*\}/,
    remediation: 'All caught errors in runtime path must be logged via emit() before returning. No silent fallbacks.',
  },
  {
    id: 'FP-24',
    description: 'no_auto_promotion: canary stage directly assigned without validateStageTransition()',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'all-src',
    // Detect direct assignment to canary_stage without going through validate
    pattern: /canary_stage\s*=\s*['"`](INTERNAL_CANARY|SINGLE_VENUE|MULTI_VENUE|FLEET_WIDE|AUTHORITATIVE)['"`]/,
    remediation: 'Use validateStageTransition() for all canary stage changes. Never assign canary_stage directly.',
  },
  {
    id: 'FP-25',
    description: 'audit_append_only: direct push or mutation of audit records array',
    severity: 'CONSTITUTIONAL_BREACH',
    scope: 'all-src',
    // Detect direct array push that bypasses write() method
    // Allow 'records.push(record)' inside replay-audit-writer.ts itself (see exclusion in scanFile)
    pattern: /\brecords\s*\.push\s*\((?!\s*record\s*\))/,
    remediation: 'Use ReplayAuditWriter.write() for all audit records. Never push directly to records array.',
  },
];

// ─── Scanner ──────────────────────────────────────────────────────────────────

interface Violation {
  file:       string;
  line:       number;
  pattern_id: string;
  severity:   ForbiddenPattern['severity'];
  description: string;
  matched_text: string;
  remediation: string;
}

function collectFiles(dirPath: string, extensions: string[]): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
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
        // Skip node_modules and dist
        if (entry !== 'node_modules' && entry !== 'dist') {
          walk(fullPath);
        }
      } else if (extensions.some(ext => entry.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  walk(dirPath);
  return files;
}

function scanFile(filePath: string, patterns: ForbiddenPattern[], filePathForScope: string): Violation[] {
  const violations: Violation[] = [];

  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return violations;
  }

  const lines = content.split('\n');

  for (const fp of patterns) {
    // Scope filtering
    if (fp.scope === 'pre-only' && !filePathForScope.includes('/pre/')) {
      continue;
    }
    // FP-07: constants.ts is the designated location for numeric literals — exempt it
    if (fp.id === 'FP-07' && filePathForScope.includes('constants.ts')) {
      continue;
    }
    // FP-25: replay-audit-writer.ts uses records.push(record) internally — exempt it
    if (fp.id === 'FP-25' && filePathForScope.includes('replay-audit-writer.ts')) {
      continue;
    }
    // FP-25: parity-scorer.ts is a pre-shadow module with its own append-only records — exempt it
    if (fp.id === 'FP-25' && filePathForScope.includes('parity-scorer.ts')) {
      continue;
    }
    // FP-18: entropy/runtime/ files are orchestration layer (not calculators) — Date.now() is permitted for timing
    if (fp.id === 'FP-18' && filePathForScope.includes('/entropy/runtime/')) {
      continue;
    }
    if (fp.scope === 'pre-and-verification' &&
        !filePathForScope.includes('/pre/') &&
        !filePathForScope.includes('/entropy/')) {
      continue;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      // Skip comment lines (rough check)
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      if (fp.pattern.test(line)) {
        violations.push({
          file:         filePath,
          line:         i + 1,
          pattern_id:   fp.id,
          severity:     fp.severity,
          description:  fp.description,
          matched_text: line.trim().slice(0, 120),
          remediation:  fp.remediation,
        });
      }
    }
  }

  return violations;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const scanAll = args.includes('--all');
  const pathArg = args.find(a => a.startsWith('--path='))?.split('=')[1];

  const scanPaths: string[] = [];
  if (scanAll) {
    scanPaths.push(join(ROOT, 'src'));
  } else if (pathArg) {
    scanPaths.push(join(ROOT, pathArg));
  } else {
    // Default: scan src/pre/ (highest-risk directory)
    scanPaths.push(join(ROOT, 'src', 'pre'));
  }

  const allFiles: string[] = [];
  for (const scanPath of scanPaths) {
    allFiles.push(...collectFiles(scanPath, ['.ts', '.js']));
  }

  const allViolations: Violation[] = [];

  for (const file of allFiles) {
    const relPath = relative(ROOT, file);
    const violations = scanFile(file, FORBIDDEN_PATTERNS, relPath);
    allViolations.push(...violations);
  }

  if (allViolations.length === 0) {
    console.log(`✓ Contract scan: no violations in ${allFiles.length} file(s)`);
    process.exit(0);
  }

  // Report violations
  const constitutional = allViolations.filter(v => v.severity === 'CONSTITUTIONAL_BREACH');
  const errors = allViolations.filter(v => v.severity === 'ERROR');
  const warnings = allViolations.filter(v => v.severity === 'WARNING');

  console.error('\n═══ CONSTITUTIONAL CONTRACT VIOLATIONS DETECTED ═══\n');

  for (const v of allViolations) {
    const rel = relative(ROOT, v.file);
    console.error(`[${v.severity}] ${v.pattern_id} — ${v.description}`);
    console.error(`  File: ${rel}:${v.line}`);
    console.error(`  Code: ${v.matched_text}`);
    console.error(`  Fix:  ${v.remediation}`);
    console.error('');
  }

  console.error(`Summary: ${constitutional.length} CONSTITUTIONAL_BREACH, ${errors.length} ERROR, ${warnings.length} WARNING`);
  console.error(`Total: ${allViolations.length} violation(s) in ${allFiles.length} file(s)`);

  if (constitutional.length > 0 || errors.length > 0) {
    console.error('\nBLOCKING: Constitutional breaches and errors must be fixed before merge.');
    process.exit(1);
  }

  // Warnings only — advisory, not blocking
  console.warn('\nADVISORY: Warnings detected. Not blocking, but should be addressed.');
  process.exit(0);
}

main();
