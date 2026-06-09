#!/usr/bin/env node
'use strict';

// ClubHub TV — First-run bootstrap script
//
// Creates the initial venue, admin screen, and validates that the production
// environment is correctly configured before accepting real traffic.
//
// Usage (runs against a live backend):
//   BACKEND_URL=http://localhost:4000 node scripts/bootstrap.js
//
// Or via Makefile:
//   make bootstrap
//
// The script is idempotent — safe to re-run. It will report what already exists.

const BACKEND = process.env.BACKEND_URL || 'http://localhost:4000';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ok  = s => process.stdout.write(`  ✓  ${s}\n`);
const err = s => process.stdout.write(`  ✗  ${s}\n`);
const inf = s => process.stdout.write(`  →  ${s}\n`);
const hdr = s => process.stdout.write(`\n${s}\n${'─'.repeat(s.length)}\n`);

async function api(method, path, body) {
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

// ── Step 1: Environment checks ────────────────────────────────────────────────

async function checkEnvironment() {
  hdr('1. Environment checks');

  const checks = [
    ['DATABASE_URL',  process.env.DATABASE_URL,  'postgres connection string'],
    ['PORT',          process.env.PORT,           'backend port (optional, default 4000)'],
    ['UPLOAD_DIR',    process.env.UPLOAD_DIR,     'upload directory (optional)'],
    ['LOG_LEVEL',     process.env.LOG_LEVEL,      'log verbosity (optional, default INFO)'],
  ];

  for (const [key, val, desc] of checks) {
    if (val) {
      ok(`${key} = ${key.includes('PASS') || key.includes('KEY') ? '***' : val}`);
    } else {
      inf(`${key} not set (${desc})`);
    }
  }

  // Warn about insecure defaults
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes(':clubhub@') || dbUrl.includes(':clubhub:')) {
    err('DATABASE_URL uses default password "clubhub" — change before production use');
  }
  if (!process.env.SECRET_KEY || process.env.SECRET_KEY === 'change_me_in_production') {
    err('SECRET_KEY is not set or uses default value — generate with: openssl rand -hex 32');
  }
}

// ── Step 2: Backend connectivity ──────────────────────────────────────────────

async function checkBackend() {
  hdr('2. Backend connectivity');
  inf(`Target: ${BACKEND}`);

  const { ok: isOk, data } = await api('GET', '/health/ready');
  if (isOk) {
    ok(`Backend healthy — v${data.version}, uptime ${data.uptime_s}s`);
    ok(`DB: ${data.checks?.db?.status} (${data.checks?.db?.latency_ms}ms)`);
    ok(`Cache: ${data.checks?.manifest_cache?.status} (${data.checks?.manifest_cache?.cached_screens} screens cached)`);
    return true;
  }

  // Fall back to legacy /health
  const { ok: legacyOk, data: legacyData } = await api('GET', '/health');
  if (legacyOk) {
    ok(`Backend healthy (legacy endpoint)`);
    return true;
  }

  err(`Backend not reachable at ${BACKEND}`);
  err(`Start the backend first: make sim-start  OR  docker compose up -d`);
  return false;
}

// ── Step 3: First venue ───────────────────────────────────────────────────────

async function bootstrapVenue() {
  hdr('3. Venue setup');

  const { data: existing } = await api('GET', '/venues');
  const venues = Array.isArray(existing) ? existing : (existing.venues || []);

  if (venues.length > 0) {
    ok(`${venues.length} venue(s) already exist:`);
    for (const v of venues) inf(`  id=${v.id}  name="${v.name}"  tz=${v.timezone}`);
    return venues[0].id;
  }

  inf('No venues found — creating first venue...');
  const venueName = process.env.VENUE_NAME   || 'Pilot Venue 1';
  const venueId   = process.env.VENUE_ID     || 'venue-pilot-1';
  const timezone  = process.env.VENUE_TZ     || 'UTC';

  const { ok: created, data: venue } = await api('POST', '/venues', {
    id: venueId, name: venueName, timezone,
  });

  if (created) {
    ok(`Venue created: id=${venue.id}  name="${venue.name}"  tz=${venue.timezone}`);
    return venue.id;
  }

  err(`Failed to create venue: ${JSON.stringify(venue)}`);
  return null;
}

