import {
  CorpusEntry,
  PREOutput,
  VerificationResult,
  FailureClass,
  FieldDiff,
} from './types';
import { ReplayResult } from './replay-engine';
import { canonicalJSON } from './canonical-json';

/**
 * Verification engine — detects divergence between original and replay execution.
 *
 * Classification per REPLAY-AND-VERIFICATION-CONTRACT-v1.md §6:
 *
 * CLASS_1 — DETERMINISM_FAILURE
 *   Input hashes match but output hashes differ.
 *   The PRE produced different outputs for identical inputs.
 *
 * CLASS_2 — CORPUS_DIVERGENCE
 *   The replay produced an output whose hash differs from the corpus record.
 *   (Also covers: input hash differs, meaning corpus entry was tampered with.)
 *
 * CLASS_3 — RECONSTRUCTION_FAILURE
 *   The replay failed to produce any output at all (missing rule version,
 *   corrupt input fields, resolution error).
 *
 * CLASS_4 — PARITY_VIOLATION
 *   Output hashes match but resolution paths differ step-by-step.
 *   Same answer reached through different evaluation order — hash collision
 *   or path mutation.
 *
 * CLASS_5 — APPROXIMATION_UNDISCLOSED
 *   Not detected here (frontend rendering concern). Kept for completeness.
 */
export function verify(entry: CorpusEntry, replayResult: ReplayResult): VerificationResult {
  const id = entry.corpus_entry_id;

  // CLASS_3: Replay failed to produce output
  if (replayResult.replayed_output === null) {
    return {
      result: 'DIVERGENCE_DETECTED',
      corpus_entry_id: id,
      failure_class: 'CLASS_3_RECONSTRUCTION_FAILURE',
      reason: replayResult.error ?? 'Replay produced no output',
    };
  }

  const original = entry.output;
  const replayed = replayResult.replayed_output;

  // Primary comparison: output_hash
  // Any mismatch between stored corpus and fresh replay is CLASS_2 (corpus divergence).
  // CLASS_1 (determinism failure — same input, different output on different runs) is
  // detected separately by verifyDeterminism(), which runs the PRE N times.
  if (original.output_hash !== replayed.output_hash) {
    const diffs = diffOutputFields(original, replayed);
    const inputAlsoChanged = original.input_hash !== replayed.input_hash;
    return {
      result: 'DIVERGENCE_DETECTED',
      corpus_entry_id: id,
      failure_class: 'CLASS_2_CORPUS_DIVERGENCE',
      reason: inputAlsoChanged
        ? 'Output hash and input hash both differ from corpus record. ' +
          'Corpus entry or replay input has been tampered with.'
        : 'Output hash differs from corpus record. ' +
          'PRE code may have changed without an approved corpus update.',
      diff: diffs,
    };
  }

  // Secondary comparison: resolution_path step-by-step (CLASS_4)
  const pathDivergent = pathsDiffer(original, replayed);
  if (pathDivergent) {
    return {
      result: 'DIVERGENCE_DETECTED',
      corpus_entry_id: id,
      failure_class: 'CLASS_4_PARITY_VIOLATION',
      reason:
        'Output hashes match but resolution paths differ step-by-step. ' +
        'Possible hash collision or path mutation.',
      diff: [
        {
          field: 'resolution_path',
          original: original.resolution_path,
          replayed: replayed.resolution_path,
        },
      ],
    };
  }

  return {
    result: 'MATCH',
    corpus_entry_id: id,
  };
}

/**
 * Verify a corpus entry N times to confirm determinism.
 * Returns the first divergence found, or MATCH if all runs agree.
 */
export function verifyDeterminism(
  entry: CorpusEntry,
  replayResults: ReplayResult[]
): VerificationResult {
  const id = entry.corpus_entry_id;

  if (replayResults.length === 0) {
    return {
      result: 'DIVERGENCE_DETECTED',
      corpus_entry_id: id,
      failure_class: 'CLASS_3_RECONSTRUCTION_FAILURE',
      reason: 'No replay results provided',
    };
  }

  const firstHash = replayResults[0].replayed_output?.output_hash;

  for (let i = 1; i < replayResults.length; i++) {
    const runHash = replayResults[i].replayed_output?.output_hash;
    if (runHash !== firstHash) {
      return {
        result: 'DIVERGENCE_DETECTED',
        corpus_entry_id: id,
        failure_class: 'CLASS_1_DETERMINISM_FAILURE',
        reason: `Run ${i + 1} of ${replayResults.length} produced a different output_hash than run 1. PRE is non-deterministic.`,
        diff: [
          { field: 'output_hash (run 1)', original: firstHash, replayed: runHash },
        ],
      };
    }
  }

  return { result: 'MATCH', corpus_entry_id: id };
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

function diffOutputFields(original: PREOutput, replayed: PREOutput): FieldDiff[] {
  const fields: (keyof PREOutput)[] = [
    'effective_content',
    'resolution_level',
    'resolution_winner_id',
    'scope_id',
    'governed_timestamp',
    'rule_version',
    'input_hash',
    'output_hash',
  ];

  return fields
    .filter((f) => canonicalJSON(original[f]) !== canonicalJSON(replayed[f]))
    .map((f) => ({
      field: String(f),
      original: original[f],
      replayed: replayed[f],
    }));
}

function pathsDiffer(original: PREOutput, replayed: PREOutput): boolean {
  const op = original.resolution_path;
  const rp = replayed.resolution_path;
  if (op.length !== rp.length) return true;
  for (let i = 0; i < op.length; i++) {
    if (
      op[i].step !== rp[i].step ||
      op[i].evaluated !== rp[i].evaluated ||
      op[i].result !== rp[i].result ||
      op[i].reason !== rp[i].reason
    ) {
      return true;
    }
  }
  return false;
}
