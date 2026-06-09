# corpus/ — Replay Packet Corpus

## Constitutional Role

The corpus is the executable behavioral specification of PRE in fixture form.
Every active packet is a permanent regression anchor.

Defined in: `docs/REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md`

## Ownership

**Owner:** Platform team
**Write policy:**
- `golden/` — PR + **two reviewers**; retirement requires two approvals
- `edge_cases/` — PR + one reviewer
- `historical_regression/` — PR following incident close (incident lead)
- `archived/` — Retirement process only

## Critical Rule: Append-Only

The `corpus/` directory is treated as an **append-only source of truth**.
- Force-push, rebase, or history-rewrite touching committed corpus files = CONSTITUTIONAL_BREACH
- Deleting a golden fixture to fix a CI failure = constitutional violation of highest order
- Expected outputs change only via the constitutional amendment + retirement process

## Directory Structure

```
corpus/
├── CORPUS-INDEX.json              # Authoritative index; updated on every add/retire
├── golden/                        # GOLD-001 through GOLD-030 — primary behavioral spec
├── edge_cases/                    # EDGE-001 through EDGE-015 — boundary conditions
├── failure_states/                # Invalid/degraded input scenarios
├── entropy/                       # Entropy progression scenarios ENT-001 through ENT-004
├── chaos/                         # Chaos fixture captures CHAOS-001 through CHAOS-007
├── historical_regression/         # Production incidents promoted to permanent fixtures
├── cross_version_compat/          # Cross-version behavioral compatibility
├── archived/                      # Retired packets with full audit trail
│   ├── golden/
│   ├── edge_cases/
│   └── retirement_records/
└── integrity/                     # Daily SHA-256 snapshots of all active packet files
```

## Packet Schema

All packets conform to `ReplayPacket` schema v1.0.0 (see `docs/REFERENCE-STATE-AND-CANONICAL-FIXTURES-v1.md §3`).
Schema validated by `corpus/CORPUS-INDEX.json` and at load time by the replay harness.

## Integrity Verification

Run: `npx ts-node scripts/verify-corpus-integrity.ts`
Daily snapshots: `corpus/integrity/corpus-checksum-{YYYY-MM-DD}.sha256`
