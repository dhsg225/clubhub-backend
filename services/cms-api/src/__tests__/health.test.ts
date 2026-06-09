import { describe, it, expect } from 'vitest';
import { buildHealthResponse, livenessCheck, readinessCheck } from '../health.js';

describe('health', () => {
  it('returns ok when all checks pass', () => {
    const resp = buildHealthResponse(true, true);
    expect(resp.status).toBe('ok');
    expect(resp.service).toBe('cms-api');
    expect(resp.checks.database).toBe('ok');
  });

  it('returns error when database is down', () => {
    const resp = buildHealthResponse(false, null);
    expect(resp.status).toBe('error');
    expect(resp.checks.database).toBe('error');
  });

  it('returns degraded when corpus_publisher is down but db is ok', () => {
    const resp = buildHealthResponse(true, false);
    expect(resp.status).toBe('degraded');
  });

  it('liveness always returns true', () => {
    expect(livenessCheck().alive).toBe(true);
  });

  it('readiness fails when db is down', () => {
    const result = readinessCheck(false);
    expect(result.ready).toBe(false);
    expect(result.reason).toBe('database_unavailable');
  });
});
