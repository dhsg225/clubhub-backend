function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export interface EntropyServiceConfig {
  readonly PORT: number;
  readonly DATABASE_URL: string;
  readonly NODE_ENV: 'development' | 'staging' | 'production';
  readonly VENUE_SCAN_INTERVAL_MS: number;
  readonly FLEET_SCAN_INTERVAL_MS: number;
}

export function loadConfig(): EntropyServiceConfig {
  return {
    PORT: parseInt(optionalEnv('PORT', '3004'), 10),
    DATABASE_URL: requireEnv('DATABASE_URL'),
    NODE_ENV: requireEnv('NODE_ENV') as EntropyServiceConfig['NODE_ENV'],
    VENUE_SCAN_INTERVAL_MS: parseInt(optionalEnv('VENUE_SCAN_INTERVAL_MS', '3600000'), 10),
    FLEET_SCAN_INTERVAL_MS: parseInt(optionalEnv('FLEET_SCAN_INTERVAL_MS', '21600000'), 10),
  };
}
