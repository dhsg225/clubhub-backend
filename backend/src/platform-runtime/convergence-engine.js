'use strict';
/**
 * ConvergenceEngine — detect subsystem divergence, replay drift, stale authority state.
 * Detection and reporting ONLY. No mutation. No automatic recovery.
 */

const DIVERGENCE_CODES = Object.freeze({
  REPLAY_DRIFT:            'REPLAY_DRIFT',
  STALE_AUTHORITY:         'STALE_AUTHORITY',
  ORPHANED_WORKFLOW:       'ORPHANED_WORKFLOW',
  LIFECYCLE_INCONSISTENCY: 'LIFECYCLE_INCONSISTENCY',
  EXECUTION_BYPASS:        'EXECUTION_BYPASS',
  TRACE_GAP:               'TRACE_GAP',
  TOPOLOGY_MISMATCH:       'TOPOLOGY_MISMATCH',
  DECISION_CHAIN_BREAK:    'DECISION_CHAIN_BREAK',
  FROZEN_MUTATION_ATTEMPT: 'FROZEN_MUTATION_ATTEMPT',
});

class ConvergenceEngine {
  constructor({ lifecycle, registry, topology, traceStore, decisionTrace, orchestration, eventBus } = {}) {
    this._lifecycle    = lifecycle    ?? null;
    this._registry     = registry     ?? null;
    this._topology     = topology     ?? null;
    this._traceStore   = traceStore   ?? null;
    this._decisionTrace= decisionTrace?? null;
    this._orchestration= orchestration?? null;
    this._eventBus     = eventBus     ?? null;
    this._findings     = [];
    this._seq          = 0;
  }

  _finding(code, detail, severity = 'WARN') {
    const f = { id: `cvg_${++this._seq}`, code, detail, severity, detected_at: Date.now() };
    this._findings.push(f);
    if (this._eventBus) this._eventBus.emit('platform.convergence.finding', f);
    return f;
  }

  detectSubsystemDivergence() {
    const findings = [];
    if (!this._registry) return findings;
    const snap = this._registry.snapshot();
    for (const [id, entry] of Object.entries(snap.runtimes)) {
      if (entry.required && entry.state !== 'READY') {
        findings.push(this._finding(
          DIVERGENCE_CODES.LIFECYCLE_INCONSISTENCY,
          `runtime '${id}' is required but state is '${entry.state}'`,
          'ERROR'
        ));
      }
    }
    return findings;
  }

  detectReplayDrift() {
    const findings = [];
    if (!this._decisionTrace) return findings;
    const verified = this._decisionTrace.verifyChain?.();
    if (verified && !verified.valid) {
      findings.push(this._finding(
        DIVERGENCE_CODES.REPLAY_DRIFT,
        `decision chain broken at entry ${verified.broken_at}: ${verified.reason}`,
        'ERROR'
      ));
    }
    return findings;
  }

  detectStaleAuthority() {
    const findings = [];
    if (!this._lifecycle) return findings;
    const state = this._lifecycle.getState();
    // RECOVERING for more than 5 history entries indicates stale authority
    const history = this._lifecycle.getHistory();
    const recoveringEntries = history.filter(h => h.state === 'RECOVERING');
    if (recoveringEntries.length > 3) {
      findings.push(this._finding(
        DIVERGENCE_CODES.STALE_AUTHORITY,
        `lifecycle entered RECOVERING ${recoveringEntries.length} times — authority may be stale`,
        'WARN'
      ));
    }
    return findings;
  }

  detectOrphanedWorkflows() {
    const findings = [];
    if (!this._topology) return findings;
    const workflows = this._topology.getByType('WORKFLOW');
    // Workflows with no linked agent are orphaned
    for (const wf of workflows) {
      const related = this._topology.getRelated(wf.id);
      const hasAgent = related.some(r => r.type === 'AGENT');
      if (!hasAgent) {
        findings.push(this._finding(
          DIVERGENCE_CODES.ORPHANED_WORKFLOW,
          `workflow '${wf.id}' has no linked agent`,
          'WARN'
        ));
      }
    }
    return findings;
  }

  detectTopologyMismatch() {
    const findings = [];
    if (!this._topology || !this._registry) return findings;
    const regSnap = this._registry.snapshot();
    const topoSnap = this._topology.snapshot();
    for (const id of Object.keys(regSnap.runtimes)) {
      if (!topoSnap.entities[id]) {
        findings.push(this._finding(
          DIVERGENCE_CODES.TOPOLOGY_MISMATCH,
          `runtime '${id}' registered but missing from topology`,
          'WARN'
        ));
      }
    }
    return findings;
  }

  runFullScan() {
    const before = this._findings.length;
    const d1 = this.detectSubsystemDivergence();
    const d2 = this.detectReplayDrift();
    const d3 = this.detectStaleAuthority();
    const d4 = this.detectOrphanedWorkflows();
    const d5 = this.detectTopologyMismatch();
    const new_findings = [...d1, ...d2, ...d3, ...d4, ...d5];
    return {
      scan_at:     Date.now(),
      finding_count: new_findings.length,
      errors:      new_findings.filter(f => f.severity === 'ERROR').length,
      warnings:    new_findings.filter(f => f.severity === 'WARN').length,
      findings:    new_findings,
    };
  }

  getFindings() { return [...this._findings]; }

  snapshot() {
    return {
      total_findings: this._findings.length,
      errors:         this._findings.filter(f => f.severity === 'ERROR').length,
      warnings:       this._findings.filter(f => f.severity === 'WARN').length,
      findings:       this.getFindings(),
    };
  }
}

module.exports = { ConvergenceEngine, DIVERGENCE_CODES };
