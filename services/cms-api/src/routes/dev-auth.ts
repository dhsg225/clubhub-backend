/**
 * Dev auth routes — generate test JWTs for local development.
 *
 * Constitutional rules:
 * - NEVER active when NODE_ENV === 'production'
 * - NEVER issues tokens with PLATFORM_ADMIN role via this endpoint
 * - Generated tokens are structural only — no real signature
 *
 * Usage (dev only):
 *   POST /dev/auth/token
 *   Body: { sub, role, enterprise_id, venue_id? }
 *   Returns: { token, claims }
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { generateDevJWT } from '@clubhub/auth-types';
import type { UserRole } from '@clubhub/auth-types';

interface DevTokenBody {
  sub?: string;
  role?: string;
  enterprise_id?: string;
  venue_id?: string;
}

const ALLOWED_DEV_ROLES: UserRole[] = [
  'ENTERPRISE_ADMIN',
  'REGIONAL_MANAGER',
  'VENUE_OPERATOR',
  'SPONSOR_STAKEHOLDER',
  'AUDITOR',
];

export async function registerDevAuthRoutes(app: FastifyInstance): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    // Hard guard: never register dev routes in production
    app.log.warn('Dev auth routes NOT registered (NODE_ENV=production)');
    return;
  }

  app.post<{ Body: DevTokenBody }>(
    '/dev/auth/token',
    async (request: FastifyRequest<{ Body: DevTokenBody }>, reply) => {
      const {
        sub = 'dev-user',
        role = 'VENUE_OPERATOR',
        enterprise_id = '10000000-0000-0000-0000-000000000001',
        venue_id,
      } = request.body ?? {};

      if (!ALLOWED_DEV_ROLES.includes(role as UserRole)) {
        return reply.code(400).send({
          error: `Invalid role. Allowed: ${ALLOWED_DEV_ROLES.join(', ')}`,
          note: 'PLATFORM_ADMIN is not issuable via dev endpoint',
        });
      }

      const token = generateDevJWT(sub, role as UserRole, enterprise_id, venue_id);
      const payloadJson = JSON.parse(
        Buffer.from(token.split('.')[1]!, 'base64url').toString('utf-8'),
      );

      return reply.code(200).send({
        token,
        claims: payloadJson,
        warning: 'Dev token — not cryptographically signed. JWT_VERIFY=false required.',
      });
    },
  );

  app.log.info('Dev auth routes registered (POST /dev/auth/token)');
}
