import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock ───────────────────────────────────────────────────────────────────

const { mockQuery, mockWithTransaction } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockWithTransaction: vi.fn(),
}));

vi.mock('../db/pool.js', () => ({
  query: mockQuery,
  withTransaction: mockWithTransaction,
}));

import Fastify from 'fastify';
import { registerReEnrollmentRoutes } from '../routes/re-enrollment.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

function buildApp() {
  const app = Fastify({ logger: false });
  registerReEnrollmentRoutes(app);
  return app;
}

function mockQuerySequence(responses: unknown[][]): void {
  let callIndex = 0;
  mockQuery.mockImplementation(() => {
    const response = responses[callIndex] ?? [];
    callIndex++;
    return Promise.resolve(response);
  });
}

// ── POST /api/v2/screens/:screen_id/re-enrollment-token ───────────────────────

describe('POST /api/v2/screens/:screen_id/re-enrollment-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when screen_id does not exist', async () => {
    const app = buildApp();
    // screens query returns empty
    mockQuerySequence([[]]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/screens/nonexistent-screen/re-enrollment-token',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reason: 'Hardware failure',
        issued_by: 'operator@venue.com',
      }),
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/Screen not found/i);
  });

  it('returns 400 when reason is missing', async () => {
    const app = buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/screens/screen-001/re-enrollment-token',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        issued_by: 'operator@venue.com',
        // reason is missing
      }),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/reason and issued_by are required/i);
  });

  it('returns 400 when issued_by is missing', async () => {
    const app = buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/screens/screen-001/re-enrollment-token',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reason: 'Hardware failure',
        // issued_by is missing
      }),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/reason and issued_by are required/i);
  });

  it('returns 201 with token when screen exists and fields provided', async () => {
    const app = buildApp();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    mockQuerySequence([
      [{ screen_id: 'screen-001', name: 'Bar TV 1', venue_id: 'venue-001' }],  // screen lookup
      [],  // invalidate old tokens
      [{ token_id: 'tok-001', token: 'abc123def456', expires_at: expiresAt }],  // insert new token
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/screens/screen-001/re-enrollment-token',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reason: 'Pi SD card corrupted — replacing hardware',
        issued_by: 'operator@venue.com',
      }),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.token).toBe('abc123def456');
    expect(body.token_id).toBe('tok-001');
    expect(body.screen_id).toBe('screen-001');
    expect(body.screen_name).toBe('Bar TV 1');
    expect(body.venue_id).toBe('venue-001');
    expect(body.expires_at).toBeDefined();
    expect(body.instructions).toBeDefined();
  });

  it('invalidates existing active token and issues a new one (idempotent — new token)', async () => {
    const app = buildApp();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Existing active token is invalidated, new one created
    mockQuerySequence([
      [{ screen_id: 'screen-001', name: 'Bar TV 1', venue_id: 'venue-001' }],
      [],  // UPDATE expires_at = now() on old token (invalidated)
      [{ token_id: 'tok-002', token: 'newtoken789', expires_at: expiresAt }],
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/screens/screen-001/re-enrollment-token',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reason: 'Re-issuing — previous token lost',
        issued_by: 'operator@venue.com',
      }),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    // New token should differ from any old one
    expect(body.token).toBe('newtoken789');
    expect(body.token_id).toBe('tok-002');

    // Verify the invalidation query was called
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE screen_re_enrollment_tokens'),
      expect.arrayContaining(['screen-001']),
    );
  });
});

// ── POST /api/v2/enrollment/re-enroll ─────────────────────────────────────────

describe('POST /api/v2/enrollment/re-enroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when token is not found', async () => {
    const app = buildApp();
    mockQuerySequence([[]]); // token lookup returns empty

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/enrollment/re-enroll',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: 'nonexistent-token-value',
        hardware_id: 'pi-serial-abc123',
        firmware_version: 'Raspberry Pi 4 Model B Rev 1.4',
      }),
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/Invalid re-enrollment token/i);
  });

  it('returns 409 when token has already been used', async () => {
    const app = buildApp();
    mockQuerySequence([
      [{
        token_id: 'tok-001',
        screen_id: 'screen-001',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        used_at: new Date(Date.now() - 60 * 1000),  // used 1 minute ago
        venue_id: 'venue-001',
      }],
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/enrollment/re-enroll',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: 'already-used-token',
        hardware_id: 'pi-serial-abc123',
        firmware_version: 'Raspberry Pi 4 Model B Rev 1.4',
      }),
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/Token already used/i);
  });

  it('returns 410 when token has expired', async () => {
    const app = buildApp();
    mockQuerySequence([
      [{
        token_id: 'tok-001',
        screen_id: 'screen-001',
        expires_at: new Date(Date.now() - 10 * 60 * 1000),  // expired 10 minutes ago
        used_at: null,
        venue_id: 'venue-001',
      }],
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/enrollment/re-enroll',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: 'expired-token-value',
        hardware_id: 'pi-serial-def456',
        firmware_version: 'Raspberry Pi 4 Model B Rev 1.4',
      }),
    });

    expect(res.statusCode).toBe(410);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/Token expired/i);
  });

  it('returns 200 with screen_id/venue_id on valid token, marks token used', async () => {
    const app = buildApp();
    const tokenRow = {
      token_id: 'tok-001',
      screen_id: 'screen-001',
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000),
      used_at: null,
      venue_id: 'venue-001',
    };

    mockQuerySequence([[tokenRow]]);

    mockWithTransaction.mockImplementation(async (fn: (q: typeof mockQuery) => Promise<unknown>) => {
      const txQuery = vi.fn()
        .mockResolvedValueOnce([])  // UPDATE token used_at
        .mockResolvedValueOnce([]); // UPDATE screens hardware_id
      return fn(txQuery);
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/enrollment/re-enroll',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: 'valid-token-value',
        hardware_id: 'new-pi-serial-xyz789',
        firmware_version: 'Raspberry Pi 4 Model B Rev 1.5',
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.screen_id).toBe('screen-001');
    expect(body.venue_id).toBe('venue-001');
    expect(body.re_enrolled).toBe(true);
    expect(body.hardware_id).toBe('new-pi-serial-xyz789');
    expect(body.enrolled_at).toBeDefined();

    // Verify transaction was used (atomic mark-used + update)
    expect(mockWithTransaction).toHaveBeenCalledOnce();
  });

  it('returns 400 when token field is missing', async () => {
    const app = buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/enrollment/re-enroll',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        hardware_id: 'pi-serial-abc123',
        // token is missing
      }),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/token and hardware_id are required/i);
  });

  it('returns 400 when hardware_id field is missing', async () => {
    const app = buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/enrollment/re-enroll',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: 'some-token-value',
        // hardware_id is missing
      }),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/token and hardware_id are required/i);
  });
});