// ── Step 4: First screen registration ────────────────────────────────────────

async function bootstrapScreen(venueId) {
  hdr('4. Screen registration');

  const { data: existing } = await api('GET', `/screens?venue_id=${venueId}`);
  const screens = Array.isArray(existing) ? existing : (existing.screens || []);

  if (screens.length > 0) {
    ok(`${screens.length} screen(s) already registered for venue ${venueId}:`);
    for (const s of screens) inf(`  id=${s.id}  name="${s.name}"`);
    return;
  }

  inf('No screens found — registering first screen...');
  const screenId   = process.env.SCREEN_ID   || 'screen-pilot-01';
  const screenName = process.env.SCREEN_NAME || 'Pilot Screen 1';

  const { ok: created, data: screen } = await api('POST', '/screens', {
    id: screenId, venue_id: venueId, name: screenName,
  });

  if (created) {
    ok(`Screen registered: id=${screen.id}  name="${screen.name}"`);
    inf(`Pi URL: http://<backend_host>:4000/manifest?screen_id=${screen.id}`);
  } else {
    err(`Failed to register screen: ${JSON.stringify(screen)}`);
  }
}

// ── Step 5: Manifest smoke test ───────────────────────────────────────────────

async function smokeTestManifest(screenId) {
  hdr('5. Manifest smoke test');

  const id = screenId || 'screen-pilot-01';
  const { ok: isOk, data: manifest } = await api('GET', `/manifest?screen_id=${id}`);

  if (!isOk) {
    err(`Manifest fetch failed for screen ${id}`);
    return;
  }

  ok(`Manifest returned for screen ${id}`);
  ok(`  version=${manifest.version}  checksum=${manifest.checksum}  items=${manifest.items?.length ?? 0}`);
  if (manifest.items?.length === 0) {
    inf('No content scheduled — screen will show system fallback slide until content is added');
  }
}

// ── Step 6: Production readiness summary ──────────────────────────────────────

function printReadinessSummary() {
  hdr('6. Production readiness checklist');

  const checks = [
    ['Change default DB password',     'Use a strong random password in DATABASE_URL'],
    ['Set SECRET_KEY',                 'openssl rand -hex 32 > secret.txt'],
    ['Configure DOMAIN',               'Set your server domain in .env.production'],
    ['Enable HTTPS',                   'Caddy handles this automatically once DOMAIN is set'],
    ['Set up backups',                 'Run: make backup  (or cron: make backup-cron)'],
    ['Test restore procedure',         'Run: make restore BACKUP=<file> on a test DB'],
    ['Configure screen hardware',      'See: docs/PILOT-VENUE-CHECKLIST.md'],
    ['Register all screens',           'POST /screens before deploying Pis'],
    ['Seed fallback content',          'Screens should always have a fallback schedule'],
    ['Test offline recovery',          'Run: make test-chaos to validate resilience'],
    ['Set up monitoring',              'Poll /health/ready from your monitoring tool'],
    ['Configure log rotation',         'Docker json-file driver is pre-configured'],
  ];

  for (const [task, note] of checks) {
    process.stdout.write(`  [ ]  ${task}\n       ${note}\n`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  process.stdout.write('\nClubHub TV — Bootstrap\n');
  process.stdout.write('======================\n');

  await checkEnvironment();

  const backendOk = await checkBackend();
  if (!backendOk) {
    process.stdout.write('\nAbort: backend must be running before bootstrap.\n\n');
    process.exit(1);
  }

  const venueId = await bootstrapVenue();
  if (venueId) {
    await bootstrapScreen(venueId);
    await smokeTestManifest();
  }

  printReadinessSummary();

  process.stdout.write('\nBootstrap complete.\n\n');
})().catch(e => {
  err(`Unexpected error: ${e.message}`);
  process.exit(1);
});
