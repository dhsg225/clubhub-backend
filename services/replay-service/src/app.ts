import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { loadConfig } from './config.js';
import { registerHealthRoutes } from './health.js';
import { verifyChainIntegrity, type ReplayAuditRecord } from './record-validator.js';
import { assertAppendOnly } from './append-only-guard.js';
import { getPool, ensureSchema } from './db.js';

export async function buildApp(pool: Pool): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await registerHealthRoutes(app);

  // ── POST /audit/batch ──────────────────────────────────────────────────────
  // Accepts an array of ReplayAuditRecord objects.
  // Validates integrity via verifyChainIntegrity, then appends to DB.
  // Constitutional: append-only — no UPDATE or DELETE ever permitted.
  app.post<{ Body: ReplayAuditRecord[] }>('/audit/batch', async (req, reply) => {
    const records = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return reply.code(400).send({ error: 'Body must be a non-empty array of audit records' });
    }

    const { valid, invalidRecords } = verifyChainIntegrity(records);
    if (!valid) {
      return reply.code(422).send({
        error: 'Record integrity check failed',
        invalid_record_ids: invalidRecords,
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const record of records) {
        await client.query(
          `INSERT INTO replay_audit_records
             (audit_record_id, created_at, screen_id, venue_id, at,
              correlation_id, playlist_checksum, resolution_level,
              is_fallback, invariants_passed, record_checksum)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (audit_record_id) DO NOTHING`,
          [
            record.audit_record_id,
            record.created_at,
            record.screen_id,
            record.venue_id,
            record.at,
            record.correlation_id,
            record.playlist_checksum,
            record.resolution_level,
            record.is_fallback,
            record.invariants_passed,
            record.record_checksum,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[replay-service] Failed to insert audit batch:', err);
      return reply.code(500).send({ error: 'Database write failed' });
    } finally {
      client.release();
    }

    return reply.code(201).send({ ok: true, accepted: records.length });
  });

  // ── GET /replay/:id ────────────────────────────────────────────────────────
  // Retrieve a single replay audit record by audit_record_id.
  app.get<{ Params: { id: string } }>('/replay/:id', async (req, reply) => {
    // Guard: this is a read path — assertAppendOnly is not invoked here,
    // but document that no mutation occurs.
    const { id } = req.params;

    const result = await pool.query<ReplayAuditRecord>(
      'SELECT * FROM replay_audit_records WHERE audit_record_id = $1',
      [id],
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Record not found' });
    }

    return reply.code(200).send(result.rows[0]);
  });

  // Guard route: explicitly reject any attempt to call update/delete paths
  // (belt-and-suspenders; the DB rules already block these)
  app.delete('/replay/:id', async (_req, reply) => {
    assertAppendOnly('DELETE', 'route-level-block');
    return reply.code(405).send({ error: 'Replay audit records are append-only' });
  });

  return app;
}

export async function startServer(): Promise<void> {
  const config = loadConfig();
  const pool = getPool();
  await ensureSchema(pool);
  const app = await buildApp(pool);
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
}
