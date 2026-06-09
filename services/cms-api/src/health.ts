import type { FastifyInstance } from 'fastify';

// ─── Testable health primitives ───────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  checks: {
    database: 'ok' | 'error';
    corpus_publisher: 'ok' | 'degraded' | 'error' | 'unknown';
  };
}

export function buildHealthResponse(
  dbOk: boolean,
  corpusPublisherOk: boolean | null,
): HealthResponse {
  const dbStatus = dbOk ? 'ok' : 'error';
  const corpusStatus: HealthResponse['checks']['corpus_publisher'] =
    corpusPublisherOk === null ? 'unknown' :
    corpusPublisherOk ? 'ok' : 'degraded';

  const overallStatus: HealthResponse['status'] =
    !dbOk ? 'error' :
    corpusPublisherOk === false ? 'degraded' :
    'ok';

  return {
    status: overallStatus,
    service: 'cms-api',
    checks: {
      database: dbStatus,
      corpus_publisher: corpusStatus,
    },
  };
}

export function livenessCheck(): { alive: boolean } {
  return { alive: true };
}

export function readinessCheck(dbReady: boolean): { ready: boolean; reason?: string } {
  if (!dbReady) {
    return { ready: false, reason: 'database_unavailable' };
  }
  return { ready: true };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health/live', async (_request, reply) => {
    return reply.code(200).send({ status: 'OK', uptime_s: Math.floor(process.uptime()) });
  });

  app.get('/health/ready', async (_request, reply) => {
    return reply.code(200).send({ status: 'OK' });
  });
}
