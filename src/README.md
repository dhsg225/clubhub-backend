# src/ — Constitutional Infrastructure

This directory contains the executable constitutional substrate for ClubHub TV.

## Ownership

All code in this directory is governed by:
- `docs/ENGINEERING-CONSTITUTION-v1.md`
- `docs/EXECUTABLE-CONSTITUTION-BOOTSTRAP-v1.md`

Changes require PR review. Changes to `pre/` require a passing invariant + corpus gate.
Changes to `verification/invariants/` require a second reviewer.

## Subdirectories

| Directory | Purpose | Owner |
|-----------|---------|-------|
| `pre/` | Playback Resolution Engine — pure deterministic function | PRE maintainer |
| `verification/` | Invariant engine, replay harness, parity, divergence | Platform team |
| `entropy/` | M-01 through M-12 calculators, entropy score, batch runner | Platform team |
| `preview/` | Preview endpoint — wraps PRE with no side effects | Platform team |
| `chaos/` | Chaos scenario runner and assertions | Platform team |
| `observability/` | Structured logger, metrics, correlation IDs | Any engineer |

## Constitutional Constraints

- `src/pre/` MUST remain pure. No writes. No network. No randomness.
- `src/verification/` MUST NOT modify any production state.
- Entropy calculators in `src/entropy/` MUST NOT write to configuration tables.
- All enforcement aligns with `docs/ENGINEERING-CONSTITUTION-v1.md`.
