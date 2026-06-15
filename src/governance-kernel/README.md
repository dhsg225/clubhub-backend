# Governance Kernel

**Version**: 1.0  **Status**: Architecture frozen  **Certification**: HA_PRODUCTION

The governance kernel is a domain-agnostic operational authority platform. It provides
deterministic, auditable, replay-capable state management for distributed systems where
correctness and operator trust are non-negotiable.

---

## Architecture map

```
governance-kernel/
  ├── api/                    ← Public API layer (plugin/app boundary)
  │   ├── AuthorityCoordinator.js
  │   ├── FreezeController.js
  │   ├── IncidentManager.js
  │   ├── ConfigAuthority.js
  │   ├── OperatorAuthority.js
  │   └── AuditLedger.js
  ├── core/                   ← Internal primitives (FORBIDDEN for external import)
  │   ├── epoch-store.js
  │   ├── freeze-store.js
  │   ├── incident-store.js
  │   ├── config-store.js
  │   └── deterministic-clock.js
  ├── certification/          ← Static analysis certification suite
  │   ├── GovernanceCertificationRunner.js
  │   ├── DocsCertificationRunner.js
  │   └── runners/            ← Individual certification checks
  ├── platform-docs/          ← 12 canonical platform documents
  ├── operator-playbooks/     ← 9 deterministic operator runbooks
  ├── diagrams/               ← 8 ASCII architecture diagrams
  ├── examples/               ← 5 runnable example directories
  ├── operator-ui/            ← Operator control plane UI
  └── plugins/                ← Governed plugin runtimes (e.g. ota-runtime)
```

## Subsystem inventory

| Subsystem             | Files                    | Purpose                                         |
|-----------------------|--------------------------|-------------------------------------------------|
| Authority API         | `api/`                   | Public interfaces for all governance operations |
| Core primitives       | `core/`                  | Internal state stores + deterministic clock     |
| Event bus             | `event-bus.js`           | In-process ring buffer (5000 events)            |
| Certification         | `certification/`         | Static analysis suite — 79+ checks              |
| Platform docs         | `platform-docs/`         | Operator-facing documentation (12 docs)         |
| Operator playbooks    | `operator-playbooks/`    | Step-by-step runbooks (9 playbooks)             |
| Diagrams              | `diagrams/`              | ASCII system diagrams (8 docs)                  |
| Examples              | `examples/`              | Runnable integration examples (5 dirs)          |
| Operator UI           | `operator-ui/`           | Express routes + frontend components            |
| OTA plugin runtime    | `plugins/ota-runtime/`   | Governed OTA deployment runtime                 |

## Certification status

Run full certification:
```bash
node -e "
  const { GovernanceCertificationRunner } = require('./certification');
  new GovernanceCertificationRunner().run().then(r => {
    console.log('Overall:', r.overall_rating);
    r.results.forEach(s => console.log(' ', s.name, s.rating, s.pass_count + '/' + (s.pass_count + s.fail_count)));
  });
"
```

Run documentation certification:
```bash
node -e "
  const { certifyDocs } = require('./certification/DocsCertificationRunner');
  certifyDocs().then(r => {
    console.log('Overall:', r.overall_rating, r.total_pass + ' PASS', r.total_fail + ' FAIL');
    r.results.forEach(s => console.log(' ', s.name, s.rating));
  });
"
```

## Operational ceiling (HARD constraints)

| Dimension      | Limit                                                  |
|----------------|--------------------------------------------------------|
| Nodes          | 2 (active/active)                                      |
| Database       | 1 PostgreSQL primary (no read replicas for writes)     |
| Consensus      | `pg_advisory_xact_lock` (not Raft/Paxos)              |
| Multi-region   | NOT SUPPORTED                                          |
| Auto-heal      | NOT SUPPORTED (manual operator resolution)             |
| Event bus size | 5000 events (ring buffer, oldest dropped under load)   |

## Consistency levels

| Level             | Guarantee                                   | Mechanism                     |
|-------------------|---------------------------------------------|-------------------------------|
| `MEMORY_ONLY`     | Local node only, no persistence             | In-process state              |
| `CACHE_COHERENT`  | Eventually consistent, DB-backed read       | Polling (default 5s)          |
| `DB_AUTHORITATIVE`| Consistent read at moment of DB query       | Direct DB read                |
| `LINEARIZED`      | Total order across all nodes                | `pg_advisory_xact_lock`       |

## Replay guarantees

- Events sorted by `lineage_ts` ascending — deterministic order
- `received_at` NOT updated during replay — wall-clock is frozen
- All mutations blocked during replay mode — `assertNotReplay()` throws `REPLAY_ISOLATION_VIOLATION`
- `ForensicView` is side-effect free — no DB writes, no audit entries

