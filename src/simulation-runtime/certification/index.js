'use strict';
/**
 * Simulation Runtime Certification Index
 * Exports all 5 A7 certification runners.
 */
const { SimulationDeterminismCertification } = require('./SimulationDeterminismCertification');
const { FaultInjectionCertification }        = require('./FaultInjectionCertification');
const { ReplayCorruptionCertification }      = require('./ReplayCorruptionCertification');
const { ClusterPartitionCertification }      = require('./ClusterPartitionCertification');
const { AdversarialReplayCertification }     = require('./AdversarialReplayCertification');

module.exports = {
  SimulationDeterminismCertification,
  FaultInjectionCertification,
  ReplayCorruptionCertification,
  ClusterPartitionCertification,
  AdversarialReplayCertification,
};
