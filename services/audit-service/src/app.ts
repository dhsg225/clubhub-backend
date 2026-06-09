import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { loadConfig } from './config.js';
import { registerHealthRoutes } from './health.js';
import { initPool, ensureSchema } from './db.js';

interface AuditEventBody {
  event_type: string;
  payload: unknown;
  screen_id?: string;
  venue_id?: string;
}

interface AuditEventRow {
  event_id: string;
  event_type: string;
  payload: unknown;
  screen_id: string | null;
  venue_id: string | null;
  recorded_at: string;
}

interface AuditQuerystring {
  since?: string;
  type?: string;
  limit?: string;
}

export async function buildApp(pool: Pool, enableLogger = false): Promise<FastifyInstance> {
  const app = Fastify({ logger: enableLogger });

  await registerHealthRoutes(app);

  // POST /audit/event — record a constitutional state transition or operator action
  app.post<{ Body: AuditEventBody }>(
    '/audit/event',
    async (request, reply) => {
      const body = request.body as Partial<AuditEventBody> | undefined;
      const { event_type, payload, screen_id, venue_id } = body ?? {};

      if (!event_type || payload === undefined || payload === null) {
        return reply.code(400).send({ error: 'event_type and payload are required' });
      }

      const client = await pool.connect();
      try {
        const result = await client.query<{ event_id: string; recorded_at: string }>(
          `INSERT INTO audit_events (event_type, payload, screen_id, venue_id)
           VALUES ($1, $2::jsonb, $3, $4)
           RETURNING event_id, recorded_at`,
          [event_type, JSON.stringify(payload), screen_id ?? null, venue_id ?? null],
        );
        const row = result.rows[0];
        if (!row) throw new Error('INSERT returned no row');
        return reply.code(201).send({
          event_id: row.event_id,
          recorded_at: row.recorded_at,
        });
      } finally {
        client.release();
      }
    },
  );

  // GET /audit/events?since=<epoch_ms>&type=<event_type>&limit=<n>
  app.get<{ Querystring: AuditQuerystring }>(
    '/audit/events',
    async (request, reply) => {
      const { since, type, limit = '50' } = request.query;
      const sinceTs = since
        ? new Date(parseInt(since, 10)).toISOString()
        : new Date(0).toISOString();
      const limitNum = Math.min(parseInt(limit, 10), 500);

      const client = await pool.connect();
      try {
        const result = await client.query<AuditEventRow>(
          `SELECT event_id, event_type, payload, screen_id, venue_id, recorded_at
           FROM audit_events
           WHERE recorded_at >= $1
             AND ($2::text IS NULL OR event_type = $2)
           ORDER BY recorded_at ASC, event_id ASC
           LIMIT $3`,
          [sinceTs, type ?? null, limitNum],
        );
        return reply.code(200).send({
          events: result.rows,
          count: result.rows.length,
          at_utc_ms: Date.now(),
        });
      } finally {
        client.release();
      }
    },
  );

  return app;
}

export async function startServer(): Promise<void> {
  const config = loadConfig();
  const pool = initPool();
  await ensureSchema(pool);

  const app = await buildApp(pool, true);
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
}