## Authority boundary rule

**Application and plugin code MUST only import from `governance-kernel/api/`.**

Direct imports from `governance-kernel/core/` are certification failures. This is enforced
by static analysis in `AuthorityBypassCertification` and `GovernedRoutingCertification`.

## Threat model summary

| Threat                        | Mitigation                                            |
|-------------------------------|-------------------------------------------------------|
| Unauthorized mutation         | JWT-based OperatorAuthority + `requireAuth(role)`     |
| Replay isolation violation    | `assertNotReplay()` guards on all mutating methods    |
| Split-brain state divergence  | Epoch comparison + mutation block on divergence       |
| DB unreachable during deploy  | `freezeLocal()` FAIL_CLOSED policy                    |
| Authority boundary bypass     | Static certification (AuthorityBypassCertification)   |
| Audit trail tampering         | Append-only AuditLedger, no delete operations         |

Full threat model: [platform-docs/THREAT_MODEL_GUIDE.md](platform-docs/THREAT_MODEL_GUIDE.md)

## Quickstart

1. Create kernel instance with PostgreSQL pool
2. Initialize all API classes via dependency injection
3. Register with certification runner to verify configuration
4. Integrate plugin runtimes via `init(deps)` pattern

Full guide: [platform-docs/KERNEL_QUICKSTART.md](platform-docs/KERNEL_QUICKSTART.md)

## Documentation index

| Document                                                            | Purpose                           |
|---------------------------------------------------------------------|-----------------------------------|
| [PLATFORM_OVERVIEW.md](platform-docs/PLATFORM_OVERVIEW.md)         | System overview + architecture    |
| [KERNEL_QUICKSTART.md](platform-docs/KERNEL_QUICKSTART.md)         | Integration guide                 |
| [RUNTIME_LIFECYCLE_GUIDE.md](platform-docs/RUNTIME_LIFECYCLE_GUIDE.md) | Lifecycle states              |
| [REPLAY_GUIDE.md](platform-docs/REPLAY_GUIDE.md)                   | Replay execution model            |
| [AUTHORITY_MODEL_GUIDE.md](platform-docs/AUTHORITY_MODEL_GUIDE.md) | Consistency + authority           |
| [PLUGIN_DEVELOPMENT_GUIDE.md](platform-docs/PLUGIN_DEVELOPMENT_GUIDE.md) | Plugin integration guide  |
| [CERTIFICATION_GUIDE.md](platform-docs/CERTIFICATION_GUIDE.md)     | Certification runner guide        |
| [HA_TOPOLOGY_GUIDE.md](platform-docs/HA_TOPOLOGY_GUIDE.md)         | HA deployment model               |
| [THREAT_MODEL_GUIDE.md](platform-docs/THREAT_MODEL_GUIDE.md)       | Security threat model             |
| [FAILURE_MODE_GUIDE.md](platform-docs/FAILURE_MODE_GUIDE.md)       | Failure modes + FAIL_CLOSED       |
| [DETERMINISM_GUIDE.md](platform-docs/DETERMINISM_GUIDE.md)         | Determinism levels + replay       |
| [GLOSSARY.md](platform-docs/GLOSSARY.md)                           | Terminology definitions           |

## Operator playbooks

- [FREEZE_PLAYBOOK.md](operator-playbooks/FREEZE_PLAYBOOK.md)
- [INCIDENT_RESPONSE_PLAYBOOK.md](operator-playbooks/INCIDENT_RESPONSE_PLAYBOOK.md)
- [REPLAY_FORENSICS_PLAYBOOK.md](operator-playbooks/REPLAY_FORENSICS_PLAYBOOK.md)
- [CONFIG_ROLLBACK_PLAYBOOK.md](operator-playbooks/CONFIG_ROLLBACK_PLAYBOOK.md)
- [DEGRADED_MODE_PLAYBOOK.md](operator-playbooks/DEGRADED_MODE_PLAYBOOK.md)
- [HA_FAILOVER_PLAYBOOK.md](operator-playbooks/HA_FAILOVER_PLAYBOOK.md)
- [PLUGIN_FAILURE_PLAYBOOK.md](operator-playbooks/PLUGIN_FAILURE_PLAYBOOK.md)
- [CERTIFICATION_FAILURE_PLAYBOOK.md](operator-playbooks/CERTIFICATION_FAILURE_PLAYBOOK.md)
- [SECURITY_RESPONSE_PLAYBOOK.md](operator-playbooks/SECURITY_RESPONSE_PLAYBOOK.md)
