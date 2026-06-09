import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { hashRecordExcluding } from '@clubhub/fnv-checksum';
import type { ReplayAuditRecord } from '../record-validator.js';

function makeRecord(overrides: Partial<ReplayAuditRecord> = {}): ReplayAuditRecord {
  const base: Omit<ReplayAuditRecord, 'record_checksum'> = {
    audit_record_id: 'rec-001',
    created_at: 1_000_000,
    screen_id: 'screen-1',
    venue_id: 'venue-1',
    at: 1_000_000,
    correlation_id: 'corr-001',
    playlist_checksum: 'abc123',
    resolution_level: 1,
    is_fallback: false,
    invariants_passed: true,
  };
  const merged = { ...base, ...overrides };
  const checksum = hashRecordExcluding(merged as unknown as Record<string, unknown>, 'record_checksum');
  return { ...merged, record_checksum: checksum } as ReplayAuditRecord;
}

function makeMockPool(queryRows: unknown[] = []): Pool {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: queryRows, rowCount: queryRows.length } as QueryResult),
    release: vi.fn(),
  } as unknown as PoolClient;

  return {
    connect: vi.fn().mockResolvedValue(mockClient),
    query: vi.fn().mockResolvedValue({ rows: queryRows, rowCount: queryRows.length } as QueryResult),
  } as unknown as Pool;
}

describe('POST /audit/batch', () => {
  it('returns 400 for empty body', async () => {
    const pool = makeMockPool();
    const app = await buildApp(pool);
    const res = await app.inject({ method: 'POST', url: '/audit/batch', payload: [] });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for non-array body', async () => {
    const pool = makeMockPool();
    const app = await buildApp(pool);
    const res = await app.inject({ method: 'POST', url: '/audit/batch', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 422 when record checksum is invalid', async () => {
    const pool = makeMockPool();
    const app = await buildApp(pool);
    const badRecord = { ...makeRecord(), record_checksum: 'badhash' };
    const res = await app.inject({
      method: 'POST',
      url: '/audit/batch',
      payload: [badRecord],
    });
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.invalid_record_ids).toContain('rec-001');
  });

  it('returns 201 and accepted count for valid batch', async () => {
    const pool = makeMockPool();
    const app = await buildApp(pool);
    const record = makeRecord();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/batch',
      payload: [record],
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.accepted).toBe(1);
  });
});

describe('GET /replay/:id', () => {
  it('returns 404 when record not found', async () => {
    const pool = makeMockPool([]);
    const app = await buildApp(pool);
    const res = await app.inject({ method: 'GET', url: '/replay/nonexistent' });
    expect(res.statusCode).toBe(404);
  });

  it('returns the record when found', async () => {
    const record = makeRecord();
    const pool = makeMockPool([record]);
    const app = await buildApp(pool);
    const res = await app.inject({ method: 'GET', url: '/replay/rec-001' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.audit_record_id).toBe('rec-001');
  });
});

describe('DELETE /replay/:id', () => {
  it('throws AppendOnlyViolationError and returns 500', async () => {
    const pool = makeMockPool();
    const app = await buildApp(pool);
    // The delete handler calls assertAppendOnly which throws — Fastify returns 500
    const res = await app.inject({ method: 'DELETE', url: '/replay/rec-001' });
    expect(res.statusCode).toBe(500);
  });
});
