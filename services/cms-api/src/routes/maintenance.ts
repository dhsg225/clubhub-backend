/**
 * Maintenance mode + incident command + venue timeline routes.
 *
 * Maintenance mode: per-screen flag that:
 *   - Suppresses health alerts in fleet dashboard
 *   - Excludes screen from bulk operations (restart-all, deploy-all)
 *   - Signals to ops team that disruption is expected
 *   - Does NOT pause content delivery (player continues serving)
 *
 * Incident command mode: aggregated venue state for rapid incident diagnosis.
 * Returns in one call: health, timeline, open incidents, active commands.
 * Designed for the "2am phone call, venue manager is angry" scenario.
 *
 * Venue timeline: append-only log of all significant events.
 * "What changed in the last 2 hours?" — the primary operator question after an incident.
 *
 * Shift handover: structured record for ops continuity.
 *
 * Operator conflict detection: soft-lock via operator_locks table.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { query, withTransaction } from '../db/pool.js';

export async function registerMaintenanceRoutes(app: FastifyInstance): Promise<void> {

  // ── Maintenance mode ──────────────────────────────────────────────────────

  // PUT /api/v2/screens/:screen_id/maintenance
  app.put<{
    Params: { screen_id: string };
    Body: { active: boolean; reason?: string; expected_end_at?: string };
  }>(
    '/api/v2/screens/:screen_id/maintenance',
    async (request, reply) => {
      const { screen_id } = request.params;
      const { active, reason, expected_end_at } = request.body;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      if (active && !reason) {
        return reply.code(400).send({ error: 'reason is required when activating maintenance mode' });
      }

      const screens = await query<{ venue_id: string; name: string }>(
        'SELECT venue_id, name FROM screens WHERE screen_id = $1',
        [screen_id],
      );
      if (screens.length === 0) return reply.code(404).send({ error: 'Screen not found' });

      await query(
        `INSERT INTO maintenance_mode (screen_id, is_active, reason, activated_by, activated_at, expected_end_at)
         VALUES ($1, $2, $3, $4, CASE WHEN $2 THEN now() ELSE NULL END, $5)
         ON CONFLICT (screen_id) DO UPDATE SET
           is_active = EXCLUDED.is_active,
           reason = EXCLUDED.reason,
           activated_by = EXCLUDED.activated_by,
           activated_at = CASE WHEN EXCLUDED.is_active THEN now() ELSE NULL END,
           expected_end_at = EXCLUDED.expected_end_at,
           updated_at = now()`,
        [screen_id, active, reason ?? null, operator_id, expected_end_at ?? null],
      );

      await query(
        `INSERT INTO venue_timeline_events
           (venue_id, screen_id, event_type, actor_id, title, detail)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          screens[0]!.venue_id,
          screen_id,
          active ? 'MAINTENANCE_START' : 'MAINTENANCE_END',
          operator_id,
          `${active ? 'Maintenance started' : 'Maintenance ended'}: ${screens[0]!.name}`,
          JSON.stringify({ reason, expected_end_at }),
        ],
      );

      return reply.send({
        screen_id,
        is_active: active,
        reason: reason ?? null,
        at_utc_ms: Date.now(),
      });
    },
  );

  // GET /api/v2/venues/:venue_id/maintenance — all screens in maintenance for venue
  app.get<{ Params: { venue_id: string } }>(
    '/api/v2/venues/:venue_id/maintenance',
    async (request, reply) => {
      const { venue_id } = request.params;

      const rows = await query<{
        screen_id: string;
        screen_name: string;
        is_active: boolean;
        reason: string | null;
        activated_by: string | null;
        activated_at: Date | null;
        expected_end_at: Date | null;
      }>(
        `SELECT s.screen_id, s.name as screen_name, m.is_active, m.reason,
                m.activated_by, m.activated_at, m.expected_end_at
         FROM screens s
         LEFT JOIN maintenance_mode m USING (screen_id)
         WHERE s.venue_id = $1
         ORDER BY s.name`,
        [venue_id],
      );

      return reply.send({ screens: rows, at_utc_ms: Date.now() });
    },
  );

  // ── Incident command mode ─────────────────────────────────────────────────
  // Single endpoint for rapid incident diagnosis.
  // Returns everything an operator needs in one call.

  app.get<{ Params: { venue_id: string } }>(
    '/api/v2/venues/:venue_id/incident-command',
    async (request, reply) => {
      const { venue_id } = request.params;

      // Fetch all data in parallel
      const [venueRows, screenHealth, recentTimeline, openIncidents, pendingCommands] =
        await Promise.all([
          // Venue info
          query<{ venue_id: string; name: string; market_vertical: string }>(
            'SELECT venue_id, name, market_vertical FROM venues WHERE venue_id = $1',
            [venue_id],
          ),

          // Screen health
          query<{
            screen_id: string;
            screen_name: string;
            last_seen_at: Date | null;
            constitutional_state: string | null;
            consecutive_sync_failures: number;
            corpus_version_id: string | null;
            corpus_load_source: string | null;
            is_maintenance: boolean;
          }>(
            `SELECT s.screen_id, s.name as screen_name, h.last_seen_at,
                    h.constitutional_state,
                    COALESCE(h.consecutive_sync_failures, 0) as consecutive_sync_failures,
                    h.corpus_version_id, h.corpus_load_source,
                    COALESCE(m.is_active, false) as is_maintenance
             FROM screens s
             LEFT JOIN player_health_snapshots h USING (screen_id)
             LEFT JOIN maintenance_mode m USING (screen_id)
             WHERE s.venue_id = $1
             AND s.commissioning_state != 'DECOMMISSIONED'
             ORDER BY s.name`,
            [venue_id],
          ),

          // Last 50 timeline events (last 4 hours)
          query<{
            event_id: string;
            created_at: Date;
            event_type: string;
            actor_id: string | null;
            title: string;
            screen_id: string | null;
          }>(
            `SELECT event_id, created_at, event_type, actor_id, title, screen_id
             FROM venue_timeline_events
             WHERE venue_id = $1
               AND created_at > now() - interval '4 hours'
             ORDER BY created_at DESC
             LIMIT 50`,
            [venue_id],
          ),

          // Open incidents
          query<{
            incident_id: string;
            severity: number;
            title: string;
            status: string;
            opened_at: Date;
            opened_by: string;
          }>(
            `SELECT incident_id, severity, title, status, opened_at, opened_by
             FROM support_incidents
             WHERE venue_id = $1
             AND status NOT IN ('RESOLVED', 'CLOSED')
             ORDER BY severity ASC, opened_at DESC`,
            [venue_id],
          ),

          // Pending remote commands
          query<{
            command_id: string;
            screen_id: string;
            command_type: string;
            issued_by: string;
            created_at: Date;
          }>(
            `SELECT command_id, screen_id, command_type, issued_by, created_at
             FROM remote_commands
             WHERE venue_id = $1
             AND status IN ('PENDING', 'ACKNOWLEDGED', 'EXECUTING')
             AND expires_at > now()
             ORDER BY created_at DESC`,
            [venue_id],
          ),
        ]);

      if (venueRows.length === 0) return reply.code(404).send({ error: 'Venue not found' });

      // Classify screen health inline
      const classifiedScreens = screenHealth.map(s => {
        const ageMs = s.last_seen_at ? Date.now() - s.last_seen_at.getTime() : Infinity;
        const status =
          ageMs > 24 * 3600_000 ? 'LOST' :
          ageMs > 90_000         ? 'OFFLINE' :
          s.consecutive_sync_failures >= 3 ? 'DEGRADED' :
          s.corpus_load_source && s.corpus_load_source !== 'current' ? 'DEGRADED' :
          'HEALTHY';
        return { ...s, status };
      });

      const statusCounts = classifiedScreens.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return reply.send({
        venue: venueRows[0],
        summary: {
          total_screens: classifiedScreens.length,
          ...statusCounts,
          open_incidents: openIncidents.length,
          pending_commands: pendingCommands.length,
        },
        screens: classifiedScreens,
        recent_timeline: recentTimeline,
        open_incidents: openIncidents,
        pending_commands: pendingCommands,
        at_utc_ms: Date.now(),
      });
    },
  );

  // ── Venue timeline ────────────────────────────────────────────────────────

  app.get<{
    Params: { venue_id: string };
    Querystring: { since?: string; limit?: string; event_type?: string };
  }>(
    '/api/v2/venues/:venue_id/timeline',
    async (request, reply) => {
      const { venue_id } = request.params;
      const { since, event_type, limit = '100' } = request.query;
      const limitNum = Math.min(parseInt(limit, 10), 500);
      const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 3600_000);

      const params: unknown[] = [venue_id, sinceDate, limitNum];
      let eventFilter = '';
      if (event_type) {
        params.push(event_type);
        eventFilter = `AND event_type = $${params.length}`;
      }

      const rows = await query<{
        event_id: string;
        created_at: Date;
        event_type: string;
        actor_id: string | null;
        title: string;
        detail: unknown;
        screen_id: string | null;
      }>(
        `SELECT event_id, created_at, event_type, actor_id, title, detail, screen_id
         FROM venue_timeline_events
         WHERE venue_id = $1
           AND created_at >= $2
           ${eventFilter}
         ORDER BY created_at DESC
         LIMIT $3`,
        params,
      );

      return reply.send({ events: rows, at_utc_ms: Date.now() });
    },
  );

  // ── Support incidents ─────────────────────────────────────────────────────

  app.post<{
    Params: { venue_id: string };
    Body: { screen_id?: string; severity: number; title: string; description?: string };
  }>(
    '/api/v2/venues/:venue_id/incidents',
    async (request, reply) => {
      const { venue_id } = request.params;
      const { screen_id, severity, title, description } = request.body;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      if (!severity || severity < 1 || severity > 4) {
        return reply.code(400).send({ error: 'severity must be 1–4 (1=critical, 4=minor)' });
      }

      const rows = await query<{ incident_id: string; opened_at: Date }>(
        `INSERT INTO support_incidents
           (venue_id, screen_id, opened_by, severity, title, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING incident_id, opened_at`,
        [venue_id, screen_id ?? null, operator_id, severity, title, description ?? null],
      );

      await query(
        `INSERT INTO venue_timeline_events
           (venue_id, screen_id, event_type, actor_id, title, detail)
         VALUES ($1, $2, 'INCIDENT_OPENED', $3, $4, $5)`,
        [
          venue_id,
          screen_id ?? null,
          operator_id,
          `P${severity} incident opened: ${title}`,
          JSON.stringify({ incident_id: rows[0]!.incident_id, severity }),
        ],
      );

      return reply.code(201).send({
        incident_id: rows[0]!.incident_id,
        opened_at: rows[0]!.opened_at,
        severity,
        sla_response_minutes: [null, 30, 120, 480, null][severity] ?? null,
      });
    },
  );

  app.patch<{
    Params: { incident_id: string };
    Body: { status: string; root_cause?: string; resolution_note?: string };
  }>(
    '/api/v2/incidents/:incident_id',
    async (request, reply) => {
      const { incident_id } = request.params;
      const { status, root_cause, resolution_note } = request.body;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      const incidents = await query<{ severity: number; venue_id: string; status: string }>(
        'SELECT severity, venue_id, status FROM support_incidents WHERE incident_id = $1',
        [incident_id],
      );
      if (incidents.length === 0) return reply.code(404).send({ error: 'Incident not found' });

      const incident = incidents[0]!;

      // P1/P2 require root_cause before closing
      if (status === 'CLOSED' && incident.severity <= 2 && !root_cause) {
        return reply.code(400).send({
          error: 'root_cause is required before closing P1/P2 incidents',
        });
      }

      await query(
        `UPDATE support_incidents SET
           status = $1,
           root_cause = COALESCE($2, root_cause),
           resolution_note = COALESCE($3, resolution_note),
           resolved_by = CASE WHEN $1 IN ('RESOLVED', 'CLOSED') THEN $4 ELSE resolved_by END,
           resolved_at = CASE WHEN $1 IN ('RESOLVED', 'CLOSED') THEN now() ELSE resolved_at END
         WHERE incident_id = $5`,
        [status, root_cause ?? null, resolution_note ?? null, operator_id, incident_id],
      );

      await query(
        `INSERT INTO venue_timeline_events
           (venue_id, screen_id, event_type, actor_id, title, detail)
         VALUES ($1, NULL, $2, $3, $4, $5)`,
        [
          incident.venue_id,
          status === 'CLOSED' ? 'INCIDENT_CLOSED' : 'OPERATOR_ACTION',
          operator_id,
          `Incident ${status.toLowerCase()}`,
          JSON.stringify({ incident_id, status, root_cause }),
        ],
      );

      return reply.code(204).send();
    },
  );

  // ── Shift handover ────────────────────────────────────────────────────────

  app.post<{ Body: { notes?: string; attention_items?: string[]; safe_to_handover: boolean } }>(
    '/api/v2/shift-handover',
    async (request, reply) => {
      const { notes, attention_items, safe_to_handover } = request.body;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      // Build snapshot of current operational state
      const [openIncidents, activeMaintenance, offlineScreens] = await Promise.all([
        query<{ incident_id: string; severity: number; title: string; venue_id: string }>(
          `SELECT incident_id, severity, title, venue_id::text
           FROM support_incidents
           WHERE status NOT IN ('RESOLVED', 'CLOSED')
           ORDER BY severity ASC, opened_at DESC
           LIMIT 20`,
          [],
        ),
        query<{ screen_id: string; reason: string | null }>(
          `SELECT screen_id::text, reason FROM maintenance_mode WHERE is_active = true`,
          [],
        ),
        query<{ screen_id: string; last_seen_at: Date }>(
          `SELECT screen_id::text, last_seen_at
           FROM player_health_snapshots
           WHERE last_seen_at < now() - interval '90 seconds'
           OR last_seen_at IS NULL
           LIMIT 20`,
          [],
        ),
      ]);

      const rows = await query<{ handover_id: string; created_at: Date }>(
        `INSERT INTO shift_handovers
           (created_by, open_incidents_json, active_maintenance_json, offline_screens_json,
            notes, attention_items, safe_to_handover)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING handover_id, created_at`,
        [
          operator_id,
          JSON.stringify(openIncidents),
          JSON.stringify(activeMaintenance),
          JSON.stringify(offlineScreens),
          notes ?? null,
          attention_items ?? [],
          safe_to_handover,
        ],
      );

      return reply.code(201).send({
        handover_id: rows[0]!.handover_id,
        created_at: rows[0]!.created_at,
        snapshot: {
          open_incidents: openIncidents.length,
          active_maintenance: activeMaintenance.length,
          offline_screens: offlineScreens.length,
        },
      });
    },
  );

  // ── Operator lock ─────────────────────────────────────────────────────────

  app.post<{
    Body: { resource_type: string; resource_id: string };
  }>(
    '/api/v2/locks',
    async (request, reply) => {
      const { resource_type, resource_id } = request.body;
      const operator_id = (request as FastifyRequest & { operator_id?: string }).operator_id ?? 'unknown';

      // Check for existing lock held by different operator
      const existing = await query<{ lock_id: string; operator_id: string; expires_at: Date }>(
        `SELECT lock_id, operator_id, expires_at
         FROM operator_locks
         WHERE resource_type = $1 AND resource_id = $2 AND expires_at > now()
         LIMIT 1`,
        [resource_type, resource_id],
      );

      if (existing.length > 0 && existing[0]!.operator_id !== operator_id) {
        return reply.code(409).send({
          error: `Resource is currently being edited by ${existing[0]!.operator_id}`,
          locked_by: existing[0]!.operator_id,
          lock_expires_at: existing[0]!.expires_at,
        });
      }

      // Upsert lock
      const rows = await query<{ lock_id: string; expires_at: Date }>(
        `INSERT INTO operator_locks (resource_type, resource_id, operator_id)
         VALUES ($1, $2, $3)
         ON CONFLICT ON CONSTRAINT idx_operator_locks_resource
         DO UPDATE SET heartbeat_at = now(), expires_at = now() + interval '5 minutes'
         RETURNING lock_id, expires_at`,
        [resource_type, resource_id, operator_id],
      );

      return reply.code(201).send({
        lock_id: rows[0]!.lock_id,
        expires_at: rows[0]!.expires_at,
        message: 'Send PATCH /api/v2/locks/:lock_id/heartbeat every 60s while editing',
      });
    },
  );

  app.patch<{ Params: { lock_id: string } }>(
    '/api/v2/locks/:lock_id/heartbeat',
    async (request, reply) => {
      const { lock_id } = request.params;
      await query(
        `UPDATE operator_locks SET heartbeat_at = now(), expires_at = now() + interval '5 minutes'
         WHERE lock_id = $1`,
        [lock_id],
      );
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: { lock_id: string } }>(
    '/api/v2/locks/:lock_id',
    async (request, reply) => {
      const { lock_id } = request.params;
      await query('DELETE FROM operator_locks WHERE lock_id = $1', [lock_id]);
      return reply.code(204).send();
    },
  );
}
