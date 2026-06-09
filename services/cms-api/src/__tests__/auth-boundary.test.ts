/**
 * ADR-001 Auth Boundary Regression Tests
 *
 * Guarantee: player endpoints NEVER require JWT.
 *            Operator endpoints ALWAYS require JWT.
 *
 * These tests import PLAYER_ROUTES from the canonical registry.
 * If a route is removed from the registry, the test catches it.
 * If a route is added to the registry without a test, the matrix test catches it.
 *
 * Run: pnpm --filter @clubhub/cms-api test
 */

import { describe, it, expect } from 'vitest';
import { isPlayerRoute, PLAYER_ROUTES } from '../auth/player-routes.js';

// ─── Unit: isPlayerRoute matcher ──────────────────────────────────────────────

const VALID_SCREEN_UUID = '60000000-0000-0000-0000-000000000001';
const VALID_CMD_UUID    = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('isPlayerRoute — player surface (must return true)', () => {
  it('POST /api/v2/enroll', () => {
    expect(isPlayerRoute('POST', '/api/v2/enroll')).toBe(true);
  });

  it('GET /resolve/:screen_id', () => {
    expect(isPlayerRoute('GET', `/resolve/${VALID_SCREEN_UUID}`)).toBe(true);
  });

  it('GET /api/v2/screens/:screen_id/corpus', () => {
    expect(isPlayerRoute('GET', `/api/v2/screens/${VALID_SCREEN_UUID}/corpus`)).toBe(true);
  });

  it('POST /api/v2/screens/:screen_id/heartbeat', () => {
    expect(isPlayerRoute('POST', `/api/v2/screens/${VALID_SCREEN_UUID}/heartbeat`)).toBe(true);
  });

  it('GET /api/v2/screens/:screen_id/commands/pending', () => {
    expect(isPlayerRoute('GET', `/api/v2/screens/${VALID_SCREEN_UUID}/commands/pending`)).toBe(true);
  });

  it('PATCH /api/v2/commands/:command_id/status', () => {
    expect(isPlayerRoute('PATCH', `/api/v2/commands/${VALID_CMD_UUID}/status`)).toBe(true);
  });
});

describe('isPlayerRoute — operator surface (must return false)', () => {
  it('GET /api/v2/fleet/health', () => {
    expect(isPlayerRoute('GET', '/api/v2/fleet/health')).toBe(false);
  });

  it('POST /api/v2/venues/:id/enrollment-tokens', () => {
    expect(isPlayerRoute('POST', `/api/v2/venues/${VALID_SCREEN_UUID}/enrollment-tokens`)).toBe(false);
  });

  it('GET /api/v2/venues/:id/enrollment-tokens', () => {
    expect(isPlayerRoute('GET', `/api/v2/venues/${VALID_SCREEN_UUID}/enrollment-tokens`)).toBe(false);
  });

  it('DELETE /api/v2/enrollment-tokens/:id', () => {
    expect(isPlayerRoute('DELETE', `/api/v2/enrollment-tokens/${VALID_CMD_UUID}`)).toBe(false);
  });

  it('PATCH /api/v2/screens/:id/commissioning-state', () => {
    expect(isPlayerRoute('PATCH', `/api/v2/screens/${VALID_SCREEN_UUID}/commissioning-state`)).toBe(false);
  });

  it('POST /api/v2/corpus/rollback', () => {
    expect(isPlayerRoute('POST', '/api/v2/corpus/rollback')).toBe(false);
  });

  it('GET /api/v2/corpus/rollback-impact/:id', () => {
    expect(isPlayerRoute('GET', `/api/v2/corpus/rollback-impact/${VALID_CMD_UUID}`)).toBe(false);
  });

  it('GET /api/v2/freeze-status', () => {
    expect(isPlayerRoute('GET', '/api/v2/freeze-status')).toBe(false);
  });

  it('POST /dev/auth/token', () => {
    expect(isPlayerRoute('POST', '/dev/auth/token')).toBe(false);
  });

  it('GET /health/runtime', () => {
    expect(isPlayerRoute('GET', '/health/runtime')).toBe(false);
  });
});

describe('isPlayerRoute — negative: malformed UUID must NOT bypass', () => {
  it('rejects non-UUID screen_id in corpus path', () => {
    expect(isPlayerRoute('GET', '/api/v2/screens/not-a-uuid/corpus')).toBe(false);
  });

  it('rejects non-UUID screen_id in resolve path', () => {
    expect(isPlayerRoute('GET', '/resolve/not-a-uuid')).toBe(false);
  });

  it('rejects non-UUID command_id in status path', () => {
    expect(isPlayerRoute('PATCH', '/api/v2/commands/not-a-uuid/status')).toBe(false);
  });

  it('rejects path traversal attempt in corpus path', () => {
    expect(isPlayerRoute('GET', `/api/v2/screens/${VALID_SCREEN_UUID}/../../../corpus`)).toBe(false);
  });

  it('rejects uppercase UUID (not lowercase hex)', () => {
    expect(isPlayerRoute('GET', `/resolve/60000000-0000-0000-0000-00000000000G`)).toBe(false);
  });

  it('rejects extra path segments after corpus', () => {
    expect(isPlayerRoute('GET', `/api/v2/screens/${VALID_SCREEN_UUID}/corpus/extra`)).toBe(false);
  });

  it('rejects wrong method on player path (GET on enroll)', () => {
    expect(isPlayerRoute('GET', '/api/v2/enroll')).toBe(false);
  });

  it('rejects wrong method on corpus path (POST on corpus)', () => {
    expect(isPlayerRoute('POST', `/api/v2/screens/${VALID_SCREEN_UUID}/corpus`)).toBe(false);
  });

  it('rejects wrong method on heartbeat path (GET on heartbeat)', () => {
    expect(isPlayerRoute('GET', `/api/v2/screens/${VALID_SCREEN_UUID}/heartbeat`)).toBe(false);
  });
});

// ─── Registry completeness: PLAYER_ROUTES count is the contract ───────────────

describe('PLAYER_ROUTES registry contract', () => {
  it('contains exactly 6 routes (ADR-001 enforcement boundary)', () => {
    // If this count changes, a human must have consciously edited player-routes.ts.
    // The test failing on count change is the canary.
    expect(PLAYER_ROUTES).toHaveLength(6);
  });

  it('every route has a method, pattern, and description', () => {
    for (const route of PLAYER_ROUTES) {
      expect(typeof route.method).toBe('string');
      expect(route.pattern).toBeInstanceOf(RegExp);
      expect(typeof route.description).toBe('string');
      expect(route.description.length).toBeGreaterThan(0);
    }
  });

  it('all patterns are anchored (^ and $)', () => {
    for (const route of PLAYER_ROUTES) {
      expect(route.pattern.source).toMatch(/^\^/);
      expect(route.pattern.source).toMatch(/\$$/);
    }
  });

  it('all methods are uppercase', () => {
    for (const route of PLAYER_ROUTES) {
      expect(route.method).toBe(route.method.toUpperCase());
    }
  });
});
