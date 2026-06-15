'use strict';
/**
 * ReplayExporter — export-only replay session records.
 */

class ReplayExporter {
  constructor({ replayOrchestrator }) {
    this._replay = replayOrchestrator ?? null;
  }

  export(tenantId = null) {
    if (!this._replay) return { type: 'replay', error: 'orchestrator_unavailable', exported_at: Date.now() };
    let sessions = this._replay.getActiveSessions();
    if (tenantId) sessions = sessions.filter(s => !s.opts?.tenant_id || s.opts.tenant_id === tenantId);
    return { type: 'replay', exported_at: Date.now(), tenant_id: tenantId, session_count: sessions.length, sessions };
  }

  toNDJSON(tenantId = null) {
    return JSON.stringify(this.export(tenantId)) + '\n';
  }
}

module.exports = { ReplayExporter };
