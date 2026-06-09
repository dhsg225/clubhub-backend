/**
 * Constitutional API client.
 *
 * Enforces:
 * - All mutations check constitutional state before firing
 * - Emergency routes bypass READ_ONLY (not EMERGENCY_FREEZE)
 * - No optimistic updates on corpus-modifying operations
 * - Replay-compatible: all requests carry correlation_id header
 */
import { useConstitutionalStore } from '../stores/constitutionalStore.js';

const BASE_URL = import.meta.env['VITE_API_BASE_URL'] as string | undefined ?? '/api/v1';

export class ConstitutionalMutationBlockedError extends Error {
  constructor(
    public readonly reason: 'SYSTEM_READ_ONLY' | 'CONSTITUTIONAL_FREEZE',
    public readonly path: string,
  ) {
    super(`Mutation blocked: ${reason} — ${path}`);
    this.name = 'ConstitutionalMutationBlockedError';
  }
}

const EMERGENCY_ROUTE_PATTERN = /\/emergency\//;
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  // Constitutional mutation guard
  const state = useConstitutionalStore.getState().state;
  const isMutation = MUTATION_METHODS.has(method.toUpperCase());
  const isEmergencyRoute = EMERGENCY_ROUTE_PATTERN.test(path);

  if (state === 'EMERGENCY_FREEZE' && !isEmergencyRoute) {
    throw new ConstitutionalMutationBlockedError('CONSTITUTIONAL_FREEZE', path);
  }

  if (state === 'READ_ONLY' && isMutation && !isEmergencyRoute) {
    throw new ConstitutionalMutationBlockedError('SYSTEM_READ_ONLY', path);
  }

  const correlationId = crypto.randomUUID();

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-Id': correlationId,
    },
    body: body !== undefined ? JSON.stringify(body) : null,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new ApiError(response.status, errorBody, path, correlationId);
  }

  return response.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: Record<string, unknown>,
    public readonly path: string,
    public readonly correlationId: string,
  ) {
    super(`API error ${status} on ${path}`);
    this.name = 'ApiError';
  }
}

// Convenience wrappers
export const api = {
  get: <T>(path: string) => apiRequest<T>('GET', path),
  post: <T>(path: string, body: unknown) => apiRequest<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => apiRequest<T>('PUT', path, body),
  delete: <T>(path: string) => apiRequest<T>('DELETE', path),
};
