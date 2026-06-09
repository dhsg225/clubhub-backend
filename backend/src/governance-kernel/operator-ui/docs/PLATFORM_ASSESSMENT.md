# PLATFORM_ASSESSMENT.md
# Governance Kernel v1 — Operator Control Plane Phase A2 Assessment

**Phase:** A2 — Operator Control Plane + Governed UX Foundation
**Status:** COMPLETE
**Effective:** 2026-05-24

---

## 1. UI authority model

The control plane implements a **zero-authority client model**:

- Client has no kernel imports — `UI_AUTHORITY_BOUNDARY` rule enforced statically
- `GovernedStateStore` is read-only; no public write methods
- All mutations route: client → HTTP → `OperatorAuthority.requireAuth()` → kernel api/
- `AuditLedger` attribution on every operator command
- Role enforcement: ADMIN > OPERATOR > VIEWER (server-side, not client-side)

**Authority confidence scoring:** HIGH (LINEARIZED < 5s) / MEDIUM (CACHE_COHERENT < 120s) / LOW / UNKNOWN / DIVERGED

---

## 2. Replay model

The control plane implements the REPLAY_CONTRACT.md replay model in the UI layer:

- `ReplayTimeline` sorts events by `lineage_ts` ascending (required by replay contract)
- `GovernedStateStore.applyReplayEvent()` enforces replay mode guard — throws if called outside replay
- `received_at` is NOT updated during replay (stale detection does not trigger on historical events)
- `ForensicView` is side-effect free (no kernel imports, no DB access, no token operations)
- Replay mode disables live event stream application and all mutations
- Exit from replay: snapshot refetch → live state restored

**Replay rendering modes:** LIVE / REPLAY / FORENSIC / SIMULATION — visually distinguished

---

## 3. Stale-state handling

| Consistency level | Stale indicator | Threshold |
|------------------|-----------------|-----------|
| MEMORY_ONLY | Yellow "local state" badge | No threshold — always advisory |
| CACHE_COHERENT | Green → Yellow → STALE | 120s (mirrors kernel STALE_THRESHOLD_MS) |
| DB_AUTHORITATIVE | Green with DB icon | 5s for HIGH confidence |
| LINEARIZED (confirmed) | Green with lock icon | 5s for HIGH confidence |

Stale state is NEVER hidden. Operators must see `is_stale` indicators on all surfaces.
3+ consecutive stale events from same epoch → automatic snapshot refetch.

---

## 4. HA operational safety

The control plane respects the kernel's 2-node active/active HA ceiling:

- FREEZE: UI waits for `freeze_confirmed` (LINEARIZED) before showing confirmed state
- FREEZE_LOCAL (FAIL_CLOSED): UI shows distinct `FROZEN_LOCAL` badge — not `FROZEN_CONFIRMED`
- UNFREEZE: UI shows `UNFROZEN_CACHE` (MEMORY_ONLY) — not false confidence
- SPLIT_BRAIN: detected from divergent epochs or freeze_state → mutations immediately disabled
- FREEZE_EPOCH_DIVERGENCE: separate warning for nodes with different freeze_epochs
- DB_UNREACHABLE + unfrozen: CRITICAL alert (LINEARIZED ops unavailable)
- DB_UNREACHABLE + frozen: WARNING only (FAIL_CLOSED is safe)

---

## 5. Split-brain visualization guarantees

When `TopologyGraph.build()` detects split-brain:

1. `GovernedStateStore.detectSplitBrain()` → `SPLIT_BRAIN` rendering mode
2. `DriftVisualization.analyze()` → CRITICAL alert with `blocks_mutations: true`
3. `selectCanSubmitMutations('SPLIT_BRAIN')` → `false`
4. All mutation buttons disabled client-side (server-side enforcement is independent)
5. "Force DB check" available (routes to `isFrozenStrong(pool)` — DB_AUTHORITATIVE)

Resolution: operator confirms via DB check; `clearSplitBrain()` → snapshot refetch.

---

## 6. Operator attribution guarantees

Every mutating command carries:

```
operator_id (oid), role, jti, command, reason, justification,
lineage_ts (governed clock), authority_epoch
```

