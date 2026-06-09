import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../app.js';
import type { Pool, QueryResult } from 'pg';

function makeMockPool(insertRows: unknown[] = []): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows: insertRows, rowCount: insertRows.length } as QueryResult),
  } as unknown as Pool;
}

const BASE_BODY = {
  canary_run_id: 'run-001',
  screen_id: 'screen-1',
  venue_id: 'venue-1',
};

describe('POST /parity/compare', () => {
  it('returns 400 when required fields are missing', async () => {
    const app = await buildApp(makeMockPool());
    const res = await app.inject({
      method: 'POST',
      url: '/parity/compare',
      payload: { canary_run_id: 'run-001' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when pre_output or legacy_output is absent', async () => {
    const app = await buildApp(makeMockPool());
    const res = await app.inject({
      method: 'POST',
      url: '/parity/compare',
      payload: { ...BASE_BODY, pre_output: { x: 1 } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('CLASS_0 when outputs are identical', async () => {
    const pool = makeMockPool([{ id: 'pr-001', canary_run_id: 'run-001', divergence_class: 0, rollback_required: false, pre_output_hash: '{}', legacy_output_hash: '{}', inserted_at: new Date().toISOString() }]);
    const app = await buildApp(pool);
    const res = await app.inject({
      method: 'POST',
      url: '/parity/compare',
      payload: { ...BASE_BODY, pre_output: { score: 1 }, legacy_output: { score: 1 } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.divergence_class).toBe(0);
    expect(body.outputs_identical).toBe(true);
    expect(body.rollback_required).toBe(false);
  });

  it('CLASS_2 for non-critical output difference', async () => {
    const pool = makeMockPool([{ id: 'pr-002', canary_run_id: 'run-001', divergence_class: 2, rollback_required: false, pre_output_hash: 'a', legacy_output_hash: 'b', inserted_at: new Date().toISOString() }]);
    const app = await buildApp(pool);
    const res = await app.inject({
      method: 'POST',
      url: '/parity/compare',
      payload: { ...BASE_BODY, pre_output: { score: 1 }, legacy_output: { score: 2 } },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.divergence_class).toBe(2);
    expect(body.rollback_required).toBe(false);
  });

  it('CLASS_3 and rollback_required=true for safety-critical difference', async () => {
    const pool = makeMockPool([{ id: 'pr-003', canary_run_id: 'run-001', divergence_class: 3, rollback_required: true, pre_output_hash: 'a', legacy_output_hash: 'b', inserted_at: new Date().toISOString() }]);
    const app = await buildApp(pool);
    const res = await app.inject({
      method: 'POST',
      url: '/parity/compare',
      payload: { ...BASE_BODY, pre_output: { freeze: false }, legacy_output: { freeze: true }, is_safety_critical: true },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.divergence_class).toBe(3);
    expect(body.rollback_required).toBe(true);
  });
});

describe('GET /parity/summary', () => {
  it('returns 200 with runs array', async () => {
    const pool = makeMockPool([{ canary_run_id: 'run-001', total: 5, identical: 3, class_2: 2, class_3: 0, class_4: 0, rollback_required: 0 }]);
    const app = await buildApp(pool);
    const res = await app.inject({ method: 'GET', url: '/parity/summary' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.runs)).toBe(true);
  });
});
