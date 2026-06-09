/**
 * Constitutional middleware for API gateway.
 *
 * Enforces:
 * - READ_ONLY: blocks all mutations except /emergency/* routes
 * - EMERGENCY_FREEZE: blocks all mutations and non-emergency reads
 */
import type { ConstitutionalState } from '@clubhub/constitutional-types';
import { emit, base } from '@clubhub/telemetry-sdk';

const EMERGENCY_ROUTE_PATTERN = /^\/api\/v\d+\/emergency\//;
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface RequestLike {
  method: string;
  path: string;
}

export interface ConstitutionalCheckResult {
  allowed: boolean;
  reason?: string;
  httpStatus?: number;
}

export function checkConstitutionalPermission(
  req: RequestLike,
  constitutionalState: ConstitutionalState,
): ConstitutionalCheckResult {
  const isMutation = MUTATION_METHODS.has(req.method.toUpperCase());
  const isEmergencyRoute = EMERGENCY_ROUTE_PATTERN.test(req.path);

  if (constitutionalState === 'EMERGENCY_FREEZE') {
    if (isEmergencyRoute) return { allowed: true };
    emit({
      ...base('WARN', 'api_gateway.constitutional_freeze_block'),
      method: req.method, path: req.path,
    } as Parameters<typeof emit>[0]);
    return {
      allowed: false,
      reason: 'CONSTITUTIONAL_FREEZE',
      httpStatus: 503,
    };
  }

  if (constitutionalState === 'READ_ONLY' && isMutation) {
    if (isEmergencyRoute) return { allowed: true }; // emergency routes bypass READ_ONLY
    emit({
      ...base('WARN', 'api_gateway.read_only_mutation_blocked'),
      method: req.method, path: req.path,
    } as Parameters<typeof emit>[0]);
    return {
      allowed: false,
      reason: 'SYSTEM_READ_ONLY',
      httpStatus: 423, // Locked
    };
  }

  return { allowed: true };
}
