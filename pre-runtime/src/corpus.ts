import { CorpusEntry, PREInput, PREOutput, PRETraceEvent } from './types';
import { canonicalJSON } from './canonical-json';
import { sha256 } from './hash';

/**
 * Hash-chained corpus store.
 *
 * Every entry carries:
 *   - prior_entry_hash: the entry_hash of the previous entry (null for first)
 *   - entry_hash: SHA-256(canonical({ corpus_entry_id, input_hash, output_hash, prior_entry_hash }))
 *
 * Chain integrity is verifiable with verifyChain().
 * Entries are frozen on insertion.
 */

const _entries: CorpusEntry[] = [];

export const Corpus = {
  /**
   * Add a new corpus entry. Automatically computes entry_hash and links to the chain.
   */
  add(input: PREInput, output: PREOutput, traceEvent: PRETraceEvent): CorpusEntry {
    const corpus_entry_id = input.corpus_entry_id ?? output.resolution_id;
    const prior = _entries[_entries.length - 1] ?? null;
    const prior_entry_hash = prior ? prior.entry_hash : null;

    const entry_hash = sha256(
      canonicalJSON({
        corpus_entry_id,
        input_hash: output.input_hash,
        output_hash: output.output_hash,
        prior_entry_hash,
      })
    );

    const entry: CorpusEntry = Object.freeze({
      corpus_entry_id,
      input: Object.freeze({ ...input }),
      output: Object.freeze({ ...output }),
      trace_event: Object.freeze({ ...traceEvent }),
      prior_entry_hash,
      entry_hash,
    });

    _entries.push(entry);
    return entry;
  },

  get(corpus_entry_id: string): CorpusEntry | undefined {
    return _entries.find((e) => e.corpus_entry_id === corpus_entry_id);
  },

  getAll(): readonly CorpusEntry[] {
    return _entries;
  },

  /**
   * Verify hash chain integrity.
   * Returns true if every entry's prior_entry_hash matches the previous entry's entry_hash.
   */
  verifyChain(): boolean {
    for (let i = 1; i < _entries.length; i++) {
      if (_entries[i].prior_entry_hash !== _entries[i - 1].entry_hash) {
        return false;
      }
    }
    return true;
  },

  /** Reset — only for use between isolated test runs. */
  _reset(): void {
    _entries.length = 0;
  },
};