Appended to `AuditLedger` via `appendEntry()` (DB_ASYNC) or `appendLinearized()` for LINEARIZED commands.

JTI revocation polling: every 30 seconds.
Revocation detection: session immediately degraded to read-only.

---

## 7. Replay determinism assessment

| Surface | Determinism | Notes |
|---------|------------|-------|
| `ReplayTimeline.load()` | Deterministic sort by `lineage_ts` | Sub-ms ordering not guaranteed |
| `GovernedStateStore.applyReplayEvent()` | Deterministic | Same events → same state |
| `ForensicView.buildIncidentReport()` | Deterministic | Pure function of event array |
| `ConfigDiffEngine.hash()` | CONTENT_ADDRESSED | SHA-256 of `_stableStringify()` |
| `ConfigProposalBuilder` hash preview | CONTENT_ADDRESSED | Same as kernel |
| Topology model | Deterministic | Same input → same node status classification |

Non-deterministic UI surfaces:
- `received_at` (wall-clock — intentionally non-deterministic for stale detection)
- `OperatorSessionView._clockNow()` (wall-clock — expiry calculation)
- Plugin renderers with `deterministic: false`

---

## 8. Plugin safety ceiling

| Capability | v1 ceiling |
|-----------|------------|
| Plugin extension types | VIEW, REPLAY_RENDERER, TOPOLOGY_OVERLAY only |
| bypassGovernance | Hard rejection — no exceptions |
| Kernel imports | Forbidden in UI extensions (statically certified) |
| Mutation injection | Forbidden |
| Freeze/cert override | Forbidden extension types |
| Sandbox isolation | Contract-only (no OS/VM isolation in v1) |

v2 advisory: worker thread isolation for plugin renderers.

---

## 9. Operational risks introduced

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Polling lag (freeze state) | MEDIUM | 5s freeze poll; operators use "Force DB check" for critical decisions |
| FROZEN_LOCAL not visible in split-brain | MEDIUM | UI distinguishes LOCAL vs CONFIRMED states |
| JTI revocation propagation gap | LOW | 30s poll; known v1 gap (documented in CONSISTENCY_MODEL.md) |
| Plugin render blocking event loop | LOW | Contract enforcement; v2 isolation planned |
| Client-side role gate bypass | INFORMATIONAL | Server-side requireAuth() is the enforcement layer |
| Config drift not blocking | LOW | Advisory warning; manual restart required |
| Snapshot refetch during active operation | LOW | Snapshot loading banner; mutations re-enabled after load |

---

## 10. Certification status

### UI certification suite

Run: `node -e "require('./operator-ui').certifyUI().then(r => console.log(JSON.stringify(r, null, 2)))"`

Expected result:
```
UIConsistencyCertification:    10/10 PASS
ReplaySurfaceCertification:     8/8  PASS
AuthorityBoundaryCertification: 10/10 PASS
Overall: PASS
```

### Kernel certification (unchanged from A1)

```
Kernel certification: HA_PRODUCTION, CONDITIONAL (8/9 PASS, 1 CONDITIONAL, 0 FAIL)
OTA validator: 79/79 PASS, 0 WARN
```

**Phase A2 does not modify any kernel core/ or api/ files. Kernel certification is unchanged.**

---

## 11. Deployment topology ceiling

Inherited from kernel: **2-node active/active, shared PostgreSQL primary**.

The operator UI adds no new deployment constraints beyond the kernel's ceiling.

Additional UI-specific topology notes:
- Multiple UI clients may connect simultaneously (polling model handles this)
- Snapshot endpoint must be idempotent (GET)
- Event stream cursor endpoint must be stateless (server does not track client cursors)

---

## 12. Advisory-only UX paths (not subject to deprecation — tracked for v3)

