/**
 * Production PRE runtime wrapper.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §13
 *
 * Constitutional rules:
 * 1. PRE.resolve() is called exactly once per invocation
 * 2. PRE output is NEVER mutated after resolution
 * 3. Timing metadata is tracked separately and NEVER added to replay checksums
 * 4. Shadow execution runs AFTER PRE returns (never blocks PRE path)
 * 5. Telemetry emitted AFTER PRE returns
 *
 * This wrapper does:
 *   1. Generate correlation_id
 *   2. setRequestId() for logger correlation
 *   3. Call PRE.resolve(screen_id, at, system_state)
 *   4. Run assertOutputShape() + assertTimingNotInReplayHash()
 *   5. Emit PREResolutionLog
 *   6. increment METRICS.PRE_INVOCATIONS_TOTAL
 *   7. If shadow enabled: runShadowComparison()
 *   8. Build RuntimeResponse
 *   9. Return response
 */

import type { SystemStateSnapshot, PRE_Input } from '../pre/types';
import type { LegacyOutput, ShadowComparisonResult, ShadowTelemetryEvent } from '../shadow/types';
import type { RuntimeRequest, RuntimeResponse } from './runtime-types';
import type { RequestContext } from './request-context';

import { resolve } from '../pre/index';
import { setRequestId } from '../observability/logger';
import { emit as logEmit, base } from '../observability/logger';
import { increment, setGauge, METRICS } from '../observability/metrics';
import { runShadowComparison } from '../shadow/runtime/shadow-runner';
import { ParityRecorder } from '../shadow/storage/parity-recorder';
import { assertOutputShape, assertTimingNotInReplayHash } from './runtime-contracts';
import { buildRuntimeResponse } from './runtime-response';
import { generateCorrelationId } from './correlation-id';
import type { PREResolutionLog, PREInvocationLog } from '../observability/telemetry-schemas';

// ─── PRE Runtime Invocation ───────────────────────────────────────────────────

/**
 * Invoke PRE.resolve() with full runtime instrumentation.
 *
 * @param request - Runtime request with correlation + config
 * @param systemState - System state snapshot (passed directly to PRE)
 * @param recorder - Append-only parity record store for shadow mode
 * @param telemetryTarget - Caller-managed telemetry event array
 * @param legacyOutputFn - Optional legacy resolver for shadow comparison
 */
export async function invokePRE(
  request: RuntimeRequest,
  systemState: SystemStateSnapshot,
  recorder: ParityRecorder,
  telemetryTarget: ShadowTelemetryEvent[],
  legacyOutputFn?: (screenId: string, at: number) => LegacyOutput,
): Promise<RuntimeResponse> {
  const startMs = Date.now();

  // Set correlation context for logger
  setRequestId(request.correlation_id);

  const ctx: RequestContext = {
    correlation_id: request.correlation_id,
    screen_id: request.screen_id,
    at: request.at,
    initiated_at: request.requested_at,
  };

  // Build PRE input (pure — no side effects in here)
  const preInput: PRE_Input = {
    screen_id: request.screen_id,
    at: request.at,
    system_state: systemState,
  };

  // ─── Step 1: Call PRE.resolve() exactly once ─────────────────────────────
  const preOutput = resolve(preInput);

  const timingMs = Date.now() - startMs;

  // ─── Step 2: Structural contract assertions ───────────────────────────────
  assertOutputShape(preOutput);
  assertTimingNotInReplayHash(preOutput);

  // ─── Step 3: Emit PREResolutionLog ────────────────────────────────────────
  const baseResolution = base('INFO', 'pre.resolution');
  const resolutionLog: PREResolutionLog = {
    ts: baseResolution.ts,
    severity: baseResolution.severity,
    event_type: 'pre.resolution',
    request_id: baseResolution.request_id,
    replay_id: baseResolution.replay_id,
    correlation_id: request.correlation_id,
    screen_id: request.screen_id,
    resolution_level: preOutput.resolution_level,
    playlist_length: preOutput.playlist.length,
    is_fallback: preOutput.is_fallback,
    invariants_passed: true, // runAllInvariants() already ran inside PRE.resolve()
    playlist_checksum: preOutput.playlist_checksum,
  };
  logEmit(resolutionLog);

  // Also emit PREInvocationLog with timing
  const baseInvocation = base('INFO', 'pre.invocation');
  const invocationLog: PREInvocationLog = {
    ts: baseInvocation.ts,
    severity: baseInvocation.severity,
    event_type: 'pre.invocation',
    request_id: baseInvocation.request_id,
    replay_id: baseInvocation.replay_id,
    correlation_id: request.correlation_id,
    screen_id: request.screen_id,
    at: request.at,
    resolution_level: preOutput.resolution_level,
    is_fallback: preOutput.is_fallback,
    playlist_checksum: preOutput.playlist_checksum,
    timing_ms: timingMs,
  };
  logEmit(invocationLog);

  // ─── Step 4: Increment metrics ────────────────────────────────────────────
  increment(METRICS.PRE_INVOCATIONS_TOTAL, {
    resolution_level: String(preOutput.resolution_level),
    is_fallback: String(preOutput.is_fallback),
  });
  increment(METRICS.PRE_LEVEL_SELECTION_TOTAL, {
    level: String(preOutput.resolution_level),
  });

  // ─── Step 5: Shadow execution (AFTER PRE returns, non-blocking) ───────────
  let shadowResult: ShadowComparisonResult | undefined;
  let replayArtifactId: string | undefined;

  if (request.config.shadow_mode_enabled && legacyOutputFn !== undefined) {
    const invocationId = generateCorrelationId();
    const legacy = legacyOutputFn(request.screen_id, request.at);

    shadowResult = runShadowComparison(
      invocationId,
      request.config.canary_stage,
      legacy,
      preOutput,
      recorder,
      telemetryTarget,
    );
    replayArtifactId = invocationId;

    // Emit shadow comparison metric
    if (shadowResult.divergence_class !== null) {
      increment(METRICS.PARITY_DIVERGENCES_TOTAL, {
        divergence_class: String(shadowResult.divergence_class),
      });
    }

    // Update parity gauge
    const allRecords = recorder.getAll();
    const total = allRecords.length;
    const agreements = allRecords.filter(r => r.divergence_class === null).length;
    if (total > 0) {
      setGauge(METRICS.SHADOW_PARITY_RATIO, agreements / total, {
        canary_stage: request.config.canary_stage,
      });
    }
  }

  // ─── Step 6: Build and return RuntimeResponse ─────────────────────────────
  const response = buildRuntimeResponse(
    ctx,
    preOutput,
    true, // invariants_passed — runAllInvariants() ran inside PRE.resolve()
    timingMs,
    shadowResult,
    replayArtifactId,
  );

  // Clear correlation context
  setRequestId(null);

  return response;
}
