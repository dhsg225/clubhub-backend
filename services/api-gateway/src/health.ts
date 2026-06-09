export interface HealthResponse {
  readonly status: 'ok' | 'degraded' | 'error';
  readonly service: 'api-gateway';
  readonly ts: number;
  readonly checks: {
    readonly cms_api: 'ok' | 'error' | 'unknown';
    readonly replay_service: 'ok' | 'error' | 'unknown';
    readonly entropy_service: 'ok' | 'error' | 'unknown';
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

export function buildHealthResponse(upstreamStatus: {
  cms_api: boolean;
  replay_service: boolean;
  entropy_service: boolean;
}): HealthResponse {
  const allOk =
    upstreamStatus.cms_api && upstreamStatus.replay_service && upstreamStatus.entropy_service;
  return {
    status: allOk ? 'ok' : 'degraded',
    service: 'api-gateway',
    ts: Date.now(),
    checks: {
      cms_api: upstreamStatus.cms_api ? 'ok' : 'error',
      replay_service: upstreamStatus.replay_service ? 'ok' : 'error',
      entropy_service: upstreamStatus.entropy_service ? 'ok' : 'error',
    },
  };
}
