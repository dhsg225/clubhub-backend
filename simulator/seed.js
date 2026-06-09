#!/usr/bin/env node
'use strict';

/**
 * ClubHub TV — Simulation Seed Script
 *
 * Creates a realistic set of test data for local simulation:
 *   - 2 venues (with different timezones)
 *   - Up to 20 screens (split across venues and groups)
 *   - 6 content items (various promo slides)
 *   - Multiple schedule types:
 *       · Always-on venue-wide promo
 *       · Screen-group specific content
 *       · Time-windowed happy hour
 *       · Fallback slides per venue
 *       · Future-dated inactive schedule
 *       · Screen-specific override
 *
 * Usage:
 *   node seed.js
 *   BACKEND_URL=http://localhost:4000 SCREEN_COUNT=10 node seed.js
 *   node seed.js --reset     (deletes all existing sim data first)
 */

const BACKEND      = process.env.BACKEND_URL  || 'http://localhost:4000';
const SCREEN_COUNT = parseInt(process.env.SCREEN_COUNT || '5', 10);

const args  = process.argv.slice(2);
const RESET = args.includes('--reset');

const FETCH_TIMEOUT_MS = 8_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write(`[seed] ${msg}\n`);
}

async function api(method, path, body) {
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body:    body ? JSON.stringify(body) : undefined,
    signal:  AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok && res.status !== 409) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }

  return { status: res.status, data };
}

// ── Venues ───────────────────────────────────────────────────────────────────

const VENUES = [
  { id: 'venue-1', name: 'Default Venue',    timezone: 'UTC' },
  { id: 'venue-sim-bar', name: 'The Sim Bar', timezone: 'Australia/Sydney' },
];

async function seedVenues() {
  log('Seeding venues...');
  for (const v of VENUES) {
    try {
      const { status } = await api('POST', '/venues', v);
      const action = status === 409 ? 'exists' : 'created';
      log(`  venue ${v.id} (${v.timezone}) → ${action}`);
    } catch (err) {
      // venue-1 may already exist from auto-registration — try PATCH to update
      try {
        await api('PATCH', `/venues/${v.id}`, { name: v.name, timezone: v.timezone });
        log(`  venue ${v.id} → updated`);
      } catch {
        log(`  venue ${v.id} → skipped (${err.message})`);
      }
    }
  }
}

// ── Screens ───────────────────────────────────────────────────────────────────
//
// Screen layout:
//   sim-screen-01..05  → venue-1,        group: bar-floor
//   sim-screen-06..10  → venue-1,        group: restaurant
//   sim-screen-11..15  → venue-sim-bar,  group: bar-floor
//   sim-screen-16..20  → venue-sim-bar,  group: entrance
//
// This gives us content targeting scenarios:
//   · Screen-specific: sim-screen-01 only
//   · Group-specific:  bar-floor (all screens in group across venues)
//   · Venue-wide:      all screens in venue-1 or venue-sim-bar
//   · All:             create content for each venue separately

function screenSpec(i) {
  if (i <=  5) return { venue_id: 'venue-1',       screen_group: 'bar-floor'  };
  if (i <= 10) return { venue_id: 'venue-1',       screen_group: 'restaurant' };
  if (i <= 15) return { venue_id: 'venue-sim-bar', screen_group: 'bar-floor'  };
  return           { venue_id: 'venue-sim-bar', screen_group: 'entrance'   };
}

async function seedScreens() {
  log(`Seeding ${SCREEN_COUNT} screens...`);
  for (let i = 1; i <= Math.max(SCREEN_COUNT, 5); i++) {
    const id   = `sim-screen-${String(i).padStart(2, '0')}`;
    const spec = screenSpec(i);
    try {
      const { status } = await api('POST', '/screens', {
        id,
        name:         `Simulator Screen ${String(i).padStart(2, '0')}`,
        ...spec,
      });
      const action = status === 409 ? 'exists' : 'created';
      log(`  ${id} → ${action} [${spec.venue_id} / ${spec.screen_group}]`);
    } catch (err) {
      log(`  ${id} → skipped (${err.message})`);
    }
  }
}

