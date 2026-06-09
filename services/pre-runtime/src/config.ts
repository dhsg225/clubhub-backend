function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export interface PreRuntimeConfig {
  readonly SCREEN_ID: string;
  readonly VENUE_ID: string;
  readonly CMS_BASE_URL: string;
  readonly CORPUS_SYNC_INTERVAL_MS: number;
  readonly AUDIT_BATCH_INTERVAL_MS: number;
  readonly WS_PORT: number;
}

export function loadConfig(): PreRuntimeConfig {
  return {
    SCREEN_ID: requireEnv('SCREEN_ID'),
    VENUE_ID: requireEnv('VENUE_ID'),
    CMS_BASE_URL: requireEnv('CMS_BASE_URL'),
    CORPUS_SYNC_INTERVAL_MS: parseInt(optionalEnv('CORPUS_SYNC_INTERVAL_MS', '30000'), 10),
    AUDIT_BATCH_INTERVAL_MS: parseInt(optionalEnv('AUDIT_BATCH_INTERVAL_MS', '10000'), 10),
    WS_PORT: parseInt(optionalEnv('WS_PORT', '7777'), 10),
  };
}
