/**
 * freeze-status.test.ts
 *
 * Validates the three correctness fixes applied in this remediation:
 *
 *  Fix 1 — Transaction: freeze writes use withTransaction, not bare query.
 *           A mid-write crash cannot leave two is_current=TRUE rows.
 *
 *  Fix 2 — Unique index enforcement: concurrent freeze requests are safe.
 *           The DB partial unique index is the hard constraint; this test
 *           verifies the application surfaces a clean error on conflict.
 *
 *  Fix 3 — Empty-result behavior: GET /freeze-status always returns a
 *           deterministic response. No row → { state: "ACTIVE" }, not 404.
 *
 * Success criteria:
 *   - All three tests pass
 *   - withTransaction is called for every write (never raw query)
 *   - GET /freeze-status never returns 404 or an empty body
 *   - Concurrent conflict (unique index violation) returns 409, not 500
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock ───────────────────────────────────────────────────────────────────
// vi.mock is hoisted to top of file by Vitest — use vi.hoisted() so mock
// variables are available when the factory runs.

const { mockQuery, mockWithTransaction } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockWithTransaction: vi.fn(),
}));

vi.mock('../db/pool.js', () => ({
  query: mockQuery,
  withTransaction: mockWithTransaction,
}));

import Fastify from 'fastify';
import { registerFreezeStatusRoutes } from '../routes/freeze-status.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = Fastify({ logger: false });
  registerFreezeStatusRoutes(app);
  return app;
}

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

// ── FIX 3 — Empty-result behavior ────────────────────────────────────────────
// GET /freeze-status must return { state: "ACTIVE" } when no row exists.
// Never 404. Never empty. Never an exception.

describe('GET /api/v2/freeze-status — empty result (Fix 3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns state=ACTIVE when no freeze row exists for tenant', async () => {
    const app = buildApp();
    mockQuery.mockResolvedValueOnce([]); // no rows

    const res = await app.inject({
      method: 'GET',
      url: `/api/v2/freeze-status?tenant_id=${TENANT_ID}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.state).toBe('ACTIVE');
    expect(body.tenant_id).toBe(TENANT_ID);
    // updated_at and reason are null — that is correct for a never-frozen tenant
    expect(body.updated_at).toBeNull();
  });

  it('returns 400 when tenant_id query param is missing', async () => {
    const app = buildApp();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v2/freeze-status',
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/tenant_id is required/i);
  });

  it('returns correct FROZEN state when a freeze row exists', async () => {
    const app = buildApp();
    const frozenAt = new Date('2026-05-28T10:00:00Z');
    mockQuery.mockResolvedValueOnce([
      { state: 'FROZEN', created_at: frozenAt, reason: 'Emergency test' },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v2/freeze-status?tenant_id=${TENANT_ID}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.state).toBe('FROZEN');
    expect(body.reason).toBe('Emergency test');
    expect(body.updated_at).toBeTruthy();
  });
});

// ── FIX 1 — Transaction usage ─────────────────────────────────────────────────
// POST /freeze and POST /unfreeze must use withTransaction, not raw query.
// This test verifies withTransaction is invoked — the DB-level atomicity
// is guaranteed by the withTransaction helper itself (BEGIN/COMMIT/ROLLBACK).

describe('POST /api/v2/tenants/:tenant_id/freeze — transaction usage (Fix 1)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls withTransaction when issuing a freeze', async () => {
    const app = buildApp();

    // First query: check current state → not frozen
    mockQuery.mockResolvedValueOnce([]);
    // withTransaction: simulate successful commit
    mockWithTransaction.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v2/tenants/${TENANT_ID}/freeze`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Emergency stop' }),
    });

    expect(res.statusCode).toBe(201);
    // CRITICAL: write must go through withTransaction, not bare query
    expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    const body = JSON.parse(res.body);
    expect(body.state).toBe('FROZEN');
  });

  it('does NOT call withTransaction when already frozen (idempotent)', async () => {
    const app = buildApp();

    // Current state: already frozen
    mockQuery.mockResolvedValueOnce([{ state: 'FROZEN' }]);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v2/tenants/${TENANT_ID}/freeze`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.statusCode).toBe(200);
    // No write needed — already frozen
    expect(mockWithTransaction).not.toHaveBeenCalled();
    const body = JSON.parse(res.body);
    expect(body.state).toBe('FROZEN');
    expect(body.message).toMatch(/already frozen/i);
  });

  it('calls withTransaction when clearing a freeze', async () => {
    const app = buildApp();

    // Current state: frozen
    mockQuery.mockResolvedValueOnce([{ state: 'FROZEN' }]);
    mockWithTransaction.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v2/tenants/${TENANT_ID}/unfreeze`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Incident resolved' }),
    });

    expect(res.statusCode).toBe(200);
    expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    const body = JSON.parse(res.body);
    expect(body.state).toBe('ACTIVE');
  });
});

// ── FIX 2 — Concurrent conflict handling ─────────────────────────────────────
// If two freeze requests race and the unique index rejects the second insert,
// the application must return 409, not an unhandled 500.
// The unique index (WHERE is_current = TRUE) is the hard DB-level constraint.
// This test verifies the application handles the conflict gracefully.

describe('POST /api/v2/tenants/:tenant_id/freeze — concurrent conflict (Fix 2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 409 when unique index conflict occurs on concurrent freeze', async () => {
    const app = buildApp();

    // Current state: not frozen (check passes)
    mockQuery.mockResolvedValueOnce([]);

    // withTransaction throws unique violation (simulating concurrent freeze winning the race)
    const pgUniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    });
    mockWithTransaction.mockRejectedValueOnce(pgUniqueViolation);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v2/tenants/${TENANT_ID}/freeze`,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Concurrent freeze' }),
    });

    // Must be 409 (conflict), not 500 (unhandled error)
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/concurrent freeze/i);
  });
});
