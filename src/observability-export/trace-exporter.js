'use strict';
/**
 * TraceExporter — export-only trace records. Append-only semantics preserved.
 */

class TraceExporter {
  constructor({ decisionTrace, traceStore }) {
    this._dt         = decisionTrace ?? null;
    this._traceStore = traceStore    ?? null;
  }

  exportDecisionTrace(agentId = null) {
    if (!this._dt) return { type: 'decision_trace', error: 'unavailable', exported_at: Date.now() };
    const entries = agentId
      ? this._dt.getFinalized().filter(e => e.agent_id === agentId)
      : this._dt.getFinalized();
    const chain = this._dt.verifyChain?.();
    return { type: 'decision_trace', exported_at: Date.now(), agent_id: agentId, entry_count: entries.length,
             chain_valid: chain?.valid ?? null, entries };
  }

  toNDJSON(agentId = null) {
    return JSON.stringify(this.exportDecisionTrace(agentId)) + '\n';
  }
}

module.exports = { TraceExporter };
