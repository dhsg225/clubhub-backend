/**
 * Request context carrier — propagates correlation IDs through the call stack.
 * This is runtime-layer only, never passed into PRE.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13
 */

import { generateCorrelationId } from './correlation-id';

export interface RequestContext {
  correlation_id: string;
  screen_id: string;
  at: number;
  initiated_at: number;
}

export function createRequestContext(screen_id: string, at: number): RequestContext {
  return {
    correlation_id: generateCorrelationId(),
    screen_id,
    at,
    initiated_at: Date.now(),
  };
}