// ── Content ───────────────────────────────────────────────────────────────────

const CONTENT_ITEMS = [
  {
    _tag: 'always-on-promo',
    template_type: 'promo_slide',
    data: {
      headline:    'Welcome to the Venue',
      subheadline: 'Enjoy great food, drinks, and company',
    },
  },
  {
    _tag: 'happy-hour',
    template_type: 'promo_slide',
    data: {
      headline:    'Happy Hour',
      subheadline: 'All drinks 2-for-1 — 5pm to 7pm, Mon–Fri',
    },
  },
  {
    _tag: 'weekend-special',
    template_type: 'promo_slide',
    data: {
      headline:    'Weekend Brunch Special',
      subheadline: 'Full menu from 10am. Bottomless mimosas available.',
    },
  },
  {
    _tag: 'bar-floor',
    template_type: 'promo_slide',
    data: {
      headline:    'Try Our Signature Cocktails',
      subheadline: 'Ask your bartender for tonight\'s specials',
    },
  },
  {
    _tag: 'restaurant',
    template_type: 'promo_slide',
    data: {
      headline:    'Kitchen Open Until 10pm',
      subheadline: 'Full a la carte menu — dietary options available',
    },
  },
  {
    _tag: 'fallback',
    template_type: 'promo_slide',
    data: {
      headline:    'ClubHub TV',
      subheadline: 'Digital signage by ClubHub',
    },
  },
  {
    _tag: 'future-inactive',
    template_type: 'promo_slide',
    data: {
      headline:    'Coming Soon',
      subheadline: 'New menu launching next month',
    },
  },
];

async function seedContent() {
  log('Seeding content...');
  const ids = {};
  for (const item of CONTENT_ITEMS) {
    const { _tag, ...payload } = item;
    const { data } = await api('POST', '/content', payload);
    ids[_tag] = data.id;
    log(`  content[${_tag}] → ${data.id}`);
  }
  return ids;
}

// ── Schedules ─────────────────────────────────────────────────────────────────

async function seedSchedules(contentIds) {
  log('Seeding schedules...');

  const sched = async (tag, body) => {
    try {
      const { data } = await api('POST', '/schedules', body);
      log(`  schedule[${tag}] → ${data.id}`);
    } catch (err) {
      log(`  schedule[${tag}] → FAILED: ${err.message}`);
    }
  };

  // 1. Always-on venue-wide promo for venue-1 (lowest base priority)
  await sched('always-on/venue-1', {
    content_id: contentIds['always-on-promo'],
    venue_id:   'venue-1',
    priority:   5,
    duration:   12,
    is_fallback: false,
  });

  // 2. Always-on venue-wide promo for venue-sim-bar
  await sched('always-on/venue-sim-bar', {
    content_id: contentIds['always-on-promo'],
    venue_id:   'venue-sim-bar',
    priority:   5,
    duration:   12,
    is_fallback: false,
  });

  // 3. Bar-floor group content (targets bar-floor screens via screen_group)
  //    Note: screen_group schedules require venue_id per current schema
  //    We use screen-specific schedules for the first bar-floor screen instead
  if (SCREEN_COUNT >= 1) {
    await sched('bar-floor/screen-01', {
      content_id: contentIds['bar-floor'],
      screen_id:  'sim-screen-01',
      priority:   15,
      duration:   10,
      is_fallback: false,
    });
  }

  // 4. Restaurant group: target via screen-specific schedules for screens 06–10
  for (let i = 6; i <= Math.min(SCREEN_COUNT, 10); i++) {
    const screenId = `sim-screen-${String(i).padStart(2, '0')}`;
    await sched(`restaurant/${screenId}`, {
      content_id: contentIds['restaurant'],
      screen_id:  screenId,
      priority:   15,
      duration:   10,
      is_fallback: false,
    });
  }

  // 5. Happy hour: venue-1, time-windowed 17:00–19:00 Monday–Friday
  //    Uses current UTC as base; the schedule filter matches when actually in window
  await sched('happy-hour/venue-1', {
    content_id:        contentIds['happy-hour'],
    venue_id:          'venue-1',
    priority:          20,
    duration:          8,
    is_fallback:       false,
    time_of_day_start: '17:00',
    time_of_day_end:   '19:00',
    days_of_week:      [1, 2, 3, 4, 5],  // Mon–Fri
  });

  // 6. Future-dated schedule (should never appear in manifest right now)
  //    Useful for testing "scheduled" lifecycle status and starts_at filtering
  const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // +7 days
  const futureEnd   = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(); // +8 days
  if (SCREEN_COUNT >= 1) {
    await sched('future-inactive/screen-01', {
      content_id: contentIds['future-inactive'],
      screen_id:  'sim-screen-01',
      priority:   50,
      duration:   10,
      is_fallback: false,
      starts_at:  futureStart,
      ends_at:    futureEnd,
    });
  }

  // 7. Fallback slides (is_fallback: true) — promoted when no active scheduled content
  await sched('fallback/venue-1', {
    content_id:  contentIds['fallback'],
    venue_id:    'venue-1',
    priority:    1,
    duration:    15,
    is_fallback: true,
  });

  await sched('fallback/venue-sim-bar', {
    content_id:  contentIds['fallback'],
    venue_id:    'venue-sim-bar',
    priority:    1,
    duration:    15,
    is_fallback: true,
  });
}

