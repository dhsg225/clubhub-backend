'use strict';

const { pool }        = require('../db');
const fleetConsensus  = require('./fleet-consensus');

// ─── Cache TTL ─────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5_000; // serve cached manifest for up to 5 seconds

// ─── Checksum (FNV-1a, no deps) ────────────────────────────────────────────
function checksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h >>>= 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ─── Schedule time-window evaluation ───────────────────────────────────────
// FIX-2: Two distinct clocks are required:
//
//   utcNow   — real UTC (new Date()), for comparing against TIMESTAMPTZ columns
//              starts_at / ends_at. These are stored as UTC by Postgres, so the
//              comparison must also be UTC.
//
//   localNow — venue local time, passed in from the caller. Used ONLY for
//              day-of-week and intra-day time window checks.
//
// Why localNow uses .getUTC*() accessors:
//   Postgres `NOW() AT TIME ZONE 'Asia/Kolkata'` returns a timestamp WITHOUT a
//   timezone suffix, e.g. "2024-01-15 15:30:00". When Node.js wraps this with
//   `new Date("2024-01-15 15:30:00")`, V8 treats the string as UTC (no TZ suffix
//   → interpreted as UTC per the spec). So the venue-local clock value lands in
//   the UTC slots of the Date object. Therefore:
//     localNow.getUTCHours()  → correct venue-local hour
//     localNow.getUTCDay()    → correct venue-local day of week
//     localNow.getHours()     → WRONG (returns server's TZ hours)
function scheduleActive(sched, localNow) {
  const utcNow = new Date(); // real UTC — do NOT use localNow for absolute timestamps

  // Absolute window: starts_at/ends_at are TIMESTAMPTZ → compare against real UTC
  if (sched.starts_at && utcNow < new Date(sched.starts_at)) return false;
  if (sched.ends_at   && utcNow >= new Date(sched.ends_at))  return false;

  // Day-of-week filter (0=Sun … 6=Sat)
  // getUTCDay() reads venue-local day because localNow was built from a TZ-stripped string
  if (sched.days_of_week && sched.days_of_week.length > 0) {
    // Defensive: silently ignore out-of-range values (e.g. days_of_week:[7] from a bad API call)
    const validDays = sched.days_of_week.filter(d => Number.isInteger(d) && d >= 0 && d <= 6);
    if (validDays.length > 0 && !validDays.includes(localNow.getUTCDay())) return false;
  }

  // Intra-day time window (HH:MM string comparison)
  // Both bounds must be present — a one-sided constraint is skipped (defensive)
  if (sched.time_of_day_start && sched.time_of_day_end) {
    // getUTCHours/Minutes read venue-local time (see comment above)
    const hh   = String(localNow.getUTCHours()).padStart(2, '0');
    const mm   = String(localNow.getUTCMinutes()).padStart(2, '0');
    const hhmm = `${hh}:${mm}`;
    if (hhmm <  sched.time_of_day_start) return false;
    if (hhmm >= sched.time_of_day_end)   return false;
  }

  return true;
}

