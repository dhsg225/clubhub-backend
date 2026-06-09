/**
 * Shadow service constitutional guard.
 *
 * Constitutional:
 * - Shadow service NEVER calls pre-engine.resolve() directly
 * - It receives pre-computed PRE + legacy outputs
 * - CLASS_3/4 divergences MUST trigger rollback evaluation (no silent suppression)
 * - Parity records are append-only and immutable
 */
import type { DivergenceClass } from '@clubhub/constitutional-types';
import { emit, base } from '@clubhub/telemetry-sdk';

export class SilentDivergenceSuppression extends Error {
  constructor(divergenceClass: DivergenceClass) {
    super(
      `CONSTITUTIONAL VIOLATION: CLASS_${divergenceClass} divergence detected but rollback evaluation was not triggered. ` +
      'assertNoSilentDivergenceSuppression requires CLASS_3/4 divergences to always trigger rollback.',
    );
    this.name = 'SilentDivergenceSuppression';
  }
}

export function assertNoSilentDivergenceSuppression(
  divergenceClass: DivergenceClass | null,
  rollbackEvaluated: boolean,
): void {
  if (divergenceClass !== null && (divergenceClass >= 3) && !rollbackEvaluated) {
    emit({
      ...base('ERROR', 'shadow_service.silent_divergence_suppression'),
      divergence_class: divergenceClass,
      severity_class: 4,
    } as Parameters<typeof emit>[0]);
    throw new SilentDivergenceSuppression(divergenceClass);
  }
}
