/**
 * Service-to-service authentication.
 *
 * Services authenticate using pre-shared tokens validated against
 * SERVICE_AUTH_TOKENS environment variable (JSON map of service_name → token).
 */

export class ServiceAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceAuthError';
  }
}

interface ServiceTokenMap {
  [service_name: string]: string;
}

function loadServiceTokens(): ServiceTokenMap {
  const raw = process.env['SERVICE_AUTH_TOKENS'];
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ServiceTokenMap;
  } catch {
    console.error('[service-auth] Invalid SERVICE_AUTH_TOKENS JSON');
    return {};
  }
}

const serviceTokens = loadServiceTokens();

/**
 * Validate a service authentication token.
 * Returns the service_name if valid.
 */
export function validateServiceToken(token: string): string {
  const entry = Object.entries(serviceTokens).find(([, t]) => t === token);
  if (!entry) {
    throw new ServiceAuthError('Invalid service auth token');
  }
  return entry[0]!;
}

export function isValidServiceToken(token: string): boolean {
  try {
    validateServiceToken(token);
    return true;
  } catch {
    return false;
  }
}