// ─── Compute manifest for a screen ─────────────────────────────────────────
async function computeManifest(screenId) {
  const t0 = Date.now(); // timing — logged before return
  // 1. Resolve screen → venue → timezone
  const sRes = await pool.query(
    `SELECT s.id, s.venue_id, s.screen_group, s.name AS screen_name,
            s.tenant_id,
            v.timezone, v.name AS venue_name
     FROM   screens s
     JOIN   venues  v ON v.id = s.venue_id
     WHERE  s.id = $1`,
    [screenId]
  );

  let screen;
  if (!sRes.rows.length) {
    // CRIT-2: Auto-register unknown screens for backward compatibility, but first
    // ensure the default venue exists. The original code assumed 'venue-1' was always
    // present; on a fresh DB or after accidental deletion it threw a FK violation (23503)
    // that crashed every manifest request for the unknown screen.
    //
    // Both INSERTs use ON CONFLICT DO NOTHING — safe to run concurrently and idempotently.
    // The venue upsert runs first so the FK is satisfied before the screen row lands.
    //
    // NOTE: Auto-registration to 'venue-1' is a compatibility shim only. For production,
    // pre-create screens via POST /screens with the correct venue_id. A screen registered
    // here will use UTC scheduling and show under 'Default Venue' in Studio until corrected.
    await pool.query(
      `INSERT INTO venues (id, name, timezone, tenant_id)
       VALUES ('venue-1', 'Default Venue', 'UTC', (SELECT id FROM tenants WHERE slug='default' LIMIT 1))
       ON CONFLICT (id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO screens (id, venue_id, name, tenant_id)
       VALUES ($1, 'venue-1', $1, (SELECT id FROM tenants WHERE slug='default' LIMIT 1))
       ON CONFLICT (id) DO NOTHING`,
      [screenId]
    );
    console.warn(JSON.stringify({
      ts: new Date().toISOString(), level: 'WARN', event: 'screen.auto_registered',
      screen_id: screenId, venue_id: 'venue-1',
      note: 'Unknown screen auto-registered to default venue. Pre-create via POST /screens to assign correct venue.',
    }));
    screen = {
      id: screenId, venue_id: 'venue-1', screen_group: null, tenant_id: null,
      timezone: 'UTC', venue_name: 'Default Venue',
    };
  } else {
    screen = sRes.rows[0];
  }

  // 2. Get "now" in venue's local timezone via Postgres (avoids tz library dependency)
  // Graceful fallback: if the venue has an invalid timezone string (e.g. typo in DB),
  // Postgres throws. We catch, log, and fall back to UTC so this screen's compute
  // doesn't crash — a bad venue row should not take down all its screens.
  let localNow;
  try {
    const tzRes = await pool.query(
      `SELECT NOW() AT TIME ZONE $1 AS local_now`,
      [screen.timezone]
    );
    localNow = new Date(tzRes.rows[0].local_now);
  } catch {
    console.warn(JSON.stringify({
      ts: new Date().toISOString(), level: 'WARN', event: 'manifest.timezone_fallback',
      screen_id: screenId, venue_id: screen.venue_id, bad_timezone: screen.timezone,
    }));
    localNow = new Date(); // UTC — getUTCHours/getUTCDay accessors still correct
  }

  // 3. Fetch all schedules that could target this screen — two queries merged.
  //    Query A: content-based schedules (content_id IS NOT NULL)
  //    Query B: playlist-based schedules (playlist_id IS NOT NULL) — expands named_playlists items inline
  //    Priority: screen-specific > screen-group > venue-wide > global

  const TARGET_FILTER = `(
    s.screen_id = $1
    OR (s.screen_group IS NOT NULL AND s.screen_group = $2)
    OR (s.venue_id = $3 AND s.screen_id IS NULL AND s.screen_group IS NULL)
    OR (s.venue_id IS NULL AND s.screen_id IS NULL AND s.screen_group IS NULL)
  )`;

  const contentSchedRes = await pool.query(
    `SELECT s.id AS schedule_id,
            s.content_id,
            s.priority,
            s.duration,
            s.starts_at, s.ends_at, s.days_of_week,
            s.time_of_day_start, s.time_of_day_end,
            s.is_fallback,
            s.zone_name,
            c.template_type,
            c.data AS content_data
     FROM   schedules s
     JOIN   content   c ON c.id = s.content_id
     WHERE  s.content_id IS NOT NULL
       AND (c.expires_at IS NULL OR c.expires_at > NOW())
       AND ($4::uuid IS NULL OR c.tenant_id = $4)
       AND ${TARGET_FILTER}
     ORDER BY s.priority DESC, s.created_at ASC`,
    [screenId, screen.screen_group, screen.venue_id, screen.tenant_id ?? null]
  );

  const playlistSchedRes = await pool.query(
    `SELECT s.id AS schedule_id,
            (item->>'content_id')::uuid AS content_id,
            s.priority,
            COALESCE((item->>'duration_seconds')::int, 10) AS duration,
            s.starts_at, s.ends_at, s.days_of_week,
            s.time_of_day_start, s.time_of_day_end,
            s.is_fallback,
            s.zone_name,
            c.template_type,
            c.data AS content_data
     FROM   schedules s
     JOIN   named_playlists np ON np.id = s.playlist_id
     CROSS  JOIN LATERAL jsonb_array_elements(np.items) AS item
     JOIN   content c ON c.id = (item->>'content_id')::uuid
     WHERE  s.playlist_id IS NOT NULL
       AND (c.expires_at IS NULL OR c.expires_at > NOW())
       AND ($4::uuid IS NULL OR c.tenant_id = $4)
       AND ${TARGET_FILTER}
     ORDER BY s.priority DESC, s.created_at ASC`,
    [screenId, screen.screen_group, screen.venue_id, screen.tenant_id ?? null]
  );

  const allSchedRows = [...contentSchedRes.rows, ...playlistSchedRes.rows]
    .sort((a, b) => b.priority - a.priority);

  // 4. Filter to schedules currently active at localNow
  const active   = allSchedRows.filter(s => scheduleActive(s, localNow));
  const regular  = active.filter(s => !s.is_fallback);
  const fallback = active.filter(s =>  s.is_fallback);

  // 5. Deduplicate by content_id (highest priority already first from ORDER BY)
  function toItems(rows, source) {
    const seen = new Set();
    return rows
      .filter(r => { if (seen.has(r.content_id)) return false; seen.add(r.content_id); return true; })
      .map(r => ({
        content_id:       r.content_id,
        type:             r.template_type,
        template_version: 1,
        data:             r.content_data,
        duration:         r.duration,
        priority:         r.priority,
        zone_name:        r.zone_name ?? 'main',
        source,
      }));
  }

  let items         = toItems(regular,  'scheduled');
  const fallbackItems = toItems(fallback, 'fallback');

  // 6. Promote fallback into items when no scheduled content is active
  if (items.length === 0) {
    items = fallbackItems.map(i => ({ ...i })); // shallow copy so fallback_items stays separate
  }

  // 7. Legacy bridge: if schedules produced nothing, read old playlists table
  //    This covers the Phase 3 → Phase 4 gap where Studio hasn't switched to schedules yet.
  if (items.length === 0) {
    const legRes = await pool.query(
      'SELECT items FROM playlists WHERE screen_id = $1',
      [screenId]
    );
    if (legRes.rows.length && legRes.rows[0].items.length > 0) {
      items = legRes.rows[0].items.map(i => ({
        ...i,
        template_version: i.template_version ?? 1,
        source: 'legacy',
      }));
    }
  }

  // 8. Absolute last resort — screen is never blank
  if (items.length === 0) {
    items = [{
      content_id:       'system-fallback',
      type:             'promo_slide',
      template_version: 1,
      data:             { headline: screen.venue_name || 'Welcome', subheadline: '' },
      duration:         15,
      source:           'system',
    }];
  }

  // 9. Group items by zone for zone-aware layout engine
  const items_by_zone = {};
  for (const item of items) {
    const z = item.zone_name ?? 'main';
    if (!items_by_zone[z]) items_by_zone[z] = [];
    items_by_zone[z].push(item);
  }

  // 10. Version: only increment when content actually changes
  // FIX-1: include i.data in the signature — content edits (e.g. headline changes)
  //        now produce a different checksum and trigger a version bump.
  const sig  = items.map(i =>
    `${i.content_id}:${i.duration}:${i.priority ?? 0}:${i.zone_name ?? 'main'}:${JSON.stringify(i.data)}`
  ).join('|');
  const csum = checksum(sig);

  // 10. valid_until = earliest ends_at among active schedules (or 30 min from now)
  // FIX-2c: use Date.now() (real UTC) — localNow has a stripped TZ and the wrong epoch
  const boundaries = active
    .filter(s => s.ends_at)
    .map(s => new Date(s.ends_at).getTime());
  const validUntil = boundaries.length
    ? new Date(Math.min(...boundaries))
    : new Date(Date.now() + 30 * 60 * 1000);

  // 11. Atomic version determination + cache upsert (FIX-4)
  // SELECT FOR UPDATE inside a transaction prevents the TOCTOU race where two
  // concurrent computeManifest() calls both read version=N and both write version=N+1,
  // or worse, where one overwrites a valid increment with a stale version number.
  // CRIT-3: Acquire a dedicated client for the transaction.
  // On error: attempt ROLLBACK but swallow its result, then call client.release(err).
  // Passing the original error to release() signals pg to DESTROY this connection
  // rather than recycle it. Without this, a connection that failed mid-transaction
  // goes back into the pool in an aborted state and poisons the next request that
  // picks it up ("current transaction is aborted, commands ignored until end of block").
  const client = await pool.connect();
  let manifest;
  try {
    await client.query('BEGIN');

    const cacheRow = await client.query(
      'SELECT version, checksum FROM manifest_cache WHERE screen_id = $1 FOR UPDATE',
      [screenId]
    );

    let version;
    if (!cacheRow.rows.length) {
      version = 1;
    } else if (cacheRow.rows[0].checksum !== csum) {
      version = cacheRow.rows[0].version + 1;
      // Manifest content changed — atomically increment fleet consensus generation
      // in DB so all instances see the same new generation value. This call is inside
      // the SELECT FOR UPDATE transaction for this screen_id, so only one instance
      // can reach here for the same screen at a time.
      await fleetConsensus.incrementManifestGeneration();
    } else {
      version = cacheRow.rows[0].version;
    }

    manifest = {
      screen_id:     screenId,
      venue_id:      screen.venue_id,
      version,
      checksum:      csum,
      computed_at:   new Date().toISOString(),
      valid_until:   validUntil.toISOString(),
      generated_at:  new Date().toISOString(), // kept for backward compat
      items,
      items_by_zone,
      fallback_items: fallbackItems,
    };

    await client.query(
      `INSERT INTO manifest_cache (screen_id, manifest, checksum, version, computed_at, valid_until)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (screen_id) DO UPDATE
         SET manifest    = EXCLUDED.manifest,
             checksum    = EXCLUDED.checksum,
             version     = EXCLUDED.version,
             computed_at = NOW(),
             valid_until = EXCLUDED.valid_until`,
      [screenId, JSON.stringify(manifest), csum, version, validUntil]
    );

    await client.query('COMMIT');
    client.release(); // success path: recycle connection normally
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* swallow — original error is what matters */ }
    client.release(err); // failure path: destroy connection, not recycle
    throw err;
  }

  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: 'INFO', event: 'manifest.computed',
    screen_id: screenId, duration_ms: Date.now() - t0,
    version: manifest.version, items_count: manifest.items.length, cache_hit: false,
  }));
  return manifest;
}

// ─── Public API ─────────────────────────────────────────────────────────────
async function getManifest(screenId) {
  const t0 = Date.now();
  // Serve from cache if fresh enough
  const cached = await pool.query(
    'SELECT manifest, computed_at FROM manifest_cache WHERE screen_id = $1',
    [screenId]
  );
  if (cached.rows.length) {
    const ageMs = Date.now() - new Date(cached.rows[0].computed_at).getTime();
    if (ageMs < CACHE_TTL_MS) {
      console.log(JSON.stringify({
        ts: new Date().toISOString(), level: 'INFO', event: 'manifest.computed',
        screen_id: screenId, duration_ms: Date.now() - t0, cache_hit: true,
        version: cached.rows[0].manifest.version,
      }));
      return cached.rows[0].manifest;
    }
  }
  return computeManifest(screenId);
}

module.exports = { getManifest, computeManifest };
