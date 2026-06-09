import { describe, it, expect } from 'vitest';
import { checkConstitutionalPermission } from '../constitutional-middleware.js';
import { verifyAndForwardIdentity, stripVerifiedHeaders } from '../auth-proxy.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

// ── stripVerifiedHeaders ───────────────────────────────────────────────────

describe('stripVerifiedHeaders', () => {
  it('removes all x-verified-* headers from request', async () => {
    const req = {
      headers: {
        'x-verified-user-id': 'injected',
        'x-verified-role': 'PLATFORM_ADMIN',
        'x-verified-scope': 'USER',
        'x-verified-service-name': 'evil-service',
        'x-verified-enterprise-id': 'ent-1',
        'x-verified-venue-id': 'venue-1',
        'x-correlation-id': 'corr-1',
        'authorization': 'Bearer legit',
      },
    } as unknown as FastifyRequest;
    const reply = {} as FastifyReply;

    await stripVerifiedHeaders(req, reply);

    expect(req.headers['x-verified-user-id']).toBeUndefined();
    expect(req.headers['x-verified-role']).toBeUndefined();
    expect(req.headers['authorization']).toBe('Bearer legit'); // preserved
  });
});

// ── verifyAndForwardIdentity ───────────────────────────────────────────────

describe('verifyAndForwardIdentity', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const req = { headers: {} } as unknown as FastifyRequest;
    let sentCode = 0;
    let sentBody: unknown = null;
    const reply = {
      code: (c: number) => { sentCode = c; return reply; },
      send: async (b: unknown) => { sentBody = b; },
    } as unknown as FastifyReply;

    await verifyAndForwardIdentity(req, reply);

    expect(sentCode).toBe(401);
    expect((sentBody as { error: string }).error).toMatch(/Missing authorization/);
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const req = { headers: { authorization: 'Basic abc123' } } as unknown as FastifyRequest;
    let sentCode = 0;
    const reply = {
      code: (c: number) => { sentCode = c; return reply; },
      send: async () => {},
    } as unknown as FastifyReply;

    await verifyAndForwardIdentity(req, reply);

    expect(sentCode).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const req = { headers: { authorization: 'Bearer not.a.real.jwt' } } as unknown as FastifyRequest;
    let sentCode = 0;
    const reply = {
      code: (c: number) => { sentCode = c; return reply; },
      send: async () => {},
    } as unknown as FastifyReply;

    await verifyAndForwardIdentity(req, reply);

    expect(sentCode).toBe(401);
  });
});

// ── Constitutional state checks (re-verified here for completeness) ────────

describe('checkConstitutionalPermission — gateway integration', () => {
  it('allows GET /venues in HEALTHY state', () => {
    const result = checkConstitutionalPermission({ method: 'GET', path: '/venues' }, 'HEALTHY');
    expect(result.allowed).toBe(true);
  });

  it('blocks POST /screens in READ_ONLY state', () => {
    const result = checkConstitutionalPermission({ method: 'POST', path: '/screens/enroll' }, 'READ_ONLY');
    expect(result.allowed).toBe(false);
    expect(result.httpStatus).toBe(423);
  });

  it('blocks GET /venues in EMERGENCY_FREEZE state', () => {
    const result = checkConstitutionalPermission({ method: 'GET', path: '/venues' }, 'EMERGENCY_FREEZE');
    expect(result.allowed).toBe(false);
    expect(result.httpStatus).toBe(503);
  });
});
