import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock ───────────────────────────────────────────────────────────────────
// Mirrors the pattern used in health.test.ts — mock the pool module so no real
// database connection is needed.

const { mockQuery, mockWithTransaction } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockWithTransaction: vi.fn(),
}));

vi.mock('../db/pool.js', () => ({
  query: mockQuery,
  withTransaction: mockWithTransaction,
}));

// Import routes after mock is established
import Fastify from 'fastify';
import { registerDeploymentApprovalRoutes } from '../routes/deployment-approval.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

function buildApp() {
  const app = Fastify({ logger: false });
  registerDeploymentApprovalRoutes(app);
  return app;
}

// Helper: configure mockQuery to return specific values per call in sequence.
// Each call to mockQuery pops from the front of the provided array.
function mockQuerySequence(responses: unknown[][]): void {
  let callIndex = 0;
  mockQuery.mockImplementation(() => {
    const response = responses[callIndex] ?? [];
    callIndex++;
    return Promise.resolve(response);
  });
}

// ── GET /api/v2/canary/status/:deployment_group_id ────────────────────────────

describe('GET /api/v2/canary/status/:deployment_group_id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when no canary exists for the group', async () => {
    const app = buildApp();
    // First query: corpus_deployments — empty
    mockQuerySequence([[]]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v2/canary/status/group-does-not-exist',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/No deployments found/i);
  });

  it('returns current stage and freeze state for existing deployment', async () => {
    const app = buildApp();
    const deploymentRow = {
      corpus_deployment_id: 'dep-001',
      corpus_version_id: 'cv-abc',
      canary_stage: 'SHADOW_ONLY',
      deployed_at: new Date('2026-05-28T10:00:00Z'),
      deployed_by: 'operator@example.com',
    };

    mockQuerySequence([
      [deploymentRow],          // current deployment
      [],                       // canary_stage_history (no history yet)
      [],                       // constitutional_freeze_active (not frozen)
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v2/canary/status/group-001',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.deployment_group_id).toBe('group-001');
    expect(body.current_stage).toBe('SHADOW_ONLY');
    expect(body.next_stage).toBe('INTERNAL_CANARY');
    expect(body.is_authoritative).toBe(false);
    expect(body.constitutional_freeze_active).toBe(false);
  });

  it('reports next_stage as null when deployment is AUTHORITATIVE', async () => {
    const app = buildApp();
    const deploymentRow = {
      corpus_deployment_id: 'dep-002',
      corpus_version_id: 'cv-def',
      canary_stage: 'AUTHORITATIVE',
      deployed_at: new Date('2026-05-28T11:00:00Z'),
      deployed_by: 'operator@example.com',
    };

    mockQuerySequence([
      [deploymentRow],
      [],
      [],
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v2/canary/status/group-002',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.is_authoritative).toBe(true);
    expect(body.next_stage).toBeNull();
  });

  it('surfaces constitutional freeze when active', async () => {
    const app = buildApp();
    const deploymentRow = {
      corpus_deployment_id: 'dep-003',
      corpus_version_id: 'cv-ghi',
      canary_stage: 'INTERNAL_CANARY',
      deployed_at: new Date(),
      deployed_by: 'op@example.com',
    };

    mockQuerySequence([
      [deploymentRow],
      [],
      [{ is_frozen: true, reason: 'P1 incident active' }],
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v2/canary/status/group-003',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.constitutional_freeze_active).toBe(true);
    expect(body.constitutional_freeze_reason).toBe('P1 incident active');
  });
});

// ── POST /api/v2/canary/advance ───────────────────────────────────────────────

describe('POST /api/v2/canary/advance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 409 when constitutional freeze is active', async () => {
    const app = buildApp();
    // freeze check returns active freeze
    mockQuerySequence([
      [{ is_frozen: true, reason: 'Emergency override active' }],
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/canary/advance',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deployment_group_id: 'group-001',
        target_stage: 'INTERNAL_CANARY',
        operator_id: 'op@example.com',
        human_approval_token: 'valid-token-here',
        reason: 'Ready to advance',
      }),
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/CONSTITUTIONAL FREEZE/i);
  });

  it('returns 409 when trying to skip stages (non-sequential)', async () => {
    const app = buildApp();
    mockQuerySequence([
      [],  // no active freeze
      [{
        corpus_deployment_id: 'dep-001',
        corpus_version_id: 'cv-abc',
        canary_stage: 'SHADOW_ONLY',
        enterprise_group_id: 'ent-001',
      }],
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/canary/advance',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deployment_group_id: 'group-001',
        target_stage: 'SINGLE_VENUE',  // skips INTERNAL_CANARY
        operator_id: 'op@example.com',
        human_approval_token: 'valid-token-here',
        reason: 'Trying to skip a stage',
      }),
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/Cannot skip canary stages/i);
    expect(body.expected_next).toBe('INTERNAL_CANARY');
  });

  it('returns 403 when human_approval_token is missing for non-SHADOW_ONLY advance', async () => {
    const app = buildApp();
    // No DB queries needed — check happens before DB access
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/canary/advance',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deployment_group_id: 'group-001',
        target_stage: 'INTERNAL_CANARY',
        operator_id: 'op@example.com',
        // no human_approval_token
        reason: 'Forgot approval token',
      }),
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/CONSTITUTIONAL VIOLATION/i);
  });

  it('returns 409 when health gates fail (no recent heartbeats)', async () => {
    const app = buildApp();
    mockQuerySequence([
      [],  // no active freeze
      [{
        corpus_deployment_id: 'dep-001',
        corpus_version_id: 'cv-abc',
        canary_stage: 'SHADOW_ONLY',
        enterprise_group_id: 'ent-001',
      }],
      [{ count: '0' }],  // concurrency check — 0 other active canaries
      // health checks: stale screens
      [{ screen_id: 's1', screen_name: 'Bar TV', last_heartbeat_at: new Date(Date.now() - 10 * 60 * 1000) }],
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/canary/advance',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deployment_group_id: 'group-001',
        target_stage: 'INTERNAL_CANARY',
        operator_id: 'op@example.com',
        human_approval_token: 'approved-by-human',
        reason: 'Health gate should block this',
      }),
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/health gate failed/i);
  });

  it('returns 201 when all conditions met and advances the stage', async () => {
    const app = buildApp();
    const newDeploymentId = 'dep-new-001';

    mockQuerySequence([
      [],  // no active freeze
      [{
        corpus_deployment_id: 'dep-001',
        corpus_version_id: 'cv-abc',
        canary_stage: 'SHADOW_ONLY',
        enterprise_group_id: 'ent-001',
      }],
      [{ count: '0' }],  // concurrency — 0 other canaries
      [],                // health: no stale screens
      [],                // health: no emergency screens
      [],                // health: no high-failure screens
      [{ count: '0' }],  // health: no recent incidents
      [{ count: '0' }],  // health: no pending commands
    ]);

    mockWithTransaction.mockImplementation(async (fn: (q: typeof mockQuery) => Promise<unknown>) => {
      const txQuery = vi.fn()
        .mockResolvedValueOnce([{ corpus_deployment_id: newDeploymentId }])
        .mockResolvedValueOnce([]);
      return fn(txQuery);
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/canary/advance',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deployment_group_id: 'group-001',
        target_stage: 'INTERNAL_CANARY',
        operator_id: 'op@example.com',
        human_approval_token: 'human-reviewed-approved',
        reason: 'All checks pass — advancing',
      }),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.from_stage).toBe('SHADOW_ONLY');
    expect(body.to_stage).toBe('INTERNAL_CANARY');
    expect(body.advanced_by).toBe('op@example.com');
  });
});

