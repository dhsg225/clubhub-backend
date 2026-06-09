#!/usr/bin/env node
'use strict';

// ClubHub TV — Fleet Status Terminal Dashboard
//
// Queries the soak (port 3200) or fake-pi fleet (port 3100) management API
// and renders a live ANSI terminal table. Refreshes every REFRESH_S seconds.
//
// Usage:
//   node simulator/fleet-dashboard.js              # soak environment on :3200
//   STATUS_URL=http://localhost:3100 node simulator/fleet-dashboard.js
//   REFRESH_S=5 node simulator/fleet-dashboard.js

const http = require('http');

const STATUS_URL  = process.env.STATUS_URL  || 'http://localhost:3200';
const REFRESH_S   = parseInt(process.env.REFRESH_S || '3', 10);

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const A = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  bgRed:   '\x1b[41m',
  bgGreen: '\x1b[42m',
  clear:   '\x1b[2J\x1b[H',
  up:      n => `\x1b[${n}A`,
};

function col(text, ...codes) {
  return codes.map(c => A[c] || c).join('') + text + A.reset;
}

function pad(s, n, right = false) {
  const str = String(s ?? '—');
  if (right) return str.slice(0, n).padStart(n);
  return str.slice(0, n).padEnd(n);
}

// ── HTTP fetch (no external deps) ────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 4000 }, res => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { reject(new Error('invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── Status colour ─────────────────────────────────────────────────────────────
function statusColor(status) {
  switch (status) {
    case 'online':    return col(pad(status, 10), 'green');
    case 'empty':     return col(pad(status, 10), 'yellow');
    case 'degraded':  return col(pad(status, 10), 'yellow', 'bold');
    case 'offline':   return col(pad(status, 10), 'red', 'bold');
    case 'rebooting': return col(pad(status, 10), 'cyan');
    case 'booting':   return col(pad(status, 10), 'blue');
    default:          return col(pad(status, 10), 'dim');
  }
}

