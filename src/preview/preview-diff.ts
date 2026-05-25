/**
 * Preview diff — field-level diff between two PreviewResponses.
 *
 * Deterministic: same inputs always produce same output.
 * Field comparison order is fixed.
 */

import type { PreviewResponse, PreviewDiff, PreviewFieldDiff } from './types';
import type { ContentMix, ReasonTrace } from '../pre/types';
import { fnv1a32 } from '../pre/algorithms/fnv1a32';
import { canonicalizeJson } from '../pre/algorithms/canonicalize-json';

// ─── Field Comparators ────────────────────────────────────────────────────────

export function contentMixDiffers(a: ContentMix, b: ContentMix): boolean {
  return (
    a.campaign_pct  !== b.campaign_pct  ||
    a.sponsor_pct   !== b.sponsor_pct   ||
    a.override_pct  !== b.override_pct  ||
    a.fallback_pct  !== b.fallback_pct  ||
    a.system_pct    !== b.system_pct
  );
}

export function traceOutcomesDiffer(
  a: ReasonTrace | null,
  b: ReasonTrace | null
): boolean {
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;

  const keys: Array<keyof ReasonTrace> = [
    'level_0_emergency',
    'level_1_operational',
    'level_2_scheduled',
    'level_3_campaign',
    'level_4_sponsorship',
    'level_5_structural',
    'level_6_device_truth',
  ];

  for (const key of keys) {
    const ea = a[key];
    const eb = b[key];
    if (ea === null && eb === null) continue;
    if (ea === null || eb === null) return true;
    if (ea.outcome !== eb.outcome) return true;
  }

  return false;
}

// ─── Diff Builder ─────────────────────────────────────────────────────────────

export function buildDiff(from: PreviewResponse, to: PreviewResponse): PreviewDiff {
  const field_diffs: PreviewFieldDiff[] = [];

  // Fixed comparison order — deterministic
  if (from.resolution_level !== to.resolution_level) {
    field_diffs.push({ path: 'resolution_level', from: from.resolution_level, to: to.resolution_level });
  }

  if (from.is_fallback !== to.is_fallback) {
    field_diffs.push({ path: 'is_fallback', from: from.is_fallback, to: to.is_fallback });
  }

  if (from.playlist_checksum !== to.playlist_checksum) {
    // Detailed playlist diff — item by item
    const maxLen = Math.max(from.playlist.length, to.playlist.length);
    for (let i = 0; i < maxLen; i++) {
      const fa = from.playlist[i];
      const ta = to.playlist[i];
      if (fa === undefined) {
        field_diffs.push({ path: `playlist[${i}]`, from: null, to: ta });
      } else if (ta === undefined) {
        field_diffs.push({ path: `playlist[${i}]`, from: fa, to: null });
      } else if (fa.content_id !== ta.content_id || fa.duration_ms !== ta.duration_ms || fa.weight !== ta.weight) {
        field_diffs.push({ path: `playlist[${i}]`, from: fa, to: ta });
      }
    }
  }

  if (contentMixDiffers(from.content_mix, to.content_mix)) {
    const mixKeys: Array<keyof ContentMix> = ['campaign_pct', 'sponsor_pct', 'override_pct', 'fallback_pct', 'system_pct'];
    for (const k of mixKeys) {
      if (from.content_mix[k] !== to.content_mix[k]) {
        field_diffs.push({ path: `content_mix.${k}`, from: from.content_mix[k], to: to.content_mix[k] });
      }
    }
  }

  if (from.advisory_tier !== to.advisory_tier) {
    field_diffs.push({ path: 'advisory_tier', from: from.advisory_tier, to: to.advisory_tier });
  }

  if (from.confidence_score !== to.confidence_score) {
    field_diffs.push({ path: 'confidence_score', from: from.confidence_score, to: to.confidence_score });
  }

  if (traceOutcomesDiffer(from.reason_trace, to.reason_trace)) {
    field_diffs.push({ path: 'reason_trace.outcomes', from: summarizeTraceOutcomes(from.reason_trace), to: summarizeTraceOutcomes(to.reason_trace) });
  }

  const diff: PreviewDiff = {
    from_at:                  from.generated_at,
    to_at:                    to.generated_at,
    screen_id:                from.screen_id,
    has_changes:              field_diffs.length > 0,
    resolution_level_changed: from.resolution_level !== to.resolution_level,
    is_fallback_changed:      from.is_fallback !== to.is_fallback,
    playlist_changed:         from.playlist_checksum !== to.playlist_checksum,
    content_mix_changed:      contentMixDiffers(from.content_mix, to.content_mix),
    advisory_tier_changed:    from.advisory_tier !== to.advisory_tier,
    reason_trace_changed:     traceOutcomesDiffer(from.reason_trace, to.reason_trace),
    field_diffs,
    diff_checksum: '',
  };

  // Compute checksum last, excluding itself
  diff.diff_checksum = fnv1a32(canonicalizeJson({ ...diff, diff_checksum: '' } as unknown));

  return diff;
}

function summarizeTraceOutcomes(trace: import('../pre/types').ReasonTrace | null): Record<string, string | null> {
  if (trace === null) return {};
  return {
    l0: trace.level_0_emergency?.outcome    ?? null,
    l1: trace.level_1_operational?.outcome  ?? null,
    l2: trace.level_2_scheduled?.outcome    ?? null,
    l3: trace.level_3_campaign?.outcome     ?? null,
    l4: trace.level_4_sponsorship?.outcome  ?? null,
    l5: trace.level_5_structural?.outcome   ?? null,
    l6: trace.level_6_device_truth?.outcome ?? null,
  };
}
