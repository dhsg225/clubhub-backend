/**
 * Registry of all known production failure modes.
 * Maps each failure to its class, chaos equivalent, and precursor signals.
 */

export type FailureClass = 0 | 1 | 2 | 3 | 4 | 5;

export interface FailureMode {
  id: string;                    // e.g., 'FM-001'
  name: string;
  failure_class: FailureClass;
  chaos_equivalent: string | null;  // e.g., 'CHAOS-001'
  entropy_precursor: string | null; // e.g., 'M-12' (staleness)
  description: string;
  is_reproducible: boolean;
  is_classifiable: boolean;
  is_observable: boolean;
  recovery_policy: string;
}

export const FAILURE_REGISTRY: readonly FailureMode[] = [
  { id: 'FM-001', name: 'PRE resolve throws', failure_class: 3, chaos_equivalent: 'CHAOS-001', entropy_precursor: null, description: 'PRE.resolve() throws an exception', is_reproducible: true, is_classifiable: true, is_observable: true, recovery_policy: 'Serve LEVEL_5 fallback; log CONSTITUTIONAL_BREACH; halt canary' },
  { id: 'FM-002', name: 'Invariant violation', failure_class: 3, chaos_equivalent: 'CHAOS-002', entropy_precursor: null, description: 'runAllInvariants() throws InvariantViolationError', is_reproducible: true, is_classifiable: true, is_observable: true, recovery_policy: 'CLASS_3: halt canary, alert, continue legacy' },
  { id: 'FM-003', name: 'Emergency precedence failure', failure_class: 4, chaos_equivalent: 'CHAOS-007', entropy_precursor: 'M-08', description: 'Emergency active but resolution_level !== 0', is_reproducible: true, is_classifiable: true, is_observable: true, recovery_policy: 'CLASS_4: all-stop, immediate incident' },
  { id: 'FM-004', name: 'Corpus hash corruption', failure_class: 4, chaos_equivalent: null, entropy_precursor: null, description: 'packet_hash verification fails for corpus packet', is_reproducible: false, is_classifiable: true, is_observable: true, recovery_policy: 'CLASS_4: all-stop, replay system untrusted' },
  { id: 'FM-005', name: 'Replay nondeterminism', failure_class: 4, chaos_equivalent: null, entropy_precursor: null, description: 'Same packet produces different output on consecutive runs', is_reproducible: true, is_classifiable: true, is_observable: true, recovery_policy: 'CLASS_4: all-stop, investigate immediately' },
  { id: 'FM-006', name: 'Shadow parity below threshold', failure_class: 3, chaos_equivalent: 'CHAOS-006', entropy_precursor: 'M-01', description: 'parity_score_24h < 0.999', is_reproducible: true, is_classifiable: true, is_observable: true, recovery_policy: 'Halt canary advancement; do not auto-rollback' },
  { id: 'FM-007', name: 'Audit writer failure', failure_class: 2, chaos_equivalent: null, entropy_precursor: 'M-12', description: 'ReplayAuditWriter.write() throws', is_reproducible: true, is_classifiable: true, is_observable: true, recovery_policy: 'Log gap; continue PRE; alert operator' },
  { id: 'FM-008', name: 'Entropy scheduler stopped', failure_class: 2, chaos_equivalent: null, entropy_precursor: null, description: 'No entropy jobs completed in 2x interval', is_reproducible: true, is_classifiable: true, is_observable: true, recovery_policy: 'Advisory degraded; alert; PRE unaffected' },
  { id: 'FM-009', name: 'DB degraded — all schedules inactive', failure_class: 2, chaos_equivalent: 'CHAOS-002', entropy_precursor: 'M-03', description: 'No active schedules — PRE falls to LEVEL_5', is_reproducible: true, is_classifiable: true, is_observable: true, recovery_policy: 'CLASS_2: PRE produces fallback, is_fallback=true' },
  { id: 'FM-010', name: 'Clock skew', failure_class: 1, chaos_equivalent: 'CHAOS-005', entropy_precursor: null, description: 'Application server clock skew ≥5 minutes', is_reproducible: true, is_classifiable: true, is_observable: true, recovery_policy: 'PRE uses at parameter; unaffected if timezone isolation maintained' },
];

/** Look up failure mode by ID */
export function getFailureMode(id: string): FailureMode | undefined {
  return FAILURE_REGISTRY.find(f => f.id === id);
}

/** Get all failure modes of a given class */
export function getByClass(cls: FailureClass): FailureMode[] {
  return FAILURE_REGISTRY.filter(f => f.failure_class === cls);
}
