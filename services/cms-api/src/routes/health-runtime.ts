import type { FastifyInstance } from 'fastify';
import { getPool } from '../db/pool.js';

export async function registerHealthRuntimeRoutes(app: FastifyInstance): Promise<void> {

  app.get('/health/runtime', async (_request, reply) => {
    let dbOk = false;
    try {
      const client = await getPool().connect();
      await client.query('SELECT 1');
      client.release();
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const status = dbOk ? 'HEALTHY' : 'DEGRADED';
    return reply.code(dbOk ? 200 : 503).send({
      status,
      db: dbOk ? 'connected' : 'error',
      constitutional_state: 'HEALTHY',
      uptime_s: Math.floor(process.uptime()),
      at_utc_ms: Date.now(),
    });
  });

  app.get('/health/replay', async (_request, reply) => {
    let replayOk = false;
    try {
      const client = await getPool().connect();
      await client.query('SELECT COUNT(*) FROM replay_audit_records');
      client.release();
      replayOk = true;
    } catch {
      replayOk = false;
    }

    return reply.code(replayOk ? 200 : 503).send({
      status: replayOk ? 'OK' : 'ERROR',
      replay_table_accessible: replayOk,
      at_utc_ms: Date.now(),
    });
  });
}