function networkColor(condition) {
  switch (condition) {
    case 'nominal':          return col(pad(condition, 16), 'green');
    case 'degraded':         return col(pad(condition, 16), 'yellow');
    case 'slow':             return col(pad(condition, 16), 'yellow');
    case 'offline':          return col(pad(condition, 16), 'red', 'bold');
    case 'dns_fail':         return col(pad(condition, 16), 'red');
    case 'captive_portal':   return col(pad(condition, 16), 'red');
    case 'high_packet_loss': return col(pad(condition, 16), 'yellow', 'bold');
    default:                 return pad(condition, 16);
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
let renderCount = 0;

async function render() {
  let data;
  try {
    data = await httpGet(`${STATUS_URL}/status`);
  } catch (e) {
    process.stdout.write(A.clear);
    process.stdout.write(col(`ClubHub TV — Fleet Dashboard\n`, 'bold', 'cyan'));
    process.stdout.write(col(`  ✗ Cannot reach ${STATUS_URL}/status: ${e.message}\n`, 'red'));
    process.stdout.write(col(`  Start the soak environment:  make soak-start\n`, 'dim'));
    process.stdout.write(col(`  Or the sim fleet:            make sim-start\n\n`, 'dim'));
    return;
  }

  renderCount++;
  const screens = data.screens || [];
  const now = new Date().toLocaleTimeString();

  process.stdout.write(A.clear);

  // ── Header ─────────────────────────────────────────────────────────────────
  process.stdout.write(col('ClubHub TV — Fleet Dashboard', 'bold', 'cyan') + col(`  (refresh #${renderCount}, ${now})`, 'dim') + '\n');
  process.stdout.write('─'.repeat(100) + '\n');

  // ── Global status ──────────────────────────────────────────────────────────
  if (data.soak_running_s !== undefined) {
    // Soak environment
    const uptimeFmt = formatDuration(data.soak_running_s);
    const net       = networkColor(data.network_condition || 'nominal');
    const ota       = data.ota?.active
      ? col(`▲ OTA ${data.ota.version} @ ${data.ota.pct}%`, 'yellow', 'bold')
      : col('no OTA active', 'dim');

    process.stdout.write(`${col('SOAK', 'bold')}  uptime=${col(uptimeFmt, 'cyan')}  net=${net}  ${ota}`);

    if (data.process) {
      const { rss_mb, heap_used_mb, event_loop_lag_ms } = data.process;
      const lagColor = event_loop_lag_ms > 50 ? 'yellow' : 'green';
      process.stdout.write(`  mem=${col(`${heap_used_mb}/${rss_mb}MB`, 'dim')}  lag=${col(`${event_loop_lag_ms}ms`, lagColor)}`);
    }
    process.stdout.write('\n');
  }

  // ── By-status summary bar ──────────────────────────────────────────────────
  const byStatus = screens.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});
  const summaryParts = Object.entries(byStatus).map(([s, n]) => statusColor(s).trimEnd() + col(` ×${n}`, 'bold'));
  process.stdout.write('Screens: ' + summaryParts.join('  ') + '\n');
  process.stdout.write('─'.repeat(100) + '\n');

  // ── Column headers ─────────────────────────────────────────────────────────
  process.stdout.write(
    col(
      pad('SCREEN ID', 24) +
      pad('STATUS', 12) +
      pad('VERSION', 8) +
      pad('CHECKSUM', 12) +
      pad('LAST OK', 10) +
      pad('UPTIME', 12) +
      pad('POL%', 6) +
      pad('p95ms', 7) +
      pad('RBT', 5) +
      pad('RCV', 5) +
      pad('STALE', 6) +
      pad('ITEMS', 6),
      'bold', 'dim'
    ) + '\n'
  );
  process.stdout.write('─'.repeat(100) + '\n');

  // ── Screen rows ────────────────────────────────────────────────────────────
  for (const s of screens) {
    const lastOk = s.last_success_ago_s != null
      ? (s.last_success_ago_s < 60
          ? col(`${s.last_success_ago_s}s`, s.last_success_ago_s > 30 ? 'yellow' : 'green')
          : col(`${Math.round(s.last_success_ago_s / 60)}m`, 'red', 'bold'))
      : col('never', 'red');

    const rate = s.poll_success_rate != null
      ? col(pad(`${s.poll_success_rate}%`, 6), parseFloat(s.poll_success_rate) < 90 ? 'yellow' : 'green')
      : col(pad('—', 6), 'dim');

    const p95 = s.p95_latency_ms != null
      ? col(pad(s.p95_latency_ms, 7), s.p95_latency_ms > 1000 ? 'yellow' : 'dim')
      : col(pad('—', 7), 'dim');

    const checksum = s.last_checksum
      ? col(pad(s.last_checksum.slice(0, 10), 12), 'dim')
      : col(pad('—', 12), 'dim');

    const stale = s.stale_events > 0 ? col(pad(s.stale_events, 6), 'yellow') : col(pad(s.stale_events ?? 0, 6), 'dim');
    const rbt   = s.reboot_count  > 0 ? col(pad(s.reboot_count, 5), 'yellow') : col(pad(s.reboot_count ?? 0, 5), 'dim');
    const rcv   = s.recovery_count > 0 ? col(pad(s.recovery_count, 5), 'cyan') : col(pad(s.recovery_count ?? 0, 5), 'dim');

    process.stdout.write(
      pad(s.screen_id, 24) +
      statusColor(s.status) + '  ' +
      col(pad(s.player_version || s.last_version || '—', 8), 'dim') +
      checksum +
      pad('', 2) + lastOk + pad('', 4) +
      col(pad(formatDuration(s.uptime_s), 12), 'dim') +
      rate + p95 + rbt + rcv + stale +
      col(pad(s.cache_items ?? s.items ?? '—', 6), 'dim') +
      '\n'
    );
  }

  process.stdout.write('─'.repeat(100) + '\n');
  process.stdout.write(col(`  q  quit    r  force refresh    Polling: ${STATUS_URL}  every ${REFRESH_S}s\n`, 'dim'));
}

function formatDuration(s) {
  if (s == null) return '—';
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

// ── Input handling ────────────────────────────────────────────────────────────
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', key => {
    if (key[0] === 3 || key.toString() === 'q') { // Ctrl+C or q
      process.stdout.write(A.clear);
      process.exit(0);
    }
    if (key.toString() === 'r') render().catch(() => {});
  });
}

// ── Main loop ─────────────────────────────────────────────────────────────────
render().catch(() => {});
setInterval(() => render().catch(() => {}), REFRESH_S * 1000);
