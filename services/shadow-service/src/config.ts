function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export interface ShadowServiceConfig {
  readonly PORT: number;
  readonly DATABASE_URL: string;
  readonly NODE_ENV: 'development' | 'staging' | 'production';
}

export function loadConfig(): ShadowServiceConfig {
  return {
    PORT: parseInt(optionalEnv('PORT', '3005'), 10),
    DATABASE_URL: requireEnv('DATABASE_URL'),
    NODE_ENV: requireEnv('NODE_ENV') as ShadowServiceConfig['NODE_ENV'],
  };
}
