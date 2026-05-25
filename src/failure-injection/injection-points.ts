/**
 * Named injection points where faults can be deterministically injected.
 * These correspond to the chaos scenarios already implemented.
 */

export type InjectionPoint =
  | 'PRE_RESOLVE'          // Inject fault at PRE.resolve() call
  | 'INVARIANT_CHECK'      // Inject invariant violation
  | 'AUDIT_WRITE'          // Inject audit writer failure
  | 'SHADOW_COMPARE'       // Inject shadow comparison divergence
  | 'ENTROPY_SCHEDULER'    // Inject entropy scheduler failure
  | 'CORPUS_READ'          // Inject corpus hash corruption
  | 'REPLAY_EXECUTE';      // Inject replay nondeterminism

export interface InjectionConfig {
  point: InjectionPoint;
  failure_mode_id: string;   // must exist in FAILURE_REGISTRY
  deterministic_trigger: string;  // e.g., 'screen_id=test-screen-001'
  enabled: boolean;
}

export function shouldInjectFault(
  config: InjectionConfig,
  context: { screen_id?: string; at?: number; packet_id?: string }
): boolean {
  if (!config.enabled) return false;
  // Deterministic: parse trigger string and match against context
  // Format: 'key=value' — e.g., 'screen_id=test-screen-001'
  const [key, value] = config.deterministic_trigger.split('=');
  if (key === 'screen_id') return context.screen_id === value;
  if (key === 'packet_id') return context.packet_id === value;
  return false;
}
