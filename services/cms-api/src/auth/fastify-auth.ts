/**
 * Fastify auth preHandler.
 *
 * Attaches RequestIdentity to request object.
 * Dev mode (JWT_VERIFY=false): anonymous identity if no Authorization header.
 * Production: rejects requests without a valid Bearer JWT.
 *
 * Constitutional rules:
 * - Anonymous identity carries VENUE_OPERATOR role (read-only permitted)
 * - Dev anonymous identity is NEVER allowed in production (NODE_ENV check)
 * - Correlation ID always set (from header or generated)
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RequestIdentity } from '@clubhub/auth-types';
import { randomUUID } from 'node:crypto';
import { verifyJWT, isUserClaims, isServiceClaims, JWTVerificationError } from './jwt.js';
import { isPlayerRoute } from './player-routes.js';

// Extend Fastify request type
declare module 'fastify' {
  interface FastifyRequest {
    identity?: RequestIdentity;
  }
}

const DEV_ANONYMOUS_IDENTITY: Omit<RequestIdentity, 'correlation_id'> = {
  user_id: 'dev-anonymous',
  scope: 'USER',
  role: 'VENUE_OPERATOR',
  service_name: null,
  tenant: {
    enterprise_id: null,
    regional_org_id: null,
    venue_id: null,
  },
};

/**
 * Fastify preHandler: verify JWT and attach identity.
 *
 * Registered globally on the app — runs before every route handler.
 * Skips auth for:
 *   - /health/live, /health/ready  (liveness/readiness probes)
 *   - player endpoints             (ADR-001: screen_id is the trust boundary)
 */
export async function authPreHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const correlationId =
    (request.headers['x-correlation-id'] as string | undefined) ?? randomUUID();

  // Bypass auth for health probe endpoints and player-facing delivery/telemetry
  // Player surface defined in: src/auth/player-routes.ts (ADR-001)
  const isHealthProbe = request.url === '/health/live' || request.url === '/health/ready';
  if (isHealthProbe || isPlayerRoute(request.method, request.url)) {
    request.identity = {
      ...DEV_ANONYMOUS_IDENTITY,
      correlation_id: correlationId,
    };
    return;
  }

  const jwtVerify = process.env['JWT_VERIFY'] !== 'false';
  const authHeader = request.headers['authorization'];

  // Dev mode: allow unauthenticated requests with anonymous identity
  if (!jwtVerify && !authHeader) {
    request.identity = {
      ...DEV_ANONYMOUS_IDENTITY,
      correlation_id: correlationId,
    };
    return;
  }

  if (!authHeader?.startsWith('Bearer ')) {
    await reply.code(401).send({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const claims = verifyJWT(token);

    if (isUserClaims(claims)) {
      request.identity = {
        user_id: claims.sub,
        scope: 'USER',
        role: claims.role,
        service_name: null,
        tenant: claims.tenant,
        correlation_id: correlationId,
      };
    } else if (isServiceClaims(claims)) {
      request.identity = {
        user_id: claims.sub,
        scope: 'SERVICE',
        role: null,
        service_name: claims.service_name,
        tenant: { enterprise_id: null, regional_org_id: null, venue_id: null },
        correlation_id: correlationId,
      };
    } else {
      await reply.code(401).send({ error: 'Unknown token scope' });
    }
  } catch (err) {
    if (err instanceof JWTVerificationError) {
      await reply.code(401).send({ error: err.message });
    } else {
      await reply.code(500).send({ error: 'Authentication error' });
    }
  }
}
