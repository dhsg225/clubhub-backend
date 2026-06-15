'use strict';
/**
 * ObservabilityExportCertification
 *
 * OEC-01: observability-export/index.js exists
 * OEC-02: metrics-exporter.js has no execute/route/mutation methods
 * OEC-03: topology-exporter.js has no execute/route/mutation methods
 * OEC-04: functional — MetricsExporter.export() returns type:'metrics'
 * OEC-05: functional — TopologyExporter.export() returns type:'topology'
 * OEC-06: functional — TraceExporter.exportDecisionTrace() returns type:'decision_trace'
 * OEC-07: functional — ConvergenceExporter.export() returns type:'convergence'
 * OEC-08: functional — ReplayExporter.export() returns type:'replay'
 * OEC-09: functional — EventStreamExporter.toNDJSON() returns string
 * OEC-10: functional — TopologyExporter.export(tenantId) filters by tenant
 */
const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../observability-export');

class ObservabilityExportCertification {
  async run() {
    const checks = [
      this._exists ('OEC-01', 'index.js',            'createObservabilityExport', 'index.js exists'),
      this._no_str ('OEC-02', 'metrics-exporter.js', 'sdkClient',                'no sdkClient in metrics-exporter'),
      this._no_str ('OEC-03', 'topology-exporter.js','sdkClient',                'no sdkClient in topology-exporter'),
      this._metrics_type(),
      this._topology_type(),
      this._trace_type(),
      this._convergence_type(),
      this._replay_type(),
      this._event_stream_ndjson(),
      this._topology_tenant_filter(),
    ];
    return this._result('ObservabilityExportCertification', checks);
  }

  _exists(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (!fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `missing '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _no_str(id, file, marker, description) {
    const fp = path.join(ROOT, file);
    if (!fs.existsSync(fp)) return { id, description, status: 'FAIL', detail: `${file} missing` };
    if (fs.readFileSync(fp, 'utf8').includes(marker))
      return { id, description, status: 'FAIL', detail: `found '${marker}'` };
    return { id, description, status: 'PASS', detail: null };
  }

  _metrics_type() {
    const id = 'OEC-04'; const desc = 'MetricsExporter.export() returns type:metrics';
    try {
      const { MetricsExporter } = require('../../observability-export/metrics-exporter');
      const me = new MetricsExporter({});
      const r  = me.export();
      if (r.type !== 'metrics') return { id, description: desc, status: 'FAIL', detail: `type: ${r.type}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _topology_type() {
    const id = 'OEC-05'; const desc = 'TopologyExporter.export() returns type:topology';
    try {
      const { TopologyExporter } = require('../../observability-export/topology-exporter');
      const te = new TopologyExporter({ topology: { snapshot: () => ({ entities: {}, edges: {}, entity_count: 0 }) } });
      const r  = te.export();
      if (r.type !== 'topology') return { id, description: desc, status: 'FAIL', detail: `type: ${r.type}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _trace_type() {
    const id = 'OEC-06'; const desc = 'TraceExporter.exportDecisionTrace() returns type:decision_trace';
    try {
      const { TraceExporter }  = require('../../observability-export/trace-exporter');
      const { DecisionTrace }  = require('../../ai-orchestration/decision-trace');
      const te = new TraceExporter({ decisionTrace: new DecisionTrace() });
      const r  = te.exportDecisionTrace();
      if (r.type !== 'decision_trace') return { id, description: desc, status: 'FAIL', detail: `type: ${r.type}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _convergence_type() {
    const id = 'OEC-07'; const desc = 'ConvergenceExporter.export() returns type:convergence';
    try {
      const { ConvergenceExporter } = require('../../observability-export/convergence-exporter');
      const { ConvergenceEngine }   = require('../../platform-runtime/convergence-engine');
      const ce = new ConvergenceExporter({ convergenceEngine: new ConvergenceEngine() });
      const r  = ce.export();
      if (r.type !== 'convergence') return { id, description: desc, status: 'FAIL', detail: `type: ${r.type}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _replay_type() {
    const id = 'OEC-08'; const desc = 'ReplayExporter.export() returns type:replay';
    try {
      const { ReplayExporter }     = require('../../observability-export/replay-exporter');
      const { ReplayOrchestrator } = require('../../platform-runtime/replay-orchestrator');
      const re = new ReplayExporter({ replayOrchestrator: new ReplayOrchestrator() });
      const r  = re.export();
      if (r.type !== 'replay') return { id, description: desc, status: 'FAIL', detail: `type: ${r.type}` };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _event_stream_ndjson() {
    const id = 'OEC-09'; const desc = 'EventStreamExporter.toNDJSON() returns string';
    try {
      const { EventStreamExporter } = require('../../observability-export/event-stream-exporter');
      const es = new EventStreamExporter();
      const s  = es.toNDJSON();
      if (typeof s !== 'string') return { id, description: desc, status: 'FAIL', detail: 'not a string' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _topology_tenant_filter() {
    const id = 'OEC-10'; const desc = 'TopologyExporter.export(tenantId) filters by tenant';
    try {
      const { TopologyExporter } = require('../../observability-export/topology-exporter');
      const mockTopology = {
        snapshot: () => ({
          entities: {
            'e1': { attrs: { tenant_id: 'tA' } },
            'e2': { attrs: { tenant_id: 'tB' } },
            'e3': { attrs: {} },  // global
          },
          edges: {},
          entity_count: 3,
        }),
      };
      const te   = new TopologyExporter({ topology: mockTopology });
      const snap = te.export('tA');
      if (snap.entities['e2']) return { id, description: desc, status: 'FAIL', detail: 'tB entity leaked' };
      if (!snap.entities['e1']) return { id, description: desc, status: 'FAIL', detail: 'tA entity missing' };
      return { id, description: desc, status: 'PASS', detail: null };
    } catch (err) { return { id, description: desc, status: 'FAIL', detail: err.message }; }
  }

  _result(name, checks) {
    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    return { name, rating: fail > 0 ? 'FAIL' : 'PASS', pass_count: pass, fail_count: fail, warn_count: 0, checks };
  }
}

module.exports = { ObservabilityExportCertification };
