import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { buildApp } from '../app.js';

function makeMockClient(queryImpl: (sql: string, params?: unknown[]) => { rows: unknown[] }): PoolClient {
  return {
    query: vi.fn((sql: string, params?: unknown[]) => Promise.resolve(queryImpl(sql, params))),
    release: vi.fn(),
  } as unknown as PoolClient;
}

function makeMockPool(queryImpl: (sql: string, params?: unknown[]) => { rows: unknown[] }): Pool {
  return {
    connect: vi.fn(() => Promise.resolve(makeMockClient(queryImpl))),
  } as unknown as Pool;
}

describe('POST /audit/event', () => {
  it('returns 201 with event_id on valid payload', async () => {
    const fakeId = 'aaaaaaaa-0000-0000-0000-000000000001';
    const pool = makeMockPool(() => ({
      rows: [{ event_id: fakeId, recorded_at: '2026-06-09T00:00:00Z' }],
    }));

    const app = await buildApp(pool);
    const resp = await app.inject({
      method: 'POST',
      url: '/audit/event',
      payload: { event_type: 'CONSTITUTIONAL_STATE_TRANSITION', payload: { from: 'HEALTHY', to: 'DEGRADED' } },
    });

    expect(resp.statusCode).toBe(201);
    const body = resp.json<{ event_id: string; recorded_at: string }>();
    expect(body.event_id).toBe(fakeId);
    expect(body.recorded_at).toBe('2026-06-09T00:00:00Z');
  });

  it('returns 400 when event_type is missing', async () => {
    const pool = makeMockPool(() => ({ rows: [] }));
    const app = await buildApp(pool);

    const resp = await app.inject({
      method: 'POST',
      url: '/audit/event',
      payload: { payload: { from: 'HEALTHY', to: 'DEGRADED' } },
    });

    expect(resp.statusCode).toBe(400);
    const body = resp.json<{ error: string }>();
    expect(body.error).toMatch(/event_type/);
  });

  it('returns 400 when payload is missing', async () => {
    const pool = makeMockPool(() => ({ rows: [] }));
    const app = await buildApp(pool);

    const resp = await app.inject({
      method: 'POST',
      url: '/audit/event',
      payload: { event_type: 'CONSTITUTIONAL_STATE_TRANSITION' },
    });

    expect(resp.statusCode).toBe(400);
  });
});

describe('GET /audit/events', () => {
  it('returns events list', async () => {
    const events = [
      {
        event_id: 'aaaaaaaa-0000-0000-0000-000000000001',
        event_type: 'CONSTITUTIONAL_STATE_TRANSITION',
        payload: { from: 'HEALTHY', to: 'DEGRADED' },
        screen_id: null,
        venue_id: 'venue-001',
        recorded_at: '2026-06-09T00:00:00Z',
      },
    ];
    const pool = makeMockPool(() => ({ rows: events }));
    const app = await buildApp(pool);

    const resp = await app.inject({ method: 'GET', url: '/audit/events' });

    expect(resp.statusCode).toBe(200);
    const body = resp.json<{ events: unknown[]; count: number }>();
    expect(body.count).toBe(1);
    expect(body.events).toHaveLength(1);
  });

  it('returns empty list when no events match', async () => {
    const pool = makeMockPool(() => ({ rows: [] }));
    const app = await buildApp(pool);

    const resp = await app.inject({ method: 'GET', url: '/audit/events?type=UNKNOWN_TYPE' });

    expect(resp.statusCode).toBe(200);
    const body = resp.json<{ count: number }>();
    expect(body.count).toBe(0);
  });
});
