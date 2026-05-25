/**
 * Preview endpoint — pure logic layer for all 4 preview surfaces.
 *
 * P-1: Current resolution   — why is this playing now?
 * P-2: Future simulation    — what will play at time X? (same code path as P-1)
 * P-3: Diff between states  — what changed?
 * P-4: Entropy context      — advisory entropy snapshot
 *
 * CRITICAL: generated_at === request.at — never Date.now()
 * CRITICAL: previewFuture and previewCurrent use the SAME resolve() call
 * CRITICAL: preview_checksum computed without including itself
 * CRITICAL: All outputs are read-only — no mutation paths
 */

import type { PreviewRequest, PreviewResponse, PreviewDiff } from './types';
import type { PRE_Input } from '../pre/types';
import type { EntropyScore } from '../entropy/types';
import { resolve } from '../pre/index';
import { computeScreenEntropy } from '../entropy/entropy-runner';
import { assertPreviewPurity } from './contracts/preview-contracts';
import { explainResolution } from './explain/explain-resolution';
import { buildDiff } from './preview-diff';
import { fnv1a32 } from '../pre/algorithms/fnv1a32';
import { canonicalizeJson } from '../pre/algorithms/canonicalize-json';

// ─── Response Builder ─────────────────────────────────────────────────────────

function buildPreviewResponse(
  request:     PreviewRequest,
  output:      import('../pre/types').PRE_Output,
  explanation: import('./types').ResolutionExplanation | null,
  entropy:     EntropyScore | null
): PreviewResponse {
  // Build the response without preview_checksum first
  const partial = {
    screen_id:         request.screen_id,
    generated_at:      request.at,           // always request.at — never Date.now()
    surface:           request.surface,
    playlist:          output.playlist,
    playlist_checksum: output.playlist_checksum,
    resolution_level:  output.resolution_level,
    content_mix:       output.content_mix,
    is_fallback:       output.is_fallback,
    confidence_score:  output.confidence_score,
    reason_trace:      request.include_reason_trace !== false ? output.reason_trace : null,
    entropy_snapshot:  entropy,
    advisory_tier:     entropy ? entropy.advisory_tier : null,
    explanation,
    replay_compatible: true as const,
  };

  // Compute checksum over the partial response (excludes preview_checksum itself)
  const preview_checksum = fnv1a32(canonicalizeJson(partial as unknown));

  return { ...partial, preview_checksum };
}

// ─── P-1: Current Resolution ──────────────────────────────────────────────────

/**
 * P-1: Current resolution — why is this playing now?
 * P-2: Future simulation  — what will play at time X?
 *
 * Both surfaces use the identical code path. The "future" is encoded in request.at.
 */
export function previewCurrent(request: PreviewRequest): PreviewResponse {
  assertPreviewPurity(request);

  const pre_input: PRE_Input = {
    screen_id:    request.screen_id,
    at:           request.at,
    system_state: request.system_state,
  };

  const output = resolve(pre_input);

  const explanation = request.include_reason_trace !== false
    ? explainResolution(output)
    : null;

  const entropy = request.include_entropy === true
    ? computeScreenEntropy(request.system_state, request.at)
    : null;

  return buildPreviewResponse(request, output, explanation, entropy);
}

// ─── P-3: Diff ────────────────────────────────────────────────────────────────

/**
 * P-3: Field-level diff between two preview states.
 */
export function previewDiff(
  fromRequest: PreviewRequest,
  toRequest:   PreviewRequest
): PreviewDiff {
  const from = previewCurrent(fromRequest);
  const to   = previewCurrent(toRequest);
  return buildDiff(from, to);
}

// ─── P-4: Entropy ─────────────────────────────────────────────────────────────

/**
 * P-4: Entropy + advisory context.
 * Advisory only — no PRE execution needed.
 */
export function previewEntropy(request: PreviewRequest): EntropyScore {
  assertPreviewPurity(request);
  return computeScreenEntropy(request.system_state, request.at);
}