// ── Verify ───────────────────────────────────────────────────────────────────

async function verifyManifests() {
  log('\nVerifying manifests...');
  const screens = ['sim-screen-01', 'sim-screen-06', 'sim-screen-11'];

  for (const screenId of screens) {
    try {
      const { data } = await api('GET', `/manifest?screen_id=${screenId}`);
      log(`  ${screenId}: v${data.version} cs=${data.checksum} items=${data.items.length} fallback_items=${data.fallback_items?.length ?? 0}`);
      for (const item of data.items) {
        log(`    · [${item.source}] p${item.priority ?? '-'} "${item.data?.headline}" (${item.duration}s)`);
      }
    } catch (err) {
      log(`  ${screenId}: ERROR — ${err.message}`);
    }
  }
}

// ── Reset ─────────────────────────────────────────────────────────────────────

async function resetSimData() {
  log('Resetting simulation data...');

  // Delete all content (cascades to schedules + busts caches)
  try {
    const { data: items } = await api('GET', '/content');
    if (Array.isArray(items)) {
      for (const item of items) {
        try {
          await api('DELETE', `/content/${item.id}`);
          log(`  deleted content ${item.id}`);
        } catch (err) {
          log(`  failed to delete content ${item.id}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    log(`  reset failed: ${err.message}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log(`ClubHub TV Simulation Seed`);
  log(`Backend: ${BACKEND}`);
  log(`Screens: ${SCREEN_COUNT}`);
  log(`Reset:   ${RESET}`);
  log('');

  // Health check first
  try {
    const { data } = await api('GET', '/health');
    if (data.status !== 'ok') throw new Error('backend not healthy');
    log(`Backend healthy. DB: ${data.db}`);
  } catch (err) {
    log(`ERROR: Backend unreachable — ${err.message}`);
    log(`Make sure the backend is running: docker compose up  (or: cd backend && npm run dev)`);
    process.exit(1);
  }

  if (RESET) await resetSimData();

  await seedVenues();
  await seedScreens();
  const contentIds = await seedContent();
  await seedSchedules(contentIds);
  await verifyManifests();

  log('\nSeed complete.');
  log(`Run 'make sim-start' or 'node fake-pi.js' to start the fleet.`);
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
