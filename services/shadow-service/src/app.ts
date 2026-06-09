import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { canonicalizeJson } from '@clubhub/fnv-checksum';
import type { DivergenceClass } from '@clubhub/constitutional-types';
import { loadConfig } from './config.js';
import { registerHealthRoutes } from './health.js';
import { assertNoSilentDivergenceSuppression } from './parity-guard.js';
import { getPool, ensureSchema } from './db.js';

interface CompareBody {
  canary_run_id: string;
  screen_id: string;
  venue_id: string;
  pre_output: unknown;
  legacy_output: unknown;
  /** Caller marks this true when the diverging field is safety-critical (e.g. freeze state). */
  is_safety_critical?: boolean;
}

interface ParityRecord {
  id: string;
  canary_run_id: string;
  divergence_class: DivergenceClass;
  rollback_required: boolean;
  pre_output_hash: string;
  legacy_output_hash: string;
  inserted_at: string;
}

function classifyDivergence(
  preHash: string,
  legacyHash: string,
  isSafetyCritical: boolean,
): DivergenceClass {
  if (preHash === legacyHash) return 0;          // identical outputs
  if (isSafetyCritical) return 3;               // safety-critical field differs → CLASS_3
  return 2;                                     // non-critical difference → CLASS_2
}

export async function buildApp(pool: Pool): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await registerHealthRoutes(app);

  // ── POST /parity/compare ───────────────────────────────────────────────────
  // Accepts pre-computed PRE output + legacy output.
  // Constitutional: shadow service NEVER calls PRE itself (caller sends outputs).
  app.post<{ Body: CompareBody }>('/parity/compare', async (req, reply) => {
    const body = req.body;

    if (!body?.canary_run_id || !body?.screen_id || !body?.venue_id) {
      return reply.code(400).send({ error: 'canary_run_id, screen_id, and venue_id are required' });
    }
    if (body.pre_output === undefined || body.legacy_output === undefined) {
      return reply.code(400).send({ error: 'pre_output and legacy_output are required' });
    }

    const preHash = canonicalizeJson(body.pre_output);
    const legacyHash = canonicalizeJson(body.legacy_output);
    const divergenceClass = classifyDivergence(preHash, legacyHash, body.is_safety_critical ?? false);
    const rollbackRequired = divergenceClass >= 3;

    // Constitutional guard: CLASS_3/4 must trigger rollback evaluation — never suppress
    assertNoSilentDivergenceSuppression(divergenceClass, rollbackRequired);

    const result = await pool.query<ParityRecord>(
      `INSERT INTO parity_records
         (canary_run_id, screen_id, venue_id, divergence_class,
          rollback_required, pre_output_hash, legacy_output_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, canary_run_id, divergence_class, rollback_required,
                 pre_output_hash, legacy_output_hash, inserted_at`,
      [
        body.canary_run_id,
        body.screen_id,
        body.venue_id,
        divergenceClass,
        rollbackRequired,
        preHash,
        legacyHash,
      ],
    );

    return reply.code(200).send({
      record_id: result.rows[0]?.id,
      divergence_class: divergenceClass,
      rollback_required: rollbackRequired,
      outputs_identical: divergenceClass === 0,
    });
  });

  // ── GET /parity/summary ────────────────────────────────────────────────────
  // Aggregate parity stats across all runs, or filtered by canary_run_id.
  app.get<{ Querystring: { canary_run_id?: string } }>('/parity/summary', async (req, reply) => {
    const { canary_run_id } = req.query;

    let queryText = `
      SELECT
        canary_run_id,
        COUNT(*)::int                                      AS total,
        COUNT(*) FILTER (WHERE divergence_class = 0)::int AS identical,
        COUNT(*) FILTER (WHERE divergence_class = 2)::int AS class_2,
        COUNT(*) FILTER (WHERE divergence_class = 3)::int AS class_3,
        COUNT(*) FILTER (WHERE divergence_class = 4)::int AS class_4,
        COUNT(*) FILTER (WHERE rollback_required)::int    AS rollback_required
      FROM parity_records
    `;
    const params: string[] = [];

    if (canary_run_id) {
      queryText += ' WHERE canary_run_id = $1';
      params.push(canary_run_id);
    }
    queryText += ' GROUP BY canary_run_id ORDER BY canary_run_id';

    const result = await pool.query(queryText, params);
    return reply.code(200).send({ runs: result.rows });
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
