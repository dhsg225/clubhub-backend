'use strict';
/**
 * Governance Kernel — domain-agnostic operational authority platform
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  ARCHITECTURE                                                   │
 * │                                                                 │
 * │  core/       — governance primitives                           │
 * │    clock.js            — deterministic replay clock            │
 * │    lineage.js          — causal event lineage                  │
 * │    deterministic-id.js — content-addressed IDs                 │
 * │    governance-db.js    — cluster state store + advisory locks  │
 * │    config-authority.js — versioned config with hash chain      │
 * │    distributed-authority.js — multi-instance lease + HA model  │
 * │    cluster-consensus.js — node fleet authority + freeze        │
 * │    incident-manager.js — incident state machine                │
 * │    audit-ledger.js     — append-only hash-chain ledger         │
 * │    session-authority.js — JTI revocation + key rotation        │
 * │                                                                 │
 * │  api/        — explicit governance APIs                        │
 * │    GovernanceKernel    — kernel lifecycle                      │
 * │    AuthorityCoordinator — epoch + freeze + consensus           │
 * │    IncidentManager     — incident CRUD                         │
 * │    AuditLedger         — ledger access                         │
 * │    DeterministicClock  — clock control                         │
 * │    FreezeController    — freeze governance                     │
 * │    LineageEngine       — lineage operations                    │
 * │    ConfigAuthority     — config CRUD                           │
 * │    OperatorAuthority   — token issuance + verification         │
 * │                                                                 │
 * │  event-bus.js — typed governance event bus                     │
 * │  plugins/     — plugin registration + capability safety        │
 * │  certification/ — DEVELOPMENT→HA_PRODUCTION cert suite         │
 * │  domains/     — multi-tenant authority isolation               │
 * │  adapters/    — runtime + storage adapters                     │
 * │  dsl/         — declarative governance policy language         │
 * │  observability/ — topology + drift detection                   │
 * │                                                                 │
 * │  HA CEILING: 2-node active/active, shared PostgreSQL primary   │
 * │  MULTI-REGION: NOT IMPLEMENTED                                 │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Consistency levels:
 *   MEMORY_ONLY      — lost on restart
 *   CACHE_COHERENT   — may be slightly stale (< STALE_THRESHOLD_MS)
 *   DB_AUTHORITATIVE — authoritative single DB read
 *   LINEARIZED       — pg_advisory_xact_lock serialized write
 *
 * Replay modes:
 *   LIVE       — normal operation
 *   REPLAY     — replaying from event log with frozen clock
 *   FORENSIC   — read-only analysis
 *   SIMULATION — deterministic frozen-clock simulation
 */

const { GovernanceKernel, CONSISTENCY_LEVELS, REPLAY_MODES } = require('./api/GovernanceKernel');
const { AuthorityCoordinator }  = require('./api/AuthorityCoordinator');
const { IncidentManager }       = require('./api/IncidentManager');
const { AuditLedger }           = require('./api/AuditLedger');
const { DeterministicClock }    = require('./api/DeterministicClock');
const { FreezeController, DB_FAILURE_POLICIES } = require('./api/FreezeController');
const { LineageEngine }         = require('./api/LineageEngine');
const { ConfigAuthority }       = require('./api/ConfigAuthority');
const { OperatorAuthority, ROLES } = require('./api/OperatorAuthority');
const eventBus                  = require('./event-bus');
const plugins                   = require('./plugins');
const { DomainRegistry, AuthorityNamespace } = require('./domains/DomainRegistry');
const observability             = require('./observability');
const { parse }                 = require('./dsl/parser');
const { compile }               = require('./dsl/compiler');
const { evaluate }              = require('./dsl/evaluator');
const GovernanceCertificationRunner = require('./certification/GovernanceCertificationRunner');

const core = {
  clock:               require('./core/clock'),
  lineage:             require('./core/lineage'),
  deterministicId:     require('./core/deterministic-id'),
  governanceDb:        require('./core/governance-db'),
  configAuthority:     require('./core/config-authority'),
  distributedAuthority:require('./core/distributed-authority'),
  clusterConsensus:    require('./core/cluster-consensus'),
  incidentManager:     require('./core/incident-manager'),
  auditLedger:         require('./core/audit-ledger'),
  sessionAuthority:    require('./core/session-authority'),
};

const adapters = {
  storage: {
    PostgresAdapter: require('./adapters/storage/PostgresAdapter'),
    MemoryAdapter:   require('./adapters/storage/MemoryAdapter'),
    SqliteAdapter:   require('./adapters/storage/SqliteAdapter'),
  },
  runtime: {
    NodejsRuntime:     require('./adapters/runtime/NodejsRuntime'),
    SimulationRuntime: require('./adapters/runtime/SimulationRuntime'),
  },
};

module.exports = {
  GovernanceKernel, CONSISTENCY_LEVELS, REPLAY_MODES,
  AuthorityCoordinator, IncidentManager, AuditLedger, DeterministicClock,
  FreezeController, DB_FAILURE_POLICIES, LineageEngine, ConfigAuthority,
  OperatorAuthority, ROLES,
  eventBus, plugins,
  DomainRegistry, AuthorityNamespace,
  observability,
  dsl:      { parse, compile, evaluate },
  GovernanceCertificationRunner,
  core,
  adapters,
};