| Gap | Impact | v2/v3 target |
|-----|--------|-----------|
| WebSocket push (no polling lag) | Freeze lag up to 5s | v2: WebSocket event push from BUS_EVENTS |
| JTI revocation push (not poll-based) | Revocation visible after 30s poll | v2: DB LISTEN/NOTIFY push |
| OS-level plugin sandbox | Misbehaving plugins can block event loop | v3: Worker thread isolation |
| Multi-domain cross-visualization | Cannot show multi-domain topology | v3: DomainRegistry integration |
| Automated split-brain resolution | Manual operator intervention required | v3: Consensus-driven auto-resolution |
| AI-assisted operator suggestions | No automation | Future: out of scope for governance kernel |

---

## 13. Files created — Phase A2

```
operator-ui/
├── index.js                                    — entry point + certifyUI()
├── state/
│   ├── GovernedStateStore.js                   — read-only client state container
│   ├── selectors.js                            — pure selector functions
│   └── reducers.js                             — event → state reducers + dispatch table
├── transport/
│   ├── GovernedEventStream.js                  — polling transport + replay stream
│   └── SnapshotClient.js                       — authoritative snapshot fetcher
├── replay/
│   ├── ReplayTimeline.js                       — cursor control + event sequencing
│   └── ForensicView.js                         — forensic overlay model
├── core/
│   ├── ConfigProposalBuilder.js                — governed config change proposals
│   ├── ConfigDiffEngine.js                     — config diff + hash computation
│   ├── OperatorSessionView.js                  — session state + role capability model
│   ├── TopologyGraph.js                        — topology model from cluster status
│   └── DriftVisualization.js                   — drift alert analysis
├── plugins/
│   ├── UIPluginRegistry.js                     — governed plugin UI extension system
│   ├── contracts.md                            — extension declaration contract
│   └── sandbox-rules.md                        — sandbox enforcement rules
├── certification/
│   ├── UIConsistencyCertification.js           — 10 state consistency checks
│   ├── ReplaySurfaceCertification.js           — 8 replay isolation checks
│   └── AuthorityBoundaryCertification.js       — 10 authority boundary checks
├── contracts/
│   ├── state-contracts.md                      — state slice + event envelope contracts
│   └── event-stream-contract.md               — transport ordering + reconnect contract
└── docs/
    ├── OPERATOR_UI_ARCHITECTURE.md             — 4-layer architecture + authority rules
    ├── UI_RUNTIME_MODEL.md                     — state lifecycle + polling model
    ├── UI_AUTHORITY_BOUNDARY.md                — authority operations by role + FVs
    ├── FREEZE_OPERATIONS.md                    — freeze UX contract
    ├── INCIDENT_OPERATIONS.md                  — incident lifecycle UX
    ├── CONFIG_MUTATION_WORKFLOW.md             — governed config editing model
    ├── SESSION_AUTHORITY_MODEL.md              — session + role + JTI model
    ├── TOPOLOGY_MODEL.md                       — HA topology visualization model
    └── PLATFORM_ASSESSMENT.md                 — this file
```

Total: **26 files** (13 .js, 12 .md, 1 index.js)

---

## 14. Invariants added by Phase A2

### UI-specific invariants (certified by A2 certification suite)

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| UI-01 | UI never imports governance-kernel/core/ or api/ | AuthorityBoundaryCertification ABC-01+02 |
| UI-02 | GovernedStateStore has no public write methods | UIConsistencyCertification UIC-01 |
| UI-03 | LINEARIZED operations are not applied optimistically | UIConsistencyCertification UIC-03 |
| UI-04 | Replay mode prevents live event application | UIConsistencyCertification UIC-04 |
| UI-05 | All state slices carry consistency_level | UIConsistencyCertification UIC-05 |
| UI-06 | Split-brain disables mutations | UIConsistencyCertification UIC-07 |
| UI-07 | ReplayTimeline sorts events ascending by lineage_ts | ReplaySurfaceCertification RSC-01 |
| UI-08 | received_at not updated during replay | ReplaySurfaceCertification RSC-02 |
| UI-09 | ForensicView has no side effects | ReplaySurfaceCertification RSC-04 |
| UI-10 | UIPluginRegistry rejects bypassGovernance: true | AuthorityBoundaryCertification ABC-04 |

These invariants DO NOT modify or weaken any kernel governance invariants from A1.
The kernel GOVERNANCE_INVARIANTS.md is unchanged.
