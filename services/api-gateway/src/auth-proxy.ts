/**
 * Auth proxy — verifies identity at gateway and forwards to downstream services.
 *
 * Downstream services trust X-Verified-* headers — they must ONLY be set by the gateway.
 * Network policy ensures downstream services are not directly reachable.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJWT, isUserClaims, isServiceClaims, JWTVerificationError } from '@clubhub/auth-types';
import { randomUUID } from 'node:crypto';

// Headers forwarded to downstream services (after verification)
const VERIFIED_HEADERS = {
  USER_ID: 'x-verified-user-id',
  ROLE: 'x-verified-role',
  SCOPE: 'x-verified-scope',
  SERVICE_NAME: 'x-verified-service-name',
  ENTERPRISE_ID: 'x-verified-enterprise-id',
  VENUE_ID: 'x-verified-venue-id',
  CORRELATION_ID: 'x-correlation-id',
} as const;

/**
 * Verify JWT at gateway and attach verified identity headers.
 * Downstream services read X-Verified-* headers — they trust the gateway.
 */
export async function verifyAndForwardIdentity(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    await reply.code(401).send({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const correlationId = (request.headers['x-correlation-id'] as string | undefined)
    ?? randomUUID();

  try {
    const claims = verifyJWT(token);

    request.headers[VERIFIED_HEADERS.CORRELATION_ID] = correlationId;

    if (isUserClaims(claims)) {
      request.headers[VERIFIED_HEADERS.USER_ID] = claims.sub;
      request.headers[VERIFIED_HEADERS.SCOPE] = 'USER';
      request.headers[VERIFIED_HEADERS.ROLE] = claims.role;
      request.headers[VERIFIED_HEADERS.ENTERPRISE_ID] = claims.tenant.enterprise_id ?? '';
      request.headers[VERIFIED_HEADERS.VENUE_ID] = claims.tenant.venue_id ?? '';
    } else if (isServiceClaims(claims)) {
      request.headers[VERIFIED_HEADERS.USER_ID] = claims.sub;
      request.headers[VERIFIED_HEADERS.SCOPE] = 'SERVICE';
      request.headers[VERIFIED_HEADERS.SERVICE_NAME] = claims.service_name;
    }
  } catch (err) {
    if (err instanceof JWTVerificationError) {
      await reply.code(401).send({ error: (err as Error).message });
    } else {
      await reply.code(500).send({ error: 'Authentication error' });
    }
  }
}

/**
 * Strip any incoming X-Verified-* headers (prevent header injection).
 * Register as a Fastify preHandler before verifyAndForwardIdentity.
 */
export async function stripVerifiedHeaders(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  for (const header of Object.values(VERIFIED_HEADERS)) {
    delete request.headers[header];
  }
}
