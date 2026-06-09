/**
 * Fleet health routes — player heartbeat ingestion and fleet dashboard.
 *
 * Routes:
 *   POST /api/v2/screens/:screen_id/heartbeat   — player heartbeat ingestion
 *   GET  /api/v2/fleet/health                   — fleet health summary (operator dashboard)
 *   GET  /api/v2/fleet/health/screens           — per-screen health list with filters
 *   GET  /api/v2/fleet/health/screens/:screen_id — single screen health detail
 *
 * Health classification (per screen):
 *   HEALTHY       — heartbeat within 90s, corpus fresh, no warnings
 *   DEGRADED      — heartbeat within 90s but warnings present
 *   OFFLINE       — no heartbeat for 90s–24h
 *   LOST          — no heartbeat for > 24h
 *   UNKNOWN       — never sent a heartbeat
 *
 * Storage: player_health_snapshots table (V6 migration).
 * One row per screen, upserted on each heartbeat. No history — history
 * is in audit records. This table is purely for current fleet state.
 *
 * Warning thresholds:
 *   - consecutive_sync_failures >= 3         → SYNC_DEGRADED
 *   - disk_free_mb < 200                     → DISK_LOW
 *   - memory_rss_mb > 400                    → MEMORY_HIGH
 *   - temperature_celsius >= 75              → TEMP_HIGH
 *   - corpus_load_source = 'previous'        → CORPUS_DEGRADED
 *   - corpus_load_source = 'factory'         → CORPUS_CRITICAL
 *   - asset_url_expires_in_min < 240         → URL_EXPIRING (4h)
 *   - corpus_age_ms > 14400000               → CORPUS_STALE (4h)
 *   - chromium_alive = false                     → CHROMIUM_DEAD
 *   - ntp_synced = false OR clock_drift_ms > 60s → NTP_DESYNC
 *
 * Operational runbook:
 *   SYNC_DEGRADED:  Check venue internet connectivity. Check API logs for 5xx.
 *   DISK_LOW:       SSH in, check 'du -sh /var/clubhub/*'. Rotate replay cache.
 *   MEMORY_HIGH:    Check player-runtime logs for memory leak. Restart if >450MB.
 *   TEMP_HIGH:      Check AV cabinet ventilation. Consider passive heatsink.
 *   CORPUS_DEGRADED: SD card read error likely. Replace card within 72h.
 *   CORPUS_CRITICAL: Factory content showing. Player needs reimaging.
 *   URL_EXPIRING:   Player offline for extended period. Check connectivity.
 *   CORPUS_STALE:   Player offline or sync broken. Check heartbeat for details.
 *   CHROMIUM_DEAD:  Player display process died. Chromium not rendering. Issue RESTART_RUNTIME command.
 *   NTP_DESYNC:     Player clock drifted. PRE scheduling may produce wrong results. Check NTP server.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { query, withTransaction } from '../db/pool.js';

// ── Heartbeat ingestion ───────────────────────────────────────────────────────

interface HeartbeatBody {
  screen_id: string;
  at: number;
  corpus_version_id: string | null;
  constitutional_state: string;
  replay_cache_size_bytes: number;
  last_corpus_sync_at: number | null;
  consecutive_sync_failures: number;
  disk_free_mb: number;
  memory_rss_mb: number;
  temperature_celsius: number | null;
  corpus_load_source: string | null;
  asset_url_expires_in_min: number;
  corpus_age_ms: number | null;
  chromium_alive?: boolean | null;
  ntp_synced?: boolean | null;
  system_time_utc?: number | null;
  last_resolution_level?: number | null;
}

interface HeartbeatParams {
  screen_id: string;
}

// ── Health classification ─────────────────────────────────────────────────────

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'LOST' | 'UNKNOWN';
type HealthWarning =
  | 'SYNC_DEGRADED'
  | 'DISK_LOW'
  | 'MEMORY_HIGH'
  | 'TEMP_HIGH'
  | 'CORPUS_DEGRADED'
  | 'CORPUS_CRITICAL'
  | 'URL_EXPIRING'
  | 'CORPUS_STALE'
  | 'CHROMIUM_DEAD'
  | 'NTP_DESYNC';

function classifyStatus(
  lastSeenAt: Date | null,
  warnings: HealthWarning[],
): HealthStatus {
  if (!lastSeenAt) return 'UNKNOWN';
  const ageMs = Date.now() - lastSeenAt.getTime();
  if (ageMs > 24 * 60 * 60 * 1000) return 'LOST';
  if (ageMs > 90 * 1000) return 'OFFLINE';
  if (warnings.length > 0) return 'DEGRADED';
  return 'HEALTHY';
}

function extractWarnings(row: {
  consecutive_sync_failures: number;
  disk_free_mb: number;
  memory_rss_mb: number;
  temperature_celsius: number | null;
  corpus_load_source: string | null;
  asset_url_expires_in_min: number;
  corpus_age_ms: number | null;
  chromium_alive?: boolean | null;
  ntp_synced?: boolean | null;
  clock_drift_ms?: number | null;
}): HealthWarning[] {
  const warnings: HealthWarning[] = [];
  if (row.consecutive_sync_failures >= 3)        warnings.push('SYNC_DEGRADED');
  if (row.disk_free_mb < 200)                    warnings.push('DISK_LOW');
  if (row.memory_rss_mb > 400)                   warnings.push('MEMORY_HIGH');
  if (row.temperature_celsius !== null && row.temperature_celsius >= 75) warnings.push('TEMP_HIGH');
  if (row.corpus_load_source === 'previous')     warnings.push('CORPUS_DEGRADED');
  if (row.corpus_load_source === 'factory')      warnings.push('CORPUS_CRITICAL');
  if (row.asset_url_expires_in_min >= 0 && row.asset_url_expires_in_min < 240) warnings.push('URL_EXPIRING');
  if (row.corpus_age_ms !== null && row.corpus_age_ms > 4 * 60 * 60 * 1000)   warnings.push('CORPUS_STALE');
  if (row.chromium_alive === false)                                             warnings.push('CHROMIUM_DEAD');
  if (row.ntp_synced === false)                                                 warnings.push('NTP_DESYNC');
  // Clock drift > 60s is a scheduling risk
  if (row.clock_drift_ms !== null && row.clock_drift_ms !== undefined && row.clock_drift_ms > 60_000) warnings.push('NTP_DESYNC');
  return warnings;
}

// ── Route registration ────────────────────────────────────────────────────────

export async function registerFleetHealthRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/v2/screens/:screen_id/heartbeat
  app.post<{ Params: HeartbeatParams; Body: HeartbeatBody }>(
    '/api/v2/screens/:screen_id/heartbeat',
    async (request, reply) => {
      const { screen_id } = request.params;
      const body = request.body;

      // Validate screen_id matches body
      if (body.screen_id !== screen_id) {
        return reply.code(400).send({ error: 'screen_id mismatch' });
      }

      // Verify screen exists
      const screens = await query<{ screen_id: string }>(
        'SELECT screen_id FROM screens WHERE screen_id = $1',
        [screen_id],
      );
      if (screens.length === 0) {
        return reply.code(404).send({ error: 'Screen not found' });
      }

      // Upsert health snapshot
      await query(
        `INSERT INTO player_health_snapshots (
          screen_id, last_seen_at, corpus_version_id, constitutional_state,
          replay_cache_size_bytes, last_corpus_sync_at, consecutive_sync_failures,
          disk_free_mb, memory_rss_mb, temperature_celsius, corpus_load_source,
          asset_url_expires_in_min, corpus_age_ms,
          chromium_alive, ntp_synced, system_time_utc, last_resolution_level, clock_drift_ms
        ) VALUES ($1, to_timestamp($2::bigint / 1000.0), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (screen_id) DO UPDATE SET
          last_seen_at             = EXCLUDED.last_seen_at,
          corpus_version_id        = EXCLUDED.corpus_version_id,
          constitutional_state     = EXCLUDED.constitutional_state,
          replay_cache_size_bytes  = EXCLUDED.replay_cache_size_bytes,
          last_corpus_sync_at      = EXCLUDED.last_corpus_sync_at,
          consecutive_sync_failures = EXCLUDED.consecutive_sync_failures,
          disk_free_mb             = EXCLUDED.disk_free_mb,
          memory_rss_mb            = EXCLUDED.memory_rss_mb,
          temperature_celsius      = EXCLUDED.temperature_celsius,
          corpus_load_source       = EXCLUDED.corpus_load_source,
          asset_url_expires_in_min = EXCLUDED.asset_url_expires_in_min,
          corpus_age_ms            = EXCLUDED.corpus_age_ms,
          chromium_alive           = EXCLUDED.chromium_alive,
          ntp_synced               = EXCLUDED.ntp_synced,
          system_time_utc          = EXCLUDED.system_time_utc,
          last_resolution_level    = EXCLUDED.last_resolution_level,
          clock_drift_ms           = EXCLUDED.clock_drift_ms`,
        [
          screen_id,
          body.at,
          body.corpus_version_id,
          body.constitutional_state,
          body.replay_cache_size_bytes,
          body.last_corpus_sync_at,
          body.consecutive_sync_failures ?? 0,
          body.disk_free_mb ?? 0,
          body.memory_rss_mb ?? 0,
          body.temperature_celsius ?? null,
          body.corpus_load_source ?? null,
          body.asset_url_expires_in_min ?? -1,
          body.corpus_age_ms ?? null,
          body.chromium_alive ?? null,
          body.ntp_synced ?? null,
          body.system_time_utc ?? null,
          body.last_resolution_level ?? null,
          body.system_time_utc != null
            ? Math.abs(Date.now() - body.system_time_utc)
            : null,
        ],
      );

      // Update screens.last_heartbeat_at
      await query(
        `UPDATE screens SET last_heartbeat_at = to_timestamp($2::bigint / 1000.0)
         WHERE screen_id = $1`,
        [screen_id, body.at],
      );

      return reply.code(204).send();
    },
  );

  // GET /api/v2/fleet/health — summary counts by status
  app.get('/api/v2/fleet/health', async (_request, reply) => {
    const rows = await query<{
      screen_id: string;
      last_seen_at: Date | null;
      consecutive_sync_failures: number;
      disk_free_mb: number;
      memory_rss_mb: number;
      temperature_celsius: number | null;
      corpus_load_source: string | null;
      asset_url_expires_in_min: number;
      corpus_age_ms: number | null;
    }>(
      `SELECT s.screen_id, h.last_seen_at, h.consecutive_sync_failures,
              h.disk_free_mb, h.memory_rss_mb, h.temperature_celsius,
              h.corpus_load_source, h.asset_url_expires_in_min, h.corpus_age_ms
       FROM screens s
       LEFT JOIN player_health_snapshots h USING (screen_id)
       WHERE s.commissioning_state != 'DECOMMISSIONED'`,
    );

    const counts: Record<HealthStatus, number> = {
      HEALTHY: 0, DEGRADED: 0, OFFLINE: 0, LOST: 0, UNKNOWN: 0,
    };

    for (const row of rows) {
      const warnings = row.last_seen_at ? extractWarnings(row) : [];
      const status = classifyStatus(row.last_seen_at, warnings);
      counts[status]++;
    }

    return reply.send({
      at_utc_ms: Date.now(),
      total: rows.length,
      ...counts,
    });
  });

  // GET /api/v2/fleet/health/screens — per-screen list with optional filters
  interface FleetScreensQuerystring {
    status?: HealthStatus;
    venue_id?: string;
    warning?: HealthWarning;
    limit?: string;
  }

  app.get<{ Querystring: FleetScreensQuerystring }>(
    '/api/v2/fleet/health/screens',
    async (request: FastifyRequest<{ Querystring: FleetScreensQuerystring }>, reply) => {
      const { status: filterStatus, venue_id, warning: filterWarning, limit = '100' } = request.query;
      const limitNum = Math.min(parseInt(limit, 10), 500);

      const params: unknown[] = [];
      let whereClause = "WHERE s.commissioning_state != 'DECOMMISSIONED'";
      if (venue_id) {
        params.push(venue_id);
        whereClause += ` AND s.venue_id = $${params.length}`;
      }

      const rows = await query<{
        screen_id: string;
        screen_name: string;
        venue_id: string;
        venue_name: string;
        last_seen_at: Date | null;
        corpus_version_id: string | null;
        constitutional_state: string | null;
        consecutive_sync_failures: number;
        disk_free_mb: number;
        memory_rss_mb: number;
        temperature_celsius: number | null;
        corpus_load_source: string | null;
        asset_url_expires_in_min: number;
        corpus_age_ms: number | null;
        last_corpus_sync_at: Date | null;
        chromium_alive: boolean | null;
        ntp_synced: boolean | null;
        clock_drift_ms: number | null;
        last_resolution_level: number | null;
      }>(
        `SELECT s.screen_id, s.name as screen_name, s.venue_id,
                v.name as venue_name,
                h.last_seen_at, h.corpus_version_id, h.constitutional_state,
                COALESCE(h.consecutive_sync_failures, 0) as consecutive_sync_failures,
                COALESCE(h.disk_free_mb, 0) as disk_free_mb,
                COALESCE(h.memory_rss_mb, 0) as memory_rss_mb,
                h.temperature_celsius, h.corpus_load_source,
                COALESCE(h.asset_url_expires_in_min, -1) as asset_url_expires_in_min,
                h.corpus_age_ms,
                h.last_corpus_sync_at,
                h.chromium_alive, h.ntp_synced, h.clock_drift_ms, h.last_resolution_level
         FROM screens s
         JOIN venues v USING (venue_id)
         LEFT JOIN player_health_snapshots h USING (screen_id)
         ${whereClause}
         ORDER BY h.last_seen_at DESC NULLS LAST, s.name
         LIMIT $${params.length + 1}`,
        [...params, limitNum],
      );

      const results = rows
        .map(row => {
          const warnings = row.last_seen_at ? extractWarnings(row) : [];
          const status = classifyStatus(row.last_seen_at, warnings);
          return { ...row, status, warnings };
        })
        .filter(row => {
          if (filterStatus && row.status !== filterStatus) return false;
          if (filterWarning && !row.warnings.includes(filterWarning)) return false;
          return true;
        });

      return reply.send({ screens: results, total: results.length, at_utc_ms: Date.now() });
    },
  );

  // GET /api/v2/fleet/health/screens/:screen_id — single screen detail
  app.get<{ Params: { screen_id: string } }>(
    '/api/v2/fleet/health/screens/:screen_id',
    async (request, reply) => {
      const { screen_id } = request.params;

      const rows = await query<{
        screen_id: string;
        screen_name: string;
        venue_id: string;
        venue_name: string;
        commissioning_state: string;
        last_seen_at: Date | null;
        corpus_version_id: string | null;
        constitutional_state: string | null;
        replay_cache_size_bytes: number | null;
        consecutive_sync_failures: number;
        disk_free_mb: number;
        memory_rss_mb: number;
        temperature_celsius: number | null;
        corpus_load_source: string | null;
        asset_url_expires_in_min: number;
        corpus_age_ms: number | null;
        last_corpus_sync_at: Date | null;
        chromium_alive: boolean | null;
        ntp_synced: boolean | null;
        clock_drift_ms: number | null;
        last_resolution_level: number | null;
      }>(
        `SELECT s.screen_id, s.name as screen_name, s.venue_id, s.commissioning_state,
                v.name as venue_name,
                h.last_seen_at, h.corpus_version_id, h.constitutional_state,
                h.replay_cache_size_bytes,
                COALESCE(h.consecutive_sync_failures, 0) as consecutive_sync_failures,
                COALESCE(h.disk_free_mb, 0) as disk_free_mb,
                COALESCE(h.memory_rss_mb, 0) as memory_rss_mb,
                h.temperature_celsius, h.corpus_load_source,
                COALESCE(h.asset_url_expires_in_min, -1) as asset_url_expires_in_min,
                h.corpus_age_ms, h.last_corpus_sync_at,
                h.chromium_alive, h.ntp_synced, h.clock_drift_ms, h.last_resolution_level
         FROM screens s
         JOIN venues v USING (venue_id)
         LEFT JOIN player_health_snapshots h USING (screen_id)
         WHERE s.screen_id = $1`,
        [screen_id],
      );

      if (rows.length === 0) {
        return reply.code(404).send({ error: 'Screen not found' });
      }

      const row = rows[0]!;
      const warnings = row.last_seen_at ? extractWarnings(row) : [];
      const status = classifyStatus(row.last_seen_at, warnings);

      return reply.send({ ...row, status, warnings, at_utc_ms: Date.now() });
    },
  );
}
