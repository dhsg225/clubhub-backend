#!/usr/bin/env node
'use strict';

/**
 * ClubHub TV — Simulation Log Formatter
 *
 * Reads JSON log lines from stdin and prints colorized, human-readable output.
 *
 * Usage:
 *   docker logs -f clubhub-fake-pi-fleet-1 | node watch.js
 *   docker compose -f docker-compose.dev-sim.yml logs -f fake-pi-fleet | node watch.js
 *   node fake-pi.js | node watch.js
 *
 * Flags:
 *   --only-changes    Only show manifest_changed events (reduces noise)
 *   --only-failures   Only show poll.failure and fleet.stats
 *   --screen SCREEN   Filter to a specific screen_id
 */

const readline = require('readline');

const args = process.argv.slice(2);
const ONLY_CHANGES  = args.includes('--only-changes');
const ONLY_FAILURES = args.includes('--only-failures');
const FILTER_SCREEN = (() => {
  const i = args.indexOf('--screen');
  return i !== -1 ? args[i + 1] : null;
})();

// ── ANSI colour helpers ──────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  blue:    '\x1b[34m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
};

function c(color, str) {
  return `${C[color]}${str}${C.reset}`;
}

function pad(str, len) {
  return String(str).padEnd(len, ' ');
}

function fmtTime(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toTimeString().slice(0, 8);
  } catch {
    return isoStr;
  }
}

