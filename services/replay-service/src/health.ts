export interface HealthResponse {
  readonly status: 'ok' | 'degraded' | 'error';
  readonly service: 'replay-service';
  readonly ts: number;
  readonly checks: {
    readonly database: 'ok' | 'error';
  };
}

export async function registerHealthRoutes(app: import('fastify').FastifyInstance): Promise<void> {
  app.get('/health/live', async (_req, reply) => {
    return reply.code(200).send({ status: 'OK', uptime_s: Math.floor(process.uptime()) });
  });
  app.get('/health/ready', async (_req, reply) => {
    return reply.code(200).send({ status: 'OK' });
  });
}

export function buildHealthResponse(dbOk: boolean): HealthResponse {
  return {
    status: dbOk ? 'ok' : 'degraded',
    service: 'replay-service',
    ts: Date.now(),
    checks: {
      database: dbOk ? 'ok' : 'error',
    },
  };
}
