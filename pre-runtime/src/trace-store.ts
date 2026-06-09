import { PRETraceEvent, StateMutationEvent } from './types';

/**
 * Immutable append-only trace store.
 *
 * Entries are frozen on insertion and cannot be modified.
 * The store itself grows monotonically — no deletions, no updates.
 */

type TraceEntry =
  | { kind: 'PRE'; event: PRETraceEvent }
  | { kind: 'STATE'; event: StateMutationEvent };

const _entries: TraceEntry[] = [];

export const TraceStore = {
  appendPRE(event: PRETraceEvent): void {
    _entries.push(Object.freeze({ kind: 'PRE', event: Object.freeze({ ...event }) }));
  },

  appendState(event: StateMutationEvent): void {
    _entries.push(Object.freeze({ kind: 'STATE', event: Object.freeze({ ...event }) }));
  },

  getAll(): readonly TraceEntry[] {
    return _entries;
  },

  getPREEvents(): readonly PRETraceEvent[] {
    return _entries
      .filter((e): e is { kind: 'PRE'; event: PRETraceEvent } => e.kind === 'PRE')
      .map((e) => e.event);
  },

  getStateEvents(): readonly StateMutationEvent[] {
    return _entries
      .filter((e): e is { kind: 'STATE'; event: StateMutationEvent } => e.kind === 'STATE')
      .map((e) => e.event);
  },

  findPREByTraceId(traceId: string): PRETraceEvent | undefined {
    return TraceStore.getPREEvents().find((e) => e.trace_id === traceId);
  },

  /** Total event count across all types. */
  size(): number {
    return _entries.length;
  },

  /** Reset — only for use between isolated test runs. */
  _reset(): void {
    _entries.length = 0;
  },
};
