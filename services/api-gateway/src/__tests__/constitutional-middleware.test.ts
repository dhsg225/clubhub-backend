import { describe, it, expect } from 'vitest';
import { checkConstitutionalPermission } from '../constitutional-middleware.js';

describe('ConstitutionalMiddleware', () => {
  it('allows GET in READ_ONLY state', () => {
    const result = checkConstitutionalPermission(
      { method: 'GET', path: '/api/v1/venues' },
      'READ_ONLY',
    );
    expect(result.allowed).toBe(true);
  });

  it('blocks POST in READ_ONLY state', () => {
    const result = checkConstitutionalPermission(
      { method: 'POST', path: '/api/v1/campaigns' },
      'READ_ONLY',
    );
    expect(result.allowed).toBe(false);
    expect(result.httpStatus).toBe(423);
    expect(result.reason).toBe('SYSTEM_READ_ONLY');
  });

  it('allows POST to /emergency/ in READ_ONLY state', () => {
    const result = checkConstitutionalPermission(
      { method: 'POST', path: '/api/v1/emergency/trigger' },
      'READ_ONLY',
    );
    expect(result.allowed).toBe(true);
  });

  it('blocks all non-emergency routes in EMERGENCY_FREEZE', () => {
    const result = checkConstitutionalPermission(
      { method: 'GET', path: '/api/v1/venues' },
      'EMERGENCY_FREEZE',
    );
    expect(result.allowed).toBe(false);
    expect(result.httpStatus).toBe(503);
  });

  it('allows emergency routes in EMERGENCY_FREEZE', () => {
    const result = checkConstitutionalPermission(
      { method: 'POST', path: '/api/v2/emergency/trigger' },
      'EMERGENCY_FREEZE',
    );
    expect(result.allowed).toBe(true);
  });
});
