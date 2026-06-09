import { CorpusEntry, PREOutput, PRETraceEvent } from './types';
import { resolve } from './pre-engine';
import { GovernedClock } from './governed-clock';

export interface ReplayResult {
  corpus_entry_id: string;
  original_output: PREOutput;
  replayed_output: PREOutput | null;
  replayed_trace: PRETraceEvent | null;
  error?: string;
}

/**
 * Replay a single corpus entry.
 *
 * Reconstruction rules (REPLAY-AND-VERIFICATION-CONTRACT-v1.md §4):
 * 1. Load stored PREInput and rule_version from corpus entry
 * 2. Freeze GovernedClock to the corpus entry's governed_timestamp
 * 3. Run the pure PRE resolution function with the stored input
 * 4. GovernedClock does not advance during reconstruction
 * 5. Compare output_hash to corpus-recorded output_hash
 *
 * The caller is responsible for restoring GovernedClock after replay.
 */
export function replayEntry(entry: CorpusEntry): ReplayResult {
  // Step 2: Freeze GovernedClock to the original governed_timestamp
  GovernedClock.freeze(entry.input.governed_timestamp);

  const replayInput = {
    ...entry.input,
    corpus_entry_id: entry.corpus_entry_id, // mark as replay
  };

  const result = resolve(replayInput);

  if (!result.ok) {
    return {
      corpus_entry_id: entry.corpus_entry_id,
      original_output: entry.output,
      replayed_output: null,
      replayed_trace: null,
      error: `Replay resolution failed: ${result.failure.failure_code}: ${result.failure.message}`,
    };
  }

  const traceEvent: PRETraceEvent = {
    event_type: 'PRE_RESOLVED',
    trace_id: result.output.trace_id,
    resolution_id: result.output.resolution_id,
    scope_id: result.output.scope_id,
    governed_timestamp: result.output.governed_timestamp,
    rule_version: result.output.rule_version,
    input_hash: result.output.input_hash,
    output_hash: result.output.output_hash,
    resolution_level: result.output.resolution_level,
    effective_content: result.output.effective_content,
    resolution_path_length: result.output.resolution_path.length,
    emitted_at: GovernedClock.now(),
    corpus_entry_id: entry.corpus_entry_id,
  };

  return {
    corpus_entry_id: entry.corpus_entry_id,
    original_output: entry.output,
    replayed_output: result.output,
    replayed_trace: traceEvent,
  };
}

/**
 * Replay all entries in a corpus array.
 * Returns one ReplayResult per entry, in order.
 */
export function replayAll(entries: readonly CorpusEntry[]): ReplayResult[] {
  return entries.map((entry) => replayEntry(entry));
}
