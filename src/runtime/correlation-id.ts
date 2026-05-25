/**
 * Correlation ID generator for request tracking.
 *
 * Note: randomUUID is fine here — this is runtime infrastructure, not inside PRE.
 * PRE itself remains pure and deterministic.
 */

import { randomUUID } from 'crypto';

export function generateCorrelationId(): string {
  return randomUUID();
}
