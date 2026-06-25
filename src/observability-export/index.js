'use strict';
const { MetricsExporter }       = require('./metrics-exporter');
const { TopologyExporter }      = require('./topology-exporter');
const { TraceExporter }         = require('./trace-exporter');
const { CertificationExporter } = require('./certification-exporter');
const { ConvergenceExporter }   = require('./convergence-exporter');
const { ReplayExporter }        = require('./replay-exporter');
const { EventStreamExporter }   = require('./event-stream-exporter');

function createObservabilityExport(deps = {}) {
  return {
    metrics:       new MetricsExporter(deps),
    topology:      new TopologyExporter(deps),
    trace:         new TraceExporter(deps),
    certification: new CertificationExporter(deps),
    convergence:   new ConvergenceExporter(deps),
    replay:        new ReplayExporter(deps),
    eventStream:   new EventStreamExporter(deps),
  };
}

module.exports = {
  createObservabilityExport,
  MetricsExporter,
  TopologyExporter,
  TraceExporter,
  CertificationExporter,
  ConvergenceExporter,
  ReplayExporter,
  EventStreamExporter,
};
