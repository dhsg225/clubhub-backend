/**
 * Runtime response builder.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13
 *
 * Assembles RuntimeResponse from PRE output + runtime metadata.
 * PRE output is NEVER mutated here.
 */

import type { PRE_Output } from '../pre/types';
import type { ShadowComparisonResult } from '../shadow/types';
import type { RequestContext } from './request-context';
import type { RuntimeResponse } from './runtime-types';

/**
 * Build a RuntimeResponse from PRE output + runtime metadata.
 *
 * timing_ms is tracked separately and never added to replay checksums.
 * PRE output fields are not modified.
 */
export function buildRuntimeResponse(
  ctx: RequestContext,
  preOutput: PRE_Output,
  invariantsPassed: boolean,
  timingMs: number,
  shadowResult?: ShadowComparisonResult,
  replayArtifactId?: string,
): RuntimeResponse {
  const response: RuntimeResponse = {
    correlation_id: ctx.correlation_id,
    screen_id: ctx.screen_id,
    at: ctx.at,
    pre_output: preOutput,
    invariants_passed: invariantsPassed,
    timing_ms: timingMs,
  };

  if (shadowResult !== undefined) {
    response.shadow_result = shadowResult;
  }
  if (replayArtifactId !== undefined) {
    response.replay_artifact_id = replayArtifactId;
  }

  return response;
}