// ── POST /api/v2/canary/abort ─────────────────────────────────────────────────

describe('POST /api/v2/canary/abort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when no deployment exists for the group', async () => {
    const app = buildApp();
    mockQuerySequence([[]]); // no current deployment

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/canary/abort',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deployment_group_id: 'nonexistent-group',
        operator_id: 'op@example.com',
        reason: 'Something went wrong',
      }),
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/No deployment found/i);
  });

  it('returns 409 when deployment is already AUTHORITATIVE (nothing to abort)', async () => {
    const app = buildApp();
    mockQuerySequence([
      [{
        corpus_version_id: 'cv-abc',
        canary_stage: 'AUTHORITATIVE',
        enterprise_group_id: 'ent-001',
      }],
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/canary/abort',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deployment_group_id: 'group-001',
        operator_id: 'op@example.com',
        reason: 'Trying to abort authoritative',
      }),
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/already AUTHORITATIVE/i);
  });

  it('returns 200 and creates rollback deployment with abort metadata', async () => {
    const app = buildApp();
    const rollbackDeploymentId = 'dep-rollback-001';

    mockQuerySequence([
      [{
        corpus_version_id: 'cv-new',
        canary_stage: 'INTERNAL_CANARY',
        enterprise_group_id: 'ent-001',
      }],
      [{
        corpus_version_id: 'cv-stable',
        corpus_deployment_id: 'dep-stable',
      }],
    ]);

    mockWithTransaction.mockImplementation(async (fn: (q: typeof mockQuery) => Promise<unknown>) => {
      const txQuery = vi.fn()
        .mockResolvedValueOnce([{ corpus_deployment_id: rollbackDeploymentId }])
        .mockResolvedValueOnce([]);
      return fn(txQuery);
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/canary/abort',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deployment_group_id: 'group-001',
        operator_id: 'op@example.com',
        reason: 'Error rate spiked — aborting canary',
      }),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.aborted_from_stage).toBe('INTERNAL_CANARY');
    expect(body.rollback_to_corpus_version_id).toBe('cv-stable');
    expect(body.aborted_by).toBe('op@example.com');
    expect(body.corpus_deployment_id).toBe(rollbackDeploymentId);
  });

  it('returns 400 when required fields are missing', async () => {
    const app = buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/canary/abort',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deployment_group_id: 'group-001',
        // missing operator_id and reason
      }),
    });

    expect(res.statusCode).toBe(400);
  });
});
