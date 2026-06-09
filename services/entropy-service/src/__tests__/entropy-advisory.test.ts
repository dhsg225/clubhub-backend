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

describe('GET /entropy/advisory/:venue_id', () => {
  it('returns NONE when no scan exists for venue', async () => {
    const pool = makeMockPool(() => ({ rows: [] }));
    const app = await buildApp(pool);

    const resp = await app.inject({
      method: 'GET',
      url: '/entropy/advisory/venue-001',
    });

    expect(resp.statusCode).toBe(200);
    const body = resp.json<{ venue_id: string; severity: string; last_scanned_at: null }>();
    expect(body.severity).toBe('NONE');
    expect(body.last_scanned_at).toBeNull();
  });

  it('returns latest report when a scan exists', async () => {
    const report = {
      entropy_report_id: 'rpt-001',
      venue_id: 'venue-001',
      scanned_at: '2026-06-09T00:00:00Z',
      severity: 'ADVISORY',
      affected_screen_ids: ['screen-001'],
      missing_asset_ids: [],
      checksum_mismatches: 1,
      acknowledged_at: null,
      acknowledged_by: null,
    };
    const pool = makeMockPool(() => ({ rows: [report] }));
    const app = await buildApp(pool);

    const resp = await app.inject({
      method: 'GET',
      url: '/entropy/advisory/venue-001',
    });

    expect(resp.statusCode).toBe(200);
    const body = resp.json<{
      severity: string;
      affected_screen_count: number;
      checksum_mismatches: number;
      acknowledged: boolean;
    }>();
    expect(body.severity).toBe('ADVISORY');
    expect(body.affected_screen_count).toBe(1);
    expect(body.checksum_mismatches).toBe(1);
    expect(body.acknowledged).toBe(false);
  });

  it('returns acknowledged=true when acknowledged_at is set', async () => {
    const report = {
      entropy_report_id: 'rpt-002',
      venue_id: 'venue-002',
      scanned_at: '2026-06-09T01:00:00Z',
      severity: 'WARNING',
      affected_screen_ids: [],
      missing_asset_ids: ['asset-abc'],
      checksum_mismatches: 0,
      acknowledged_at: '2026-06-09T02:00:00Z',
      acknowledged_by: 'operator@venue.com',
    };
    const pool = makeMockPool(() => ({ rows: [report] }));
    const app = await buildApp(pool);

    const resp = await app.inject({
      method: 'GET',
      url: '/entropy/advisory/venue-002',
    });

    expect(resp.statusCode).toBe(200);
    const body = resp.json<{ acknowledged: boolean }>();
    expect(body.acknowledged).toBe(true);
  });
});
