/**
 * Replay harness type definitions.
 *
 * Constitutional authority: EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md §3
 * Constitutional reference: REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md §3
 */

import type { PRE_Input, PRE_Output } from '../../pre/types';
import type { DivergenceReport } from '../divergence/types';

// ─── Corpus Classes ───────────────────────────────────────────────────────────

export type CorpusClass =
  | 'golden'
  | 'edge_case'
  | 'failure_state'
  | 'entropy'
  | 'chaos'
  | 'historical_regression'
  | 'cross_version_compat';

// ─── Replay Packet ────────────────────────────────────────────────────────────

export interface ReplayPacket {
  // Identity
  packet_id:              string;     // UUID v4, immutable
  packet_version:         string;     // semver, e.g., "1.0.0"
  corpus_class:           CorpusClass;

  // Capture provenance
  captured_at:            number;     // UTC ms
  capture_source:
    | 'manual_authored'
    | 'property_shrink'
    | 'incident_capture'
    | 'production_sample'
    | 'milestone_baseline';
  captured_by:            string;
  pre_impl_version:       string;     // semver
  constitution_version:   string;     // e.g., "v1"
  incident_id:            string | null;
  milestone_tag:          string | null;

  // Narrative
  description:            string;
  invariants_under_test:  string[];
  specification_refs:     string[];

  // Input/Output
  input:                  PRE_Input;
  expected_output:        PRE_Output;

  // Integrity hashes
  input_hash:             string;     // fnv1a32 hex of canonicalizeJson(input)
  output_hash:            string;     // fnv1a32 hex of canonicalizeJson(expected_output)
  packet_hash:            string;     // sha256 hex of canonicalizeJson(packet minus packet_hash)

  // Corpus governance
  status:                 'active' | 'archived';
  archived_at:            number | null;
  archived_reason:        string | null;
  archived_by:            string | null;
  superseded_by:          string | null;
  retirement_record_id:   string | null;
}

// ─── Packet Load Result ───────────────────────────────────────────────────────

export type PacketLoadError =
  | 'HASH_MISMATCH_INPUT'
  | 'HASH_MISMATCH_OUTPUT'
  | 'HASH_MISMATCH_PACKET'
  | 'SCHEMA_INVALID'
  | 'SCHEMA_VERSION_UNSUPPORTED'
  | 'FILE_NOT_FOUND'
  | 'JSON_PARSE_ERROR';

export interface PacketLoadResult {
  packet: ReplayPacket | null;
  error: PacketLoadError | null;
  errorDetail?: string;
}

// ─── Replay Result ────────────────────────────────────────────────────────────

export type ReplayResultStatus =
  | 'PASS'                   // actual_output_hash === expected output_hash
  | 'BEHAVIORAL_DIVERGENCE'  // hashes differ; divergence classified
  | 'INTEGRITY_FAILURE'      // hash verification failed at packet load
  | 'INVARIANT_VIOLATION'    // invariant assertion failed during execution
  | 'EXECUTION_ERROR';       // unexpected error during PRE execution

export interface ReplayResult {
  packet_id:            string;
  packet_class:         CorpusClass;
  status:               ReplayResultStatus;
  actual_output_hash:   string | null;     // null on integrity failure
  expected_output_hash: string;
  divergence:           DivergenceReport | null;
  invariant_results?:   unknown[];
  error_message?:       string;
  execution_ms:         number;
}

// ─── Replay Run Report ────────────────────────────────────────────────────────

export interface ReplayRunReport {
  run_id:                string;    // UUID v4 assigned at run start
  started_at:            number;    // UTC ms
  completed_at:          number;    // UTC ms
  pre_impl_version:      string;
  corpus_schema_version: string;
  total_packets:         number;
  passed:                number;
  failed:                number;
  integrity_failures:    number;
  divergences:           DivergenceReport[];
  results:               ReplayResult[];
  overall_result:        'PASS' | 'FAIL' | 'INTEGRITY_FAILURE';
}

// ─── Harness Options ──────────────────────────────────────────────────────────

export interface ReplayHarnessOptions {
  /** Absolute path to corpus/ directory */
  corpusPath:  string;
  filter?: {
    class?:        CorpusClass[];
    status?:       'active' | 'all';
    packetIds?:    string[];
    invariants?:   string[];
  };
  /** MUST remain false — parallel execution violates INV-3 verification semantics */
  parallel?:   false;
  /** Absolute path for run artifacts */
  outputPath:  string;
}

// ─── Corpus Index ─────────────────────────────────────────────────────────────

export interface CorpusIndexEntry {
  packet_id:    string;
  file_path:    string;    // relative to corpus/ directory
  corpus_class: CorpusClass;
  status:       'active' | 'archived';
  description:  string;
  captured_at:  number;
  packet_hash:  string;    // for fast integrity check without loading full file
}

export interface CorpusIndex {
  schema_version:     string;    // "1.0.0"
  generated_at:       number;    // UTC ms
  total_packets:      number;
  active_packets:     number;
  archived_packets:   number;
  packets:            CorpusIndexEntry[];
}
