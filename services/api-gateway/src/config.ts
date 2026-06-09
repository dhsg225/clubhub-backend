function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export interface ApiGatewayConfig {
  readonly PORT: number;
  readonly NODE_ENV: 'development' | 'staging' | 'production';
  readonly CMS_API_URL: string;
  readonly REPLAY_SERVICE_URL: string;
  readonly ENTROPY_SERVICE_URL: string;
  /** Required for JWT verification in production. Set JWT_VERIFY=false to skip (dev only). */
  readonly JWT_SECRET: string;
  readonly JWT_VERIFY: boolean;
}

export function loadConfig(): ApiGatewayConfig {
  const jwtVerify = optionalEnv('JWT_VERIFY', 'true') !== 'false';
  return {
    PORT: parseInt(optionalEnv('PORT', '3100'), 10),
    NODE_ENV: requireEnv('NODE_ENV') as ApiGatewayConfig['NODE_ENV'],
    CMS_API_URL: requireEnv('CMS_API_URL'),
    REPLAY_SERVICE_URL: requireEnv('REPLAY_SERVICE_URL'),
    ENTROPY_SERVICE_URL: requireEnv('ENTROPY_SERVICE_URL'),
    JWT_SECRET: jwtVerify ? requireEnv('JWT_SECRET') : optionalEnv('JWT_SECRET', 'dev-secret'),
    JWT_VERIFY: jwtVerify,
  };
}
