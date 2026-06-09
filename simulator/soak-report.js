#!/usr/bin/env node
'use strict';

// ClubHub TV — Soak Report Viewer
//
// Reads a soak report JSON file (or the latest one) and prints a human-readable
// summary with stability score, key metrics, and recommendations.
//
// Usage:
//   node simulator/soak-report.js                      # reads latest report
//   node simulator/soak-report.js soak-reports/report-2026-05-15T12-00-00.json
//   REPORT_DIR=soak-reports node simulator/soak-report.js
//
// Or via Makefile:
//   make soak-report

const fs   = require('fs');
const path = require('path');

const REPORT_DIR = process.env.REPORT_DIR || 'soak-reports';

// ── Find report file ──────────────────────────────────────────────────────────
function findReport() {
  const explicit = process.argv[2];
  if (explicit) {
    if (!fs.existsSync(explicit)) { console.error(`File not found: ${explicit}`); process.exit(1); }
    return explicit;
  }
  if (!fs.existsSync(REPORT_DIR)) {
    console.error(`No soak-reports directory found. Run: make soak-start`);
    process.exit(1);
  }
  const files = fs.readdirSync(REPORT_DIR)
    .filter(f => f.startsWith('report-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (!files.length) {
    console.error(`No report files in ${REPORT_DIR}/. Run a soak and wait for shutdown or GET /report.`);
    process.exit(1);
  }
  return path.join(REPORT_DIR, files[0]);
}

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const A = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m' };
const col = (s, ...codes) => codes.map(c => A[c] || c).join('') + s + A.reset;

// ── Score bar ─────────────────────────────────────────────────────────────────
function scoreBar(score) {
  const filled = Math.round(score / 5);
  const bar    = '█'.repeat(filled) + '░'.repeat(20 - filled);
  const color  = score >= 90 ? 'green' : score >= 70 ? 'yellow' : 'red';
  return col(`[${bar}]`, color) + col(` ${score.toFixed(1)}/100`, 'bold');
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderReport(report) {
  const s = report.summary;

  console.log('');
  console.log(col('═'.repeat(70), 'cyan'));
  console.log(col('  ClubHub TV — Soak Test Report', 'bold', 'cyan'));
  console.log(col('═'.repeat(70), 'cyan'));
  console.log('');
  console.log(`  Generated:    ${report.generated_at}`);
  console.log(`  Duration:     ${formatDuration(report.soak_duration_s)}`);
  console.log(`  Screens:      ${(report.screens || []).length}`);
  console.log('');

  // ── Stability score ─────────────────────────────────────────────────────────
  console.log(col('  Stability Score', 'bold'));
  console.log(`  ${scoreBar(report.stability_score)}`);
  console.log('');

  // ── Summary table ───────────────────────────────────────────────────────────
  console.log(col('  Key Metrics', 'bold'));
  const upColor = s.uptime_pct >= 99 ? 'green' : s.uptime_pct >= 95 ? 'yellow' : 'red';
  console.log(`  Uptime:                  ${col(`${s.uptime_pct}%`, upColor)}`);
  console.log(`  Total reboots:           ${col(s.total_reboots,         s.total_reboots  > 20 ? 'yellow' : 'dim')}`);
  console.log(`  Total recoveries:        ${col(s.total_recoveries,      'dim')}`);
  console.log(`  Avg recoveries/screen:   ${col(s.avg_recovery_per_screen, 'dim')}`);
  console.log(`  Stale manifest events:   ${col(s.stale_screen_incidents,  s.stale_screen_incidents > 5 ? 'yellow' : 'dim')}`);
  console.log(`  Checksum divergences:    ${col(s.divergence_count,        s.divergence_count > 0 ? 'red' : 'green')}`);
  console.log(`  Media failures:          ${col(s.media_failures,          s.media_failures > 10 ? 'yellow' : 'dim')}`);
  console.log(`  Memory growth:           ${col(`${s.memory_growth_mb}MB`, s.memory_growth_mb > 20 ? 'red' : s.memory_growth_mb > 5 ? 'yellow' : 'green')}`);
  console.log(`  p95 event loop lag:      ${col(`${s.p95_event_loop_lag_ms}ms`, s.p95_event_loop_lag_ms > 100 ? 'yellow' : 'green')}`);
  console.log(`  Faults injected:         ${col(s.faults_injected, 'dim')}`);
  if (s.ota_events) {
    console.log(`  OTA events:              ${col(s.ota_events, 'dim')}`);
    console.log(`  OTA success rate:        ${col(`${s.ota_success_rate_pct}%`, s.ota_success_rate_pct < 80 ? 'yellow' : 'green')}`);
  }
  console.log('');

  // ── Per-screen table ────────────────────────────────────────────────────────
  if (report.screens?.length) {
    console.log(col('  Per-Screen Summary', 'bold'));
    const hdr = '  ' +
      col('SCREEN'.padEnd(26), 'bold', 'dim') +
      col('STATUS'.padEnd(12), 'bold', 'dim') +
      col('VER'.padEnd(8), 'bold', 'dim') +
      col('POL%'.padEnd(7), 'bold', 'dim') +
      col('p95ms'.padEnd(7), 'bold', 'dim') +
      col('RBT'.padEnd(5), 'bold', 'dim') +
      col('STALE'.padEnd(7), 'bold', 'dim');
    console.log(hdr);
    console.log('  ' + '─'.repeat(68));
    for (const screen of report.screens) {
      const rateNum = parseFloat(screen.poll_success_rate);
      const rateStr = screen.poll_success_rate != null ? `${screen.poll_success_rate}%` : '—';
      const rateCol = rateNum < 90 ? 'yellow' : 'green';
      const p95     = screen.p95_latency_ms != null ? `${screen.p95_latency_ms}ms` : '—';
      const p95Col  = screen.p95_latency_ms > 1000 ? 'yellow' : 'dim';
      const rbtCol  = screen.reboot_count > 5 ? 'yellow' : 'dim';
      const staleCol = screen.stale_events > 0 ? 'yellow' : 'dim';
      console.log('  ' +
        String(screen.screen_id).padEnd(26) +
        String(screen.status || '—').padEnd(12) +
        String(screen.player_version || '—').padEnd(8) +
        col(rateStr.padEnd(7), rateCol) +
        col(p95.padEnd(7), p95Col) +
        col(String(screen.reboot_count ?? 0).padEnd(5), rbtCol) +
        col(String(screen.stale_events ?? 0).padEnd(7), staleCol)
      );
    }
    console.log('');
  }

  // ── Recent fault history ────────────────────────────────────────────────────
  if (report.fault_history?.length) {
    console.log(col('  Recent Fault Injections (last 10)', 'bold'));
    for (const f of report.fault_history.slice(-10)) {
      const ts = new Date(f.ts).toISOString().slice(11, 19);
      console.log(`  ${col(ts, 'dim')}  ${String(f.type).padEnd(20)} ${col(f.label, 'dim')}`);
    }
    console.log('');
  }

  // ── Recommendations ─────────────────────────────────────────────────────────
  console.log(col('  Recommendations', 'bold'));
  for (const rec of report.recommendations) {
    const isGood = rec.includes('nominal') || rec.includes('Ready');
    console.log(`  ${isGood ? col('✓', 'green') : col('!', 'yellow')}  ${rec}`);
  }
  console.log('');
  console.log(col('═'.repeat(70), 'dim'));
  console.log('');
}

function formatDuration(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const file = findReport();
console.log(col(`\n  Reading: ${file}`, 'dim'));
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
renderReport(report);
