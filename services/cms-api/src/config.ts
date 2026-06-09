/**
 * Typed configuration loading.
 * All config comes from environment variables — zero implicit defaults for secrets.
 */

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export interface CmsApiConfig {
  readonly port: number;
  readonly host: string;
  readonly logLevel: string;
  readonly NODE_ENV: string;
}

export function loadConfig(): CmsApiConfig {
  return {
    port: parseInt(optionalEnv('PORT', '3000'), 10),
    host: optionalEnv('HOST', '0.0.0.0'),
    logLevel: optionalEnv('LOG_LEVEL', 'info'),
    NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  };
}
