/**
 * Preview API surface — pure read-only routes.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13
 *
 * No mutation. Deterministic serialization. Correlation IDs propagated.
 *
 * Routes:
 *   GET /preview/current      — previewCurrent()
 *   GET /preview/future       — previewCurrent() with future `at`
 *   GET /preview/diff         — previewDiff()
 *   GET /preview/explanation  — explainResolution()
 */

import type { SystemStateSnapshot } from '../pre/types';
import type { PreviewResponse, PreviewDiff, PreviewRequest } from '../preview/types';
import type { ResolutionExplanation } from '../preview/types';
import { previewCurrent, previewDiff } from '../preview/preview-endpoint';
import { explainResolution } from '../preview/explain/explain-resolution';
import { resolve } from '../pre/index';
import { assertDeterministicResponse, assertReadOnlyRoute } from './api-contracts';
import { emit as logEmit, base } from '../observability/logger';
import { increment, METRICS } from '../observability/metrics';
import type { PreviewRequestLog } from '../observability/telemetry-schemas';

// ─── API Request / Response Types ────────────────────────────────────────────

export interface PreviewApiRequest {
  surface: 'current' | 'future' | 'diff' | 'explanation';
  screen_id: string;
  at: number;
  /** For diff/future */
  future_at?: number;
  correlation_id: string;
}

export interface PreviewApiResponse {
  correlation_id: string;
  surface: string;
  payload: PreviewResponse | PreviewDiff | ResolutionExplanation | unknown;
  generated_at: number;
  replay_compatible: true;
}

// ─── Preview Request Handler ──────────────────────────────────────────────────

/**
 * Handle a preview API request.
 * Always read-only. Emits PreviewRequestLog telemetry.
 */
export function handlePreviewRequest(
  request: PreviewApiRequest,
  systemState: SystemStateSnapshot,
): PreviewApiResponse {
  assertReadOnlyRoute('handlePreviewRequest');

  const surface = request.surface;

  // Emit PreviewRequestLog
  const baseLog = base('INFO', 'preview.request');
  // Map 'explanation' surface to 'current' for the telemetry schema
  const logSurface: 'current' | 'future' | 'diff' | 'entropy' =
    surface === 'explanation' ? 'current' :
    surface === 'future'      ? 'future'  :
    surface === 'diff'        ? 'diff'    : 'current';

  const previewLog: PreviewRequestLog = {
    ts: baseLog.ts,
    severity: baseLog.severity,
    event_type: 'preview.request',
    request_id: baseLog.request_id,
    replay_id: baseLog.replay_id,
    surface: logSurface,
    screen_id: request.screen_id,
    at: request.at,
  };
  logEmit(previewLog);

  increment(METRICS.PREVIEW_REQUEST_TOTAL, { surface });

  let payload: unknown;

  const previewReq: PreviewRequest = {
    screen_id: request.screen_id,
    at: request.at,
    system_state: systemState,
    include_entropy: true,
    include_reason_trace: true,
    surface: 'P1_CURRENT',
  };

  switch (surface) {
    case 'current': {
      payload = previewCurrent(previewReq);
      break;
    }
    case 'future': {
      const futureReq: PreviewRequest = {
        ...previewReq,
        at: request.future_at ?? request.at,
        surface: 'P2_FUTURE',
      };
      payload = previewCurrent(futureReq);
      break;
    }
    case 'diff': {
      const fromReq: PreviewRequest = {
        ...previewReq,
        surface: 'P1_CURRENT',
      };
      const toReq: PreviewRequest = {
        ...previewReq,
        at: request.future_at ?? request.at,
        surface: 'P2_FUTURE',
      };
      payload = previewDiff(fromReq, toReq);
      break;
    }
    case 'explanation': {
      const preInput = {
        screen_id: request.screen_id,
        at: request.at,
        system_state: systemState,
      };
      const preOutput = resolve(preInput);
      payload = explainResolution(preOutput);
      break;
    }
    default: {
      const _exhaustive: never = surface;
      void _exhaustive;
      payload = null;
    }
  }

  assertDeterministicResponse(payload);

  return {
    correlation_id: request.correlation_id,
    surface,
    payload,
    generated_at: request.at,
    replay_compatible: true,
  };
}