function fmtMs(ms) {
  if (ms == null) return '—';
  if (ms < 1000)  return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusBadge(status) {
  switch (status) {
    case 'live':       return c('green',   '● LIVE    ');
    case 'offline':    return c('red',     '✖ OFFLINE ');
    case 'empty':      return c('yellow',  '○ EMPTY   ');
    case 'booting':    return c('cyan',    '↑ BOOTING ');
    case 'rebooting':  return c('magenta', '↻ REBOOT  ');
    case 'recovering': return c('yellow',  '~ RECOVER ');
    default:           return c('gray',    '? UNKNOWN ');
  }
}

// ── Event formatters ─────────────────────────────────────────────────────────

function formatPollSuccess(obj) {
  const screen  = c('cyan',  pad(obj.screen, 20));
  const badge   = statusBadge(obj.status);
  const ver     = c('white', `v${obj.version}`);
  const cs      = c('gray',  obj.checksum ? obj.checksum.slice(0, 8) : '--------');
  const items   = c('white', `${obj.items}i`);
  const fb      = obj.fallback_items > 0 ? c('yellow', `+${obj.fallback_items}fb`) : c('gray', '');
  const dur     = c('gray',  fmtMs(obj.duration_ms));
  const sources = (obj.sources || []).join(',');
  const src     = sources.includes('system')   ? c('gray',   `[${sources}]`) :
                  sources.includes('fallback')  ? c('yellow', `[${sources}]`) :
                                                  c('green',  `[${sources}]`);
  const changed = obj.manifest_changed
    ? c('yellow', ' ⚡CHANGED')
    : '';

  return `${fmtTime(obj.ts)} ${badge} ${screen} ${ver} ${cs} ${items}${fb} ${src} ${dur}${changed}`;
}

function formatPollFailure(obj) {
  const screen  = c('cyan',    pad(obj.screen, 20));
  const badge   = statusBadge('offline');
  const streak  = obj.offline_streak > 1
    ? c('red', ` streak:${obj.offline_streak}`)
    : '';
  const cache   = obj.playing_from_cache
    ? c('yellow', ` [cache:v${obj.cache_version}]`)
    : c('red',    ' [no cache]');
  const err     = c('red', obj.error || 'unknown error');

  return `${fmtTime(obj.ts)} ${badge} ${screen} ${err}${streak}${cache}`;
}

function formatPollOffline(obj) {
  const screen = c('cyan', pad(obj.screen, 20));
  const badge  = statusBadge('offline');
  const streak = c('red', `streak:${obj.offline_streak}`);
  const cache  = obj.cache_has_manifest
    ? c('yellow', ` [cache:v${obj.cache_version}]`)
    : c('red',    ' [no cache]');

  return `${fmtTime(obj.ts)} ${badge} ${screen} forced_offline ${streak}${cache}`;
}

function formatFleetStats(obj) {
  const lines = [];
  const bar   = '─'.repeat(70);

  lines.push(c('gray', bar));
  lines.push(`${fmtTime(obj.ts)} ${c('bold', 'FLEET STATS')} — ${c('white', obj.total)} screens`);

  const bs = obj.by_status || {};
  const parts = [];
  if (bs.live)       parts.push(c('green',   `${bs.live} live`));
  if (bs.offline)    parts.push(c('red',     `${bs.offline} offline`));
  if (bs.empty)      parts.push(c('yellow',  `${bs.empty} empty`));
  if (bs.booting)    parts.push(c('cyan',    `${bs.booting} booting`));
  if (bs.rebooting)  parts.push(c('magenta', `${bs.rebooting} rebooting`));
  if (bs.recovering) parts.push(c('yellow',  `${bs.recovering} recovering`));
  lines.push(`  Status: ${parts.join(', ')}`);

  if (obj.screens) {
    lines.push('');
    for (const s of obj.screens) {
      const id     = c('cyan', pad(s.screen_id, 20));
      const badge  = statusBadge(s.status);
      const polls  = c('gray',  `${s.poll_count}p`);
      const ok     = c('green', `${s.success_count}ok`);
      const fail   = s.failure_count > 0 ? c('red', `${s.failure_count}fail`) : c('gray', '0fail');
      const vc     = s.version_changes > 0 ? c('yellow', ` ${s.version_changes}vc`) : '';
      const ver    = s.last_version != null ? c('white', ` v${s.last_version}`) : '';
      const cs     = s.last_checksum ? c('gray', ` ${s.last_checksum.slice(0, 8)}`) : '';
      const ago    = s.last_ok_ago_s != null ? c('gray', ` ${s.last_ok_ago_s}s ago`) : '';

      lines.push(`  ${badge} ${id} ${polls} ${ok} ${fail}${vc}${ver}${cs}${ago}`);
    }
  }

  lines.push(c('gray', bar));
  return lines.join('\n');
}

function formatBoot(obj) {
  const screen = c('cyan', pad(obj.screen, 20));
  return `${fmtTime(obj.ts)} ${statusBadge('booting')} ${screen} booting → ${obj.backend}`;
}

function formatFleetStart(obj) {
  const lines = [
    '',
    c('bold', '╔══════════════════════════════════════════╗'),
    c('bold', '║  ClubHub TV — Fake Pi Fleet Simulator    ║'),
    c('bold', '╚══════════════════════════════════════════╝'),
    `  Screens:  ${c('white', obj.screen_count)}`,
    `  Backend:  ${c('white', obj.backend)}`,
    `  Venue:    ${c('white', obj.venue)}`,
    `  Poll:     ${c('white', obj.poll_interval)} (jitter: ${obj.jitter})`,
    `  Reboot:   ${c('white', `${(obj.reboot_prob * 100).toFixed(2)}% per poll`)}`,
    `  Screens:  ${c('gray', (obj.screens || []).join(', '))}`,
    '',
  ];
  return lines.join('\n');
}

function formatReboot(obj) {
  const screen = c('cyan', pad(obj.screen, 20));
  const badge  = statusBadge(obj.event === 'reboot.start' ? 'rebooting' : 'booting');
  const suffix = obj.event === 'reboot.start'
    ? c('yellow', `(was v${obj.prev_version}, ${obj.polls_before_reboot} polls)`)
    : c('green',  'back online');
  return `${fmtTime(obj.ts)} ${badge} ${screen} ${obj.event.toUpperCase()} ${suffix}`;
}

function formatOffline(obj) {
  const screen = c('cyan', pad(obj.screen, 20));
  const badge  = statusBadge('offline');
  const suffix = obj.event === 'offline.forced'
    ? c('yellow', `forced offline for ${fmtMs(obj.duration_ms)}`)
    : c('green',  'coming back online');
  return `${fmtTime(obj.ts)} ${badge} ${screen} ${suffix}`;
}

function formatMgmtApi(obj) {
  return `${fmtTime(obj.ts)} ${c('blue', '⚙ MGMT API')} ready on :${obj.port}`;
}

function formatGeneric(obj) {
  const screen = obj.screen ? `${c('cyan', pad(obj.screen, 20))} ` : '';
  const event  = c('gray', obj.event || 'unknown');
  return `${fmtTime(obj.ts)} ${screen}${event} ${c('gray', JSON.stringify(obj).slice(0, 120))}`;
}

// ── Routing ───────────────────────────────────────────────────────────────────

function format(obj) {
  const event = obj.event || '';

  // Apply filters
  if (FILTER_SCREEN && obj.screen && obj.screen !== FILTER_SCREEN) return null;
  if (ONLY_FAILURES && event !== 'poll.failure' && event !== 'fleet.stats') return null;
  if (ONLY_CHANGES  && event !== 'poll.success') return null;
  if (ONLY_CHANGES  && !obj.manifest_changed) return null;

  switch (event) {
    case 'fleet.start':        return formatFleetStart(obj);
    case 'fleet.stats':        return formatFleetStats(obj);
    case 'boot':               return formatBoot(obj);
    case 'poll.success':       return formatPollSuccess(obj);
    case 'poll.failure':       return formatPollFailure(obj);
    case 'poll.offline':       return formatPollOffline(obj);
    case 'reboot.start':
    case 'reboot.complete':    return formatReboot(obj);
    case 'offline.forced':
    case 'offline.end':        return formatOffline(obj);
    case 'management.api.ready': return formatMgmtApi(obj);
    case 'fleet.shutdown':     return `${fmtTime(obj.ts)} ${c('red', '■ SHUTDOWN')} signal=${obj.signal}`;
    case 'fleet.stats':        return formatFleetStats(obj);
    default:                   return formatGeneric(obj);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let obj;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    // Not JSON — pass through as-is (e.g., npm start prefix lines)
    process.stdout.write(c('gray', trimmed) + '\n');
    return;
  }

  const formatted = format(obj);
  if (formatted != null) {
    process.stdout.write(formatted + '\n');
  }
});

rl.on('close', () => {
  process.stdout.write(c('gray', '\n[watch] stream ended\n'));
});
