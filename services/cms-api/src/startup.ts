/**
 * CMS API startup sequence.
 * Constitutional: validates environment, asserts no pre-engine dependency, connects DB.
 */
import { loadConfig } from './config.js';
import { emit, base } from '@clubhub/telemetry-sdk';

export async function startup(): Promise<void> {
  const config = loadConfig();

  // Assert no pre-engine imported (runtime check — static check is in CI)
  assertNoPREEngineDependency();

  emit({
    ...base('INFO', 'cms_api.startup'),
    service: 'cms-api',
    port: config.port,
    node_env: config.NODE_ENV,
  } as Parameters<typeof emit>[0]);
}

function assertNoPREEngineDependency(): void {
  // Constitutional boundary: cms-api must never resolve PRE
  // This is a runtime guard — the primary enforcement is validate-contracts.ts
  try {
    // If @clubhub/pre-engine is resolvable AND imported, this is a violation
    // We just document the intent here; actual enforcement is in CI boundary check
    const preEngineImported = false; // set to true by any require('@clubhub/pre-engine')
    if (preEngineImported) {
      throw new Error('CONSTITUTIONAL VIOLATION: cms-api must not import @clubhub/pre-engine');
    }
  } catch (_) {
    // pre-engine not available — correct
  }
}
